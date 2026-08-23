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
            "upvotes": upvotes_count,
        }


def seed_complaints():
    from app.extensions import db
    from app.models.user import User
    from app.models.department import Department
    from app.models.ward import Ward
    from app.models.zone import Zone
    from app.models.complaint import Complaint, ComplaintStatus, ComplaintPriority
    from datetime import datetime, timedelta

    if db.session.query(Complaint).count() > 0:
        return

    citizen = db.session.query(User).filter_by(email="ashish@civicpulse.com").first()
    if not citizen:
        return

    john = db.session.query(User).filter_by(email="john@civicpulse.com").first()
    sarah = db.session.query(User).filter_by(email="sarah@civicpulse.com").first()
    mike = db.session.query(User).filter_by(email="officer3@civicpulse.com").first()
    clara = db.session.query(User).filter_by(email="officer4@civicpulse.com").first()

    road_dept = db.session.query(Department).filter_by(name="Road").first()
    water_dept = db.session.query(Department).filter_by(name="Water").first()
    elec_dept = db.session.query(Department).filter_by(name="Electricity").first()
    sani_dept = db.session.query(Department).filter_by(name="Sanitation").first()

    ward_1 = db.session.query(Ward).filter_by(name="Ward 1 (Airport Area)").first()
    ward_3 = db.session.query(Ward).filter_by(name="Ward 3 (Colaba)").first()
    ward_5 = db.session.query(Ward).filter_by(name="Ward 5 (Chembur)").first()
    ward_7 = db.session.query(Ward).filter_by(name="Ward 7 (Bandra)").first()

    now = datetime.utcnow()

    complaints_data = [
        {
            "title": "Severe Pothole on main airport road",
            "description": "A very deep pothole has formed near the airport entry gate, causing severe traffic issues and damage to cars.",
            "category": "road",
            "latitude": 19.0898,
            "longitude": 72.8658,
            "priority": ComplaintPriority.HIGH,
            "status": ComplaintStatus.RESOLVED,
            "created_at": now - timedelta(days=15),
            "updated_at": now - timedelta(days=13),
            "department": road_dept,
            "ward": ward_1,
            "zone": ward_1.zone if ward_1 else None,
            "officer": john,
            "tracking_id": "CMP-MUM-2026-100001",
            "rating": 5,
            "feedback": "Pothole was completely filled and road leveled. Very prompt work by the team!",
            "satisfaction_status": "satisfied",
            "proof_remarks": "Pothole filled with concrete mix and steamrolled.",
            "proof_uploaded_at": now - timedelta(days=13),
        },
        {
            "title": "Broken street pavement blocks",
            "description": "Several pavement tiles are completely shattered near terminal 2 pathway, making it hazardous for pedestrians.",
            "category": "road",
            "latitude": 19.0880,
            "longitude": 72.8670,
            "priority": ComplaintPriority.MEDIUM,
            "status": ComplaintStatus.IN_PROGRESS,
            "created_at": now - timedelta(days=3),
            "updated_at": now - timedelta(days=1),
            "department": road_dept,
            "ward": ward_1,
            "zone": ward_1.zone if ward_1 else None,
            "officer": john,
            "tracking_id": "CMP-MUM-2026-100002",
        },
        {
            "title": "Major pipe leakage near Marine Drive",
            "description": "Drinking water is spraying out from the underground main valve on Marine Drive path, wasting thousands of liters.",
            "category": "water",
            "latitude": 18.9440,
            "longitude": 72.8240,
            "priority": ComplaintPriority.URGENT,
            "status": ComplaintStatus.CLOSED,
            "created_at": now - timedelta(days=12),
            "updated_at": now - timedelta(days=11),
            "department": water_dept,
            "ward": ward_3,
            "zone": ward_3.zone if ward_3 else None,
            "officer": sarah,
            "tracking_id": "CMP-MUM-2026-200001",
            "rating": 4,
            "feedback": "Valve replaced. Leakage completely stopped.",
            "satisfaction_status": "satisfied",
            "proof_remarks": "Replaced faulty gasket and tightened valve flange.",
            "proof_uploaded_at": now - timedelta(days=11),
        },
        {
            "title": "Low water pressure in building pipeline",
            "description": "The water supply pressure has dropped significantly over the last few days in Colaba Sector 3 blocks.",
            "category": "water",
            "latitude": 18.9070,
            "longitude": 72.8150,
            "priority": ComplaintPriority.LOW,
            "status": ComplaintStatus.SUBMITTED,
            "created_at": now - timedelta(days=1),
            "updated_at": now - timedelta(days=1),
            "department": water_dept,
            "ward": ward_3,
            "zone": ward_3.zone if ward_3 else None,
            "officer": None,
            "tracking_id": "CMP-MUM-2026-200002",
        },
        {
            "title": "Streetlights blinking repeatedly in Chembur",
            "description": "Entire row of streetlights on Lane 4 blink constantly, creating visibility hazards at night.",
            "category": "electricity",
            "latitude": 19.0625,
            "longitude": 72.8978,
            "priority": ComplaintPriority.MEDIUM,
            "status": ComplaintStatus.IN_PROGRESS,
            "created_at": now - timedelta(days=5),
            "updated_at": now - timedelta(days=4),
            "department": elec_dept,
            "ward": ward_5,
            "zone": ward_5.zone if ward_5 else None,
            "officer": mike,
            "tracking_id": "CMP-MUM-2026-300001",
        },
        {
            "title": "Hanging live wires on post",
            "description": "A cut electrical cable is hanging low near Chembur junction, close to public walking path.",
            "category": "electricity",
            "latitude": 19.0630,
            "longitude": 72.8980,
            "priority": ComplaintPriority.URGENT,
            "status": ComplaintStatus.RESOLVED,
            "created_at": now - timedelta(days=8),
            "updated_at": now - timedelta(days=7),
            "department": elec_dept,
            "ward": ward_5,
            "zone": ward_5.zone if ward_5 else None,
            "officer": mike,
            "tracking_id": "CMP-MUM-2026-300002",
            "rating": 5,
            "feedback": "Fixed within hours, very quick response to critical issue.",
            "satisfaction_status": "satisfied",
            "proof_remarks": "Disconnected dead cable and taped hanging ends securely.",
            "proof_uploaded_at": now - timedelta(days=7),
        },
        {
            "title": "Overflowing public garbage bin",
            "description": "The garbage container near Bandra bus stand is overflowing, spilling trash and attracting stray animals.",
            "category": "sanitation",
            "latitude": 19.0600,
            "longitude": 72.8300,
            "priority": ComplaintPriority.HIGH,
            "status": ComplaintStatus.SUBMITTED,
            "created_at": now - timedelta(days=2),
            "updated_at": now - timedelta(days=2),
            "department": sani_dept,
            "ward": ward_7,
            "zone": ward_7.zone if ward_7 else None,
            "officer": None,
            "tracking_id": "CMP-MUM-2026-400001",
        },
        {
            "title": "Blocked drainage line on link road",
            "description": "Drainage water is overflowing onto Link Road due to blockages in storm drains.",
            "category": "sanitation",
            "latitude": 19.0590,
            "longitude": 72.8290,
            "priority": ComplaintPriority.HIGH,
            "status": ComplaintStatus.RESOLVED,
            "created_at": now - timedelta(days=6),
            "updated_at": now - timedelta(days=5),
            "department": sani_dept,
            "ward": ward_7,
            "zone": ward_7.zone if ward_7 else None,
            "officer": clara,
            "tracking_id": "CMP-MUM-2026-400002",
            "rating": 3,
            "feedback": "Drain cleared but took almost 2 days to solve.",
            "satisfaction_status": "neutral",
            "proof_remarks": "Removed plastic and silt blockages using suction machine.",
            "proof_uploaded_at": now - timedelta(days=5),
        }
    ]

    for c in complaints_data:
        comp = Complaint(
            title=c["title"],
            description=c["description"],
            category=c["category"],
            latitude=c["latitude"],
            longitude=c["longitude"],
            priority=c["priority"],
            status=c["status"],
            created_at=c["created_at"],
            updated_at=c["updated_at"],
            user_id=citizen.id,
            department_id=c["department"].id if c["department"] else None,
            ward_id=c["ward"].id if c["ward"] else None,
            zone_id=c["zone"].id if c["zone"] else None,
            officer_id=c["officer"].id if c["officer"] else None,
            tracking_id=c["tracking_id"],
            rating=c.get("rating"),
            feedback=c.get("feedback"),
            satisfaction_status=c.get("satisfaction_status"),
            proof_remarks=c.get("proof_remarks"),
            proof_uploaded_at=c.get("proof_uploaded_at"),
            proof_uploaded_by_id=c["officer"].id if c.get("proof_uploaded_at") and c["officer"] else None,
        )
        db.session.add(comp)
    
    db.session.commit()

