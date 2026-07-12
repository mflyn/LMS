describe('Task 5 star award client', () => {
  test('TC-T5-STAR-002 validates configuration before making a request', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = { post: jest.fn() };

    for (const internalServiceToken of ['', 'short']) {
      expect(() => createStarAwardClient({
        axiosInstance,
        progressServiceUrl: 'http://progress-service:3003',
        internalServiceToken
      })).toThrow('INTERNAL_SERVICE_TOKEN');
    }
    expect(() => createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3002',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      timeout: 0
    })).toThrow('STAR_AWARD_TIMEOUT_MS');
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  test('TC-T5-STAR-002 sends the exact internal command with bounded timeout', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn().mockResolvedValue({
        data: { success: true, data: { awarded: true, ledgerEntryId: 'ledger-1', starBalance: 1 } }
      })
    };
    const token = 'test-internal-service-token-32-bytes';
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003/',
      internalServiceToken: token
    });
    const payload = {
      familyId: '507f1f77bcf86cd799439011',
      childId: '507f1f77bcf86cd799439012',
      taskId: '507f1f77bcf86cd799439013',
      confirmedByParentId: '507f1f77bcf86cd799439014'
    };

    await expect(client.awardTaskStar(payload)).resolves.toEqual({
      awarded: true,
      ledgerEntryId: 'ledger-1',
      starBalance: 1
    });
    expect(axiosInstance.post).toHaveBeenCalledWith(
      'http://progress-service:3003/api/internal/stars/award',
      payload,
      { headers: { 'x-service-token': token }, timeout: 3000 }
    );
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });

  test('TC-T5-STAR-002 maps outbound failures to a pending award error', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const client = createStarAwardClient({
      axiosInstance: { post: jest.fn().mockRejectedValue(new Error('timeout')) },
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes'
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
  });

  test('TC-T5-STAR-002 retries transient outbound failures with bounded backoff', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('temporary outage'), { code: 'ECONNRESET' }))
        .mockResolvedValueOnce({
          data: { success: true, data: { awarded: false, ledgerEntryId: 'ledger-retry', starBalance: 2 } }
        })
    };
    const sleep = jest.fn().mockResolvedValue();
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      retryAttempts: 1,
      retryBackoffMs: 250,
      maxRetryBackoffMs: 250,
      sleep
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).resolves.toEqual({
      awarded: false,
      ledgerEntryId: 'ledger-retry',
      starBalance: 2
    });
    expect(axiosInstance.post).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  test('TC-T5-STAR-002 does not retry malformed success responses', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn().mockResolvedValue({ data: { success: true, data: {} } })
    };
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      retryAttempts: 2,
      sleep: jest.fn().mockResolvedValue()
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });

  test('TC-T5-STAR-002 does not retry non-transient 4xx responses', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn().mockRejectedValue(Object.assign(new Error('bad request'), {
        response: { status: 400 }
      }))
    };
    const sleep = jest.fn().mockResolvedValue();
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      retryAttempts: 2,
      sleep
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('TC-T5-STAR-002 exhausts retry attempts before returning pending', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn().mockRejectedValue(Object.assign(new Error('service unavailable'), {
        response: { status: 503 }
      }))
    };
    const sleep = jest.fn().mockResolvedValue();
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      retryAttempts: 2,
      retryBackoffMs: 100,
      maxRetryBackoffMs: 1000,
      sleep
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
    expect(axiosInstance.post).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  test('TC-T5-STAR-002 caps exponential retry backoff', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const axiosInstance = {
      post: jest.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    };
    const sleep = jest.fn().mockResolvedValue();
    const client = createStarAwardClient({
      axiosInstance,
      progressServiceUrl: 'http://progress-service:3003',
      internalServiceToken: 'test-internal-service-token-32-bytes',
      retryAttempts: 3,
      retryBackoffMs: 300,
      maxRetryBackoffMs: 500,
      sleep
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
    expect(axiosInstance.post).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([300, 500, 500]);
  });

  test('TC-T5-STAR-002 rejects an incomplete success response', async () => {
    const { createStarAwardClient } = require('../services/starAwardClient');
    const client = createStarAwardClient({
      axiosInstance: { post: jest.fn().mockResolvedValue({ data: { success: true, data: {} } }) },
      progressServiceUrl: 'http://progress-service:3002',
      internalServiceToken: 'test-internal-service-token-32-bytes'
    });

    await expect(client.awardTaskStar({ taskId: 'task-1' })).rejects.toMatchObject({
      code: 'STAR_AWARD_PENDING',
      status: 503
    });
  });
});
