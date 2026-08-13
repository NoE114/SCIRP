import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle } from "react-leaflet";
import { apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons in React
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const PRIORITY_COLORS = {
  urgent: "#ef4444", // red
  high: "#f97316",   // orange
  medium: "#eab308", // yellow
  low: "#22c55e",    // green
};

const STATUS_LABELS = {
  submitted: "Submitted",
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function MapDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [wards, setWards] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [viewMode, setViewMode] = useState("markers"); // "markers" or "heatmap"

  useEffect(() => {
    const loadData = async () => {
      try {
        const compsRes = await apiRequest("/complaints");
        setComplaints(compsRes.complaints);
        
        const wardsRes = await apiRequest("/wards");
        setWards(wardsRes.wards);

        const deptsRes = await apiRequest("/departments");
        setDepartments(deptsRes.departments);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filtered complaints calculation
  const filteredComplaints = complaints.filter((c) => {
    if (selectedDept && c.department_id !== parseInt(selectedDept)) return false;
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (selectedStatus && c.status !== selectedStatus) return false;
    if (selectedPriority && c.priority !== selectedPriority) return false;
    if (selectedWard && c.ward_id !== parseInt(selectedWard)) return false;
    return true;
  });

  // Hotspot analysis: compute density circles based on nearby complaints
  const getHotspots = () => {
    const clusters = [];
    const radiusMeters = 150; // 150m radius density check

    filteredComplaints.forEach((c) => {
      // Find if we already have a cluster circle close to this complaint
      let found = false;
      for (let cluster of clusters) {
        const dist = L.latLng(c.latitude, c.longitude).distanceTo(L.latLng(cluster.lat, cluster.lng));
        if (dist < radiusMeters) {
          cluster.count += 1;
          cluster.lat = (cluster.lat * (cluster.count - 1) + c.latitude) / cluster.count;
          cluster.lng = (cluster.lng * (cluster.count - 1) + c.longitude) / cluster.count;
          found = true;
          break;
        }
      }
      if (!found) {
        clusters.push({ lat: c.latitude, lng: c.longitude, count: 1 });
      }
    });

    return clusters;
  };

  const hotspots = viewMode === "heatmap" ? getHotspots() : [];

  // Categories list extraction
  const categories = [...new Set(complaints.map((c) => c.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Civic Issues Map</h1>
          <p className="text-slate-600 text-sm">Geographical analytics and hotspot mapping of reported civic issues.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("markers")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              viewMode === "markers" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📍 Markers Map
          </button>
          <button
            onClick={() => setViewMode("heatmap")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              viewMode === "heatmap" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            🔥 Issue Heatmap
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Ward Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ward / Zone</label>
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700"
          >
            <option value="">All Wards</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 capitalize"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 capitalize"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-[550px] relative z-10">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-20">
            <span className="text-sm font-bold text-slate-400">Loading Map View...</span>
          </div>
        ) : (
          <MapContainer
            center={[19.076, 72.877]}
            zoom={12}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Render Markers Map */}
            {viewMode === "markers" &&
              filteredComplaints.map((c) => (
                <CircleMarker
                  key={c.id}
                  center={[c.latitude, c.longitude]}
                  radius={8}
                  fillColor={PRIORITY_COLORS[c.priority]}
                  color="#ffffff"
                  weight={1.5}
                  fillOpacity={0.85}
                >
                  <Popup>
                    <div className="p-1 max-w-[200px] text-slate-800">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">{c.category}</span>
                      <h4 className="font-bold text-sm leading-tight text-slate-800 mt-0.5">{c.title}</h4>
                      <div className="flex gap-1.5 mt-2">
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-600 capitalize">
                          {c.priority}
                        </span>
                        <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded font-semibold text-primary">
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <Link
                          to={`/complaints/${c.id}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          View Full Details &rarr;
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            {/* Render Heatmap Circles */}
            {viewMode === "heatmap" &&
              hotspots.map((h, idx) => (
                <Circle
                  key={idx}
                  center={[h.lat, h.lng]}
                  radius={180}
                  pathOptions={{
                    fillColor: "#ef4444",
                    fillOpacity: Math.min(0.2 + h.count * 0.15, 0.75),
                    color: "transparent",
                  }}
                />
              ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
