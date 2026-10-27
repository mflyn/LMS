import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import MistakesPage from '../../pages/family/MistakesPage';
import TasksPage from '../../pages/family/TasksPage';
import ChildMistakesPage from '../../pages/child/ChildMistakesPage';
import * as parentApi from '../../services/familyApi';
import * as childApi from '../../services/childApi';
import { saveParentSession, saveChildSession, clearChildSession } from '../../services/familySession';

jest.mock('../../services/familyApi');
jest.mock('../../services/childApi');
let mockFamily;
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '000000000000000000000001' } }) }));
const id = n => String(n).padStart(24, '0');
const task = extra => ({ taskId: id(3), familyId: id(4), childId: id(2), title: '权威任务', subject: '数学',
  dimension: 'academic', area: '计算', dueDate: '2026-10-27', status: 'confirmed',
  taskType: 'practice', completionVersion: 1, checklistVersion: 0, checklistSnapshot: [],
  completionMediaIds: [id(8)], completionMediaReferenceState: 'stable', parentConfirmed: true, ...extra });
const mistake = extra => ({ mistakeId: id(5), familyId: id(4), childId: id(2), subject: '数学',
  knowledgePointName: '权威错题', reason: 'concept', corrected: false, reviewed: false, mastered: false,
  questionMediaIds: [], childAnswerMediaIds: [], ...extra });
const fail = (status, code, details = []) => ({ response: { status, data: { error: { code, message: code, details } } } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const Location = () => <output aria-label="位置">{useLocation().pathname}{useLocation().search}</output>;
const pageTree = url => <MemoryRouter initialEntries={[url]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Location /><Routes>
    <Route path="/app/mistakes" element={<MistakesPage />} />
    <Route path="/app/tasks" element={<TasksPage />} />
    <Route path="/child/mistakes" element={<ChildMistakesPage />} />
  </Routes></MemoryRouter>;
const show = (url = '/app/mistakes') => {
  const view = render(pageTree(url));
  return { ...view, refresh: () => view.rerender(pageTree(url)) };
};
const childSession = n => ({ token: `synthetic-child-${n}`, child: { childId: id(n), familyId: id(4), name: `孩子${n}` } });

async function unknownChildCreate(user) {
  childApi.createOwnMistake.mockRejectedValueOnce(new Error('response lost'));
  await user.click(await screen.findByRole('button', { name: '记录新错题' }));
  await user.type(screen.getByLabelText('科目'), '未知创建');
  await user.selectOptions(screen.getByLabelText('错因'), 'concept');
  await user.click(screen.getByRole('button', { name: '保存', exact: true }));
  await screen.findByText(/保存结果尚未确认/);
}

test('ordinary reload 403 after unknown-create discovery clears private rows and unlock controls', async () => {
  const user = userEvent.setup();
  childApi.listOwnMistakes.mockRejectedValueOnce(fail(503, 'UNAVAILABLE'));
  show('/child/mistakes');
  await screen.findByRole('button', { name: '重新加载数据' });
  await unknownChildCreate(user);
  childApi.listOwnMistakes.mockResolvedValueOnce({ items: [mistake({ knowledgePointName: '应清除的私有错题' })] });
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await screen.findByRole('heading', { name: '应清除的私有错题' });
  childApi.listOwnMistakes.mockRejectedValueOnce(fail(403, 'CHILD_ACCESS_DENIED'));
  await user.click(screen.getByRole('button', { name: '重新加载数据' }));
  await screen.findByText('CHILD_ACCESS_DENIED');
  expect(childApi.listOwnMistakes).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('heading', { name: '应清除的私有错题' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '已核对列表，结束本次记录' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '记录新错题' })).not.toBeInTheDocument();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.deleteOwnPrivateMedia).not.toHaveBeenCalled();
});

test('ordinary reload denial blocks a late manual list success without losing the unknown-create marker', async () => {
  const user = userEvent.setup(), denied = deferred(), late = deferred();
  childApi.listOwnMistakes.mockRejectedValueOnce(fail(503, 'UNAVAILABLE'));
  const view = show('/child/mistakes');
  await screen.findByRole('button', { name: '重新加载数据' });
  await unknownChildCreate(user);
  childApi.listOwnMistakes.mockResolvedValueOnce({ items: [mistake({ knowledgePointName: '失权前私有错题' })] });
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await screen.findByRole('heading', { name: '失权前私有错题' });
  childApi.listOwnMistakes.mockReturnValueOnce(denied.promise).mockReturnValueOnce(late.promise);
  await user.click(screen.getByRole('button', { name: '重新加载数据' }));
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await act(async () => denied.reject(fail(403, 'CHILD_ACCESS_DENIED')));
  await screen.findByText('CHILD_ACCESS_DENIED');
  await act(async () => late.resolve({ items: [mistake({ mistakeId: id(6), knowledgePointName: '拒绝后迟到的私有错题' })] }));
  expect(screen.queryByRole('heading', { name: '失权前私有错题' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '拒绝后迟到的私有错题' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '已核对列表，结束本次记录' })).not.toBeInTheDocument();
  expect(childApi.listOwnMistakes).toHaveBeenCalledTimes(4);
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.deleteOwnPrivateMedia).not.toHaveBeenCalled();
  view.unmount();
  childApi.listOwnMistakes.mockResolvedValue({ items: [] });
  show('/child/mistakes');
  expect(await screen.findByRole('button', { name: '记录新错题' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重新读取错题列表' })).toBeEnabled();
});

test.each(['offline', 503])('child no-ID create requires explicit list read; close and %s retain protection without POST', async failure => {
  const user = userEvent.setup(); show('/child/mistakes');
  await unknownChildCreate(user);
  await user.click(screen.getByRole('button', { name: '取消', exact: true }));
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeDisabled();
  childApi.listOwnMistakes.mockRejectedValueOnce(failure === 'offline' ? new Error('offline') : fail(503, 'UNAVAILABLE'));
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await waitFor(() => expect(childApi.listOwnMistakes).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '已核对列表，结束本次记录' })).not.toBeInTheDocument();
  childApi.listOwnMistakes.mockResolvedValueOnce({ items: [mistake({ subject: '未知创建' })] });
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await screen.findByRole('button', { name: '已核对列表，结束本次记录' });
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '已核对列表，结束本次记录' }));
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeEnabled();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.deleteOwnPrivateMedia).not.toHaveBeenCalled();
});

test('child create abandoned during account change stays protected after return and ignores old successful POST', async () => {
  const user = userEvent.setup(), pending = deferred();
  childApi.createOwnMistake.mockReturnValueOnce(pending.promise);
  show('/child/mistakes');
  await user.click(await screen.findByRole('button', { name: '记录新错题' }));
  await user.type(screen.getByLabelText('科目'), '不可持久化的私有内容');
  await user.selectOptions(screen.getByLabelText('错因'), 'concept');
  await user.click(screen.getByRole('button', { name: '保存', exact: true }));
  expect(screen.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
  expect(Object.values(sessionStorage).join('')).not.toContain('不可持久化');
  await act(async () => clearChildSession());
  expect(screen.queryByLabelText('科目')).not.toBeInTheDocument();
  await act(async () => saveChildSession(childSession(2)));
  expect(await screen.findByRole('button', { name: '记录新错题' })).toBeDisabled();
  await act(async () => pending.resolve({ mistake: mistake({ knowledgePointName: '旧提交响应' }) }));
  expect(screen.queryByText('旧提交响应')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeDisabled();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

test('child unknown-create empty list is not proof of failed creation or automatic permission to repost', async () => {
  const user = userEvent.setup(); show('/child/mistakes');
  await unknownChildCreate(user);
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await screen.findByRole('button', { name: '已核对列表，结束本次记录' });
  expect(screen.getByRole('button', { name: '记录新错题' })).toBeDisabled();
  expect(screen.getByText(/列表未出现不代表保存失败/)).toBeInTheDocument();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

test('child unknown-create list discovery preserves other row drafts and unknown PATCH locks', async () => {
  const user = userEvent.setup(), first = mistake({ knowledgePointName: '未决旧错题' });
  childApi.listOwnMistakes.mockResolvedValue({ items: [first] });
  childApi.reviewOwnMistake.mockRejectedValue(new Error('PATCH response lost'));
  show('/child/mistakes');
  await user.type(await screen.findByLabelText('我的解释（未决旧错题）'), '原草稿');
  await user.click(screen.getByRole('button', { name: '我还不会 未决旧错题' }));
  await screen.findByText(/保存结果尚未确认/);
  await unknownChildCreate(user);
  childApi.listOwnMistakes.mockResolvedValueOnce({ items: [{ ...first }, mistake({ mistakeId: id(6), knowledgePointName: '新发现错题' })] });
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await screen.findByRole('heading', { name: '新发现错题' });
  expect(screen.getByLabelText('我的解释（未决旧错题）')).toHaveValue('原草稿');
  expect(screen.getByRole('button', { name: '我还不会 未决旧错题' })).toBeDisabled();
  expect(childApi.reviewOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

test('child unknown-create late list cannot reinsert a row mastered while the read was pending', async () => {
  const user = userEvent.setup(), first = mistake({ knowledgePointName: '即将掌握的错题' }), pending = deferred();
  childApi.listOwnMistakes.mockResolvedValue({ items: [first] });
  childApi.reviewOwnMistake.mockResolvedValue({ mistake: { ...first, mastered: true, reviewed: true } });
  show('/child/mistakes');
  await screen.findByRole('heading', { name: '即将掌握的错题' });
  await unknownChildCreate(user);
  childApi.listOwnMistakes.mockReturnValueOnce(pending.promise);
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await user.click(screen.getByRole('button', { name: '我已经会了 即将掌握的错题' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '即将掌握的错题' })).not.toBeInTheDocument());
  await act(async () => pending.resolve({ items: [{ ...first }, mistake({ mistakeId: id(6), knowledgePointName: '应发现的新错题' })] }));
  expect(await screen.findByRole('heading', { name: '应发现的新错题' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '即将掌握的错题' })).not.toBeInTheDocument();
  expect(childApi.reviewOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

test('child unknown-create marker survives remount and account return; late list cannot leak or unlock', async () => {
  const user = userEvent.setup(), view = show('/child/mistakes');
  await unknownChildCreate(user);
  view.unmount(); show('/child/mistakes');
  expect(await screen.findByRole('button', { name: '记录新错题' })).toBeDisabled();
  const pending = deferred(); childApi.listOwnMistakes.mockReturnValueOnce(pending.promise);
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await act(async () => saveChildSession(childSession(9)));
  expect(await screen.findByRole('button', { name: '记录新错题' })).toBeEnabled();
  await act(async () => pending.resolve({ items: [mistake({ knowledgePointName: '迟到的私有错题' })] }));
  expect(screen.queryByText('迟到的私有错题')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '已核对列表，结束本次记录' })).not.toBeInTheDocument();
  await act(async () => saveChildSession(childSession(2)));
  expect(await screen.findByRole('button', { name: '记录新错题' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重新读取错题列表' })).toBeEnabled();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

test.each([403, 'foreign'])('child unknown-create list %s clears private view and keeps protection', async rejection => {
  const user = userEvent.setup(); show('/child/mistakes');
  await unknownChildCreate(user);
  if (rejection === 403) childApi.listOwnMistakes.mockRejectedValueOnce(fail(403, 'CHILD_ACCESS_DENIED'));
  else childApi.listOwnMistakes.mockResolvedValueOnce({ items: [mistake({ childId: id(9), knowledgePointName: '他人错题' })] });
  await user.click(screen.getByRole('button', { name: '重新读取错题列表' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '记录新错题' })).not.toBeInTheDocument());
  expect(screen.queryByText('他人错题')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('科目')).not.toBeInTheDocument();
  expect(childApi.createOwnMistake).toHaveBeenCalledTimes(1);
});

beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-parent', user: { id: id(1), name: '家长', role: 'parent' } });
  saveChildSession(childSession(2));
  mockFamily = { family: { familyId: id(4) }, selectedChildId: id(2), selectedChild: { childId: id(2), name: '孩子2' }, childScopeVersion: 1 };
  parentApi.listMistakes.mockResolvedValue({ items: [] });
  parentApi.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  parentApi.getGrowthTask.mockResolvedValue({ task: task() });
  parentApi.getMistake.mockResolvedValue({ mistake: mistake() });
  parentApi.deletePrivateMedia.mockResolvedValue({});
  parentApi.getPrivateMediaAccess.mockResolvedValue({ access: { url: '/synthetic', expiresAt: new Date(Date.now() + 60000).toISOString() } });
  childApi.listOwnMistakes.mockResolvedValue({ items: [] });
  childApi.deleteOwnPrivateMedia.mockResolvedValue({});
});

test('task-to-mistake reads authoritative scope and subject, never copies completion media or URL text', async () => {
  const user = userEvent.setup();
  parentApi.createMistake.mockResolvedValue({ mistake: mistake({ sourceTaskId: id(3) }) });
  show(`/app/mistakes?sourceTaskId=${id(3)}&subject=伪造`);
  expect(await screen.findByLabelText('学科')).toHaveValue('数学');
  expect(parentApi.getGrowthTask).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  expect(parentApi.createMistake).toHaveBeenCalledWith(expect.objectContaining({ sourceTaskId: id(3), subject: '数学',
    questionMediaIds: [], childAnswerMediaIds: [] }));
  expect(await screen.findByRole('button', { name: '查看已保存错题' })).toBeInTheDocument();
});

test.each(['sourceTaskId', 'sourceMistakeId'])('correction task uses %s only on create and keeps the first resource independent', async field => {
  const user = userEvent.setup();
  parentApi.createGrowthTask.mockResolvedValue({ task: task({ taskId: id(6), [field]: field === 'sourceTaskId' ? id(3) : id(5) }) });
  show(`/app/tasks?${field}=${field === 'sourceTaskId' ? id(3) : id(5)}`);
  expect(await screen.findByLabelText('任务类型')).toHaveValue('错题订正');
  expect(screen.getByLabelText('学科')).toHaveValue('数学');
  fireEvent.change(screen.getByLabelText('截止日期'), { target: { value: '2026-10-28' } });
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  await waitFor(() => expect(parentApi.createGrowthTask).toHaveBeenCalledTimes(1));
  expect(parentApi.createGrowthTask.mock.calls[0][0]).toMatchObject({ [field]: field === 'sourceTaskId' ? id(3) : id(5), taskType: '错题订正', attachmentMediaIds: [] });
  expect(parentApi.updateMistake).not.toHaveBeenCalled();
  expect(parentApi.confirmGrowthTask).not.toHaveBeenCalled();
  expect(parentApi.updateGrowthTask).not.toHaveBeenCalled();
});

test('foreign source cannot prefill or switch selected child', async () => {
  parentApi.getGrowthTask.mockResolvedValue({ task: task({ childId: id(9), subject: '私有学科' }) });
  show(`/app/mistakes?sourceTaskId=${id(3)}`);
  expect(await screen.findByRole('alert')).toHaveTextContent(/无法|不可/);
  expect(screen.queryByDisplayValue('私有学科')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存错题' })).not.toBeInTheDocument();
  expect(mockFamily.selectedChildId).toBe(id(2));
});

test('source denial cannot be undone by a late task list response', async () => {
  const user = userEvent.setup();
  const pending = deferred();
  parentApi.listGrowthTasks.mockReturnValue(pending.promise);
  parentApi.getMistake.mockRejectedValue(fail(403, 'CHILD_ACCESS_DENIED'));
  show(`/app/tasks?sourceMistakeId=${id(5)}`);
  expect(await screen.findByRole('alert')).toHaveTextContent(/无法|不可/);
  await act(async () => pending.resolve({ items: [task({ title: '迟到私有任务' })], total: 1 }));
  expect(screen.queryByText('迟到私有任务')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建任务' })).toBeDisabled();
  parentApi.listGrowthTasks.mockResolvedValue({ items: [task({ title: '重新授权的任务' })], total: 1 });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(await screen.findByText('重新授权的任务')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建任务' })).toBeEnabled();
  expect(parentApi.getMistake).toHaveBeenCalledTimes(1);
  expect(parentApi.createGrowthTask).not.toHaveBeenCalled();
});

test.each(['missing', 'outage'])('mistake detail handles source %s without cached source title or PATCH source fields', async mode => {
  const user = userEvent.setup();
  parentApi.getMistake.mockImplementation(async () => {
    if (mode === 'outage') throw fail(503, 'SOURCE_SERVICE_UNAVAILABLE');
    return { mistake: mistake({ sourceTaskId: id(3), sourceAvailable: false, source: null }) };
  });
  show(`/app/mistakes?mistakeId=${id(5)}`);
  expect(await screen.findByText(mode === 'missing' ? '来源不可用' : /来源服务暂不可用/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /查看来源/ })).not.toBeInTheDocument();
  if (mode === 'missing') {
    parentApi.updateMistake.mockResolvedValue({ mistake: mistake() });
    await user.click(screen.getByRole('button', { name: '保存复盘' }));
    expect(parentApi.updateMistake.mock.calls[0][1]).not.toHaveProperty('sourceTaskId');
  }
});

const createWithUpload = async (error) => {
  const user = userEvent.setup();
  parentApi.uploadPrivateMedia.mockResolvedValue({ media: { mediaId: id(7), mimeType: 'application/pdf', displayName: '合成.pdf' } });
  parentApi.createMistake.mockRejectedValue(error);
  const view = show(); await screen.findByText('暂无错题');
  await user.click(screen.getByRole('button', { name: '记录错题' }));
  await user.type(screen.getByLabelText('学科'), '数学');
  await user.upload(screen.getByLabelText('题目附件'), new File(['synthetic'], '合成.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  return { user, view };
};

test.each([new Error('network unknown'), fail(503, 'MEDIA_REFERENCE_PENDING', { resourceId: id(5) })])('unknown/pending create retains submitted media on close without repost', async error => {
  const { user, view } = await createWithUpload(error);
  expect(await screen.findByRole('alert')).toHaveTextContent(/未确认|处理中/);
  expect(screen.getByRole('button', { name: '保存错题' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '关闭' })); view.unmount();
  expect(parentApi.createMistake).toHaveBeenCalledTimes(1);
  expect(parentApi.deletePrivateMedia).not.toHaveBeenCalled();
});

test('pending recovery GET keeps resourceId on source 503 and never repeats create', async () => {
  const { user } = await createWithUpload(fail(503, 'MEDIA_REFERENCE_PENDING', { resourceId: id(5) }));
  parentApi.getMistake.mockRejectedValueOnce(fail(503, 'SOURCE_SERVICE_UNAVAILABLE'))
    .mockResolvedValueOnce({ mistake: mistake({ sourceTaskId: id(3), sourceAvailable: false, source: null, questionMediaIds: [id(7)] }) });
  await user.click(await screen.findByRole('button', { name: '继续读取原错题' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/来源服务暂不可用/);
  await user.click(screen.getByRole('button', { name: '继续读取原错题' }));
  await waitFor(() => expect(parentApi.getMistake).toHaveBeenCalledTimes(2));
  expect(parentApi.getMistake.mock.calls.map(call => call[0])).toEqual([id(5), id(5)]);
  expect(parentApi.createMistake).toHaveBeenCalledTimes(1);
  expect(parentApi.deletePrivateMedia).not.toHaveBeenCalled();
});

test('explicit source 503 is a pre-write failure with manual retry, unlike unknown network result', async () => {
  const { user } = await createWithUpload(fail(503, 'SOURCE_SERVICE_UNAVAILABLE'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/来源服务暂不可用/);
  expect(screen.getByRole('button', { name: '保存错题' })).toBeEnabled();
  parentApi.createMistake.mockResolvedValueOnce({ mistake: mistake() });
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  expect(parentApi.createMistake).toHaveBeenCalledTimes(2);
});

test('child same-role account change clears old draft and ignores late create success', async () => {
  const user = userEvent.setup(), pending = deferred();
  childApi.createOwnMistake.mockReturnValue(pending.promise);
  show('/child/mistakes'); await screen.findByText('暂无待复习错题。');
  await user.click(screen.getByRole('button', { name: '记录新错题' }));
  await user.type(screen.getByLabelText('科目'), '旧账号私有科目');
  await user.selectOptions(screen.getByLabelText('错因'), 'concept');
  await user.click(screen.getByRole('button', { name: '保存' }));
  act(() => saveChildSession(childSession(9)));
  await act(async () => pending.resolve({ mistake: mistake({ subject: '旧账号私有科目', knowledgePointName: '' }) }));
  expect(screen.queryByDisplayValue('旧账号私有科目')).not.toBeInTheDocument();
  expect(screen.queryByText('旧账号私有科目')).not.toBeInTheDocument();
  expect(screen.queryByText('错题已记录。')).not.toBeInTheDocument();
  expect(childApi.listOwnMistakes).toHaveBeenCalledTimes(2);
});

test.each(['success', '503'])('reading mistake B with %s preserves A explanation and uploaded media in its PATCH', async result => {
  const user = userEvent.setup();
  const first = mistake({ knowledgePointName: '错题A' });
  const second = mistake({ mistakeId: id(6), knowledgePointName: '错题B' });
  childApi.listOwnMistakes.mockResolvedValue({ items: [first, second] });
  childApi.uploadOwnPrivateMedia.mockResolvedValue({ media: { mediaId: id(7), mimeType: 'application/pdf', displayName: '草稿.pdf' } });
  if (result === '503') childApi.getOwnMistake.mockRejectedValue(fail(503, 'SOURCE_SERVICE_UNAVAILABLE'));
  else childApi.getOwnMistake.mockResolvedValue({ mistake: { ...second, childExplanation: 'B权威详情' } });
  childApi.reviewOwnMistake.mockResolvedValue({ mistake: { ...first, reviewed: true, childExplanation: 'A未保存解释', questionMediaIds: [id(7)] } });
  show('/child/mistakes');
  await user.type(await screen.findByLabelText('我的解释（错题A）'), 'A未保存解释');
  await user.upload(screen.getByLabelText('题目附件（错题A）'), new File(['synthetic'], '草稿.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByRole('button', { name: '查看详情 错题B' }));
  if (result === '503') expect(await screen.findByRole('alert')).toHaveTextContent('来源服务暂不可用');
  else await waitFor(() => expect(screen.getByLabelText('我的解释（错题B）')).toHaveValue('B权威详情'));
  expect(screen.getByLabelText('我的解释（错题A）')).toHaveValue('A未保存解释');
  expect(childApi.reviewOwnMistake).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '我还不会 错题A' }));
  expect(childApi.reviewOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.reviewOwnMistake).toHaveBeenCalledWith(id(5), {
    childExplanation: 'A未保存解释', questionMediaIds: [id(7)], reviewed: true, mastered: false
  });
  expect(childApi.deleteOwnPrivateMedia).not.toHaveBeenCalled();
});

test('unknown child PATCH stays locked through detail 503 and unlocks only after an authoritative GET succeeds', async () => {
  const user = userEvent.setup();
  const first = mistake({ knowledgePointName: '错题A', sourceTaskId: id(3), sourceAvailable: true,
    source: { id: id(3), familyId: id(4), childId: id(2), title: 'A来源' } });
  childApi.listOwnMistakes.mockResolvedValue({ items: [first] });
  childApi.reviewOwnMistake.mockRejectedValue(new Error('unknown network result'));
  childApi.getOwnMistake.mockRejectedValueOnce(fail(503, 'SOURCE_SERVICE_UNAVAILABLE'))
    .mockResolvedValueOnce({ mistake: { ...first, childExplanation: '权威已保存解释', sourceAvailable: false, source: null } });
  show('/child/mistakes');
  await user.type(await screen.findByLabelText('我的解释（错题A）'), '未知结果解释');
  await user.click(screen.getByRole('button', { name: '我还不会 错题A' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('保存结果尚未确认');
  expect(screen.getByRole('button', { name: '我还不会 错题A' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '查看详情 错题A' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('来源服务暂不可用');
  expect(screen.getByRole('button', { name: '我还不会 错题A' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '我已经会了 错题A' })).toBeDisabled();
  expect(screen.getByLabelText('我的解释（错题A）')).toHaveValue('未知结果解释');
  expect(screen.queryByRole('link', { name: '查看来源任务：A来源' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '我还不会 错题A' }));
  expect(childApi.reviewOwnMistake).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '重试读取' }));
  await waitFor(() => expect(screen.getByLabelText('我的解释（错题A）')).toHaveValue('权威已保存解释'));
  expect(screen.getByRole('button', { name: '我还不会 错题A' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '我已经会了 错题A' })).toBeEnabled();
  expect(childApi.getOwnMistake.mock.calls.map(([mistakeId]) => mistakeId)).toEqual([id(5), id(5)]);
  expect(childApi.reviewOwnMistake).toHaveBeenCalledTimes(1);
});

test('child detail 403 still clears all private drafts and rows', async () => {
  const user = userEvent.setup();
  childApi.listOwnMistakes.mockResolvedValue({ items: [mistake({ knowledgePointName: '错题A' }), mistake({ mistakeId: id(6), knowledgePointName: '错题B' })] });
  childApi.getOwnMistake.mockRejectedValue(fail(403, 'CHILD_ACCESS_DENIED'));
  show('/child/mistakes');
  await user.type(await screen.findByLabelText('我的解释（错题A）'), '失权私有草稿');
  await user.click(screen.getByRole('button', { name: '查看详情 错题B' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('当前身份无法继续查看或修改错题');
  expect(screen.queryByDisplayValue('失权私有草稿')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '错题A' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '错题B' })).not.toBeInTheDocument();
  expect(childApi.reviewOwnMistake).not.toHaveBeenCalled();
});

test('parent scopeVersion reset clears prefill and ignores a late source response', async () => {
  const pending = deferred(); parentApi.getGrowthTask.mockReturnValue(pending.promise);
  const view = show(`/app/mistakes?sourceTaskId=${id(3)}`);
  await waitFor(() => expect(parentApi.getGrowthTask).toHaveBeenCalledTimes(1));
  mockFamily = { ...mockFamily, childScopeVersion: 2, selectedChildId: id(9), selectedChild: { childId: id(9), name: '孩子9' } };
  parentApi.getGrowthTask.mockRejectedValue(fail(404, 'RESOURCE_NOT_FOUND'));
  view.refresh();
  await act(async () => pending.resolve({ task: task({ subject: '迟到私有学科' }) }));
  expect(screen.queryByDisplayValue('迟到私有学科')).not.toBeInTheDocument();
});

test('child late list success cannot restore old private rows after same-role account switch', async () => {
  const pending = deferred(); childApi.listOwnMistakes.mockReturnValueOnce(pending.promise);
  show('/child/mistakes');
  await waitFor(() => expect(childApi.listOwnMistakes).toHaveBeenCalledTimes(1));
  act(() => saveChildSession(childSession(9)));
  await screen.findByText('暂无待复习错题。');
  await act(async () => pending.resolve({ items: [mistake({ knowledgePointName: '旧账号私有题目' })] }));
  expect(screen.queryByText('旧账号私有题目')).not.toBeInTheDocument();
});

test.each([401, 403])('child late %s review failure cannot clear a new account draft', async status => {
  const user = userEvent.setup(), pending = deferred();
  childApi.listOwnMistakes.mockResolvedValueOnce({ items: [mistake()] });
  childApi.reviewOwnMistake.mockReturnValue(pending.promise);
  show('/child/mistakes');
  await user.click(await screen.findByRole('button', { name: '我还不会 权威错题' }));
  act(() => saveChildSession(childSession(9)));
  await user.click(await screen.findByRole('button', { name: '记录新错题' }));
  await user.type(screen.getByLabelText('科目'), '新账号草稿');
  await act(async () => pending.reject(fail(status, 'CHILD_ACCESS_DENIED')));
  expect(screen.getByLabelText('科目')).toHaveValue('新账号草稿');
  expect(screen.queryByText('当前身份无法继续查看或修改错题。')).not.toBeInTheDocument();
});

test('parent same-child scopeVersion change clears old form and ignores late save', async () => {
  const user = userEvent.setup(), pending = deferred();
  parentApi.createMistake.mockReturnValue(pending.promise);
  const view = show(); await screen.findByText('暂无错题');
  await user.click(screen.getByRole('button', { name: '记录错题' }));
  await user.type(screen.getByLabelText('学科'), '旧私有学科');
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  mockFamily = { ...mockFamily, childScopeVersion: 2 }; view.refresh();
  await act(async () => pending.resolve({ mistake: mistake({ knowledgePointName: '旧成功' }) }));
  expect(screen.queryByLabelText('学科')).not.toBeInTheDocument();
  expect(screen.queryByText('旧成功')).not.toBeInTheDocument();
  expect(screen.queryByText('错题已记录。')).not.toBeInTheDocument();
});

test('current parent media 403 clears the complete private editor', async () => {
  const user = userEvent.setup(); parentApi.uploadPrivateMedia.mockRejectedValue(fail(403, 'CHILD_ACCESS_DENIED'));
  show(); await screen.findByText('暂无错题');
  await user.click(screen.getByRole('button', { name: '记录错题' }));
  await user.type(screen.getByLabelText('学科'), '失权私有草稿');
  await user.upload(screen.getByLabelText('题目附件'), new File(['synthetic'], '合成.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(screen.queryByDisplayValue('失权私有草稿')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '保存错题' })).not.toBeInTheDocument();
});

test('current child media 403 clears rows and draft, without a late callback restoring them', async () => {
  const user = userEvent.setup(); childApi.uploadOwnPrivateMedia.mockRejectedValue(fail(403, 'CHILD_ACCESS_DENIED'));
  childApi.listOwnMistakes.mockResolvedValue({ items: [mistake()] });
  show('/child/mistakes'); await screen.findByText('权威错题');
  await user.click(screen.getByRole('button', { name: '记录新错题' }));
  await user.type(screen.getByLabelText('科目'), '失权私有草稿');
  await user.upload(screen.getByLabelText('题目附件'), new File(['synthetic'], '合成.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(screen.queryByDisplayValue('失权私有草稿')).not.toBeInTheDocument());
  expect(screen.queryByText('权威错题')).not.toBeInTheDocument();
});
