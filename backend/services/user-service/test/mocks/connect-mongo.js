/**
 * connect-mongo 模拟模块
 */

const MongoStore = {
  create: jest.fn().mockReturnValue({
    on: jest.fn(),
    close: jest.fn()
  })
};

module.exports = MongoStore;
