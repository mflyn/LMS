const MEDIA_ID = '6656875da7f86a0012c2a111';
let redactionModule;

const loadModule = () => {
  redactionModule = redactionModule || require('../logRedaction');
  return redactionModule;
};

describe('log URL redaction', () => {
  test('TC-T6-MEDIA-015 removes the complete query from signed content URLs', () => {
    const { redactUrlForLogs } = loadModule();
    const value = `/api/media/${MEDIA_ID}/content?expires=1&nonce=secret-nonce&signature=secret-signature`;

    expect(redactUrlForLogs(value)).toBe(`/api/media/${MEDIA_ID}/content`);
  });

  test('redacts sensitive values while preserving safe query context', () => {
    const { redactUrlForLogs } = loadModule();

    expect(redactUrlForLogs('/api/example?page=2&token=abc&signature=def&Credential=ghi'))
      .toBe('/api/example?page=2&token=%5BREDACTED%5D&signature=%5BREDACTED%5D&Credential=%5BREDACTED%5D');
  });

  test('keeps ordinary paths and safe query values', () => {
    const { redactUrlForLogs } = loadModule();

    expect(redactUrlForLogs('/api/media/abc/access')).toBe('/api/media/abc/access');
    expect(redactUrlForLogs('/api/items?page=2&dimension=physical'))
      .toBe('/api/items?page=2&dimension=physical');
  });

  test('falls back to a query-free path for malformed input', () => {
    const { redactUrlForLogs } = loadModule();

    expect(redactUrlForLogs('/bad/%zz?signature=secret')).toBe('/bad/%zz');
    expect(redactUrlForLogs(undefined)).toBe('/');
  });
});
