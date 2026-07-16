process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
process.env.DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3002';

const mockUse = jest.fn();
const mockApp = { use: mockUse, get: jest.fn(), listen: jest.fn() };
jest.mock('../../common/createBaseApp', () => jest.fn(() => mockApp));
jest.mock(
  'express-http-proxy',
  () => jest.fn((target, options) => ({ target, options, proxy: true }))
);

describe('Task 12 gateway co-parent routes', () => {
  beforeEach(() => {
    jest.resetModules();
    require('../server');
  });

  test('TC-T12-GW-001 mounts authenticated parent invitation routes on user-service', () => {
    const registration = mockUse.mock.calls.find(([path]) => path === '/api/parent-invitations');

    expect(registration).toBeDefined();
    expect(registration[1]).toEqual(expect.any(Function));
    expect(registration[2]).toEqual(expect.objectContaining({
      target: 'http://user-service:3001',
      proxy: true
    }));
    expect(registration[2].options.proxyReqPathResolver({ url: '/preview' }))
      .toBe('/api/parent-invitations/preview');
  });
});
