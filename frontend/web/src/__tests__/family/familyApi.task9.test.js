import axios from 'axios';
import {
  completeGrowthTask,
  createGrowthLog,
  createGrowthTask,
  createMistake,
  createReward,
  deletePrivateMedia,
  getNotificationSettings,
  getPrivateMediaAccess,
  getWeeklyReport,
  listFamilyReminders,
  listGrowthLogs,
  listGrowthTasks,
  listMistakes,
  listRewards,
  redeemReward,
  updateGrowthLog,
  updateGrowthTask,
  updateMistake,
  updateNotificationSettings,
  updateWeeklyReportFeedback,
  uploadPrivateMedia
} from '../../services/familyApi';
import {
  PARENT_SESSION_EXPIRED_EVENT,
  PARENT_SESSION_KEY
} from '../../services/familySession';

const parentSession = {
  token: 'parent-token',
  user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
};

const resolve = (data = {}) => ({ data: { success: true, data } });

describe('Task 9 family API client', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify(parentSession));
    jest.clearAllMocks();
  });

  test('reads selected-child resources with the parent token, optional abort signal, and no familyId query', async () => {
    const controller = new AbortController();
    axios.get.mockResolvedValueOnce(resolve({ items: [] }));

    await listGrowthTasks({ childId: 'child-a1', scope: 'today', familyId: 'family-a' }, controller.signal);

    expect(axios.get).toHaveBeenCalledWith(
      '/api/growth-tasks?childId=child-a1&scope=today',
      expect.objectContaining({
        headers: { Authorization: 'Bearer parent-token' },
        signal: controller.signal
      })
    );
    expect(axios.defaults.headers.common.Authorization).toBeUndefined();
  });

  test('provides all selected-child read wrappers without familyId query parameters', async () => {
    const signal = new AbortController().signal;
    axios.get
      .mockResolvedValueOnce(resolve({ items: [] }))
      .mockResolvedValueOnce(resolve({ items: [] }))
      .mockResolvedValueOnce(resolve({ report: {} }))
      .mockResolvedValueOnce(resolve({ items: [] }))
      .mockResolvedValueOnce(resolve({ settings: {} }))
      .mockResolvedValueOnce(resolve({ starBalance: 0 }))
      .mockResolvedValueOnce(resolve({ accessUrl: 'https://signed.example/media-a' }));

    await listGrowthLogs({ childId: 'child-a1', from: '2026-07-06', familyId: 'family-a' }, signal);
    await listMistakes({ childId: 'child-a1', reviewStatus: 'pending', familyId: 'family-a' }, signal);
    await getWeeklyReport({ childId: 'child-a1', weekStart: '2026-07-06', familyId: 'family-a' }, signal);
    await listFamilyReminders({ childId: 'child-a1', familyId: 'family-a' }, signal);
    await getNotificationSettings(signal);
    await listRewards({ childId: 'child-a1', rewardPage: 1, familyId: 'family-a' }, signal);
    await getPrivateMediaAccess('media-a1', signal);

    expect(axios.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/growth-logs?childId=child-a1&from=2026-07-06',
      '/api/mistakes?childId=child-a1&reviewStatus=pending',
      '/api/reports/weekly?childId=child-a1&weekStart=2026-07-06',
      '/api/notifications/family?childId=child-a1',
      '/api/notifications/settings',
      '/api/rewards?childId=child-a1&rewardPage=1',
      '/api/media/media-a1/access'
    ]);
    axios.get.mock.calls.forEach(([, config]) => {
      expect(config).toEqual(expect.objectContaining({
        headers: { Authorization: 'Bearer parent-token' },
        signal
      }));
    });
  });

  test('writes growth, report, reminder, reward, and media mutations with parent authentication', async () => {
    axios.post.mockResolvedValue(resolve({}));
    axios.patch.mockResolvedValue(resolve({}));
    axios.delete.mockResolvedValue(resolve({}));
    const file = new File(['image'], 'task.png', { type: 'image/png' });

    await createGrowthTask({ childId: 'child-a1', title: '跳绳' });
    await updateGrowthTask('task-a1', { title: '跳绳 500 个' });
    await completeGrowthTask('task-a1', { actualAmount: 500 });
    await createGrowthLog({ childId: 'child-a1', dimension: 'physical' });
    await updateGrowthLog('log-a1', { content: '完成' });
    await createMistake({ childId: 'child-a1', subject: '数学', reason: 'calculation' });
    await updateMistake('mistake-a1', { reviewed: true });
    await updateWeeklyReportFeedback('report-a1', { parentNote: '继续保持' });
    await updateNotificationSettings({ quietHours: { start: '21:00', end: '07:00' } });
    await createReward({ childId: 'child-a1', title: '周末活动', requiredStars: 10 });
    await uploadPrivateMedia({ childId: 'child-a1', purpose: 'task_attachment', file });
    await deletePrivateMedia('media-a1');

    expect(axios.post).toHaveBeenCalledWith(
      '/api/growth-tasks',
      { childId: 'child-a1', title: '跳绳' },
      expect.objectContaining({ headers: { Authorization: 'Bearer parent-token' } })
    );
    expect(axios.patch).toHaveBeenCalledWith('/api/growth-tasks/task-a1', { title: '跳绳 500 个' }, expect.any(Object));
    expect(axios.patch).toHaveBeenCalledWith('/api/growth-tasks/task-a1/complete', { actualAmount: 500 }, expect.any(Object));
    expect(axios.post).toHaveBeenCalledWith('/api/growth-logs', { childId: 'child-a1', dimension: 'physical' }, expect.any(Object));
    expect(axios.patch).toHaveBeenCalledWith('/api/growth-logs/log-a1', { content: '完成' }, expect.any(Object));
    expect(axios.post).toHaveBeenCalledWith('/api/mistakes', { childId: 'child-a1', subject: '数学', reason: 'calculation' }, expect.any(Object));
    expect(axios.patch).toHaveBeenCalledWith('/api/mistakes/mistake-a1', { reviewed: true }, expect.any(Object));
    expect(axios.patch).toHaveBeenCalledWith('/api/reports/weekly/report-a1/feedback', { parentNote: '继续保持' }, expect.any(Object));
    expect(axios.patch).toHaveBeenCalledWith('/api/notifications/settings', { quietHours: { start: '21:00', end: '07:00' } }, expect.any(Object));
    expect(axios.post).toHaveBeenCalledWith('/api/rewards', { childId: 'child-a1', title: '周末活动', requiredStars: 10 }, expect.any(Object));
    expect(axios.post).toHaveBeenCalledWith(
      '/api/media',
      expect.any(FormData),
      expect.objectContaining({ headers: { Authorization: 'Bearer parent-token' } })
    );
    expect(axios.delete).toHaveBeenCalledWith('/api/media/media-a1', expect.any(Object));
  });

  test('omits UI-supplied familyId from selected-child creation payloads', async () => {
    axios.post.mockResolvedValue(resolve({}));

    await createGrowthTask({ childId: 'child-a1', familyId: 'family-a', title: '跳绳' });
    await createGrowthLog({ childId: 'child-a1', familyId: 'family-a', dimension: 'physical' });
    await createMistake({ childId: 'child-a1', familyId: 'family-a', subject: '数学', reason: 'calculation' });
    await createReward({ childId: 'child-a1', familyId: 'family-a', title: '周末活动', requiredStars: 10 });

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      '/api/growth-tasks',
      { childId: 'child-a1', title: '跳绳' },
      expect.any(Object)
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      '/api/growth-logs',
      { childId: 'child-a1', dimension: 'physical' },
      expect.any(Object)
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      3,
      '/api/mistakes',
      { childId: 'child-a1', subject: '数学', reason: 'calculation' },
      expect.any(Object)
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      4,
      '/api/rewards',
      { childId: 'child-a1', title: '周末活动', requiredStars: 10 },
      expect.any(Object)
    );
  });

  test('sends a nonempty idempotency key for redemption', async () => {
    axios.patch.mockResolvedValueOnce(resolve({ status: 'redeemed' }));

    await redeemReward('reward-a1', ' redeem-a1 ');

    expect(axios.patch).toHaveBeenCalledWith('/api/rewards/reward-a1/redeem', {}, {
      headers: {
        Authorization: 'Bearer parent-token',
        'Idempotency-Key': 'redeem-a1'
      }
    });
    await expect(redeemReward('reward-a1', '   ')).rejects.toThrow('Idempotency key is required');
  });

  test('expires the parent session when a Task 9 request receives 401', async () => {
    const onExpired = jest.fn();
    window.addEventListener(PARENT_SESSION_EXPIRED_EVENT, onExpired);
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(listGrowthTasks({ childId: 'child-a1' })).rejects.toMatchObject({ response: { status: 401 } });

    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(PARENT_SESSION_EXPIRED_EVENT, onExpired);
  });
});
