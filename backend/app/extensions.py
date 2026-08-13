from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask import jsonify

db = SQLAlchemy()
jwt = JWTManager()


@jwt.unauthorized_loader
def missing_token_callback(reason):
    return jsonify({"msg": "Missing authorization header"}), 401


@jwt.invalid_token_loader
def invalid_token_callback(reason):
    return jsonify({"msg": "Invalid or missing token"}), 401


@jwt.expired_token_loader
def expired_token_callback(header, payload):
    return jsonify({"msg": "Token has expired, please log in again"}), 401


@jwt.revoked_token_loader
def revoked_token_callback(header, payload):
    return jsonify({"msg": "Token has been revoked"}), 401