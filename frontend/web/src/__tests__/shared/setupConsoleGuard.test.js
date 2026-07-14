describe('frontend test console guard', () => {
  test('fails immediately on an unexpected console.error', () => {
    expect(() => console.error('unexpected-test-error')).toThrow(
      /Unexpected console\.error: unexpected-test-error/
    );
  });

  test('fails immediately on an unexpected console.warn', () => {
    expect(() => console.warn('unexpected-test-warning')).toThrow(
      /Unexpected console\.warn: unexpected-test-warning/
    );
  });
});
