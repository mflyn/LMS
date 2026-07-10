import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useChildResource } from '../../hooks/useChildResource';
import { useFamily } from '../../contexts/FamilyContext';
import { registerChildScopeReset } from '../../services/childScope';

jest.mock('../../contexts/FamilyContext', () => ({ useFamily: jest.fn() }));
jest.mock('../../services/childScope', () => ({ registerChildScopeReset: jest.fn() }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const ResourceProbe = ({ load, enabled, initialData }) => {
  const resource = useChildResource({ load, enabled, initialData });

  return (
    <div>
      <output data-testid="state">{resource.state}</output>
      <output data-testid="data">{resource.data ? JSON.stringify(resource.data) : 'none'}</output>
      <output data-testid="partial">{String(resource.partial)}</output>
      <output data-testid="sources">{resource.unavailableSources.join(',')}</output>
      <button onClick={resource.reload}>reload</button>
    </div>
  );
};

describe('useChildResource', () => {
  let family;

  beforeEach(() => {
    family = { selectedChildId: 'child-a1', childScopeVersion: 1 };
    useFamily.mockImplementation(() => family);
    registerChildScopeReset.mockReset();
  });

  test('aborts and clears an old child resource synchronously on scope reset', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    let resetListener;
    registerChildScopeReset.mockImplementation((listener) => {
      resetListener = listener;
      return jest.fn();
    });
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

    render(<ResourceProbe load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({ childId: 'child-a1' })));

    act(() => resetListener({ previousChildId: 'child-a1', nextChildId: 'child-a2' }));

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('data')).toHaveTextContent('none');
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    pending.resolve({ data: [{ id: 'old-child-record' }] });
    await act(async () => {});
    expect(screen.getByTestId('data')).toHaveTextContent('none');
    abortSpy.mockRestore();
  });

  test('commits only the current child and scope version, including partial data', async () => {
    const first = deferred();
    const second = deferred();
    const load = jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { rerender } = render(<ResourceProbe load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    family = { selectedChildId: 'child-a2', childScopeVersion: 2 };
    rerender(<ResourceProbe load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    first.resolve({ data: [{ id: 'old-child-record' }] });
    second.resolve({
      data: [{ id: 'new-child-record' }],
      partial: true,
      unavailableSources: ['weekly_report']
    });

    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('new-child-record'));
    expect(screen.getByTestId('state')).toHaveTextContent('partial');
    expect(screen.getByTestId('partial')).toHaveTextContent('true');
    expect(screen.getByTestId('sources')).toHaveTextContent('weekly_report');
  });

  test('ignores abort errors, exposes retryable errors, and reloads on demand', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const load = jest
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValueOnce({ data: [] });

    render(<ResourceProbe load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('state')).toHaveTextContent('loading');

    await act(async () => {
      await Promise.resolve();
    });
    act(() => screen.getByRole('button', { name: 'reload' }).click());
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('retryable_error'));

    act(() => screen.getByRole('button', { name: 'reload' }).click());
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('empty'));
    expect(load).toHaveBeenCalledTimes(3);
  });
});
