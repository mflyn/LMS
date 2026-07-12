process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
process.env.DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3002';
process.env.RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL || 'http://resource-service:3005';
process.env.ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3006';

const mockUse = jest.fn();
const mockApp = { use: mockUse, get: jest.fn(), listen: jest.fn() };
jest.mock('../../common/createBaseApp', () => jest.fn(() => mockApp));
jest.mock(
  'express-http-proxy',
  () => jest.fn((target, options) => ({ target, options, proxy: true }))
);

describe('Task 6 gateway routes', () => {
  beforeAll(() => {
    require('../server');
  });

  test('TC-T6-GW-001 proxies Task 6 public family routes', () => {
    const expectations = [
      ['/api/media', 'http://resource-service:3005'],
      ['/api/mistakes', 'http://analytics-service:3006'],
      ['/api/reports/weekly', 'http://analytics-service:3006']
    ];

    for (const [prefix, target] of expectations) {
      const registration = mockUse.mock.calls.find(([path]) => path === prefix);
      expect(registration).toBeDefined();
      expect(registration[1]).toEqual(expect.any(Function));
      expect(registration[2]).toEqual(expect.objectContaining({ target, proxy: true }));
      expect(registration[2].options.proxyReqPathResolver({ url: '/probe?x=1' }))
        .toBe(`${prefix}/probe?x=1`);
    }
  });

  test('TC-T6-GW-002 does not expose internal media reference routes', () => {
    expect(mockUse.mock.calls.some(([path]) => typeof path === 'string'
      && (path === '/api/internal/media/references' || path.startsWith('/api/internal/media/references/'))))
      .toBe(false);
  });

  test('TC-T6-GW-003 proxies signed media content without requiring JWT', () => {
    const contentRegistrationIndex = mockUse.mock.calls.findIndex(([path]) => path === '/api/media/:mediaId/content');
    const mediaRegistrationIndex = mockUse.mock.calls.findIndex(([path]) => path === '/api/media');
    const contentRegistration = mockUse.mock.calls[contentRegistrationIndex];

    expect(contentRegistrationIndex).toBeGreaterThanOrEqual(0);
    expect(mediaRegistrationIndex).toBeGreaterThan(contentRegistrationIndex);
    expect(contentRegistration).toHaveLength(2);
    expect(contentRegistration[1]).toEqual(expect.objectContaining({
      target: 'http://resource-service:3005',
      proxy: true
    }));
    expect(contentRegistration[1].options.proxyReqPathResolver({
      originalUrl: '/api/media/6656875da7f86a0012c2a201/content?expires=1&nonce=n&signature=s',
      url: '?expires=1&nonce=n&signature=s',
      params: { mediaId: '6656875da7f86a0012c2a201' }
    })).toBe('/api/media/6656875da7f86a0012c2a201/content?expires=1&nonce=n&signature=s');
  });
});
