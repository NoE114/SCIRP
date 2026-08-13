from app.routes.auth import auth_bp
from app.routes.complaints import complaints_bp
from app.routes.departments import departments_bp
from app.routes.admin import admin_bp
from app.routes.analytics import analytics_bp
from app.routes.notifications import notifications_bp
from app.routes.ai import ai_bp
from app.routes.announcements import announcements_bp
from app.routes.health import health_bp


def register_routes(app):
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(complaints_bp, url_prefix="/api/complaints")
    app.register_blueprint(departments_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(ai_bp, url_prefix="/api")
    app.register_blueprint(announcements_bp, url_prefix="/api")

    # Diagnostics (DB write, admin-only tester) only in development.
    if app.config.get("DEBUG") and not app.config.get("TESTING"):
        from app.routes.dev_only import create_dev_blueprint
        app.register_blueprint(create_dev_blueprint(), url_prefix="/api")