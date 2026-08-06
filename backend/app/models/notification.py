from datetime import datetime
from app.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    related_complaint_id = db.Column(
        db.Integer, db.ForeignKey("complaints.id"), nullable=True
    )
    is_read = db.Column(db.Boolean, default=False, server_default="0", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "category": self.category,
            "related_complaint_id": self.related_complaint_id,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }
