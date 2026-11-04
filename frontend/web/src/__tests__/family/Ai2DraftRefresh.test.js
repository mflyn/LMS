import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildLearningPage } from '../../pages/family/Ai2LearningPage';
import { createAi2Api } from '../../services/ai2Api';
import { createAi2MediaApi } from '../../services/ai2MediaApi';
import { saveChildSession } from '../../services/familySession';

jest.mock('../../services/ai2Api', () => ({ createAi2Api: jest.fn() }));
jest.mock('../../services/ai2MediaApi', () => ({
  ...jest.requireActual('../../services/ai2MediaApi'), createAi2MediaApi: jest.fn()
}));
jest.mock('../../contexts/ChildAuthContext', () => ({
  useChildAuth: () => ({ child: { childId: 'c'.repeat(24), familyId: 'b'.repeat(24) } })
}));

const packageId = 'd'.repeat(24), mediaId = '1'.repeat(24);
let api, media;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const detail = () => ({ package: {
  id: packageId, childSnapshot: { questionText: 'Synthetic question', explanationText: 'Synthetic explanation' },
  visibility: 'published', learningState: 'open', stateVersion: 1, pending: false,
  attempts: [], sourceAvailability: 'available'
} });

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic', child: { childId: 'c'.repeat(24), familyId: 'b'.repeat(24), name: 'Synthetic child' } });
  api = { packages: jest.fn().mockResolvedValue({ items: [] }), commands: jest.fn().mockResolvedValue({ items: [] }),
    detail: jest.fn().mockImplementation(async () => detail()), submit: jest.fn() };
  media = { upload: jest.fn()
    .mockResolvedValueOnce({ media: { mediaId, mimeType: 'image/png', sizeBytes: 5, purpose: 'ai2_correction' } })
    .mockRejectedValueOnce(new Error('Synthetic lost upload')),
  access: jest.fn(), content: jest.fn(), remove: jest.fn() };
  createAi2Api.mockReturnValue(api); createAi2MediaApi.mockReturnValue(media);
});

async function partialUpload() {
  render(<MemoryRouter initialEntries={[`/child/learning?packageId=${packageId}`]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ChildLearningPage /></MemoryRouter>);
  await screen.findByText('Synthetic explanation');
  const files = ['a.png', 'b.png'].map(name => new File(['image'], name, { type: 'image/png', lastModified: 1 }));
  fireEvent.change(screen.getByLabelText('添加订正图片'), { target: { files } });
  await waitFor(() => expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled());
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交订正' })).toBeDisabled();
}

test.each(['manual', 'focus'])('%s detail refresh retains partial-upload failure and submit lock until explicit dismissal', async trigger => {
  await partialUpload();
  const read = deferred(); api.detail.mockReturnValueOnce(read.promise);
  await act(async () => {
    if (trigger === 'focus') fireEvent(window, new Event('focus'));
    else fireEvent.click(screen.getByRole('button', { name: '刷新学习包详情' }));
  });
  expect(api.detail).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '提交订正' })).toBeDisabled();
  // Assert after the detail response commits, not merely after GET starts.
  await act(async () => { read.resolve(detail()); await read.promise; });
  expect(screen.getByRole('button', { name: '提交订正' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重试上传 b.png' })).toBeEnabled();
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(media.upload).toHaveBeenCalledTimes(2);
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 b.png' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '提交订正' })).toBeEnabled());
});

test('detail refusal clears retained draft and rejects a later successful detail response', async () => {
  await partialUpload();
  const late = deferred(); api.detail.mockReturnValueOnce(late.promise)
    .mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent(window, new Event('focus'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '刷新学习包详情' })); });
  expect(screen.getByText('当前身份无法查看这些私有学习内容。')).toBeInTheDocument();
  await act(async () => { late.resolve(detail()); await late.promise; });
  expect(screen.queryByText('Synthetic explanation')).not.toBeInTheDocument();
  expect(screen.queryByText('已添加 1/10')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试上传 b.png' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交订正' })).not.toBeInTheDocument();
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
});

test('switching child clears retained draft and ignores old detail success', async () => {
  await partialUpload();
  const late = deferred(); api.detail.mockReturnValueOnce(late.promise);
  fireEvent(window, new Event('focus'));
  await act(async () => {
    saveChildSession({ token: 'synthetic-other', child: { childId: 'e'.repeat(24), familyId: 'b'.repeat(24), name: 'Other synthetic child' } });
  });
  await act(async () => { late.resolve(detail()); await late.promise; });
  expect(screen.queryByText('Synthetic explanation')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试上传 b.png' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '提交订正' })).not.toBeInTheDocument();
  expect(api.submit).not.toHaveBeenCalled(); expect(media.remove).not.toHaveBeenCalled();
});
