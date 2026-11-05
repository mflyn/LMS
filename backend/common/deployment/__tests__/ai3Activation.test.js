const { validateAi3Environment } = require('../../services/ai3Activation');
const token = 'synthetic-ai3-evidence-isolated-token-32-plus';
const config = () => ({ AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true',
  COMPLETION_PROTOCOL_MODE: 'enabled', AI3_EVIDENCE_TOKEN: token });
test('AI3 defaults off and isolated without provider configuration', () => {
  expect(typeof validateAi3Environment).toBe('function');
  expect(validateAi3Environment({})).toEqual({ mode: 'off', continuousStore: false });
});
test.each(['', true, 'ENABLED', 'query-only'])('AI3 mode %p fails closed', mode => {
  expect(typeof validateAi3Environment).toBe('function');
  expect(() => validateAi3Environment({ ...config(), AI3_MODE: mode })).toThrow('AI3_CONFIGURATION_REQUIRED');
});
test.each([{ AI3_STORE_CONTINUOUS: undefined }, { AI3_STORE_CONTINUOUS: true }, { AI2_STORE_CONTINUOUS: 'false' },
  { COMPLETION_PROTOCOL_MODE: 'legacy' }, { COMPLETION_PROTOCOL_MODE: 'maintenance' }, { AI3_EVIDENCE_TOKEN: 'short' }])(
  'AI3 rejects missing independent prerequisites %#', delta => {
    expect(typeof validateAi3Environment).toBe('function');
    expect(() => validateAi3Environment({ ...config(), ...delta })).toThrow('AI3_CONFIGURATION_REQUIRED');
  });
test.each(['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN', 'MEDIA_REFERENCE_SERVICE_TOKEN',
  'MEDIA_SIGNING_SECRET', 'COMPLETION_RETIREMENT_SERVICE_TOKEN', 'AI1_OPERATION_TOKEN', 'AI3_OPERATION_TOKEN'])(
  'dedicated evidence credential cannot reuse %s', key => {
    expect(typeof validateAi3Environment).toBe('function');
    expect(() => validateAi3Environment({ ...config(), [key]: token })).toThrow('AI3_CONFIGURATION_REQUIRED');
  });
test('off plus continuity permits retained data without AI1 model profiles or AI2 new writes', () => {
  expect(typeof validateAi3Environment).toBe('function');
  expect(validateAi3Environment({ ...config(), AI3_MODE: 'off', AI2_MODE: 'off', AI1_MODE: 'off' }))
    .toEqual({ mode: 'off', continuousStore: true });
});
