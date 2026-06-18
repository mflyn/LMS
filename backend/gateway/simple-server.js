const app = require('./server');

if (require.main === module) {
  app.startServer();
}

module.exports = app;
