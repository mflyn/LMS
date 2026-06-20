const MEDIA_ID = '6656875da7f86a0012c2a111';
const OTHER_MEDIA_ID = '6656875da7f86a0012c2a222';
const NONCE = 'ddda6183-e6e1-47d8-a81d-2f9d834320d4';
const OTHER_NONCE = '70b71485-4e7f-49d8-80a1-d9378d6b4dcc';
const SECRET = 'test-media-signing-secret-at-least-32-characters';
const START_MS = Date.parse('2026-06-21T00:00:00.000Z');

let capabilityModule;

const loadModule = () => {
  capabilityModule = capabilityModule || require('../services/mediaCapability');
  return capabilityModule;
};

const parseCapability = (url) => {
  const parsed = new URL(url, 'http://local');
  return {
    path: parsed.pathname,
    mediaId: parsed.pathname.split('/')[3],
    expires: parsed.searchParams.get('expires'),
    nonce: parsed.searchParams.get('nonce'),
    signature: parsed.searchParams.get('signature')
  };
};

const createFixture = () => {
  let nowMs = START_MS;
  const service = loadModule().createMediaCapabilityService({
    secret: SECRET,
    maxAgeSeconds: 300,
    now: () => nowMs,
    randomUUID: () => NONCE
  });
  return { service, setNow: (value) => { nowMs = value; } };
};

describe('Task 6 signed media capabilities', () => {
  test('TC-T6-MEDIA-006 issues a capability valid for no more than 300 seconds', () => {
    const { service } = createFixture();

    const capability = service.issue(MEDIA_ID);
    const parsed = parseCapability(capability.url);

    expect(capability.expiresAt).toBe('2026-06-21T00:05:00.000Z');
    expect(parsed).toEqual(expect.objectContaining({
      path: `/api/media/${MEDIA_ID}/content`,
      mediaId: MEDIA_ID,
      expires: String(Math.floor(START_MS / 1000) + 300),
      nonce: NONCE,
      signature: expect.stringMatching(/^[a-f0-9]{64}$/)
    }));
    expect(service.verify(parsed)).toBe(true);
  });

  test.each(['path', 'mediaId', 'expires', 'nonce', 'signature'])(
    'TC-T6-MEDIA-007 rejects a tampered %s',
    (field) => {
      const { service } = createFixture();
      const parsed = parseCapability(service.issue(MEDIA_ID).url);
      const tampered = {
        path: `${parsed.path}-changed`,
        mediaId: OTHER_MEDIA_ID,
        expires: String(Number(parsed.expires) + 1),
        nonce: OTHER_NONCE,
        signature: `${parsed.signature[0] === 'a' ? 'b' : 'a'}${parsed.signature.slice(1)}`
      };

      expect(() => service.verify({ ...parsed, [field]: tampered[field] })).toThrow(
        expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' })
      );
    }
  );

  test('TC-T6-MEDIA-007 rejects expired and overlong capabilities', () => {
    const { service, setNow } = createFixture();
    const parsed = parseCapability(service.issue(MEDIA_ID).url);

    setNow(START_MS + 301_000);
    expect(() => service.verify(parsed)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));

    setNow(START_MS - 1_000);
    expect(() => service.verify(parsed)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  test.each([
    { mediaId: 'not-an-object-id' },
    { expires: 'not-a-number' },
    { nonce: 'not-a-uuid' },
    { signature: 'not-a-signature' },
    { path: '/api/media/wrong/content' }
  ])('rejects malformed capability input %#', (override) => {
    const { service } = createFixture();
    const parsed = parseCapability(service.issue(MEDIA_ID).url);

    expect(() => service.verify({ ...parsed, ...override })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' })
    );
  });

  test('rejects weak secrets, invalid max age, and malformed issue IDs', () => {
    const { createMediaCapabilityService } = loadModule();

    expect(() => createMediaCapabilityService({ secret: 'too-short' })).toThrow(/32/);
    expect(() => createMediaCapabilityService({ secret: SECRET, maxAgeSeconds: 0 })).toThrow(/1 and 300/);
    expect(() => createMediaCapabilityService({ secret: SECRET, maxAgeSeconds: 301 })).toThrow(/1 and 300/);
    expect(() => createMediaCapabilityService({ secret: SECRET }).issue('bad-id')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
  });
});
