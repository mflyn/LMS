import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Ai2Media from '../../components/family/Ai2Media';
import { createAi2MediaApi } from '../../services/ai2MediaApi';
import { captureSession, saveChildSession } from '../../services/familySession';

// Only the HTTP boundary is mocked; identity generation and UI lifecycle stay real.
jest.mock('../../services/ai2MediaApi', () => ({
  ...jest.requireActual('../../services/ai2MediaApi'), createAi2MediaApi: jest.fn()
}));
const id = n => n.toString(16).padStart(24, '0');
const childId = id(100), dto = (n, status = 'available') => ({ mediaId: id(n), mimeType: 'image/png', sizeBytes: 5, status });
const file = (name = 'work.png', type = 'image/png') => new File(['image'], name, { type, lastModified: 1 });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const login = (token = 'old') => {
  saveChildSession({ token, child: { childId, familyId: id(200), name: 'Test' } });
  return captureSession('student');
};
let api;
const props = () => ({ role: 'student', session: login(), childId, scopeKey: 'package/attempt',
  onChange: jest.fn(), onBusyChange: jest.fn(), onBlockedChange: jest.fn(),
  onDenied: jest.fn(), onViewed: jest.fn(), onDeleted: jest.fn() });
const Harness = ({ initial = [], ...rest }) => {
  const [values, setValues] = useState(initial);
  return <Ai2Media {...rest} values={values} onChange={ids => { setValues(ids); rest.onChange(ids); }} />;
};
const choose = files => fireEvent.change(screen.getByLabelText('添加订正图片'), { target: { files } });
const preview = (n = 1) => fireEvent.click(screen.getByRole('button', { name: `查看订正图片 ${n}` }));
const confirmDelete = () => {
  fireEvent.click(screen.getByRole('button', { name: '隐私删除订正图片 1' }));
  fireEvent.click(screen.getByRole('button', { name: '确认隐私删除' }));
};
beforeEach(() => {
  localStorage.clear();
  api = { upload: jest.fn().mockResolvedValue({ media: dto(1) }), access: jest.fn().mockResolvedValue({
    access: { expiresAt: new Date(Date.now() + 60000).toISOString() }, media: dto(1)
  }), content: jest.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })), remove: jest.fn().mockResolvedValue(undefined) };
  createAi2MediaApi.mockReturnValue(api);
  URL.createObjectURL = jest.fn().mockReturnValue('blob:private-preview'); URL.revokeObjectURL = jest.fn();
});

test.each([0, 1, 10])('%i entries have no automatic access and enforce submission count', count => {
  const p = props(); render(<Ai2Media {...p} values={Array.from({ length: count }, (_, n) => id(n + 1))} />);
  expect(screen.getByText(`已添加 ${count}/10`)).toBeInTheDocument();
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(count === 0);
  expect(api.access).not.toHaveBeenCalled(); expect(api.remove).not.toHaveBeenCalled();
  expect(screen.getByLabelText('添加订正图片').disabled).toBe(count === 10);
});

test('partial upload keeps success, blocks through other actions, and explicit retry resolves failure', async () => {
  const p = props(); api.upload.mockResolvedValueOnce({ media: dto(1) }).mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValueOnce({ media: dto(2) });
  render(<Harness {...p} />); choose([file('a.png'), file('b.png')]);
  await screen.findByText(/b.png.*上传未确认/);
  expect(p.onChange).toHaveBeenLastCalledWith([id(1)]);
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  expect(screen.queryByText(/private detail/)).not.toBeInTheDocument();
  expect(api.upload).toHaveBeenCalledWith({ childId, file: expect.any(File) }, expect.objectContaining({ session: p.session }));
  fireEvent.click(screen.getByRole('button', { name: '重试上传 b.png' }));
  await waitFor(() => expect(p.onChange).toHaveBeenLastCalledWith([id(1), id(2)]));
  await waitFor(() => expect(p.onBlockedChange).toHaveBeenLastCalledWith(false));
  expect(api.remove).not.toHaveBeenCalled();
});

test('failures persist across new selection until explicitly dismissed; duplicate IDs never duplicate list', async () => {
  const p = props(); render(<Harness {...p} />);
  const same = file(); choose([same, same, file('bad.pdf', 'application/pdf')]);
  await screen.findByText(/bad.pdf/);
  choose([file('other.png')]);
  await screen.findByText(/上传返回重复图片/);
  await waitFor(() => expect(p.onBusyChange).toHaveBeenLastCalledWith(false));
  expect(p.onChange).toHaveBeenCalledTimes(1);
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  for (const button of screen.getAllByRole('button', { name: /^忽略失败/ })) fireEvent.click(button);
  await waitFor(() => expect(p.onBlockedChange).toHaveBeenLastCalledWith(false));
  expect(api.remove).not.toHaveBeenCalled();
});

test('eleven selected files upload ten, overflow remains blocking until dismissed', async () => {
  const p = props(); let n = 0; api.upload.mockImplementation(async () => ({ media: dto(++n) }));
  render(<Harness {...p} />); choose(Array.from({ length: 11 }, (_, i) => file(`${i}.png`)));
  await screen.findByText(/10.png.*10/);
  expect(api.upload).toHaveBeenCalledTimes(10);
  expect(screen.getByText('已添加 10/10')).toBeInTheDocument();
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 10.png' }));
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(false);
});

test.each([[id(1), id(1)], ['invalid'], [dto(1, 'other')], [{ ...dto(1), mimeType: 'application/pdf' }], new Array(1), Array.from({ length: 11 }, (_, n) => id(n + 1))].map(values => [values]))(
  'invalid supplied entries %# fail closed', values => {
    const p = props(); render(<Ai2Media {...p} values={values} />);
    expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(api.access).not.toHaveBeenCalled();
  }
);

test('ordinary removal never DELETEs, while readOnly retains confirmed privacy deletion', async () => {
  const p = props(); const view = render(<Harness {...p} initial={[id(1)]} />);
  fireEvent.click(screen.getByRole('button', { name: '移除订正图片 1' }));
  expect(p.onChange).toHaveBeenCalledWith([]); expect(api.remove).not.toHaveBeenCalled();
  view.unmount(); render(<Ai2Media {...p} values={[id(1)]} readOnly />);
  expect(screen.queryByLabelText('添加订正图片')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '隐私删除订正图片 1' }));
  expect(api.remove).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  confirmDelete(); await screen.findByText('图片已隐私删除');
  expect(p.onDeleted).toHaveBeenCalledWith(id(1));
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
});

test('unknown deletion hides blob and blocks approval without fabricating a tombstone; retry confirms same DELETE', async () => {
  const p = props(); api.remove.mockRejectedValueOnce(new Error('lost response'));
  render(<Ai2Media {...p} values={[id(1)]} readOnly />); preview();
  await screen.findByRole('img', { name: '订正图片 1' }); confirmDelete();
  await screen.findByText(/删除结果尚未确认/);
  expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
  expect(p.onDeleted).not.toHaveBeenCalled();
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: '重试隐私删除订正图片 1' }));
  await screen.findByText('图片已隐私删除');
  expect(p.onDeleted).toHaveBeenCalledWith(id(1));
  expect(api.remove.mock.calls.map(call => call[0])).toEqual([id(1), id(1)]);
  expect(p.onChange).not.toHaveBeenCalled();
});

test('deleted DTO is a blocked placeholder and never authorizes', () => {
  const p = props(); render(<Ai2Media {...p} values={[dto(1, 'deleted')]} readOnly />);
  expect(screen.getByText('图片已隐私删除')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /查看/ })).not.toBeInTheDocument();
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true); expect(api.access).not.toHaveBeenCalled();
});

test('only actual onLoad marks viewed; unmount revokes blob and image errors never mark viewed', async () => {
  const p = props(); const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
  const image = await screen.findByRole('img', { name: '订正图片 1' });
  expect(image).toHaveAttribute('src', 'blob:private-preview'); expect(p.onViewed).not.toHaveBeenCalledWith(id(1), true);
  fireEvent.load(image); fireEvent.load(image);
  expect(p.onViewed.mock.calls.filter(([, viewed]) => viewed)).toEqual([[id(1), true]]);
  preview(); const second = await screen.findByRole('img', { name: '订正图片 1' }); fireEvent.error(second);
  expect(p.onViewed.mock.calls.filter(([, viewed]) => viewed)).toEqual([[id(1), true]]);
  preview(); await screen.findByRole('img', { name: '订正图片 1' }); view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
});

test.each(['scope', 'identity', 'unmount', 'disabled', 'visibility', 'removed'])('late blob after %s cannot create or expose object URL', async change => {
  const p = props(), pending = deferred(); api.content.mockReturnValue(pending.promise);
  const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
  await waitFor(() => expect(api.content).toHaveBeenCalled());
  if (change === 'unmount') view.unmount();
  else if (change === 'identity') act(() => { login('new'); });
  else if (change === 'visibility') fireEvent(document, new Event('visibilitychange'));
  else view.rerender(<Ai2Media {...p} values={change === 'removed' ? [] : [id(1)]}
    scopeKey={change === 'scope' ? 'new-scope' : p.scopeKey} disabled={change === 'disabled'} />);
  await act(async () => { pending.resolve(new Blob(['image'], { type: 'image/png' })); });
  expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(p.onViewed).not.toHaveBeenCalledWith(id(1), true);
});

test('visibility clears shown blobs and requires fresh explicit authorization', async () => {
  const p = props(); render(<Ai2Media {...p} values={[id(1)]} />); preview();
  await screen.findByRole('img', { name: '订正图片 1' });
  fireEvent(document, new Event('visibilitychange'));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
  expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
  expect(api.access).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 404, 410])('current denial %s clears all private previews and notifies owner', async status => {
  const p = props(); render(<Ai2Media {...p} values={[id(1), id(2)]} />); preview();
  await screen.findByRole('img', { name: '订正图片 1' });
  const error = { response: { status } }; api.access.mockRejectedValueOnce(error); preview(2);
  await waitFor(() => expect(p.onDenied).toHaveBeenCalledWith(error));
  expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalled(); expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
});

test.each([401, 403, 404])('late %s after identity/scope replacement cannot deny new view', async status => {
  const p = props(), pending = deferred(); api.access.mockReturnValueOnce(pending.promise);
  const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
  let session; act(() => { session = login('new'); });
  view.rerender(<Ai2Media {...p} session={session} scopeKey="new-scope" values={[id(1)]} />);
  await act(async () => { pending.reject({ response: { status } }); });
  expect(p.onDenied).not.toHaveBeenCalled(); expect(captureSession('student').token).toBe('new');
  expect(screen.getByRole('button', { name: '查看订正图片 1' })).toBeEnabled();
});

test.each(['access', 'content'].flatMap(stage => [403, 404].map(status => [stage, status])))(
  'superseded preview %s denial %s fences a replacement pending blob in the same scope and session', async (stage, status) => {
    const p = props(), first = deferred(), replacement = deferred();
    if (stage === 'access') api.access.mockReturnValueOnce(first.promise);
    if (stage === 'content') api.content.mockReturnValueOnce(first.promise);
    api.content.mockReturnValueOnce(replacement.promise);
    render(<Ai2Media {...p} values={[id(1)]} />);
    preview();
    await waitFor(() => expect(api.content).toHaveBeenCalledTimes(stage === 'content' ? 1 : 0));
    preview();
    await waitFor(() => expect(api.content).toHaveBeenCalledTimes(stage === 'content' ? 2 : 1));
    expect(api.access.mock.calls[0][1].signal.aborted).toBe(true);
    const error = { response: { status } };
    await act(async () => { first.reject(error); });
    await act(async () => { replacement.resolve(new Blob(['image'], { type: 'image/png' })); });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(p.onViewed).not.toHaveBeenCalledWith(id(1), true);
    expect(p.onDenied).toHaveBeenCalledTimes(1);
    expect(p.onDenied).toHaveBeenCalledWith(error);
    expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
    expect(p.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看订正图片 1' })).toBeDisabled();
  }
);

test.each(['scope', 'identity'].flatMap(change => [403, 404].map(status => [change, status])))(
  'superseded preview denial %s/%s cannot fence a different scope or session', async (change, status) => {
    const p = props(), first = deferred(), replacement = deferred();
    api.access.mockReturnValueOnce(first.promise); api.content.mockReturnValueOnce(replacement.promise);
    const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
    let session = p.session;
    if (change === 'identity') act(() => { session = login('replacement'); });
    view.rerender(<Ai2Media {...p} session={session} scopeKey={change === 'scope' ? 'replacement' : p.scopeKey} values={[id(1)]} />);
    preview(); await waitFor(() => expect(api.content).toHaveBeenCalledTimes(1));
    await act(async () => { first.reject({ response: { status } }); });
    await act(async () => { replacement.resolve(new Blob(['image'], { type: 'image/png' })); });
    fireEvent.load(screen.getByRole('img', { name: '订正图片 1' }));
    expect(p.onDenied).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(p.onViewed).toHaveBeenLastCalledWith(id(1), true);
    expect(captureSession('student')).toBe(session);
  }
);

test('superseded preview network error does not fence a current successful preview', async () => {
  const p = props(), first = deferred(), replacement = deferred();
  api.access.mockReturnValueOnce(first.promise); api.content.mockReturnValueOnce(replacement.promise);
  render(<Ai2Media {...p} values={[id(1)]} />); preview(); preview();
  await waitFor(() => expect(api.content).toHaveBeenCalledTimes(1));
  await act(async () => { first.reject({ response: { status: 503 } }); });
  await act(async () => { replacement.resolve(new Blob(['image'], { type: 'image/png' })); });
  fireEvent.load(screen.getByRole('img', { name: '订正图片 1' }));
  expect(p.onDenied).not.toHaveBeenCalled();
  expect(p.onViewed).toHaveBeenLastCalledWith(id(1), true);
});

test('late upload on new scope never changes selection or automatically deletes', async () => {
  const p = props(), pending = deferred(); api.upload.mockReturnValue(pending.promise);
  const view = render(<Ai2Media {...p} values={[]} />); choose([file(), file('next.png')]);
  view.rerender(<Ai2Media {...p} scopeKey="next" values={[]} />);
  await act(async () => { pending.resolve({ media: dto(1) }); });
  expect(p.onChange).not.toHaveBeenCalled(); expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.remove).not.toHaveBeenCalled();
});

test.each(['disabled', 'readOnly'])('interrupted upload by %s remains explicitly unresolved after re-enable', async property => {
  const p = props(), pending = deferred(); api.upload.mockReturnValue(pending.promise);
  const view = render(<Ai2Media {...p} values={[id(1)]} />); choose([file('pending.png')]);
  view.rerender(<Ai2Media {...p} values={[id(1)]} {...{ [property]: true }} />);
  view.rerender(<Ai2Media {...p} values={[id(1)]} />);
  await act(async () => { pending.resolve({ media: dto(2) }); });
  expect(p.onChange).not.toHaveBeenCalled(); expect(api.remove).not.toHaveBeenCalled();
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: '忽略失败 pending.png' }));
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(false);
});

test('busy counts concurrent operations and old authorization cannot resurrect deleted entry', async () => {
  const p = props(), first = deferred(), second = deferred();
  api.access.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<Ai2Media {...p} values={[id(1), id(2)]} />); preview(1); preview(2);
  confirmDelete(); await screen.findByText('图片已隐私删除');
  expect(p.onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => { first.resolve({ access: { expiresAt: new Date(Date.now() + 60000).toISOString() } }); });
  expect(api.content).not.toHaveBeenCalled();
  await act(async () => { second.resolve({ access: { expiresAt: new Date(Date.now() + 60000).toISOString() } }); });
  expect(await screen.findByRole('img', { name: '订正图片 2' })).toBeInTheDocument();
  expect(p.onBusyChange).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
});

test('expiry revokes preview; late load from a revoked image cannot mark viewed', async () => {
  jest.useFakeTimers();
  try {
    const p = props(); api.access.mockResolvedValue({ access: { expiresAt: new Date(Date.now() + 1000).toISOString() } });
    render(<Ai2Media {...p} values={[id(1)]} />); preview();
    const image = await screen.findByRole('img', { name: '订正图片 1' });
    act(() => jest.advanceTimersByTime(1001)); fireEvent.load(image);
    expect(p.onViewed).not.toHaveBeenCalledWith(id(1), true); expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
  } finally { jest.useRealTimers(); }
});

test('scope replacement revokes existing blob; late DELETE never invalidates replacement approval', async () => {
  const p = props(), pending = deferred(); api.remove.mockReturnValue(pending.promise);
  const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
  await screen.findByRole('img', { name: '订正图片 1' }); confirmDelete();
  view.rerender(<Ai2Media {...p} scopeKey="next" values={[id(1)]} />);
  await act(async () => { pending.resolve(); });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
  expect(p.onDeleted).not.toHaveBeenCalled();
  expect(screen.queryByText('图片已隐私删除')).not.toBeInTheDocument();
});

test('real session expiry clears private images and surfaces current 401; no fake session module', async () => {
  const p = props(), previousFetch = globalThis.fetch;
  createAi2MediaApi.mockImplementation(jest.requireActual('../../services/ai2MediaApi').createAi2MediaApi);
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  try {
    render(<Ai2Media {...p} values={[id(1)]} />); preview();
    await waitFor(() => expect(captureSession('student')).toBeNull());
    expect(p.onDenied).toHaveBeenCalledWith(expect.objectContaining({ response: { status: 401 } }));
    expect(screen.queryByRole('img', { name: '订正图片 1' })).not.toBeInTheDocument();
  } finally { globalThis.fetch = previousFetch; }
});

test('deletion start revokes only that image approval; unknown result stays unviewed and no tombstone callback', async () => {
  const p = props(), pending = deferred(); api.remove.mockReturnValueOnce(pending.promise);
  render(<Ai2Media {...p} values={[id(1), id(2)]} readOnly />);
  preview(1); fireEvent.load(await screen.findByRole('img', { name: '订正图片 1' }));
  preview(2); fireEvent.load(await screen.findByRole('img', { name: '订正图片 2' }));
  p.onViewed.mockClear(); confirmDelete();
  expect(p.onViewed.mock.calls).toEqual([[id(1), false]]);
  expect(p.onDeleted).not.toHaveBeenCalled();
  await act(async () => { pending.reject(new Error('unknown')); });
  expect(screen.getByRole('img', { name: '订正图片 2' })).toBeInTheDocument();
  expect(p.onDeleted).not.toHaveBeenCalled();
  expect(p.onViewed).not.toHaveBeenCalledWith(id(1), true);
});

test.each(['visibility', 'expiry', 'error', 'disabled', 'reauthorize'])('%s clears loaded approval before any new onLoad', async cause => {
  jest.useFakeTimers();
  try {
    const p = props(); api.access.mockResolvedValue({ access: { expiresAt: new Date(Date.now() + 1000).toISOString() } });
    const view = render(<Ai2Media {...p} values={[id(1)]} />); preview();
    const image = await screen.findByRole('img', { name: '订正图片 1' }); fireEvent.load(image);
    expect(p.onViewed).toHaveBeenLastCalledWith(id(1), true);
    if (cause === 'visibility') fireEvent(document, new Event('visibilitychange'));
    if (cause === 'expiry') act(() => jest.advanceTimersByTime(1001));
    if (cause === 'error') fireEvent.error(image);
    if (cause === 'disabled') view.rerender(<Ai2Media {...p} values={[id(1)]} disabled />);
    if (cause === 'reauthorize') { preview(); await screen.findByRole('img', { name: '订正图片 1' }); }
    expect(p.onViewed).toHaveBeenLastCalledWith(id(1), false);
    fireEvent.load(image);
    expect(p.onViewed).toHaveBeenLastCalledWith(id(1), false);
  } finally { jest.useRealTimers(); }
});
