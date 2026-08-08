from datetime import datetime
from app.extensions import db


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), default="general", nullable=False)
    zone_id = db.Column(db.Integer, db.ForeignKey("zones.id"), nullable=True)
    ward_id = db.Column(db.Integer, db.ForeignKey("wards.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    zone = db.relationship("Zone", backref=db.backref("announcements", lazy=True))
    ward = db.relationship("Ward", backref=db.backref("announcements", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "category": self.category,
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else "All Zones",
            "ward_id": self.ward_id,
            "ward_name": self.ward.name if self.ward else "All Wards",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
