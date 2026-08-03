import React from "react";
import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold text-red-600 mb-4">
        403 — Unauthorized
      </h1>
      <p className="text-gray-600 mb-6">
        You do not have permission to access this page.
      </p>
      <Link
        to="/"
        className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-800"
      >
        Go Home
      </Link>
    </div>
  );
}
