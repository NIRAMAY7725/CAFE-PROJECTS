/**
 * Supporting Feature #7: API response-time and cache-control middleware
 */

export const responseTimeAndCacheControl = (req, res, next) => {
  const startHrTime = process.hrtime();

  // Attach listener to set X-Response-Time when response finishes sending headers
  res.on('finish', () => {
    // Already sent headers, logged for monitoring if needed
  });

  // Calculate and set header before headers are sent
  const originalSend = res.send;
  res.send = function (...args) {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
    
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedTimeInMs}ms`);

      // Cache-Control headers for API endpoints
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
    }

    return originalSend.apply(this, args);
  };

  next();
};
