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
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  verified: "bg-purple-100 text-purple-800 border-purple-200",
  assigned: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
};

const PRIORITY_COLORS = {
  low: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [complaint, setComplaint] = useState(null);
  const [logs, setLogs] = useState([]);
  const [aiAssistance, setAiAssistance] = useState(null);
  const [clusterDetails, setClusterDetails] = useState(null);
  const [clusterSiblings, setClusterSiblings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  // Reopen State
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Feedback State
  const [rating, setRating] = useState(5);
  const [satisfaction, setSatisfaction] = useState("satisfied");
  const [feedbackText, setFeedbackText] = useState("");

  // Proof Upload State
  const [proofImage, setProofImage] = useState(null);
  const [proofRemarks, setProofRemarks] = useState("");
  const [officerGps, setOfficerGps] = useState([null, null]);

  const loadData = async () => {
    try {
      const res = await apiRequest(`/complaints/${id}`);
      setComplaint(res.complaint);
      setLogs(res.logs || []);
      setAiAssistance(res.ai_assistance);
      setClusterDetails(res.cluster_details);
      setClusterSiblings(res.cluster_siblings || []);

      // If officer, request uploader geolocation pre-emptively for resolution validation
      if (
        (user?.role === "officer" || user?.role === "dept_head" || user?.role === "admin") &&
        navigator.geolocation
      ) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setOfficerGps([pos.coords.latitude, pos.coords.longitude]),
          () => {}
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpvote = async () => {
    try {
      const res = await apiRequest(`/complaints/${id}/upvote`, { method: "POST" });
      setComplaint((prev) => ({ ...prev, upvotes: res.upvotes }));
      alert("Complaint upvoted / confirmed successfully!");
    } catch (err) {
      alert("Upvote failed: " + err.message);
    }
  };

  const handleConfirmResolution = async () => {
    try {
      const res = await apiRequest(`/complaints/${id}/confirm-resolution`, { method: "POST" });
      setComplaint(res.complaint);
      alert("Resolution confirmed! Grievance closed.");
      loadData();
    } catch (err) {
      alert("Confirmation failed: " + err.message);
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    try {
      const res = await apiRequest(`/complaints/${id}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason: reopenReason }),
      });
      setComplaint(res.complaint);
      setShowReopenForm(false);
      setReopenReason("");
      alert("Grievance has been reopened.");
      loadData();
    } catch (err) {
      alert("Reopen failed: " + err.message);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest(`/complaints/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          satisfaction_status: satisfaction,
          feedback: feedbackText,
        }),
      });
      setComplaint(res.complaint);
      alert("Thank you for your feedback!");
      loadData();
    } catch (err) {
      alert("Feedback submission failed: " + err.message);
    }
  };

  const handleProofUpload = async (e) => {
    e.preventDefault();
    if (!proofImage) {
      alert("Please select a resolution image.");
      return;
    }

    setUpdating(true);
    const formData = new FormData();
    formData.append("image", proofImage);
    formData.append("remarks", proofRemarks);
    if (officerGps[0] && officerGps[1]) {
      formData.append("latitude", officerGps[0]);
      formData.append("longitude", officerGps[1]);
    }

    try {
      await apiRequest(`/complaints/${id}/proof`, {
        method: "POST",
        body: formData,
      });
      alert("Resolution proof uploaded. Ticket status updated to Resolved.");
      setProofImage(null);
      setProofRemarks("");
      loadData();
    } catch (err) {
      alert("Failed to upload resolution proof: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-center py-12">Loading complaint details...</p>;
  if (error && !complaint) return <p className="text-red-600 text-center py-12">{error}</p>;
  if (!complaint) return <p className="text-gray-500 text-center py-12">Complaint not found.</p>;

  // Back Link calculation
  let backLink = "/my-complaints";
  if (user?.role === "officer") backLink = "/officer-dashboard";
  else if (user?.role === "dept_head") backLink = "/dept-head-dashboard";
  else if (user?.role === "admin") backLink = "/admin-dashboard";

  const isCitizen = user?.role === "citizen";
  const isStaff = user?.role === "officer" || user?.role === "dept_head" || user?.role === "admin";
  const isOwner = complaint.user_id === user?.id;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4">
      {/* Back Link */}
      <Link to={backLink} className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-slate-600 transition">
        &larr; Back to Dashboard
      </Link>

      {/* Header Info */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{complaint.tracking_id}</span>
          <h1 className="text-2xl font-black text-slate-800 leading-tight mt-0.5">{complaint.title}</h1>
          <p className="text-slate-500 font-medium text-xs mt-1">
            Category: <span className="capitalize text-slate-700">{complaint.category}</span> &middot; Ward:{" "}
            <span className="text-slate-700">{complaint.ward_name || "Unmapped"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase border ${STATUS_COLORS[complaint.status]}`}>
            {complaint.status.replace("_", " ")}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase border ${PRIORITY_COLORS[complaint.priority]}`}>
            {complaint.priority}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Description</h3>
              <p className="text-slate-700 font-medium leading-relaxed">{complaint.description}</p>
            </div>

            {/* Geotagging & SLA Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-400 border-t border-slate-50 pt-4">
              <div>
                Location Centroid:
                <span className="block text-slate-700 font-extrabold mt-0.5">
                  {complaint.latitude.toFixed(5)}, {complaint.longitude.toFixed(5)}
                </span>
              </div>
              <div>
                SLA Deadline Target:
                <span className="block text-slate-700 font-extrabold mt-0.5">
                  {complaint.sla_deadline ? new Date(complaint.sla_deadline).toLocaleString() : "TBD"}
                </span>
              </div>
            </div>

            {/* Citizens Confirmations / Support Panel */}
            {isCitizen && !isOwner && (
              <div className="border-t border-slate-50 pt-4 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-500">
                  ⚡ Supported by <span className="text-slate-800 font-black">{complaint.upvotes || 0} citizens</span>
                </div>
                <button
                  onClick={handleUpvote}
                  className="px-4 py-2 bg-primary hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-sm"
                >
                  Verify / Upvote Grievance
                </button>
              </div>
            )}
          </div>

          {/* BEFORE / AFTER evidence side by side */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-1.5">
              🖼️ Visual Resolution Proof
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[220px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Before (Reported Image)</span>
                {complaint.image_url ? (
                  <img src={complaint.image_url} alt="Before" className="rounded-xl max-h-[180px] object-contain shadow-sm" />
                ) : (
                  <span className="text-xs text-slate-400 italic">No image provided when reported.</span>
                )}
              </div>

              {/* After */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[220px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">After (Resolution Proof)</span>
                {complaint.proof_image_url ? (
                  <div className="w-full flex flex-col items-center">
                    <img src={complaint.proof_image_url} alt="After" className="rounded-xl max-h-[180px] object-contain shadow-sm mb-2" />
                    <div className="text-[9px] font-extrabold text-slate-400 text-center space-y-0.5">
                      <div>Resolved by: {complaint.proof_uploaded_by_name || "Staff"}</div>
                      {complaint.proof_remarks && <div>"{complaint.proof_remarks}"</div>}
                      {complaint.proof_latitude && (
                        <div className="text-green-600">
                          Verified GPS: {complaint.proof_latitude.toFixed(4)}, {complaint.proof_longitude.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Waiting for staff upload.</span>
                )}
              </div>
            </div>
          </div>

          {/* Citizen Actions (Reopen / Confirm) */}
          {isCitizen && isOwner && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Resolve Status Control</h3>
              
              {complaint.status === "resolved" && (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleConfirmResolution}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl transition text-xs shadow-sm"
                  >
                    Confirm Resolution & Close Ticket
                  </button>
                  <button
                    onClick={() => setShowReopenForm(!showReopenForm)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-xl border border-red-200 transition text-xs"
                  >
                    Reopen Grievance
                  </button>
                </div>
              )}

              {complaint.status === "closed" && (
                <button
                  onClick={() => setShowReopenForm(!showReopenForm)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-xl border border-red-200 transition text-xs"
                >
                  Reopen Ticket
                </button>
              )}

              {showReopenForm && (
                <form onSubmit={handleReopen} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-3 space-y-3">
                  <label className="block text-xs font-bold text-slate-500">Provide reason for reopening:</label>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    rows="3"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                  >
                    Confirm Reopen
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Citizen Feedback Form */}
          {isCitizen && isOwner && complaint.status === "closed" && complaint.rating === null && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Rate Grievance Resolution Feedback</h3>
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Satisfied?</label>
                    <select
                      value={satisfaction}
                      onChange={(e) => setSatisfaction(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold"
                    >
                      <option value="satisfied">Satisfied</option>
                      <option value="unsatisfied">Unsatisfied</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Star Rating</label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold"
                    >
                      {[5, 4, 3, 2, 1].map((val) => (
                        <option key={val} value={val}>{val} Stars</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Comments</label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Tell us what you think about the response time or fix quality..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                    rows="3"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-sm"
                >
                  Submit Feedback
                </button>
              </form>
            </div>
          )}

          {/* Feedback Display if exists */}
          {complaint.rating !== null && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-2">
              <h3 className="text-sm font-bold text-slate-800">Citizen Satisfaction Rating</h3>
              <div className="flex gap-2 text-xs font-bold">
                <span className="bg-blue-50 text-primary px-2.5 py-0.5 rounded border border-blue-100 uppercase">
                  {complaint.satisfaction_status}
                </span>
                <span className="bg-yellow-50 text-yellow-700 px-2.5 py-0.5 rounded border border-yellow-100">
                  ⭐ {complaint.rating} Stars
                </span>
              </div>
              {complaint.feedback && (
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2 font-medium">
                  "{complaint.feedback}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Map, Sibling Clusters, AI Panel */}
        <div className="space-y-6">
          {/* Map Viewer */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Geographical Placement</h3>
            <div className="h-48 w-full rounded-2xl overflow-hidden relative z-10 border border-slate-100">
              <MapContainer center={[complaint.latitude, complaint.longitude]} zoom={14} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[complaint.latitude, complaint.longitude]} />
              </MapContainer>
            </div>
          </div>

          {/* Sibling Duplicate Clusters */}
          {clusterDetails && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                🔗 Duplicate Complaint Cluster
              </h3>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 space-y-1">
                <div className="font-bold">{clusterDetails.name}</div>
                <div className="font-semibold text-slate-500">Category: {clusterDetails.category}</div>
              </div>

              {clusterSiblings.length > 0 && (
                <div className="space-y-2 mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Sibling Tickets:</span>
                  <div className="space-y-1.5">
                    {clusterSiblings.map((sib) => (
                      <Link
                        key={sib.id}
                        to={`/complaints/${sib.id}`}
                        className="block bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg p-2 transition"
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-primary">{sib.tracking_id}</span>
                          <span className="text-slate-400 uppercase">{sib.status}</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-700 mt-0.5 truncate">{sib.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Officer/Staff Resolution Proof Upload Form */}
          {isStaff && (complaint.status === "assigned" || complaint.status === "in_progress") && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                🛠️ Upload Resolution Proof
              </h3>
              <form onSubmit={handleProofUpload} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Evidence Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofImage(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:font-extrabold cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                  <textarea
                    value={proofRemarks}
                    onChange={(e) => setProofRemarks(e.target.value)}
                    placeholder="Provide details on resolution actions taken..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:outline-none"
                    rows="3"
                    required
                  />
                </div>

                {officerGps[0] && officerGps[1] && (
                  <div className="text-[10px] font-bold text-green-600 bg-green-50 p-2 rounded-lg border border-green-100">
                    📍 Verified Resolution GPS coordinates captured.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-2 rounded-lg text-xs transition shadow-sm"
                >
                  {updating ? "Uploading Proof..." : "Submit Proof & Resolve Ticket"}
                </button>
              </form>
            </div>
          )}

          {/* AI Assistance Panel for Staff */}
          {isStaff && aiAssistance && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                🤖 AI Copilot Coping Engine
              </h3>
              
              <div className="space-y-3 text-xs text-indigo-950 font-medium">
                <div>
                  <span className="block text-[10px] font-extrabold text-indigo-500 uppercase">Analysis Summary</span>
                  <p className="mt-0.5 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-indigo-50/50">
                    {aiAssistance.summary}
                  </p>
                </div>

                <div>
                  <span className="block text-[10px] font-extrabold text-indigo-500 uppercase">Identified Main Issue</span>
                  <p className="mt-0.5 font-bold">{aiAssistance.main_issue}</p>
                </div>

                <div>
                  <span className="block text-[10px] font-extrabold text-indigo-500 uppercase">Recommended Actions</span>
                  <p className="mt-0.5 leading-relaxed">{aiAssistance.suggested_action}</p>
                </div>

                <div>
                  <span className="block text-[10px] font-extrabold text-indigo-500 uppercase mb-1">Extracted Keyword Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {aiAssistance.keywords.map((kw, i) => (
                      <span key={i} className="bg-indigo-200/60 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-800 capitalize">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Redressal Status Log</h3>
            <div className="space-y-3.5">
              {logs.map((log) => (
                <div key={log.id} className="text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-700 capitalize">
                      {log.old_status ? `${log.old_status.replace("_", " ")} → ` : ""}
                      {log.new_status.replace("_", " ")}
                    </span>
                    <span className="text-slate-400">
                      {new Date(log.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {log.remarks && <p className="text-slate-500 mt-0.5 italic">"{log.remarks}"</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
