import os
from datetime import timedelta

# Known dev fallbacks — must never be accepted in production.
_DEV_SECRET_KEY = "dev-secret-key-change-in-production"
_DEV_JWT_SECRET_KEY = "dev-jwt-secret-change-me"


def _require_secret(value, name):
    if not value or value in (_DEV_SECRET_KEY, _DEV_JWT_SECRET_KEY):
        raise RuntimeError(
            f"{name} must be set to a strong, unique value in production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return value


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", _DEV_SECRET_KEY)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", _DEV_JWT_SECRET_KEY)
    # JWT access tokens expire after 30 minutes by default
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    # Upload directory is relative to the backend package
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "uploads"
    )
    # Reference data seeding (departments/zones/wards/sla) always runs when
    # tables are empty; demo users are only seeded in non-production envs.
    SEED_DEMO_USERS = True


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(os.path.abspath(os.path.dirname(__file__)), "scirp.db")
    )


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL", "sqlite:///:memory:"
    )
    JWT_SECRET_KEY = "test-jwt-secret-that-is-definitely-long-enough-32b"
    SEED_DEMO_USERS = False


class ProductionConfig(Config):
    DEBUG = False
    SEED_DEMO_USERS = False
    # Secure cookie defaults — safe behind HTTPS (Render provides it)
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


def enforce_production_dependencies(cfg):
    """Validate required prod secrets/DB are set; called by create_app only for ProductionConfig."""
    _require_secret(cfg.get("SECRET_KEY"), "SECRET_KEY")
    _require_secret(cfg.get("JWT_SECRET_KEY"), "JWT_SECRET_KEY")
    if not cfg.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError("DATABASE_URL must be set in production.")


def resolve_config_name():
    """Pick the active config from the environment, defaulting to development.

    Accepted: APP_ENV or FLASK_ENV (development / testing / production).
    """
    env = os.environ.get("APP_ENV") or os.environ.get("FLASK_ENV") or "development"
    env = env.strip().lower()
    if env in ("prod", "production"):
        return "production"
    if env in ("test", "testing"):
        return "testing"
    return "development"


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
