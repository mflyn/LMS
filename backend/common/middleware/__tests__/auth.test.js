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
  jwtExpiration: '1h',     // Provide a mock expiration
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
      const payload = { id: 'userId123', role: 'user' };
      const expectedToken = 'mockTokenString';
      jwt.sign.mockReturnValue(expectedToken); // Mock the return value of jwt.sign

      const token = generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'testsecret', // from mocked authConfig
        { expiresIn: '1h' } // from mocked authConfig
      );
      expect(token).toBe(expectedToken);
    });

    it('should use expiration from payload if provided, and this value is passed to jwt.sign options', () => {
      const payloadWithExpiresIn = { id: 'userId123', role: 'user', expiresIn: '2h' };
      // The actual payload for signing should be the original payload.
      // The expiresIn from the payload is used for the options.
      jwt.sign.mockReturnValue('customExpireToken');
      
      generateToken(payloadWithExpiresIn);
      
      // The first argument to jwt.sign should be the payload *without* our custom 'expiresIn' if we were cleaning it,
      // but auth.js's generateToken passes the payload as is.
      // The options object's expiresIn IS correctly taken from payload.expiresIn.
      expect(jwt.sign).toHaveBeenCalledWith(
        payloadWithExpiresIn, // current auth.js signs the payload as-is
        'testsecret',
        { expiresIn: '2h' }  // expiresIn from payload overrides config default
      );
    });
  });

  describe('authenticateJWT', () => {
    it('should call next() and set req.user if token is valid', () => {
      mockReq.headers.authorization = 'Bearer validtokenstring';
      // req.header('Authorization') should return 'Bearer validtokenstring'
      mockReq.header = jest.fn().mockReturnValue('Bearer validtokenstring');

      const decodedPayload = { id: 'userId123', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 3600 };
      jwt.verify.mockReturnValue(decodedPayload);

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.header).toHaveBeenCalledWith('Authorization');
      expect(jwt.verify).toHaveBeenCalledWith('validtokenstring', 'testsecret');
      expect(mockReq.user).toEqual(decodedPayload);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with UnauthorizedError if no token is provided (no Authorization header)', () => {
      mockReq.header = jest.fn().mockReturnValue(undefined); // Simulate no Authorization header

      authenticateJWT(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('No token provided.');
      expect(error.statusCode).toBe(401);
    });
    
    it('should call next with UnauthorizedError if token is malformed (not Bearer)', () => {
      mockReq.header = jest.fn().mockReturnValue('invalidtokenstring'); // Token not in Bearer format

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Token is not in Bearer format.');
      expect(error.statusCode).toBe(401);
    });

    it('should call next with UnauthorizedError if jwt.verify throws an error', () => {
      mockReq.header = jest.fn().mockReturnValue('Bearer expiredOrInvalidToken');
      jwt.verify.mockImplementation(() => { 
        // Simulate a JWT error, e.g., TokenExpiredError or JsonWebTokenError
        const err = new Error('jwt expired'); 
        err.name = 'TokenExpiredError'; 
        throw err; 
      });

      authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(mockReq.user).toBeNull();
    });
  });

  describe('authenticateGateway', () => {
    it('should call next() and set req.user if x-user-id and x-user-role headers are present', () => {
      // Simulate headers being present via req.header
      mockReq.header = jest.fn(name => {
        if (name.toLowerCase() === 'x-user-id') return 'gatewayUserId';
        if (name.toLowerCase() === 'x-user-role') return 'admin';
        return undefined;
      });

      authenticateGateway(mockReq, mockRes, mockNext);
      
      expect(mockReq.header).toHaveBeenCalledWith('x-user-id');
      expect(mockReq.header).toHaveBeenCalledWith('x-user-role');
      expect(mockReq.user).toEqual({ id: 'gatewayUserId', role: 'admin' });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with UnauthorizedError if x-user-id header is missing', () => {
      mockReq.header = jest.fn(name => {
        // if (name.toLowerCase() === 'x-user-id') return undefined; // Missing
        if (name.toLowerCase() === 'x-user-role') return 'admin';
        return undefined;
      });
      authenticateGateway(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User ID or role not provided by gateway.');
      expect(error.statusCode).toBe(401);
    });

    it('should call next with UnauthorizedError if x-user-role header is missing', () => {
       mockReq.header = jest.fn(name => {
        if (name.toLowerCase() === 'x-user-id') return 'gatewayUserId';
        // if (name.toLowerCase() === 'x-user-role') return undefined; // Missing
        return undefined;
      });
      authenticateGateway(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('User ID or role not provided by gateway.');
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
      expect(error.message).toBe('You do not have permission to perform this action.');
      expect(error.statusCode).toBe(403);
    });

    it('should call next with ForbiddenError if user does not have any of the required roles (array)', () => {
      mockReq.user = { id: 'userId', role: 'user' };
      const middleware = checkRole(['admin', 'editor']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('You do not have permission to perform this action.');
      expect(error.statusCode).toBe(403);
    });

    it('should call next with ForbiddenError if req.user is not present', () => {
      mockReq.user = null; // req.user is not set
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Access denied. User role not found.');
      expect(error.statusCode).toBe(403);
    });
    
    it('should call next with ForbiddenError if req.user.role is not present', () => {
      mockReq.user = { id: 'userIdWithoutRole' }; // req.user is set, but req.user.role is undefined
      const middleware = checkRole('admin');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Access denied. User role not found.');
      expect(error.statusCode).toBe(403);
    });
  });
}); 