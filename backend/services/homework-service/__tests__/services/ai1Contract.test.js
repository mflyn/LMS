const { normalize, costCeiling, subjectAlias, buildPreview, requestHash } = require('../../services/ai1Contract');
const { randomUUID } = require('crypto');
const common = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
const createBody = () => ({ ...common(), childId: 'a'.repeat(24), source: { type: 'task', id: 'b'.repeat(24) },
  input: { questionText: '124 * 23', answerText: null, parentContext: '' },
  chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
    textbookLabel: 'Synthetic textbook', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true });
const profile = () => ({ model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-model-1',
  pricingProfileVersion: 'synthetic-price-1', inputPriceMicrosPerMillion: 9000000,
  outputPriceMicrosPerMillion: 27000000, checkedAt: '2026-11-01T00:00:00.000Z',
  expiresAt: '2026-11-02T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000 });
test('AI1-BUDGET-01 exact integer ceiling, upward rounding and overflow refusal', () => {
  expect(costCeiling(8192, 4096, profile())).toBe(184320);
  expect(costCeiling(1, 1, { inputPriceMicrosPerMillion: 1, outputPriceMicrosPerMillion: 1 })).toBe(2);
  expect(() => costCeiling(8193, 0, profile())).toThrow();
  expect(() => costCeiling(8192, 4096, { ...profile(), inputPriceMicrosPerMillion: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
});
test.each(['math', ' Math ', '\u6570\u5b66'])('AI1-SCOPE-03 exact alias %s', value => expect(subjectAlias(value)).toBe('math'));
test.each(['mathematics', '\u6570\u5b66\u7ec3\u4e60', '\uff4d\uff41\uff54\uff48', '', null])('AI1-SCOPE-03 rejects %s', value => {
  expect(() => subjectAlias(value)).toThrow('AI_SOURCE_SUBJECT_UNSUPPORTED');
});
test('AI1-SCOPE-02 closed types, Unicode lengths, URLs and CRLF canonicalization', () => {
  const input = createBody(); input.input.questionText = 'a\r\nb';
  expect(normalize('create', input).input.questionText).toBe('a\nb');
  expect(input.input.questionText).toBe('a\r\nb');
  for (const bad of [{ ...input, actorId: 'x' }, { ...input, schemaVersion: 'v1' },
    { ...input, input: { ...input.input, questionText: 'https://example.test/private' } },
    { ...input, input: { ...input.input, questionText: '  ' } },
    { ...input, input: { ...input.input, questionText: 'x'.repeat(4001) } },
    { ...input, deidentifiedConfirmed: 'true' }]) expect(() => normalize('create', bad)).toThrow();
  expect(normalize('create', { ...input, input: { ...input.input, questionText: '\ud83d\ude00'.repeat(4000) } })).toBeDefined();
});
test('AI1-BUDGET-06 preview freezes exact two messages, no identity/title and all paid options', () => {
  const input = normalize('create', createBody()), preview = buildPreview(input, profile(), Date.parse('2026-11-01T01:00:00Z'));
  expect(preview.messages.map(x => x.role)).toEqual(['system', 'user']);
  expect(preview.requestOptions).toEqual({ model: 'synthetic-no-provider', maxInputTokens: 8192,
    maxOutputTokens: 4096, thinking: 'disabled', tools: [], attemptLimit: 1 });
  expect(JSON.stringify(preview.messages)).not.toContain(input.childId);
  expect(preview.sendNotAfter).toBe('2026-11-01T23:58:55.000Z');
  expect(() => buildPreview(input, profile(), Date.parse(preview.sendNotAfter))).toThrow('AI_PREVIEW_STALE');
  expect(() => buildPreview(input, null, Date.now())).toThrow('AI_PROFILE_UNAVAILABLE');
  expect(requestHash('create', '/api/tutor-cycles', input)).not.toBe(requestHash('create', '/other', input));
});
test('AI1-IDEM-01 frozen JCS command digest includes method, canonical path, version and all body fields', () => {
  const body = { schemaVersion: 'ai1-min-v1', operationId: '11111111-1111-4111-8111-111111111111', expectedCycleStateVersion: 1, reason: 'done' };
  const path = '/api/tutor-cycles/aaaaaaaaaaaaaaaaaaaaaaaa/cancel';
  expect(requestHash('close', path, body)).toBe('4abac56db9406a5a20a38675d74eda38d256139ce1e81cea32a839ff79e089c8');
  expect(requestHash('close', path, Object.fromEntries(Object.entries(body).reverse()))).toBe(requestHash('close', path, body));
  expect(requestHash('close', path, { ...body, reason: 'done ' })).not.toBe(requestHash('close', path, body));
});

test.each(['See //example.test/private.png', 'See https:example.test/private.png',
  'See data:text/plain,synthetic', 'mailto:parent@example.test', 'javascript:alert(1)',
  '\u56fe\u7247\uff1a//example.test/private.png', 'See [//example.test/private.png]'])
('AI1-SCOPE-02 review P2 rejects non-slash URL form: %s', text => {
  const b = createBody(); b.input.questionText = text;
  expect(() => normalize('create', b)).toThrow('VALIDATION_ERROR');
});
test.each(['124 * 23 = 2852', 'Ratio 2:3; x:y', 'Question: explain 206 * 30', 'Divide 124 / 2'])
('mathematical plain text remains valid: %s', text => {
  const b = createBody(); b.input.questionText = text;
  expect(normalize('create', b).input.questionText).toBe(text);
});
