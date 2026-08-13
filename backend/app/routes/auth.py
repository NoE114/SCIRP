from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from datetime import datetime, timedelta
from functools import wraps
import hashlib
import os
import uuid
from app.extensions import db
from app.models.user import User, UserRole
from app.services.ratelimit import rate_limit

auth_bp = Blueprint("auth", __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

# Opaque password-reset tokens: signed, time-limited, and NOT usable as JWTs.
# They only validate at POST /auth/reset-password.
RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60  # 1 hour


def _reset_serializer():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="password-reset"
    )


def role_required(*roles):
    """Decorator that restricts access to users with one of the specified roles.

    The role is re-validated against the DB on every request, so demoted or
    deactivated users lose access immediately (not just at token expiry).
    """
    allowed_roles = []
    for r in roles:
        if hasattr(r, "value"):
            allowed_roles.append(r.value)
        else:
            allowed_roles.append(r)

    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            user_id = int(get_jwt_identity())
            user = db.session.get(User, user_id)
            if not user or not user.is_active:
                return jsonify({"msg": "Account is not active or no longer exists"}), 401
            if user.role.value not in allowed_roles:
                return jsonify({"msg": "Forbidden: insufficient role"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper


@auth_bp.route("/register", methods=["POST"])
@rate_limit(max_hits=5, window_seconds=3600)
def register():
    name = request.form.get("name")
    email = request.form.get("email")
    password = request.form.get("password")
    phone = request.form.get("phone")

    if not name or not email or not password:
        return jsonify({"msg": "name, email, and password are required"}), 400

    if db.session.query(User).filter_by(email=email).first():
        return jsonify({"msg": "Email already registered"}), 409

    if "id_proof" not in request.files:
        return jsonify({"msg": "ID proof file is required"}), 400

    file = request.files["id_proof"]
    if not file or not file.filename:
        return jsonify({"msg": "No selected ID proof file"}), 400

    from app.services.uploads import file_matches_ext

    ok, msg = file_matches_ext(file, {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"})
    if not ok:
        return jsonify({"msg": msg}), 400

    ext = os.path.splitext(file.filename)[1].lower()

    id_proof_filename = f"id_proof_{uuid.uuid4().hex}{ext}"
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(UPLOAD_FOLDER, id_proof_filename))

    user = User(
        name=name,
        email=email,
        phone=phone,
        role=UserRole.CITIZEN,
        id_proof_filename=id_proof_filename,
        is_active=False,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"msg": "User registered successfully. Pending administrator approval.", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
@rate_limit(max_hits=10, window_seconds=300)
def login():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"msg": "email and password are required"}), 400

    user = db.session.query(User).filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"msg": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"msg": "Your account is pending approval by an administrator."}), 403

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value, "name": user.name},
    )

    return jsonify({
        "access_token": access_token,
        "user": user.to_dict(),
    })


@auth_bp.route("/users/<int:user_id>/id-proof", methods=["GET"])
@jwt_required()
def get_id_proof(user_id):
    user_id_self = int(get_jwt_identity())
    viewer = db.session.get(User, user_id_self)
    if not viewer or not viewer.is_active:
        return jsonify({"msg": "Account is not active or no longer exists"}), 401
    if viewer.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can view ID proofs"}), 403

    user = db.session.get(User, user_id)
    if not user or not user.id_proof_filename:
        return jsonify({"msg": "ID proof not found"}), 404

    return send_from_directory(UPLOAD_FOLDER, user.id_proof_filename)


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/forgot-password", methods=["POST"])
@rate_limit(max_hits=3, window_seconds=3600)
def forgot_password():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    email = data.get("email")
    if not email:
        return jsonify({"msg": "email is required"}), 400

    user = db.session.query(User).filter_by(email=email).first()
    if not user:
        # Do not reveal whether the email exists.
        return jsonify({"msg": "If that email exists, a reset token has been generated"}), 200

    from app.models.password_reset_token import PasswordResetToken

    # Clear any previously issued, unused tokens for this user so only the
    # most recent reset email works.
    db.session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).delete()

    # Opaque reset token: signed with SECRET_KEY, 1h expiry, bound to the
    # user's email. Only the raw value (stored hashed) ever reaches the user,
    # and it is NOT a JWT — it cannot authorize any endpoint except reset.
    reset_token = _reset_serializer().dumps({"email": user.email, "nonce": uuid.uuid4().hex})
    db.session.add(PasswordResetToken(
        token_hash=hashlib.sha256(reset_token.encode()).hexdigest(),
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(seconds=RESET_TOKEN_MAX_AGE_SECONDS),
    ))
    db.session.commit()

    # In development only, print the token to console so the reset flow is
    # usable without SMTP. Never in production (would leak tokens to logs).
    if current_app.config.get("DEBUG"):
        print(f"[DEV PASSWORD RESET] For {user.email}: {reset_token}")

    return jsonify({
        "msg": "Password reset token generated",
        "reset_token": reset_token,
    }), 200


@auth_bp.route("/reset-password", methods=["POST"])
@rate_limit(max_hits=5, window_seconds=3600)
def reset_password():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    token = data.get("token")
    new_password = data.get("password")

    if not token or not new_password:
        return jsonify({"msg": "token and password are required"}), 400

    from app.models.password_reset_token import PasswordResetToken

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stored = db.session.query(PasswordResetToken).filter_by(token_hash=token_hash).first()
    if not stored or stored.used_at is not None:
        return jsonify({"msg": "Invalid or already-used reset token"}), 400
    if stored.expires_at < datetime.utcnow():
        return jsonify({"msg": "Reset token has expired. Please request a new one."}), 400

    try:
        payload = _reset_serializer().loads(token, max_age=RESET_TOKEN_MAX_AGE_SECONDS)
    except SignatureExpired:
        return jsonify({"msg": "Reset token has expired. Please request a new one."}), 400
    except BadSignature:
        return jsonify({"msg": "Invalid reset token."}), 400

    user = db.session.get(User, stored.user_id)
    if not user:
        return jsonify({"msg": "Invalid reset token."}), 400

    user.set_password(new_password)
    stored.used_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"msg": "Password has been reset. You can now log in."}), 200
