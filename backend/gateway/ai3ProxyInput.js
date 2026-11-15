const express = require('express');
const { AppError } = require('../common/middleware/errorTypes');
const AI3_PATH = /^\/api\/ai3(?=\/|$)/i;
const rawBody = Symbol('ai3ProxyRawBody'), inputError = Symbol('ai3ProxyInputError');
const fail = large => { const code = large ? 'AI3_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
  return new AppError(code, large ? 413 : 400, code, true, []); };
function createAi3ProxyInput() {
  const parser = express.json({ limit: 32768, verify: (req, _res, buffer, encoding) => {
    if (encoding !== 'utf-8') throw fail();
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    req[rawBody] = Buffer.from(buffer);
  } });
  return (req, res, next) => {
    if (!AI3_PATH.test(req.path)) return next();
    res.set('Cache-Control', 'no-store');
    parser(req, res, cause => {
      if (cause) req[inputError] = fail(cause.type === 'entity.too.large');
      if (req.method === 'POST' && !req[rawBody]) req[inputError] ||= fail();
      // Preserve original bytes while still running the ordinary limiter and authentication.
      req._body = true; req.body = {}; next();
    });
  };
}
const checkAi3ProxyInput = (req, _res, next) => next(req[inputError]);
const ai3ProxyOptions = {
  proxyReqPathResolver: req => req.originalUrl,
  proxyReqBodyDecorator: (_body, req) => req[rawBody] || '',
  proxyReqOptDecorator: options => {
    delete options.headers['content-encoding']; delete options.headers['transfer-encoding'];
    delete options.headers['x-ai3-evidence-token']; return options;
  }
};
module.exports = { AI3_PATH, createAi3ProxyInput, checkAi3ProxyInput, ai3ProxyOptions };
