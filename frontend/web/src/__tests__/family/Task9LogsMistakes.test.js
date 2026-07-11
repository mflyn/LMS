import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GrowthLogsPage from '../../pages/family/GrowthLogsPage';
import MistakesPage from '../../pages/family/MistakesPage';
import {
  createGrowthLog,
  createMistake,
  listGrowthLogs,
  listMistakes,
  updateGrowthLog,
  updateMistake
} from '../../services/familyApi';

jest.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => ({
    selectedChildId: 'child-a1',
    selectedChild: { childId: 'child-a1', name: '小明' },
    childScopeVersion: 1
  })
}));

jest.mock('../../services/familyApi', () => ({
  createGrowthLog: jest.fn(),
  createMistake: jest.fn(),
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

const renderPage = (page) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('Task 9 growth logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listGrowthLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  test('creates a five-dimension growth log for the selected child', async () => {
    const user = userEvent.setup();
    createGrowthLog.mockResolvedValue({ log: growthLog() });
    renderPage(<GrowthLogsPage />);

    await screen.findByText('暂无成长记录');
    await user.click(screen.getByRole('button', { name: '记录成长' }));
    await user.selectOptions(screen.getByLabelText('成长维度'), 'physical');
    await user.type(screen.getByLabelText('领域'), '跳绳');
    await user.type(screen.getByLabelText('日期'), '2026-07-11');
    await user.type(screen.getByLabelText('记录内容'), '完成 500 个');
    await user.type(screen.getByLabelText('时长（分钟）'), '20');
    await user.click(screen.getByRole('button', { name: '保存成长记录' }));

    await waitFor(() => expect(createGrowthLog).toHaveBeenCalledWith(expect.objectContaining({
      childId: 'child-a1',
      dimension: 'physical',
      area: '跳绳',
      content: '完成 500 个',
      durationMinutes: 20
    })));
    expect(await screen.findByText('完成 500 个')).toBeInTheDocument();
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
});

describe('Task 9 mistakes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
