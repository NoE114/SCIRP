from app.routes.test import test_bp
from app.routes.auth import auth_bp

def register_routes(app):
    app.register_blueprint(test_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
