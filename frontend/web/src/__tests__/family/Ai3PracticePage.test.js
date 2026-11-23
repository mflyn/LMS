import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FamilyPracticePage, { ChildPracticePage } from '../../pages/family/Ai3PracticePage';
import { createAi3Api } from '../../services/ai3Api';
import { createAi2Api } from '../../services/ai2Api';
import { listKnowledgePoints } from '../../services/familyApi';
import { saveParentSession, saveChildSession, clearChildSession, AI3_COMMAND_PREFIX } from '../../services/familySession';

jest.mock('../../services/ai3Api', () => {
  const api = Object.fromEntries(['rounds','detail','attempts','attempt','commands','command','create','generationPreview',
    'publicationPreview','reviewContext','reviseContent','rejectContent','publish','cancel','withdraw','generate','submit','review','recover']
    .map(k => [k, jest.fn()]));
  return { createAi3Api: () => api };
});
jest.mock('../../services/ai2Api', () => {
  const api = { packages: jest.fn(), detail: jest.fn() };
  return { createAi2Api: () => api };
});
jest.mock('../../services/familyApi', () => ({ listKnowledgePoints: jest.fn(), getMistake: jest.fn() }));
jest.mock('../../components/family/Ai3Media', () => ({ __esModule: true, default: props => <div>
  {!props.readOnly && <button disabled={props.disabled} onClick={() => {
    props.onChange(['1'.repeat(24)]); props.onBlockedChange(false);
  }}>合成选图</button>}
  {props.readOnly && <button onClick={() => props.values.forEach(m => props.onViewed?.(m.mediaId, true))}>合成作品已看</button>}
</div> }));
let mockChild = 'c'.repeat(24);
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({ family: { familyId: 'b'.repeat(24) }, selectedChildId: mockChild, childScopeVersion: 1 }) }));
jest.mock('../../contexts/ChildAuthContext', () => ({ useChildAuth: () => ({ child: { familyId: 'b'.repeat(24), childId: 'c'.repeat(24) } }) }));
const api = createAi3Api('parent'), childId = 'c'.repeat(24), familyId = 'b'.repeat(24), roundId = 'd'.repeat(24);
const attemptId = 'e'.repeat(24), contentId = 'f'.repeat(24), commandId = '9'.repeat(24), h = '2'.repeat(64);
const snapshot = { instructions: '写出计算过程', exercises: [{ exerciseId: 'q1', questionText: '123 × 24' }, { exerciseId: 'q2', questionText: '203 × 31' }] };
const round = () => ({ id: roundId, stateVersion: 3, visibility: 'published', learningState: 'open', pending: false,
  contentId, contentVersion: 1, childSnapshotHash: h, childSnapshot: snapshot, exerciseCount: 2, currentAttemptId: null, currentAttemptVersion: 0 });
const parentRound = () => ({ ...round(), learningState: 'submitted', currentAttemptId: attemptId, currentAttemptVersion: 1,
  currentContentId: contentId, currentContentVersion: 1, currentContentHash: h,
  content: { ...snapshot, exercises: snapshot.exercises.map(q => ({ ...q, answerForParent: 'PRIVATE ANSWER', rubricForParent: '核对数位' })) } });
const attempt = () => ({ id: attemptId, attemptVersion: 1, attemptPayloadHash: h, note: '合成作答', review: null,
  media: [{ mediaId: '1'.repeat(24), mimeType: 'image/png', sizeBytes: 100, status: 'available' }] });
const show = role => render(<MemoryRouter initialEntries={[`/${role === 'parent' ? 'app' : 'child'}/practice?childId=${childId}&roundId=${roundId}`]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{role === 'parent' ? <FamilyPracticePage /> : <ChildPracticePage />}</MemoryRouter>);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const reviewContext = () => ({ roundId, expectedRoundVersion: 3, contentId, contentVersion: 1, contentHash: h,
  attemptId, expectedAttemptVersion: 1, attemptPayloadHash: h, targets: { mistake: null, knowledgePoint: null }, reviewContextHash: h });
const trialPreview = () => ({ generationInputHash: h, generationSchemaVersion: 'ai3-min-v2', feeMode: 'estimate_only',
  modelProfileVersion: 'synthetic', pricingProfileVersion: 'synthetic', estimateMethodVersion: 'reference-8192-4096-v1',
  feeNoticeVersion: 'estimate-not-cap-v1', referenceInputTokens: 8192, referenceOutputTokens: 4096, estimatedReservationMicros: 42,
  messages: [{ role: 'system', content: 'Synthetic full system' }, { role: 'user', content: 'Synthetic full user' }],
  pricing: { sourceReference: 'synthetic-only', expiresAt: '2099-01-02T00:00:00.000Z' },
  sendNotAfter: '2099-01-01T00:00:00.000Z', requestOptions: { maxRequestBytes: 32768, maxOutputTokens: 4096,
    thinking: 'disabled', tools: [], attemptLimit: 1 } });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockChild = childId;
  saveParentSession({ token: 'synthetic-parent', user: { id: 'a'.repeat(24), role: 'parent' } });
  saveChildSession({ token: 'synthetic-child', child: { childId, familyId, name: '合成孩子' } });
  api.rounds.mockResolvedValue({ items: [round()] }); api.commands.mockResolvedValue({ items: [] });
  api.detail.mockResolvedValue({ round: round() }); api.attempts.mockResolvedValue({ items: [] }); api.attempt.mockResolvedValue({ attempt: attempt() });
});
test('v2 AI3 explicitly confirms estimate, never auto-reposts unknown generation and recovers original v2 command', async () => {
  api.detail.mockResolvedValue({ round: { ...parentRound(), visibility: 'draft', currentAttemptId: null } });
  api.generationPreview.mockResolvedValue({ preview: trialPreview() }); api.generate.mockRejectedValue(new Error('lost'));
  const view = show('parent'); await screen.findByRole('button', { name: '查看完整生成请求' });
  fireEvent.click(screen.getByRole('button', { name: '查看完整生成请求' }));
  await screen.findByText(/不是单次或整轮费用硬上限/);
  expect(screen.getByRole('button', { name: '生成候选题组' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('已核对完整请求、脱敏内容并接受估算可能超出、费用未知时停发'));
  fireEvent.click(screen.getByRole('button', { name: '生成候选题组' }));
  await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
  const original = api.generate.mock.calls[0][1];
  await screen.findByRole('region', { name: '未确认原命令' });
  expect(screen.getByLabelText('已核对完整请求、脱敏内容并接受估算可能超出、费用未知时停发')).not.toBeChecked();
  const commandKey = Object.keys(sessionStorage).find(key => key.startsWith(AI3_COMMAND_PREFIX));
  expect(commandKey).toBeDefined();
  expect(JSON.parse(sessionStorage.getItem(commandKey)).body).toEqual(original);
  expect(original).toMatchObject({ schemaVersion: 'ai3-min-v2', estimateAcknowledged: true, expectedEstimatedReservationMicros: 42 });
  expect(original).not.toHaveProperty('maxAuthorizedCostMicros');
  view.unmount();
  const command = { id: commandId, roundId, operationId: original.operationId, endpointOperation: 'ai3.generate', phase: 'UNKNOWN',
    sendBlocked: true, sendBlockReason: 'cost_unknown', budget: { feeMode: 'estimate_only', chargeStatus: 'unknown', estimatedReservationMicros: 42 } };
  api.commands.mockResolvedValue({ items: [command] }); api.recover.mockResolvedValue({ command });
  show('parent'); await screen.findByRole('button', { name: '恢复原操作' });
  expect(api.generate).toHaveBeenCalledTimes(1); expect(api.recover).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '重试原命令' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复原操作' }));
  await waitFor(() => expect(api.recover).toHaveBeenCalledTimes(1));
  expect(api.recover.mock.calls[0][1]).toEqual({ schemaVersion: 'ai3-min-v2', operationId: original.operationId });
  expect(api.generate).toHaveBeenCalledTimes(1);
});
test.each([[400, 'VALIDATION_ERROR'], [413, 'AI_INPUT_TOO_LARGE']])(
  'AI3 definitive %s rejection consumes consent; only fresh confirmation permits a new UUID', async (status, code) => {
    api.detail.mockResolvedValue({ round: { ...parentRound(), visibility: 'draft', currentAttemptId: null } });
    api.generationPreview.mockResolvedValue({ preview: trialPreview() });
    api.generate.mockRejectedValueOnce({ response: { status, data: { success: false, error: { code } } } });
    show('parent');
    const previewButton = await screen.findByRole('button', { name: '查看完整生成请求' });
    await waitFor(() => expect(previewButton).toBeEnabled()); fireEvent.click(previewButton);
    const consent = await screen.findByLabelText('已核对完整请求、脱敏内容并接受估算可能超出、费用未知时停发');
    fireEvent.click(consent); fireEvent.click(screen.getByRole('button', { name: '生成候选题组' }));
    await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(consent).toBeEnabled());
    const original = api.generate.mock.calls[0][1];
    expect(Object.keys(sessionStorage).filter(key => key.startsWith(AI3_COMMAND_PREFIX))).toEqual([]);
    expect(consent).not.toBeChecked();
    expect(screen.getByRole('button', { name: '生成候选题组' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '生成候选题组' }));
    expect(api.generate).toHaveBeenCalledTimes(1);
    api.generate.mockImplementationOnce(async (_round, body) => ({ command: {
      id: commandId, roundId, operationId: body.operationId, endpointOperation: 'ai3.generate', phase: 'SUCCEEDED'
    } }));
    fireEvent.click(consent);
    expect(screen.getByRole('button', { name: '生成候选题组' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '生成候选题组' }));
    await screen.findByText('原命令已完成，请重新查看练习。');
    expect(api.generate).toHaveBeenCalledTimes(2);
    const next = api.generate.mock.calls[1][1];
    expect(next.operationId).not.toBe(original.operationId);
    expect(next).toEqual({ ...original, operationId: next.operationId });
    expect(next.estimateAcknowledged).toBe(true);
    expect(Object.keys(sessionStorage).filter(key => key.startsWith(AI3_COMMAND_PREFIX))).toEqual([]);
  }
);
test('AI3 v2 stale acknowledged preview is rejected before POST and storage', async () => {
  api.detail.mockResolvedValue({ round: { ...parentRound(), visibility: 'draft', currentAttemptId: null } });
  const p = trialPreview(); api.generationPreview.mockResolvedValue({ preview: p });
  show('parent'); await screen.findByRole('button', { name: '查看完整生成请求' });
  fireEvent.click(screen.getByRole('button', { name: '查看完整生成请求' }));
  await screen.findByText(/不是单次或整轮费用硬上限/);
  fireEvent.click(screen.getByLabelText('已核对完整请求、脱敏内容并接受估算可能超出、费用未知时停发'));
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(p.sendNotAfter));
  try { fireEvent.click(screen.getByRole('button', { name: '生成候选题组' })); } finally { clock.mockRestore(); }
  expect(api.generate).not.toHaveBeenCalled();
  expect(Object.keys(sessionStorage).filter(k => k.startsWith(AI3_COMMAND_PREFIX))).toEqual([]);
  expect(screen.getByRole('button', { name: '生成候选题组' })).toBeDisabled();
});
test('terminal AI3 command accepts current shared halt without regressing phase or letting a late clear reopen sends', async () => {
  const command = { id: commandId, roundId, operationId: '00000000-0000-4000-8000-000000000001', endpointOperation: 'ai3.generate', phase: 'SUCCEEDED',
    sendBlocked: false, sendBlockReason: null, budget: { feeMode: 'estimate_only', chargeStatus: 'usage_priced', estimatedReservationMicros: 42, usagePricedMicros: 1 } };
  api.detail.mockResolvedValue({ round: { ...parentRound(), visibility: 'draft', currentAttemptId: null } });
  api.commands.mockResolvedValue({ items: [command] });
  api.command.mockResolvedValue({ command: { ...command, sendBlocked: true, sendBlockReason: 'cost_review_required' } });
  show('parent'); await screen.findByRole('button', { name: '查询原操作' });
  fireEvent.click(screen.getByRole('button', { name: '查询原操作' }));
  await screen.findByText(/费用待核对，已停止后续发送/);
  api.command.mockResolvedValue({ command: { ...command, phase: 'UNKNOWN' } });
  fireEvent.click(screen.getByRole('button', { name: '查询原操作' }));
  await waitFor(() => expect(api.command).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/费用待核对，已停止后续发送/)).toBeInTheDocument();
  expect(screen.getByText(/按用量计价 0.000001/)).toBeInTheDocument();
  api.generationPreview.mockResolvedValue({ preview: trialPreview() });
  await waitFor(() => expect(screen.getByRole('button', { name: '查看完整生成请求' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '查看完整生成请求' }));
  await screen.findByText(/不是单次或整轮费用硬上限/);
  expect(screen.getByRole('button', { name: '生成候选题组' })).toBeDisabled();
  expect(api.generate).not.toHaveBeenCalled();
});
test('task creation includes exact math aliases across knowledge-point pages without accepting other subjects', async () => {
  const source = createAi2Api('parent'), packageId = '8'.repeat(24);
  source.packages.mockResolvedValue({ items: [{ id: packageId }] });
  source.detail.mockResolvedValue({ package: { id: packageId, visibility: 'published', learningState: 'approved',
    source: { type: 'task', id: '7'.repeat(24) }, currentAttemptId: attemptId, stateVersion: 4,
    childSnapshot: { questionText: '来源题' }, attempts: [{ id: attemptId, attemptVersion: 1,
      review: { decision: 'approve' }, sourceReviewHash: h, attemptPayloadHash: h }] } });
  const point = (n, subject) => ({ knowledgePointId: n.toString(16).padStart(24,'0'), name: `知识点${n}`, subject, dimension: 'academic', childId });
  listKnowledgePoints.mockImplementation(async ({page=1,subject}) => {
    const items = page===1 ? Array.from({length:100},(_,i)=>point(i+1,i===0?'math':'english')) : [point(101,' 数学 '),point(102,'MATH'),point(103,'mathematics')];
    return { items: subject ? items.filter(p=>p.subject===subject) : items, total:103, page, pageSize:100 };
  });
  api.create.mockRejectedValue(new Error('lost'));
  render(<MemoryRouter initialEntries={[`/app/practice?childId=${childId}&packageId=${packageId}`]} future={{ v7_startTransition:true,v7_relativeSplatPath:true }}><FamilyPracticePage /></MemoryRouter>);
  await screen.findByRole('option',{name:'知识点101'});
  expect(screen.getByRole('option',{name:'知识点102'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'知识点103'})).not.toBeInTheDocument();
  expect(listKnowledgePoints.mock.calls.map(c=>c[0])).toEqual([
    {childId,dimension:'academic',page:1,pageSize:100},{childId,dimension:'academic',page:2,pageSize:100}]);
  fireEvent.change(screen.getByLabelText('关联知识点'),{target:{value:point(101,'数学').knowledgePointId}});
  fireEvent.change(screen.getByLabelText('题量'),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'创建练习轮次'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.create.mock.calls[0][0]).toMatchObject({exerciseCount:3,knowledgePointId:point(101,'数学').knowledgePointId,sourceReviewHash:h});
});
test('unknown submit preserves original body and UUID after refresh and remount', async () => {
  api.submit.mockRejectedValue(new Error('lost')); const view = show('student'); await screen.findByText('123 × 24');
  fireEvent.click(screen.getByText('合成选图')); fireEvent.change(screen.getByLabelText('作答说明'), { target: { value: '第一行\r\n第二行' } });
  fireEvent.click(screen.getByRole('button', { name: '提交作答' })); await screen.findByRole('button', { name: '重试原命令' });
  const body = api.submit.mock.calls[0][1]; expect(body.childSnapshotHash).toBe(h); expect(body).not.toHaveProperty('contentHash');
  view.unmount(); show('student'); await screen.findByRole('button', { name: '重试原命令' });
  expect(api.submit).toHaveBeenCalledTimes(1); fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2)); expect(api.submit.mock.calls[1][1]).toEqual(body);
});
test('current detail 403 clears private work and fences an older successful response', async () => {
  const older = deferred(); show('student'); await screen.findByText('123 × 24');
  api.detail.mockImplementationOnce(() => older.promise).mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' })); fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' }));
  await screen.findByText('当前身份无法查看这些私有练习。');
  await act(async () => older.resolve({ round: round() })); expect(screen.queryByText('123 × 24')).not.toBeInTheDocument();
});
test('ordinary detail refresh and network failure retain child draft without another POST', async () => {
  show('student'); await screen.findByText('123 × 24'); fireEvent.change(screen.getByLabelText('作答说明'), { target: { value: '未提交草稿' } });
  api.detail.mockRejectedValue(new Error('offline')); fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('作答说明')).toHaveValue('未提交草稿'); expect(api.submit).not.toHaveBeenCalled();
});
test('parent approval requires viewed work and explicit matching context; conflict does not approve new version', async () => {
  api.detail.mockResolvedValue({ round: parentRound() });
  api.reviewContext.mockResolvedValue(reviewContext());
  api.review.mockRejectedValue({ response: { status: 409, data: { success: false, error: { code: 'AI3_REVIEW_CONFLICT' } } } });
  show('parent'); await screen.findByText('合成作答');
  expect(api.reviewContext).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('合成作品已看'));
  fireEvent.click(screen.getByRole('button', { name: '读取审核依据' })); await screen.findByLabelText('整组核对说明');
  fireEvent.change(screen.getByLabelText('整组核对说明'), { target: { value: '两题均已核算' } });
  fireEvent.click(screen.getByRole('button', { name: '通过所见练习' })); await waitFor(() => expect(api.review).toHaveBeenCalledTimes(1));
  expect(api.review.mock.calls[0][2]).toMatchObject({ expectedRoundVersion: 3, reviewContextHash: h, masteryConfirmed: false, reviewReminderDate: null });
  await waitFor(() => expect(screen.queryByRole('button', { name: '通过所见练习' })).not.toBeInTheDocument());
  expect(api.review).toHaveBeenCalledTimes(1);
});
test('a delayed review context cannot survive an intervening detail refresh', async () => {
  api.detail.mockResolvedValue({ round: parentRound() }); const pendingContext = deferred(); api.reviewContext.mockReturnValue(pendingContext.promise);
  show('parent'); await screen.findByText('合成作答'); fireEvent.click(screen.getByText('合成作品已看'));
  fireEvent.click(screen.getByRole('button', { name: '读取审核依据' })); await waitFor(() => expect(api.reviewContext).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' })); await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(2));
  await act(async () => pendingContext.resolve(reviewContext()));
  expect(screen.queryByLabelText('整组核对说明')).not.toBeInTheDocument(); expect(api.review).not.toHaveBeenCalled();
});
test('saved approval is acknowledged without re-reading media and a later read failure does not retry review', async () => {
  api.detail.mockResolvedValue({ round: parentRound() }); api.reviewContext.mockResolvedValue(reviewContext());
  api.review.mockImplementation((_r, _a, body) => Promise.resolve({ command: { id: commandId, roundId,
    operationId: body.operationId, endpointOperation: 'ai3.review', phase: 'SUCCEEDED', resultReference: { roundId, attemptId } },
    reviewSaved: true, effects: { mistake: 'not_requested', mastery: 'not_requested' } }));
  show('parent'); await screen.findByText('合成作答'); fireEvent.click(screen.getByText('合成作品已看'));
  fireEvent.click(screen.getByRole('button', { name: '读取审核依据' })); await screen.findByLabelText('整组核对说明');
  fireEvent.change(screen.getByLabelText('整组核对说明'), { target: { value: '人工核算全部通过' } });
  fireEvent.click(screen.getByRole('button', { name: '通过所见练习' })); await screen.findByText('原命令已完成，请重新查看练习。');
  expect(api.attempt).toHaveBeenCalledTimes(1); expect(api.detail).toHaveBeenCalledTimes(1);
  api.detail.mockRejectedValue(new Error('media service unavailable')); fireEvent.click(screen.getByRole('link', { name: '查看练习', exact: true }));
  await screen.findByRole('alert'); expect(api.review).toHaveBeenCalledTimes(1); expect(screen.queryByRole('button', { name: '重试原命令' })).not.toBeInTheDocument();
});
test('revise uses only the viewed version, requires feedback and never fetches effect context', async () => {
  api.detail.mockResolvedValue({ round: parentRound() }); api.review.mockRejectedValue(new Error('lost'));
  show('parent'); await screen.findByText('合成作答'); expect(screen.getByRole('button', { name: '退回再练' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('审核反馈'), { target: { value: '请核对第二行部分积' } }); fireEvent.click(screen.getByRole('button', { name: '退回再练' }));
  await waitFor(() => expect(api.review).toHaveBeenCalledTimes(1)); expect(api.reviewContext).not.toHaveBeenCalled();
  expect(api.review.mock.calls[0][2]).toMatchObject({ expectedRoundVersion: 3, contentHash: h, expectedAttemptVersion: 1,
    decision: 'revise', evidenceSummary: '', masteryConfirmed: false, reviewReminderDate: null, reviewContextHash: null });
});
test('passed work remains readable but child cannot submit again', async () => {
  api.detail.mockResolvedValue({ round: { ...round(), learningState: 'passed', currentAttemptId: attemptId, currentAttemptVersion: 1, reviewReminderDate: '2026-11-08' } });
  api.attempt.mockResolvedValue({ attempt: { ...attempt(), review: { decision: 'approve', comment: '数位对齐正确', reviewedAt: '2026-11-05T00:00:00.000Z' } } });
  show('student'); await screen.findByText(/数位对齐正确/); expect(screen.queryByRole('button', { name: '提交作答' })).not.toBeInTheDocument();
  expect(screen.getByText(/2026-11-08/)).toBeInTheDocument(); expect(screen.queryByText('PRIVATE ANSWER')).not.toBeInTheDocument();
});
test('logout fences a late private detail and leaves no private question', async () => {
  const pending = deferred(); api.detail.mockReturnValue(pending.promise); show('student');
  await waitFor(() => expect(api.detail).toHaveBeenCalled()); act(() => clearChildSession());
  await act(async () => pending.resolve({ round: round() })); expect(screen.queryByText('123 × 24')).not.toBeInTheDocument();
});
test('relogin discovers and explicitly recovers original actor command, never a new submit', async () => {
  const c = { id: commandId, operationId: '11111111-1111-4111-8111-111111111111', endpointOperation: 'ai3.submit', roundId, phase: 'MEDIA_COMMITTED' };
  api.commands.mockResolvedValue({ items: [c] }); api.recover.mockResolvedValue({ command: { ...c, phase: 'SUCCEEDED', resultReference: { roundId, attemptId } } });
  show('student'); await screen.findByRole('button', { name: '恢复原操作' }); expect(api.recover).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '恢复原操作' })); await waitFor(() => expect(api.recover).toHaveBeenCalledTimes(1));
  expect(api.recover.mock.calls[0][1]).toEqual({ schemaVersion: 'ai3-min-v1', operationId: c.operationId }); expect(api.submit).not.toHaveBeenCalled();
});
test('review context with a different content version never enables approval', async () => {
  api.detail.mockResolvedValue({ round: parentRound() });
  api.reviewContext.mockResolvedValue({ ...reviewContext(), contentVersion: 2 });
  show('parent'); await screen.findByText('合成作答'); fireEvent.click(screen.getByText('合成作品已看'));
  fireEvent.click(screen.getByRole('button', { name: '读取审核依据' }));
  await waitFor(() => expect(api.reviewContext).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.queryByLabelText('整组核对说明')).not.toBeInTheDocument();
  expect(api.review).not.toHaveBeenCalled();
});
test.each([true,false])('persisted generation never repeats POST; discovered=%s', async discovered => {
  const { saveAi3Command } = jest.requireActual('../../services/ai3Commands');
  const { captureSession } = jest.requireActual('../../services/familySession');
  const operationId='11111111-1111-4111-8111-111111111111';
  saveAi3Command({familyId,childId},{action:'generate',targetId:roundId,attemptId:null,body:{
    schemaVersion:'ai3-min-v1',operationId,expectedRoundVersion:1,generationInputHash:h,
    modelProfileVersion:'synthetic-v1',pricingProfileVersion:'synthetic-price-v1',maxAuthorizedCostMicros:100,
    externalSendConfirmed:true,deidentifiedConfirmed:true}},captureSession('parent'));
  const c={id:commandId,roundId,operationId,endpointOperation:'ai3.generate',phase:'UNKNOWN'};
  api.commands.mockResolvedValue({items:discovered?[c]:[]});
  api.recover.mockResolvedValue({command:c}); api.generate.mockResolvedValue({command:c});
  api.detail.mockResolvedValue({round:{...round(),visibility:'draft',pending:true,content:null}});
  show('parent'); await screen.findByRole('region',{name:'未确认原命令'});
  await waitFor(()=>expect(api.commands).toHaveBeenCalled());
  expect(screen.queryByRole('button',{name:'重试原命令'})).not.toBeInTheDocument();
  expect(api.generate).not.toHaveBeenCalled(); expect(api.recover).not.toHaveBeenCalled();
  if(discovered){
    fireEvent.click(await screen.findByRole('button',{name:'恢复原操作'}));
    await waitFor(()=>expect(api.recover).toHaveBeenCalledTimes(1));
    expect(api.recover.mock.calls[0][0]).toBe(commandId);
    expect(api.recover.mock.calls[0][1]).toEqual({schemaVersion:'ai3-min-v1',operationId});
  }
  expect(api.generate).not.toHaveBeenCalled();
});
