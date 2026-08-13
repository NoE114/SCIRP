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

const PUBLIC_PATHS = ["/public/", "/complaints/track"];

const handleAuthFailure = (path) => {
  console.warn(`401 on ${path} — clearing session`);
  localStorage.removeItem("access_token");
  if (!PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const current = window.location.pathname + window.location.search;
    if (!current.startsWith("/login")) {
      const redirect = encodeURIComponent(current);
      window.location.assign(`/login?redirect=${redirect}`);
    }
  }
};

export async function apiRequest(path, options = {}) {
  try {
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
    if (res.status === 401) handleAuthFailure(path);
    if (!res.ok) throw new Error(data.msg || "API error");
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error("Network error — is the backend running?");
    }
    throw err;
  }
}

export async function apiRequestBlob(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(getUrl(path), { ...options, headers });
  if (res.status === 401) handleAuthFailure(path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to fetch file");
  }
  return await res.blob();
}
