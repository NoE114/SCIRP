import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const STATUS_GROUPS = {
  pending: ["submitted", "verified"],
  in_progress: ["assigned", "in_progress"],
  completed: ["resolved", "closed"],
};

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-800",
  verified: "bg-purple-100 text-purple-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export default function OfficerDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/department/complaints")
      .then((res) => setComplaints(res.complaints))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const urgentComplaints = complaints.filter((c) => c.priority === "urgent");
  const groupedComplaints = complaints.filter((c) =>
    STATUS_GROUPS[activeTab]?.includes(c.status)
  );

  const tabs = [
    { id: "pending", label: "Pending" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
    { id: "urgent", label: "Urgent" },
  ];

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Officer Dashboard</h1>

      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "urgent" ? (
        <UrgentList complaints={urgentComplaints} />
      ) : (
        <ComplaintList complaints={groupedComplaints} status={activeTab} />
      )}
    </div>
  );
}

function ComplaintList({ complaints, status }) {
  if (complaints.length === 0) {
    return <p className="text-gray-500">No complaints in this category.</p>;
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => (
        <Link
          key={c.id}
          to={`/complaints/${c.id}`}
          className="block p-4 bg-white rounded shadow hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {c.description.substring(0, 80)}...
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status]}`}>
                {c.status.replace("_", " ")}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${PRIORITY_COLORS[c.priority]}`}>
                {c.priority}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {new Date(c.created_at).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  );
}

function UrgentList({ complaints }) {
  if (complaints.length === 0) {
    return <p className="text-gray-500">No urgent complaints.</p>;
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => (
        <Link
          key={c.id}
          to={`/complaints/${c.id}`}
          className="block p-4 bg-red-50 border border-red-200 rounded shadow hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-red-800">{c.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {c.description.substring(0, 80)}...
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              {c.priority.toUpperCase()}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${STATUS_COLORS[c.status]}`}>
            {c.status.replace("_", " ")}
          </span>
        </Link>
      ))}
    </div>
  );
}
