import React from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import HealthCheck from "./pages/HealthCheck";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Unauthorized from "./pages/Unauthorized";
import { ProtectedRoute } from "./components/ProtectedRoute";

function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-primary">
          SCIRP
        </Link>
        <div className="space-x-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600">
                Logged in as {user?.name} ({user?.role})
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="text-sm text-gray-600 hover:text-primary">
                Login
              </NavLink>
              <NavLink to="/register" className="text-sm text-gray-600 hover:text-primary">
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HealthCheck />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
