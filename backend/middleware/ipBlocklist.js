import BlockedIP from "../models/BlockedIP.js";

// Mounted early in server.js, before routes — a blocked IP gets a flat 403
// before it ever reaches auth, rate limiting, or a route handler. Expired
// temporary blocks are cleaned up by BlockedIP's own TTL index in the
// background, so a lookup miss here already means "not currently blocked."
export async function ipBlocklist(req, res, next) {
  try {
    const blocked = await BlockedIP.findOne({ ip: req.ip });
    if (blocked && (!blocked.expiresAt || blocked.expiresAt > new Date())) {
      return res.status(403).json({ message: "Access denied" });
    }
  } catch (err) {
    console.error("IP blocklist check failed:", err.message);
    // fail open - a DB hiccup here shouldn't take the whole site down
  }
  next();
}
