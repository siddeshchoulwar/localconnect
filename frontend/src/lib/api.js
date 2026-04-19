import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Builds a URL for serving an uploaded image via query-param auth
// (because <img src> cannot send Authorization headers).
export function mediaUrl(path) {
  if (!path) return null;
  const token = localStorage.getItem("lc_token");
  const base = `${API}/files/${path}`;
  return token ? `${base}?auth=${encodeURIComponent(token)}` : base;
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // {path, size}
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
