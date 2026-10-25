import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from '../../pages/family/TasksPage';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';

const id = n => String(n).padStart(24, '0');
let mockFamily;
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '000000000000000000000001' } }) }));
jest.mock('../../services/familyApi');
test('changing child removes old rows and open actions even if the new child request fails', async () => {
  localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic', user: { id: id(1), name: 'Parent', role: 'parent' } });
  mockFamily = { family: { familyId: id(4) }, selectedChildId: id(2), selectedChild: { childId: id(2), name: 'A' }, childScopeVersion: 1 };
  api.listGrowthTasks.mockResolvedValueOnce({ items: [{ taskId: id(3), childId: id(2), familyId: id(4),
    title: 'Private A task', status: 'pending', dimension: 'physical' }] }).mockRejectedValueOnce({ response: { status: 503 } });
  const tree = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TasksPage /></MemoryRouter>;
  const view = render(tree());
  fireEvent.click(await screen.findByRole('button', { name: '取消 Private A task' }));
  expect(screen.getByRole('dialog', { name: '取消任务' })).toBeInTheDocument();
  mockFamily = { ...mockFamily, selectedChildId: id(9), selectedChild: { childId: id(9), name: 'B' }, childScopeVersion: 2 };
  await act(async () => view.rerender(tree()));
  expect(screen.queryByText('Private A task')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await screen.findByRole('button', { name: '重新加载数据' });
  expect(screen.queryByRole('button', { name: '取消 Private A task' })).not.toBeInTheDocument();
  expect(api.cancelOrArchiveGrowthTask).not.toHaveBeenCalled();
});
