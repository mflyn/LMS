/**
 * mongodb-memory-server 模拟模块
 */

class MongoMemoryServer {
  constructor(options) {
    this.options = options;
    this.uri = 'mongodb://localhost:27017/test-db';
  }

  static create(options) {
    return Promise.resolve(new MongoMemoryServer(options));
  }

  getUri() {
    return this.uri;
  }

  getPort() {
    return 27017;
  }

  getDbName() {
    return 'test-db';
  }

  getDbPath() {
    return '/tmp/mongo-memory-server';
  }

  stop() {
    return Promise.resolve();
  }
}

module.exports = { MongoMemoryServer };
