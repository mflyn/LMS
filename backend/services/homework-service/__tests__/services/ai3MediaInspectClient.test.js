const { createAi3MediaInspectClient } = require('../../services/ai3MediaInspectClient');
const { createAi2MediaInspectClient } = require('../../services/ai2MediaInspectClient');
const id = n => n.toString(16).padStart(24, '0');
const token = 'synthetic-ai3-inspect-service-credential';
const config = { resourceServiceUrl: 'http://127.0.0.1:3005', serviceToken: token };
const input = () => ({ familyId: id(1), childId: id(2), identity: { id: id(2), role: 'student',
  familyId: id(1), childId: id(2), tokenVersion: 0, privateName: 'DO_NOT_SEND' }, mediaIds: [id(3)],
bindings: [{ mediaId: id(3), resourceType: 'ai3_attempt', resourceId: id(4), field: 'practiceMediaIds',
  bindingOperationId: '11111111-1111-4111-8111-111111111111' }] });
const items = () => [{ mediaId: id(3), mimeType: 'image/png', sizeBytes: 12, status: 'deleted' }];
const response = value => ({ status: 200, data: { success: true, data: { items: value } } });

test('closed AI3 profile reuses strict descriptor parser, strips identity extras, and does not widen AI2', async () => {
  const transport = { post: jest.fn().mockResolvedValue(response(items())) };
  const client = createAi3MediaInspectClient({ ...config, axiosInstance: transport });
  expect(await client.inspect(input())).toEqual(items());
  const [url, body, options] = transport.post.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:3005/api/internal/media/ai3/inspect');
  expect(body.identity).toEqual({ id: id(2), role: 'student', familyId: id(1), childId: id(2), tokenVersion: 0 });
  expect(options).toMatchObject({ maxRedirects: 0, maxBodyLength: 32768, maxContentLength: 32768 });
  transport.post.mockClear();
  await expect(createAi2MediaInspectClient({ ...config, axiosInstance: transport }).inspect(input()))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
  expect(transport.post).not.toHaveBeenCalled();
});
test.each(['ai2_attempt', 'growth_task', 'unknown'])('rejects %s type before HTTP', async resourceType => {
  const value = input(); value.bindings[0].resourceType = resourceType;
  const transport = { post: jest.fn() };
  await expect(createAi3MediaInspectClient({ ...config, axiosInstance: transport }).inspect(value))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
  expect(transport.post).not.toHaveBeenCalled();
});
test.each(['correctionMediaIds', 'completionMediaIds'])('rejects cross-field %s before HTTP', async field => {
  const value = input(); value.bindings[0].field = field;
  const transport = { post: jest.fn() };
  await expect(createAi3MediaInspectClient({ ...config, axiosInstance: transport }).inspect(value))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
  expect(transport.post).not.toHaveBeenCalled();
});
test.each([
  () => [], () => new Array(1), value => [...value, ...value],
  value => value.map(x => ({ ...x, mediaId: id(9) })),
  value => value.map(x => ({ ...x, mimeType: 'application/pdf' })),
  value => value.map(x => ({ ...x, status: 'missing' })),
  value => value.map(x => ({ ...x, url: 'PRIVATE_URL' })),
  value => value.map(x => ({ ...x, sizeBytes: 10485761 }))
])('malformed response %# cannot become a deleted placeholder', async change => {
  const transport = { post: jest.fn().mockResolvedValue(response(change(items()))) };
  await expect(createAi3MediaInspectClient({ ...config, axiosInstance: transport }).inspect(input()))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE', message: 'MEDIA_SERVICE_UNAVAILABLE', details: [] });
});
test.each([301, 403, 404, 503])('HTTP %s is not synthetic deletion success', async status => {
  const transport = { post: jest.fn().mockResolvedValue({ ...response(items()), status }) };
  await expect(createAi3MediaInspectClient({ ...config, axiosInstance: transport }).inspect(input()))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
});
