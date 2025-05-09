/**
 * express 模拟模块
 */

const mockRouter = {
  get: jest.fn().mockReturnThis(),
  post: jest.fn().mockReturnThis(),
  put: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  use: jest.fn().mockReturnThis()
};

const mockApp = {
  get: jest.fn().mockReturnThis(),
  post: jest.fn().mockReturnThis(),
  put: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  use: jest.fn().mockReturnThis(),
  listen: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  locals: {}
};

const express = jest.fn().mockReturnValue(mockApp);
express.Router = jest.fn().mockReturnValue(mockRouter);
express.json = jest.fn().mockReturnValue((req, res, next) => next());
express.urlencoded = jest.fn().mockReturnValue((req, res, next) => next());
express.static = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = express;
