from flask import Blueprint, jsonify
from app.extensions import db
from app.models.user import User
from app.routes.auth import role_required


def create_dev_blueprint():
    """Blueprint with development-only diagnostic routes.

    Only registered when the app is NOT in production. Contains the
    unauthenticated DB write endpoint /test-db which must never be
    available in production.
    """
    dev_bp = Blueprint("dev_test", __name__)

    @dev_bp.route("/test-db")
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

        db_type = "SQLite" if db.engine.name == "sqlite" else "MySQL"
        return jsonify({
            "status": "success",
            "message": f"Read/write to {db_type} works",
            "test_user": fetched.to_dict(),
        })

    @dev_bp.route("/admin-only")
    @role_required("admin")
    def admin_only():
        return jsonify({"msg": "Admin access granted"})

    return dev_bp