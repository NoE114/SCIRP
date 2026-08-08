import React, { useState } from "react";
import { apiRequest } from "../services/api";

const STATUS_LABELS = {
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800" },
  verified: { label: "Verified", color: "bg-purple-100 text-purple-800" },
  assigned: { label: "Assigned", color: "bg-indigo-100 text-indigo-800" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-800" },
};

const PRIORITY_LABELS = {
  low: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

export default function PublicTracking() {
  const [trackingId, setTrackingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await apiRequest(`/complaints/public/track/${trackingId.trim().toUpperCase()}`);
      setResult(data);
    } catch (err) {
      setError("No complaint found with this tracking ID. Please verify spelling.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Public Complaint Tracker</h1>
        <p className="mt-2 text-slate-600">Track the resolution progress of public civic grievances anonymously.</p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Enter Tracking ID (e.g. CMP-MUM-2026-000001)"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white uppercase font-semibold text-slate-700 placeholder-slate-400 transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-primary hover:bg-blue-800 text-white font-bold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Searching..." : "Track Status"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600 font-semibold">{error}</p>}
      </div>

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tracking ID</span>
                <h2 className="text-xl font-black text-slate-800">{result.complaint.tracking_id}</h2>
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_LABELS[result.complaint.status]?.color}`}>
                  {STATUS_LABELS[result.complaint.status]?.label || result.complaint.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border ${PRIORITY_LABELS[result.complaint.priority]}`}>
                  {result.complaint.priority} Priority
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div>
                <span className="block text-xs text-slate-400 font-bold uppercase">Category</span>
                <span className="font-semibold text-slate-800 capitalize">{result.complaint.category}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-bold uppercase">Department</span>
                <span className="font-semibold text-slate-800">{result.complaint.department_name || "Unassigned"}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-bold uppercase">Date Filed</span>
                <span className="font-semibold text-slate-800">
                  {new Date(result.complaint.created_at).toLocaleDateString(undefined, {
                    dateStyle: "medium"
                  })}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="block text-xs text-slate-400 font-bold uppercase mb-1">Issue Description</span>
              <p className="text-slate-700 font-medium">{result.complaint.title}</p>
            </div>
          </div>

          {/* Timeline Tracking */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Redressal Timeline</h3>
            <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
              {result.logs.map((log, idx) => (
                <div key={log.id} className="relative">
                  {/* Timeline Dot */}
                  <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 bg-white border-2 border-primary rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                  </span>
                  
                  {/* Log Card */}
                  <div>
                    <span className="text-xs text-slate-400 font-semibold">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </span>
                    <h4 className="font-bold text-slate-800 mt-0.5">
                      Status changed to <span className="capitalize text-primary">{STATUS_LABELS[log.new_status]?.label || log.new_status}</span>
                    </h4>
                    {log.remarks && (
                      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 mt-2 font-medium">
                        {log.remarks}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
