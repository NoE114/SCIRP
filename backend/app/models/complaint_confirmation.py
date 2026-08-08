from datetime import datetime
from app.extensions import db


class ComplaintConfirmation(db.Model):
    __tablename__ = "complaint_confirmations"
    __table_args__ = (
        db.UniqueConstraint("user_id", "complaint_id", name="uq_user_complaint_confirmation"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaints.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("confirmations", lazy=True))
    complaint = db.relationship("Complaint", backref=db.backref("confirmations", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "complaint_id": self.complaint_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
