from flask import Flask
from config import config
from app.extensions import db, jwt

def create_app(config_name="default"):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    jwt.init_app(app)

    from app.routes import register_routes
    register_routes(app)

    with app.app_context():
        db.create_all()
        from app.models.department import seed_departments
        from app.models.department import Department
        if db.session.query(Department).count() == 0:
            seed_departments()

    return app