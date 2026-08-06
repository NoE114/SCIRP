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

  if (loading) return <p className="text-gray-500">Loading analytics...</p>;
  if (!data) return <p className="text-red-500">Failed to load analytics data</p>;

  const trendData = {
    labels: data.trends.map((t) => t.date),
    datasets: [
      {
        label: "Complaints Filed",
        data: data.trends.map((t) => t.count),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const categoryColors = [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a8", "#f97316",
  ];

  const categoryData = {
    labels: data.categories.map((c) => c.category),
    datasets: [
      {
        label: "Complaints",
        data: data.categories.map((c) => c.count),
        backgroundColor: categoryColors.slice(0, data.categories.length),
      },
    ],
  };

  const deptLabels = data.department_performance.map((d) => d.department);
  const deptData = {
    labels: deptLabels,
    datasets: [
      {
        label: "Pending",
        data: data.department_performance.map((d) => d.pending),
        backgroundColor: "#f59e0b",
      },
      {
        label: "Avg Resolution (hrs)",
        data: data.department_performance.map((d) =>
          d.avg_resolution_hours ?? 0
        ),
        backgroundColor: "#10b981",
      },
    ],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Complaint Trends (30 days)</h3>
          <Line
            data={trendData}
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 },
                },
              },
            }}
          />
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Top Categories</h3>
          <Doughnut
            data={categoryData}
            options={{ responsive: true, plugins: { legend: { position: "bottom" } } }}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Department Performance</h3>
        <Bar
          data={deptData}
          options={{
            responsive: true,
            scales: {
              y: { beginAtZero: true },
            },
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Complaints"
          value={data.trends.reduce((sum, t) => sum + t.count, 0)}
          color="blue"
        />
        <StatCard
          label="Active Departments"
          value={data.department_performance.length}
          color="green"
        />
        <StatCard
          label="Total Pending"
          value={data.department_performance.reduce((sum, d) => sum + d.pending, 0)}
          color="orange"
        />
        <StatCard
          label="Categories"
          value={data.categories.length}
          color="purple"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    orange: "bg-orange-100 text-orange-800",
    purple: "bg-purple-100 text-purple-800",
  };
  return (
    <div className="bg-white p-4 rounded shadow text-center">
      <p className={`text-2xl font-bold ${colorClasses[color] || "bg-gray-100 text-gray-800"}`}>
        {value}
      </p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}
