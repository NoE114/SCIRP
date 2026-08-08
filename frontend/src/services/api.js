const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const setToken = (token) => {
  if (token) {
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("access_token");
  }
};

export const getToken = () => localStorage.getItem("access_token");

const getUrl = (path) => path.startsWith(API_BASE) ? path : `${API_BASE}${path}`;

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(getUrl(path), { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || "API error");
  return data;
}

export async function apiRequestBlob(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(getUrl(path), { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to fetch file");
  }
  return await res.blob();
}
