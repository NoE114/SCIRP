from flask import Flask, jsonify
from config import config, resolve_config_name
from app.extensions import db, jwt

import click
from flask.cli import with_appcontext


def create_app(config_name=None):
    """Application factory.

    Config is selected from `config_name`, or resolved from APP_ENV /
    FLASK_ENV when not provided. Production requires SECRET_KEY,
    JWT_SECRET_KEY and DATABASE_URL (see ProductionConfig).
    """
    if config_name is None:
        config_name = resolve_config_name()

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    if config_name == "production":
        # Read secrets/DB fresh from env at boot (not at class import time).
        import os
        app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")
        app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY")
        app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
        from config import enforce_production_dependencies
        enforce_production_dependencies(app.config)

    db.init_app(app)
    jwt.init_app(app)

    from app.routes import register_routes
    register_routes(app)

    register_dev_commands(app)

    _register_error_handlers(app)

    with app.app_context():
        db.create_all()
        _seed_reference_data()

        # Demo users only in non-production environments.
        if app.config.get("SEED_DEMO_USERS", False):
            from app.models.user import seed_users
            seed_users()

    return app


def _seed_reference_data():
    """Idempotently seed reference data (departments/zones/wards/sla).

    These are required lookup tables for the platform to function in any
    environment, so they are seeded whenever their tables are empty. They
    never touch user/account data.
    """
    from app.models.department import seed_departments, Department
    from app.models.zone import seed_zones, Zone
    from app.models.ward import seed_wards, Ward
    from app.models.sla_config import seed_sla_configs, SlaConfig

    if db.session.query(Department).count() == 0:
        seed_departments()
    if db.session.query(Zone).count() == 0:
        seed_zones()
    if db.session.query(Ward).count() == 0:
        seed_wards()
    if db.session.query(SlaConfig).count() == 0:
        seed_sla_configs()


@click.command("seed-dev")
@with_appcontext
def seed_dev_command():
    """Seed demo/reference data and demo user accounts (development only)."""
    from app.models.user import seed_users
    seed_users()
    click.echo("Seeded demo users for development.")


def register_dev_commands(app):
    app.cli.add_command(seed_dev_command)


def _register_error_handlers(app):
    """JSON error responses so the SPA can render API failures cleanly."""

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"msg": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"msg": "Method not allowed"}), 405

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"msg": "Uploaded file is too large"}), 413

    @app.errorhandler(500)
    def server_error(e):
        app.logger.error("Unhandled error: %s", e)
        return jsonify({"msg": "Internal server error"}), 500
