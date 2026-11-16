import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TutorPage from '../../pages/family/TutorPage';
import { tutorApi } from '../../services/tutorApi';
import { saveParentSession, clearParentSession, captureSession } from '../../services/familySession';
import { readTutorCommand, tutorCommandKey } from '../../services/tutorCommands';
import { resetChildScope } from '../../services/childScope';

jest.mock('../../services/tutorApi', () => ({ tutorApi: Object.fromEntries(
  ['cycles', 'jobs', 'detail', 'job', 'artifact', 'create', 'generate', 'recover', 'revise', 'review', 'close'].map(k => [k, jest.fn()])) }));
let mockChildId = 'c'.repeat(24);
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({
  family: { familyId: 'b'.repeat(24) }, selectedChildId: mockChildId, childScopeVersion: 1 }) }));
const actor = 'a'.repeat(24), childId = 'c'.repeat(24), cycleId = 'd'.repeat(24), sourceId = 'e'.repeat(24);
const scope = { familyId: 'b'.repeat(24), childId };
const rejection = (status, code) => ({ response: { status, data: { success: false, error: { code } } } });
const disabled = rejection(503, 'AI_DISABLED');
const preview = { generationInputHash: 'f'.repeat(64), modelProfileVersion: 'synthetic-model', pricingProfileVersion: 'synthetic-price',
  messages: [{ role: 'system', content: '完整合成系统提示' }, { role: 'user', content: '完整合成题目' }], reservedCeilingMicros: 184320,
  sendNotAfter: '2099-01-01T00:00:00.000Z', requestOptions: { model: 'synthetic-only', maxInputTokens: 8192, maxOutputTokens: 4096 } };
const cycle = { id: cycleId, childId, status: 'ready', stateVersion: 1, source: { type: 'task', id: sourceId }, createdBy: actor };
const detail = { cycle, preview, artifacts: [], job: null };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const original = () => readTutorCommand(scope, captureSession('parent'));
const show = (query = `sourceType=task&sourceId=${sourceId}&childId=${childId}`) => render(
  <MemoryRouter initialEntries={[`/app/tutor?${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TutorPage /></MemoryRouter>);
const create = async () => {
  fireEvent.change(screen.getByLabelText('题目文字'), { target: { value: '合成数学测试：12乘以3。' } });
  fireEvent.click(screen.getByLabelText('已核对文字，不含个人信息或链接'));
  fireEvent.click(screen.getByRole('button', { name: '创建外发预览' }));
  await waitFor(() => expect(tutorApi.create).toHaveBeenCalledTimes(1));
};
beforeEach(() => {
  jest.resetAllMocks(); mockChildId = childId; localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-only', user: { id: actor, role: 'parent' } });
  tutorApi.cycles.mockResolvedValue({ items: [] }); tutorApi.jobs.mockResolvedValue({ items: [] });
  tutorApi.create.mockRejectedValue(disabled); tutorApi.detail.mockResolvedValue(detail);
});

test('settled lists before disabled create retain the rejection and original command', async () => {
  show(); await screen.findByText('暂无讲解记录'); await screen.findByText('暂无待处理任务');
  await create(); await screen.findByText('AI 生成尚未启用。');
  expect(screen.getByRole('alert')).toHaveTextContent('AI 生成尚未启用。');
  expect(original().action).toBe('create'); expect(tutorApi.generate).not.toHaveBeenCalled();
});

test('both late lists cannot erase the already displayed disabled-create rejection', async () => {
  const cycles = deferred(), jobs = deferred();
  tutorApi.cycles.mockReturnValue(cycles.promise); tutorApi.jobs.mockReturnValue(jobs.promise);
  const view = show();
  try {
    await create(); await screen.findByText('AI 生成尚未启用。'); const saved = original();
    await act(async () => { cycles.resolve({ items: [] }); jobs.resolve({ items: [] }); });
    await screen.findByText('暂无讲解记录');
    expect(tutorApi.create).toHaveBeenCalledTimes(1); expect(tutorApi.generate).not.toHaveBeenCalled();
    expect(original()).toEqual(saved);
    expect(screen.queryByRole('alert')).toHaveTextContent('AI 生成尚未启用。');
  } finally { view.unmount(); cycles.resolve({ items: [] }); jobs.resolve({ items: [] }); }
});

test.each(['cycles', 'jobs'].flatMap(kind => ['disabled', 'network'].map(failure => [kind, failure])))(
  'late %s success preserves %s create feedback and exact command', async (kind, failure) => {
    const read = deferred(); tutorApi[kind].mockReturnValueOnce(read.promise);
    if (failure === 'network') tutorApi.create.mockRejectedValue(new Error('lost response'));
    const view = show();
    try {
      await create(); const alert = await screen.findByRole('alert'), text = alert.textContent, saved = original();
      expect(text).toContain(failure === 'disabled' ? 'AI 生成尚未启用。' : '本次结果暂未确认');
      await act(async () => read.resolve({ items: [] }));
      expect(screen.getByRole('alert')).toHaveTextContent(text); expect(original()).toEqual(saved);
      expect(screen.getByRole('button', { name: '创建外发预览' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '重试原命令' })).toBeEnabled();
      expect(tutorApi.create).toHaveBeenCalledTimes(1); expect(tutorApi.generate).not.toHaveBeenCalled();
      view.unmount(); show(); await screen.findByRole('button', { name: '重试原命令' });
      expect(original()).toEqual(saved); expect(tutorApi.create).toHaveBeenCalledTimes(1);
    } finally { view.unmount(); read.resolve({ items: [] }); }
  });

test('pending create is visibly in progress and successful create navigates to full detail without generation', async () => {
  const write = deferred(); tutorApi.create.mockReturnValue(write.promise); show(); await create();
  expect(screen.getByText('正在创建外发预览。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重试原命令' })).toBeDisabled();
  expect(original().body).toEqual(tutorApi.create.mock.calls[0][0]);
  await act(async () => write.resolve({ cycle, preview }));
  const full = await screen.findByRole('region', { name: '完整外发预览' });
  for (const m of preview.messages) expect(within(full).getByText(m.content)).toBeInTheDocument();
  expect(full).toHaveTextContent('0.184320 元'); expect(full).toHaveTextContent('synthetic-model');
  expect(full).toHaveTextContent('synthetic-price'); expect(full).toHaveTextContent(preview.sendNotAfter);
  expect(full).toHaveTextContent('8192 tokens'); expect(full).toHaveTextContent('4096 tokens');
  expect(tutorApi.detail).toHaveBeenCalledWith(cycleId, expect.any(Object));
  expect(original()).toBeNull(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(tutorApi.create).toHaveBeenCalledTimes(1); expect(tutorApi.generate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '生成候选讲解' })).toBeDisabled();
});

test.each(['cycles', 'jobs'])('late %s cannot erase detail failure after committed create; detail retry only reads', async kind => {
  const read = deferred(); tutorApi.create.mockResolvedValue({ cycle, preview });
  tutorApi.detail.mockRejectedValueOnce(new Error('detail unavailable'));
  tutorApi[kind].mockReturnValue(read.promise); const view = show();
  try {
    await create(); await screen.findByRole('button', { name: '刷新详情' });
    const text = (await screen.findByRole('alert')).textContent;
    await act(async () => read.resolve({ items: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent(text); expect(original()).toBeNull();
    expect(screen.queryByRole('region', { name: '完整外发预览' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    await screen.findByRole('region', { name: '完整外发预览' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(tutorApi.detail).toHaveBeenCalledTimes(2); expect(tutorApi.create).toHaveBeenCalledTimes(1);
    expect(tutorApi.generate).not.toHaveBeenCalled();
  } finally { view.unmount(); read.resolve({ items: [] }); }
});

test('each successful read clears only its own failure, not another list or detail error', async () => {
  const jobs = deferred(); tutorApi.jobs.mockReturnValueOnce(jobs.promise);
  tutorApi.cycles.mockRejectedValueOnce(rejection(503, 'AI_STORE_ISOLATED'));
  tutorApi.detail.mockRejectedValueOnce(rejection(503, 'AI_PROFILE_UNAVAILABLE'));
  show(`cycleId=${cycleId}&childId=${childId}`);
  await screen.findByText(/存储连续性待核对/); await screen.findByText(/价格或模型配置暂不可用/);
  await act(async () => jobs.resolve({ items: [] }));
  expect(screen.getByRole('alert')).toHaveTextContent('存储连续性待核对');
  expect(screen.getByRole('alert')).toHaveTextContent('价格或模型配置暂不可用');
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' })); await screen.findByText('完整合成系统提示');
  expect(screen.getByRole('alert')).toHaveTextContent('存储连续性待核对');
  expect(screen.getByRole('alert')).not.toHaveTextContent('价格或模型配置暂不可用');
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(tutorApi.create).not.toHaveBeenCalled(); expect(tutorApi.generate).not.toHaveBeenCalled();
});

test('successful record refresh clears only the read failure while unknown create stays locked to the original command', async () => {
  show(); await screen.findByText('暂无讲解记录'); await create();
  await screen.findByText('AI 生成尚未启用。'); const saved = original();
  tutorApi.cycles.mockRejectedValueOnce(rejection(503, 'AI_STORE_ISOLATED'));
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' }));
  await screen.findByText(/讲解记录读取失败/);
  expect(screen.getByRole('alert').querySelectorAll('p')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('AI 生成尚未启用。'));
  expect(original()).toEqual(saved); expect(tutorApi.create).toHaveBeenCalledTimes(1);
  expect(tutorApi.generate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '创建外发预览' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重试原命令' })).toBeEnabled();
});

test.each([401, 403])('current %s rejects private UI and invalidates late list and create success without finishing command', async status => {
  const write = deferred(), jobs = deferred(); tutorApi.create.mockReturnValue(write.promise); tutorApi.jobs.mockReturnValue(jobs.promise);
  show(); await create(); const saved = original();
  tutorApi.cycles.mockRejectedValueOnce(rejection(status, 'FORBIDDEN'));
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' })); await screen.findByText('当前身份无法继续查看这些私有讲解。');
  await act(async () => { write.resolve({ cycle, preview }); jobs.resolve({ items: [cycle] }); });
  expect(screen.getByRole('alert')).toHaveTextContent('当前身份无法继续查看这些私有讲解。');
  expect(screen.queryByLabelText('题目文字')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '完整外发预览' })).not.toBeInTheDocument();
  expect(original()).toEqual(saved); expect(tutorApi.detail).not.toHaveBeenCalled();
  expect(tutorApi.create).toHaveBeenCalledTimes(1); expect(tutorApi.generate).not.toHaveBeenCalled();
});

test.each(['logout', 'child'])('%s clears draft and late create cannot navigate or recreate original command', async mode => {
  const write = deferred(); tutorApi.create.mockReturnValue(write.promise); show(); await create();
  const oldSession = captureSession('parent'), key = tutorCommandKey(scope, oldSession);
  act(() => {
    if (mode === 'logout') clearParentSession();
    else { mockChildId = '9'.repeat(24); resetChildScope({ previousChildId: childId, nextChildId: mockChildId }); }
  });
  await act(async () => write.resolve({ cycle, preview }));
  expect(screen.queryByLabelText('题目文字')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '完整外发预览' })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(key)).toBeNull();
  if (mode === 'logout') expect(() => readTutorCommand(scope, oldSession)).toThrow('Session changed');
  else expect(readTutorCommand(scope, oldSession)).toBeNull();
  expect(tutorApi.detail).not.toHaveBeenCalled(); expect(tutorApi.generate).not.toHaveBeenCalled();
});
