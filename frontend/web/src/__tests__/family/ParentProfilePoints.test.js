import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App';
import {
  createKnowledgePoint,
  deletePrivateMedia,
  getMyFamily,
  listKnowledgePoints,
  updateChild,
  updateKnowledgePoint,
  uploadPrivateMedia
} from '../../services/familyApi';
import { PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({
  createChild: jest.fn(),
  createKnowledgePoint: jest.fn(),
  deletePrivateMedia: jest.fn(),
  getMyFamily: jest.fn(),
  getPrivateMediaAccess: jest.fn(),
  listKnowledgePoints: jest.fn(),
  setChildPin: jest.fn(),
  updateChild: jest.fn(),
  updateKnowledgePoint: jest.fn(),
  uploadPrivateMedia: jest.fn()
}));
jest.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }) => children
}));

const child = {
  childId: 'child-a1',
  name: '小明',
  grade: 3,
  school: '向阳小学',
  avatarMediaId: 'avatar-old',
  textbookVersion: '旧教材',
  interests: ['科学'],
  weakSubjects: ['英语'],
  sportsPreferences: ['跳绳'],
  artInterests: ['钢琴'],
  laborHabits: ['整理房间'],
  moralGoals: ['按时睡觉']
};
const familyPayload = {
  family: { familyId: 'family-a', familyName: '成长之家', timezone: 'Asia/Shanghai' },
  children: [child],
  defaultChildId: child.childId
};

const setParentSession = () => localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
  token: 'parent-token',
  user: { id: 'parent-a', name: '家长', role: 'parent' }
}));

const openRoute = (path) => {
  setParentSession();
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

describe('parent child profile and knowledge point features', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    getMyFamily.mockResolvedValue(familyPayload);
    updateChild.mockResolvedValue({ child: { ...child, name: '小明同学' } });
    uploadPrivateMedia.mockResolvedValue({ media: { mediaId: 'avatar-new' } });
    deletePrivateMedia.mockResolvedValue({});
    listKnowledgePoints.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    createKnowledgePoint.mockResolvedValue({
      knowledgePoint: {
        knowledgePointId: 'point-a1', childId: child.childId, dimension: 'academic',
        subject: '数学', area: '', name: '分数', masteryLevel: 'learning',
        practiceCount: 0, mistakeCount: 0
      }
    });
    updateKnowledgePoint.mockResolvedValue({
      knowledgePoint: {
        knowledgePointId: 'point-a1', childId: child.childId, dimension: 'academic',
        subject: '数学', area: '', name: '分数', masteryLevel: 'skilled',
        practiceCount: 8, mistakeCount: 1
      }
    });
  });

  test('edits every canonical child profile field and commits the avatar draft after save', async () => {
    getMyFamily
      .mockResolvedValueOnce(familyPayload)
      .mockResolvedValueOnce({ ...familyPayload, children: [{ ...child, name: '小明同学', avatarMediaId: 'avatar-new' }] });
    openRoute('/app/children');
    const row = await screen.findByTestId('child-row-child-a1');

    fireEvent.click(within(row).getByRole('button', { name: '编辑小明档案' }));
    const dialog = await screen.findByRole('dialog', { name: '编辑孩子档案' });
    fireEvent.change(within(dialog).getByLabelText('孩子姓名'), { target: { value: ' 小明同学 ' } });
    fireEvent.change(within(dialog).getByLabelText('年级'), { target: { value: '4' } });
    fireEvent.change(within(dialog).getByLabelText('学校'), { target: { value: '新学校' } });
    fireEvent.change(within(dialog).getByLabelText('教材版本'), { target: { value: '人教版' } });
    fireEvent.change(within(dialog).getByLabelText('兴趣'), { target: { value: '科学，阅读' } });
    fireEvent.change(within(dialog).getByLabelText('薄弱学科'), { target: { value: '英语, 数学' } });
    fireEvent.change(within(dialog).getByLabelText('体育偏好'), { target: { value: '跳绳，篮球' } });
    fireEvent.change(within(dialog).getByLabelText('艺术兴趣'), { target: { value: '钢琴，绘画' } });
    fireEvent.change(within(dialog).getByLabelText('劳动习惯'), { target: { value: '整理房间，洗碗' } });
    fireEvent.change(within(dialog).getByLabelText('品德目标'), { target: { value: '按时睡觉，帮助同学' } });
    fireEvent.change(within(dialog).getByLabelText('头像'), {
      target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] }
    });
    await waitFor(() => expect(uploadPrivateMedia).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'child-a1', purpose: 'avatar' })
    ));
    await within(dialog).findByText('头像已就绪，请保存表单完成更新。');
    fireEvent.click(within(dialog).getByRole('button', { name: '保存孩子档案' }));

    await waitFor(() => expect(updateChild).toHaveBeenCalledWith('child-a1', {
      name: '小明同学',
      grade: 4,
      school: '新学校',
      textbookVersion: '人教版',
      interests: ['科学', '阅读'],
      weakSubjects: ['英语', '数学'],
      sportsPreferences: ['跳绳', '篮球'],
      artInterests: ['钢琴', '绘画'],
      laborHabits: ['整理房间', '洗碗'],
      moralGoals: ['按时睡觉', '帮助同学'],
      avatarMediaId: 'avatar-new'
    }));
    expect(deletePrivateMedia).toHaveBeenCalledWith('avatar-old');
    expect(deletePrivateMedia).not.toHaveBeenCalledWith('avatar-new');
    expect(getMyFamily).toHaveBeenCalledTimes(2);
  });

  test('soft-deletes an uploaded avatar draft when the editor is cancelled', async () => {
    openRoute('/app/children');
    const row = await screen.findByTestId('child-row-child-a1');
    fireEvent.click(within(row).getByRole('button', { name: '编辑小明档案' }));
    const dialog = await screen.findByRole('dialog', { name: '编辑孩子档案' });

    fireEvent.change(within(dialog).getByLabelText('头像'), {
      target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] }
    });
    await waitFor(() => expect(uploadPrivateMedia).toHaveBeenCalled());
    await within(dialog).findByText('头像已就绪，请保存表单完成更新。');
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));

    await waitFor(() => expect(deletePrivateMedia).toHaveBeenCalledWith('avatar-new'));
    expect(updateChild).not.toHaveBeenCalled();
    expect(deletePrivateMedia).not.toHaveBeenCalledWith('avatar-old');
  });

  test('filters, creates, and updates selected-child knowledge or ability points', async () => {
    openRoute('/app/points');
    expect(await screen.findByRole('heading', { name: '知识与能力点' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '知识与能力点' })).toHaveClass('is-active');
    await waitFor(() => expect(listKnowledgePoints).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'child-a1', pageSize: 100 }),
      expect.any(AbortSignal)
    ));

    fireEvent.change(screen.getByLabelText('维度筛选'), { target: { value: 'academic' } });
    fireEvent.change(screen.getByLabelText('掌握程度筛选'), { target: { value: 'learning' } });
    await waitFor(() => expect(listKnowledgePoints).toHaveBeenLastCalledWith(
      expect.objectContaining({ childId: 'child-a1', dimension: 'academic', masteryLevel: 'learning' }),
      expect.any(AbortSignal)
    ));

    fireEvent.click(screen.getByRole('button', { name: '新增知识或能力点' }));
    const createDialog = await screen.findByRole('dialog', { name: '新增知识或能力点' });
    fireEvent.change(within(createDialog).getByLabelText('成长维度'), { target: { value: 'academic' } });
    fireEvent.change(within(createDialog).getByLabelText('学科'), { target: { value: '数学' } });
    fireEvent.change(within(createDialog).getByLabelText('名称'), { target: { value: '分数' } });
    fireEvent.change(within(createDialog).getByLabelText('掌握程度'), { target: { value: 'learning' } });
    fireEvent.click(within(createDialog).getByRole('button', { name: '保存知识或能力点' }));
    await waitFor(() => expect(createKnowledgePoint).toHaveBeenCalledWith({
      childId: 'child-a1', dimension: 'academic', subject: '数学', area: '',
      name: '分数', masteryLevel: 'learning'
    }));

    const pointRow = await screen.findByTestId('point-row-point-a1');
    fireEvent.click(within(pointRow).getByRole('button', { name: '更新分数' }));
    const updateDialog = await screen.findByRole('dialog', { name: '更新知识或能力点' });
    fireEvent.change(within(updateDialog).getByLabelText('掌握程度'), { target: { value: 'skilled' } });
    fireEvent.change(within(updateDialog).getByLabelText('练习次数'), { target: { value: '8' } });
    fireEvent.change(within(updateDialog).getByLabelText('错误次数'), { target: { value: '1' } });
    fireEvent.change(within(updateDialog).getByLabelText('最后复习时间'), { target: { value: '2026-07-14T08:30' } });
    fireEvent.click(within(updateDialog).getByRole('button', { name: '保存更新' }));

    await waitFor(() => expect(updateKnowledgePoint).toHaveBeenCalledWith('point-a1', {
      masteryLevel: 'skilled',
      practiceCount: 8,
      mistakeCount: 1,
      lastReviewedAt: new Date('2026-07-14T08:30').toISOString()
    }));
  });
});
