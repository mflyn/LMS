const { createAi3SourceReader } = require('../../services/ai3SourceReader');
const id = c => c.repeat(24);
const scope = { familyId: id('a'), childId: id('b'), actorId: id('c') };
const source = { id: id('d'), familyId: scope.familyId, childId: scope.childId, subject: 'math', title: 'Synthetic' };
let legacy, evidence, reader;
beforeEach(() => {
  legacy = { require: jest.fn(async () => ({ ...source })) };
  evidence = { getContext: jest.fn(async () => ({ id: source.id, stateRevision: 0, knowledgePointId: null })) };
  reader = createAi3SourceReader({ sourceReader: legacy, mistakeEvidenceClient: evidence });
});
test.each([null, id('e')])('augments the unchanged legacy projection with the authorized original association %s', async knowledgePointId => {
  evidence.getContext.mockResolvedValue({ id: source.id, stateRevision: 3, knowledgePointId });
  const input = { ...scope, sourceMistakeId: source.id };
  expect(await reader.require(input)).toEqual({ ...source, knowledgePointId });
  expect(evidence.getContext).toHaveBeenCalledWith({ ...scope, targetId: source.id });
  expect(await legacy.require(input)).toEqual(source);
});
test('task reads do not invoke the mistake consumer', async () => {
  expect(await reader.require({ ...scope, sourceTaskId: source.id })).toEqual(source);
  expect(evidence.getContext).not.toHaveBeenCalled();
});
test.each([403, 404, 503])('does not replace a denied or failed context %i with null association', async statusCode => {
  const error = Object.assign(new Error('synthetic rejection'), { statusCode });
  evidence.getContext.mockRejectedValue(error);
  await expect(reader.require({ ...scope, sourceMistakeId: source.id })).rejects.toBe(error);
});
test('a rejected original source never reads the association', async () => {
  legacy.require.mockRejectedValue(new Error('source missing'));
  await expect(reader.require({ ...scope, sourceMistakeId: source.id })).rejects.toThrow('source missing');
  expect(evidence.getContext).not.toHaveBeenCalled();
});
test.each([{ id: id('f'), knowledgePointId: null }, { id: source.id }, { id: source.id, knowledgePointId: 'bad' }])(
  'rejects a missing or mismatched association response %#', async context => {
    evidence.getContext.mockResolvedValue(context);
    await expect(reader.require({ ...scope, sourceMistakeId: source.id })).rejects.toMatchObject({ code: 'SOURCE_SERVICE_UNAVAILABLE' });
  });

test.each(['sourceTaskId', 'sourceMistakeId'])('historical availability reads only the original scoped source: %s', async field => {
  const input = { ...scope, [field]: source.id };
  expect(await reader.availability(input)).toBe('available');
  expect(legacy.require).toHaveBeenCalledWith(input);
  expect(evidence.getContext).not.toHaveBeenCalled();
});
test.each([
  [404, 'RESOURCE_NOT_FOUND', 'missing'], [404, 'UNKNOWN_REMOTE_ERROR', 'unavailable'],
  [503, 'SOURCE_SERVICE_UNAVAILABLE', 'unavailable'], [403, 'UNKNOWN_REMOTE_ERROR', 'unavailable']
])('availability classifies only confirmed source absence: %s/%s', async (statusCode, code, expected) => {
  legacy.require.mockRejectedValue(Object.assign(new Error('private dependency detail'), { statusCode, code }));
  expect(await reader.availability({ ...scope, sourceMistakeId: source.id })).toBe(expected);
  expect(evidence.getContext).not.toHaveBeenCalled();
});
test('availability preserves a verified permission denial', async () => {
  const error = Object.assign(new Error('synthetic denied'), { statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  legacy.require.mockRejectedValue(error);
  await expect(reader.availability({ ...scope, sourceTaskId: source.id })).rejects.toBe(error);
});
test.each([null, { ...source, familyId: id('e') }, { ...source, childId: id('e') }, { ...source, id: id('e') }])(
  'availability does not mark malformed or mismatched sources as available %#', async value => {
    legacy.require.mockResolvedValue(value);
    expect(await reader.availability({ ...scope, sourceTaskId: source.id })).toBe('unavailable');
  });
