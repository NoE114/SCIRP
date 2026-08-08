from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.ai import detect_duplicates, predict_priority

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/ai/detect-duplicates", methods=["POST"])
@jwt_required()
def check_duplicates():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    latitude = data.get("latitude")
    longitude = data.get("longitude")
    category = data.get("category", "other")
    description = data.get("description", "")
    title = data.get("title", "")

    if latitude is None or longitude is None:
        return jsonify({"msg": "latitude and longitude are required"}), 400

    duplicates = detect_duplicates(latitude, longitude, category, description, title)

    return jsonify({
        "is_duplicate": len(duplicates) > 0,
        "count": len(duplicates),
        "duplicates": duplicates,
    })


@ai_bp.route("/ai/predict-priority", methods=["POST"])
@jwt_required()
def predict_complaint_priority():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    category = data.get("category", "other")
    description = data.get("description", "")
    title = data.get("title", "")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    priority = predict_priority(category, description, title, latitude, longitude)

    return jsonify({
        "predicted_priority": priority.value,
        "confidence": "heuristic",
    })


@ai_bp.route("/ai/classify", methods=["POST"])
@jwt_required()
def classify_issue():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    title = data.get("title", "")
    description = data.get("description", "")

    if not title or not description:
        return jsonify({"msg": "title and description are required for AI analysis"}), 400

    from app.services.ai import classify_complaint_text
    suggestions = classify_complaint_text(title, description)

    return jsonify({"suggestions": suggestions})
