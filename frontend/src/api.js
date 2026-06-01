import axios from "axios";

// When VITE_API_URL is set, the app calls that backend directly (absolute URL).
// When it's empty, requests use a relative "/api" path so the Vite dev proxy
// (see vite.config.js) forwards them to the NAS backend. The relative path keeps
// the browser same-origin, which is what lets the httpOnly auth cookie work over
// plain HTTP without HTTPS.
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
});
