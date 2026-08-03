import enum
from datetime import datetime
from app.extensions import db


class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    VERIFIED = "verified"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ComplaintPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Complaint(db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), default="other")
    image_filename = db.Column(db.String(255))
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    priority = db.Column(
        db.Enum(ComplaintPriority),
        default=ComplaintPriority.MEDIUM,
        nullable=False,
    )
    status = db.Column(
        db.Enum(ComplaintStatus),
        default=ComplaintStatus.SUBMITTED,
        nullable=False,
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = db.relationship("User", backref=db.backref("complaints", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "image_url": f"/api/complaints/{self.id}/image" if self.image_filename else None,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "priority": self.priority.value,
            "status": self.status.value,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
