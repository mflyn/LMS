const applySensitiveRateLimit = (req, res, next) => {
  const limiter = req.app && req.app.get && req.app.get('sensitiveLimiter');
  if (typeof limiter === 'function') {
    return limiter(req, res, next);
  }
  return next();
};

module.exports = {
  applySensitiveRateLimit
};
