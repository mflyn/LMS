const {
  createMediaReferenceClient,
  validateMediaReferenceClientConfig
} = require('../mediaReferenceClient');

const SERVICE_TOKEN = 'test-media-reference-client-token-32-characters';
const MEDIA_ID = '6656875da7f86a0012c2a601';
const COMMAND = Object.freeze({
  familyId: '6656875da7f86a0012c2a101',
  childId: '6656875da7f86a0012c2a301',
  resourceType: 'family_mistake',
  resourceId: '6656875da7f86a0012c2a501',
  operationId: '5dc38fc9-ee29-4dba-9181-df49f66b9050',
  references: [{ mediaId: MEDIA_ID, field: 'questionMediaId' }]
});
const REFERENCE_RESULT = Object.freeze({
  mediaId: MEDIA_ID,
  field: 'questionMediaId',
  state: 'prepared',
  leaseExpiresAt: '2026-06-21T00:15:00.000Z'
});

const successResponse = (reference = REFERENCE_RESULT) => ({
  data: {
    success: true,
    data: { references: [reference] }
  }
});

const createFixture = (overrides = {}) => {
  const axiosInstance = {
    post: jest.fn().mockResolvedValue(successResponse())
  };
  const options = {
    axiosInstance,
    resourceServiceUrl: 'http://resource-service:3005/',
    serviceToken: SERVICE_TOKEN,
    timeout: 2500,
    ...overrides
  };
  return {
    axiosInstance,
    client: createMediaReferenceClient(options),
    options
  };
};

describe('media reference client configuration', () => {
  test.each([
    [{ resourceServiceUrl: '' }, 'RESOURCE_SERVICE_URL'],
    [{ resourceServiceUrl: '   ' }, 'RESOURCE_SERVICE_URL'],
    [{ serviceToken: 'short' }, 'MEDIA_REFERENCE_SERVICE_TOKEN'],
    [{ timeout: 0 }, 'MEDIA_REFERENCE_TIMEOUT_MS'],
    [{ timeout: 2.5 }, 'MEDIA_REFERENCE_TIMEOUT_MS']
  ])('TC-T6-MEDIA-016A rejects invalid configuration %j', (override, message) => {
    const axiosInstance = { post: jest.fn() };
    const options = {
      axiosInstance,
      resourceServiceUrl: 'http://resource-service:3005',
      serviceToken: SERVICE_TOKEN,
      timeout: 2500,
      ...override
    };

    expect(() => validateMediaReferenceClientConfig(options)).toThrow(message);
    expect(() => createMediaReferenceClient(options)).toThrow(message);
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });
});

describe('media reference client requests', () => {
  test.each(['prepare', 'commit', 'unbind'])(
    'TC-T6-MEDIA-016A sends exact %s request and returns references',
    async (action) => {
      const { axiosInstance, client } = createFixture();
      const command = action === 'unbind'
        ? {
          ...COMMAND,
          references: COMMAND.references.map((reference) => ({
            ...reference,
            bindingOperationId: COMMAND.operationId
          }))
        }
        : COMMAND;

      await expect(client[action](command)).resolves.toEqual([REFERENCE_RESULT]);
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
      expect(axiosInstance.post).toHaveBeenCalledWith(
        `http://resource-service:3005/api/internal/media/references/${action}`,
        command,
        {
          headers: { 'x-service-token': SERVICE_TOKEN },
          timeout: 2500
        }
      );
    }
  );
});

describe('media reference client error contract', () => {
  test.each([
    [400, 'MEDIA_PURPOSE_MISMATCH', 'Media purpose does not match field'],
    [403, 'CHILD_ACCESS_DENIED', 'Media scope does not match'],
    [404, 'RESOURCE_NOT_FOUND', 'Media reference resource not found'],
    [409, 'RESOURCE_CONFLICT', 'Media reference operation conflicts']
  ])(
    'TC-T6-MEDIA-016B preserves sanitized %i remote errors',
    async (status, code, message) => {
      const details = [{ field: 'references', issue: 'invalid' }];
      const axiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status,
            data: { success: false, error: { code, message, details } }
          },
          config: { headers: { 'x-service-token': SERVICE_TOKEN } }
        })
      };
      const { client } = createFixture({ axiosInstance });

      const error = await client.prepare(COMMAND).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ status, code, message, details });
      expect(Object.keys(error).sort()).toEqual(['code', 'details', 'status']);
      expect(JSON.stringify(error)).not.toContain(SERVICE_TOKEN);
    }
  );

  test.each([
    ['network failure', () => Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' })],
    ['remote 500', () => ({ response: { status: 500, data: { error: { code: 'INTERNAL_ERROR' } } } })],
    ['remote 503', () => ({ response: { status: 503, data: { error: { code: 'SERVICE_UNAVAILABLE' } } } })]
  ])('TC-T6-MEDIA-016C converts %s to pending', async (label, errorFactory) => {
    const axiosInstance = { post: jest.fn().mockRejectedValue(errorFactory()) };
    const { client } = createFixture({ axiosInstance });

    await expect(client.commit(COMMAND)).rejects.toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      message: 'Media reference operation is pending',
      details: []
    });
  });

  test.each([
    ['non-success envelope', { data: { success: false, data: { references: [] } } }],
    ['missing references', { data: { success: true, data: {} } }],
    ['invalid mediaId', successResponse({ ...REFERENCE_RESULT, mediaId: 'not-an-object-id' })],
    ['invalid field', successResponse({ ...REFERENCE_RESULT, field: 'storageKey' })],
    ['invalid state', successResponse({ ...REFERENCE_RESULT, state: 'active' })],
    ['invalid timestamp', successResponse({ ...REFERENCE_RESULT, leaseExpiresAt: 'not-a-date' })],
    ['unexpected field', successResponse({ ...REFERENCE_RESULT, storageKey: 'private/object-key' })]
  ])('TC-T6-MEDIA-016C rejects %s as pending', async (label, response) => {
    const axiosInstance = { post: jest.fn().mockResolvedValue(response) };
    const { client } = createFixture({ axiosInstance });

    await expect(client.prepare(COMMAND)).rejects.toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      message: 'Media reference operation is pending',
      details: []
    });
  });

  test('TC-T6-MEDIA-016C does not expose credential-bearing Axios errors', async () => {
    const configMarker = 'full-private-axios-config';
    const transportError = Object.assign(
      new Error(`timeout using ${SERVICE_TOKEN}`),
      {
        config: {
          marker: configMarker,
          headers: { 'x-service-token': SERVICE_TOKEN }
        },
        request: { url: `http://resource-service/private?${SERVICE_TOKEN}` }
      }
    );
    const axiosInstance = { post: jest.fn().mockRejectedValue(transportError) };
    const { client } = createFixture({ axiosInstance });

    const error = await client.unbind(COMMAND).catch((caught) => caught);
    const exposed = `${error.message} ${JSON.stringify(error)}`;

    expect(error).toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      details: []
    });
    expect(Object.keys(error).sort()).toEqual(['code', 'details', 'status']);
    expect(exposed).not.toContain(SERVICE_TOKEN);
    expect(exposed).not.toContain(configMarker);
    expect(exposed).not.toContain('resource-service/private');
  });

  test('TC-T6-MEDIA-016C does not preserve a credential-bearing remote envelope', async () => {
    const axiosInstance = {
      post: jest.fn().mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: `invalid request for ${SERVICE_TOKEN}`,
              details: [{ suppliedCredential: SERVICE_TOKEN }]
            }
          }
        }
      })
    };
    const { client } = createFixture({ axiosInstance });

    const error = await client.prepare(COMMAND).catch((caught) => caught);
    const exposed = `${error.message} ${JSON.stringify(error)}`;

    expect(error).toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      details: []
    });
    expect(exposed).not.toContain(SERVICE_TOKEN);
  });
});
