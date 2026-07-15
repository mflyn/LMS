const { runSecurityScanSmoke } = require('../../../../scripts/compose-family-security-smoke');

const jsonResponse = (status, payload) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' }
});

describe('Compose secure media scanner smoke flow', () => {
  test('accepts and downloads a safe PDF, then requires stable malware rejection', async () => {
    const responses = [
      jsonResponse(201, { success: true, data: { token: 'parent-token' } }),
      jsonResponse(201, { success: true, data: { family: { familyId: 'family-a' } } }),
      jsonResponse(201, { success: true, data: { child: { childId: 'child-a' } } }),
      jsonResponse(201, { success: true, data: { media: { mediaId: 'media-safe' } } }),
      jsonResponse(201, {
        success: true,
        data: { task: { taskId: 'task-a', attachmentMediaIds: ['media-safe'] } }
      }),
      jsonResponse(200, {
        success: true,
        data: { access: { url: '/api/media/media-safe/content?expires=1&nonce=n&signature=s' } }
      }),
      new Response(Buffer.from('%PDF-1.7\nsafe'), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': "attachment; filename*=UTF-8''safe.pdf"
        }
      }),
      jsonResponse(422, {
        success: false,
        error: { code: 'MALWARE_DETECTED', message: 'rejected', details: [] }
      })
    ];
    const fetchImpl = jest.fn(async () => responses.shift());
    const emitted = [];

    const result = await runSecurityScanSmoke({
      baseUrl: 'http://127.0.0.1:3999',
      fetchImpl,
      output: (code) => emitted.push(code),
      uniqueSuffix: 'secure-smoke'
    });

    expect(result).toEqual({ safePdf: 'accepted', malware: 'rejected' });
    expect(emitted).toEqual([
      'SECURITY_SCAN_SAFE_PDF_OK',
      'SECURITY_SCAN_MALWARE_REJECTED'
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(8);
    expect(fetchImpl.mock.calls[3][1].body.get('file').type).toBe('application/pdf');
    expect(fetchImpl.mock.calls[7][1].body.get('file').type).toBe('application/pdf');
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual(expect.objectContaining({
      attachmentMediaIds: ['media-safe']
    }));
  });

  test('fails when the scanner returns any non-approved rejection envelope', async () => {
    const responses = [
      jsonResponse(201, { success: true, data: { token: 'parent-token' } }),
      jsonResponse(201, { success: true, data: { family: { familyId: 'family-a' } } }),
      jsonResponse(201, { success: true, data: { child: { childId: 'child-a' } } }),
      jsonResponse(201, { success: true, data: { media: { mediaId: 'media-safe' } } }),
      jsonResponse(201, {
        success: true,
        data: { task: { taskId: 'task-a', attachmentMediaIds: ['media-safe'] } }
      }),
      jsonResponse(200, {
        success: true,
        data: { access: { url: '/api/media/media-safe/content?expires=1&nonce=n&signature=s' } }
      }),
      new Response(Buffer.from('%PDF-1.7\nsafe'), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': "attachment; filename*=UTF-8''safe.pdf"
        }
      }),
      jsonResponse(400, {
        success: false,
        error: { code: 'MEDIA_TYPE_NOT_ALLOWED', message: 'wrong stage', details: [] }
      })
    ];

    await expect(runSecurityScanSmoke({
      baseUrl: 'http://127.0.0.1:3999',
      fetchImpl: jest.fn(async () => responses.shift()),
      output: () => undefined,
      uniqueSuffix: 'secure-failure'
    })).rejects.toMatchObject({ code: 'SECURITY_SCAN_MALWARE_ASSERTION_FAILED' });
  });
});
