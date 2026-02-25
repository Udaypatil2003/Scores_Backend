const rateLimit = require("express-rate-limit");

// Strict limiter for auth routes
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per 15 min per IP
  message: {
    message: "Too many attempts. Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter for everything else
exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  message: {
    message: "Too many requests. Please slow down."
  },
  standardHeaders: true,
  legacyHeaders: false,
});