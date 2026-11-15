const express = require('express');
const { AppError } = require('../common/middleware/errorTypes');

const AI2_PATH = /^\/api\/ai2(?=\/|$)/i;
const rawBody = Symbol('ai2ProxyRawBody');
const inputError = Symbol('ai2ProxyInputError');
const fail = (large = false) => {
  const code = large ? 'AI2_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
  return new AppError(code, large ? 413 : 400, code, true, []);
};

function createAi2ProxyInput() {
  const parser = express.json({ limit: 32768,
    verify: (req, _res, buffer, encoding) => {
      if (encoding !== 'utf-8') throw fail();
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      req[rawBody] = Buffer.from(buffer);
    } });
  return (req, res, next) => {
    if (!AI2_PATH.test(req.path)) return next();
    res.set('Cache-Control', 'no-store');
    parser(req, res, cause => {
      // Input errors must not bypass the ordinary limiter or JWT validation.
      if (cause) req[inputError] = fail(cause.type === 'entity.too.large');
      if (req.method === 'POST' && !req[rawBody]) req[inputError] ||= fail();
      req._body = true;
      req.body = {};
      next();
    });
  };
}

const checkAi2ProxyInput = (req, _res, next) => next(req[inputError]);
const ai2ProxyOptions = {
  proxyReqPathResolver: req => req.originalUrl,
  proxyReqBodyDecorator: (_body, req) => req[rawBody] || '',
  proxyReqOptDecorator: options => {
    // Captured JSON is already inflated; preserve bytes without inflating twice.
    delete options.headers['content-encoding'];
    delete options.headers['transfer-encoding'];
    return options;
  }
};
module.exports = { AI2_PATH, createAi2ProxyInput, checkAi2ProxyInput, ai2ProxyOptions };
