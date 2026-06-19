process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
process.env.DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3002';
process.env.PROGRESS_SERVICE_URL = process.env.PROGRESS_SERVICE_URL || 'http://progress-service:3002';

const mockUse = jest.fn();
const mockApp = { use: mockUse, get: jest.fn(), listen: jest.fn() };
jest.mock('../../common/createBaseApp', () => jest.fn(() => mockApp));
jest.mock(
  'express-http-proxy',
  () => jest.fn((target, options) => ({ target, options, proxy: true })),
  { virtual: true }
);

describe('Task 5 gateway routes', () => {
  beforeAll(() => {
    require('../server');
  });

  test('TC-T5-GW-001 mounts authenticated public Task 5 progress routes', () => {
    for (const prefix of ['/api/growth-logs', '/api/knowledge-points', '/api/rewards']) {
      const registration = mockUse.mock.calls.find(([path]) => path === prefix);
      expect(registration).toBeDefined();
      expect(registration[1]).toEqual(expect.any(Function));
      expect(registration[2]).toEqual(expect.objectContaining({
        target: 'http://progress-service:3002',
        proxy: true
      }));
      expect(registration[2].options.proxyReqPathResolver({ url: '/sample?x=1' }))
        .toBe(`${prefix}/sample?x=1`);
    }
  });

  test('uses the standard deployment port', () => {
    expect(require('../server').port).toBe(3000);
  });

  test('TC-T5-GW-002 does not expose internal progress commands', () => {
    expect(mockUse.mock.calls.some(([path]) => typeof path === 'string'
      && (path === '/api/internal' || path.startsWith('/api/internal/')))).toBe(false);
  });
});
