import React from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ReportIssue from "./pages/ReportIssue";
import MyComplaints from "./pages/MyComplaints";
import ComplaintDetail from "./pages/ComplaintDetail";
import OfficerDashboard from "./pages/OfficerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DeptHeadDashboard from "./pages/DeptHeadDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import MapDashboard from "./pages/MapDashboard";
import PublicTracking from "./pages/PublicTracking";
import Unauthorized from "./pages/Unauthorized";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotificationBell from "./components/NotificationBell";

function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-primary">
          CivicPulse
        </Link>
        <div className="space-x-4 flex items-center">
          <NavLink to="/track" className="text-sm text-gray-600 hover:text-primary">
            Track Grievance
          </NavLink>
          {isAuthenticated ? (
            <>
               <NavLink to="/map" className="text-sm text-gray-600 hover:text-primary">
                 Map View
               </NavLink>
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
               {user?.role === "officer" && (
                 <NavLink to="/officer-dashboard" className="text-sm text-gray-600 hover:text-primary">
                   Officer Dashboard
                 </NavLink>
               )}
               {user?.role === "dept_head" && (
                 <NavLink to="/dept-head-dashboard" className="text-sm text-gray-600 hover:text-primary">
                   Dept Head Dashboard
                 </NavLink>
               )}
               {user?.role === "admin" && (
                 <NavLink to="/admin-dashboard" className="text-sm text-gray-600 hover:text-primary">
                   Admin Dashboard
                 </NavLink>
               )}
               {(user?.role === "admin" || user?.role === "dept_head") && (
                 <NavLink to="/analytics" className="text-sm text-gray-600 hover:text-primary">
                   Analytics
                 </NavLink>
               )}
               <span className="text-sm text-gray-600 font-semibold bg-slate-50 px-2 py-1 rounded">
                 {user?.name} ({user?.role})
               </span>
               <NotificationBell />
               <button
                 onClick={logout}
                 className="text-sm text-red-600 hover:text-red-800 font-semibold"
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
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/track" element={<PublicTracking />} />
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
            path="/map"
            element={
              <ProtectedRoute>
                <MapDashboard />
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
            path="/dept-head-dashboard"
            element={
              <ProtectedRoute allowedRoles={["dept_head", "admin"]}>
                <DeptHeadDashboard />
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
              <ProtectedRoute allowedRoles={["admin", "dept_head"]}>
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
