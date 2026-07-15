import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import {
  completeOwnTask,
  getOwnPrivateMediaAccess,
  getOwnTask,
  listOwnReminders,
  listOwnTasks
} from '../../services/childApi';
import { saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  completeOwnTask: jest.fn(),
  getOwnPrivateMediaAccess: jest.fn(),
  getOwnTask: jest.fn(),
  listOwnReminders: jest.fn(),
  listOwnTasks: jest.fn()
}));

const session = {
  token: 'child-token',
  child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' }
};

const task = (overrides = {}) => ({
  taskId: 'task-a1',
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

const openRoute = (path) => {
  saveChildSession(session);
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

describe('child today page', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    listOwnTasks.mockResolvedValue({ items: [], total: 0 });
    listOwnReminders.mockResolvedValue({ items: [], meta: { partial: false, unavailableSources: [] } });
  });

  test('renders all five dimensions, child-safe statuses, pending links, and reminders', async () => {
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
    expect(screen.getByText('已获得星星')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /跳绳 500 个/ })).toHaveAttribute('href', '/child/tasks/physical');
    expect(screen.queryByRole('link', { name: /数学练习/ })).not.toBeInTheDocument();
    expect(screen.getByText('晚上八点复习错题')).toBeInTheDocument();
    expect(listOwnTasks).toHaveBeenCalledWith({ scope: 'today', pageSize: 100 }, expect.any(AbortSignal));
    expect(listOwnReminders).toHaveBeenCalledWith({}, expect.any(AbortSignal));
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
    expect(screen.getByText('mistakes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();
  });

  test('offers source-specific retry for a retryable reminder failure', async () => {
    listOwnReminders.mockRejectedValueOnce({ response: { status: 503 } });

    openRoute('/child/today');

    const reminderError = await screen.findByRole('group', { name: '今日提醒加载失败' });
    fireEvent.click(withinGroup(reminderError, '重新加载数据'));
    await waitFor(() => expect(listOwnReminders).toHaveBeenCalledTimes(2));
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
    jest.clearAllMocks();
  });

  test('shows measurable details and sends the approved completion payload including zero', async () => {
    getOwnTask.mockResolvedValueOnce({ task: task() });
    completeOwnTask.mockResolvedValueOnce({ task: task({
      status: 'completed',
      actualMinutes: 0,
      actualAmount: 0,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '今天状态一般'
    }) });

    openRoute('/child/tasks/task-a1');

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.getByText('目标').nextElementSibling).toHaveTextContent('500 个');
    fireEvent.change(screen.getByLabelText('实际用时（分钟）'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('实际完成数量'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('完成难度'), { target: { value: 'hard' } });
    fireEvent.click(screen.getByLabelText('我需要帮助'));
    fireEvent.change(screen.getByLabelText('我的一句话'), { target: { value: '今天状态一般' } });
    fireEvent.click(screen.getByRole('button', { name: '提交完成情况' }));

    await waitFor(() => expect(completeOwnTask).toHaveBeenCalledWith('task-a1', {
      actualMinutes: 0,
      actualAmount: 0,
      difficulty: 'hard',
      needsHelp: true,
      childNote: '今天状态一般'
    }));
    expect(await screen.findByText('已提交，等待家长确认。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
  });

  test('disables duplicate completion while the request is in flight', async () => {
    let resolveCompletion;
    getOwnTask.mockResolvedValueOnce({ task: task() });
    completeOwnTask.mockImplementationOnce(() => new Promise((resolve) => { resolveCompletion = resolve; }));
    openRoute('/child/tasks/task-a1');

    const submit = await screen.findByRole('button', { name: '提交完成情况' });
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(completeOwnTask).toHaveBeenCalledTimes(1);

    resolveCompletion({ task: task({ status: 'completed' }) });
    await screen.findByText('已提交，等待家长确认。');
  });

  test('reloads the task and explains a state conflict', async () => {
    getOwnTask
      .mockResolvedValueOnce({ task: task() })
      .mockResolvedValueOnce({ task: task({ status: 'confirmed' }) });
    completeOwnTask.mockRejectedValueOnce({
      response: { status: 409, data: { error: { code: 'TASK_STATE_CONFLICT' } } }
    });
    openRoute('/child/tasks/task-a1');

    fireEvent.click(await screen.findByRole('button', { name: '提交完成情况' }));

    expect(await screen.findByText('任务状态已变化，已重新加载。')).toBeInTheDocument();
    await waitFor(() => expect(getOwnTask).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('已获得星星')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
  });

  test.each(['completed', 'confirmed', 'cancelled', 'archived'])('suppresses completion controls for %s tasks', async (status) => {
    getOwnTask.mockResolvedValueOnce({ task: task({ status }) });
    const view = openRoute(`/child/tasks/${status}`);

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交完成情况' })).not.toBeInTheDocument();
    view.unmount();
  });

  test('TC-MPA-WEB-006 shows task PDF attachments through child-authorized access without upload controls', async () => {
    getOwnTask.mockResolvedValueOnce({ task: task({ attachmentMediaIds: ['task-pdf'] }) });
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
    openRoute('/child/tasks/task-a1');

    expect(await screen.findByRole('heading', { name: '跳绳 500 个' })).toBeInTheDocument();
    expect(screen.queryByLabelText('任务附件')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看任务附件 1' }));
    expect(await screen.findByRole('link', { name: '保存训练计划.pdf' })).toHaveAttribute(
      'href',
      'https://signed.example/task-pdf'
    );
  });
});
