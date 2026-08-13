from datetime import datetime

from app.extensions import db


class PasswordResetToken(db.Model):
    """One-time password-reset tokens.

    The raw token is sent to the user (signed, time-limited). Its SHA-256
    hash is stored here so each token can only be used once, and so a
    compromised DB dump cannot be used to mint new tokens.
    """

    __tablename__ = "password_reset_token"

    id = db.Column(db.Integer, primary_key=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)