import React, { useState, useEffect } from "react";
import { apiRequest } from "../services/api";
import { Link } from "react-router-dom";

const STATUS_LABELS = {
  submitted: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-100" },
  verified: { label: "Verified", color: "bg-purple-50 text-purple-700 border-purple-100" },
  assigned: { label: "Assigned", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700 border-amber-100" },
  resolved: { label: "Resolved", color: "bg-green-50 text-green-700 border-green-100" },
  closed: { label: "Closed", color: "bg-gray-50 text-gray-700 border-gray-100" },
};

const PRIORITY_LABELS = {
  low: "bg-green-50 text-green-700 border-green-100",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-100",
  high: "bg-orange-50 text-orange-700 border-orange-100",
  urgent: "bg-red-50 text-red-700 border-red-100",
};

export default function DeptHeadDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  const loadDashboardData = async () => {
    try {
      // department_complaints route in departments_bp handles role-based filtering automatically!
      const compsRes = await apiRequest("/department/complaints");
      setComplaints(compsRes.complaints);

      // Fetch officers to support manual assignment
      const usersRes = await apiRequest("/users");
      const activeOfficers = usersRes.users.filter(
        (u) => u.role === "officer" && u.is_active
      );
      setOfficers(activeOfficers);
    } catch (err) {
      console.error("Failed to load department dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleAssignOfficer = async (complaintId) => {
    if (!selectedOfficer) return;
    try {
      await apiRequest(`/complaints/${complaintId}`, {
        method: "PUT",
        body: JSON.stringify({ officer_id: parseInt(selectedOfficer) }),
      });
      alert("Officer assigned successfully!");
      setAssigningId(null);
      setSelectedOfficer("");
      loadDashboardData();
    } catch (err) {
      alert("Failed to assign officer: " + err.message);
    }
  };

  // Filter logic
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (escalatedOnly && c.escalation_level === 0) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-slate-400 font-bold">Loading department dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Department Head Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Review department issues, manage workloads, and route escalated complaints.</p>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_LABELS).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k].label}</option>
            ))}
          </select>

          <button
            onClick={() => setEscalatedOnly(!escalatedOnly)}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
              escalatedOnly
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800"
            }`}
          >
            ⚠️ {escalatedOnly ? "Showing Escalated Only" : "Show Escalated Only"}
          </button>
        </div>

        <div className="text-xs font-bold text-slate-400">
          Showing {filteredComplaints.length} tickets
        </div>
      </div>

      {/* Complaints Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredComplaints.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <span className="text-slate-400 font-bold text-sm block">No complaints match current filters.</span>
          </div>
        ) : (
          filteredComplaints.map((c) => (
            <div
              key={c.id}
              className={`p-5 rounded-2xl bg-white border shadow-sm transition hover:shadow-md flex flex-col md:flex-row justify-between gap-4 ${
                c.escalation_level > 0 ? "border-red-200 bg-red-50/10" : "border-slate-100"
              }`}
            >
              {/* Left Column: General Info */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.tracking_id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_LABELS[c.status]?.color}`}>
                    {STATUS_LABELS[c.status]?.label || c.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border capitalize ${PRIORITY_LABELS[c.priority]}`}>
                    {c.priority}
                  </span>
                  {c.escalation_level > 0 && (
                    <span className="bg-red-100 border border-red-200 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                      ⚠️ Escalated Lvl {c.escalation_level}
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-slate-800 text-base leading-snug">
                  {c.title}
                </h3>
                <p className="text-slate-500 font-medium text-xs line-clamp-2">
                  {c.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-bold text-slate-400 pt-2">
                  <div>
                    Ward: <span className="text-slate-700">{c.ward_name || "N/A"}</span>
                  </div>
                  <div>
                    Zone: <span className="text-slate-700">{c.zone_name || "N/A"}</span>
                  </div>
                  <div>
                    SLA Deadline:{" "}
                    <span className={`text-slate-700 ${new Date(c.sla_deadline) < new Date() && c.status !== "resolved" ? "text-red-600 font-extrabold" : ""}`}>
                      {c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : "None"}
                    </span>
                  </div>
                  <div>
                    Assignee: <span className="text-slate-700">{c.officer_name || "None"}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-col justify-between items-end gap-3 min-w-[200px] border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                <Link
                  to={`/complaints/${c.id}`}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Manage Details &rarr;
                </Link>

                {assigningId === c.id ? (
                  <div className="space-y-2 w-full">
                    <select
                      value={selectedOfficer}
                      onChange={(e) => setSelectedOfficer(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700"
                    >
                      <option value="">Select Officer</option>
                      {officers.map((off) => (
                        <option key={off.id} value={off.id}>
                          {off.name} ({off.department_name || "No Dept"})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAssignOfficer(c.id)}
                        className="flex-1 bg-primary hover:bg-blue-800 text-white text-xs font-bold py-1.5 rounded transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setAssigningId(null)}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAssigningId(c.id)}
                    className="px-4 py-2 bg-primary hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition shadow-sm w-full md:w-auto text-center"
                  >
                    Assign Officer
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
