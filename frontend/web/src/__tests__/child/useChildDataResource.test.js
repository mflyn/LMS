import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useChildDataResource } from '../../hooks/useChildDataResource';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const ResourceProbe = ({ load, enabled = true, initialData = null }) => {
  const resource = useChildDataResource({ load, enabled, initialData });
  return (
    <div>
      <output data-testid="state">{resource.state}</output>
      <output data-testid="data">{resource.data === null ? 'none' : JSON.stringify(resource.data)}</output>
      <output data-testid="partial">{String(resource.partial)}</output>
      <output data-testid="sources">{resource.unavailableSources.join(',')}</output>
      <button type="button" onClick={resource.reload}>reload</button>
    </div>
  );
};

describe('useChildDataResource', () => {
  test('starts loading and resolves ready or empty data', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    const { rerender } = render(<ResourceProbe load={load} />);

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(load).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });

    pending.resolve([{ taskId: 'task-a1' }]);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));

    const emptyLoad = jest.fn().mockResolvedValue([]);
    rerender(<ResourceProbe load={emptyLoad} />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('empty'));
  });

  test('preserves partial envelope metadata', async () => {
    const load = jest.fn().mockResolvedValue({
      data: [{ reminderId: 'reminder-a1' }],
      partial: true,
      unavailableSources: ['mistakes']
    });

    render(<ResourceProbe load={load} />);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('partial'));
    expect(screen.getByTestId('data')).toHaveTextContent('reminder-a1');
    expect(screen.getByTestId('partial')).toHaveTextContent('true');
    expect(screen.getByTestId('sources')).toHaveTextContent('mistakes');
  });

  test.each([
    [undefined, 'retryable_error'],
    [408, 'retryable_error'],
    [429, 'retryable_error'],
    [503, 'retryable_error'],
    [400, 'error'],
    [404, 'error']
  ])('classifies status %s as %s', async (status, expectedState) => {
    const error = status === undefined ? new Error('network') : { response: { status } };
    const load = jest.fn().mockRejectedValue(error);

    render(<ResourceProbe load={load} />);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(expectedState));
  });

  test('reload creates a new request after a retryable error', async () => {
    const load = jest.fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce([{ taskId: 'task-a1' }]);

    render(<ResourceProbe load={load} />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('retryable_error'));

    act(() => screen.getByRole('button', { name: 'reload' }).click());

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('ignores abort errors and aborts an active request on unmount', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
    const { unmount } = render(<ResourceProbe load={load} initialData={[]} />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    unmount();
    expect(abortSpy).toHaveBeenCalledTimes(1);

    pending.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await act(async () => {});
    abortSpy.mockRestore();
  });

  test('does not load while disabled', () => {
    const load = jest.fn();
    render(<ResourceProbe load={load} enabled={false} />);
    expect(screen.getByTestId('state')).toHaveTextContent('empty');
    expect(load).not.toHaveBeenCalled();
  });
});
