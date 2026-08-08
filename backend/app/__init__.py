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
        
        from app.models.department import seed_departments, Department
        if db.session.query(Department).count() == 0:
            seed_departments()
            
        from app.models.zone import seed_zones, Zone
        if db.session.query(Zone).count() == 0:
            seed_zones()
            
        from app.models.ward import seed_wards, Ward
        if db.session.query(Ward).count() == 0:
            seed_wards()

        from app.models.sla_config import seed_sla_configs, SlaConfig
        if db.session.query(SlaConfig).count() == 0:
            seed_sla_configs()
        
        from app.models.user import seed_users
        seed_users()

    return app