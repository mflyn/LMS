import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from '../../pages/family/TasksPage';
import { saveParentSession } from '../../services/familySession';
import * as api from '../../services/familyApi';

jest.mock('../../services/familyApi');
let mockFamily;
let mockRealMedia = false;
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
jest.mock('../../components/family/PrivateMediaCollectionField', () => function Media(props) {
  if (mockRealMedia) {
    const Real = jest.requireActual('../../components/family/PrivateMediaCollectionField').default;
    return <Real {...props} />;
  }
  return <div aria-label="合成材料控件"><span>{props.values.join(',')}</span>
    {!props.readOnly && <button type="button" onClick={() => {
      props.onUploaded('000000000000000000000009'); props.onChange(['000000000000000000000009']);
    }}>合成上传材料</button>}</div>;
});

const id = n => String(n).padStart(24, '0');
const checklist = [{ itemId: 'Read', label: '读题', required: true }, { itemId: 'check', label: '检查答案', required: false }];
const task = (patch = {}) => ({ taskId: id(4), childId: id(2), familyId: id(3), title: '合成自检任务',
  dimension: 'academic', subject: '数学', area: '数学', taskType: 'practice', description: '', dueDate: '2026-10-26',
  estimatedMinutes: 10, targetAmount: '', unit: '', priority: 'medium', status: 'pending', attachmentMediaIds: [],
  checklistSnapshot: checklist, checklistVersion: 1, ...patch });
const failure = (status, code) => ({ response: { status, data: { error: { code, message: code } } } });
const tree = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TasksPage /></MemoryRouter>;
const open = async user => { render(tree()); await user.click(await screen.findByRole('button', { name: '编辑 合成自检任务' })); };
beforeEach(() => {
  mockRealMedia = false;
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  saveParentSession({ token: 'synthetic-t4', user: { id: id(1), role: 'parent', name: '合成家长' } });
  mockFamily = { family: { familyId: id(3) }, selectedChildId: id(2), selectedChild: { childId: id(2), name: '合成孩子' }, childScopeVersion: 1 };
  api.listGrowthTasks.mockResolvedValue({ items: [task()], total: 1, page: 1, pageSize: 20 });
  api.listCompletionRecoveries.mockResolvedValue({ items: [] });
  api.getGrowthTask.mockResolvedValue({ task: task() });
  api.updateGrowthTask.mockImplementation(async (_id, payload) => ({ task: task({ ...payload,
    checklistVersion: payload.expectedChecklistVersion === undefined ? 1 : payload.expectedChecklistVersion + 1 }) }));
  api.createGrowthTask.mockImplementation(async payload => ({ task: task(payload) }));
  api.deletePrivateMedia.mockResolvedValue({});
});

test('edit/reorder/remove retains stable IDs, sends expected version and never a result version', async () => {
  const user = userEvent.setup(); await open(user);
  await user.clear(screen.getByLabelText('检查项 1')); await user.type(screen.getByLabelText('检查项 1'), '再读一遍题目');
  await user.click(screen.getByRole('button', { name: '下移检查项 1' }));
  expect(screen.getByLabelText('检查项 2')).toHaveValue('再读一遍题目');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask).toHaveBeenCalledTimes(1);
  const sent = api.updateGrowthTask.mock.calls[0][1];
  expect(sent).toMatchObject({ expectedChecklistVersion: 1, checklistSnapshot: [checklist[1], { ...checklist[0], label: '再读一遍题目' }] });
  expect(sent).not.toHaveProperty('checklistVersion');
  await user.click(await screen.findByRole('button', { name: '编辑 合成自检任务' }));
  await user.click(screen.getByRole('button', { name: '删除检查项 1' }));
  await user.click(screen.getByRole('button', { name: '删除检查项 1' }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[1][1]).toMatchObject({ checklistSnapshot: [], expectedChecklistVersion: 2 });
});

test('ordinary edit omits unchanged checklist fields', async () => {
  const user = userEvent.setup(); await open(user);
  await user.type(screen.getByLabelText('任务标题'), '补充'); await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('checklistSnapshot');
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('expectedChecklistVersion');
});

test.each(['pending', 'resolved'])('checklist save renders authoritative %s help from the mutation DTO without another read', async status => {
  api.listGrowthTasks.mockResolvedValue({ items: [task({ helpVersion: 1,
    helpRequest: { status: 'pending', helpType: 'instruction_unclear', note: 'Initial help' } })], total: 1 });
  // Explicit public mutation DTO, not a spread of the list's old task/help object.
  api.updateGrowthTask.mockResolvedValue({ task: {
    taskId: id(4), familyId: id(3), childId: id(2), createdByParentId: id(1),
    title: '合成自检任务', dimension: 'academic', subject: '数学', area: '数学', taskType: 'practice',
    dueDate: '2026-10-26', status: 'pending', priority: 'medium', attachmentMediaIds: [],
    checklistVersion: 2, checklistSnapshot: [{ itemId: 'Read', label: '新清单', required: true }, checklist[1]],
    completionVersion: 0, completionMediaIds: [], completionEvidence: null,
    completionMediaReferenceState: 'stable', parentConfirmed: false,
    helpVersion: status === 'pending' ? 1 : 2,
    helpRequest: { status, helpType: 'instruction_unclear', note: 'Authoritative help',
      requestedByActor: { id: id(2), role: 'student' },
      ...(status === 'resolved' ? { parentResponse: 'Answered', resolvedByActor: { id: id(1), role: 'parent' } } : {}) }
  } });
  const user = userEvent.setup(); await open(user);
  const listCalls = api.listGrowthTasks.mock.calls.length, detailCalls = api.getGrowthTask.mock.calls.length;
  expect(screen.getByText(/待处理求助 ·/)).toBeInTheDocument();
  await user.clear(screen.getByLabelText('检查项 1')); await user.type(screen.getByLabelText('检查项 1'), '新清单');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText(status === 'pending' ? /待处理求助 ·/ : /求助已处理 ·/)).toBeInTheDocument();
  if (status === 'resolved') expect(screen.queryByText(/待处理求助 ·/)).not.toBeInTheDocument();
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('attachmentMediaIds');
  expect(api.listGrowthTasks).toHaveBeenCalledTimes(listCalls);
  expect(api.getGrowthTask).toHaveBeenCalledTimes(detailCalls);
});

test('checklist edit never sends an unchanged stale material snapshot owned by another parent update', async () => {
  api.listGrowthTasks.mockResolvedValue({ items: [task({ attachmentMediaIds: [id(7)] })], total: 1 });
  const user = userEvent.setup(); await open(user);
  await user.type(screen.getByLabelText('检查项 1'), '修改');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[0][1]).toMatchObject({ expectedChecklistVersion: 1 });
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('attachmentMediaIds');
});

test('create supports five items and blocks whitespace without calling API', async () => {
  const user = userEvent.setup(); render(tree());
  await user.click(await screen.findByRole('button', { name: '新建任务' }));
  await user.type(screen.getByLabelText('学科'), '数学'); await user.type(screen.getByLabelText('任务标题'), '新任务');
  await user.type(screen.getByLabelText('活动领域'), '练习'); await user.type(screen.getByLabelText('截止日期'), '2026-10-26');
  for (let n = 1; n <= 5; n += 1) {
    await user.click(screen.getByRole('button', { name: '添加检查项' }));
    await user.type(screen.getByLabelText(`检查项 ${n}`), n === 1 ? '   ' : `检查${n}`);
  }
  expect(screen.getByRole('button', { name: '添加检查项' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.createGrowthTask).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('1 至 100 字');
  await user.clear(screen.getByLabelText('检查项 1')); await user.type(screen.getByLabelText('检查项 1'), '  阅读  ');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  const sent = api.createGrowthTask.mock.calls[0][0];
  expect(sent.checklistSnapshot).toHaveLength(5); expect(new Set(sent.checklistSnapshot.map(row => row.itemId)).size).toBe(5);
  expect(sent.checklistSnapshot[0].label).toBe('阅读'); expect(sent).not.toHaveProperty('checklistVersion');
  expect(sent).not.toHaveProperty('expectedChecklistVersion');
});

test('create explicitly sends an empty checklist without a client version', async () => {
  const user = userEvent.setup(); render(tree());
  await user.click(await screen.findByRole('button', { name: '新建任务' }));
  await user.type(screen.getByLabelText('学科'), '数学'); await user.type(screen.getByLabelText('任务标题'), '无清单任务');
  await user.type(screen.getByLabelText('活动领域'), '练习'); await user.type(screen.getByLabelText('截止日期'), '2026-10-26');
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
  expect(api.createGrowthTask.mock.calls[0][0]).toMatchObject({ checklistSnapshot: [] });
  expect(api.createGrowthTask.mock.calls[0][0]).not.toHaveProperty('expectedChecklistVersion');
  expect(api.createGrowthTask.mock.calls[0][0]).not.toHaveProperty('checklistVersion');
});

test('legacy missing checklist starts at zero and optional null fields remain controlled after reread', async () => {
  const legacy = task({ checklistSnapshot: undefined, checklistVersion: undefined,
    description: null, estimatedMinutes: null, targetAmount: undefined, unit: null });
  api.listGrowthTasks.mockResolvedValue({ items: [legacy], total: 1 });
  const user = userEvent.setup(); await open(user);
  expect(screen.getByLabelText('说明')).toHaveValue('');
  expect(screen.getByLabelText('预计用时（分钟）')).toHaveValue(null);
  await user.click(screen.getByRole('button', { name: '添加检查项' }));
  await user.type(screen.getByLabelText('检查项 1'), '读题');
  api.updateGrowthTask.mockRejectedValueOnce(Error('Synthetic lost response'));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[0][1].expectedChecklistVersion).toBe(0);
  api.getGrowthTask.mockResolvedValue({ task: legacy });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(screen.getByLabelText('说明')).toHaveValue('');
  expect(screen.getByLabelText('单位')).toHaveValue('');
  expect(screen.getByLabelText('目标数量')).toHaveValue(null);
  expect(screen.queryByLabelText('检查项 1')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存任务' })).toBeEnabled();
});

test.each([false, true])('unknown create never repeats POST; known resource=%s uses only the original attachment continuation', async known => {
  const user = userEvent.setup(); render(tree());
  await user.click(await screen.findByRole('button', { name: '新建任务' }));
  await user.type(screen.getByLabelText('学科'), '数学'); await user.type(screen.getByLabelText('任务标题'), '待恢复创建');
  await user.type(screen.getByLabelText('活动领域'), '练习'); await user.type(screen.getByLabelText('截止日期'), '2026-10-26');
  await user.click(screen.getByRole('button', { name: '添加检查项' }));
  await user.type(screen.getByLabelText('检查项 1'), '原创建清单');
  await user.click(screen.getByRole('button', { name: '合成上传材料' }));
  const cause = failure(503, 'MEDIA_REFERENCE_PENDING');
  cause.response.data.error.details = { resourceId: id(4) };
  api.createGrowthTask.mockRejectedValueOnce(known ? cause : Error('Synthetic create response lost'));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(screen.getByRole('button', { name: '保存任务' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  if (known) {
    expect(screen.getByLabelText('检查项 1')).toHaveValue('原创建清单');
    expect(screen.getByLabelText('检查项 1')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '继续原修改' }));
    expect(api.updateGrowthTask.mock.calls).toEqual([[id(4), { attachmentMediaIds: [id(9)] }]]);
  } else {
    expect(api.updateGrowthTask).not.toHaveBeenCalled();
    expect(api.getGrowthTask).not.toHaveBeenCalled();
    expect(screen.getByText('请核对任务列表，避免重复新建。')).toBeInTheDocument();
  }
  expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('version conflict freezes old editor until an explicit read, then uses the newly viewed version', async () => {
  const user = userEvent.setup(); await open(user);
  api.updateGrowthTask.mockRejectedValueOnce(failure(409, 'VERSION_CONFLICT'));
  await user.type(screen.getByLabelText('检查项 1'), '旧稿'); await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(screen.getByLabelText('检查项 1')).toBeDisabled(); expect(api.getGrowthTask).not.toHaveBeenCalled();
  api.getGrowthTask.mockResolvedValue({ task: task({ checklistVersion: 4, checklistSnapshot: [{ ...checklist[0], label: '共管家长的新清单' }] }) });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(screen.getByLabelText('检查项 1')).toHaveValue('共管家长的新清单');
  await user.type(screen.getByLabelText('检查项 1'), '补充'); await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[1][1].expectedChecklistVersion).toBe(4);
});

test('network unknown freezes the command and rereads instead of blind patch retry', async () => {
  const user = userEvent.setup(); await open(user);
  api.updateGrowthTask.mockRejectedValueOnce(Error('Synthetic response lost'));
  await user.type(screen.getByLabelText('检查项 1'), '修改'); await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(screen.getByRole('button', { name: '保存任务' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '继续原修改' })).not.toBeInTheDocument();
  const sent = api.updateGrowthTask.mock.calls[0][1];
  api.getGrowthTask.mockResolvedValue({ task: task({ ...sent, checklistVersion: 2 }) });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(api.updateGrowthTask).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('检查项 1')).toHaveValue('读题修改');
  expect(screen.getByRole('button', { name: '保存任务' })).toBeEnabled();
});

test('material pending retry preserves original mixed body and does not rebase after read', async () => {
  const user = userEvent.setup(); await open(user);
  api.updateGrowthTask.mockRejectedValueOnce(failure(503, 'MEDIA_REFERENCE_PENDING'));
  await user.type(screen.getByLabelText('检查项 1'), '修改'); await user.click(screen.getByRole('button', { name: '合成上传材料' }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  const sent = api.updateGrowthTask.mock.calls[0][1];
  const original = { ...sent, attachmentMediaIds: [...sent.attachmentMediaIds],
    checklistSnapshot: sent.checklistSnapshot.map(row => ({ ...row })) };
  api.getGrowthTask.mockResolvedValue({ task: task({ ...original, checklistVersion: 2 }) });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(screen.getByLabelText('检查项 1')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '继续原修改' }));
  expect(api.updateGrowthTask.mock.calls[1]).toEqual([id(4), original]);
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each([undefined, 502])('mixed request with lost error code (%s) retains exact original after reading old public snapshot', async status => {
  const user = userEvent.setup(); await open(user);
  api.updateGrowthTask.mockRejectedValueOnce(status ? failure(status, 'UPSTREAM_UNAVAILABLE') : Error('Synthetic disconnected response'));
  await user.type(screen.getByLabelText('检查项 1'), '原修改');
  await user.type(screen.getByLabelText('任务标题'), '原标题');
  await user.click(screen.getByRole('button', { name: '合成上传材料' }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  const sent = api.updateGrowthTask.mock.calls[0][1];
  const original = { ...sent, attachmentMediaIds: [...sent.attachmentMediaIds],
    checklistSnapshot: sent.checklistSnapshot.map(item => ({ ...item })) };
  api.getGrowthTask.mockResolvedValue({ task: task() });
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(screen.getByLabelText('检查项 1')).toHaveValue('读题原修改');
  expect(screen.getByLabelText('检查项 1')).toBeDisabled();
  expect(screen.getByRole('button', { name: '保存任务' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '继续原修改' }));
  expect(api.updateGrowthTask.mock.calls).toEqual([[id(4), original], [id(4), original]]);
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});

test('a real media upload finishing after close cannot enter the next task editor or its drafts', async () => {
  mockRealMedia = true;
  api.listGrowthTasks.mockResolvedValue({ items: [task(), task({ taskId: id(5), title: '任务B' })], total: 2 });
  let finish;
  api.uploadPrivateMedia.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const user = userEvent.setup(); await open(user);
  await user.upload(screen.getByLabelText('任务附件'), new File(['synthetic'], 'a.png', { type: 'image/png' }));
  expect(api.uploadPrivateMedia).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '保存任务' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '关闭', exact: true }));
  await user.click(screen.getByRole('button', { name: '编辑 任务B' }));
  await act(async () => finish({ media: { mediaId: id(9), displayName: 'a.png', mimeType: 'image/png' } }));
  expect(screen.getByText('已添加 0/100')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '移除任务附件 1' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[0][0]).toBe(id(5));
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('attachmentMediaIds');
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});

test('the old upload finally cannot unlock the current editor while its own upload is still running', async () => {
  mockRealMedia = true;
  let finishOld, finishNew;
  api.uploadPrivateMedia.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
  const user = userEvent.setup(); await open(user);
  await user.upload(screen.getByLabelText('任务附件'), new File(['old'], 'old.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: '关闭', exact: true }));
  await user.click(screen.getByRole('button', { name: '编辑 合成自检任务' }));
  await user.upload(screen.getByLabelText('任务附件'), new File(['new'], 'new.png', { type: 'image/png' }));
  await act(async () => finishOld({ media: { mediaId: id(9), mimeType: 'image/png' } }));
  expect(screen.getByRole('button', { name: '保存任务' })).toBeDisabled();
  expect(screen.getByText('已添加 0/100')).toBeInTheDocument();
  await act(async () => finishNew({ media: { mediaId: id(10), mimeType: 'image/png' } }));
  expect(screen.getByRole('button', { name: '保存任务' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  expect(api.updateGrowthTask.mock.calls[0][1].attachmentMediaIds).toEqual([id(10)]);
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});

test('recovery read 403 clears private editor without deleting submitted uploads', async () => {
  const user = userEvent.setup(); await open(user);
  api.updateGrowthTask.mockRejectedValueOnce(Error('Synthetic lost response'));
  await user.click(screen.getByRole('button', { name: '合成上传材料' }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  api.getGrowthTask.mockRejectedValueOnce(failure(403, 'CHILD_ACCESS_DENIED'));
  api.listGrowthTasks.mockRejectedValue(failure(403, 'CHILD_ACCESS_DENIED'));
  await user.click(screen.getByRole('button', { name: '重新读取任务' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText(id(9))).not.toBeInTheDocument();
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});

test('list 403 invalidates an in-flight editor success, including private task data', async () => {
  const user = userEvent.setup(); await open(user);
  let finish; api.updateGrowthTask.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  api.listGrowthTasks.mockRejectedValueOnce(failure(403, 'CHILD_ACCESS_DENIED'));
  fireEvent.change(screen.getByLabelText('求助状态'), { target: { value: 'pending' } });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () => finish({ task: task({ title: '迟到私有内容' }) }));
  expect(screen.queryByText('迟到私有内容')).not.toBeInTheDocument();
  expect(screen.queryByText('任务已更新。')).not.toBeInTheDocument();
});

test('account switch discards the editor and late success without deleting with the new credentials', async () => {
  const user = userEvent.setup(); await open(user);
  await user.click(screen.getByRole('button', { name: '合成上传材料' }));
  let finish; api.updateGrowthTask.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存任务' }));
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  await act(async () => saveParentSession({ token: 'other-parent', user: { id: id(8), role: 'parent' } }));
  await act(async () => finish({ task: task({ title: '旧账号迟到内容' }) }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('旧账号迟到内容')).not.toBeInTheDocument();
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});

test.each(['completed', 'confirmed', 'cancelled', 'archived'])('%s tasks do not expose checklist editing', async status => {
  api.listGrowthTasks.mockResolvedValue({ items: [task({ status })], total: 1 }); render(tree());
  await screen.findByText('合成自检任务');
  expect(screen.queryByRole('button', { name: '编辑 合成自检任务' })).not.toBeInTheDocument();
});
