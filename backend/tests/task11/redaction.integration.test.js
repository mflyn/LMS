const { redactRuntimeError } = require('./testEnvironment');

describe('Task 11 runtime redaction', () => {
  test('removes secrets, PINs, signed query values, and private paths', () => {
    const privateRoot = '/tmp/family-growth-task11-secret-root';
    const error = new Error(
      `Bearer child-token pin=2468 signature=signed-value ${process.env.JWT_SECRET} ${privateRoot}/photo.jpg`
    );

    const redacted = redactRuntimeError(error, { privateRoot });

    expect(redacted.message).toContain('[REDACTED]');
    expect(redacted.message).not.toContain('child-token');
    expect(redacted.message).not.toContain('2468');
    expect(redacted.message).not.toContain('signed-value');
    expect(redacted.message).not.toContain(process.env.JWT_SECRET);
    expect(redacted.message).not.toContain(privateRoot);
  });
});
