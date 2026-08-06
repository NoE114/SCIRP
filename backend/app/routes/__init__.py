from app.routes.test import test_bp
from app.routes.auth import auth_bp
from app.routes.complaints import complaints_bp
from app.routes.departments import departments_bp
from app.routes.admin import admin_bp
from app.routes.analytics import analytics_bp

def register_routes(app):
    app.register_blueprint(test_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(complaints_bp, url_prefix="/api/complaints")
    app.register_blueprint(departments_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
