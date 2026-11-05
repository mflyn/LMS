import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FamilyPracticePage, { ChildPracticePage } from '../../pages/family/Ai3PracticePage';
import { createAi3Api } from '../../services/ai3Api';
import { saveParentSession, saveChildSession, clearParentSession } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';

jest.mock('../../services/ai3Api', () => {
  const api = Object.fromEntries(['rounds','detail','attempts','attempt','commands','command','contents','content',
    'create','generationPreview','publicationPreview','reviewContext','reviseContent','rejectContent','publish',
    'cancel','withdraw','generate','submit','review','recover'].map(k => [k, jest.fn()]));
  return { createAi3Api: () => api };
});
jest.mock('../../services/ai2Api', () => ({ createAi2Api: () => ({ packages: jest.fn(), detail: jest.fn() }) }));
jest.mock('../../services/familyApi', () => ({ listKnowledgePoints: jest.fn(), getMistake: jest.fn() }));
jest.mock('../../components/family/Ai3Media', () => () => <div />);
let mockChild = 'c'.repeat(24);
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({ family: { familyId: 'b'.repeat(24) }, selectedChildId: mockChild, childScopeVersion: 1 }) }));
jest.mock('../../contexts/ChildAuthContext', () => ({ useChildAuth: () => ({ child: { familyId: 'b'.repeat(24), childId: 'c'.repeat(24) } }) }));

const api = createAi3Api('parent'), familyId = 'b'.repeat(24), childId = 'c'.repeat(24), roundId = 'd'.repeat(24);
const actor = 'a'.repeat(24), currentId = 'e'.repeat(24), digest = '1'.repeat(64);
const metadata = n => ({ id: n.toString(16).padStart(24, '0'), roundId, version: n, contentHash: digest,
  childSnapshotHash: digest, origin: n === 1 ? 'ai_generation' : 'parent_revision',
  derivedFromContentId: n === 1 ? null : (n - 1).toString(16).padStart(24, '0'), createdBy: actor, createdAt: '2026-11-05T00:00:00.000Z' });
const questions = marker => ({ instructions: marker, exercises: [1, 2].map(n => ({ exerciseId: `q${n}`,
  questionText: `Question ${n}`, answerForParent: `${marker} answer ${n}`, rubricForParent: `${marker} rubric ${n}` })) });
const childSnapshot = value => ({ instructions: value.instructions, exercises: value.exercises.map(({ exerciseId, questionText }) => ({ exerciseId, questionText })) });
const historic = n => ({ ...metadata(n), reason: `Reason ${n}`, content: questions(`PRIVATE HISTORY ${n}`), childSnapshot: childSnapshot(questions(`PRIVATE HISTORY ${n}`)) });
const detail = (status = 'available') => ({ id: roundId, stateVersion: 4, visibility: 'draft', learningState: 'open', pending: false,
  exerciseCount: 2, currentContentId: currentId, currentContentVersion: 22, currentContentHash: digest, currentAttemptId: null,
  content: questions('CURRENT CONTENT'), childSnapshot: childSnapshot(questions('CURRENT CONTENT')), childSnapshotHash: digest,
  sourceAvailability: status });
const show = role => render(<MemoryRouter initialEntries={[`/${role === 'parent' ? 'app' : 'child'}/practice?childId=${childId}&roundId=${roundId}`]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{role === 'parent' ? <FamilyPracticePage /> : <ChildPracticePage />}</MemoryRouter>);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const openHistory = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '查看题组历史' }));
  await screen.findByRole('button', { name: '查看第 1 版题组' });
};
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); mockChild = childId;
  saveParentSession({ token: 'synthetic-parent', user: { id: actor, role: 'parent' } });
  saveChildSession({ token: 'synthetic-child', child: { childId, familyId, name: 'Synthetic' } });
  api.rounds.mockResolvedValue({ items: [detail()] }); api.commands.mockResolvedValue({ items: [] });
  api.detail.mockResolvedValue({ round: detail() }); api.attempts.mockResolvedValue({ items: [] });
  api.contents.mockResolvedValue({ items: [metadata(1)], page: 1, pageSize: 20 });
  api.content.mockImplementation(async (_round, id) => ({ content: historic(parseInt(id, 16)) }));
});

test('parent history is metadata-first, explicitly paged, and never sends a mutation', async () => {
  api.contents.mockImplementation(async (_r, page) => ({ items: page === 1 ? Array.from({ length: 20 }, (_, i) => metadata(i + 2)) : [metadata(1)], page, pageSize: 20 }));
  show('parent'); await screen.findByText('CURRENT CONTENT');
  expect(api.contents).not.toHaveBeenCalled(); expect(api.content).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '查看题组历史' }));
  await screen.findByRole('button', { name: '查看第 2 版题组' });
  expect(screen.queryByText('Reason 2')).not.toBeInTheDocument(); expect(api.content).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '题组历史下一页' }));
  fireEvent.click(await screen.findByRole('button', { name: '查看第 1 版题组' }));
  await screen.findByText('PRIVATE HISTORY 1 answer 1');
  expect(screen.getByText('Reason 1')).toBeInTheDocument();
  expect(api.contents.mock.calls.map(c => c.slice(0, 2))).toEqual([[roundId, 1], [roundId, 2]]);
  expect(api.content.mock.calls[0].slice(0, 2)).toEqual([roundId, metadata(1).id]);
  for (const method of ['publish','reviseContent','generate','create','rejectContent','cancel','withdraw','submit','review','recover']) expect(api[method]).not.toHaveBeenCalled();
});

test('reading old content cannot replace the current publication tuple or preview', async () => {
  api.publicationPreview.mockResolvedValue({ preview: { roundId, expectedRoundVersion: 4, contentId: currentId,
    contentVersion: 22, contentHash: digest, childSnapshotHash: digest, content: detail().content, childSnapshot: detail().childSnapshot } });
  api.publish.mockRejectedValue(new Error('synthetic lost response'));
  show('parent'); await openHistory();
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' })); await screen.findByText('PRIVATE HISTORY 1 answer 1');
  expect(within(screen.getByRole('region', { name: '历史题组详情' })).queryByRole('button')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查看发布预览' }));
  fireEvent.click(await screen.findByLabelText('已核算全部答案和判定要点，并确认孩子可见内容'));
  fireEvent.click(screen.getByRole('button', { name: '批准并发布' }));
  await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1));
  expect(api.publish.mock.calls[0][1]).toMatchObject({ contentId: currentId, contentVersion: 22, expectedRoundVersion: 4 });
});

test.each(['withdrawn','cancelled'])('parent can read %s history without enabling new publication', async state => {
  api.detail.mockResolvedValue({ round: { ...detail(), visibility: state === 'withdrawn' ? state : 'draft', cancelledAt: state === 'cancelled' ? '2026-11-05T01:00:00Z' : null } });
  show('parent'); await openHistory(); fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' }));
  await screen.findByText('PRIVATE HISTORY 1 answer 1');
  expect(screen.queryByRole('button', { name: '查看发布预览' })).not.toBeInTheDocument();
});

test('child never requests or renders parent content history', async () => {
  api.detail.mockResolvedValue({ round: { ...detail(), visibility: 'published', learningState: 'passed' } });
  show('student'); await screen.findByText('CURRENT CONTENT');
  expect(screen.queryByRole('button', { name: '查看题组历史' })).not.toBeInTheDocument();
  expect(screen.queryByText('CURRENT CONTENT answer 1')).not.toBeInTheDocument();
  expect(api.contents).not.toHaveBeenCalled(); expect(api.content).not.toHaveBeenCalled();
});

test.each([403,404])('current history %i clears private views and fences older successful history', async status => {
  const late = deferred(); show('parent'); await openHistory();
  api.content.mockReturnValueOnce(late.promise);
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' }));
  api.contents.mockRejectedValueOnce({ response: { status } });
  fireEvent.click(screen.getByRole('button', { name: '查看题组历史' }));
  await screen.findByText('当前身份无法查看这些私有练习。');
  await act(async () => late.resolve({ content: historic(1) }));
  expect(screen.queryByText('CURRENT CONTENT')).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE HISTORY 1 answer 1')).not.toBeInTheDocument();
});

test('new history selection fences an older detail and detail refresh clears both', async () => {
  api.contents.mockResolvedValue({ items: [metadata(2), metadata(1)], page: 1, pageSize: 20 });
  const late = deferred(); api.content.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ content: historic(2) });
  show('parent'); await openHistory();
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' }));
  fireEvent.click(screen.getByRole('button', { name: '查看第 2 版题组' })); await screen.findByText('PRIVATE HISTORY 2 answer 1');
  await act(async () => late.resolve({ content: historic(1) }));
  expect(screen.queryByText('PRIVATE HISTORY 1 answer 1')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' }));
  await waitFor(() => expect(screen.queryByText('PRIVATE HISTORY 2 answer 1')).not.toBeInTheDocument());
});

test.each(['logout','child'])('%s change clears loaded metadata and fences pending private content', async mode => {
  const late = deferred(); api.content.mockReturnValueOnce(late.promise);
  show('parent'); await openHistory(); fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' }));
  act(() => { if (mode === 'logout') clearParentSession(); else resetChildScope({ previousChildId: childId, nextChildId: '9'.repeat(24) }); });
  await act(async () => late.resolve({ content: historic(1) }));
  expect(screen.queryByRole('button', { name: '查看第 1 版题组' })).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE HISTORY 1 answer 1')).not.toBeInTheDocument();
});

test.each(['id','roundId','version','contentHash'])('mismatched history %s cannot render another revision', async field => {
  const value = historic(1); value[field] = field === 'version' ? 2 : (field === 'contentHash' ? 'f'.repeat(64) : 'f'.repeat(24));
  api.content.mockResolvedValue({ content: value }); show('parent'); await openHistory();
  fireEvent.click(screen.getByRole('button', { name: '查看第 1 版题组' })); await screen.findByRole('alert');
  expect(screen.queryByText('PRIVATE HISTORY 1 answer 1')).not.toBeInTheDocument();
});

test.each(['parent','student'].flatMap(role => [['available','来源可用'],['missing','来源已不存在'],['unavailable','来源暂不可用']].map(([status,label]) => [role,status,label])))(
  '%s renders sourceAvailability %s without changing stored questions', async (role,status,label) => {
    api.detail.mockResolvedValue({ round: { ...detail(status), visibility: 'published', learningState: 'passed' } });
    show(role); await screen.findByText(label); expect(screen.getByText('CURRENT CONTENT')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled(); expect(api.publish).not.toHaveBeenCalled();
  });
