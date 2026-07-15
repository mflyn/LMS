import axios from 'axios';
import {
  childPinLogin,
  completeOwnTask,
  createOwnMistake,
  getOwnProfile,
  listOwnMistakes,
  listOwnReminders,
  listOwnRewards,
  listOwnTasks,
  reviewOwnMistake
} from '../../services/childApi';
import {
  CHILD_SESSION_EXPIRED_EVENT,
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  saveChildSession
} from '../../services/familySession';

const childSession = {
  token: 'child-token',
  child: {
    childId: 'child-a1',
    familyId: 'family-a',
    name: '小雨'
  }
};

describe('childApi', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    axios.defaults.headers.common = {};
    saveChildSession(childSession);
  });

  test('uses the public PIN login contract without expiring an existing session', async () => {
    const expired = jest.fn();
    window.addEventListener(CHILD_SESSION_EXPIRED_EVENT, expired);
    axios.post.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(childPinLogin({
      familyId: 'family-a',
      childId: 'child-a1',
      pin: '1234',
      ignored: 'not-sent'
    })).rejects.toEqual({ response: { status: 401 } });

    expect(axios.post).toHaveBeenCalledWith('/api/auth/child-pin-login', {
      familyId: 'family-a',
      childId: 'child-a1',
      pin: '1234'
    });
    expect(localStorage.getItem(CHILD_SESSION_KEY)).not.toBeNull();
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(CHILD_SESSION_EXPIRED_EVENT, expired);
  });

  test('attaches the child bearer token per request and unwraps the response envelope', async () => {
    axios.get.mockResolvedValueOnce({ data: { data: { tasks: ['task-a1'] } } });

    await expect(listOwnTasks({ scope: 'today' })).resolves.toEqual({ tasks: ['task-a1'] });

    expect(axios.get).toHaveBeenCalledWith('/api/growth-tasks?scope=today', {
      headers: { Authorization: 'Bearer child-token' }
    });
    expect(axios.defaults.headers.common).toEqual({});
  });

  test('derives profile and reminder child IDs from the validated session', async () => {
    axios.get.mockResolvedValue({ data: { data: {} } });
    const signal = new AbortController().signal;

    await getOwnProfile(signal);
    await listOwnReminders({ date: '2026-07-11', childId: 'child-b2' }, signal);

    expect(axios.get).toHaveBeenNthCalledWith(1, '/api/children/child-a1', {
      headers: { Authorization: 'Bearer child-token' },
      signal
    });
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      '/api/notifications/family?childId=child-a1&date=2026-07-11',
      { headers: { Authorization: 'Bearer child-token' }, signal }
    );
  });

  test('allows only approved child query parameters', async () => {
    axios.get.mockResolvedValue({ data: { data: [] } });

    await listOwnTasks({ scope: 'today', status: 'pending', dimension: 'physical', page: 2, childId: 'child-b2' });
    await listOwnMistakes({ reviewStatus: 'pending', subject: '数学', pageSize: 20, familyId: 'family-b' });
    await listOwnRewards({ status: 'active', rewardPage: 1, ledgerPageSize: 10, childId: 'child-b2' });

    expect(axios.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/growth-tasks?scope=today&status=pending&dimension=physical&page=2',
      '/api/mistakes?subject=%E6%95%B0%E5%AD%A6&reviewStatus=pending&pageSize=20',
      '/api/rewards?status=active&rewardPage=1&ledgerPageSize=10'
    ]);
  });

  test('strips parent and identity fields from task completion payloads while preserving zero', async () => {
    axios.patch.mockResolvedValueOnce({ data: { data: { task: { id: 'task-a1' } } } });

    await completeOwnTask('task-a1', {
      actualMinutes: 0,
      actualAmount: 500,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '还需要练习',
      parentFeedback: 'must-not-send',
      childId: 'child-b2'
    });

    expect(axios.patch).toHaveBeenCalledWith('/api/growth-tasks/task-a1/complete', {
      actualMinutes: 0,
      actualAmount: 500,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '还需要练习'
    }, { headers: { Authorization: 'Bearer child-token' } });
  });

  test('strips parent-owned fields from mistake review payloads', async () => {
    axios.patch.mockResolvedValueOnce({ data: { data: { mistake: { id: 'mistake-a1' } } } });

    await reviewOwnMistake('mistake-a1', {
      childExplanation: '重新计算后是 42',
      reviewed: true,
      mastered: false,
      parentNote: 'must-not-send',
      reason: 'must-not-send'
    });

    expect(axios.patch).toHaveBeenCalledWith('/api/mistakes/mistake-a1', {
      childExplanation: '重新计算后是 42',
      reviewed: true,
      mastered: false
    }, { headers: { Authorization: 'Bearer child-token' } });
  });

  test('TC-T10-API-007 creates an own mistake with only approved child fields', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: { mistake: { mistakeId: 'mistake-new' } } } });

    await expect(createOwnMistake({
      subject: '数学',
      reason: 'calculation',
      childExplanation: '我把进位漏掉了',
      childId: 'child-b2',
      familyId: 'family-b',
      parentNote: 'must-not-send'
    })).resolves.toEqual({ mistake: { mistakeId: 'mistake-new' } });

    expect(axios.post).toHaveBeenCalledWith('/api/mistakes', {
      subject: '数学',
      reason: 'calculation',
      childExplanation: '我把进位漏掉了'
    }, { headers: { Authorization: 'Bearer child-token' } });
  });

  test('forwards abort signals to protected mutations', async () => {
    axios.patch.mockResolvedValueOnce({ data: { data: {} } });
    const signal = new AbortController().signal;

    await completeOwnTask('task-a1', { childNote: '完成了' }, signal);

    expect(axios.patch).toHaveBeenCalledWith(
      '/api/growth-tasks/task-a1/complete',
      { childNote: '完成了' },
      { headers: { Authorization: 'Bearer child-token' }, signal }
    );
  });

  test('expires only the child session after a protected 401', async () => {
    const parentSnapshot = JSON.stringify({ token: 'parent-token' });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);
    const expired = jest.fn();
    window.addEventListener(CHILD_SESSION_EXPIRED_EVENT, expired);
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(getOwnProfile()).rejects.toEqual({ response: { status: 401 } });

    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHILD_SESSION_EXPIRED_EVENT, expired);
  });
});
