import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../services/api";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const eslRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds (fallback if SSE fails)
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest("/notifications");
      setNotifications(res.notifications);
      setUnreadCount(res.notifications.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications(notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnreadCount((c) => c - 1);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-primary"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 w-80 bg-white border rounded shadow-lg z-50">
          <div className="p-3 border-b flex justify-between items-center">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b text-sm cursor-pointer hover:bg-gray-50 ${
                    !n.is_read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => {
                    if (!n.is_read) markRead(n.id);
                    setShowDropdown(false);
                  }}
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-gray-600 mt-1">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 10-3 0v.68C8.634 5.36 7 7.92 7 11v3l-.595.595A2.032 2.032 0 016 14v3m7 3a2 2 0 104 0M9.878 10.731a1 1 0 011.415-1.415l.01.01a1 1 0 01.706 1.707l-.01.01a1 1 0 01-1.415-1.415z" />
    </svg>
  );
}
