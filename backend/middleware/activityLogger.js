import ActivityLog from "../models/ActivityLog.js";

// Maps a concrete request (method + path, with real IDs already in place —
// e.g. "DELETE /api/contact/64f1a2b3c4d5e6f7") to a short, human-readable
// action label. Anything not listed here still gets logged, just with a
// generic "METHOD /path" label instead of a friendly name — extend this
// list as new routes are added.
const ACTION_RULES = [
  [/^POST \/api\/auth\/register$/, "Registered (client)"],
  [/^POST \/api\/auth\/register-admin$/, "Registered (admin)"],
  [/^POST \/api\/auth\/register-service$/, "Registered (service)"],
  [/^POST \/api\/auth\/google-register$/, "Registered via Google"],
  [/^POST \/api\/auth\/login$/, "Logged in"],
  [/^POST \/api\/auth\/google-login$/, "Logged in via Google"],
  [/^PATCH \/api\/users\/me$/, "Updated profile"],
  [/^POST \/api\/users$/, "Created a user account"],
  [/^DELETE \/api\/users\/[^/]+$/, "Deleted a user"],
  [/^PATCH \/api\/users\/[^/]+\/role$/, "Changed a user's role"],
  [/^PATCH \/api\/users\/[^/]+\/status$/, "Activated/deactivated a user"],
  [/^POST \/api\/payments\/create-order$/, "Started a payment"],
  [/^POST \/api\/payments\/verify$/, "Completed a payment"],
  [/^PATCH \/api\/payments\/orders\/[^/]+\/cancel$/, "Cancelled a project"],
  [/^POST \/api\/payments\/orders\/[^/]+\/progress$/, "Posted a project update"],
  [/^POST \/api\/payments\/orders\/manual$/, "Logged a manual order"],
  [/^DELETE \/api\/payments\/orders\/[^/]+$/, "Deleted an order"],
  [/^PATCH \/api\/payments\/orders\/[^/]+\/status$/, "Changed an order's status"],
  [/^PATCH \/api\/payments\/orders\/[^/]+\/publish-details$/, "Updated project publish details"],
  [/^POST \/api\/contact$/, "Submitted the contact form"],
  [/^POST \/api\/contact\/support$/, "Sent a support message"],
  [/^PATCH \/api\/contact\/[^/]+\/status$/, "Updated a lead's status"],
  [/^DELETE \/api\/contact\/[^/]+$/, "Deleted a contact message"],
  [/^POST \/api\/reviews$/, "Submitted a review"],
  [/^DELETE \/api\/reviews\/[^/]+$/, "Deleted a review"],
  [/^POST \/api\/outreach\/generate$/, "Generated an outreach draft"],
  [/^POST \/api\/outreach\/send$/, "Sent an outreach message"],
  [/^POST \/api\/uploads\/image$/, "Uploaded an image"],
  [/^POST \/api\/bizleads\/discover$/, "Ran AI lead discovery"],
  [/^POST \/api\/bizleads\/import-csv$/, "Imported business leads via CSV"],
  [/^POST \/api\/bizleads$/, "Added a business lead"],
  [/^PATCH \/api\/bizleads\/[^/]+$/, "Updated a business lead"],
  [/^DELETE \/api\/bizleads\/[^/]+$/, "Deleted a business lead"],
  [/^POST \/api\/bizleads\/[^/]+\/notes$/, "Added a note to a business lead"],
  [/^POST \/api\/bizleads\/[^/]+\/generate-email$/, "Generated an AI outreach email for a lead"],
  [/^POST \/api\/bizleads\/[^/]+\/generate-proposal$/, "Generated an AI proposal for a lead"],
  [/^POST \/api\/bizleads\/[^/]+\/send-email$/, "Sent an outreach email to a lead"],
];

function describeAction(method, path) {
  const key = `${method} ${path}`;
  for (const [pattern, label] of ACTION_RULES) {
    if (pattern.test(key)) return label;
  }
  return key;
}

// GETs are reads (page loads, dashboard polling) rather than "operations" —
// morgan's request log already covers those. The health check is pure
// infra noise. Everything else with a side effect gets an entry.
function shouldSkip(req) {
  return req.method === "GET" || req.path === "/api/health";
}

// Global, mounted once in server.js — works for every route without
// touching individual route files. `protect` (when a route uses it) sets
// req.user before the route handler runs, and that's still attached to
// `req` by the time the "finish" event fires below, so authenticated
// actions get the real user automatically. For public auth routes
// (register/login), req.user doesn't exist yet — instead we peek at the
// { user } the route itself returned in its JSON response.
export function activityLogger(req, res, next) {
  if (shouldSkip(req)) return next();

  // Captured now, not read later — a mounted sub-router (e.g. authRoutes at
  // "/api/auth") strips its prefix from req.path/req.url while handling the
  // request, and since res.json() short-circuits the middleware chain
  // instead of unwinding it, that stripped value is still in effect by the
  // time "finish" fires below. req.originalUrl doesn't get mutated this way.
  const fullPath = req.originalUrl.split("?")[0];

  let capturedBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    const identity = req.user
      ? { id: req.user._id, name: req.user.name, role: req.user.role }
      : capturedBody?.user
      ? { id: capturedBody.user.id, name: capturedBody.user.name, role: capturedBody.user.role }
      : null;

    const action = describeAction(req.method, fullPath);
    console.log(
      `${new Date().toISOString()} [activity] ${identity ? `${identity.role}:${identity.name}` : "anonymous"} — ${action} (${res.statusCode})`
    );

    ActivityLog.create({
      user: identity?.id,
      userName: identity?.name,
      role: identity?.role || "anonymous",
      method: req.method,
      path: fullPath,
      action,
      statusCode: res.statusCode,
      ip: req.ip,
    }).catch((err) => console.error("Failed to persist activity log:", err.message));
  });

  next();
}
