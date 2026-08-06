import React from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import HealthCheck from "./pages/HealthCheck";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ReportIssue from "./pages/ReportIssue";
import MyComplaints from "./pages/MyComplaints";
import ComplaintDetail from "./pages/ComplaintDetail";
import OfficerDashboard from "./pages/OfficerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import Unauthorized from "./pages/Unauthorized";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotificationBell from "./components/NotificationBell";

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
               {user?.role === "citizen" && (
                <>
                  <NavLink to="/report" className="text-sm text-gray-600 hover:text-primary">
                    Report Issue
                  </NavLink>
                  <NavLink to="/my-complaints" className="text-sm text-gray-600 hover:text-primary">
                    My Complaints
                  </NavLink>
                </>
              )}
               {user?.role === "officer" ? (
                 <NavLink to="/officer-dashboard" className="text-sm text-gray-600 hover:text-primary">
                   Officer Dashboard
                 </NavLink>
               ) : null}
               {user?.role === "admin" ? (
                 <NavLink to="/admin-dashboard" className="text-sm text-gray-600 hover:text-primary">
                   Admin Dashboard
                 </NavLink>
               ) : null}
               {user?.role === "admin" ? (
                 <NavLink to="/analytics" className="text-sm text-gray-600 hover:text-primary">
                   Analytics
                 </NavLink>
               ) : null}
               <span className="text-sm text-gray-600">
                 {user?.name} ({user?.role})
               </span>
               <NotificationBell />
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
          <Route
            path="/officer-dashboard"
            element={
              <ProtectedRoute allowedRoles={["officer", "admin"]}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute allowedRoles={["citizen"]}>
                <ReportIssue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-complaints"
            element={
              <ProtectedRoute allowedRoles={["citizen"]}>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute>
                <ComplaintDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
