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
