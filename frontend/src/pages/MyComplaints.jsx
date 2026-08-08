import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";

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

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("/complaints"),
      apiRequest("/announcements").catch(() => ({ announcements: [] }))
    ])
      .then(([compsRes, annRes]) => {
        setComplaints(compsRes.complaints);
        setAnnouncements(annRes.announcements || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading complaints...</p>;

  if (complaints.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">You haven't filed any complaints yet.</p>
        <Link
          to="/report"
          className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-800"
        >
          Report Your First Issue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(100%, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">My Complaints</h1>
        <Link
          to="/report"
          className="px-4 py-2 bg-primary hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition shadow-sm"
        >
          + Report New Issue
        </Link>
      </div>

      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-3 flex items-center gap-3 overflow-hidden shadow-md text-white border border-blue-400">
          <span className="text-lg flex-shrink-0 animate-bounce">📢</span>
          <div className="flex-1 overflow-hidden relative h-5">
            <div className="animate-marquee whitespace-nowrap absolute flex gap-12">
              {announcements.map((ann) => (
                <span key={ann.id} className="text-sm font-extrabold">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-white mr-2 text-xs uppercase tracking-wide">
                    {ann.category} Alert
                  </span>
                  {ann.title}: {ann.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {complaints.map((c) => (
          <Link
            key={c.id}
            to={`/complaints/${c.id}`}
            className="block p-4 bg-white rounded shadow hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold">{c.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {c.description.substring(0, 100)}...
                </p>
                <div className="flex gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status]}`}
                  >
                    {c.status.replace("_", " ")}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${PRIORITY_COLORS[c.priority]}`}
                  >
                    {c.priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {c.category.replace("_", " ")}
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            {c.image_url && (
              <div className="mt-3">
                <img
                  src={c.image_url}
                  alt="complaint"
                  className="h-24 w-24 object-cover rounded"
                />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
