from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from datetime import datetime, timedelta
from functools import wraps
from app.extensions import db
from app.models.user import User, UserRole

auth_bp = Blueprint("auth", __name__)


def role_required(*roles):
    """Decorator that restricts access to users with one of the specified roles."""
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
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in allowed_roles:
                return jsonify({"msg": "Forbidden: insufficient role"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")
    role_str = data.get("role", "citizen")

    if not name or not email or not password:
        return jsonify({"msg": "name, email, and password are required"}), 400

    if role_str not in [r.value for r in UserRole]:
        return jsonify({"msg": "Invalid role"}), 400

    if db.session.query(User).filter_by(email=email).first():
        return jsonify({"msg": "Email already registered"}), 409

    user = User(
        name=name,
        email=email,
        phone=phone,
        role=UserRole(role_str),
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"msg": "User registered", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
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

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role.value, "name": user.name},
    )

    return jsonify({
        "access_token": access_token,
        "user": user.to_dict(),
    })


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    email = data.get("email")
    if not email:
        return jsonify({"msg": "email is required"}), 400

    user = db.session.query(User).filter_by(email=email).first()
    if not user:
        return jsonify({"msg": "If that email exists, a reset token has been generated"}), 200

    reset_token = create_access_token(
        identity=str(user.id),
        additional_claims={"reset": True},
        expires_delta=timedelta(hours=1),
    )

    return jsonify({
        "msg": "Password reset token generated",
        "reset_token": reset_token,
    }), 200
