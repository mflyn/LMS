import axios from 'axios';
import * as api from '../../services/familyApi';
import { saveParentSession, captureSession } from '../../services/familySession';
const actor = '333333333333333333333333';
const login = id => { saveParentSession({ token: id, user: { id, role: 'parent' } }); return captureSession('parent'); };
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });
test('complete command body and original operation ID pass through exact endpoints and captured credentials', async () => {
  const session = login(actor), body = { operationId: 'original', expectedVersion: 3, schedule: { kind: 'daily' }, template: { title: '<5>' }, endDate: null };
  axios.post.mockResolvedValue({ data: { success: true, data: { ok: true } } }); axios.patch.mockResolvedValue({ data: { data: {} } });
  for (const action of ['create', 'patch', 'stop']) await api.sendRecurringCommand({ marker: { action, targetPlanId: 'id' }, body }, { session });
  expect(axios.post.mock.calls[0]).toEqual(['/api/recurring-task-plans', body, { headers: { Authorization: `Bearer ${actor}` } }]);
  expect(axios.patch.mock.calls[0][1]).toEqual(body); expect(axios.post.mock.calls[1][0]).toBe('/api/recurring-task-plans/id/stop');
});
test('command GET is readonly and abort uses same UUID without private body', async () => {
  const session = login(actor), marker = { operationId: 'original', childId: 'child', action: 'create', targetPlanId: null, requestDigest: 'digest', actorId: actor };
  axios.get.mockResolvedValue({ data: { data: { state: 'not_found' } } }); axios.post.mockResolvedValue({ data: { data: {} } });
  await api.getRecurringCommand('original', 'child', { session }); await api.abortRecurringCommand(marker, { session });
  expect(axios.get.mock.calls[0][0]).toBe('/api/recurring-task-plan-commands/original?childId=child');
  expect(axios.post.mock.calls[0][1]).toEqual({ childId: 'child', action: 'create', targetPlanId: null, requestDigest: 'digest' });
});
test('late old-actor 401 cannot expire replacement actor or dispatch a retry', async () => {
  const s = login(actor); let reject;
  axios.get.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const call = api.getRecurringCommand('original', 'child', { session: s });
  const replacement = login('444444444444444444444444'); reject({ response: { status: 401 } });
  await expect(call).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(captureSession('parent')).toBe(replacement); expect(axios.post).not.toHaveBeenCalled();
});
