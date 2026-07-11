import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaField from '../../components/family/PrivateMediaField';
import TodayPage from '../../pages/family/TodayPage';
import TasksPage from '../../pages/family/TasksPage';
import {
  cancelOrArchiveGrowthTask,
  completeGrowthTask,
  confirmGrowthTask,
  createGrowthTask,
  getWeeklyReport,
  listFamilyReminders,
  listGrowthTasks,
  listMistakes,
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

  test('removes the selected media id through the value callback without deleting the media asset', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <PrivateMediaField
        label="错题图片"
        childId="child-a1"
        purpose="mistake_question"
        value="media-a1"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '移除错题图片' }));

    expect(onChange).toHaveBeenCalledWith(null);
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

const renderPage = (page) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('Task 9 today and task workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listGrowthTasks.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    getWeeklyReport.mockResolvedValue({
      report: { reportId: 'report-a1', taskCompletionRate: 75, totalDurationMinutes: 180 }
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
