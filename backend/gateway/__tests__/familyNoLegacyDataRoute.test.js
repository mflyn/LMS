process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
delete process.env.DATA_SERVICE_URL;

const mockUse = jest.fn();
const mockApp = { use: mockUse, get: jest.fn(), listen: jest.fn() };
jest.mock('../../common/createBaseApp', () => jest.fn(() => mockApp));
jest.mock(
  'express-http-proxy',
  () => jest.fn((target, options) => ({ target, options, proxy: true })),
  { virtual: true }
);

describe('family gateway legacy data route isolation', () => {
  beforeAll(() => {
    require('../server');
  });

  test('does not mount /api/data when DATA_SERVICE_URL is not explicitly configured', () => {
    expect(mockUse.mock.calls.some(([path]) => path === '/api/data')).toBe(false);
  });
});
