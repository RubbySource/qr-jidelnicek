// Simple in-memory rate limiter — sliding window per IP key.
// For multi-instance deploys swap for Redis later; SQLite single-instance fits this fine.

function createRateLimiter({ windowMs, max, key, message }) {
  const buckets = new Map();
  const getKey = key || ((req) => req.ip || req.headers['x-forwarded-for'] || 'global');

  // Sweep stale buckets every windowMs to bound memory.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, hits] of buckets.entries()) {
      const fresh = hits.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(k);
      else buckets.set(k, fresh);
    }
  }, windowMs);
  if (sweep.unref) sweep.unref();

  return function rateLimit(req, res, next) {
    const k = getKey(req);
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (buckets.get(k) || []).filter((t) => t > cutoff);
    if (hits.length >= max) {
      const retryMs = (hits[0] + windowMs) - now;
      res.set('Retry-After', String(Math.ceil(retryMs / 1000)));
      return res.status(429).json({ error: message || 'Too many requests, try later.' });
    }
    hits.push(now);
    buckets.set(k, hits);
    next();
  };
}

module.exports = { createRateLimiter };
