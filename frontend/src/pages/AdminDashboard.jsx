import React, { useState, useEffect } from "react";
import { apiRequest } from "../services/api";

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-800",
  verified: "bg-purple-100 text-purple-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const DEPARTMENTS = [
  { id: 7, name: "Road" },
  { id: 8, name: "Water" },
  { id: 9, name: "Electricity" },
  { id: 10, name: "Sanitation" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOfficerForm, setShowOfficerForm] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    name: "", email: "", password: "", phone: "", department_id: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const dash = await apiRequest("/dashboard");
      setDashboard(dash);
      const usersRes = await apiRequest("/users");
      setUsers(usersRes.users);
      const compRes = await apiRequest("/complaints");
      setComplaints(compRes.complaints);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleUserActive = async (userId, currentStatus) => {
    try {
      await apiRequest(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSpam = async (complaintId, currentStatus) => {
    try {
      await apiRequest(`/complaints/${complaintId}/spam`, {
        method: "PUT",
        body: JSON.stringify({ is_spam: !currentStatus }),
      });
      setComplaints(complaints.map(c => c.id === complaintId ? { ...c, is_spam: !currentStatus } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const reassignComplaint = async (complaintId, departmentId) => {
    try {
      await apiRequest(`/complaints/${complaintId}`, {
        method: "PUT",
        body: JSON.stringify({ department_id: departmentId, remarks: "Reassigned by admin" }),
      });
      setComplaints(complaints.map(c => c.id === complaintId ? { ...c, department_id: departmentId } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const createOfficer = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest("/officer", {
        method: "POST",
        body: JSON.stringify({
          ...officerForm,
          department_id: parseInt(officerForm.department_id),
        }),
      });
      setUsers([...users, res.officer]);
      setShowOfficerForm(false);
      setOfficerForm({ name: "", email: "", password: "", phone: "", department_id: "" });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="text-gray-500">Loading admin dashboard...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="flex gap-2 border-b">
        {[
          { id: "dashboard", label: "Overview" },
          { id: "users", label: "Users" },
          { id: "complaints", label: "Complaints" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && dashboard && (
        <DashboardView dashboard={dashboard} setShowOfficerForm={setShowOfficerForm} />
      )}

      {activeTab === "dashboard" && showOfficerForm && (
        <OfficerForm
          form={officerForm}
          onChange={setOfficerForm}
          onSubmit={createOfficer}
          onCancel={() => setShowOfficerForm(false)}
        />
      )}

      {activeTab === "users" && (
        <UserManagement
          users={users}
          onToggleActive={toggleUserActive}
          onAddOfficer={() => setShowOfficerForm(true)}
        />
      )}

      {activeTab === "complaints" && (
        <ComplaintManagement
          complaints={complaints}
          onToggleSpam={toggleSpam}
          onReassign={reassignComplaint}
          departments={DEPARTMENTS}
        />
      )}
    </div>
  );
}

function DashboardView({ dashboard, setShowOfficerForm }) {
  const s = dashboard.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-sm text-gray-500">Total Users</h3>
          <p className="text-3xl font-bold">{s.total_users}</p>
          <div className="mt-2 space-y-1">
            {Object.entries(s.users_by_role || {}).map(([role, count]) => (
              <p key={role} className="text-sm text-gray-600">{role}: {count}</p>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-sm text-gray-500">Total Complaints</h3>
          <p className="text-3xl font-bold">{s.total_complaints}</p>
          <div className="mt-2 space-y-1">
            {Object.entries(s.complaints_by_status || {}).map(([status, count]) => (
              <p key={status} className="text-sm text-gray-600">{status}: {count}</p>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-sm text-gray-500">Departments</h3>
          <p className="text-3xl font-bold">{s.total_departments}</p>
          <button
            onClick={() => setShowOfficerForm(true)}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + Add Officer
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Recent Complaints</h3>
        </div>
        <div className="divide-y">
          {dashboard.recent_complaints.map((c) => (
            <div key={c.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-gray-600">{c.description.substring(0, 60)}...</p>
                <p className="text-xs text-gray-400">
                  {new Date(c.created_at).toLocaleDateString()} · {c.category}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-800"}`}>
                {c.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OfficerForm({ form, onChange, onSubmit, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-4">Create New Officer</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="w-full border rounded px-2 py-1 mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              className="w-full border rounded px-2 py-1 mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onChange({ ...form, password: e.target.value })}
              className="w-full border rounded px-2 py-1 mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              className="w-full border rounded px-2 py-1 mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Department</label>
            <select
              value={form.department_id}
              onChange={(e) => onChange({ ...form, department_id: e.target.value })}
              className="w-full border rounded px-2 py-1 mt-1"
              required
            >
              <option value="">Select department</option>
              {[7, 8, 9, 10].map((id) => (
                <option key={id} value={id}>
                  {DEPARTMENTS.find((d) => d.id === id)?.name || id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-800 flex-1">Create</button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 flex-1"
            >Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserManagement({ users, onToggleActive, onAddOfficer }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">All Users</h3>
        <button onClick={onAddOfficer} className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-800">
          Add Officer
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Role</th>
              <th className="text-left py-2">Department</th>
              <th className="text-left py-2">Status</th>
              <th className="text-center py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.name}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.department_name || "-"}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => onToggleActive(u.id, u.is_active)}
                    className={`text-xs px-2 py-1 rounded ${u.is_active ? "bg-red-100 text-red-800 hover:bg-red-200" : "bg-green-100 text-green-800 hover:bg-green-200"}`}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function ComplaintManagement({ complaints, onToggleSpam, onReassign, departments }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">All Complaints</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">ID</th>
              <th className="text-left py-2">Title</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Dept</th>
              <th className="text-center py-2">Spam</th>
              <th className="py-2">Reassign</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2">{c.id}</td>
                <td className="py-2">{c.title}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-800"}`}>
                    {c.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-2">{c.department_name || "Unassigned"}</td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => onToggleSpam(c.id, c.is_spam)}
                    className={`text-xs px-2 py-1 rounded ${c.is_spam ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}
                  >
                    {c.is_spam ? "Yes" : "No"}
                  </button>
                </td>
                <td className="py-2">
                  <select
                    defaultValue={c.department_id || ""}
                    onChange={(e) => onReassign(c.id, parseInt(e.target.value))}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
