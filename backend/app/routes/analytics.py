from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import func, case, extract

from app.extensions import db
from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_log import ComplaintLog
from app.models.department import Department

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics/dashboard", methods=["GET"])
@jwt_required()
def analytics_dashboard():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Only admins can access analytics"}), 403

    now = datetime.utcnow()

    # --- Complaint trends over the last 30 days (by date) ---
    start_date = (now - timedelta(days=29)).date()
    trend_rows = (
        db.session.query(
            func.date(Complaint.created_at).label("date"),
            func.count(Complaint.id).label("count"),
        )
        .filter(Complaint.created_at >= start_date)
        .group_by(func.date(Complaint.created_at))
        .order_by("date")
        .all()
    )

    # Build a complete 30-day range ending today (inclusive)
    date_map = {row.date: row.count for row in trend_rows}
    trends = []
    for i in range(30):
        d = start_date + timedelta(days=i)
        trends.append({"date": d.isoformat(), "count": date_map.get(d, 0)})

    # --- Top complaint categories ---
    cat_rows = (
        db.session.query(
            Complaint.category,
            func.count(Complaint.id).label("count"),
        )
        .filter(Complaint.created_at >= start_date)
        .group_by(Complaint.category)
        .order_by(func.count(Complaint.id).desc())
        .all()
    )
    categories = [{"category": row.category, "count": row.count} for row in cat_rows]

    # --- Department performance: pending count + avg resolution time ---
    dept_rows = (
        db.session.query(
            Department,
            func.count(
                case(
                    (Complaint.status.in_(["submitted", "verified", "assigned", "in_progress"]), Complaint.id),
                )
            ).label("pending"),
            func.avg(
                case(
                    (
                        (Complaint.status == ComplaintStatus.RESOLVED)
                        | (Complaint.status == ComplaintStatus.CLOSED),
                        (db.func.unix_timestamp(Complaint.updated_at) - db.func.unix_timestamp(Complaint.created_at)) / 3600.0,
                    ),
                )
            ).label("avg_hours"),
        )
        .outerjoin(Complaint, Department.id == Complaint.department_id)
        .group_by(Department.id)
        .all()
    )

    department_performance = []
    for dept, pending, avg_hours in dept_rows:
        department_performance.append(
            {
                "department": dept.name,
                "pending": pending or 0,
                "avg_resolution_hours": round(avg_hours, 1) if avg_hours else None,
            }
        )

    return jsonify(
        {
            "trends": trends,
            "categories": categories,
            "department_performance": department_performance,
        }
    )
