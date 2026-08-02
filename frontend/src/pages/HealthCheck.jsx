import React, { useEffect, useState } from "react";
import { apiRequest } from "../services/api";

export default function HealthCheck() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/health")
      .then(setHealth)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Checking backend...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Frontend + Backend Connection</h1>
      <div className="p-4 bg-white rounded shadow">
        <p className="text-sm text-gray-600">Backend health:</p>
        <pre className="text-sm">{JSON.stringify(health, null, 2)}</pre>
      </div>
    </div>
  );
}
