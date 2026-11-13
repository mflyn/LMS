import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildPracticePage } from '../../pages/family/Ai3PracticePage';
import { createAi3Api } from '../../services/ai3Api';
import { createAi2MediaApi } from '../../services/ai2MediaApi';
import { saveChildSession } from '../../services/familySession';

// Mock only HTTP boundaries. The page, session fence, command store and Ai3Media are real.
jest.mock('../../services/ai3Api', () => ({ createAi3Api: jest.fn() }));
jest.mock('../../services/ai2MediaApi', () => ({ ...jest.requireActual('../../services/ai2MediaApi'), createAi2MediaApi: jest.fn() }));
jest.mock('../../contexts/ChildAuthContext', () => ({
  useChildAuth: () => ({ child: { childId: 'c'.repeat(24), familyId: 'b'.repeat(24) } })
}));
const childId = 'c'.repeat(24), familyId = 'b'.repeat(24), roundId = 'd'.repeat(24), mediaId = '1'.repeat(24);
const detail = () => ({ round: { id: roundId, exerciseCount: 2, visibility: 'published', learningState: 'open',
  stateVersion: 3, pending: false, contentId: 'e'.repeat(24), contentVersion: 1, childSnapshotHash: 'f'.repeat(64),
  childSnapshot: { instructions: 'Synthetic draft instructions', exercises: [
    { exerciseId: 'q1', questionText: '132 x 24' }, { exerciseId: 'q2', questionText: '203 x 31' }
  ] }, currentAttemptId: null, currentAttemptVersion: 0, sourceAvailability: 'available' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let api, media;
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic-session', child: { childId, familyId, name: 'Synthetic child' } });
  api = { rounds: jest.fn().mockResolvedValue({ items: [] }), commands: jest.fn().mockResolvedValue({ items: [] }),
    detail: jest.fn().mockImplementation(async () => detail()), submit: jest.fn() };
  media = { upload: jest.fn().mockResolvedValueOnce({ media: { mediaId, mimeType: 'image/png', sizeBytes: 5, purpose: 'ai3_practice' } })
    .mockRejectedValueOnce(Error('Synthetic lost upload')),
  access: jest.fn().mockResolvedValue({ media: { mediaId, mimeType: 'image/png', sizeBytes: 5, purpose: 'ai3_practice' },
    access: { expiresAt: new Date(Date.now() + 60000).toISOString() } }),
  content: jest.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })), remove: jest.fn() };
  createAi3Api.mockReturnValue(api); createAi2MediaApi.mockReturnValue(media);
  URL.createObjectURL = jest.fn().mockReturnValue('blob:synthetic-ai3-draft'); URL.revokeObjectURL = jest.fn();
});
async function partialUpload() {
  render(<MemoryRouter initialEntries={[`/child/practice?roundId=${roundId}`]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ChildPracticePage /></MemoryRouter>);
  await screen.findByText('Synthetic draft instructions');
  fireEvent.change(screen.getByLabelText('作答说明'), { target: { value: 'Synthetic private draft note' } });
  fireEvent.change(screen.getByLabelText('添加练习图片'), { target: { files: ['a.png', 'b.png'].map(name =>
    new File(['image'], name, { type: 'image/png', lastModified: 1 })) } });
  await waitFor(() => expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled());
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
}
const refresh = trigger => trigger === 'focus' ? fireEvent(window, new Event('focus'))
  : fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' }));
const assertPrivateGone = () => {
  expect(screen.queryByText('Synthetic draft instructions')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Synthetic private draft note')).not.toBeInTheDocument();
  expect(screen.queryByText('已添加 1/10')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试上传 b.png' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交作答' })).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '练习图片 1' })).not.toBeInTheDocument();
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
};
test.each(['manual', 'focus'])('AI3 %s refresh retains successes, failures and submission lock after response commits', async trigger => {
  await partialUpload(); const read = deferred(); api.detail.mockReturnValueOnce(read.promise);
  await act(async () => refresh(trigger)); expect(api.detail).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  await act(async () => { read.resolve(detail()); await read.promise; });
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled();
  expect(screen.getByLabelText('作答说明')).toHaveValue('Synthetic private draft note');
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  expect(media.upload).toHaveBeenCalledTimes(2); expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 b.png' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '提交作答' })).toBeEnabled());
});
test('AI3 network failure during refresh retains draft and never releases the upload failure lock', async () => {
  await partialUpload(); api.detail.mockRejectedValueOnce(Error('offline')); await act(async () => refresh('manual'));
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument(); expect(screen.getByLabelText('作答说明')).toHaveValue('Synthetic private draft note');
  expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled(); expect(media.upload).toHaveBeenCalledTimes(2);
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
});
test.each(['manual', 'focus'])('AI3 %s pending round transition retains partial upload failures until explicitly handled', async trigger => {
  await partialUpload();
  const pending = detail(); pending.round.pending = true; pending.round.stateVersion = 4;
  api.detail.mockResolvedValueOnce(pending);
  await act(async () => refresh(trigger));
  const submit = screen.queryByRole('button', { name: '提交作答' });
  if (submit) expect(submit).toBeDisabled();
  const stable = detail(); stable.round.stateVersion = 6;
  api.detail.mockResolvedValueOnce(stable);
  await act(async () => refresh(trigger));
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled();
  expect(screen.getByLabelText('作答说明')).toHaveValue('Synthetic private draft note');
  fireEvent.click(screen.getByRole('button', { name: '提交作答' }));
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
  expect(media.upload).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 b.png' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '提交作答' })).toBeEnabled());
});
test('AI3 command pagination and empty refresh cannot release a discovered unresolved write', async () => {
  await partialUpload();
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 b.png' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '提交作答' })).toBeEnabled());
  const pending = { id: '2'.repeat(24), roundId, operationId: '11111111-1111-4111-8111-111111111111',
    endpointOperation: 'ai3.submit', phase: 'MEDIA_COMMITTED' };
  const history = Array.from({ length: 19 }, (_, n) => ({ ...pending, id: (n + 30).toString(16).padStart(24, '0'), phase: 'SUCCEEDED' }));
  api.commands.mockResolvedValueOnce({ items: [pending, ...history] }).mockResolvedValue({ items: [] });
  api.detail.mockRejectedValueOnce(Error('Synthetic detail offline'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '刷新练习记录' })));
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'commands下一页' })));
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  await act(async () => fireEvent(window, new Event('focus')));
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '提交作答' })); expect(api.submit).not.toHaveBeenCalled();
  api.recover = jest.fn().mockRejectedValueOnce(Error('Synthetic recover offline'))
    .mockResolvedValueOnce({ command: { ...pending, phase: 'FAILED' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '恢复原操作' })));
  expect(screen.getByRole('button', { name: '提交作答' })).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '恢复原操作' })));
  expect(api.recover).toHaveBeenNthCalledWith(1, pending.id,
    { schemaVersion: 'ai3-min-v1', operationId: pending.operationId }, expect.any(Object));
  expect(api.recover.mock.calls[1]).toEqual(api.recover.mock.calls[0]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '刷新练习详情' })));
  expect(screen.getByLabelText('作答说明')).toBeEnabled();
  expect(api.submit).not.toHaveBeenCalled();
});
test('AI3 current detail 403 clears partial draft and blob and fences older successful detail', async () => {
  await partialUpload(); fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await screen.findByRole('img', { name: '练习图片 1' });
  const old = deferred(); api.detail.mockReturnValueOnce(old.promise).mockRejectedValueOnce({ response: { status: 403 } });
  refresh('focus'); await act(async () => refresh('manual'));
  expect(screen.getByText('当前身份无法查看这些私有练习。')).toBeInTheDocument(); assertPrivateGone();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-ai3-draft');
  await act(async () => { old.resolve(detail()); await old.promise; }); assertPrivateGone();
});
test('AI3 current media 403 clears entire retained draft, not only the image preview', async () => {
  await partialUpload(); media.access.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' }));
  await screen.findByText('当前身份无法查看这些私有练习。'); assertPrivateGone();
});
test.each(['local', 'external'])('AI3 %s account switch releases blobs and fences late detail and bytes', async source => {
  await partialUpload(); fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await screen.findByRole('img', { name: '练习图片 1' });
  const bytes = deferred(); media.content.mockReturnValueOnce(bytes.promise);
  fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await waitFor(() => expect(media.content).toHaveBeenCalledTimes(2));
  const old = deferred(); api.detail.mockReturnValueOnce(old.promise); refresh('focus');
  act(() => {
    const replacement = { token: 'synthetic-replacement', child: { childId: 'a'.repeat(24), familyId, name: 'Other synthetic child' } };
    if (source === 'local') saveChildSession(replacement);
    else {
      const key = `family-growth.session-exit.v1:student:${childId}`;
      localStorage.setItem(key, JSON.stringify({ revision: 'external', reason: 'account_switch' }));
      window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
    }
  });
  assertPrivateGone(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-ai3-draft');
  await act(async () => { old.resolve(detail()); bytes.resolve(new Blob(['image'], { type: 'image/png' })); await Promise.all([old.promise, bytes.promise]); });
  assertPrivateGone(); expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});
