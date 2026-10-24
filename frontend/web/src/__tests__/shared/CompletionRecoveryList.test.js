import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompletionRecoveryList from '../../components/family/CompletionRecoveryList';
import * as childApi from '../../services/childApi';
import * as familyApi from '../../services/familyApi';
import { saveChildSession, saveParentSession } from '../../services/familySession';
jest.mock('../../services/childApi');
jest.mock('../../services/familyApi');
const id = n => String(n).padStart(24, '0');
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });

test('cross-date discovery is read-only and paginated; opening a row navigates without POST', async () => {
  saveChildSession({ token: 'synthetic', child: { childId: id(2), familyId: id(1), name: 'Child' } });
  childApi.listOwnCompletionRecoveries.mockResolvedValueOnce({ items: [{ taskId: id(3), childId: id(2) }], page: 1, hasMore: true })
    .mockResolvedValueOnce({ items: [{ taskId: id(4), childId: id(2) }], page: 2, hasMore: false });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CompletionRecoveryList role="student" childId={id(2)} /></MemoryRouter>);
  expect(childApi.listOwnCompletionRecoveries).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  expect(await screen.findByRole('link', { name: `查看待恢复提交 ${id(3)}` })).toHaveAttribute('href', `/child/tasks/${id(3)}`);
  fireEvent.click(screen.getByRole('button', { name: '待恢复提交下一页' }));
  await screen.findByRole('link', { name: `查看待恢复提交 ${id(4)}` });
  expect(childApi.listOwnCompletionRecoveries.mock.calls[1][0]).toEqual({ page: 2, pageSize: 20 });
  expect(childApi.recoverOwnTaskCompletion).not.toHaveBeenCalled();
});

test('parent rows stay within selected child; a late old actor list cannot repopulate the new session', async () => {
  saveParentSession({ token: 'synthetic-A', user: { id: id(1), role: 'parent' } });
  let finish;
  familyApi.listCompletionRecoveries.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<CompletionRecoveryList role="parent" childId={id(2)} onOpen={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  await waitFor(() => expect(familyApi.listCompletionRecoveries).toHaveBeenCalledTimes(1));
  act(() => saveParentSession({ token: 'synthetic-B', user: { id: id(9), role: 'parent' } }));
  await act(async () => finish({ items: [{ taskId: id(3), childId: id(2) }], page: 1, hasMore: false }));
  expect(screen.queryByRole('button', { name: `查看待恢复提交 ${id(3)}` })).not.toBeInTheDocument();
  familyApi.listCompletionRecoveries.mockResolvedValue({ items: [{ taskId: id(4), childId: id(8) }], page: 1, hasMore: false });
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  await screen.findByText('本页没有当前孩子的待恢复提交。');
  expect(screen.queryByRole('button', { name: `查看待恢复提交 ${id(4)}` })).not.toBeInTheDocument();
});

test('switching children discards a late recovery list for the same parent', async () => {
  saveParentSession({ token: 'synthetic', user: { id: id(1), role: 'parent' } });
  let finish;
  familyApi.listCompletionRecoveries.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const onOpen = jest.fn();
  const view = render(<CompletionRecoveryList role="parent" childId={id(2)} onOpen={onOpen} />);
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  await waitFor(() => expect(familyApi.listCompletionRecoveries).toHaveBeenCalledTimes(1));
  view.rerender(<CompletionRecoveryList role="parent" childId={id(8)} onOpen={onOpen} />);
  await act(async () => finish({ items: [{ taskId: id(3), childId: id(2) }], page: 1, hasMore: false }));
  expect(screen.queryByRole('button', { name: `查看待恢复提交 ${id(3)}` })).not.toBeInTheDocument();
  expect(onOpen).not.toHaveBeenCalled();
  familyApi.listCompletionRecoveries.mockResolvedValueOnce({ items: [{ taskId: id(4), childId: id(8) }], page: 1, hasMore: false });
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  fireEvent.click(await screen.findByRole('button', { name: `查看待恢复提交 ${id(4)}` }));
  expect(onOpen).toHaveBeenCalledWith({ taskId: id(4), childId: id(8) });
});

test('an empty filtered page does not hide later recoveries for the selected child', async () => {
  saveParentSession({ token: 'synthetic', user: { id: id(1), role: 'parent' } });
  familyApi.listCompletionRecoveries.mockResolvedValueOnce({ items: [{ taskId: id(3), childId: id(8) }], page: 1, hasMore: true })
    .mockResolvedValueOnce({ items: [{ taskId: id(4), childId: id(2) }], page: 2, hasMore: false });
  const onOpen = jest.fn();
  render(<CompletionRecoveryList role="parent" childId={id(2)} onOpen={onOpen} />);
  fireEvent.click(screen.getByRole('button', { name: '检查待恢复提交' }));
  await screen.findByText('本页没有当前孩子的待恢复提交。');
  fireEvent.click(screen.getByRole('button', { name: '待恢复提交下一页' }));
  fireEvent.click(await screen.findByRole('button', { name: `查看待恢复提交 ${id(4)}` }));
  expect(onOpen).toHaveBeenCalledWith({ taskId: id(4), childId: id(2) });
  expect(familyApi.listCompletionRecoveries.mock.calls[1][0]).toEqual({ page: 2, pageSize: 20 });
  expect(familyApi.recoverTaskCompletion).not.toHaveBeenCalled();
});
