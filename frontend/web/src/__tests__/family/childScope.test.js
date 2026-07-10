import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import { FamilyProvider, useFamily } from '../../contexts/FamilyContext';
import { getMyFamily } from '../../services/familyApi';
import { registerChildScopeReset } from '../../services/childScope';
import { PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({ getMyFamily: jest.fn() }));

const familyPayload = {
  family: { familyId: 'family-a', familyName: '小明的家', timezone: 'Asia/Shanghai' },
  children: [
    { childId: 'child-a1', name: '小明' },
    { childId: 'child-a2', name: '小红' }
  ],
  defaultChildId: 'child-a1'
};

const ScopeProbe = () => {
  const { selectedChild, selectChild } = useFamily();
  return (
    <div>
      <output data-testid="selected-child">{selectedChild?.childId || 'none'}</output>
      <button onClick={() => selectChild('child-a2')}>切换孩子</button>
    </div>
  );
};

test('resets registered child-scoped state before selecting another child', async () => {
  localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
    token: 'parent-token',
    user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
  }));
  getMyFamily.mockResolvedValueOnce(familyPayload);
  const reset = jest.fn();
  const unsubscribe = registerChildScopeReset(reset);

  render(<AuthProvider><FamilyProvider><ScopeProbe /></FamilyProvider></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('selected-child')).toHaveTextContent('child-a1'));
  fireEvent.click(screen.getByRole('button', { name: '切换孩子' }));

  expect(reset).toHaveBeenCalledWith({
    previousChildId: 'child-a1',
    nextChildId: 'child-a2'
  });
  await waitFor(() => expect(screen.getByTestId('selected-child')).toHaveTextContent('child-a2'));
  unsubscribe();
});
