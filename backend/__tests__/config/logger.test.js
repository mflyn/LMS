const { performanceLogger, errorLogger } = require('../../common/config/logger');

describe('Logging Middlewares', () => {
  let req, res, next;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    req = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      app: {
        locals: {
          logger: mockLogger,
        },
      },
    };
    res = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
      statusCode: 200,
    };
    next = jest.fn();
  });

  describe('performanceLogger', () => {
    it('should call the logger from app.locals on request finish', () => {
      performanceLogger(req, res, next);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(mockLogger.log).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should fall back to console.log if no logger is on app.locals', () => {
      req.app.locals.logger = undefined;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      performanceLogger(req, res, next);
      
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('errorLogger', () => {
    const err = new Error('Test error');

    it('should call the error logger from app.locals', () => {
      errorLogger(err, req, res, next);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error',
      }));
      expect(next).toHaveBeenCalledWith(err);
    });

    it('should fall back to console.error if no logger is on app.locals', () => {
      req.app.locals.logger = undefined;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      errorLogger(err, req, res, next);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(err);

      consoleSpy.mockRestore();
    });
  });
});
