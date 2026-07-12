const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (app) => {
  app.use('/api', createProxyMiddleware({
    target: process.env.FAMILY_GATEWAY_URL || 'http://localhost:8000',
    changeOrigin: true
  }));
};
