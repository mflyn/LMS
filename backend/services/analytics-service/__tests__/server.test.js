process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mockRouterFor = (path = '/student/:studentId') => {
  const router = require('express').Router();
  router.get(path, (req, res) => res.status(200).json({ success: true }));
  return router;
};

jest.mock('../routes/progress', () => mockRouterFor());
jest.mock('../routes/reports', () => mockRouterFor());
jest.mock('../routes/trends', () => mockRouterFor());
jest.mock('../routes/long-term-trends', () => mockRouterFor());
jest.mock('../routes/behavior', () => mockRouterFor());
jest.mock('../routes/performance', () => mockRouterFor());
jest.mock('../routes/integration', () => mockRouterFor('/integration'));

const request = require('supertest');
const app = require('../server');

describe('Analytics Service app contract', () => {
  test('returns health without starting the production listener', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'analytics-service' });
  });

  test('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/non-existent-route');

    expect(response.status).toBe(404);
  });

  test.each([
    '/api/analytics/progress/student/123',
    '/api/analytics/reports/student/123',
    '/api/analytics/trends/student/123',
    '/api/analytics/long-term-trends/student/123',
    '/api/analytics/behavior/student/123',
    '/api/analytics/performance/student/123'
  ])('mounts legacy analytics route %s', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(200);
  });
});
