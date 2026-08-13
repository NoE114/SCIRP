import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const DEMO_ACCOUNTS_ENABLED = import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === "true";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    new URLSearchParams(location.search).get("redirect") ||
    location.state?.from?.pathname ||
    "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleQuickLogin = async (demoEmail, demoPassword) => {
    try {
      setError("");
      setEmail(demoEmail);
      setPassword(demoPassword);
      await login(demoEmail, demoPassword);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const successMessage = location.state?.message;

  return (
    <div className="max-w-md mx-auto py-6 space-y-6">
      <div className="bg-white p-8 border border-slate-100 rounded-2xl shadow-sm space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-800 text-center">Sign In</h1>
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-xl text-sm mb-4">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-500/10 transition duration-150"
          >
            Log In
          </button>
        </form>
        <p className="text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Register
          </Link>
        </p>
      </div>

      {/* Demo Accounts Panel — only rendered when the build enables it */}
      {DEMO_ACCOUNTS_ENABLED && (
        <div className="p-6 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Demo Accounts Portal</h3>
          <p className="text-[11px] text-slate-400">Click a portal below to sign in instantly with a pre-configured role</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleQuickLogin("ashish@civicpulse.com", "citizenpass123")}
            className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:ring-2 hover:ring-blue-50 hover:shadow-sm transition text-center"
          >
            <span className="text-xs font-bold text-slate-800">Citizen</span>
            <span className="text-[10px] text-slate-400 mt-0.5">ashish@civicpulse.com</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("john@civicpulse.com", "officerpass123")}
            className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:ring-2 hover:ring-blue-50 hover:shadow-sm transition text-center"
          >
            <span className="text-xs font-bold text-slate-800">Officer (Roads)</span>
            <span className="text-[10px] text-slate-400 mt-0.5">john@civicpulse.com</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("sarah@civicpulse.com", "officerpass123")}
            className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:ring-2 hover:ring-blue-50 hover:shadow-sm transition text-center"
          >
            <span className="text-xs font-bold text-slate-800">Officer (Water)</span>
            <span className="text-[10px] text-slate-400 mt-0.5">sarah@civicpulse.com</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("depthead@civicpulse.com", "deptpass123")}
            className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:ring-2 hover:ring-blue-50 hover:shadow-sm transition text-center"
          >
            <span className="text-xs font-bold text-slate-800">Dept Head (Roads)</span>
            <span className="text-[10px] text-slate-400 mt-0.5">depthead@civicpulse.com</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("admin@civicpulse.com", "adminpass123")}
            className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:ring-2 hover:ring-blue-50 hover:shadow-sm transition text-center col-span-2"
          >
            <span className="text-xs font-bold text-slate-850">System Admin</span>
            <span className="text-[10px] text-slate-400 mt-0.5">admin@civicpulse.com</span>
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
