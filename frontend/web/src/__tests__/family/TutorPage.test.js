import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TutorPage from '../../pages/family/TutorPage';
import { tutorApi } from '../../services/tutorApi';
import { captureSession, saveParentSession, clearParentSession } from '../../services/familySession';
import { readTutorCommand } from '../../services/tutorCommands';
import * as tutorCommands from '../../services/tutorCommands';
import { resetChildScope } from '../../services/childScope';

jest.mock('../../services/tutorApi', () => ({ tutorApi: Object.fromEntries(
  ['cycles', 'jobs', 'detail', 'job', 'artifact', 'create', 'generate', 'recover', 'revise', 'review', 'close'].map(k => [k, jest.fn()])) }));
const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24), cycleId = 'd'.repeat(24), sourceId = 'e'.repeat(24);
let mockChildId = 'c'.repeat(24);
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({ family: { familyId: 'b'.repeat(24) },
  selectedChildId: mockChildId, selectedChild: { childId: mockChildId, name: '合成孩子' }, childScopeVersion: 1 }) }));
const preview = { generationInputHash: 'f'.repeat(64), modelProfileVersion: 'synthetic-model', pricingProfileVersion: 'synthetic-price',
  messages: [{ role: 'system', content: '完整系统提示' }, { role: 'user', content: '完整题目' }], reservedCeilingMicros: 184320,
  sendNotAfter: '2099-01-01T00:00:00.000Z', pricing: { currency: 'CNY', expiresAt: '2099-01-02T00:00:00.000Z' },
  requestOptions: { model: 'synthetic-only', maxInputTokens: 8192, maxOutputTokens: 4096, thinking: 'disabled', tools: [], attemptLimit: 1 } };
const cycle = { id: cycleId, childId, status: 'ready', stateVersion: 1, source: { type: 'task', id: sourceId }, createdBy: actor };
const artifact = { id: '1'.repeat(24), cycleId, version: 1, text: '私有候选 124 * 23', contentHash: '2'.repeat(64),
  reviewVersion: 1, status: 'candidate', origin: 'ai_generation', derivedFromArtifactId: null, createdBy: actor, review: null };
const candidate = () => ({ cycle: { ...cycle, status: 'candidate', stateVersion: 2, currentArtifactId: artifact.id },
  artifacts: [artifact], preview, job: { id: '3'.repeat(24), cycleId, status: 'succeeded', createdBy: actor, canRecover: false,
    budget: { reservedMicros: 184320, settledMicros: 100, state: 'settled' } } });
const login = () => saveParentSession({ token: 'synthetic', user: { id: actor, role: 'parent' } });
const show = (query = `cycleId=${cycleId}&childId=${childId}`) => render(<MemoryRouter initialEntries={[`/app/tutor?${query}`]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TutorPage /></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); mockChildId = childId; localStorage.clear(); sessionStorage.clear(); login();
  tutorApi.cycles.mockResolvedValue({ items: [] }); tutorApi.jobs.mockResolvedValue({ items: [] });
  tutorApi.detail.mockResolvedValue({ cycle, preview, artifacts: [], job: null });
});

test('parent sees full preview and explicitly retries the same unknown generation command after refresh', async () => {
  tutorApi.generate.mockRejectedValue(new Error('lost response'));
  const view = show(); await screen.findByText('完整系统提示'); expect(screen.getByText('完整题目')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('确认以上完整文字及费用上界，发送生成'));
  fireEvent.click(screen.getByRole('button', { name: '生成候选讲解' }));
  await waitFor(() => expect(tutorApi.generate).toHaveBeenCalledTimes(1));
  await screen.findByRole('button', { name: '重试原命令' });
  const original = tutorApi.generate.mock.calls[0][1];
  expect(readTutorCommand({ familyId, childId }, captureSession('parent')).body).toEqual(original);
  view.unmount(); show(); await screen.findByRole('button', { name: '重试原命令' });
  expect(tutorApi.generate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(tutorApi.generate).toHaveBeenCalledTimes(2));
  expect(tutorApi.generate.mock.calls[1][1]).toEqual(original);
});
test('source create requires explicit private-text confirmation and does not copy source metadata', async () => {
  tutorApi.create.mockRejectedValue(new Error('lost create'));
  show(`sourceType=mistake&sourceId=${sourceId}&childId=${childId}`);
  fireEvent.change(screen.getByLabelText('题目文字'), { target: { value: '206 * 30' } });
  fireEvent.click(screen.getByLabelText('已核对文字，不含个人信息或链接'));
  fireEvent.click(screen.getByRole('button', { name: '创建外发预览' }));
  await waitFor(() => expect(tutorApi.create).toHaveBeenCalledTimes(1));
  expect(tutorApi.create.mock.calls[0][0]).toMatchObject({ childId, source: { type: 'mistake', id: sourceId },
    input: { questionText: '206 * 30', answerText: null, parentContext: '' }, deidentifiedConfirmed: true });
  await screen.findByRole('button', { name: '重试原命令' });
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' }));
  await waitFor(() => expect(tutorApi.cycles).toHaveBeenCalledTimes(2));
  expect(tutorApi.create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '创建外发预览' })).toBeDisabled();
});
test('review binds the viewed version; conflict clears it and requires an explicit detail reread', async () => {
  tutorApi.detail.mockResolvedValue(candidate()); tutorApi.review.mockRejectedValue({ response: { status: 409, data: { success: false, error: { code: 'AI_VERSION_CONFLICT' } } } });
  show(); await screen.findByText(artifact.text);
  for (const name of ['数学正确', '适合年级', '符合章节', '表述已核对']) fireEvent.click(screen.getByLabelText(name));
  fireEvent.click(screen.getByRole('button', { name: '批准所见版本' }));
  await waitFor(() => expect(tutorApi.review).toHaveBeenCalledTimes(1));
  expect(tutorApi.review.mock.calls[0][1]).toMatchObject({ artifactId: artifact.id, artifactVersion: 1,
    artifactContentHash: artifact.contentHash, expectedArtifactReviewVersion: 1, expectedCycleStateVersion: 2 });
  await waitFor(() => expect(screen.queryByText(artifact.text)).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '批准所见版本' })).not.toBeInTheDocument();
  expect(tutorApi.detail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' })); await screen.findByText(artifact.text);
  expect(screen.getByRole('button', { name: '批准所见版本' })).toBeDisabled();
});
test('current list 403 clears private detail and ignores a pending detail success', async () => {
  tutorApi.detail.mockResolvedValueOnce(candidate()); show(); await screen.findByText(artifact.text);
  let resolve; tutorApi.detail.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  tutorApi.cycles.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '刷新记录' }));
  await waitFor(() => expect(screen.queryByText(artifact.text)).not.toBeInTheDocument());
  await act(async () => resolve(candidate()));
  expect(screen.queryByText(artifact.text)).not.toBeInTheDocument();
});
test('logout hides private text immediately; relogin discovers original unfinished job without auto recovery', async () => {
  tutorApi.detail.mockResolvedValue(candidate()); show(); await screen.findByText(artifact.text);
  act(() => clearParentSession()); expect(screen.queryByText(artifact.text)).not.toBeInTheDocument();
  tutorApi.jobs.mockResolvedValue({ items: [{ id: '3'.repeat(24), cycleId, status: 'unknown', canRecover: true }] });
  act(() => login()); await screen.findByRole('button', { name: '恢复原任务' });
  expect(tutorApi.recover).not.toHaveBeenCalled();
});
test('child switch aborts an unknown write and late success cannot restore text or local commands', async () => {
  const finish = jest.spyOn(tutorCommands, 'finishTutorCommand');
  tutorApi.detail.mockResolvedValue(candidate()); let resolve;
  tutorApi.revise.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  show(); await screen.findByText(artifact.text);
  fireEvent.change(screen.getByLabelText('修订文字'), { target: { value: '旧孩子私有修订' } });
  fireEvent.change(screen.getByLabelText('修订原因'), { target: { value: '数位' } });
  fireEvent.click(screen.getByRole('button', { name: '保存修订版本' }));
  await waitFor(() => expect(tutorApi.revise).toHaveBeenCalledTimes(1));
  const signal = tutorApi.revise.mock.calls[0][2].signal;
  tutorApi.detail.mockRejectedValue({ response: { status: 403 } });
  act(() => { mockChildId = 'f'.repeat(24); resetChildScope({ previousChildId: childId, nextChildId: mockChildId }); });
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('该入口不属于当前选择的孩子');
  await act(async () => resolve({ artifact: { ...artifact, id: '4'.repeat(24), text: '旧孩子私有修订', version: 2,
    origin: 'parent_revision', derivedFromArtifactId: artifact.id }, cycleStateVersion: 3 }));
  expect(screen.queryByText(artifact.text)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('旧孩子私有修订')).not.toBeInTheDocument();
  expect(readTutorCommand({ familyId, childId }, captureSession('parent'))).toBeNull();
  expect(tutorApi.revise).toHaveBeenCalledTimes(1);
  expect(finish).not.toHaveBeenCalled();
  for (const method of ['detail', 'cycles', 'jobs']) expect(tutorApi[method]).toHaveBeenCalledTimes(1);
  finish.mockRestore();
});
test('detail 403 invalidates a pending write success; ordinary network refresh retains its original command', async () => {
  tutorApi.detail.mockResolvedValue(candidate()); let resolve;
  tutorApi.review.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  show(); await screen.findByText(artifact.text);
  for (const name of ['数学正确', '适合年级', '符合章节', '表述已核对']) fireEvent.click(screen.getByLabelText(name));
  fireEvent.click(screen.getByRole('button', { name: '批准所见版本' }));
  await waitFor(() => expect(tutorApi.review).toHaveBeenCalledTimes(1));
  const original = readTutorCommand({ familyId, childId }, captureSession('parent'));
  tutorApi.detail.mockRejectedValueOnce(new Error('network'));
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  await screen.findByRole('alert');
  expect(readTutorCommand({ familyId, childId }, captureSession('parent'))).toEqual(original);
  expect(screen.getByText(artifact.text)).toBeInTheDocument();
  tutorApi.detail.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  await waitFor(() => expect(screen.queryByText(artifact.text)).not.toBeInTheDocument());
  await act(async () => resolve({ artifact: { ...artifact, status: 'parent_approved', reviewVersion: 2,
    review: { reviewerId: actor, decision: 'approve' } }, cycleStateVersion: 3 }));
  expect(screen.queryByText(artifact.text)).not.toBeInTheDocument();
  expect(readTutorCommand({ familyId, childId }, captureSession('parent'))).toEqual(original);
  expect(tutorApi.review).toHaveBeenCalledTimes(1);
});
test.each(['approved', 'closed'])('%s text is plain text, never editable or published to a child', async status => {
  const text = '<script>alert(1)</script><img src="https://example.test/private">';
  const data = candidate(); data.cycle.status = status; data.artifacts[0] = { ...artifact, text, status: 'parent_approved' };
  tutorApi.detail.mockResolvedValue(data); const view = show(); await screen.findByText(text);
  expect(view.container.querySelector('script')).toBeNull(); expect(view.container.querySelector('img')).toBeNull();
  expect(screen.queryByLabelText('修订文字')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '批准所见版本' })).not.toBeInTheDocument();
  if (status === 'closed') expect(screen.queryByRole('button', { name: '关闭讲解周期' })).not.toBeInTheDocument();
});

test('manual revision retains its original text, hash, editor, derivation and reason on reread', async () => {
  const data = candidate();
  data.artifacts.push({ ...artifact, id: '4'.repeat(24), version: 2, text: 'Synthetic revised explanation',
    contentHash: '5'.repeat(64), origin: 'parent_revision', derivedFromArtifactId: artifact.id, revisionReason: 'Clarify units' });
  data.cycle.currentArtifactId = data.artifacts[1].id;
  tutorApi.detail.mockResolvedValue(data); show();
  await screen.findByText(artifact.text);
  expect(screen.getByText('Synthetic revised explanation')).toBeInTheDocument();
  expect(screen.getByText(/Clarify units/)).toBeInTheDocument();
  expect(screen.getByText(artifact.contentHash, { exact: false })).toBeInTheDocument();
  expect(tutorApi.generate).not.toHaveBeenCalled(); expect(tutorApi.revise).not.toHaveBeenCalled();
});

test('StrictMode effect replay retains live reads while discarding the first setup response', async () => {
  let resolveOld;
  tutorApi.detail.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(<React.StrictMode><MemoryRouter initialEntries={[`/app/tutor?cycleId=${cycleId}&childId=${childId}`]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TutorPage /></MemoryRouter></React.StrictMode>);
  await screen.findByText('完整系统提示');
  expect(tutorApi.detail).toHaveBeenCalledTimes(2);
  expect(tutorApi.detail.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => resolveOld(candidate()));
  expect(screen.queryByText(artifact.text)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新详情' }));
  await waitFor(() => expect(tutorApi.detail).toHaveBeenCalledTimes(3));
  expect(screen.getByText('完整系统提示')).toBeInTheDocument();
});

test.each(['focus', 'visibilitychange'])('same identity %s preserves manual input and does not reload', async event => {
  show(`sourceType=mistake&sourceId=${sourceId}&childId=${childId}`);
  await waitFor(() => expect(tutorApi.cycles).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('题目文字'), { target: { value: 'SYNTHETIC UNSAVED DRAFT' } });
  await act(async () => { (event === 'focus' ? window : document).dispatchEvent(new Event(event)); });
  expect(screen.getByLabelText('题目文字')).toHaveValue('SYNTHETIC UNSAVED DRAFT');
  expect(tutorApi.cycles).toHaveBeenCalledTimes(1);
  expect(tutorApi.create).not.toHaveBeenCalled();
});

test.each([undefined, {}, { job: { id: '3'.repeat(24), cycleId: '9'.repeat(24), status: 'unknown' } }])(
  'unverifiable generation success preserves and retries the original command: %j', async response => {
    tutorApi.generate.mockResolvedValue(response);
    show(); await screen.findByText('完整系统提示');
    fireEvent.click(screen.getByLabelText('确认以上完整文字及费用上界，发送生成'));
    fireEvent.click(screen.getByRole('button', { name: '生成候选讲解' }));
    await screen.findByRole('alert');
    const original = tutorApi.generate.mock.calls[0][1];
    expect(readTutorCommand({ familyId, childId }, captureSession('parent')).body).toEqual(original);
    expect(screen.getByRole('button', { name: '生成候选讲解' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
    await waitFor(() => expect(tutorApi.generate).toHaveBeenCalledTimes(2));
    expect(tutorApi.generate.mock.calls[1][1]).toEqual(original);
  });

test.each([400, 404, 409, 413])('unverified HTTP %s does not discard an unknown generation command', async status => {
  tutorApi.generate.mockRejectedValue({ response: { status, data: '<html>proxy error</html>' } });
  show(); await screen.findByText('完整系统提示');
  fireEvent.click(screen.getByLabelText('确认以上完整文字及费用上界，发送生成'));
  fireEvent.click(screen.getByRole('button', { name: '生成候选讲解' }));
  await screen.findByRole('alert');
  expect(readTutorCommand({ familyId, childId }, captureSession('parent')).body).toEqual(tutorApi.generate.mock.calls[0][1]);
  expect(screen.getByRole('button', { name: '重试原命令' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '生成候选讲解' })).toBeDisabled();
});

test.each([[400, ['VALIDATION_ERROR']], [409, ['AI_VERSION_CONFLICT']], [413, ['AI_INPUT_TOO_LARGE']]])(
  'non-string rejection code at HTTP %s keeps the same pending command', async (status, errorCode) => {
    tutorApi.generate.mockRejectedValue({ response: { status, data: { success: false, error: { code: errorCode } } } });
    show(); await screen.findByText('完整系统提示');
    fireEvent.click(screen.getByLabelText('确认以上完整文字及费用上界，发送生成'));
    fireEvent.click(screen.getByRole('button', { name: '生成候选讲解' }));
    await screen.findByRole('alert');
    const original = tutorApi.generate.mock.calls[0][1];
    expect(readTutorCommand({ familyId, childId }, captureSession('parent')).body).toEqual(original);
    fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
    await waitFor(() => expect(tutorApi.generate).toHaveBeenCalledTimes(2));
    expect(tutorApi.generate.mock.calls[1][1]).toEqual(original);
  });
