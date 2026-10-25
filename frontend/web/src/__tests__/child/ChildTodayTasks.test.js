import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App';
import {
  completeOwnTask,
  getOwnCompletionRecovery,
  getOwnPrivateMediaAccess,
  getOwnTask,
  listOwnReminders,
  listOwnTasks,
  recoverOwnTaskCompletion,
  updateOwnTaskHelp
} from '../../services/childApi';
import { captureSession, saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  completeOwnTask: jest.fn(),
  getOwnCompletionRecovery: jest.fn(),
  recoverOwnTaskCompletion: jest.fn(),
  uploadOwnPrivateMedia: jest.fn(),
  deleteOwnPrivateMedia: jest.fn(),
  getOwnPrivateMediaAccess: jest.fn(),
  getOwnTask: jest.fn(),
  listOwnReminders: jest.fn(),
  listOwnTasks: jest.fn(),
  updateOwnTaskHelp: jest.fn()
}));

const id = value => String(value).padStart(24, '0');
const session = {
  token: 'child-token',
  child: { childId: id(2), familyId: id(1), name: '小雨' }
};

const task = (overrides = {}) => ({
  taskId: id(3),
  familyId: id(1),
  childId: id(2),
  checklistVersion: 0,
  checklistSnapshot: [],
  completionVersion: 0,
  completionMediaIds: [],
  completionMediaReferenceState: 'stable',
  starAwardState: 'not_applicable',
  dimension: 'physical',
  area: '跳绳',
  title: '跳绳 500 个',
  taskType: 'exercise',
  description: '分五组完成',
  dueDate: '2026-07-11',
  estimatedMinutes: 20,
  targetAmount: 500,
  unit: '个',
  priority: 'medium',
  status: 'pending',
  ...overrides
});

const completedResponse = (body) => ({ task: {
  taskId: id(3), status: 'completed', parentConfirmed: false,
  completionVersion: body.expectedCompletionVersion + 1, checklistVersion: body.expectedChecklistVersion,
  completionMediaIds: body.completionMediaIds, completionMediaReferenceState: 'stable', completedAt: '2026-10-24T01:00:00.000Z'
} });

const openRoute = (path) => {
  saveChildSession(session);
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

describe('child today page', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    listOwnTasks.mockResolvedValue({ items: [], total: 0 });
    listOwnReminders.mockResolvedValue({ items: [], meta: { partial: false, unavailableSources: [] } });
  });

  test('renders all five dimensions, honest statuses, pending/completed/confirmed links, and reminders', async () => {
    listOwnTasks.mockResolvedValueOnce({
      items: [
        task({ taskId: 'moral', dimension: 'moral', title: '整理诚信记录' }),
        task({ taskId: 'academic', dimension: 'academic', title: '数学练习', status: 'completed' }),
        task({ taskId: 'physical', dimension: 'physical', title: '跳绳 500 个' }),
        task({ taskId: 'artistic', dimension: 'artistic', title: '水彩练习', status: 'confirmed' }),
        task({ taskId: 'labor', dimension: 'labor', title: '整理书桌', status: 'cancelled' })
      ],
      total: 5
    });
    listOwnReminders.mockResolvedValueOnce({
      items: [{ sourceId: 'reminder-a1', title: '晚上八点复习错题' }],
      meta: { partial: false, unavailableSources: [] }
    });

    openRoute('/child/today');

    expect(await screen.findByRole('heading', { name: '今天' })).toBeInTheDocument();
    expect(await screen.findByText('德育')).toBeInTheDocument();
    for (const label of ['德育', '智育', '体育', '美育', '劳育']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('等待家长确认')).toBeInTheDocument();
    expect(screen.getByText('已确认')).toBeInTheDocument();
    expect(screen.queryByText('星星已到账')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /跳绳 500 个/ })).toHaveAttribute('href', '/child/tasks/physical');
    expect(screen.getByRole('link', { name: /数学练习/ })).toHaveAttribute('href', '/child/tasks/academic');
    expect(screen.getByRole('link', { name: /水彩练习/ })).toHaveAttribute('href', '/child/tasks/artistic');
    expect(screen.getByText('晚上八点复习错题')).toBeInTheDocument();
    expect(listOwnTasks).toHaveBeenCalledWith({ scope: 'today', pageSize: 100 }, { signal: expect.any(AbortSignal), session: captureSession('student') });
    expect(listOwnReminders).toHaveBeenCalledWith({}, { signal: expect.any(AbortSignal), session: captureSession('student') });
  });

  test('keeps available reminders visible when tasks have a stable error', async () => {
    listOwnTasks.mockRejectedValueOnce({ response: { status: 400, data: { error: { message: '筛选条件无效' } } } });
    listOwnReminders.mockResolvedValueOnce({
      items: [{ sourceId: 'reminder-a1', title: '继续阅读 20 分钟' }],
      meta: { partial: true, unavailableSources: ['mistakes'] }
    });

    openRoute('/child/today');

    expect(await screen.findByText('继续阅读 20 分钟')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '今天的任务加载失败' })).toBeInTheDocument();
    expect(screen.getByText('筛选条件无效')).toBeInTheDocument();
    const unavailableSources = screen.getByRole('list', { name: '暂不可用的数据来源' });
    expect(within(unavailableSources).getAllByRole('listitem')).toHaveLength(1);
    expect(within(unavailableSources).getByText('错题数据')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();
  });

  test('offers source-specific retry for a retryable reminder failure', async () => {
    listOwnReminders.mockRejectedValueOnce({ response: { status: 503 } });

    openRoute('/child/today');

    const reminderError = await screen.findByRole('group', { name: '今日提醒加载失败' });
    fireEvent.click(withinGroup(reminderError, '重新加载数据'));
    await waitFor(() => expect(listOwnReminders).toHaveBeenCalledTimes(2));
  });

  test('account switch unmounts old rows and ignores the old request arriving last', async () => {
    let resolveOld;
    listOwnTasks.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ items: [task({ taskId: id(4), childId: id(9), title: '新身份任务' })], total: 1 });
    openRoute('/child/today');
    await waitFor(() => expect(listOwnTasks).toHaveBeenCalledTimes(1));
    act(() => saveChildSession({ token: 'synthetic-next', child: { childId: id(9), familyId: id(1), name: '新孩子' } }));
    expect(await screen.findByText('新身份任务')).toBeInTheDocument();
    await act(async () => resolveOld({ items: [task({ title: '旧身份迟到任务' })], total: 1 }));
    expect(screen.queryByText('旧身份迟到任务')).not.toBeInTheDocument();
    expect(screen.getByText('新身份任务')).toBeInTheDocument();
  });
});

const withinGroup = (group, name) => {
  const button = Array.from(group.querySelectorAll('button')).find((item) => item.textContent === name);
  if (!button) throw new Error(`Missing ${name}`);
  return button;
};

describe('child task completion', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test('shows measurable details and sends the approved completion payload including zero', async () => {
    getOwnTask.mockResolvedValue({ task: task() });
    completeOwnTask.mockImplementationOnce(async (_taskId, body) => {
      getOwnTask.mockResolvedValue({ task: task({
      status: 'completed',
      completionVersion: 1,
      actualMinutes: 0,
      actualAmount: 0,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '今天状态一般'
      }) });
      return completedResponse(body);
    });

    openRoute(`/child/tasks/${id(3)}`);

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.getByText('目标').nextElementSibling).toHaveTextContent('500 个');
    fireEvent.change(screen.getByLabelText('实际用时（分钟）'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('实际完成数量'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('完成难度'), { target: { value: 'hard' } });
    fireEvent.click(screen.getByLabelText('完成时需要帮助'));
    fireEvent.change(screen.getByLabelText('我的一句话'), { target: { value: '今天状态一般' } });
    fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));

    await waitFor(() => expect(completeOwnTask).toHaveBeenCalledWith(id(3), {
      operationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      expectedCompletionVersion: 0,
      expectedChecklistVersion: 0,
      checkedItemIds: [],
      completionMediaIds: [],
      actualMinutes: 0,
      actualAmount: 0,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '今天状态一般'
    }, expect.any(AbortSignal), captureSession('student')));
    expect(await screen.findByText('提交结果已确认。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '修改本次完成' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '我需要帮助', exact: true })).not.toBeInTheDocument();
  });

  test('disables duplicate completion while the request is in flight', async () => {
    let resolveCompletion;
    getOwnTask.mockResolvedValue({ task: task() });
    completeOwnTask.mockImplementationOnce(() => new Promise((resolve) => { resolveCompletion = resolve; }));
    openRoute(`/child/tasks/${id(3)}`);

    const submit = await screen.findByRole('button', { name: '提交完成情况' });
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(completeOwnTask).toHaveBeenCalledTimes(1);

    getOwnTask.mockResolvedValue({ task: task({ status: 'completed', completionVersion: 1 }) });
    await act(async () => resolveCompletion(completedResponse(completeOwnTask.mock.calls[0][1])));
    await screen.findByText('提交结果已确认。');
  });

  test('reloads the task and explains a state conflict', async () => {
    getOwnTask.mockResolvedValue({ task: task() });
    completeOwnTask.mockImplementationOnce(async () => {
      getOwnTask.mockResolvedValue({ task: task({ status: 'confirmed', starAwardState: 'awarded' }) });
      throw Object.assign(new Error('Task changed'), { response: { status: 409,
        data: { success: false, error: { code: 'TASK_STATE_CONFLICT', message: 'Task changed', details: [] } } } });
    });
    openRoute(`/child/tasks/${id(3)}`);

    fireEvent.click(await screen.findByRole('button', { name: '提交完成情况' }));

    expect(await screen.findByText('请求未完成，任务可能已变化。请重新查看后再操作。')).toBeInTheDocument();
    await waitFor(() => expect(getOwnTask).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('星星已到账')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
  });

  test.each(['completed', 'confirmed', 'cancelled', 'archived'])('opens %s tasks in review mode, not an unsolicited completion form', async (status) => {
    getOwnTask.mockResolvedValue({ task: task({ status }) });
    const view = openRoute(`/child/tasks/${id(3)}`);

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
    if (status === 'completed') expect(screen.getByRole('button', { name: '修改本次完成' })).toBeInTheDocument();
    else expect(screen.queryByRole('button', { name: '修改本次完成' })).not.toBeInTheDocument();
    view.unmount();
  });

  test('TC-MPA-WEB-006 shows task PDF attachments through child-authorized access without upload controls', async () => {
    getOwnTask.mockResolvedValue({ task: task({ attachmentMediaIds: ['task-pdf'] }) });
    getOwnPrivateMediaAccess.mockResolvedValueOnce({
      access: { url: 'https://signed.example/task-pdf' },
      media: {
        mediaId: 'task-pdf',
        mimeType: 'application/pdf',
        displayName: '训练计划.pdf',
        sizeBytes: 2048,
        pageCount: 2
      }
    });
    openRoute(`/child/tasks/${id(3)}`);

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.queryByLabelText('任务附件')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看任务附件 1' }));
    expect(await screen.findByRole('link', { name: '保存训练计划.pdf' })).toHaveAttribute(
      'href',
      'https://signed.example/task-pdf'
    );
  });

  test('completed work can be modified using its viewed versions, checklist and existing images', async () => {
    const existing = task({ status: 'completed', completionVersion: 2, checklistVersion: 3,
      checklistSnapshot: [{ itemId: 'stretch', label: '完成拉伸', required: true }], completionMediaIds: [id(4)],
      completionEvidence: { actualMinutes: 8, actualAmount: 0, difficulty: 'easy', needsHelp: false,
        childNote: '合成旧备注', checkedItemIds: ['stretch'] }, parentFeedback: '合成历史反馈' });
    getOwnTask.mockResolvedValue({ task: existing });
    completeOwnTask.mockImplementationOnce(async (_taskId, body) => {
      getOwnTask.mockResolvedValue({ task: { ...existing, completionVersion: 3 } }); return completedResponse(body);
    });
    openRoute(`/child/tasks/${id(3)}`);
    fireEvent.click(await screen.findByRole('button', { name: '修改本次完成' }));
    expect(screen.getByText('合成历史反馈')).toBeInTheDocument();
    expect(screen.getByLabelText('实际完成数量')).toHaveValue(0);
    fireEvent.click(screen.getByLabelText(/完成拉伸/));
    fireEvent.change(screen.getByLabelText('我的一句话'), { target: { value: '合成新备注' } });
    fireEvent.click(screen.getByRole('button', { name: '提交修改' }));
    await waitFor(() => expect(completeOwnTask).toHaveBeenCalledTimes(1));
    expect(completeOwnTask.mock.calls[0][1]).toEqual(expect.objectContaining({
      expectedCompletionVersion: 2, expectedChecklistVersion: 3, checkedItemIds: [],
      completionMediaIds: [id(4)], actualAmount: 0, actualMinutes: 8, childNote: '合成新备注'
    }));
    await screen.findByText('作品版本 3');
  });

  test('unknown submission survives a readonly refresh and retries the exact frozen command', async () => {
    getOwnTask.mockResolvedValue({ task: task() });
    completeOwnTask.mockRejectedValueOnce({ response: { status: 503, data: {
      success: false, error: { code: 'MEDIA_REFERENCE_PENDING', message: 'Pending', details: [] }
    } } }).mockImplementationOnce(async (_taskId, body) => completedResponse(body));
    openRoute(`/child/tasks/${id(3)}`);
    fireEvent.change(await screen.findByLabelText('我的一句话'), { target: { value: '不能被替换的合成原命令' } });
    fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));
    await screen.findByRole('button', { name: '重试本次提交' });
    const first = completeOwnTask.mock.calls[0][1];
    expect(screen.queryByLabelText('我的一句话')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    await waitFor(() => expect(getOwnTask).toHaveBeenCalledTimes(3));
    expect(completeOwnTask).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: '重试本次提交' }));
    await screen.findByText('提交结果已确认。');
    expect(completeOwnTask).toHaveBeenCalledTimes(2);
    expect(completeOwnTask.mock.calls[1][1]).toEqual(first);
  });

  test.each(['recoverable', 'other_actor'])('server recovery %s is explicit and respects the original actor', async state => {
    getOwnTask.mockResolvedValue({ task: task({ completionMediaReferenceState: 'pending_recovery' }) });
    const operationId = '00000000-0000-4000-8000-000000000001';
    getOwnCompletionRecovery.mockResolvedValue({ recovery: { state, operationId: state === 'recoverable' ? operationId : null,
      targetCompletionVersion: state === 'recoverable' ? 1 : null } });
    recoverOwnTaskCompletion.mockResolvedValue(completedResponse({ expectedCompletionVersion: 0, expectedChecklistVersion: 0, completionMediaIds: [] }));
    openRoute(`/child/tasks/${id(3)}`);
    await waitFor(() => expect(getOwnCompletionRecovery).toHaveBeenCalledTimes(1));
    expect(recoverOwnTaskCompletion).not.toHaveBeenCalled(); expect(completeOwnTask).not.toHaveBeenCalled();
    if (state === 'recoverable') {
      fireEvent.click(await screen.findByRole('button', { name: '继续上次提交' }));
      await screen.findByText('原提交已恢复。');
      expect(recoverOwnTaskCompletion).toHaveBeenCalledWith(id(3), operationId, expect.any(AbortSignal), captureSession('student'));
    } else {
      expect(await screen.findByText(/请等待原提交者恢复/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '继续上次提交' })).not.toBeInTheDocument();
    }
  });

  test('identity change removes old feedback and ignores the late old completion result', async () => {
    let resolveOld;
    getOwnTask.mockImplementation(async (_taskId, _signal, expectedSession) => ({ task: expectedSession.actorId === id(2)
      ? task({ parentFeedback: '旧孩子私有反馈' }) : task({ childId: id(9), title: '新孩子任务' }) }));
    completeOwnTask.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    openRoute(`/child/tasks/${id(3)}`);
    fireEvent.click(await screen.findByRole('button', { name: '提交完成情况' }));
    const body = completeOwnTask.mock.calls[0][1];
    act(() => saveChildSession({ token: 'synthetic-next', child: { childId: id(9), familyId: id(1), name: '新孩子' } }));
    expect(await screen.findByRole('heading', { name: '新孩子任务' })).toBeInTheDocument();
    expect(screen.queryByText('旧孩子私有反馈')).not.toBeInTheDocument();
    await act(async () => resolveOld(completedResponse(body)));
    expect(screen.getByRole('heading', { name: '新孩子任务' })).toBeInTheDocument();
    expect(screen.queryByText('提交结果已确认。')).not.toBeInTheDocument();
  });

  test('refreshing task details also displays the latest parent help response', async () => {
    let current = task({ helpVersion: 1, helpRequest: { status: 'pending', helpType: 'other', note: '原卡点' } });
    getOwnTask.mockImplementation(async () => ({ task: current }));
    openRoute(`/child/tasks/${id(3)}`);
    await screen.findByText('等待家长帮助');
    current = { ...current, status: 'completed', helpVersion: 2,
      helpRequest: { ...current.helpRequest, status: 'resolved', parentResponse: '先画图再一起看' } };
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    expect(await screen.findByText('先画图再一起看')).toBeInTheDocument();
    expect(screen.queryByText('等待家长帮助')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新求助', exact: true })).not.toBeInTheDocument();
    expect(updateOwnTaskHelp).not.toHaveBeenCalled();
    expect(completeOwnTask).not.toHaveBeenCalled();
  });

  test('detail refresh 403 removes the visible private question and parent response', async () => {
    getOwnTask.mockResolvedValue({ task: task({ helpVersion: 2, helpRequest: { status: 'resolved',
      helpType: 'other', note: '私有旧求助', parentResponse: '私有家长回应' } }) });
    openRoute(`/child/tasks/${id(3)}`);
    await screen.findByText('私有家长回应');
    getOwnTask.mockRejectedValueOnce({ response: { status: 403 } });
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '任务求助' })).not.toBeInTheDocument());
    expect(screen.queryByText('私有旧求助')).not.toBeInTheDocument();
    expect(screen.queryByText('私有家长回应')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '再次求助' })).not.toBeInTheDocument();
  });

  test.each(['read', 'write'])('detail refresh 403 clears private help and ignores a late %s success', async kind => {
    const current = task({ helpVersion: 1, helpRequest: { status: 'pending', helpType: 'other', note: '私有旧求助' } });
    getOwnTask.mockResolvedValue({ task: current });
    openRoute(`/child/tasks/${id(3)}`);
    await screen.findByText('私有旧求助');
    let release;
    const held = new Promise(resolve => { release = resolve; });
    updateOwnTaskHelp.mockImplementationOnce(() => kind === 'write' ? held : Promise.reject(Error('Synthetic lost response')));
    fireEvent.click(screen.getByRole('button', { name: '更新求助', exact: true }));
    fireEvent.change(screen.getByLabelText('补充说明（可不填）'), { target: { value: '私有新求助' } });
    fireEvent.click(screen.getByRole('button', { name: '发送求助' }));
    let signal = updateOwnTaskHelp.mock.calls[0][2];
    if (kind === 'read') {
      await waitFor(() => expect(screen.getByRole('button', { name: '读取最新求助' })).toBeEnabled());
      getOwnTask.mockImplementationOnce(() => held);
      fireEvent.click(screen.getByRole('button', { name: '读取最新求助' }));
      signal = getOwnTask.mock.calls.at(-1)[1];
    }
    getOwnTask.mockRejectedValueOnce({ response: { status: 403, data: { error: { code: 'CHILD_ACCESS_DENIED' } } } });
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '任务求助' })).not.toBeInTheDocument());
    expect(screen.queryByText('私有旧求助')).not.toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    await act(async () => release({ task: { ...current, helpVersion: 2,
      helpRequest: { ...current.helpRequest, note: '私有新求助' } } }));
    expect(screen.queryByText('私有新求助')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新求助', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试原求助操作' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新详情' })).toBeDisabled();
    expect(updateOwnTaskHelp).toHaveBeenCalledTimes(1);
  });

  test.each(['success', 'network', '503'])('ordinary detail refresh %s preserves the exact uncertain help command', async outcome => {
    const current = task({ helpVersion: 1, helpRequest: { status: 'pending', helpType: 'other', note: '原卡点' } });
    getOwnTask.mockResolvedValue({ task: current });
    updateOwnTaskHelp.mockRejectedValueOnce(Error('Synthetic lost help response'))
      .mockResolvedValueOnce({ task: { ...current, helpVersion: 2 } });
    openRoute(`/child/tasks/${id(3)}`);
    fireEvent.click(await screen.findByRole('button', { name: '更新求助', exact: true }));
    fireEvent.change(screen.getByLabelText('补充说明（可不填）'), { target: { value: '保留原正文' } });
    fireEvent.click(screen.getByRole('button', { name: '发送求助' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled());
    const original = updateOwnTaskHelp.mock.calls[0][1];
    let release;
    getOwnTask.mockImplementationOnce(() => new Promise((resolve, reject) => {
      release = () => outcome === 'success' ? resolve({ task: current })
        : reject(outcome === '503' ? { response: { status: 503 } } : Error('Synthetic offline'));
    }));
    fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
    expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
    await act(async () => release());
    expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
    expect(updateOwnTaskHelp).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '重试原求助操作' }));
    await screen.findByText('求助已发送。');
    expect(updateOwnTaskHelp).toHaveBeenCalledTimes(2);
    expect(updateOwnTaskHelp.mock.calls[1][1]).toBe(original);
    expect(original).toMatchObject({ action: 'request', expectedHelpVersion: 1, note: '保留原正文' });
  });

  test('completion refresh preserves an uncertain help command without creating a new request', async () => {
    let current = task();
    getOwnTask.mockImplementation(async () => ({ task: current }));
    updateOwnTaskHelp.mockImplementationOnce(async (_id, body) => {
      current = { ...current, helpVersion: 1, helpRequest: { status: 'pending', helpType: body.helpType, note: body.note } };
      throw new Error('Synthetic lost help response');
    }).mockImplementationOnce(async () => ({ task: current }));
    completeOwnTask.mockImplementationOnce(async (_id, body) => {
      current = { ...current, status: 'completed', completionVersion: 1 }; return completedResponse(body);
    });
    openRoute(`/child/tasks/${id(3)}`);
    fireEvent.click(await screen.findByRole('button', { name: '我需要帮助', exact: true }));
    fireEvent.change(screen.getByLabelText('补充说明（可不填）'), { target: { value: '原卡点' } });
    fireEvent.click(screen.getByRole('button', { name: '发送求助' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled());
    const original = updateOwnTaskHelp.mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));
    await screen.findByText('提交结果已确认。');
    fireEvent.click(screen.getByRole('button', { name: '重试原求助操作' }));
    await screen.findByText('等待家长帮助');
    expect(updateOwnTaskHelp).toHaveBeenCalledTimes(2);
    expect(updateOwnTaskHelp.mock.calls[1][1]).toEqual(original);
    expect(screen.queryByRole('button', { name: '更新求助', exact: true })).not.toBeInTheDocument();
    expect(completeOwnTask).toHaveBeenCalledTimes(1);
  });
});
