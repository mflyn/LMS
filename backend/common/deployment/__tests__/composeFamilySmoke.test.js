const { runFamilySmoke } = require('../../../../scripts/compose-family-smoke');

const jsonResponse = (status, data) => new Response(JSON.stringify({
  success: status >= 200 && status < 300,
  data
}), {
  status,
  headers: { 'content-type': 'application/json' }
});

describe('Compose family media smoke flow', () => {
  test('uses only public gateway APIs and verifies uploaded media content', async () => {
    const responses = [
      jsonResponse(201, { token: 'parent-token' }),
      jsonResponse(201, { family: { familyId: 'family-a' } }),
      jsonResponse(201, { child: { childId: 'child-a' } }),
      jsonResponse(201, { media: { mediaId: 'media-a' } }),
      jsonResponse(201, {
        task: { taskId: 'task-a', attachmentMediaIds: ['media-a'] }
      }),
      jsonResponse(200, {
        access: { url: '/api/media/media-a/content?expires=1&nonce=n&signature=s' }
      }),
      new Response(Buffer.from('verified-image'), {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
    ];
    const fetchImpl = jest.fn(async () => responses.shift());

    const result = await runFamilySmoke({
      baseUrl: 'http://127.0.0.1:3999',
      fetchImpl,
      uniqueSuffix: 'unit-with-a-deliberately-long-unique-suffix'
    });

    expect(result).toEqual({
      familyId: 'family-a',
      childId: 'child-a',
      mediaId: 'media-a',
      taskId: 'task-a',
      mediaBytes: 14
    });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:3999/api/auth/register');
    const registrationPayload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(registrationPayload.username).toMatch(/^[a-zA-Z0-9_]{3,20}$/);
    expect(fetchImpl.mock.calls[3][1].body).toBeInstanceOf(FormData);
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual(expect.objectContaining({
      childId: 'child-a',
      attachmentMediaIds: ['media-a']
    }));
    expect(fetchImpl.mock.calls[6][0]).toContain('/api/media/media-a/content');
  });
});
