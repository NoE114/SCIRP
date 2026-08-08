import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} />;
}

const CATEGORIES = [
  "Road",
  "Water",
  "Electricity",
  "Sanitation",
  "other",
];

const PRIORITIES = ["low", "medium", "high", "urgent", "auto"];

export default function ReportIssue() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Road");
  const [priority, setPriority] = useState("medium");
  const [image, setImage] = useState(null);
  const [position, setPosition] = useState([19.076, 72.877]); // Seeding closer to Mumbai coordinates
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [predictedPriority, setPredictedPriority] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { timeout: 3000, enableHighAccuracy: true }
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category", category);
    formData.append("latitude", position[0]);
    formData.append("longitude", position[1]);
    formData.append("priority", priority);
    if (image) formData.append("image", image);

    try {
      const res = await apiRequest("/complaints", { method: "POST", body: formData });
      if (res.duplicates_found > 0) {
        const confirmed = window.confirm(
          `Potential duplicate(s) found (${res.duplicates_found}). Submit anyway?`
        );
        if (!confirmed) {
          setSubmitting(false);
          return;
        }
      }
      window.location.href = "/my-complaints";
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runAIAnalysis = async () => {
    if (!title || !description) {
      alert("Please enter a title and description first");
      return;
    }
    setAnalyzing(true);
    setAiSuggestions(null);
    try {
      const [priorityRes, dupRes, classifyRes] = await Promise.all([
        apiRequest("/ai/predict-priority", {
          method: "POST",
          body: JSON.stringify({
            category, description, title,
            latitude: position[0], longitude: position[1],
          }),
        }).catch(() => null),
        apiRequest("/ai/detect-duplicates", {
          method: "POST",
          body: JSON.stringify({
            category, description, title,
            latitude: position[0], longitude: position[1],
          }),
        }).catch(() => null),
        apiRequest("/ai/classify", {
          method: "POST",
          body: JSON.stringify({ title, description }),
        }).catch(() => null),
      ]);

      if (priorityRes) setPredictedPriority(priorityRes.predicted_priority);
      if (dupRes) setDuplicates(dupRes.duplicates);
      if (classifyRes && classifyRes.suggestions) {
        setAiSuggestions(classifyRes.suggestions);
      }
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
  };

  const applySuggestions = () => {
    if (!aiSuggestions) return;
    if (CATEGORIES.includes(aiSuggestions.category)) {
      setCategory(aiSuggestions.category);
    } else {
      setCategory("other");
    }
    setPriority(aiSuggestions.priority);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Report a Civic Complaint</h1>
        <p className="text-slate-500 text-sm mt-1">Submit issues with location mapping and AI classification helpers.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 font-semibold text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Short Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Major Pothole on Linking Road"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Detailed Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, exact street landmarks, or safety risks..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              rows="4"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Priority Mode</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === "auto" ? "AI Auto Predict" : p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Upload Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-slate-100 file:text-slate-700 file:hover:bg-slate-200 cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={runAIAnalysis}
              disabled={analyzing || !title || !description}
              className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              ⚡ {analyzing ? "AI Analyzing..." : "AI Helper (Verify Duplicates & Categories)"}
            </button>

            {aiSuggestions && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                  🤖 AI Classification Suggestions
                </h4>
                <p className="text-xs text-indigo-700 font-medium">
                  We identified this as a <span className="font-bold uppercase text-indigo-900">{aiSuggestions.issue_type}</span>.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold mt-1.5">
                  <span className="bg-indigo-100/60 px-2 py-0.5 rounded text-indigo-800">
                    Category: {aiSuggestions.category}
                  </span>
                  <span className="bg-purple-100/60 px-2 py-0.5 rounded text-purple-800 capitalize">
                    Priority: {aiSuggestions.priority}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applySuggestions}
                  className="mt-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 px-3 rounded-lg transition"
                >
                  Apply AI Recommendations
                </button>
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="font-bold text-yellow-800 text-xs uppercase mb-2">
                  Potential Duplicates Nearby ({duplicates.length})
                </h4>
                <ul className="space-y-1.5 text-xs font-medium">
                  {duplicates.map((dup) => (
                    <li key={dup.id} className="text-yellow-700 flex justify-between items-center">
                      <span>#{dup.id} · {dup.distance_m}m away · {dup.created_at}</span>
                      <a
                        href={`/complaints/${dup.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold hover:text-yellow-900"
                      >
                        View
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Complaint"}
          </button>
        </form>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
            Pin Complaint Location (Click map to move pin)
          </label>
          <div className="h-[380px] w-full rounded-2xl border border-slate-100 overflow-hidden shadow-sm relative z-10">
            <MapContainer
              center={position}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <LocationPicker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
          <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between text-xs text-slate-500 font-semibold">
            <span>Latitude: {position[0].toFixed(6)}</span>
            <span>Longitude: {position[1].toFixed(6)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
