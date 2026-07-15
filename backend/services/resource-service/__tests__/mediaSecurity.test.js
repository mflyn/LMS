const { resolveMediaSecurity } = require('../config/mediaSecurity');

describe('private media security profile configuration', () => {
  test.each(['development', 'test'])(
    'TC-MPA-SCAN-001 defaults %s to trusted-local without scanner configuration',
    (nodeEnv) => {
      expect(resolveMediaSecurity({ NODE_ENV: nodeEnv })).toEqual({
        profile: 'trusted-local'
      });
    }
  );

  test('TC-MPA-SCAN-001 accepts an explicit trusted-local production profile', () => {
    expect(resolveMediaSecurity({
      NODE_ENV: 'production',
      MEDIA_SECURITY_PROFILE: 'trusted-local'
    })).toEqual({ profile: 'trusted-local' });
  });

  test.each([undefined, '', 'optional', 'secure']) (
    'TC-MPA-SCAN-001 rejects an absent or invalid production profile: %p',
    (profile) => {
      expect(() => resolveMediaSecurity({
        NODE_ENV: 'production',
        MEDIA_SECURITY_PROFILE: profile
      })).toThrow(/MEDIA_SECURITY_PROFILE/);
    }
  );

  test('TC-MPA-SCAN-006 resolves bounded secure-production scanner settings', () => {
    const resolved = resolveMediaSecurity({
      NODE_ENV: 'production',
      MEDIA_SECURITY_PROFILE: 'secure-production',
      CLAMAV_HOST: 'private-scanner',
      CLAMAV_PORT: '13310',
      CLAMAV_CONNECT_TIMEOUT_MS: '2500',
      CLAMAV_SCAN_TIMEOUT_MS: '45000'
    });

    expect(resolved).toEqual({
      profile: 'secure-production',
      scannerConfig: {
        host: 'private-scanner',
        port: 13310,
        connectTimeoutMs: 2500,
        scanTimeoutMs: 45000
      }
    });
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.scannerConfig)).toBe(true);
  });

  test('TC-MPA-SCAN-006 supplies approved scanner defaults', () => {
    expect(resolveMediaSecurity({
      NODE_ENV: 'production',
      MEDIA_SECURITY_PROFILE: 'secure-production'
    })).toEqual({
      profile: 'secure-production',
      scannerConfig: {
        host: 'clamav',
        port: 3310,
        connectTimeoutMs: 2000,
        scanTimeoutMs: 30000
      }
    });
  });

  test.each([
    ['CLAMAV_HOST', '   '],
    ['CLAMAV_PORT', '0'],
    ['CLAMAV_PORT', '65536'],
    ['CLAMAV_PORT', '3310.5'],
    ['CLAMAV_CONNECT_TIMEOUT_MS', '0'],
    ['CLAMAV_SCAN_TIMEOUT_MS', 'NaN']
  ])('TC-MPA-SCAN-006 rejects invalid %s', (name, value) => {
    expect(() => resolveMediaSecurity({
      NODE_ENV: 'production',
      MEDIA_SECURITY_PROFILE: 'secure-production',
      [name]: value
    })).toThrow(name);
  });
});
