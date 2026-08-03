import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { apiRequest } from "../services/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-800",
  verified: "bg-purple-100 text-purple-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/complaints/${id}`)
      .then((res) => setComplaint(res.complaint))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading complaint...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!complaint) return <p className="text-gray-500">Complaint not found</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/my-complaints"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to My Complaints
      </Link>

      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">{complaint.title}</h1>
        <div className="flex gap-2">
          <span
            className={`text-sm px-3 py-1 rounded ${STATUS_COLORS[complaint.status]}`}
          >
            {complaint.status.replace("_", " ").toUpperCase()}
          </span>
          <span
            className={`text-sm px-3 py-1 rounded ${
              complaint.priority === "low"
                ? "bg-gray-100 text-gray-800"
                : complaint.priority === "medium"
                ? "bg-blue-100 text-blue-800"
                : complaint.priority === "high"
                ? "bg-orange-100 text-orange-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {complaint.priority.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Description</label>
            <p className="mt-1">{complaint.description}</p>
          </div>

          <div>
            <label className="text-sm text-gray-500">Category</label>
            <p className="mt-1 capitalize">
              {complaint.category.replace("_", " ")}
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-500">Location</label>
            <p className="mt-1">
              {complaint.latitude}, {complaint.longitude}
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-500">Filed on</label>
            <p className="mt-1">
              {new Date(complaint.created_at).toLocaleString()}
            </p>
          </div>

          {complaint.image_url && (
            <div>
              <label className="text-sm text-gray-500">Photo</label>
              <div className="mt-2">
                <img
                  src={complaint.image_url}
                  alt="Complaint"
                  className="max-w-full h-auto rounded border"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-2 block">Location on map</label>
          <div className="h-64 w-full rounded border">
            <MapContainer
              center={[complaint.latitude, complaint.longitude]}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Marker position={[complaint.latitude, complaint.longitude]} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
