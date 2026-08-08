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
    proof_image_filename = db.Column(db.String(255))
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
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    is_spam = db.Column(db.Boolean, default=False, server_default="0", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # 1. SLA & Escalation
    sla_deadline = db.Column(db.DateTime, nullable=True)
    escalation_level = db.Column(db.Integer, default=0, nullable=False)  # 0: Officer, 1: Dept Head, 2: Admin

    # 2. Ward & Zone
    ward_id = db.Column(db.Integer, db.ForeignKey("wards.id"), nullable=True)
    zone_id = db.Column(db.Integer, db.ForeignKey("zones.id"), nullable=True)

    # 3. Clustering
    cluster_id = db.Column(db.Integer, db.ForeignKey("complaint_clusters.id"), nullable=True)

    # 4. Public Tracking
    tracking_id = db.Column(db.String(100), unique=True, index=True, nullable=True)

    # 5. Feedback & Ratings
    rating = db.Column(db.Integer, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    satisfaction_status = db.Column(db.String(50), nullable=True)

    # 6. Resolution Evidence Details
    proof_uploaded_at = db.Column(db.DateTime, nullable=True)
    proof_uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    proof_remarks = db.Column(db.Text, nullable=True)
    proof_latitude = db.Column(db.Numeric(10, 8), nullable=True)
    proof_longitude = db.Column(db.Numeric(11, 8), nullable=True)

    # 7. Assigned Officer
    officer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    user = db.relationship("User", foreign_keys=[user_id], backref=db.backref("complaints", lazy=True))
    department = db.relationship("Department", backref=db.backref("complaints", lazy=True))
    ward = db.relationship("Ward", foreign_keys=[ward_id], backref=db.backref("complaints", lazy=True))
    zone = db.relationship("Zone", foreign_keys=[zone_id], backref=db.backref("complaints", lazy=True))
    cluster = db.relationship("ComplaintCluster", foreign_keys=[cluster_id], backref=db.backref("complaints", lazy=True))
    proof_uploader = db.relationship("User", foreign_keys=[proof_uploaded_by_id], backref=db.backref("uploaded_proofs", lazy=True))
    assigned_officer = db.relationship("User", foreign_keys=[officer_id], backref=db.backref("assigned_tasks", lazy=True))

    def to_dict(self):
        # Dynamically get upvote / confirmation count
        upvotes_count = self.confirmations.count() if hasattr(self, 'confirmations') else 0

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "image_url": f"/api/complaints/{self.id}/image" if self.image_filename else None,
            "proof_image_url": f"/api/complaints/{self.id}/proof-image" if self.proof_image_filename else None,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "priority": self.priority.value,
            "status": self.status.value,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "is_spam": self.is_spam,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "sla_deadline": self.sla_deadline.isoformat() if self.sla_deadline else None,
            "escalation_level": self.escalation_level,
            "ward_id": self.ward_id,
            "ward_name": self.ward.name if self.ward else None,
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else None,
            "cluster_id": self.cluster_id,
            "cluster_name": self.cluster.name if self.cluster else None,
            "tracking_id": self.tracking_id,
            "rating": self.rating,
            "feedback": self.feedback,
            "satisfaction_status": self.satisfaction_status,
            "proof_uploaded_at": self.proof_uploaded_at.isoformat() if self.proof_uploaded_at else None,
            "proof_uploaded_by_id": self.proof_uploaded_by_id,
            "proof_uploaded_by_name": self.proof_uploader.name if self.proof_uploader else None,
            "proof_remarks": self.proof_remarks,
            "proof_latitude": float(self.proof_latitude) if self.proof_latitude else None,
            "proof_longitude": float(self.proof_longitude) if self.proof_longitude else None,
            "officer_id": self.officer_id,
            "officer_name": self.assigned_officer.name if self.assigned_officer else None,
            "upvotes": upvotes_count,
        }
