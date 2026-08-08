import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { apiRequest } from "../services/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/analytics/dashboard")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-slate-400 font-bold">Loading advanced analytics...</span>
      </div>
    );
  }
  if (!data) return <p className="text-red-500 text-center py-12">Failed to load analytics data.</p>;

  // Trend Chart (30 Days)
  const trendData = {
    labels: data.trends.map((t) => t.date),
    datasets: [
      {
        label: "Complaints Filed",
        data: data.trends.map((t) => t.count),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.05)",
        fill: true,
        tension: 0.35,
        borderWidth: 2,
      },
    ],
  };

  // Category Chart
  const categoryColors = ["#ef4444", "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];
  const categoryData = {
    labels: data.categories.map((c) => c.category),
    datasets: [
      {
        data: data.categories.map((c) => c.count),
        backgroundColor: categoryColors.slice(0, data.categories.length),
        borderWidth: 0,
      },
    ],
  };

  // Ward Distribution Chart
  const wardData = {
    labels: data.ward_distribution.map((w) => w.ward),
    datasets: [
      {
        label: "Issues Filed",
        data: data.ward_distribution.map((w) => w.count),
        backgroundColor: "#6366f1",
        borderRadius: 8,
      },
    ],
  };

  // Department Performance Chart
  const deptLabels = data.department_performance.map((d) => d.department);
  const deptData = {
    labels: deptLabels,
    datasets: [
      {
        label: "Pending Grievances",
        data: data.department_performance.map((d) => d.pending),
        backgroundColor: "#f59e0b",
        borderRadius: 6,
      },
      {
        label: "Avg Rating (1-5)",
        data: data.department_performance.map((d) => d.avg_rating || 0),
        backgroundColor: "#ec4899",
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Analytics & Governance</h1>
        <p className="text-slate-500 text-sm mt-1">Cross-department metrics, SLA compliance, satisfaction scores, and localization statistics.</p>
      </div>

      {/* Main SLA & Satisfaction Scoreboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SLA Compliance card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SLA Resolution Rate</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-black text-slate-800">{data.sla_compliance_rate}%</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">Target: 90%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Percentage of resolved complaints within SLA deadlines.</p>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-green-500 h-full rounded-full" style={{ width: `${data.sla_compliance_rate}%` }}></div>
          </div>
        </div>

        {/* Satisfaction Index card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Citizen Satisfaction</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-black text-slate-800">{data.satisfaction_rate}%</span>
              <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                ⭐ {data.avg_rating || "N/A"} Avg
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Satisfied feedback rating counts from closed tickets.</p>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${data.satisfaction_rate}%` }}></div>
          </div>
        </div>

        {/* SLA Breached Active tickets */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active SLA Breaches</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-4xl font-black ${data.active_breached_count > 0 ? "text-red-600" : "text-slate-800"}`}>
                {data.active_breached_count}
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">Escalated</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Active unresolved complaints currently past their SLA deadlines.</p>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${data.active_breached_count > 0 ? "bg-red-500" : "bg-slate-300"}`}
              style={{ width: data.active_breached_count > 0 ? "100%" : "0%" }}
            ></div>
          </div>
        </div>
      </div>

      {/* Grid of Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend line */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Grievance Registration Trends (30 Days)</h3>
          <Line
            data={trendData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: "#f8fafc" } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>

        {/* Ward Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Localization: Issues per Ward</h3>
          <Bar
            data={wardData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: "#f8fafc" } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department performance */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Department Workload & Rating Indices</h3>
          <Bar
            data={deptData}
            options={{
              responsive: true,
              scales: {
                y: { beginAtZero: true, grid: { color: "#f8fafc" } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>

        {/* Top categories breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-black text-slate-800 mb-4">Category Categorization Share</h3>
          <div className="h-56 flex items-center justify-center">
            <Doughnut
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } },
              }}
            />
          </div>
        </div>
      </div>

      {/* Officer workloads tracking list */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 mb-4">Officer Workload & Staffing Analytics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-600">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-center">Active Assigned Tickets</th>
                <th className="py-3 px-4 text-right">Workload Status</th>
              </tr>
            </thead>
            <tbody>
              {data.officer_workloads.map((off, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="py-3 px-4 text-slate-800 font-bold">{off.name}</td>
                  <td className="py-3 px-4">{off.department}</td>
                  <td className="py-3 px-4 text-center font-black text-slate-800">{off.active_tickets}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      off.active_tickets >= 5
                        ? "bg-red-50 text-red-700"
                        : off.active_tickets >= 2
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-green-50 text-green-700"
                    }`}>
                      {off.active_tickets >= 5 ? "Overloaded" : off.active_tickets >= 2 ? "Balanced" : "Available"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
