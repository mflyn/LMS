/**
 * express-session 模拟模块
 */

const session = jest.fn().mockReturnValue((req, res, next) => {
  req.session = {
    id: 'test-session-id',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000
    },
    destroy: jest.fn().mockImplementation(callback => {
      if (callback) callback();
    }),
    regenerate: jest.fn().mockImplementation(callback => {
      if (callback) callback();
    }),
    save: jest.fn().mockImplementation(callback => {
      if (callback) callback();
    }),
    touch: jest.fn()
  };
  next();
});

module.exports = session;
