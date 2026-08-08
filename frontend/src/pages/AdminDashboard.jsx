import React, { useState, useEffect } from "react";
import { apiRequest } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  verified: "bg-purple-100 text-purple-800 border-purple-200",
  assigned: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
};

const DEPARTMENTS = [
  { id: 7, name: "Road" },
  { id: 8, name: "Water" },
  { id: 9, name: "Electricity" },
  { id: 10, name: "Sanitation" },
];

export default function AdminDashboard() {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Core lists
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // Upgrade lists
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Creation forms
  const [showOfficerForm, setShowOfficerForm] = useState(false);
  const [officerForm, setOfficerForm] = useState({
    name: "", email: "", password: "", phone: "", department_id: "",
  });

  const [newZoneName, setNewZoneName] = useState("");
  const [newWard, setNewWard] = useState({ name: "", zone_id: "", latitude: "", longitude: "" });
  
  const [newAnn, setNewAnn] = useState({ title: "", message: "", category: "general", zone_id: "", ward_id: "" });

  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewUserEmail, setPreviewUserEmail] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, usersRes, compRes, slaRes, zonesRes, wardsRes, logsRes, annRes] = await Promise.all([
        apiRequest("/dashboard"),
        apiRequest("/users"),
        apiRequest("/complaints"),
        apiRequest("/sla/configs").catch(() => ({ configs: [] })),
        apiRequest("/zones").catch(() => ({ zones: [] })),
        apiRequest("/wards").catch(() => ({ wards: [] })),
        apiRequest("/audit-logs").catch(() => ({ audit_logs: [] })),
        apiRequest("/announcements").catch(() => ({ announcements: [] }))
      ]);

      setDashboard(dash);
      setUsers(usersRes.users);
      setComplaints(compRes.complaints);
      setSlaConfigs(slaRes.configs || []);
      setZones(zonesRes.zones || []);
      setWards(wardsRes.wards || []);
      setAuditLogs(logsRes.audit_logs || []);
      setAnnouncements(annRes.announcements || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Secure ID Proof Preview
  const viewIdProof = async (user) => {
    if (!user.id_proof_url) return;
    setLoadingPreview(true);
    setPreviewUserEmail(user.email);
    try {
      const { apiRequestBlob } = await import("../services/api");
      const blob = await apiRequestBlob(user.id_proof_url);
      const url = URL.createObjectURL(blob);
      setPreviewImageUrl(url);
    } catch (err) {
      alert("Failed to load ID proof: " + err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPreviewImageUrl(null);
    setPreviewUserEmail("");
  };

  // User Administration
  const toggleUserActive = async (userId, currentStatus) => {
    try {
      await apiRequest(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch (err) {
      alert("Failed to toggle status: " + err.message);
    }
  };

  const deleteUser = async (userToDelete) => {
    if (window.confirm(`Are you sure you want to permanently delete the account for ${userToDelete.name}? This will cascade and delete all their complaints, logs, and notification records.`)) {
      try {
        await apiRequest(`/users/${userToDelete.id}`, { method: "DELETE" });
        setUsers(users.filter(u => u.id !== userToDelete.id));
        alert("Account permanently deleted.");
      } catch (err) {
        alert("Failed to delete user: " + err.message);
      }
    }
  };

  // Complaint Administration
  const toggleSpam = async (complaintId, currentStatus) => {
    try {
      await apiRequest(`/complaints/${complaintId}/spam`, {
        method: "PUT",
        body: JSON.stringify({ is_spam: !currentStatus }),
      });
      setComplaints(complaints.map(c => c.id === complaintId ? { ...c, is_spam: !currentStatus } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const reassignComplaint = async (complaintId, departmentId) => {
    try {
      await apiRequest(`/complaints/${complaintId}`, {
        method: "PUT",
        body: JSON.stringify({ department_id: departmentId, remarks: "Reassigned by admin" }),
      });
      setComplaints(complaints.map(c => c.id === complaintId ? { ...c, department_id: departmentId } : c));
      alert("Department reassigned successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  // Creation forms
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
      alert("Officer account created successfully.");
    } catch (err) {
      alert("Failed to create officer: " + err.message);
    }
  };

  // SLA Configurations
  const handleUpdateSla = async (priority, durationHours) => {
    try {
      await apiRequest(`/sla/configs/${priority}`, {
        method: "PUT",
        body: JSON.stringify({ duration_hours: parseInt(durationHours) }),
      });
      alert("SLA configuration updated.");
      loadData();
    } catch (err) {
      alert("Failed to update SLA: " + err.message);
    }
  };

  // Zones & Wards
  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      await apiRequest("/zones", {
        method: "POST",
        body: JSON.stringify({ name: newZoneName }),
      });
      setNewZoneName("");
      alert("Zone created successfully.");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateWard = async (e) => {
    e.preventDefault();
    if (!newWard.name || !newWard.zone_id || !newWard.latitude || !newWard.longitude) {
      alert("All fields are required.");
      return;
    }
    try {
      await apiRequest("/wards", {
        method: "POST",
        body: JSON.stringify({
          name: newWard.name,
          zone_id: parseInt(newWard.zone_id),
          latitude: parseFloat(newWard.latitude),
          longitude: parseFloat(newWard.longitude)
        }),
      });
      setNewWard({ name: "", zone_id: "", latitude: "", longitude: "" });
      alert("Ward created successfully.");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Announcements publishing
  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnn.title || !newAnn.message) return;
    try {
      await apiRequest("/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: newAnn.title,
          message: newAnn.message,
          category: newAnn.category,
          zone_id: newAnn.zone_id ? parseInt(newAnn.zone_id) : null,
          ward_id: newAnn.ward_id ? parseInt(newAnn.ward_id) : null,
        }),
      });
      setNewAnn({ title: "", message: "", category: "general", zone_id: "", ward_id: "" });
      alert("Announcement posted to targeted citizens.");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-slate-400 font-bold">Loading System Console...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">System Admin Console</h1>
        <p className="text-slate-500 text-sm mt-1">Configure geo-zones, SLAs, announcements, user verification, and monitor audit trails.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: "dashboard", label: "Overview" },
          { id: "users", label: "Verification & Accounts" },
          { id: "complaints", label: "Complaints & Routing" },
          { id: "sla", label: "SLA Configurations" },
          { id: "geo", label: "Wards & Zones" },
          { id: "announcements", label: "Compose Announcement" },
          { id: "audit", label: "Audit Trails" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "dashboard" && dashboard && (
        <DashboardView dashboard={dashboard} setShowOfficerForm={setShowOfficerForm} />
      )}

      {/* Create Officer modal overlay */}
      {showOfficerForm && (
        <OfficerForm
          form={officerForm}
          onChange={setOfficerForm}
          onSubmit={createOfficer}
          onCancel={() => setShowOfficerForm(false)}
        />
      )}

      {/* Users Accounts Verification */}
      {activeTab === "users" && (
        <UserManagement
          users={users}
          currentAdminId={currentAdmin?.id}
          onToggleActive={toggleUserActive}
          onViewIdProof={viewIdProof}
          onDeleteUser={deleteUser}
          onAddOfficer={() => setShowOfficerForm(true)}
        />
      )}

      {/* Complaints list */}
      {activeTab === "complaints" && (
        <ComplaintManagement
          complaints={complaints}
          onToggleSpam={toggleSpam}
          onReassign={reassignComplaint}
          departments={DEPARTMENTS}
        />
      )}

      {/* SLA tab */}
      {activeTab === "sla" && (
        <SlaConfigManagement configs={slaConfigs} onUpdate={handleUpdateSla} />
      )}

      {/* Wards & Zones tab */}
      {activeTab === "geo" && (
        <GeoManagement
          zones={zones}
          wards={wards}
          newZoneName={newZoneName}
          setNewZoneName={setNewZoneName}
          onCreateZone={handleCreateZone}
          newWard={newWard}
          setNewWard={setNewWard}
          onCreateWard={handleCreateWard}
        />
      )}

      {/* Announcements tab */}
      {activeTab === "announcements" && (
        <AnnouncementsComposer
          newAnn={newAnn}
          setNewAnn={setNewAnn}
          zones={zones}
          wards={wards}
          announcements={announcements}
          onSubmit={handlePostAnnouncement}
        />
      )}

      {/* Audit Trails Tab */}
      {activeTab === "audit" && (
        <AuditLogViewer logs={auditLogs} />
      )}

      {/* ID Proof Secure Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">ID Proof Preview: {previewUserEmail}</h3>
              <button onClick={closePreview} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex justify-center bg-slate-50 items-center min-h-[300px]">
              {previewUserEmail.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewImageUrl} className="w-full h-[60vh] border border-slate-200 rounded-lg" title="ID Proof Document" />
              ) : (
                <img src={previewImageUrl} alt="Citizen ID Proof" className="max-w-full max-h-[60vh] rounded-lg shadow-sm object-contain" />
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button onClick={closePreview} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Binary loading modal overlay */}
      {loadingPreview && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-700">Fetching ID proof...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Inner Component Views
function DashboardView({ dashboard, setShowOfficerForm }) {
  const s = dashboard.stats;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Directory</h3>
        <p className="text-4xl font-black text-slate-800">{s.total_users}</p>
        <div className="space-y-1.5 pt-2 border-t border-slate-50">
          {Object.entries(s.users_by_role || {}).map(([role, count]) => (
            <div key={role} className="flex justify-between text-xs font-semibold capitalize text-slate-600">
              <span>{role}:</span>
              <span className="text-slate-850 font-black">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Complaint Backlog</h3>
        <p className="text-4xl font-black text-slate-800">{s.total_complaints}</p>
        <div className="space-y-1.5 pt-2 border-t border-slate-50">
          {Object.entries(s.complaints_by_status || {}).map(([status, count]) => (
            <div key={status} className="flex justify-between text-xs font-semibold capitalize text-slate-600">
              <span>{status.replace("_", " ")}:</span>
              <span className="text-slate-850 font-black">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operations Departments</h3>
          <p className="text-4xl font-black text-slate-800">{s.total_departments}</p>
        </div>
        <button
          onClick={() => setShowOfficerForm(true)}
          className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-2 rounded-xl text-xs transition shadow-sm mt-4"
        >
          + Add New Officer
        </button>
      </div>
    </div>
  );
}

function OfficerForm({ form, onChange, onSubmit, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl w-96 space-y-4">
        <h3 className="text-lg font-black text-slate-800">Add New Officer</h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onChange({ ...form, password: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Department Assignment</label>
            <select
              value={form.department_id}
              onChange={(e) => onChange({ ...form, department_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold"
              required
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2 text-xs font-bold">
            <button type="submit" className="flex-1 bg-primary hover:bg-blue-800 text-white py-2 rounded-xl transition">Create</button>
            <button type="button" onClick={onCancel} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-xl transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserManagement({ users, currentAdminId, onToggleActive, onViewIdProof, onDeleteUser, onAddOfficer }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
        <h3 className="font-extrabold text-slate-800 text-base">User Directory Verification</h3>
        <button onClick={onAddOfficer} className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl hover:bg-blue-800 transition">
          + Add Officer
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-650 font-semibold text-left">
          <thead>
            <tr className="border-b text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-2">Name</th>
              <th className="py-3 px-2">Email</th>
              <th className="py-3 px-2">Role</th>
              <th className="py-3 px-2">Department</th>
              <th className="py-3 px-2">ID Proof</th>
              <th className="py-3 px-2">Verification Status</th>
              <th className="py-3 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-bold text-slate-850">{u.name}</td>
                <td className="py-3 px-2">{u.email}</td>
                <td className="py-3 px-2 capitalize">{u.role}</td>
                <td className="py-3 px-2">{u.department_name || "-"}</td>
                <td className="py-3 px-2">
                  {u.id_proof_url ? (
                    <button onClick={() => onViewIdProof(u)} className="text-blue-600 hover:underline">
                      🔍 View Document
                    </button>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    u.is_active ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                  }`}>
                    {u.is_active ? "Approved / Active" : "Pending Approval"}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="flex justify-end gap-2 text-[10px] font-bold">
                    {u.role === "citizen" && !u.is_active ? (
                      <button onClick={() => onToggleActive(u.id, u.is_active)} className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition">
                        Approve
                      </button>
                    ) : (
                      <button onClick={() => onToggleActive(u.id, u.is_active)} className={`px-2.5 py-1.5 rounded-lg border transition ${
                        u.is_active ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200" : "bg-blue-600 text-white hover:bg-blue-700 border-blue-500"
                      }`}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}

                    {u.id !== currentAdminId && (
                      <button onClick={() => onDeleteUser(u)} className="px-2.5 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 rounded-lg transition border border-red-200">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplaintManagement({ complaints, onToggleSpam, onReassign, departments }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Complaints Backlog & Routing</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-650 font-semibold text-left">
          <thead>
            <tr className="border-b text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-2">Tracking ID</th>
              <th className="py-3 px-2">Title</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-2">Department</th>
              <th className="py-3 px-2 text-center">Spam?</th>
              <th className="py-3 px-2 text-right">Manual Routing</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-bold text-slate-850">{c.tracking_id}</td>
                <td className="py-3 px-2">{c.title}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-800"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="py-3 px-2">{c.department_name || "Unassigned"}</td>
                <td className="py-3 px-2 text-center">
                  <button
                    onClick={() => onToggleSpam(c.id, c.is_spam)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition ${
                      c.is_spam ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {c.is_spam ? "Flagged Spam" : "Mark Spam"}
                  </button>
                </td>
                <td className="py-3 px-2 text-right">
                  <select
                    defaultValue={c.department_id || ""}
                    onChange={(e) => onReassign(c.id, parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] rounded-lg p-1.5 focus:outline-none focus:bg-white"
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
}

function SlaConfigManagement({ configs, onUpdate }) {
  const [editingId, setEditingId] = useState(null);
  const [val, setVal] = useState("");

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 max-w-2xl">
      <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">SLA Configurations</h3>
      <div className="space-y-4">
        {configs.map((config) => (
          <div key={config.priority} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
              <span className="font-bold text-slate-800 capitalize text-sm">{config.priority}</span>
            </div>
            <div className="flex items-center gap-3">
              {editingId === config.priority ? (
                <>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-slate-500">hours</span>
                  <button
                    onClick={() => {
                      onUpdate(config.priority, val);
                      setEditingId(null);
                    }}
                    className="bg-primary hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs font-bold text-slate-500">Cancel</button>
                </>
              ) : (
                <>
                  <span className="font-extrabold text-slate-800 text-sm">{config.duration_hours} hours</span>
                  <button
                    onClick={() => {
                      setEditingId(config.priority);
                      setVal(config.duration_hours);
                    }}
                    className="bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg transition"
                  >
                    Edit SLA
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeoManagement({ zones, wards, newZoneName, setNewZoneName, onCreateZone, newWard, setNewWard, onCreateWard }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Zones */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Zone Operations</h3>
        
        {/* Create Zone */}
        <form onSubmit={onCreateZone} className="flex gap-2">
          <input
            type="text"
            placeholder="New Zone Name (e.g. South Mumbai)"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:bg-white"
          />
          <button type="submit" className="bg-primary hover:bg-blue-800 text-white font-bold text-xs px-4 rounded-xl transition">
            Add Zone
          </button>
        </form>

        <div className="space-y-2 mt-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Existing Zones:</span>
          <div className="grid grid-cols-2 gap-2">
            {zones.map((z) => (
              <div key={z.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-bold text-slate-700 capitalize">
                {z.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wards */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Ward Mapping</h3>
        
        {/* Create Ward */}
        <form onSubmit={onCreateWard} className="space-y-3 bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
          <h4 className="text-xs font-extrabold text-slate-600">Register New Ward Centroid</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Ward Name"
              value={newWard.name}
              onChange={(e) => setNewWard({ ...newWard, name: e.target.value })}
              className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
              required
            />
            <select
              value={newWard.zone_id}
              onChange={(e) => setNewWard({ ...newWard, zone_id: e.target.value })}
              className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
              required
            >
              <option value="">Select Zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.000001"
              placeholder="Centroid Latitude"
              value={newWard.latitude}
              onChange={(e) => setNewWard({ ...newWard, latitude: e.target.value })}
              className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
              required
            />
            <input
              type="number"
              step="0.000001"
              placeholder="Centroid Longitude"
              value={newWard.longitude}
              onChange={(e) => setNewWard({ ...newWard, longitude: e.target.value })}
              className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
              required
            />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-blue-800 text-white font-bold text-xs py-2 rounded-xl transition shadow-sm">
            Save Ward
          </button>
        </form>

        <div className="overflow-y-auto max-h-[220px] space-y-1.5 pr-2">
          {wards.map((w) => (
            <div key={w.id} className="flex justify-between items-center text-xs font-semibold bg-slate-50 border border-slate-100 p-2 rounded-xl text-slate-700">
              <span>{w.name}</span>
              <span className="text-slate-400 font-bold">{w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnouncementsComposer({ newAnn, setNewAnn, zones, wards, announcements, onSubmit }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Composer form */}
      <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Publish Announcement</h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Title</label>
            <input
              type="text"
              value={newAnn.title}
              onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Message Body</label>
            <textarea
              value={newAnn.message}
              onChange={(e) => setNewAnn({ ...newAnn, message: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none"
              rows="3"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Type</label>
              <select
                value={newAnn.category}
                onChange={(e) => setNewAnn({ ...newAnn, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-semibold"
              >
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Target Zone</label>
              <select
                value={newAnn.zone_id}
                onChange={(e) => setNewAnn({ ...newAnn, zone_id: e.target.value, ward_id: "" })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-semibold"
              >
                <option value="">All Zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Target Ward</label>
              <select
                value={newAnn.ward_id}
                onChange={(e) => setNewAnn({ ...newAnn, ward_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-semibold"
                disabled={!newAnn.zone_id}
              >
                <option value="">All Wards</option>
                {wards.filter(w => w.zone_id === parseInt(newAnn.zone_id)).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-2 rounded-xl text-xs transition shadow-sm mt-3">
            Publish & Broadcast Alert
          </button>
        </form>
      </div>

      {/* History */}
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Announcement Log</h3>
        <div className="overflow-y-auto max-h-[360px] space-y-3 pr-2">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
              <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase">{ann.category}</span>
                <span className="text-slate-400">{new Date(ann.created_at).toLocaleString()}</span>
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm mt-1">{ann.title}</h4>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">{ann.message}</p>
              <div className="flex gap-4 text-[10px] font-bold text-slate-400 mt-2.5 pt-2 border-t border-slate-100/50">
                <span>Target Zone: <span className="text-slate-700 capitalize">{ann.zone_name || "All Zones"}</span></span>
                <span>Target Ward: <span className="text-slate-700">{ann.ward_name || "All Wards"}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditLogViewer({ logs }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h3 className="font-extrabold text-slate-800 text-base pb-2 border-b border-slate-50">Security & Action Audit Logs</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-650 font-semibold text-left">
          <thead>
            <tr className="border-b text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-2">Timestamp</th>
              <th className="py-3 px-2">User ID</th>
              <th className="py-3 px-2">Action</th>
              <th className="py-3 px-2">Entity</th>
              <th className="py-3 px-2">Old Value</th>
              <th className="py-3 px-2">New Value</th>
              <th className="py-3 px-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                <td className="py-3 px-2 font-bold text-slate-500">
                  {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="py-3 px-2">{log.user_id ? `#${log.user_id}` : "System"}</td>
                <td className="py-3 px-2 font-bold text-indigo-700 uppercase">{log.action}</td>
                <td className="py-3 px-2 font-bold text-slate-800 capitalize">
                  {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
                </td>
                <td className="py-3 px-2 max-w-[120px] truncate">{log.old_value || "-"}</td>
                <td className="py-3 px-2 max-w-[120px] truncate">{log.new_value || "-"}</td>
                <td className="py-3 px-2 text-right font-medium text-slate-400">
                  {log.metadata ? JSON.stringify(log.metadata) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
