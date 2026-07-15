import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import PrivateMediaField from '../../components/family/PrivateMediaField';
import TodayPage from '../../pages/family/TodayPage';
import TasksPage from '../../pages/family/TasksPage';
import {
  cancelOrArchiveGrowthTask,
  completeGrowthTask,
  confirmGrowthTask,
  createGrowthTask,
  deletePrivateMedia,
  getWeeklyReport,
  listFamilyReminders,
  listGrowthTasks,
  listMistakes,
  uploadPrivateMedia,
  updateGrowthTask
} from '../../services/familyApi';

jest.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => ({
    selectedChildId: 'child-a1',
    selectedChild: { childId: 'child-a1', name: '小明' },
    childScopeVersion: 1
  })
}));

jest.mock('../../services/familyApi', () => ({
  listGrowthTasks: jest.fn(),
  getWeeklyReport: jest.fn(),
  listMistakes: jest.fn(),
  listFamilyReminders: jest.fn(),
  createGrowthTask: jest.fn(),
  updateGrowthTask: jest.fn(),
  completeGrowthTask: jest.fn(),
  confirmGrowthTask: jest.fn(),
  cancelOrArchiveGrowthTask: jest.fn(),
  deletePrivateMedia: jest.fn(),
  uploadPrivateMedia: jest.fn(),
  getPrivateMediaAccess: jest.fn()
}));

describe('Task 9 shared family controls', () => {
  test('renders only supplied unavailable sources for a partial data state', () => {
    render(
      <FamilyDataState
        state="partial"
        unavailableSources={['weekly_report']}
      />
    );

    expect(screen.getByText('部分数据暂不可用')).toBeInTheDocument();
    expect(screen.getByText('weekly_report')).toBeInTheDocument();
    expect(screen.queryByText('reminders')).not.toBeInTheDocument();
  });

  test('exposes a named retry action only for retryable errors', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    const { rerender } = render(<FamilyDataState state="loading" onRetry={onRetry} />);

    expect(screen.queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();

    rerender(<FamilyDataState state="retryable_error" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '重新加载数据' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('rejects files outside the approved private image types and size limit', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const uploadPrivateMedia = jest.fn();
    const onChange = jest.fn();
    render(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value={null}
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
      />
    );

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['text'], 'notes.txt', { type: 'text/plain' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('仅支持 JPEG、PNG 或 WebP 图片');
    expect(uploadPrivateMedia).not.toHaveBeenCalled();

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('图片不能超过 10 MiB');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('uploads with child scope, returns only mediaId, and views through an explicit signed-access action', async () => {
    const user = userEvent.setup();
    const uploadPrivateMedia = jest.fn().mockResolvedValue({
      mediaId: 'media-a1',
      accessUrl: 'https://should-not-be-retained.example/upload-response'
    });
    const getPrivateMediaAccess = jest.fn().mockResolvedValue({
      accessUrl: 'https://signed.example/media-a1'
    });
    const onChange = jest.fn();
    const { rerender } = render(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value={null}
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
        getPrivateMediaAccess={getPrivateMediaAccess}
      />
    );

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['image'], 'task.png', { type: 'image/png' })
    );

    expect(uploadPrivateMedia).toHaveBeenCalledWith({
      childId: 'child-a1',
      purpose: 'task_attachment',
      file: expect.any(File)
    });
    expect(onChange).toHaveBeenCalledWith('media-a1');
    expect(getPrivateMediaAccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: '任务附件预览' })).not.toBeInTheDocument();

    rerender(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value="media-a1"
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
        getPrivateMediaAccess={getPrivateMediaAccess}
      />
    );
    await user.click(screen.getByRole('button', { name: '查看任务附件' }));

    expect(getPrivateMediaAccess).toHaveBeenCalledWith('media-a1');
    expect(screen.getByRole('img', { name: '任务附件预览' })).toHaveAttribute(
      'src',
      'https://signed.example/media-a1'
    );
  });

  test('reports a selected media removal to its lifecycle owner', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRemoved = jest.fn();
    render(
      <PrivateMediaField
        label="错题图片"
        childId="child-a1"
        purpose="mistake_question"
        value="media-a1"
        onChange={onChange}
        onRemoved={onRemoved}
      />
    );

    await user.click(screen.getByRole('button', { name: '移除错题图片' }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRemoved).toHaveBeenCalledWith('media-a1');
  });

  test('appends multiple private task attachments without collapsing existing media IDs', async () => {
    const user = userEvent.setup();
    const uploadPrivateMedia = jest.fn()
      .mockResolvedValueOnce({ mediaId: 'media-a1' })
      .mockResolvedValueOnce({ mediaId: 'media-a2' });
    const onChange = jest.fn();
    const onUploaded = jest.fn();

    render(
      <PrivateMediaCollectionField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        values={[]}
        onChange={onChange}
        onUploaded={onUploaded}
        uploadPrivateMedia={uploadPrivateMedia}
      />
    );

    await user.upload(screen.getByLabelText('任务附件'), [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.webp', { type: 'image/webp' })
    ]);

    expect(uploadPrivateMedia).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenNthCalledWith(1, 'media-a1', null);
    expect(onUploaded).toHaveBeenNthCalledWith(2, 'media-a2', null);
    expect(onChange).toHaveBeenNthCalledWith(1, ['media-a1']);
    expect(onChange).toHaveBeenNthCalledWith(2, ['media-a1', 'media-a2']);
  });

  test('removes only the selected task attachment from a media collection', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRemoved = jest.fn();

    render(
      <PrivateMediaCollectionField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        values={['media-a1', 'media-a2']}
        onChange={onChange}
        onRemoved={onRemoved}
      />
    );

    await user.click(screen.getByRole('button', { name: '移除任务附件 2' }));

    expect(onRemoved).toHaveBeenCalledWith('media-a2');
    expect(onChange).toHaveBeenCalledWith(['media-a1']);
  });
});

const task = (overrides = {}) => ({
  taskId: 'task-a1',
  childId: 'child-a1',
  title: '跳绳 500 个',
  dimension: 'physical',
  area: '跳绳',
  dueDate: '2026-07-11',
  status: 'pending',
  priority: 'medium',
  ...overrides
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
const renderPage = (page) => render(<MemoryRouter future={routerFuture}>{page}</MemoryRouter>);

describe('Task 9 today and task workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listGrowthTasks.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    getWeeklyReport.mockResolvedValue({
      report: { reportId: 'report-a1', statistics: { taskCompletionRate: 75, totalDurationMinutes: 180 } }
    });
    listMistakes.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    listFamilyReminders.mockResolvedValue({
      items: [],
      meta: { partial: false, unavailableSources: [] },
      total: 0
    });
  });

  test('renders selected-child overview and names partial reminder sources', async () => {
    listGrowthTasks.mockResolvedValueOnce({
      items: [task(), task({ taskId: 'task-a2', status: 'completed', title: '阅读 30 分钟' })],
      total: 2
    });
    listMistakes.mockResolvedValueOnce({ items: [{ mistakeId: 'mistake-a1' }], total: 1 });
    listFamilyReminders.mockResolvedValueOnce({
      items: [{ type: 'task_due_today', title: '今天还有 1 个成长任务' }],
      meta: { partial: true, unavailableSources: ['growth_logs'] },
      total: 1
    });

    renderPage(<TodayPage />);

    expect(await screen.findByRole('heading', { name: '今日成长' })).toBeInTheDocument();
    expect(await screen.findByText('今日任务')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('180 分钟')).toBeInTheDocument();
    expect(screen.getByText('今天还有 1 个成长任务')).toBeInTheDocument();
    expect(screen.getByText('growth_logs')).toBeInTheDocument();
  });

  test('renders each failed Today source and retries only the selected retryable source', async () => {
    const user = userEvent.setup();
    listGrowthTasks.mockRejectedValueOnce({
      response: { status: 403, data: { error: { message: '无权读取成长任务' } } }
    });
    getWeeklyReport
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({
        report: { reportId: 'report-a1', statistics: { taskCompletionRate: 80, totalDurationMinutes: 200 } }
      });

    renderPage(<TodayPage />);

    const taskFailure = await screen.findByRole('group', { name: '成长任务加载失败' });
    expect(within(taskFailure).getByText('无权读取成长任务')).toBeInTheDocument();
    expect(within(taskFailure).queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();

    const reportFailure = await screen.findByRole('group', { name: '本周报告加载失败' });
    await user.click(within(reportFailure).getByRole('button', { name: '重新加载数据' }));

    await waitFor(() => expect(getWeeklyReport).toHaveBeenCalledTimes(2));
    expect(listGrowthTasks).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '成长任务加载失败' })).toBeInTheDocument();
  });

  test.each([
    ['moral', '按时整理书包'],
    ['academic', '完成数学练习'],
    ['physical', '跳绳 500 个'],
    ['artistic', '练习钢琴'],
    ['labor', '整理房间']
  ])('creates a %s task for the selected child', async (dimension, title) => {
    const user = userEvent.setup();
    createGrowthTask.mockResolvedValueOnce({ task: task({ dimension, title }) });
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    await user.click(screen.getByRole('button', { name: '新建任务' }));
    await user.selectOptions(screen.getByLabelText('成长维度'), dimension);
    await user.clear(screen.getByLabelText('任务标题'));
    await user.type(screen.getByLabelText('任务标题'), title);
    await user.type(screen.getByLabelText('活动领域'), dimension === 'academic' ? '数学' : '日常成长');
    await user.type(screen.getByLabelText('截止日期'), '2026-07-11');
    await user.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => expect(createGrowthTask).toHaveBeenCalledWith(expect.objectContaining({
      childId: 'child-a1',
      dimension,
      title
    })));
    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  test('queries task filters for the selected child', async () => {
    const user = userEvent.setup();
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    await user.selectOptions(screen.getByLabelText('筛选维度'), 'physical');
    await user.selectOptions(screen.getByLabelText('任务状态'), 'pending');

    await waitFor(() => expect(listGrowthTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ childId: 'child-a1', dimension: 'physical', status: 'pending' }),
      expect.any(AbortSignal)
    ));
  });

  test('deletes an unbound private-media draft when task creation is cancelled', async () => {
    const user = userEvent.setup();
    uploadPrivateMedia.mockResolvedValueOnce({ mediaId: 'media-draft-1' });
    deletePrivateMedia.mockResolvedValueOnce({});
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    await user.click(screen.getByRole('button', { name: '新建任务' }));
    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['image'], 'task.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: '关闭' }));

    await waitFor(() => expect(deletePrivateMedia).toHaveBeenCalledWith('media-draft-1'));
  });

  test('creates a task with every uploaded private attachment media ID', async () => {
    const user = userEvent.setup();
    uploadPrivateMedia
      .mockResolvedValueOnce({ mediaId: 'media-draft-1' })
      .mockResolvedValueOnce({ mediaId: 'media-draft-2' });
    createGrowthTask.mockResolvedValueOnce({ task: task({
      attachmentMediaIds: ['media-draft-1', 'media-draft-2']
    }) });
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    await user.click(screen.getByRole('button', { name: '新建任务' }));
    await user.type(screen.getByLabelText('学科'), '体育');
    await user.type(screen.getByLabelText('任务标题'), '记录两组训练');
    await user.type(screen.getByLabelText('活动领域'), '体能');
    await user.type(screen.getByLabelText('截止日期'), '2026-07-11');
    await user.upload(screen.getByLabelText('任务附件'), [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.png', { type: 'image/png' })
    ]);
    await user.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => expect(createGrowthTask).toHaveBeenCalledWith(expect.objectContaining({
      attachmentMediaIds: ['media-draft-1', 'media-draft-2']
    })));
  });

  test('TC-MPA-WEB-006 adds a PDF to the existing task attachment collection', async () => {
    const user = userEvent.setup();
    uploadPrivateMedia.mockResolvedValueOnce({
      media: {
        mediaId: 'task-pdf',
        mimeType: 'application/pdf',
        displayName: '训练计划.pdf',
        sizeBytes: 2048,
        pageCount: 2
      }
    });
    createGrowthTask.mockResolvedValueOnce({ task: task({ attachmentMediaIds: ['task-pdf'] }) });
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    await user.click(screen.getByRole('button', { name: '新建任务' }));
    await user.type(screen.getByLabelText('学科'), '体育');
    await user.type(screen.getByLabelText('任务标题'), '阅读训练计划');
    await user.type(screen.getByLabelText('活动领域'), '体能');
    await user.type(screen.getByLabelText('截止日期'), '2026-07-11');
    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['pdf'], '训练计划.pdf', { type: 'application/pdf' })
    );

    expect(screen.getByText('训练计划.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2 页/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存任务' }));
    await waitFor(() => expect(createGrowthTask).toHaveBeenCalledWith(expect.objectContaining({
      attachmentMediaIds: ['task-pdf']
    })));
  });

  test('traps dialog focus, closes with Escape, and restores the opener', async () => {
    const user = userEvent.setup();
    renderPage(<TasksPage />);

    await screen.findByText('暂无成长任务');
    const opener = screen.getByRole('button', { name: '新建任务' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: '新建任务' });
    expect(dialog).toContainElement(document.activeElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '新建任务' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  test('completes, confirms, and archives a task using server-returned states', async () => {
    const user = userEvent.setup();
    listGrowthTasks.mockResolvedValueOnce({ items: [task()], total: 1 });
    completeGrowthTask.mockResolvedValueOnce({ task: task({ status: 'completed', actualMinutes: 20 }) });
    confirmGrowthTask.mockResolvedValueOnce({
      task: task({ status: 'confirmed', starAwardState: 'awarded', parentFeedback: '做得好' }),
      starAward: { amount: 1, starBalance: 8 }
    });
    cancelOrArchiveGrowthTask.mockResolvedValueOnce({
      task: task({ status: 'archived' }),
      deleted: false
    });
    renderPage(<TasksPage />);

    expect(await screen.findByText('跳绳 500 个')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '完成 跳绳 500 个' }));
    await user.type(screen.getByLabelText('实际用时（分钟）'), '20');
    await user.click(screen.getByRole('button', { name: '提交完成记录' }));
    expect(
      within(screen.getByRole('heading', { name: '跳绳 500 个' }).closest('article')).getByText('待家长确认')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认 跳绳 500 个' }));
    await user.type(screen.getByLabelText('家长反馈'), '做得好');
    await user.click(screen.getByRole('button', { name: '确认并发放星星' }));
    await waitFor(() => {
      expect(
        within(screen.getByRole('heading', { name: '跳绳 500 个' }).closest('article')).getByText('已确认')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('已发放 1 颗星')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '归档 跳绳 500 个' }));
    await user.click(screen.getByRole('button', { name: '确认归档' }));
    await waitFor(() => {
      expect(
        within(screen.getByRole('heading', { name: '跳绳 500 个' }).closest('article')).getByText('已归档')
      ).toBeInTheDocument();
    });
  });

  test('edits a pending task and reloads after a state conflict', async () => {
    const user = userEvent.setup();
    listGrowthTasks
      .mockResolvedValueOnce({ items: [task()], total: 1 })
      .mockResolvedValueOnce({ items: [task({ title: '服务端最新任务' })], total: 1 });
    updateGrowthTask.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'TASK_STATE_CONFLICT' } } } });
    renderPage(<TasksPage />);

    await screen.findByText('跳绳 500 个');
    await user.click(screen.getByRole('button', { name: '编辑 跳绳 500 个' }));
    await user.clear(screen.getByLabelText('任务标题'));
    await user.type(screen.getByLabelText('任务标题'), '本地过期标题');
    await user.click(screen.getByRole('button', { name: '保存任务' }));

    expect(await screen.findByText('任务状态已变化，已重新加载。')).toBeInTheDocument();
    expect(await screen.findByText('服务端最新任务')).toBeInTheDocument();
  });
});
