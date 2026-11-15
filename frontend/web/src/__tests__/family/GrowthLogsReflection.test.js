import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GrowthLogsPage from '../../pages/family/GrowthLogsPage';
import ReflectionPanel from '../../components/family/ReflectionPanel';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';
import { beginReflectionWrite, readReflectionWrite } from '../../services/reflection';

jest.mock('../../services/familyApi');
let mockFamily;
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
const id = n => String(n).padStart(24, '0');
const scope = { role: 'parent', actorId: id(1), familyId: id(2), childId: id(3) };
const row = { logId: id(4), familyId: id(2), childId: id(3), date: '2026-11-02',
  dimension: 'academic', subject: '数学', content: '合成练习', childReflection: '先读题' };
const result = items => ({ items, total: items.length, page: 1, pageSize: 100 });
const login = (actorId = id(1)) => saveParentSession({ token: `synthetic-${actorId}`,
  user: { id: actorId, role: 'parent', name: '合成家长' } });
const openLogs = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <GrowthLogsPage />
</MemoryRouter>);
const openReflection = () => render(<ReflectionPanel role="parent" familyId={id(2)} childId={id(3)}
  grade={4} weekStart="2026-11-02" />);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); login();
  mockFamily = { family: { familyId: id(2) }, selectedChildId: id(3),
    selectedChild: { childId: id(3), name: '合成孩子' }, childScopeVersion: 1 };
  api.listGrowthLogs.mockResolvedValue(result([row]));
  api.updateGrowthLog.mockImplementation(async (logId, payload) => ({ log: { ...row, ...payload } }));
});

test('unknown reflection PATCH blocks growth-log writes across failed reconciliation until explicitly resolved', async () => {
  const user = userEvent.setup(); let view = openReflection();
  await user.click(await screen.findByRole('button', { name: '修改反思：合成练习' }));
  fireEvent.change(screen.getByLabelText('孩子反思'), { target: { value: '未知反思' } });
  api.updateGrowthLog.mockRejectedValueOnce(new Error('lost response'));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  await screen.findByText(/保存结果尚未确定/);
  const marker = readReflectionWrite(scope);
  view.unmount(); view = openLogs();
  await screen.findByText('合成练习');
  expect(screen.getByRole('button', { name: '编辑 合成练习' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '记录成长' })).toBeDisabled();
  expect(screen.getByRole('link', { name: '前往周复盘核对上次保存' })).toHaveAttribute('href', '/app/reports');
  expect(api.updateGrowthLog).toHaveBeenCalledTimes(1);
  view.unmount(); view = openReflection();
  api.listGrowthLogs.mockRejectedValueOnce(new Error('offline'));
  await user.click(await screen.findByRole('button', { name: '重读全部记录并核对' }));
  await screen.findByText('读取失败，请重试。');
  expect(screen.queryByRole('button', { name: '已核对，结束上次编辑' })).not.toBeInTheDocument();
  view.unmount(); view = openLogs();
  await screen.findByText('合成练习');
  expect(screen.getByRole('button', { name: '编辑 合成练习' })).toBeDisabled();
  expect(readReflectionWrite(scope)).toEqual(marker);
  view.unmount(); view = openReflection();
  await user.click(await screen.findByRole('button', { name: '重读全部记录并核对' }));
  await user.click(await screen.findByRole('button', { name: '已核对，结束上次编辑' }));
  expect(readReflectionWrite(scope)).toBeNull();
  view.unmount(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '' } });
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByText('成长记录已更新。');
  expect(api.updateGrowthLog).toHaveBeenCalledTimes(2);
  expect(api.updateGrowthLog.mock.calls[1][1]).toHaveProperty('childReflection', '');
  expect(readReflectionWrite(scope)).toBeNull();
  expect(api.createGrowthLog).not.toHaveBeenCalled();
});

test('save rechecks a marker that appeared after the editor was opened', async () => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '不得覆盖' } });
  const marker = beginReflectionWrite(scope, { logId: row.logId });
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(api.updateGrowthLog).not.toHaveBeenCalled();
  expect(api.createGrowthLog).not.toHaveBeenCalled();
  expect(readReflectionWrite(scope)).toEqual(marker);
});

test('growth-log unknown write retains its marker when closed and blocks the reflection entry', async () => {
  const user = userEvent.setup(); const view = openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '未知更新' } });
  api.updateGrowthLog.mockRejectedValueOnce(new Error('lost response'));
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(screen.getByRole('button', { name: '保存成长记录' })).toBeDisabled();
  const marker = readReflectionWrite(scope);
  expect(marker).toMatchObject({ kind: 'patch', logId: row.logId });
  await user.click(screen.getByRole('button', { name: '关闭', exact: true }));
  view.unmount(); openReflection();
  await screen.findByText(/保存结果尚未确定/);
  expect(await screen.findByRole('button', { name: '修改反思：合成练习' })).toBeDisabled();
  expect(api.updateGrowthLog).toHaveBeenCalledTimes(1);
  expect(readReflectionWrite(scope)).toEqual(marker);
});

test('late save from the old parent cannot clear its marker or change the new parent view', async () => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '旧身份草稿' } });
  let finish;
  api.updateGrowthLog.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  const marker = readReflectionWrite(scope);
  expect(marker).toMatchObject({ kind: 'patch', logId: row.logId });
  act(() => login(id(5)));
  await screen.findByRole('button', { name: '编辑 合成练习' });
  expect(screen.queryByDisplayValue('旧身份草稿')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '编辑 合成练习' })).toBeEnabled();
  await act(async () => finish({ log: { ...row, childReflection: '迟到私有结果' } }));
  expect(screen.queryByText('迟到私有结果')).not.toBeInTheDocument();
  expect(screen.queryByText('成长记录已更新。')).not.toBeInTheDocument();
  expect(readReflectionWrite(scope)).toEqual(marker);
  act(() => login());
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(await screen.findByRole('button', { name: '编辑 合成练习' })).toBeDisabled();
});

test.each([400, 409, 422])('explicit %s rejection releases only this write and permits corrected input', async status => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  api.updateGrowthLog.mockRejectedValueOnce({ response: { status } });
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByText('保存失败，请重试。');
  expect(readReflectionWrite(scope)).toBeNull();
  expect(screen.getByRole('button', { name: '保存成长记录' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '修正输入' } });
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByText('成长记录已更新。');
  expect(api.updateGrowthLog).toHaveBeenCalledTimes(2);
});

test('unavailable marker storage sends zero writes', async () => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  try {
    await user.click(screen.getByRole('button', { name: '保存成长记录' }));
    await screen.findByText('无法保存写入保护或存在未核对记录，请前往周复盘核对。');
    expect(api.updateGrowthLog).not.toHaveBeenCalled();
    expect(api.createGrowthLog).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});

test('unknown create is not reposted and remains isolated from a sibling', async () => {
  const user = userEvent.setup(); const view = openLogs();
  await user.click(await screen.findByRole('button', { name: '记录成长' }));
  fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-11-02' } });
  fireEvent.change(screen.getByLabelText('记录内容'), { target: { value: '新记录' } });
  fireEvent.change(screen.getByLabelText('孩子自评'), { target: { value: '私有草稿' } });
  api.createGrowthLog.mockRejectedValueOnce(new Error('lost response'));
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(readReflectionWrite(scope)).toMatchObject({ kind: 'create' });
  await user.click(screen.getByRole('button', { name: '关闭', exact: true }));
  expect(screen.getByRole('button', { name: '记录成长' })).toBeDisabled();
  const firstFamily = mockFamily;
  mockFamily = { ...firstFamily, selectedChildId: id(6), selectedChild: { childId: id(6), name: '合成手足' }, childScopeVersion: 2 };
  api.listGrowthLogs.mockResolvedValue(result([]));
  const rerender = () => view.rerender(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><GrowthLogsPage /></MemoryRouter>);
  rerender();
  await screen.findByText('暂无成长记录');
  expect(screen.getByRole('button', { name: '记录成长' })).toBeEnabled();
  expect(screen.queryByText('私有草稿')).not.toBeInTheDocument();
  mockFamily = { ...firstFamily, childScopeVersion: 3 }; rerender();
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(screen.getByRole('button', { name: '记录成长' })).toBeDisabled();
  expect(api.createGrowthLog).toHaveBeenCalledTimes(1);
  expect(api.updateGrowthLog).not.toHaveBeenCalled();
});

test.each([undefined, 'invalid'])('an incomplete create acknowledgement (%s id) retains unknown protection', async logId => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '记录成长' }));
  fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-11-02' } });
  fireEvent.change(screen.getByLabelText('记录内容'), { target: { value: '待确认记录' } });
  api.createGrowthLog.mockResolvedValueOnce({ log: { ...row, logId } });
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  await screen.findByRole('link', { name: '前往周复盘核对上次保存' });
  expect(readReflectionWrite(scope)).toMatchObject({ kind: 'create' });
  expect(screen.queryByText('成长记录已保存。')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存成长记录' })).toBeDisabled();
  expect(api.createGrowthLog).toHaveBeenCalledTimes(1);
});

test('same-identity read denial invalidates a pending save without releasing its marker', async () => {
  const user = userEvent.setup(); openLogs();
  await user.click(await screen.findByRole('button', { name: '编辑 合成练习' }));
  let finish;
  api.updateGrowthLog.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存成长记录' }));
  const marker = readReflectionWrite(scope);
  await user.click(screen.getByRole('button', { name: '关闭', exact: true }));
  api.listGrowthLogs.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-11-01' } });
  await screen.findByText('当前身份无法读取此记录。');
  await act(async () => finish({ log: { ...row, childReflection: '拒绝后迟到' } }));
  expect(readReflectionWrite(scope)).toEqual(marker);
  expect(screen.queryByText('成长记录已更新。')).not.toBeInTheDocument();
  expect(screen.queryByText('拒绝后迟到')).not.toBeInTheDocument();
  act(() => login(id(5)));
  expect(await screen.findByRole('button', { name: '编辑 合成练习' })).toBeEnabled();
  expect(readReflectionWrite(scope)).toEqual(marker);
});
