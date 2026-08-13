from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, case, extract

from app.extensions import db
from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_log import ComplaintLog
from app.models.department import Department
from app.models.user import User, UserRole

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics/dashboard", methods=["GET"])
@jwt_required()
def analytics_dashboard():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role not in (UserRole.ADMIN, UserRole.DEPT_HEAD):
        return jsonify({"msg": "Only admins and department heads can access analytics"}), 403

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

    if db.engine.name == "sqlite":
        resolution_time_expr = (
            func.strftime("%s", Complaint.updated_at)
            - func.strftime("%s", Complaint.created_at)
        ) / 3600.0
    else:
        resolution_time_expr = (
            db.func.unix_timestamp(Complaint.updated_at)
            - db.func.unix_timestamp(Complaint.created_at)
        ) / 3600.0

    # --- Department performance: pending count + avg resolution time ---
    dept_rows = (
        db.session.query(
            Department,
            func.count(
                case(
                    ((Complaint.status == "submitted") | (Complaint.status == "verified") | (Complaint.status == "assigned") | (Complaint.status == "in_progress"), Complaint.id),
                )
            ).label("pending"),
            func.avg(
                case(
                    (
                        (Complaint.status == ComplaintStatus.RESOLVED)
                        | (Complaint.status == ComplaintStatus.CLOSED),
                        resolution_time_expr,
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
        # Dept-specific satisfaction
        dept_feedback = db.session.query(
            func.avg(Complaint.rating).label("avg_rating"),
            func.count(Complaint.rating).label("count")
        ).filter(Complaint.department_id == dept.id).first()

        department_performance.append(
            {
                "department": dept.name,
                "pending": pending or 0,
                "avg_resolution_hours": round(avg_hours, 1) if avg_hours else None,
                "avg_rating": round(dept_feedback.avg_rating, 1) if dept_feedback and dept_feedback.avg_rating else None,
                "feedback_count": dept_feedback.count if dept_feedback else 0
            }
        )

    # --- 1. SLA Compliance Metrics ---
    resolved_count = Complaint.query.filter(Complaint.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED])).count()
    resolved_breached_count = Complaint.query.filter(
        Complaint.status.in_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
        Complaint.updated_at > Complaint.sla_deadline
    ).count()

    sla_compliance_rate = round(((resolved_count - resolved_breached_count) / resolved_count * 100), 1) if resolved_count else 100.0
    active_breached_count = Complaint.query.filter(
        Complaint.status.notin_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
        Complaint.sla_deadline < now
    ).count()

    # --- 2. Feedback & Ratings Summary ---
    feedback_rows = db.session.query(
        func.count(Complaint.rating).label("total"),
        func.avg(Complaint.rating).label("avg"),
        func.count(case((Complaint.satisfaction_status == "satisfied", Complaint.id))).label("satisfied"),
        func.count(case((Complaint.satisfaction_status == "unsatisfied", Complaint.id))).label("unsatisfied")
    ).first()

    total_ratings = feedback_rows.total if feedback_rows else 0
    avg_rating = round(feedback_rows.avg, 1) if feedback_rows and feedback_rows.avg else None
    satisfaction_rate = round((feedback_rows.satisfied / total_ratings * 100), 1) if total_ratings else 100.0

    # --- 3. Ward & Zone Distribution ---
    from app.models.ward import Ward
    from app.models.zone import Zone
    ward_distribution = []
    ward_rows = db.session.query(
        Ward.name,
        func.count(Complaint.id).label("count")
    ).outerjoin(Complaint, Ward.id == Complaint.ward_id).group_by(Ward.id).all()
    for name, count in ward_rows:
        ward_distribution.append({"ward": name, "count": count})

    # --- 4. Officer Workloads ---
    officers = User.query.filter_by(role=UserRole.OFFICER, is_active=True).all()
    officer_workloads = []
    for off in officers:
        workload = Complaint.query.filter(
            Complaint.officer_id == off.id,
            Complaint.status.in_([ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS])
        ).count()
        officer_workloads.append({
            "name": off.name,
            "department": off.department.name if off.department else "None",
            "active_tickets": workload
        })

    return jsonify(
        {
            "trends": trends,
            "categories": categories,
            "department_performance": department_performance,
            "sla_compliance_rate": sla_compliance_rate,
            "active_breached_count": active_breached_count,
            "total_feedback_count": total_ratings,
            "avg_rating": avg_rating,
            "satisfaction_rate": satisfaction_rate,
            "ward_distribution": ward_distribution,
            "officer_workloads": officer_workloads
        }
    )
