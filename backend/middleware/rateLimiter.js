import rateLimit from 'express-rate-limit';

/**
 * Supporting Feature #3: Rate limiting on auth routes (10 requests per 15 minutes)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    retryAfterMinutes: 15,
  },
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

/**
 * General API Limiter (optional protection for all other endpoints)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 300 requests per 15 minutes for general routes
  standardHeaders: true,
  legacyHeaders: false,
});
