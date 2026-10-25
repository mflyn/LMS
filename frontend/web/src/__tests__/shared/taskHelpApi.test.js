import axios from 'axios';
import { updateOwnTaskHelp } from '../../services/childApi';
import { updateTaskHelp } from '../../services/familyApi';
import { captureSession, saveChildSession, saveParentSession } from '../../services/familySession';
jest.mock('axios');
const save = (role, token) => role === 'student'
  ? saveChildSession({ token, child: { childId: token, familyId: 'f', name: '合成孩子' } })
  : saveParentSession({ token, user: { id: token, role: 'parent' } });
beforeEach(() => { jest.resetAllMocks(); localStorage.clear(); });
test.each(['student', 'parent'])('%s help uses exact version, body whitelist and captured session', async role => {
  save(role, 'a'); const session = captureSession(role), signal = new AbortController().signal;
  axios.patch.mockResolvedValue({ data: { success: true, data: { task: { helpVersion: 2 } } } });
  const request = role === 'student' ? updateOwnTaskHelp : updateTaskHelp;
  const payload = { action: 'request', expectedHelpVersion: 1, helpType: 'other', note: '原说明' };
  await expect(request('t', { ...payload, actor: 'forged', familyId: 'other' }, signal, session)).resolves.toEqual({ task: { helpVersion: 2 } });
  expect(axios.patch).toHaveBeenCalledWith('/api/growth-tasks/t/help', payload, { signal, headers: { Authorization: 'Bearer a' } });
  save(role, 'b'); await expect(request('t', payload, signal, session)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.patch).toHaveBeenCalledTimes(1);
});
test.each(['student', 'parent'])('%s late help 401 cannot expire the new account', async role => {
  save(role, 'a'); let reject; axios.patch.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  const request = (role === 'student' ? updateOwnTaskHelp : updateTaskHelp)('t', { action: 'request', expectedHelpVersion: 0, helpType: 'other' });
  save(role, 'b'); reject({ response: { status: 401 } });
  await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(captureSession(role).actorId).toBe('b');
});
