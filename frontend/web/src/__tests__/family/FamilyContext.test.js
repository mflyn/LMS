import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import { FamilyProvider, useFamily } from '../../contexts/FamilyContext';
import { PARENT_SESSION_KEY } from '../../services/familySession';
import { getMyFamily } from '../../services/familyApi';

jest.mock('../../services/familyApi', () => ({
  getMyFamily: jest.fn()
}));

const familyPayload = {
  family: { familyId: 'family-a', familyName: '小明的家', timezone: 'Asia/Shanghai' },
  children: [
    { childId: 'child-a1', name: '小明' },
    { childId: 'child-a2', name: '小红' }
  ],
  defaultChildId: 'child-a1'
};

const FamilyProbe = () => {
  const { familyStatus, retry, selectedChild, childScopeVersion, selectChild } = useFamily();

  return (
    <div>
      <output data-testid="family-status">{familyStatus}</output>
      <output data-testid="selected-child">{selectedChild?.name || 'none'}</output>
      <output data-testid="scope-version">{childScopeVersion}</output>
      <button onClick={retry}>重试</button>
      <button onClick={() => selectChild('child-a2')}>切换孩子</button>
    </div>
  );
};

const renderFamily = () => {
  localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
    token: 'parent-token',
    user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
  }));

  return render(
    <AuthProvider>
      <FamilyProvider>
        <FamilyProbe />
      </FamilyProvider>
    </AuthProvider>
  );
};

describe('family context', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('loads the family default child and invalidates the child scope on switch', async () => {
    getMyFamily.mockResolvedValueOnce(familyPayload);
    renderFamily();

    await waitFor(() => expect(screen.getByTestId('family-status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('selected-child')).toHaveTextContent('小明');
    const initialScopeVersion = Number(screen.getByTestId('scope-version').textContent);

    fireEvent.click(screen.getByRole('button', { name: '切换孩子' }));

    await waitFor(() => expect(screen.getByTestId('selected-child')).toHaveTextContent('小红'));
    expect(Number(screen.getByTestId('scope-version').textContent)).toBeGreaterThan(initialScopeVersion);
  });

  test('maps only the documented missing-family response to needs_family', async () => {
    getMyFamily.mockRejectedValueOnce({
      response: { status: 404, data: { error: { code: 'RESOURCE_NOT_FOUND' } } }
    });
    renderFamily();

    await waitFor(() => expect(screen.getByTestId('family-status')).toHaveTextContent('needs_family'));
  });

  test('shows a retryable error and can retry the family lookup', async () => {
    getMyFamily
      .mockRejectedValueOnce({ response: { status: 503, data: { error: { code: 'UPSTREAM_UNAVAILABLE' } } } })
      .mockResolvedValueOnce(familyPayload);
    renderFamily();

    await waitFor(() => expect(screen.getByTestId('family-status')).toHaveTextContent('error'));
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByTestId('family-status')).toHaveTextContent('ready'));
    expect(getMyFamily).toHaveBeenCalledTimes(2);
  });

  test('keeps an established family view mounted during a background reload', async () => {
    let resolveReload;
    getMyFamily
      .mockResolvedValueOnce(familyPayload)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveReload = resolve; }));
    renderFamily();

    await waitFor(() => expect(screen.getByTestId('family-status')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(screen.getByTestId('family-status')).toHaveTextContent('ready');
    resolveReload(familyPayload);
    await waitFor(() => expect(getMyFamily).toHaveBeenCalledTimes(2));
  });
});
