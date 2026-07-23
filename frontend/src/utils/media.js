// Uploaded images are served from the API's origin at /uploads/..., not
// under /api — this strips the /api suffix from VITE_API_URL to get that
// origin, so components just pass through whatever relative path the
// backend returned.
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export const resolveImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
};
