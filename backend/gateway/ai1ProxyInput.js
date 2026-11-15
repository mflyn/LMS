const express = require('express');
const { AppError } = require('../common/middleware/errorTypes');

const AI1_PATH = /^\/api\/tutor-(?:cycles|jobs|artifacts)(?=\/|$)/i;
const rawBody = Symbol('ai1ProxyRawBody');
const inputError = Symbol('ai1ProxyInputError');
const fail = (large = false) => {
  const code = large ? 'AI_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
  return new AppError(code, large ? 413 : 400, code, true, []);
};

function createAi1ProxyInput() {
  const parser = express.json({ limit: 32768,
    verify: (req, _res, buffer, encoding) => {
      if (encoding !== 'utf-8') throw fail();
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      req[rawBody] = Buffer.from(buffer);
    } });
  return (req, res, next) => {
    if (!AI1_PATH.test(req.path)) return next();
    res.set('Cache-Control', 'no-store');
    parser(req, res, cause => {
      // Even malformed input must traverse the ordinary limiter and JWT check.
      if (cause) req[inputError] = fail(cause.type === 'entity.too.large');
      if (req.method === 'POST' && !req[rawBody]) req[inputError] ||= fail();
      req._body = true;
      req.body = {};
      next();
    });
  };
}

const checkAi1ProxyInput = (req, _res, next) => next(req[inputError]);
const ai1ProxyOptions = {
  proxyReqPathResolver: req => req.originalUrl,
  proxyReqBodyDecorator: (_body, req) => req[rawBody] || '',
  proxyReqOptDecorator: options => {
    // The parser has already inflated compressed JSON; never inflate it twice.
    delete options.headers['content-encoding'];
    delete options.headers['transfer-encoding'];
    return options;
  }
};
module.exports = { AI1_PATH, createAi1ProxyInput, checkAi1ProxyInput, ai1ProxyOptions };
