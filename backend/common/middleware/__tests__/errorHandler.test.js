const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  InternalServerError
} = require('../errorTypes');

const {
  requestTracker,
  errorHandler,
  catchAsync,
} = require('../errorHandler');
const { logger } = require('../../utils/logger');

// Mock logger and uuid
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('ErrorHandler Middleware', () => {
  let mockReq, mockRes, mockNext, mockError;

  beforeEach(() => {
    uuidv4.mockReturnValue('test-request-id'); // Consistent request ID for tests
    mockReq = {
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/test',
      headers: { 'user-agent': 'jest-test' },
      get: jest.fn(headerName => {
        if (headerName && headerName.toLowerCase() === 'user-agent') {
          return mockReq.headers['user-agent'];
        }
        return undefined;
      }),
      body: { test: 'body' },
      app: {
        locals: {
          logger: logger, // Use the mocked logger
          serviceName: 'test-service'
        }
      },
      requestId: undefined, // Will be set by requestTracker
      startTime: undefined, // Will be set by requestTracker
    };
    mockRes = {
      statusCode: 200, // Default success
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      locals: {},
      on: jest.fn((event, cb) => {
        // Allow to manually trigger finish/close for testing in requestTracker
        if (event === 'finish') mockRes._finishCallback = cb;
        if (event === 'close') mockRes._closeCallback = cb;
        return mockRes;
      }),
      get: jest.fn(), // For res.get('Content-Length')
    };
    mockNext = jest.fn();
    mockError = new Error('Generic Error');

    // Clear all mocks
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    uuidv4.mockClear();
    mockRes.status.mockClear();
    mockRes.json.mockClear();
    mockRes.send.mockClear();
    mockRes.on.mockClear();
    mockRes.get.mockClear();
    mockNext.mockClear();
    if (mockReq.get && mockReq.get.mockClear) {
      mockReq.get.mockClear();
    }
  });

  describe('requestTracker', () => {
    it('should add requestId and startTime to req, log request start', () => {
      uuidv4.mockReturnValueOnce('unique-req-id-123');
      requestTracker(mockReq, mockRes, mockNext);

      expect(uuidv4).toHaveBeenCalled();
      expect(mockReq.requestId).toBe('unique-req-id-123');
      expect(mockReq.startTime).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[unique-req-id-123] Request Start: GET /test from 127.0.0.1')
      );
      expect(mockNext).toHaveBeenCalledWith(); // Should call next to pass to the next middleware
    });

    it('should log request end on res finish event with status code and duration', () => {
      requestTracker(mockReq, mockRes, mockNext);
      mockReq.startTime = Date.now() - 100; // Simulate 100ms duration
      mockRes.statusCode = 200;
      mockRes.get.mockReturnValue('1234'); // Simulate Content-Length

      // Manually trigger finish callback if it was registered
      if (mockRes._finishCallback) mockRes._finishCallback();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp('Request End: GET /test - Status: 200 - Duration: \\d+ms - Size: 1234 B'))
      );
    });

    it('should log request end on res close event if finish was not called (e.g. aborted)', () => {
      requestTracker(mockReq, mockRes, mockNext);
      mockReq.startTime = Date.now() - 150;
      mockRes.statusCode = 500; // Simulate an error status before close
      
      // Manually trigger close callback
      if (mockRes._closeCallback) mockRes._closeCallback();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp('Request End: GET /test - Status: 500 - Duration: \\d+ms - Client Closed'))
      );
      // Ensure finish was not called to trigger this path
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Size:'));
    });

    it('should log slow requests', () => {
      requestTracker(mockReq, mockRes, mockNext);
      // Simulate a slow request, e.g., 3500ms. SLOW_REQUEST_THRESHOLD is 3000ms in errorHandler.js
      mockReq.startTime = Date.now() - 3500;
      mockRes.statusCode = 200;

      if (mockRes._finishCallback) mockRes._finishCallback();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp('SLOW REQUEST: GET /test - Status: 200 - Duration: 3\\d{3}ms'))
      );
    });
  });

  describe('errorHandler', () => {
    beforeEach(() => {
      // Set NODE_ENV for consistent testing behavior
      process.env.NODE_ENV_TEST_TEMP = process.env.NODE_ENV;
    });

    afterEach(() => {
      // Restore NODE_ENV
      process.env.NODE_ENV = process.env.NODE_ENV_TEST_TEMP;
      delete process.env.NODE_ENV_TEST_TEMP;
    });

    // Test for AppError instances
    it('should send operational AppError details in any environment', () => {
      const err = new BadRequestError('Test operational error');
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Test operational error',
        code: 'BadRequestError',
        requestId: 'test-request-id' // Assuming requestTracker ran before and set it
      });
      expect(logger.error).not.toHaveBeenCalled(); // Operational errors are not logged as critical by default
    });

    it('should send generic message for non-operational AppError in production', () => {
      process.env.NODE_ENV = 'production';
      // Simulate a non-operational AppError (though most AppErrors are operational by default)
      const err = new AppError('Sensitive details', 500, 'SomeInternalCode', false);
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Something went very wrong!',
        code: 'InternalServerError',
        requestId: 'test-request-id'
      });
      expect(logger.error).toHaveBeenCalled(); // Non-operational are logged
    });

    it('should send detailed message for non-operational AppError in development', () => {
      process.env.NODE_ENV = 'development';
      const err = new AppError('Dev details', 500, 'DevCode', false);
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Dev details',
        code: 'DevCode',
        requestId: 'test-request-id',
        stack: expect.any(String)
      });
      expect(logger.error).toHaveBeenCalled();
    });

    // Test for Mongoose specific errors
    it('should handle Mongoose CastError as BadRequestError', () => {
      const err = new mongoose.Error.CastError('ObjectId', 'invalidId', 'testPath');
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid ID format for path testPath: invalidId.',
        code: 'CastError'
      }));
    });

    it('should handle Mongoose ValidationError as BadRequestError', () => {
      const err = new mongoose.Error.ValidationError(null);
      err.errors = { field1: { message: 'Path `field1` is required.' } };
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Validation Error: Path `field1` is required.',
        code: 'ValidationError'
      }));
    });

    it('should handle Mongoose DuplicateKeyError (code 11000) as ConflictError', () => {
      const err = new Error('Duplicate key');
      err.code = 11000;
      err.keyValue = { email: 'test@example.com' };
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Duplicate field value: test@example.com. Please use another value!',
        code: 'DuplicateKeyError'
      }));
    });

    // Test for JWT errors
    it('should handle JsonWebTokenError as UnauthorizedError', () => {
      const err = new jwt.JsonWebTokenError('invalid signature');
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid token. Please log in again.', // or err.message if preferred by implementation
        code: 'JsonWebTokenError'
      }));
    });

    it('should handle TokenExpiredError as UnauthorizedError', () => {
      const err = new jwt.TokenExpiredError('jwt expired', new Date());
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Your token has expired. Please log in again.', // or err.message
        code: 'TokenExpiredError'
      }));
    });
    
    // Test for generic errors
    it('should handle generic Error in development with full details', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Generic test error');
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Generic test error',
        code: 'Error', // Name of the generic error constructor
        requestId: 'test-request-id',
        stack: expect.any(String)
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle generic Error in production with generic message', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Generic test error with sensitive details');
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Something went very wrong!',
        code: 'InternalServerError', // Default for unknown errors in prod
        requestId: 'test-request-id'
      });
      expect(logger.error).toHaveBeenCalled();
    });

     it('should use err.statusCode and err.status if present on a generic error', () => {
      process.env.NODE_ENV = 'development'; // To see more details
      const err = new Error('Custom status error');
      err.statusCode = 418; // I'm a teapot
      err.status = 'fail'; // Custom status
      
      errorHandler(err, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(418);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'fail',
        message: 'Custom status error',
        code: 'Error' // Still uses the error name as code if not AppError
      }));
    });
  });

  describe('catchAsync', () => {
    it('should call the async function and pass its resolution to next() (if any, usually not for middleware)', async () => {
      const asyncFn = jest.fn().mockResolvedValue('done');
      const wrappedFn = catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      // For typical async middleware, resolution doesn't call next directly unless designed to do so.
      // catchAsync is primarily for error catching. If asyncFn resolves, next shouldn't be called by catchAsync itself.
      // If the asyncFn itself calls next, that's fine.
      // This test primarily checks that the function is called.
    });

    it('should catch errors from the async function and pass them to next()', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
}); 