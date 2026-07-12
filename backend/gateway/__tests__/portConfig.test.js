describe('gateway port resolution', () => {
  test('prefers GATEWAY_PORT over PORT and configured port', () => {
    const { resolveGatewayPort } = require('../port');

    expect(resolveGatewayPort({
      env: { GATEWAY_PORT: '3000', PORT: '4000' },
      configPort: 5000
    })).toBe(3000);
  });

  test('falls back to PORT and then config port when explicit gateway port is absent', () => {
    const { resolveGatewayPort } = require('../port');

    expect(resolveGatewayPort({
      env: { PORT: '4000' },
      configPort: 5000
    })).toBe(4000);
    expect(resolveGatewayPort({
      env: {},
      configPort: 3000
    })).toBe(3000);
  });

  test('rejects missing or invalid port instead of silently using 5000', () => {
    const { resolveGatewayPort } = require('../port');

    expect(() => resolveGatewayPort({ env: {}, configPort: undefined }))
      .toThrow('Gateway port must be configured');
    expect(() => resolveGatewayPort({ env: { GATEWAY_PORT: 'abc' }, configPort: 3000 }))
      .toThrow('Gateway port must be a valid TCP port');
  });
});
