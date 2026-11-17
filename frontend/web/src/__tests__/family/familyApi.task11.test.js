import axios from 'axios';
import {
  createChild,
  createKnowledgePoint,
  listKnowledgePoints,
  setChildPin,
  updateChild,
  updateGrowthTask,
  updateKnowledgePoint
} from '../../services/familyApi';
import { PARENT_SESSION_KEY, saveParentSession } from '../../services/familySession';

const parentConfig = {
  headers: { Authorization: 'Bearer parent-token' }
};

describe('Task 11 parent child API client', () => {
  beforeEach(() => {
    localStorage.clear();
    saveParentSession({
      token: 'parent-token',
      user: { id: 'parent-a', name: '家长', role: 'parent' }
    });
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true, data: {} } });
  });

  test('creates a child with parent authentication and strips familyId', async () => {
    await createChild({ name: ' 小明 ', grade: 3, familyId: 'family-a' });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/children',
      { name: ' 小明 ', grade: 3 },
      parentConfig
    );
  });

  test.each([429, 503, 401])('task edit %s neither retries nor misclassifies session expiry', async status => {
    const before = localStorage.getItem(PARENT_SESSION_KEY);
    const error = { response: { status } };
    axios.patch.mockRejectedValueOnce(error);
    await expect(updateGrowthTask('synthetic-task', { title: 'Changed' })).rejects.toBe(error);
    expect(axios.patch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(status === 401 ? null : before);
  });

  test('sets a PIN through an encoded child path', async () => {
    await setChildPin('child/a 1', '2468');

    expect(axios.post).toHaveBeenCalledWith(
      '/api/children/child%2Fa%201/pin',
      { pin: '2468' },
      parentConfig
    );
  });

  test('updates a child through the canonical profile contract', async () => {
    axios.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });

    await updateChild('child/a 1', {
      name: '小明',
      textbookVersion: '人教版',
      sportsPreferences: ['跳绳'],
      familyId: 'family-a'
    });

    expect(axios.patch).toHaveBeenCalledWith(
      '/api/children/child%2Fa%201',
      { name: '小明', textbookVersion: '人教版', sportsPreferences: ['跳绳'] },
      parentConfig
    );
  });

  test('reads, creates, and updates knowledge points without client family ownership fields', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: true, data: { items: [] } } });
    axios.patch.mockResolvedValueOnce({ data: { success: true, data: {} } });

    await listKnowledgePoints({
      childId: 'child-a1', dimension: 'academic', masteryLevel: 'learning', familyId: 'family-a'
    });
    await createKnowledgePoint({
      childId: 'child-a1', dimension: 'academic', subject: '数学', name: '分数', familyId: 'family-a'
    });
    await updateKnowledgePoint('point/a 1', { masteryLevel: 'skilled', practiceCount: 8 });

    expect(axios.get).toHaveBeenCalledWith(
      '/api/knowledge-points?childId=child-a1&dimension=academic&masteryLevel=learning',
      parentConfig
    );
    expect(axios.post).toHaveBeenCalledWith(
      '/api/knowledge-points',
      { childId: 'child-a1', dimension: 'academic', subject: '数学', name: '分数' },
      parentConfig
    );
    expect(axios.patch).toHaveBeenCalledWith(
      '/api/knowledge-points/point%2Fa%201',
      { masteryLevel: 'skilled', practiceCount: 8 },
      parentConfig
    );
  });
});
