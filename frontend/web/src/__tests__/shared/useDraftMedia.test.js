import { act, renderHook } from '@testing-library/react';
import { useDraftMedia } from '../../hooks/useDraftMedia';

describe('Task 6 draft media lifecycle', () => {
  test('TC-MPA-WEB-003 uses the injected child delete operation for cancelled drafts', async () => {
    const deleteMedia = jest.fn().mockResolvedValue({});
    const { result, unmount } = renderHook(() => useDraftMedia({ deleteMedia }));

    act(() => result.current.replace('draft-a'));
    unmount();

    expect(deleteMedia).toHaveBeenCalledWith('draft-a');
  });

  test('TC-MPA-WEB-003 preserves drafts until success and deletes only removed persisted media on commit', () => {
    const deleteMedia = jest.fn().mockResolvedValue({});
    const { result, unmount } = renderHook(() => useDraftMedia({ deleteMedia }));

    act(() => {
      result.current.replace('draft-a');
      result.current.remove('persisted-a');
    });
    expect(deleteMedia).not.toHaveBeenCalled();

    act(() => result.current.commit());
    expect(deleteMedia).toHaveBeenCalledTimes(1);
    expect(deleteMedia).toHaveBeenCalledWith('persisted-a');
    unmount();
    expect(deleteMedia).toHaveBeenCalledTimes(1);
  });

  test('submitted drafts are never deleted by close/unmount after an unknown result', () => {
    const deleteMedia = jest.fn().mockResolvedValue({});
    const { result, unmount } = renderHook(() => useDraftMedia({ deleteMedia }));
    act(() => { result.current.replace('in-flight'); result.current.retainSubmitted(); });
    unmount(); expect(deleteMedia).not.toHaveBeenCalled();
  });

  test('cleanup cannot use the next account credentials', () => {
    const deleteMedia = jest.fn().mockResolvedValue({});
    let current = true;
    const { result, unmount } = renderHook(() => useDraftMedia({ deleteMedia, canDelete: () => current }));
    act(() => result.current.replace('old-private-draft'));
    current = false; unmount(); expect(deleteMedia).not.toHaveBeenCalled();
  });
});
