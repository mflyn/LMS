import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskCompletionEvidence from '../../components/family/TaskCompletionEvidence';
import ChildTaskPage from '../../pages/child/ChildTaskPage';
import { useTaskCompletion } from '../../hooks/useTaskCompletion';
import { captureSession, isSessionCurrent, loadChildSession, subscribeSessionChanges } from '../../services/familySession';
import { getOwnPrivateMediaAccess } from '../../services/childApi';

jest.mock('../../hooks/useTaskCompletion', () => ({ useTaskCompletion: jest.fn() }));
jest.mock('../../services/familySession', () => ({
  captureSession: jest.fn(), isSessionCurrent: jest.fn(), loadChildSession: jest.fn(() => ({ child: {
    childId: '000000000000000000000002', familyId: '000000000000000000000001'
  } })), subscribeSessionChanges: jest.fn()
}));
jest.mock('../../services/childApi', () => ({
  getOwnTask: jest.fn(), completeOwnTask: jest.fn(), getOwnCompletionRecovery: jest.fn(), recoverOwnTaskCompletion: jest.fn(),
  uploadOwnPrivateMedia: jest.fn(), getOwnPrivateMediaAccess: jest.fn(), deleteOwnPrivateMedia: jest.fn()
}));
jest.mock('../../components/family/TaskCompletionMedia', () => function MediaBoundary(props) {
  return <div aria-label="作品控件">
    <span>{props.values.join(',')}</span>
    {!props.readOnly && <button type="button" disabled={props.disabled} onClick={() => props.onChange(['000000000000000000000004'])}>选择合成作品</button>}
    <button type="button" onClick={() => props.onBusyChange(true)}>模拟上传中</button>
    <button type="button" onClick={() => props.onBusyChange(false)}>模拟上传完成</button>
  </div>;
});

const id = value => String(value).padStart(24, '0');
const task = (patch = {}) => ({ taskId: id(3), familyId: id(1), childId: id(2), title: '合成跳绳任务',
  status: 'pending', completionVersion: 2, checklistVersion: 1, completionMediaReferenceState: 'stable',
  completionMediaIds: [], checklistSnapshot: [{ itemId: 'warmup', label: '完成热身', required: true }],
  ...patch });
const controller = (patch = {}) => ({ state: 'ready', task: task(), editable: true, busy: false,
  submit: jest.fn(), retry: jest.fn(), recover: jest.fn(), refresh: jest.fn(), ...patch });
const mediaApi = { uploadPrivateMedia: jest.fn(), getPrivateMediaAccess: jest.fn(), deletePrivateMedia: jest.fn() };
const mount = (c, props = {}) => render(<TaskCompletionEvidence controller={c} scopeKey="student:scope:revision1" childId={id(2)} mediaApi={mediaApi} {...props} />);

beforeEach(() => {
  jest.clearAllMocks();
  captureSession.mockReturnValue({ role: 'student', actorId: id(2), childId: id(2), familyId: id(1), revision: 'r1', token: 'synthetic' });
  loadChildSession.mockReturnValue({ child: { childId: id(2), familyId: id(1) } });
  isSessionCurrent.mockReturnValue(true);
  subscribeSessionChanges.mockReturnValue(() => {});
});

test('completed work shows nested self review and feedback before explicit modification', () => {
  const c = controller({ task: task({ status: 'completed', completionMediaIds: [id(4)], actualMinutes: 99,
    completionEvidence: { actualMinutes: 0, actualAmount: 5, difficulty: 'hard', needsHelp: true,
      childNote: '合成完成记录', checkedItemIds: ['warmup'] }, parentFeedback: '合成家长反馈', starAwardState: 'not_applicable' }) });
  mount(c);
  expect(screen.getByText('合成完成记录')).toBeInTheDocument();
  expect(screen.getByText('合成家长反馈')).toBeInTheDocument();
  expect(screen.getByText('0 分钟')).toBeInTheDocument();
  expect(screen.getByText('作品版本 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '修改本次完成' }));
  expect(screen.getByLabelText('实际用时（分钟）')).toHaveValue(0);
  expect(screen.getByLabelText(/完成热身/)).toBeChecked();
  fireEvent.change(screen.getByLabelText('我的一句话'), { target: { value: ' 修改后的记录 ' } });
  fireEvent.click(screen.getByRole('button', { name: '提交修改' }));
  expect(c.submit).toHaveBeenCalledWith({ actualMinutes: 0, actualAmount: 5, difficulty: 'hard', needsHelp: true,
    childNote: '修改后的记录', checkedItemIds: ['warmup'], completionMediaIds: [id(4)] });
});

test('empty actual values are omitted, zero survives, and checklist and media flow to the controller', () => {
  const c = controller(); mount(c);
  fireEvent.click(screen.getByLabelText(/完成热身/));
  fireEvent.change(screen.getByLabelText('实际用时（分钟）'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '选择合成作品' }));
  fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));
  expect(c.submit).toHaveBeenCalledWith({ actualMinutes: 0, difficulty: 'normal', needsHelp: false, childNote: '',
    checkedItemIds: ['warmup'], completionMediaIds: [id(4)] });
  expect(mediaApi.deletePrivateMedia).not.toHaveBeenCalled();
});

test.each(['confirmed', 'cancelled', 'archived'])('%s is read-only, without inferring star payment', status => {
  const c = controller({ editable: false, task: task({ status, starAwardState: 'pending', parentFeedback: '保留的反馈' }) });
  mount(c);
  expect(screen.getByText('保留的反馈')).toBeInTheDocument();
  expect(screen.queryByLabelText('实际用时（分钟）')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '修改本次完成' })).not.toBeInTheDocument();
  expect(screen.queryByText('星星已到账')).not.toBeInTheDocument();
});

test('only the awarded state shows star payment and parent read-only mode suppresses editing', () => {
  mount(controller({ task: task({ status: 'completed', starAwardState: 'awarded' }) }), { allowEdit: false });
  expect(screen.getByText('星星已到账')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '修改本次完成' })).not.toBeInTheDocument();
});

test('upload activity disables submission until media settles', () => {
  const c = controller(); mount(c);
  fireEvent.click(screen.getByRole('button', { name: '模拟上传中' }));
  expect(screen.getByRole('button', { name: '提交完成情况' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('button', { name: '提交完成情况' }).closest('form'));
  expect(c.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '模拟上传完成' }));
  expect(screen.getByRole('button', { name: '提交完成情况' })).toBeEnabled();
});

test('unchecked required checklist items are submitted honestly rather than blocking completion', () => {
  const c = controller(); mount(c);
  fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));
  expect(c.submit).toHaveBeenCalledWith(expect.objectContaining({ checkedItemIds: [], completionMediaIds: [] }));
});

test('confirm uncertainty with pending media offers recovery instead of confirm retry', () => {
  const c = controller({ state: 'uncertain', editable: false, command: { action: 'confirm' },
    task: task({ completionMediaReferenceState: 'pending_recovery' }), recovery: { state: 'recoverable' } });
  mount(c);
  expect(screen.queryByRole('button', { name: /重试本次/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '继续上次提交' }));
  expect(c.recover).toHaveBeenCalledTimes(1); expect(c.retry).not.toHaveBeenCalled();
});

test('taskless load failure keeps success message, error and explicit refresh visible', () => {
  const c = controller({ task: null, state: 'error', editable: false, message: '提交结果已确认。', error: '详情加载失败，请重试。' });
  mount(c);
  expect(screen.getByText('提交结果已确认。')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('详情加载失败');
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  expect(c.refresh).toHaveBeenCalledTimes(1);
});

test('unknown command offers only original retry and readonly refresh, with no automatic writes', () => {
  const c = controller({ state: 'uncertain', editable: false, command: { action: 'complete' } }); mount(c);
  expect(c.retry).not.toHaveBeenCalled(); expect(c.submit).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('实际用时（分钟）')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试本次提交' }));
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  expect(c.retry).toHaveBeenCalledTimes(1); expect(c.refresh).toHaveBeenCalledTimes(1);
});

test.each(['recoverable', 'other_actor', 'none'])('recovery %s never writes until the original actor explicitly requests it', state => {
  const c = controller({ state: 'recovery', editable: false, recovery: { state } }); mount(c);
  expect(c.recover).not.toHaveBeenCalled();
  if (state === 'recoverable') {
    fireEvent.click(screen.getByRole('button', { name: '继续上次提交' }));
    expect(c.recover).toHaveBeenCalledTimes(1);
  } else expect(screen.queryByRole('button', { name: '继续上次提交' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('实际用时（分钟）')).not.toBeInTheDocument();
});

test('lost identity hides private content even if the controller still carries an old task', () => {
  mount(controller({ state: 'awaiting_auth', task: task({ parentFeedback: '不应保留的反馈' }) }));
  expect(screen.queryByText('不应保留的反馈')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('作品控件')).not.toBeInTheDocument();
});

test('scope changes discard the previous draft without deleting media', () => {
  const c = controller(); const view = mount(c);
  fireEvent.change(screen.getByLabelText('我的一句话'), { target: { value: '旧身份草稿' } });
  view.rerender(<TaskCompletionEvidence controller={c} scopeKey="student:scope:revision2" childId={id(2)} mediaApi={mediaApi} />);
  expect(screen.getByLabelText('我的一句话')).toHaveValue('');
  expect(mediaApi.deletePrivateMedia).not.toHaveBeenCalled();
});

test('child page memoizes scope/session/API, captures media requests and clears on identity change', async () => {
  const c = controller(); useTaskCompletion.mockReturnValue(c);
  const page = <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/child/tasks/${id(3)}`]}><Routes>
    <Route path="/child/tasks/:taskId" element={<ChildTaskPage />} />
  </Routes></MemoryRouter>;
  const view = render(page);
  const first = useTaskCompletion.mock.calls[0][0];
  expect(first.scope).toEqual({ role: 'student', actorId: id(2), familyId: id(1), childId: id(2), taskId: id(3) });
  view.rerender(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/child/tasks/${id(3)}`]}><Routes>
    <Route path="/child/tasks/:taskId" element={<ChildTaskPage />} />
  </Routes></MemoryRouter>);
  const last = useTaskCompletion.mock.calls.at(-1)[0];
  expect(last.scope).toBe(first.scope); expect(last.session).toBe(first.session); expect(last.api).toBe(first.api);
  const change = subscribeSessionChanges.mock.calls[0][0];
  captureSession.mockReturnValue(null); isSessionCurrent.mockReturnValue(false);
  act(() => change());
  expect(screen.queryByRole('heading', { name: '合成跳绳任务' })).not.toBeInTheDocument();
  expect(getOwnPrivateMediaAccess).not.toHaveBeenCalled();
});
