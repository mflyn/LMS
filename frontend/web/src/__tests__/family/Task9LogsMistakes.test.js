import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GrowthLogsPage from '../../pages/family/GrowthLogsPage';
import MistakesPage from '../../pages/family/MistakesPage';
import {
  createGrowthLog,
  createMistake,
  deletePrivateMedia,
  listGrowthLogs,
  listMistakes,
  uploadPrivateMedia,
  updateGrowthLog,
  updateMistake
} from '../../services/familyApi';

let mockFamilyContext;

jest.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => mockFamilyContext
}));

const familyContext = (overrides = {}) => ({
    selectedChildId: 'child-a1',
    selectedChild: { childId: 'child-a1', name: '小明' },
    childScopeVersion: 1,
    ...overrides
});

const deferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

jest.mock('../../services/familyApi', () => ({
  createGrowthLog: jest.fn(),
  createMistake: jest.fn(),
  deletePrivateMedia: jest.fn(),
  getPrivateMediaAccess: jest.fn(),
  listGrowthLogs: jest.fn(),
  listMistakes: jest.fn(),
  updateGrowthLog: jest.fn(),
  updateMistake: jest.fn(),
  uploadPrivateMedia: jest.fn()
}));

const growthLog = (overrides = {}) => ({
  logId: 'log-1',
  childId: 'child-a1',
  date: '2026-07-11',
  dimension: 'physical',
  area: '跳绳',
  content: '完成 500 个',
  durationMinutes: 20,
  mood: 'happy',
  ...overrides
});

const mistake = (overrides = {}) => ({
  mistakeId: 'mistake-1',
  childId: 'child-a1',
  dimension: 'academic',
  subject: '数学',
  knowledgePointName: '分数计算',
  reason: 'calculation',
  corrected: false,
  reviewed: false,
  mastered: false,
  ...overrides
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
const renderPage = (page) => render(<MemoryRouter future={routerFuture}>{page}</MemoryRouter>);

describe('Task 9 growth logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFamilyContext = familyContext();
    listGrowthLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  test.each([
    ['moral', '整理书包'],
    ['academic', '数学练习'],
    ['physical', '跳绳'],
    ['artistic', '钢琴'],
    ['labor', '整理房间']
  ])('creates a %s growth log for the selected child', async (dimension, area) => {
    const user = userEvent.setup();
    createGrowthLog.mockResolvedValue({ log: growthLog({ dimension, area, content: `完成${area}` }) });
    renderPage(<GrowthLogsPage />);

    await screen.findByText('暂无成长记录');
    await user.click(screen.getByRole('button', { name: '记录成长' }));
    await user.selectOptions(screen.getByLabelText('成长维度'), dimension);
    if (dimension === 'academic') await user.type(screen.getByLabelText('学科'), '数学');
    await user.type(screen.getByLabelText('领域'), area);
    await user.type(screen.getByLabelText('日期'), '2026-07-11');
    await user.type(screen.getByLabelText('记录内容'), `完成${area}`);
    await user.type(screen.getByLabelText('时长（分钟）'), '20');
    await user.click(screen.getByRole('button', { name: '保存成长记录' }));

    await waitFor(() => expect(createGrowthLog).toHaveBeenCalledWith(expect.objectContaining({
      childId: 'child-a1',
      dimension,
      area,
      content: `完成${area}`,
      durationMinutes: 20
    })));
    expect(await screen.findByText(`完成${area}`)).toBeInTheDocument();
  });

  test('edits an existing growth log', async () => {
    const user = userEvent.setup();
    listGrowthLogs.mockResolvedValue({ items: [growthLog()], total: 1 });
    updateGrowthLog.mockResolvedValue({ log: growthLog({ content: '完成 600 个' }) });
    renderPage(<GrowthLogsPage />);

    await user.click(await screen.findByRole('button', { name: '编辑 完成 500 个' }));
    const content = screen.getByLabelText('记录内容');
    await user.clear(content);
    await user.type(content, '完成 600 个');
    await user.click(screen.getByRole('button', { name: '保存成长记录' }));

    await waitFor(() => expect(updateGrowthLog).toHaveBeenCalledWith('log-1', expect.objectContaining({
      content: '完成 600 个'
    })));
    expect(await screen.findByText('完成 600 个')).toBeInTheDocument();
  });

  test('distinguishes a retryable error from an empty log list', async () => {
    const user = userEvent.setup();
    listGrowthLogs
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ items: [], total: 0 });
    renderPage(<GrowthLogsPage />);

    expect(await screen.findByText('暂时无法加载数据，请重试。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新加载数据' }));
    expect(await screen.findByText('暂无成长记录')).toBeInTheDocument();
  });

  test('ignores a growth-log mutation response after switching children', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    createGrowthLog.mockReturnValueOnce(pending.promise);
    const view = renderPage(<GrowthLogsPage />);

    await screen.findByText('暂无成长记录');
    await user.click(screen.getByRole('button', { name: '记录成长' }));
    await user.type(screen.getByLabelText('日期'), '2026-07-11');
    await user.type(screen.getByLabelText('记录内容'), '旧孩子记录');
    await user.click(screen.getByRole('button', { name: '保存成长记录' }));

    mockFamilyContext = familyContext({
      selectedChildId: 'child-a2',
      selectedChild: { childId: 'child-a2', name: '小红' },
      childScopeVersion: 2
    });
    view.rerender(
      <MemoryRouter future={routerFuture}>
        <GrowthLogsPage />
      </MemoryRouter>
    );
    await act(async () => pending.resolve({ log: growthLog({ content: '旧孩子记录' }) }));

    expect(screen.queryByText('旧孩子记录')).not.toBeInTheDocument();
    expect(await screen.findByText('暂无成长记录')).toBeInTheDocument();
  });
});

describe('Task 9 mistakes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFamilyContext = familyContext();
    deletePrivateMedia.mockResolvedValue({});
    listMistakes.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  test('creates an academic-only mistake for the selected child', async () => {
    const user = userEvent.setup();
    createMistake.mockResolvedValue({ mistake: mistake() });
    renderPage(<MistakesPage />);

    await screen.findByText('暂无错题');
    expect(screen.getByText('错题仅用于智育学习复盘')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '记录错题' }));
    await user.type(screen.getByLabelText('学科'), '数学');
    await user.type(screen.getByLabelText('知识点'), '分数计算');
    await user.selectOptions(screen.getByLabelText('错误原因'), 'calculation');
    await user.click(screen.getByRole('button', { name: '保存错题' }));

    await waitFor(() => expect(createMistake).toHaveBeenCalledWith(expect.objectContaining({
      childId: 'child-a1',
      subject: '数学',
      knowledgePointName: '分数计算',
      reason: 'calculation'
    })));
    expect(await screen.findByText('分数计算')).toBeInTheDocument();
  });

  test('updates correction, review, mastery and parent note', async () => {
    const user = userEvent.setup();
    listMistakes.mockResolvedValue({ items: [mistake()], total: 1 });
    updateMistake.mockResolvedValue({
      mistake: mistake({ corrected: true, reviewed: true, mastered: true, parentNote: '已掌握' })
    });
    renderPage(<MistakesPage />);

    await user.click(await screen.findByRole('button', { name: '复盘 分数计算' }));
    await user.click(screen.getByLabelText('已订正'));
    await user.click(screen.getByLabelText('已复习'));
    await user.click(screen.getByLabelText('已掌握'));
    await user.type(screen.getByLabelText('家长备注'), '已掌握');
    await user.click(screen.getByRole('button', { name: '保存复盘' }));

    await waitFor(() => expect(updateMistake).toHaveBeenCalledWith('mistake-1', expect.objectContaining({
      corrected: true,
      reviewed: true,
      mastered: true,
      parentNote: '已掌握'
    })));
    await waitFor(() => {
      expect(
        within(screen.getByRole('heading', { name: '分数计算' }).closest('article')).getByText('已掌握')
      ).toBeInTheDocument();
    });
  });

  test('TC-MPA-WEB-004 creates ordered question and answer collections with canonical arrays only', async () => {
    const user = userEvent.setup();
    uploadPrivateMedia
      .mockResolvedValueOnce({ media: { mediaId: 'question-image', mimeType: 'image/png', displayName: '题目.png' } })
      .mockResolvedValueOnce({ media: { mediaId: 'question-pdf', mimeType: 'application/pdf', displayName: '试卷.pdf', pageCount: 2 } })
      .mockResolvedValueOnce({ media: { mediaId: 'answer-pdf', mimeType: 'application/pdf', displayName: '答案.pdf', pageCount: 1 } });
    createMistake.mockResolvedValueOnce({
      mistake: mistake({
        questionMediaIds: ['question-image', 'question-pdf'],
        childAnswerMediaIds: ['answer-pdf']
      })
    });
    renderPage(<MistakesPage />);

    await screen.findByText('暂无错题');
    await user.click(screen.getByRole('button', { name: '记录错题' }));
    await user.type(screen.getByLabelText('学科'), '数学');
    await user.upload(screen.getByLabelText('题目附件'), [
      new File(['image'], '题目.png', { type: 'image/png' }),
      new File(['pdf'], '试卷.pdf', { type: 'application/pdf' })
    ]);
    await user.upload(
      screen.getByLabelText('答案附件'),
      new File(['pdf'], '答案.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: '保存错题' }));

    await waitFor(() => expect(createMistake).toHaveBeenCalledWith(expect.objectContaining({
      childId: 'child-a1',
      questionMediaIds: ['question-image', 'question-pdf'],
      childAnswerMediaIds: ['answer-pdf']
    })));
    const payload = createMistake.mock.calls[0][0];
    expect(payload).not.toHaveProperty('questionMediaId');
    expect(payload).not.toHaveProperty('childAnswerMediaId');
    expect(await screen.findByText('题目附件 2 · 答案附件 1')).toBeInTheDocument();
    expect(deletePrivateMedia).not.toHaveBeenCalled();
  });

  test('TC-MPA-WEB-004 normalizes a legacy scalar and clears it through the canonical group', async () => {
    const user = userEvent.setup();
    listMistakes.mockResolvedValueOnce({
      items: [mistake({ questionMediaId: 'legacy-question' })],
      total: 1
    });
    updateMistake.mockResolvedValueOnce({
      mistake: mistake({ questionMediaIds: [], childAnswerMediaIds: [] })
    });
    renderPage(<MistakesPage />);

    await user.click(await screen.findByRole('button', { name: '复盘 分数计算' }));
    expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '移除题目附件 1' }));
    await user.click(screen.getByRole('button', { name: '保存复盘' }));

    await waitFor(() => expect(updateMistake).toHaveBeenCalledWith('mistake-1', expect.objectContaining({
      questionMediaIds: []
    })));
    const payload = updateMistake.mock.calls[0][1];
    expect(payload).not.toHaveProperty('questionMediaId');
  });

  test('TC-MPA-WEB-003 prevents save and close while a parent attachment upload is in flight', async () => {
    const user = userEvent.setup();
    const pendingUpload = deferred();
    uploadPrivateMedia.mockReturnValueOnce(pendingUpload.promise);
    renderPage(<MistakesPage />);

    await screen.findByText('暂无错题');
    await user.click(screen.getByRole('button', { name: '记录错题' }));
    const upload = user.upload(
      screen.getByLabelText('题目附件'),
      new File(['pdf'], '题目.pdf', { type: 'application/pdf' })
    );

    await waitFor(() => expect(uploadPrivateMedia).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '保存错题' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled();

    await act(async () => pendingUpload.resolve({
      media: { mediaId: 'question-pdf', mimeType: 'application/pdf', displayName: '题目.pdf' }
    }));
    await upload;
    expect(screen.getByRole('button', { name: '保存错题' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '关闭' })).toBeEnabled();
  });
});
