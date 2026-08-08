from datetime import datetime
from app.extensions import db


class ComplaintCluster(db.Model):
    __tablename__ = "complaint_clusters"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    status = db.Column(db.String(50), default="active", nullable=False)  # active, resolved
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        # Count related complaints dynamically to avoid circular issues
        from app.models.complaint import Complaint
        complaints_count = db.session.query(Complaint).filter_by(cluster_id=self.id).count()
        complaints = db.session.query(Complaint).filter_by(cluster_id=self.id).all()
        first_reported = min(c.created_at for c in complaints) if complaints else self.created_at
        latest_reported = max(c.created_at for c in complaints) if complaints else self.created_at

        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "status": self.status,
            "complaints_count": complaints_count,
            "first_reported": first_reported.isoformat() if first_reported else None,
            "latest_reported": latest_reported.isoformat() if latest_reported else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
