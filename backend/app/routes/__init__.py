from app.routes.test import test_bp
from app.routes.auth import auth_bp
from app.routes.complaints import complaints_bp

def register_routes(app):
    app.register_blueprint(test_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(complaints_bp, url_prefix="/api/complaints")
