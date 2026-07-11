import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { listOwnMistakes, reviewOwnMistake } from '../../services/childApi';
import { saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  listOwnMistakes: jest.fn(),
  reviewOwnMistake: jest.fn()
}));

const session = {
  token: 'child-token',
  child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' }
};

const mistake = (overrides = {}) => ({
  mistakeId: 'mistake-a1',
  dimension: 'academic',
  subject: '数学',
  knowledgePointName: '分数加减',
  reason: 'calculation',
  correctAnswer: '3/4',
  parentNote: '重新通分',
  childExplanation: '',
  reviewed: false,
  mastered: false,
  ...overrides
});

const openMistakes = () => {
  saveChildSession(session);
  window.history.pushState({}, 'route', '/child/mistakes');
  return render(<App />);
};

describe('child mistake review', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    listOwnMistakes.mockResolvedValue({ items: [mistake()], total: 1 });
  });

  test('loads only non-mastered own mistakes and exposes no parent-owned fields', async () => {
    openMistakes();

    expect(await screen.findByRole('heading', { name: '分数加减' })).toBeInTheDocument();
    expect(listOwnMistakes).toHaveBeenCalledWith({ mastered: false, pageSize: 100 }, expect.any(AbortSignal));
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByLabelText('我的解释（分数加减）')).toBeInTheDocument();
    for (const forbidden of ['正确答案', '错误原因', '家长备注', '提醒复习日期', '题目图片']) {
      expect(screen.queryByLabelText(forbidden)).not.toBeInTheDocument();
    }
  });

  test('keeps the row and server response after marking that help is still needed', async () => {
    reviewOwnMistake.mockResolvedValueOnce({
      mistake: mistake({ reviewed: true, childExplanation: '先把分母变成一样' })
    });
    openMistakes();
    const explanation = await screen.findByLabelText('我的解释（分数加减）');
    fireEvent.change(explanation, { target: { value: '先把分母变成一样' } });

    fireEvent.click(screen.getByRole('button', { name: '我还不会 分数加减' }));

    await waitFor(() => expect(reviewOwnMistake).toHaveBeenCalledWith('mistake-a1', {
      childExplanation: '先把分母变成一样',
      reviewed: true,
      mastered: false
    }));
    expect(await screen.findByText('已记录，之后继续复习。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '分数加减' })).toBeInTheDocument();
    expect(screen.getByLabelText('我的解释（分数加减）')).toHaveValue('先把分母变成一样');
  });

  test('removes a row only after the server confirms mastery', async () => {
    reviewOwnMistake.mockResolvedValueOnce({
      mistake: mistake({ reviewed: true, mastered: true, childExplanation: '已经理解' })
    });
    openMistakes();
    fireEvent.change(await screen.findByLabelText('我的解释（分数加减）'), { target: { value: '已经理解' } });

    fireEvent.click(screen.getByRole('button', { name: '我已经会了 分数加减' }));

    expect(await screen.findByText('做得好，这道错题已掌握。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '分数加减' })).not.toBeInTheDocument();
    expect(screen.getByText('暂无待复习错题。')).toBeInTheDocument();
  });

  test('preserves the row and explanation after a stable mutation failure', async () => {
    reviewOwnMistake.mockRejectedValueOnce({
      response: { status: 400, data: { error: { message: '复习状态无效' } } }
    });
    openMistakes();
    const explanation = await screen.findByLabelText('我的解释（分数加减）');
    fireEvent.change(explanation, { target: { value: '还要再练一次' } });

    fireEvent.click(screen.getByRole('button', { name: '我还不会 分数加减' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('复习状态无效');
    expect(screen.getByRole('heading', { name: '分数加减' })).toBeInTheDocument();
    expect(explanation).toHaveValue('还要再练一次');
  });

  test('renders stable list failures without an infinite loading state', async () => {
    listOwnMistakes.mockRejectedValueOnce({
      response: { status: 403, data: { error: { message: '无权查看错题' } } }
    });
    openMistakes();

    expect(await screen.findByText('无权查看错题')).toBeInTheDocument();
    expect(screen.queryByText('正在加载数据…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();
  });
});
