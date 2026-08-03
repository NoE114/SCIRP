import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="p-4 bg-white rounded shadow">
        <h2 className="font-semibold">User Profile</h2>
        <pre className="text-sm mt-2">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      <button
        onClick={logout}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        Logout
      </button>
    </div>
  );
}
