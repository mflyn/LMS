import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskCompletionReview from '../../components/family/TaskCompletionReview';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';

const id = n => String(n).padStart(24, '0');
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '000000000000000000000001' }, token: 'synthetic-parent' }) }));
jest.mock('../../services/familyApi');
const detail = (version = 2) => ({ taskId: id(3), familyId: id(4), childId: id(2), title: '合成作品',
  status: 'completed', completionVersion: version, checklistVersion: 0, checklistSnapshot: [],
  completionMediaIds: [], completionMediaReferenceState: 'stable', parentConfirmed: false,
  completedAt: '2026-10-24T01:00:00.000Z', difficulty: 'normal' });
const confirmed = version => ({ ...detail(version), status: 'confirmed', parentConfirmed: true,
  parentFeedback: '首次反馈', starAwardState: 'awarded', confirmedByParentId: id(1), confirmedAt: '2026-10-24T02:00:00.000Z' });
const confirmationResponse = version => ({ task: { taskId: id(3), status: 'confirmed',
  checklistVersion: 0, completionVersion: version, completionMediaIds: [], completionMediaReferenceState: 'stable',
  parentConfirmed: true, parentFeedback: '首次反馈', starAwardState: 'awarded', confirmedByParentId: id(1),
  completedAt: '2026-10-24T01:00:00.000Z', confirmedAt: '2026-10-24T02:00:00.000Z' } });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-parent', user: { id: id(1), name: '合成家长', role: 'parent' } });
  api.getGrowthTask.mockResolvedValue({ task: detail() });
});
const show = props => render(<TaskCompletionReview taskId={id(3)} familyId={id(4)} childId={id(2)} onClose={jest.fn()} {...props} />);

test('loads detail and confirms the displayed version, never a list version', async () => {
  const user = userEvent.setup(); show();
  await screen.findByText(/作品版本.*2/);
  api.confirmGrowthTask.mockImplementation(async () => {
    api.getGrowthTask.mockResolvedValue({ task: confirmed(2) }); return confirmationResponse(2);
  });
  await user.type(screen.getByRole('textbox', { name: '家长反馈' }), '很好');
  await user.click(screen.getByRole('button', { name: '确认并发放星星' }));
  await waitFor(() => expect(api.confirmGrowthTask).toHaveBeenCalledTimes(1));
  expect(api.confirmGrowthTask.mock.calls[0][1]).toEqual({ expectedCompletionVersion: 2, parentFeedback: '很好' });
  expect(await screen.findByText('首次反馈')).toBeInTheDocument();
});

test('version conflict reloads new evidence but never auto-confirms it', async () => {
  const user = userEvent.setup(); show(); await screen.findByText(/作品版本.*2/);
  api.confirmGrowthTask.mockImplementation(async () => {
    api.getGrowthTask.mockResolvedValue({ task: detail(3) });
    throw Object.assign(Error('conflict'), { response: { status: 409,
      data: { success: false, error: { code: 'VERSION_CONFLICT', message: 'conflict', details: [] } } } });
  });
  await user.click(screen.getByRole('button', { name: '确认并发放星星' }));
  await screen.findByText(/作品版本.*3/);
  expect(api.confirmGrowthTask).toHaveBeenCalledTimes(1);
  expect(api.confirmGrowthTask.mock.calls[0][1].expectedCompletionVersion).toBe(2);
});

test('lost confirm response retains the displayed version and original feedback on retry', async () => {
  const user = userEvent.setup(); show(); await screen.findByText(/作品版本.*2/);
  api.confirmGrowthTask.mockRejectedValue(Error('lost'));
  await user.type(screen.getByRole('textbox', { name: '家长反馈' }), '原反馈');
  await user.click(screen.getByRole('button', { name: '确认并发放星星' }));
  await user.click(await screen.findByRole('button', { name: /重试本次/ }));
  expect(api.confirmGrowthTask).toHaveBeenCalledTimes(2);
  expect(api.confirmGrowthTask.mock.calls[1][1]).toEqual(api.confirmGrowthTask.mock.calls[0][1]);
});

test('detail identity mismatch cannot be reviewed', async () => {
  api.getGrowthTask.mockResolvedValue({ task: { ...detail(), childId: id(9) } });
  show(); await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: '确认并发放星星' })).not.toBeInTheDocument();
  expect(api.confirmGrowthTask).not.toHaveBeenCalled();
});

test('editing and pending upload cannot confirm the previously displayed version', async () => {
  const user = userEvent.setup();
  let finishUpload;
  api.uploadPrivateMedia.mockImplementation(() => new Promise(resolve => { finishUpload = resolve; }));
  api.getPrivateMediaAccess.mockResolvedValue({ access: { url: '/synthetic-image', expiresAt: new Date(Date.now() + 60000).toISOString() } });
  show(); await screen.findByText(/作品版本.*2/);
  await user.click(screen.getByRole('button', { name: '代录完成情况' }));
  expect(screen.queryByRole('button', { name: '确认并发放星星' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '修改本次完成' }));
  const input = document.querySelector('input[type="file"]');
  await user.upload(input, new File(['synthetic'], 'work.png', { type: 'image/png' }));
  expect(screen.getByRole('button', { name: '返回作品审核' })).toBeDisabled();
  expect(api.confirmGrowthTask).not.toHaveBeenCalled();
  finishUpload({ media: { mediaId: id(8) } });
  await waitFor(() => expect(screen.getByRole('button', { name: '返回作品审核' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '返回作品审核' }));
  await screen.findByRole('button', { name: '确认并发放星星' });
  expect(api.getGrowthTask).toHaveBeenCalledTimes(2);
  expect(api.deletePrivateMedia).not.toHaveBeenCalled();
});
