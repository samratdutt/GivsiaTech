// Express 4 doesn't forward rejected promises from async route handlers to
// the error middleware on its own — an unhandled rejection just hangs the
// request. Wrap async handlers with this so any thrown/rejected error
// reaches server.js's error handler and gets a clean response instead.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
