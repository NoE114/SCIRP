import React from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import HealthCheck from "./pages/HealthCheck";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="container mx-auto px-4 py-3">
          <Link to="/" className="text-xl font-bold text-primary">
            SCIRP
          </Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HealthCheck />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
