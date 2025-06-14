const jwt = require('jsonwebtoken');
const { generateToken, authenticateJWT, authenticateGateway, checkRole } = require('../auth');
// Corrected path for authConfig assuming __tests__ is a sibling to files it tests, and config is one level up from common
const authConfig = require('../../config/auth'); 
const { UnauthorizedError, ForbiddenError } = require('../errorTypes');

// Mocking jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Mocking config/auth.js
// This mock assumes authConfig directly exports jwtSecret and jwtExpiration
// If authConfig has a function like getConfig(), the mock needs to reflect that.
// Based on common/config/auth.js, it seems to be direct exports.
jest.mock('../../config/auth', () => ({
  jwtSecret: 'testsecret', // Provide a mock secret
  tokenExpiration: '1h',     // Provide a mock expiration
  refreshTokenExpiration: '7d', // Provide a mock refresh token expiration
}));


describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset mocks for each test
    mockReq = {
      headers: {},
      header: jest.fn(name => mockReq.headers[name.toLowerCase()]), // Express's req.header() is case-insensitive
      user: null, 
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {}, 
    };
    mockNext = jest.fn();

    // Clear mock history for the functions provided by the explicit mock
    if (jwt.sign && jwt.sign.mockClear) {
        jwt.sign.mockClear();
    }
    if (jwt.verify && jwt.verify.mockClear) {
        jwt.verify.mockClear();
    }
    mockReq.header.mockClear();
  });

  describe('generateToken', () => {
    it('should generate a token with correct payload and default expiration from mocked authConfig', () => {
      const user = { _id: 'userId123', role: 'user', username: 'testuser' };
      const expectedToken = 'mockTokenString';
      jwt.sign.mockReturnValue(expectedToken); // Mock the return value of jwt.sign

      const token = generateToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'userId123', role: 'user', username: 'testuser' },
        'testsecret', // from mocked authConfig
        { expiresIn: '1h' } // from mocked authConfig
      );
      expect(token).toBe(expectedToken);
    });

    it('should use refresh token expiration when type is refresh', () => {
      const user = { _id: 'userId123', role: 'user', username: 'testuser' };
      jwt.sign.mockReturnValue('refreshToken');
      
      generateToken(user, 'refresh');
      
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'userId123', role: 'user', username: 'testuser' },
        'testsecret',
        { expiresIn: '7d' }  // refreshTokenExpiration from mocked config
      );
    });
  });

  describe('authenticateJWT', () => {
    it('should call next() and set req.user if token is valid', () => {
      mockReq.headers.authorization = 'Bearer validtokenstring';

      const decodedPayload = { id: 'userId123', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 3600 };
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, decodedPayload);
      });

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('validtokenstring', 'testsecret', expect.any(Function));
      expect(mockReq.user).toEqual(decodedPayload);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with UnauthorizedError if no token is provided (no Authorization header)', () => {
      // mockReq.headers.authorization is undefined by default

      authenticateJWT(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Access token is missing. Please include it in the Authorization header as a Bearer token.');
      expect(error.statusCode).toBe(401);
    });
    
    it('should call next with UnauthorizedError if token is malformed (not Bearer)', () => {
      mockReq.headers.authorization = 'invalidtokenstring'; // Token not in Bearer format

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Access token is missing. Please include it in the Authorization header as a Bearer token.');
      expect(error.statusCode).toBe(401);
    });

    it('should call next with ForbiddenError if jwt.verify throws an error', () => {
      mockReq.headers.authorization = 'Bearer expiredOrInvalidToken';
      jwt.verify.mockImplementation((token, secret, callback) => {
        // Simulate a JWT error, e.g., TokenExpiredError or JsonWebTokenError
        const err = new Error('jwt expired'); 
        err.name = 'TokenExpiredError'; 
        callback(err);
      });

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Invalid or expired token. Please log in again.');
      expect(error.statusCode).toBe(403);
      expect(mockReq.user).toBeNull();
    });
  });

  describe('authenticateGateway', () => {
    it('should call next() and set req.user if x-user-id and x-user-role headers are present', () => {
      mockReq.headers['x-user-id'] = 'gatewayUserId';
      mockReq.headers['x-user-role'] = 'admin';

      authenticateGateway(mockReq, mockRes, mockNext);
      
      expect(mockReq.user).toEqual({ id: 'gatewayUserId', role: 'admin' });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with UnauthorizedError if x-user-id header is missing', () => {
      mockReq.headers['x-user-role'] = 'admin';
      // x-user-id is missing
      
      authenticateGateway(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User identification headers (x-user-id, x-user-role) are missing or incomplete. Ensure API Gateway is configured correctly.');
      expect(error.statusCode).toBe(401);
    });

    it('should call next with UnauthorizedError if x-user-role header is missing', () => {
      mockReq.headers['x-user-id'] = 'gatewayUserId';
      // x-user-role is missing
      
      authenticateGateway(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User identification headers (x-user-id, x-user-role) are missing or incomplete. Ensure API Gateway is configured correctly.');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('checkRole', () => {
    it('should call next() if user has the required role (string)', () => {
      mockReq.user = { id: 'userId', role: 'admin' };
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next() if user has one of the required roles (array)', () => {
      mockReq.user = { id: 'userId', role: 'editor' }; // User has 'editor' role
      const middleware = checkRole(['admin', 'editor']); // Allowed roles
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with ForbiddenError if user does not have the required role (string)', () => {
      mockReq.user = { id: 'userId', role: 'user' };
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe("Access denied. Your role ('user') is not authorized for this resource. Required roles: admin.");
      expect(error.statusCode).toBe(403);
    });

    it('should call next with ForbiddenError if user does not have any of the required roles (array)', () => {
      mockReq.user = { id: 'userId', role: 'user' };
      const middleware = checkRole(['admin', 'editor']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe("Access denied. Your role ('user') is not authorized for this resource. Required roles: admin, editor.");
      expect(error.statusCode).toBe(403);
    });

    it('should call next with UnauthorizedError if req.user is not present', () => {
      mockReq.user = null; // req.user is not set
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User not authenticated or role information is missing. Ensure an authentication middleware (authenticateJWT or authenticateGateway) runs before checkRole.');
      expect(error.statusCode).toBe(401);
    });
    
    it('should call next with UnauthorizedError if req.user.role is not present', () => {
      mockReq.user = { id: 'userIdWithoutRole' }; // req.user is set, but req.user.role is undefined
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User not authenticated or role information is missing. Ensure an authentication middleware (authenticateJWT or authenticateGateway) runs before checkRole.');
      expect(error.statusCode).toBe(401);
    });
  });
}); 