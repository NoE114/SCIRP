from flask import Blueprint, jsonify
from app.extensions import db
from app.models.user import User

test_bp = Blueprint("test", __name__)

@test_bp.route("/health")
def health():
    return jsonify({"status": "ok", "message": "SCIRP backend is running"})

@test_bp.route("/test-db")
def test_db():
    test_user = User(
        name="Test User",
        email="test@example.com",
        role="citizen",
        is_active=True,
    )
    test_user.set_password("testpass123")
    db.session.add(test_user)
    db.session.commit()
    db.session.refresh(test_user)

    fetched = db.session.get(User, test_user.id)
    db.session.delete(test_user)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Read/write to MySQL works",
        "test_user": fetched.to_dict(),
    })