import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import {
  createOwnMistake,
  deleteOwnPrivateMedia,
  listOwnMistakes,
  reviewOwnMistake,
  uploadOwnPrivateMedia
} from '../../services/childApi';
import { saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  createOwnMistake: jest.fn(),
  deleteOwnPrivateMedia: jest.fn(),
  getOwnPrivateMediaAccess: jest.fn(),
  listOwnMistakes: jest.fn(),
  reviewOwnMistake: jest.fn(),
  uploadOwnPrivateMedia: jest.fn()
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

const deferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('child mistake review', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    deleteOwnPrivateMedia.mockResolvedValue({});
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

  test('TC-T10-MISTAKE-004 inserts the created mistake without a dependent list reload', async () => {
    listOwnMistakes.mockResolvedValueOnce({ items: [], total: 0 });
    createOwnMistake.mockResolvedValueOnce({
      mistake: mistake({
        mistakeId: 'mistake-new',
        subject: '科学',
        knowledgePointName: '',
        reason: 'concept',
        childExplanation: '没有理解浮力方向'
      })
    });
    openMistakes();
    expect(await screen.findByText('暂无待复习错题。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '记录新错题' }));
    fireEvent.change(screen.getByLabelText('科目'), { target: { value: ' 科学 ' } });
    fireEvent.change(screen.getByLabelText('错因'), { target: { value: 'concept' } });
    fireEvent.change(screen.getByLabelText('错题说明（选填）'), { target: { value: ' 没有理解浮力方向 ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(createOwnMistake).toHaveBeenCalledWith({
      subject: '科学',
      reason: 'concept',
      childExplanation: '没有理解浮力方向',
      questionMediaIds: [],
      childAnswerMediaIds: []
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('错题已记录。');
    expect(screen.getByRole('heading', { name: '科学' })).toBeInTheDocument();
    expect(screen.getByLabelText('我的解释（科学）')).toHaveValue('没有理解浮力方向');
    expect(screen.queryByLabelText('科目')).not.toBeInTheDocument();
    expect(listOwnMistakes).toHaveBeenCalledTimes(1);
  });

  test('TC-T10-MISTAKE-005 clears stale success and preserves create values after failure', async () => {
    reviewOwnMistake.mockResolvedValueOnce({
      mistake: mistake({ reviewed: true, childExplanation: '先通分' })
    });
    createOwnMistake.mockRejectedValueOnce({
      response: { status: 400, data: { error: { message: '错题内容无效' } } }
    });
    openMistakes();
    fireEvent.click(await screen.findByRole('button', { name: '我还不会 分数加减' }));
    expect(await screen.findByText('已记录，之后继续复习。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '记录新错题' }));
    fireEvent.change(screen.getByLabelText('科目'), { target: { value: '数学' } });
    fireEvent.change(screen.getByLabelText('错因'), { target: { value: 'careless' } });
    fireEvent.change(screen.getByLabelText('错题说明（选填）'), { target: { value: '抄错了符号' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('错题内容无效');
    expect(screen.queryByText('已记录，之后继续复习。')).not.toBeInTheDocument();
    expect(screen.getByLabelText('科目')).toHaveValue('数学');
    expect(screen.getByLabelText('错因')).toHaveValue('careless');
    expect(screen.getByLabelText('错题说明（选填）')).toHaveValue('抄错了符号');
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

  test('TC-MPA-WEB-005 creates an own mistake with child-authenticated files in both groups', async () => {
    const user = userEvent.setup();
    listOwnMistakes.mockResolvedValueOnce({ items: [], total: 0 });
    uploadOwnPrivateMedia
      .mockResolvedValueOnce({ media: { mediaId: 'question-pdf', mimeType: 'application/pdf', displayName: '题目.pdf' } })
      .mockResolvedValueOnce({ media: { mediaId: 'answer-image', mimeType: 'image/png', displayName: '答案.png' } });
    createOwnMistake.mockResolvedValueOnce({
      mistake: mistake({
        mistakeId: 'mistake-new',
        questionMediaIds: ['question-pdf'],
        childAnswerMediaIds: ['answer-image']
      })
    });
    openMistakes();

    await screen.findByText('暂无待复习错题。');
    await user.click(screen.getByRole('button', { name: '记录新错题' }));
    await user.type(screen.getByLabelText('科目'), '数学');
    await user.selectOptions(screen.getByLabelText('错因'), 'calculation');
    await user.upload(
      screen.getByLabelText('题目附件'),
      new File(['pdf'], '题目.pdf', { type: 'application/pdf' })
    );
    await user.upload(
      screen.getByLabelText('答案附件'),
      new File(['image'], '答案.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(uploadOwnPrivateMedia).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'mistake_question',
      file: expect.any(File)
    }));
    expect(uploadOwnPrivateMedia.mock.calls[0][0]).not.toHaveProperty('childId');
    await waitFor(() => expect(createOwnMistake).toHaveBeenCalledWith({
      subject: '数学',
      reason: 'calculation',
      childExplanation: undefined,
      questionMediaIds: ['question-pdf'],
      childAnswerMediaIds: ['answer-image']
    }));
    expect(deleteOwnPrivateMedia).not.toHaveBeenCalled();
  });

  test('TC-MPA-WEB-005 normalizes legacy media and sends only the changed review group', async () => {
    const user = userEvent.setup();
    listOwnMistakes.mockResolvedValueOnce({
      items: [mistake({ questionMediaId: 'legacy-question' })],
      total: 1
    });
    uploadOwnPrivateMedia.mockResolvedValueOnce({
      media: { mediaId: 'answer-pdf', mimeType: 'application/pdf', displayName: '新答案.pdf' }
    });
    reviewOwnMistake.mockResolvedValueOnce({
      mistake: mistake({
        reviewed: true,
        questionMediaIds: ['legacy-question'],
        childAnswerMediaIds: ['answer-pdf']
      })
    });
    openMistakes();

    expect(await screen.findByText('已添加 1/10')).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText('答案附件（分数加减）'),
      new File(['pdf'], '新答案.pdf', { type: 'application/pdf' })
    );
    await user.click(screen.getByRole('button', { name: '我还不会 分数加减' }));

    await waitFor(() => expect(reviewOwnMistake).toHaveBeenCalledWith('mistake-a1', {
      childExplanation: undefined,
      reviewed: true,
      mastered: false,
      childAnswerMediaIds: ['answer-pdf']
    }));
  });

  test('TC-MPA-WEB-003 prevents cancelling a child draft while its upload is in flight', async () => {
    const user = userEvent.setup();
    const pendingUpload = deferred();
    listOwnMistakes.mockResolvedValueOnce({ items: [], total: 0 });
    uploadOwnPrivateMedia.mockReturnValueOnce(pendingUpload.promise);
    openMistakes();

    await screen.findByText('暂无待复习错题。');
    await user.click(screen.getByRole('button', { name: '记录新错题' }));
    const upload = user.upload(
      screen.getByLabelText('题目附件'),
      new File(['pdf'], '题目.pdf', { type: 'application/pdf' })
    );

    await waitFor(() => expect(uploadOwnPrivateMedia).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();

    pendingUpload.resolve({
      media: { mediaId: 'question-pdf', mimeType: 'application/pdf', displayName: '题目.pdf' }
    });
    await upload;
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toBeEnabled());
  });
});
