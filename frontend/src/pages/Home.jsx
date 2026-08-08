import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    apiRequest("/health")
      .then((data) => setHealth(data))
      .catch((err) => setHealth({ status: "error", message: err.message }))
      .finally(() => setLoadingHealth(false));
  }, []);

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-blue-900 via-indigo-950 to-slate-900 text-white py-20 px-8 md:px-16 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.2),transparent_50%)]"></div>
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            <span>✨ AI-Powered Civic Platform</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Empower Your Community with <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">CivicPulse</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 font-light max-w-2xl leading-relaxed">
            Report local issues like potholes, broken streetlights, or waste dumps in seconds. Track real-time progress as municipal officers verify and resolve your requests.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            {isAuthenticated ? (
              user?.role === "citizen" ? (
                <Link
                  to="/report"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Report an Issue</span>
                </Link>
              ) : (
                <Link
                  to={user?.role === "admin" ? "/admin-dashboard" : "/officer-dashboard"}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-8 py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                  Go to Dashboard
                </Link>
              )
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-blue-500 hover:bg-blue-650 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                >
                  Get Started
                </Link>
                <Link
                  to="/login"
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
                >
                  Citizen & Staff Login
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-extrabold text-slate-800">
            Intelligent Infrastructure & Routing
          </h2>
          <p className="text-slate-500">
            CivicPulse bridges the gap between citizens and local government with AI automation and complete operational transparency.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl">
              📍
            </div>
            <h3 className="text-xl font-bold text-slate-800">Precise Location Reports</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Pinpoint the exact location of civic issues on an interactive map. Upload photo evidence to help field agents act fast.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-xl">
              🤖
            </div>
            <h3 className="text-xl font-bold text-slate-800">AI Priority & Duplicates</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Our automated system detects similar reports to prevent duplicates, while smart ML models calculate severity and priority.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xl">
              ⚡
            </div>
            <h3 className="text-xl font-bold text-slate-800">Automated Dispatch</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Complaints are categorized and dispatched directly to the responsible municipal department and local officers instantly.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works (Timeline) */}
      <section className="bg-slate-50 rounded-3xl p-8 md:p-16 space-y-12">
        <div className="text-center max-w-xl mx-auto space-y-3">
          <h2 className="text-3xl font-extrabold text-slate-800">How CivicPulse Works</h2>
          <p className="text-slate-500">A structured workflow ensures every issue receives immediate attention.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 relative">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex w-10 h-10 bg-blue-600 text-white rounded-full items-center justify-center font-bold mb-2">1</div>
            <h4 className="font-bold text-lg text-slate-800">Report Issue</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Citizen submits details, chooses a category, pins the map, and uploads an optional photo.</p>
          </div>

          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex w-10 h-10 bg-blue-600 text-white rounded-full items-center justify-center font-bold mb-2">2</div>
            <h4 className="font-bold text-lg text-slate-800">AI Dispatch</h4>
            <p className="text-xs text-slate-500 leading-relaxed">The system tags priority, weeds out duplicate complaints, and flags the corresponding department.</p>
          </div>

          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex w-10 h-10 bg-blue-600 text-white rounded-full items-center justify-center font-bold mb-2">3</div>
            <h4 className="font-bold text-lg text-slate-800">Officer Resolves</h4>
            <p className="text-xs text-slate-500 leading-relaxed">Assigned officers review, mark progress, fix the problem on-site, and upload proof of resolution.</p>
          </div>

          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex w-10 h-10 bg-blue-600 text-white rounded-full items-center justify-center font-bold mb-2">4</div>
            <h4 className="font-bold text-lg text-slate-800">Close Ticket</h4>
            <p className="text-xs text-slate-500 leading-relaxed">The citizen gets instant notifications on status change, verifying and closing the issue.</p>
          </div>
        </div>
      </section>

      {/* Citizen Registration Card */}
      <section className="max-w-xl mx-auto w-full">
        <div className="border border-slate-100 rounded-3xl p-8 bg-white shadow-sm hover:shadow-md transition-all space-y-4 text-center">
          <div className="flex justify-center items-center">
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-755 rounded-full">Citizen Registration</span>
          </div>
          <h4 className="font-extrabold text-2xl text-slate-800">For Residents & Citizens</h4>
          <p className="text-sm text-slate-505 leading-relaxed max-w-md mx-auto">
            Create a secure Citizen Account to map local issues, check real-time progress, receive alerts, and verify resolutions.
          </p>
          <div className="pt-4">
            <Link to="/register" className="inline-flex justify-center items-center bg-primary hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-xl transition shadow-sm">
              <span>Create Citizen Account &rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Backend Connection Health Status Card */}
      <section className="bg-slate-100/50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-200/40">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${loadingHealth ? "bg-amber-400 animate-pulse" : health?.status === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
          <div>
            <h5 className="font-bold text-slate-800 text-sm">System Connection Status</h5>
            <p className="text-xs text-slate-500">
              {loadingHealth ? "Checking connection to API..." : health?.status === "ok" ? "Connected to backend API" : "Connection failed"}
            </p>
          </div>
        </div>
        {!loadingHealth && health?.status === "ok" && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg font-mono">
            {health?.message || "SCIRP backend is running"}
          </div>
        )}
      </section>
    </div>
  );
}
