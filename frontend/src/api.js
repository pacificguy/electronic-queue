import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export function setToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

const stored = localStorage.getItem("token");
if (stored) setToken(stored);

export function extractError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return error?.message || "Неизвестная ошибка";
}

export default api;
