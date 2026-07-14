import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const ResourceProbe = ({
  load,
  enabled = true,
  initialData = null,
  isCurrentRequest,
  subscribeReset
}) => {
  const resource = useAsyncResource({
    load,
    enabled,
    initialData,
    isCurrentRequest,
    subscribeReset
  });

  return (
    <div>
      <output data-testid="state">{resource.state}</output>
      <output data-testid="data">
        {resource.data === null ? 'none' : JSON.stringify(resource.data)}
      </output>
      <output data-testid="partial">{String(resource.partial)}</output>
      <output data-testid="sources">{resource.unavailableSources.join(',')}</output>
      <button type="button" onClick={resource.reload}>reload</button>
    </div>
  );
};

describe('useAsyncResource', () => {
  test('maps loading, partial, ready, and empty resource states', async () => {
    const load = jest.fn()
      .mockResolvedValueOnce({
        data: [{ id: 'record-a' }],
        partial: true,
        unavailableSources: ['weekly_report']
      })
      .mockResolvedValueOnce([]);

    render(<ResourceProbe load={load} />);

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('partial'));
    expect(screen.getByTestId('data')).toHaveTextContent('record-a');
    expect(screen.getByTestId('sources')).toHaveTextContent('weekly_report');

    fireEvent.click(screen.getByRole('button', { name: 'reload' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('empty'));
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

  test('aborts and resets synchronously through an external reset subscription', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    const unsubscribe = jest.fn();
    let reset;
    const subscribeReset = jest.fn((listener) => {
      reset = listener;
      return unsubscribe;
    });
    const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
    const { unmount } = render(
      <ResourceProbe load={load} initialData={[{ id: 'stale' }]} subscribeReset={subscribeReset} />
    );

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => reset());

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(screen.getByTestId('data')).toHaveTextContent('stale');

    await act(async () => {
      pending.resolve([{ id: 'late' }]);
      await pending.promise;
    });
    expect(screen.getByTestId('data')).not.toHaveTextContent('late');

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    abortSpy.mockRestore();
  });

  test('drops a result rejected by the caller-owned request guard', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    const isCurrentRequest = jest.fn(() => false);

    render(
      <ResourceProbe
        load={load}
        initialData={[{ id: 'current' }]}
        isCurrentRequest={isCurrentRequest}
      />
    );

    await act(async () => {
      pending.resolve([{ id: 'stale' }]);
      await pending.promise;
    });

    expect(isCurrentRequest).toHaveBeenCalled();
    expect(screen.getByTestId('data')).toHaveTextContent('current');
    expect(screen.getByTestId('data')).not.toHaveTextContent('stale');
  });

  test('does not load while disabled and treats an empty array as empty', () => {
    const load = jest.fn();
    render(<ResourceProbe load={load} enabled={false} initialData={[]} />);

    expect(screen.getByTestId('state')).toHaveTextContent('empty');
    expect(load).not.toHaveBeenCalled();
  });
});
