const { randomUUID } = require('crypto');
const C = require('../../services/ai3Contract');
const command = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
const content = () => ({ instructions: 'Write the steps.', exercises: [
  { exerciseId: 'q1', questionText: '132 * 24', answerForParent: '3168', rubricForParent: 'Check place value.' },
  { exerciseId: 'q2', questionText: '203 * 31', answerForParent: '6293', rubricForParent: 'Check the zero.' }
] });
const revision = () => ({ ...command(), expectedRoundVersion: 1, expectedContentId: null,
  expectedContentVersion: null, expectedContentHash: null, content: content(), reason: 'Initial' });

test('normalization preserves spaces, normalizes CRLF and hashes method/path/body', () => {
  const body = revision(); body.reason = ' Keep\r\nspaces ';
  const value = C.normalize('revise_content', body);
  expect(value.reason).toBe(' Keep\nspaces '); expect(body.reason).toBe(' Keep\r\nspaces ');
  expect(C.requestHash('revise_content', '/a', value)).not.toBe(C.requestHash('revise_content', '/b', value));
  expect(C.requestHash('revise_content', '/a', value)).not.toBe(C.requestHash('revise_content', '/a', { ...value, reason: 'Other' }));
});
test('two/three questions and child projection keep private answers off the wire', () => {
  const two = C.normalize('revise_content', revision()).content;
  expect(C.childSnapshot(two)).toEqual({ instructions: 'Write the steps.', exercises: [
    { exerciseId: 'q1', questionText: '132 * 24' }, { exerciseId: 'q2', questionText: '203 * 31' }
  ] });
  const b = revision(); b.content.exercises.push({ ...b.content.exercises[0], exerciseId: 'q3' });
  expect(C.normalize('revise_content', b).content.exercises).toHaveLength(3);
});
test.each(['count', 'duplicate', 'reordered', 'hole', 'html', 'url', 'empty', 'extra', 'unicode', 'mixedNull'])('invalid %s is rejected', kind => {
  const b = revision(); const q = b.content.exercises;
  if (kind === 'count') q.pop();
  if (kind === 'duplicate') q[1].exerciseId = 'q1';
  if (kind === 'reordered') q.reverse();
  if (kind === 'hole') delete q[0];
  if (kind === 'html') q[0].questionText = '<img src=x>';
  if (kind === 'url') q[0].answerForParent = 'https://example.test/answer';
  if (kind === 'empty') q[0].rubricForParent = '  ';
  if (kind === 'extra') b.childId = 'a'.repeat(24);
  if (kind === 'unicode') q[0].questionText = '\ud800';
  if (kind === 'mixedNull') b.expectedContentVersion = 1;
  expect(() => C.normalize('revise_content', b)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
});
test('code point and raw byte limits are independently enforced', () => {
  const b = revision(); b.content.exercises[0].questionText = 'x'.repeat(1001);
  expect(() => C.normalize('revise_content', b)).toThrow();
  b.content.exercises[0].questionText = '\u{1f600}'.repeat(1000);
  expect(C.normalize('revise_content', b).content.exercises[0].questionText).toBe(b.content.exercises[0].questionText);
  expect(() => C.parseRaw(Buffer.from(' '.repeat(32769)))).toThrow(expect.objectContaining({ statusCode: 413 }));
  expect(() => C.parseRaw(Buffer.from([0xc3, 0x28]))).toThrow(expect.objectContaining({ statusCode: 400 }));
  expect(C.parseRaw(Buffer.from(JSON.stringify(revision()))).schemaVersion).toBe('ai3-min-v1');
});
test('unimplemented actions fail closed rather than accepting generic payloads', () => {
  for (const action of ['generate', 'submit', 'review']) expect(() => C.normalize(action, command())).toThrow();
});
test.each(['data:text/plain,answer', 'javascript:alert(1)', '//example.test/a', 'mailto:a@example.test'])('non-http link %s cannot enter child content', value => {
  const b = revision(); b.content.exercises[0].questionText = value;
  expect(() => C.normalize('revise_content', b)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
});
