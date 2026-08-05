import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

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

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    apiRequest(`/complaints/${id}`)
      .then((res) => {
        setComplaint(res.complaint);
        setLogs(res.logs || []);
        setNewStatus(res.complaint.status);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await apiRequest(`/complaints/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus, remarks }),
      });
      setComplaint(res.complaint);
      setLogs(res.logs || []);
      setNewStatus("");
      setRemarks("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading complaint...</p>;
  if (error && !complaint) return <p className="text-red-600">{error}</p>;
  if (!complaint) return <p className="text-gray-500">Complaint not found</p>;

  const isOfficer = user?.role === "officer" || user?.role === "admin";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/my-complaints" className="text-sm text-gray-500 hover:underline">
        ← Back to My Complaints
      </Link>

      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">{complaint.title}</h1>
        <span
          className={`text-sm px-3 py-1 rounded ${STATUS_COLORS[complaint.status]}`}
        >
          {complaint.status.replace("_", " ").toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Description</label>
            <p className="mt-1">{complaint.description}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Category</label>
            <p className="mt-1 capitalize">{complaint.category.replace("_", " ")}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Location</label>
            <p className="mt-1">{complaint.latitude}, {complaint.longitude}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Filed on</label>
            <p className="mt-1">{new Date(complaint.created_at).toLocaleString()}</p>
          </div>
          {complaint.image_url && (
            <div>
              <label className="text-sm text-gray-500">Photo</label>
              <img src={complaint.image_url} alt="Complaint" className="mt-2 max-w-full h-auto rounded border" />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-2 block">Location on map</label>
          <div className="h-64 w-full rounded border">
            <MapContainer center={[complaint.latitude, complaint.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Marker position={[complaint.latitude, complaint.longitude]} />
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Status Update Form (officers/admins only) */}
      {isOfficer && (
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Update Status</h2>
          {error && <p className="text-red-600 mb-2">{error}</p>}
          <form onSubmit={handleStatusUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Reason for change..."
              />
            </div>
            <button
              type="submit"
              disabled={updating}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {updating ? "Updating..." : "Update"}
            </button>
          </form>
        </div>
      )}

      {/* Timeline */}
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Status Timeline</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No status changes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="flex-shrink-0 w-20 text-gray-500">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="flex-1">
                  <span className="font-medium">
                    {log.old_status ? `${log.old_status.replace("_", " ")} → ` : ""}
                    {log.new_status.replace("_", " ")}
                  </span>
                  {log.remarks && (
                    <p className="text-gray-600 mt-0.5">"{log.remarks}"</p>
                  )}
                </div>
                {log.officer_id && (
                  <span className="text-xs text-gray-400">by officer #{log.officer_id}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
