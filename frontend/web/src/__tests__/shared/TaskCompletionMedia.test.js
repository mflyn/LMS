import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskCompletionMedia from '../../components/family/TaskCompletionMedia';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const file = (name = 'work.png', type = 'image/png') => new File(['image'], name, { type });
const access = (id = 'a', ms = 60000) => ({ access: {
  url: `https://media.example/${id}`, expiresAt: new Date(Date.now() + ms).toISOString()
} });
const defaults = () => ({ childId: 'child-a', scopeKey: 'actor/family/child/task/session',
  uploadPrivateMedia: jest.fn().mockResolvedValue({ media: { mediaId: 'new' } }),
  getPrivateMediaAccess: jest.fn().mockResolvedValue(access()), deletePrivateMedia: jest.fn().mockResolvedValue({}),
  onBusyChange: jest.fn(), onChange: jest.fn() });
const Harness = ({ initial = [], ...props }) => {
  const [values, setValues] = useState(initial);
  return <TaskCompletionMedia {...props} values={values} onChange={ids => { setValues(ids); props.onChange?.(ids); }} />;
};
const choose = files => fireEvent.change(screen.getByLabelText('添加完成图片'), { target: { files } });
const preview = (index = 1) => fireEvent.click(screen.getByRole('button', { name: `查看完成图片 ${index}` }));
const confirmDelete = (index = 1) => {
  fireEvent.click(screen.getByRole('button', { name: `隐私删除完成图片 ${index}` }));
  fireEvent.click(screen.getByRole('button', { name: '确认隐私删除' }));
};
const settle = async (request, value) => act(async () => { request.resolve(value); await request.promise; });

test.each([0, 1, 10])('%i pictures render without automatic access or writes', count => {
  const props = defaults();
  render(<TaskCompletionMedia {...props} values={Array.from({ length: count }, (_, i) => `m${i}`)} />);
  expect(screen.getByText(`已添加 ${count}/10`)).toBeInTheDocument();
  expect(props.getPrivateMediaAccess).not.toHaveBeenCalled();
  expect(props.deletePrivateMedia).not.toHaveBeenCalled();
  if (count === 10) expect(screen.getByLabelText('添加完成图片')).toBeDisabled();
});

test('uploads sequentially, retains successes, reports each failure and refuses the eleventh', async () => {
  const props = defaults(), first = deferred();
  props.uploadPrivateMedia.mockImplementationOnce(() => first.promise)
    .mockRejectedValueOnce(new Error('private diagnostic'))
    .mockResolvedValueOnce({ media: { mediaId: 'c' } });
  render(<Harness {...props} />);
  choose([file('a.png'), file('b.png'), file('c.png'), file('d.pdf', 'application/pdf')]);
  expect(props.uploadPrivateMedia).toHaveBeenCalledTimes(1);
  await settle(first, { media: { mediaId: 'a' } });
  await waitFor(() => expect(screen.getByText('已添加 2/10')).toBeInTheDocument());
  expect(props.onChange).toHaveBeenLastCalledWith(['a', 'c']);
  expect(props.uploadPrivateMedia).toHaveBeenNthCalledWith(1, { file: expect.any(File), purpose: 'task_completion', childId: 'child-a' });
  expect(screen.getByText(/b.png：/)).toBeInTheDocument();
  expect(screen.getByText(/d.pdf：/)).toBeInTheDocument();
  expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument();
  props.uploadPrivateMedia.mockImplementation(({ file: value }) => Promise.resolve({ mediaId: value.name }));
  choose(Array.from({ length: 9 }, (_, i) => file(`extra${i}.png`)));
  await waitFor(() => expect(screen.getByText('已添加 10/10')).toBeInTheDocument());
  expect(screen.getByText(/extra8.png：.*10/)).toBeInTheDocument();
  expect(props.onChange.mock.calls.every(([ids]) => ids.length <= 10)).toBe(true);
});

test('duplicate selection and duplicate upload IDs do not duplicate values', async () => {
  const props = defaults();
  render(<Harness {...props} />);
  const same = file(); choose([same, same, file('other.png')]);
  await waitFor(() => expect(props.onBusyChange).toHaveBeenLastCalledWith(false));
  expect(props.uploadPrivateMedia).toHaveBeenCalledTimes(2);
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
});

test('ordinary removal and unmount never delete assets', () => {
  const props = defaults();
  const view = render(<Harness {...props} initial={['a', 'b']} />);
  fireEvent.click(screen.getByRole('button', { name: '移除完成图片 1' }));
  expect(props.onChange).toHaveBeenCalledWith(['b']);
  view.unmount();
  expect(props.deletePrivateMedia).not.toHaveBeenCalled();
});

test('manual access renders full contain image and clear-on-error allows manual retry only', async () => {
  const props = defaults();
  render(<TaskCompletionMedia {...props} values={['a']} />);
  preview();
  const img = await screen.findByRole('img', { name: '完成图片 1' });
  expect(img).toHaveStyle({ objectFit: 'contain' });
  expect(screen.getByRole('link', { name: '放大完成图片 1' })).toHaveAttribute('href', access().access.url);
  fireEvent.error(img);
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(props.getPrivateMediaAccess).toHaveBeenCalledTimes(1);
  preview();
  expect(await screen.findByRole('img', { name: '完成图片 1' })).toBeInTheDocument();
});

test.each([401, 403, 404, 500])('authorization %i removes old preview and uses safe per-item feedback', async status => {
  const props = defaults();
  props.getPrivateMediaAccess.mockResolvedValueOnce(access()).mockRejectedValueOnce({ response: { status } });
  render(<TaskCompletionMedia {...props} values={['a', 'b']} />);
  preview(); await screen.findByRole('img', { name: '完成图片 1' });
  preview();
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  await waitFor(() => expect(props.onBusyChange).toHaveBeenLastCalledWith(false));
  expect(screen.getByRole('alert')).toHaveTextContent(status < 500 ? '图片不可访问' : '暂时无法授权');
  expect(screen.getByRole('button', { name: '查看完成图片 2' })).toBeEnabled();
});

test('readOnly preserves confirmed privacy deletion and unknown retries the same DELETE without changing IDs', async () => {
  const props = defaults(), deletion = deferred();
  props.deletePrivateMedia.mockImplementationOnce(() => deletion.promise).mockResolvedValueOnce({});
  render(<TaskCompletionMedia {...props} values={['a']} readOnly />);
  expect(screen.queryByLabelText('添加完成图片')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '移除完成图片 1' })).not.toBeInTheDocument();
  preview(); await screen.findByRole('img', { name: '完成图片 1' });
  fireEvent.click(screen.getByRole('button', { name: '隐私删除完成图片 1' }));
  expect(screen.getByRole('dialog')).toHaveAccessibleName('隐私删除完成图片 1');
  expect(props.deletePrivateMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认隐私删除' }));
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  await act(async () => { deletion.reject(new Error('lost response')); });
  fireEvent.click(screen.getByRole('button', { name: '重试隐私删除完成图片 1' }));
  await screen.findByText('图片已隐私删除');
  expect(props.deletePrivateMedia.mock.calls).toEqual([['a'], ['a']]);
  expect(props.onChange).not.toHaveBeenCalled();
  expect(screen.getByText('已添加 1/10')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '查看完成图片 1' })).not.toBeInTheDocument();
});

test('cancel/Escape confirmation does not DELETE and restores trigger focus', () => {
  const props = defaults(); render(<TaskCompletionMedia {...props} values={['a']} />);
  fireEvent.click(screen.getByRole('button', { name: '隐私删除完成图片 1' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '隐私删除完成图片 1' })).toHaveFocus();
  expect(props.deletePrivateMedia).not.toHaveBeenCalled();
});

test('pending authorization cannot resurrect a deleting item', async () => {
  const props = defaults(), authorization = deferred();
  props.getPrivateMediaAccess.mockReturnValue(authorization.promise);
  render(<TaskCompletionMedia {...props} values={['a']} />);
  preview(); confirmDelete();
  await screen.findByText('图片已隐私删除');
  const busyCalls = props.onBusyChange.mock.calls.length;
  await settle(authorization, access());
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  expect(props.onBusyChange.mock.calls).toHaveLength(busyCalls);
});

test.each(['scope', 'unmount', 'disabled', 'readOnly'])('pending uploads are invalidated by %s without UI/busy callbacks', async change => {
  const props = defaults(), pending = deferred();
  props.uploadPrivateMedia.mockReturnValue(pending.promise);
  const view = render(<TaskCompletionMedia {...props} values={[]} />);
  choose([file(), file('second.png')]);
  if (change === 'unmount') view.unmount();
  else view.rerender(<TaskCompletionMedia {...props} values={[]} {...(change === 'scope' ? { scopeKey: 'other' } : { [change]: true })} />);
  const busyCalls = props.onBusyChange.mock.calls.length;
  await settle(pending, { mediaId: 'stale' });
  expect(props.onChange).not.toHaveBeenCalled();
  expect(props.onBusyChange.mock.calls).toHaveLength(busyCalls);
  expect(props.uploadPrivateMedia).toHaveBeenCalledTimes(1);
  expect(props.deletePrivateMedia).not.toHaveBeenCalled();
});

test('scope and removal invalidate late access while unrelated requests keep busy until done', async () => {
  const props = defaults(), a = deferred(), b = deferred();
  props.getPrivateMediaAccess.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const view = render(<TaskCompletionMedia {...props} values={['a', 'b']} />);
  preview(1); preview(2);
  await settle(b, access('b'));
  expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
  expect(await screen.findByRole('img', { name: '完成图片 2' })).toBeInTheDocument();
  view.rerender(<TaskCompletionMedia {...props} scopeKey="other-session" values={['a']} />);
  const count = props.onBusyChange.mock.calls.length;
  await settle(a, access('a'));
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  expect(props.onBusyChange.mock.calls).toHaveLength(count);
});

test('expiry removes image and link without automatic refresh', async () => {
  jest.useFakeTimers();
  try {
    const props = defaults(); props.getPrivateMediaAccess.mockResolvedValue(access('a', 1000));
    render(<TaskCompletionMedia {...props} values={['a']} />);
    preview(); await act(async () => {});
    expect(screen.getByRole('img', { name: '完成图片 1' })).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1001));
    expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(props.getPrivateMediaAccess).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('visibility return clears old image during revalidation, ignores older response and never loops', async () => {
  const props = defaults(), old = deferred(), current = deferred();
  props.getPrivateMediaAccess.mockResolvedValueOnce(access()).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  render(<TaskCompletionMedia {...props} values={['a']} />);
  preview(); await screen.findByRole('img', { name: '完成图片 1' });
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  fireEvent(document, new Event('visibilitychange'));
  await settle(current, access('fresh'));
  await settle(old, access('stale'));
  expect(screen.getByRole('img', { name: '完成图片 1' })).toHaveAttribute('src', access('fresh').access.url);
  expect(props.getPrivateMediaAccess).toHaveBeenCalledTimes(3);
});

test('disabled or missing identity forbids operations', () => {
  const props = defaults();
  const view = render(<TaskCompletionMedia {...props} disabled values={['a']} />);
  expect(screen.getByLabelText('添加完成图片')).toBeDisabled();
  expect(screen.getByRole('button', { name: '隐私删除完成图片 1' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '查看完成图片 1' })).toBeDisabled();
  view.rerender(<TaskCompletionMedia {...props} scopeKey="" values={['a']} />);
  expect(screen.getByLabelText('添加完成图片')).toBeDisabled();
});

test('batch retains successful IDs even before the controlled owner echoes them', async () => {
  const props = defaults(), third = deferred();
  props.uploadPrivateMedia.mockResolvedValueOnce({ mediaId: 'a' }).mockRejectedValueOnce(new Error('offline'))
    .mockReturnValueOnce(third.promise);
  render(<TaskCompletionMedia {...props} values={[]} />);
  choose([file('a.png'), file('b.png'), file('c.png')]);
  await screen.findByText(/b.png：/);
  await settle(third, { mediaId: 'c' });
  expect(props.onChange).toHaveBeenLastCalledWith(['a', 'c']);
});

test('eleven selected files upload only ten and never silently discard the overflow error', async () => {
  const props = defaults();
  props.uploadPrivateMedia.mockImplementation(({ file: value }) => Promise.resolve({ mediaId: value.name }));
  render(<Harness {...props} />);
  choose(Array.from({ length: 11 }, (_, i) => file(`work${i}.png`)));
  await screen.findByText(/work10.png：.*10/);
  expect(props.uploadPrivateMedia).toHaveBeenCalledTimes(10);
  expect(screen.getByText('已添加 10/10')).toBeInTheDocument();
});

test.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', '', null])('invalid URL %s never reaches the DOM', async url => {
  const props = defaults(); props.getPrivateMediaAccess.mockResolvedValue({ access: { ...access().access, url } });
  render(<TaskCompletionMedia {...props} values={['a']} />);
  preview(); await screen.findByRole('alert');
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test.each([undefined, 'not-a-date', '2000-01-01T00:00:00.000Z'])('missing or expired authorization %s is rejected', async expiresAt => {
  const props = defaults(); props.getPrivateMediaAccess.mockResolvedValue({ access: { ...access().access, expiresAt } });
  render(<TaskCompletionMedia {...props} values={['a']} />);
  preview(); await screen.findByRole('alert');
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
});

test('removing an item invalidates access and re-adding the same ID starts fresh', async () => {
  const props = defaults(), pending = deferred(); props.getPrivateMediaAccess.mockReturnValue(pending.promise);
  const view = render(<TaskCompletionMedia {...props} values={['a']} />);
  preview();
  view.rerender(<TaskCompletionMedia {...props} values={[]} />);
  view.rerender(<TaskCompletionMedia {...props} values={['a']} />);
  const calls = props.onBusyChange.mock.calls.length;
  await settle(pending, access());
  expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
  expect(props.onBusyChange.mock.calls).toHaveLength(calls);
});

test.each(['scope', 'unmount'])('late DELETE response after %s cannot alter UI or busy', async change => {
  const props = defaults(), pending = deferred(); props.deletePrivateMedia.mockReturnValue(pending.promise);
  const view = render(<TaskCompletionMedia {...props} values={['a']} />);
  confirmDelete();
  if (change === 'unmount') view.unmount();
  else view.rerender(<TaskCompletionMedia {...props} scopeKey="new-session" values={['a']} />);
  const calls = props.onBusyChange.mock.calls.length;
  await settle(pending, {});
  expect(props.onBusyChange.mock.calls).toHaveLength(calls);
  expect(props.onChange).not.toHaveBeenCalled();
  expect(screen.queryByText('图片已隐私删除')).not.toBeInTheDocument();
});

test('hidden page clears signed URLs and becoming visible revalidates only previously viewed items', async () => {
  const props = defaults(), pending = deferred();
  props.getPrivateMediaAccess.mockResolvedValueOnce(access()).mockReturnValueOnce(pending.promise);
  render(<TaskCompletionMedia {...props} values={['a', 'b']} />);
  preview(); await screen.findByRole('img', { name: '完成图片 1' });
  const visibility = jest.spyOn(document, 'visibilityState', 'get');
  try {
    visibility.mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange'));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(props.getPrivateMediaAccess).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible'); fireEvent(document, new Event('visibilitychange'));
    expect(props.getPrivateMediaAccess.mock.calls).toEqual([['a'], ['a']]);
    expect(screen.queryByRole('img', { name: '完成图片 1' })).not.toBeInTheDocument();
    await settle(pending, access('fresh'));
    expect(screen.getByRole('img', { name: '完成图片 1' })).toHaveAttribute('src', access('fresh').access.url);
  } finally { visibility.mockRestore(); }
});
