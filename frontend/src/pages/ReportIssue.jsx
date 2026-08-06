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
  "pothole",
  "garbage",
  "streetlight",
  "water_leak",
  "sanitation",
  "other",
];

const PRIORITIES = ["low", "medium", "high", "urgent", "auto"];

export default function ReportIssue() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("pothole");
  const [priority, setPriority] = useState("medium");
  const [image, setImage] = useState(null);
  const [position, setPosition] = useState([40.7128, -74.006]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [predictedPriority, setPredictedPriority] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

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
    try {
      const [priorityRes, dupRes] = await Promise.all([
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
      ]);

      if (priorityRes) setPredictedPriority(priorityRes.predicted_priority);
      if (dupRes) setDuplicates(dupRes.duplicates);
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Report an Issue</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows="4"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
            {predictedPriority && priority === "auto" && (
              <p className="text-xs text-gray-500 mt-1">
                AI predicted: <span className="font-medium">{predictedPriority.toUpperCase()}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm"
            />
          </div>

          <button
            type="button"
            onClick={runAIAnalysis}
            disabled={analyzing || !title || !description}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {analyzing ? "Analyzing..." : "AI Analyze (Check for Duplicates)"}
          </button>

          {duplicates.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h4 className="font-medium text-yellow-800 mb-2">
                Potential Duplicates Found ({duplicates.length})
              </h4>
              <ul className="space-y-1 text-sm">
                {duplicates.map((dup) => (
                  <li key={dup.id} className="text-yellow-700">
                    #{dup.id} · {dup.distance_m}m away · {dup.created_at} · {" "}
                    <a
                      href={`/complaints/${dup.id}`}
                      className="underline hover:text-yellow-900"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-600 mt-2">
                Please review these before submitting.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white py-2 rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Complaint"}
          </button>
        </form>

        <div>
          <label className="block text-sm font-medium mb-2">
            Pin the location on the map (click to move marker)
          </label>
          <div className="h-80 w-full rounded border">
            <MapContainer
              center={position}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <LocationPicker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Latitude: {position[0].toFixed(6)}, Longitude: {position[1].toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}
