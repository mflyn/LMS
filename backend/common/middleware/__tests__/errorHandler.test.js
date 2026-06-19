const mongoose = require('mongoose');
const { AppError, BadRequestError } = require('../errorTypes');
const { catchAsync, errorHandler, requestTracker } = require('../errorHandler');

describe('shared error middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let req;
  let res;
  let next;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    req = {
      app: { locals: { logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } } },
      get: jest.fn(),
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/test',
      requestId: 'request-1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 200
    };
    next = jest.fn();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('returns the approved contract for operational errors', () => {
    errorHandler(new BadRequestError('invalid input'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'invalid input', details: [] }
    });
  });

  test('preserves an explicit stable error code', () => {
    const error = new BadRequestError('stale token');
    error.statusCode = 401;
    error.code = 'STALE_CHILD_TOKEN';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'STALE_CHILD_TOKEN', message: 'stale token', details: [] }
    });
  });

  test('does not expose non-operational error details', () => {
    errorHandler(new Error('database password leaked'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', details: [] }
    });
  });

  test('treats generic 500 AppError instances as non-operational', () => {
    errorHandler(new AppError('database password leaked', 500), req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', details: [] }
    });
  });

  test('normalizes mongoose validation errors', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError('name', new mongoose.Error.ValidatorError({ message: 'name is required' }));

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required', details: [] }
    });
  });

  test('requestTracker adds a request id and continues', () => {
    req.requestId = undefined;
    requestTracker(req, res, next);

    expect(req.requestId).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalledWith();
  });

  test('catchAsync forwards rejected promises', async () => {
    const error = new Error('async failure');
    await catchAsync(async () => { throw error; })(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
