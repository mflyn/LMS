import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createAi2MediaApi } from '../../services/ai2MediaApi';
import { captureSession, saveChildSession } from '../../services/familySession';

jest.mock('../../services/ai2MediaApi', () => ({ ...jest.requireActual('../../services/ai2MediaApi'), createAi2MediaApi: jest.fn() }));
const id = n => n.toString(16).padStart(24, '0'), childId = id(100);
const dto = (n, status = 'available') => ({ mediaId: id(n), mimeType: 'image/png', sizeBytes: 5, status, purpose: 'ai3_practice' });
const login = (token = 'synthetic') => {
  saveChildSession({ token, child: { childId, familyId: id(200), name: 'Synthetic' } }); return captureSession('student');
};
const props = () => ({ role: 'student', session: login(), childId, scopeKey: 'round/attempt',
  onChange: jest.fn(), onBlockedChange: jest.fn(), onViewed: jest.fn(), onDenied: jest.fn(), onDeleted: jest.fn() });
const component = () => {
  expect(() => jest.requireActual('../../components/family/Ai3Media')).not.toThrow();
  return jest.requireActual('../../components/family/Ai3Media').default;
};
const Harness = ({ initial = [], ...rest }) => {
  const [values, setValues] = useState(initial), Media = component();
  return <Media {...rest} values={values} onChange={ids => { setValues(ids); rest.onChange(ids); }} />;
};
const file = name => new File(['image'], name, { type: 'image/png', lastModified: 1 });
let api;
beforeEach(() => {
  localStorage.clear(); api = { upload: jest.fn().mockResolvedValue({ media: dto(1) }),
    access: jest.fn().mockResolvedValue({ media: dto(1), access: { expiresAt: new Date(Date.now() + 60000).toISOString() } }),
    content: jest.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })), remove: jest.fn().mockResolvedValue() };
  createAi2MediaApi.mockReturnValue(api); URL.createObjectURL = jest.fn().mockReturnValue('blob:synthetic'); URL.revokeObjectURL = jest.fn();
});
test.each([0, 1, 10])('AI3 count %i uses fixed profile and never fetches or deletes automatically', count => {
  const p = props(), Media = component(); render(<Media {...p} profile="ai2" values={Array.from({ length: count }, (_, n) => dto(n + 1))} />);
  expect(createAi2MediaApi).toHaveBeenLastCalledWith('student', 'ai3');
  expect(screen.getByLabelText('添加练习图片').disabled).toBe(count === 10);
  expect(p.onBlockedChange).toHaveBeenLastCalledWith(count === 0); expect(api.access).not.toHaveBeenCalled(); expect(api.remove).not.toHaveBeenCalled();
});
test('AI3 partial uploads survive focus and manual preview; failures block until explicit retry', async () => {
  const p = props(); api.upload.mockResolvedValueOnce({ media: dto(1) }).mockRejectedValueOnce(Error('unknown')).mockResolvedValueOnce({ media: dto(2) });
  render(<Harness {...p} />); fireEvent.change(screen.getByLabelText('添加练习图片'), { target: { files: [file('a.png'), file('b.png')] } });
  await screen.findByText(/b.png.*上传未确认/); expect(p.onChange).toHaveBeenLastCalledWith([id(1)]);
  fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'));
  fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await screen.findByRole('img');
  expect(screen.getByText(/b.png.*上传未确认/)).toBeInTheDocument(); expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: '重试上传 b.png' }));
  await waitFor(() => expect(p.onChange).toHaveBeenLastCalledWith([id(1), id(2)]));
  expect(api.remove).not.toHaveBeenCalled();
});
test('AI3 ordinary removal and unmount never DELETE; explicit readonly privacy delete keeps tombstone', async () => {
  const p = props(), Media = component(), view = render(<Harness {...p} initial={[dto(1)]} />);
  fireEvent.click(screen.getByRole('button', { name: '移除练习图片 1' })); expect(p.onChange).toHaveBeenLastCalledWith([]);
  view.unmount(); expect(api.remove).not.toHaveBeenCalled(); render(<Media {...p} values={[dto(1)]} readOnly />);
  fireEvent.click(screen.getByRole('button', { name: '隐私删除练习图片 1' })); expect(api.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认隐私删除' })); await screen.findByText('图片已隐私删除');
  expect(p.onDeleted).toHaveBeenCalledWith(id(1)); expect(p.onBlockedChange).toHaveBeenLastCalledWith(true);
});
test.each(['child', 'scope', 'session', 'external'])('AI3 %s change clears blob and fences pending bytes', async change => {
  const p = props(), Media = component(), view = render(<Media {...p} values={[dto(1)]} />);
  fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await screen.findByRole('img');
  let resolve; api.content.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByRole('button', { name: '查看练习图片 1' })); await waitFor(() => expect(resolve).toBeDefined());
  if (change === 'child') view.rerender(<Media {...p} childId={id(101)} values={[]} />);
  if (change === 'scope') view.rerender(<Media {...p} scopeKey="other-round" values={[]} />);
  if (change === 'session') act(() => { login('replacement'); });
  if (change === 'external') act(() => {
    const key = `family-growth.session-exit.v1:student:${childId}`;
    localStorage.setItem(key, JSON.stringify({ revision: 'external', reason: 'explicit_logout' }));
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
  });
  await act(async () => { resolve(new Blob(['image'], { type: 'image/png' })); });
  expect(screen.queryByRole('img')).not.toBeInTheDocument(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1); expect(api.remove).not.toHaveBeenCalled();
});
test.each(['ai2_correction', 'deleted'])('AI3 %s descriptors cannot become a usable submission', kind => {
  const p = props(), Media = component(), value = kind === 'deleted' ? dto(1, 'deleted') : { ...dto(1), purpose: kind };
  render(<Media {...p} values={[value]} />); expect(p.onBlockedChange).toHaveBeenLastCalledWith(true); expect(api.access).not.toHaveBeenCalled();
});
test('AI3 account invalidation removes private failed filenames immediately without automatic deletion', async () => {
  const p = props(); api.upload.mockRejectedValueOnce(Error('unknown'));
  render(<Harness {...p} />); fireEvent.change(screen.getByLabelText('添加练习图片'), { target: { files: [file('private-child-work.png')] } });
  await screen.findByText(/private-child-work.png/);
  act(() => { login('replacement'); });
  expect(screen.queryByText(/private-child-work.png/)).not.toBeInTheDocument(); expect(api.remove).not.toHaveBeenCalled();
});
