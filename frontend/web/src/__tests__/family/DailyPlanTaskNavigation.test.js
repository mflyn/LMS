import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from '../../pages/family/TasksPage';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';
let mockFamily;
const id = n => String(n).padStart(24, '0');
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '000000000000000000000001' } }) }));
jest.mock('../../services/familyApi');
jest.mock('../../components/family/TaskCompletionReview', () => props => <div role="dialog">{props.childId}:{props.taskId}</div>);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic', user: { id: id(1), role: 'parent' } });
  mockFamily = { family: { familyId: id(4) }, selectedChildId: id(2), selectedChild: { childId: id(2), name: 'A' }, childScopeVersion: 1 };
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
});
const tree = childId => <MemoryRouter initialEntries={[`/app/tasks?childId=${childId}&taskId=${id(3)}`]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TasksPage /></MemoryRouter>;
test('opens the existing scoped detail even when the task is not on the current list page', async () => {
  const view = render(tree(id(2)));
  expect(await screen.findByRole('dialog')).toHaveTextContent(`${id(2)}:${id(3)}`);
  mockFamily = { ...mockFamily, selectedChildId: id(9), selectedChild: { childId: id(9), name: 'B' }, childScopeVersion: 2 };
  await act(async () => view.rerender(tree(id(2))));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('a link for another child never opens a detail under the current child scope', async () => {
  render(tree(id(9))); await waitFor(() => expect(api.listGrowthTasks).toHaveBeenCalled());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
