process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
process.env.DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3002';
process.env.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005';

const mockUse = jest.fn();
const mockApp = { use: mockUse, get: jest.fn(), listen: jest.fn() };
jest.mock('../../common/createBaseApp', () => jest.fn(() => mockApp));
jest.mock(
  'express-http-proxy',
  () => jest.fn((target, options) => ({ target, options, proxy: true }))
);

describe('Task 7 gateway notification routes', () => {
  beforeAll(() => {
    require('../server');
  });

  test('TC-T7-GW-001 mounts authenticated family notification routes only', () => {
    for (const prefix of ['/api/notifications/family', '/api/notifications/settings']) {
      const registration = mockUse.mock.calls.find(([path]) => path === prefix);
      expect(registration).toBeDefined();
      expect(registration[1]).toEqual(expect.any(Function));
      expect(registration[2]).toEqual(expect.objectContaining({
        target: 'http://notification-service:3005',
        proxy: true
      }));
      expect(registration[2].options.proxyReqPathResolver({ url: '?childId=child-1' }))
        .toBe(`${prefix}?childId=child-1`);
    }
  });

  test('TC-T7-GW-001 does not expose legacy school notification routes for family MVP', () => {
    expect(mockUse.mock.calls.some(([path]) => path === '/api/notifications')).toBe(false);
  });
});
