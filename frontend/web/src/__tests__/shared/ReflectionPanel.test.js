import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReflectionPanel from '../../components/family/ReflectionPanel';
import * as api from '../../services/childApi';
import { saveChildSession, clearChildSession } from '../../services/familySession';

jest.mock('../../services/childApi');
const id = n => String(n).padStart(24, '0');
const row = { logId: id(3), familyId: id(2), childId: id(1), date: '2026-10-26', content: '合成练习',
  dimension: 'academic', childReflection: '先读题', durationMinutes: 20 };
const result = items => ({ items, page: 1, pageSize: 100, total: items.length });
const login = (n = 1) => saveChildSession({ token: `child-${n}`, child: { childId: id(n), familyId: id(2), name: '合成孩子' } });
const props = { role: 'student', familyId: id(2), childId: id(1), grade: 1, weekStart: '2026-10-26' };
const open = () => render(<ReflectionPanel {...props} />);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); login();
  api.listOwnGrowthLogs.mockResolvedValue(result([row]));
  api.updateOwnGrowthLog.mockResolvedValue({ log: { ...row, childReflection: '检查结果' } });
  api.createOwnGrowthLog.mockResolvedValue({ log: row });
});
const edit = async user => {
  await user.click(await screen.findByRole('button', { name: '修改反思：合成练习' }));
  await user.clear(screen.getByLabelText('我的反思'));
  await user.type(screen.getByLabelText('我的反思'), '检查结果');
};
test('editing an existing record writes reflection only and permits explicit clearing', async () => {
  const user = userEvent.setup(); open(); await edit(user);
  const textarea = screen.getByLabelText('我的反思', { exact: true });
  expect(textarea.id).toBeTruthy();
  expect(textarea.labels[0].textContent).toBe('我的反思');
  expect(textarea.labels[0]).not.toContainElement(textarea);
  await user.clear(screen.getByLabelText('我的反思'));
  api.updateOwnGrowthLog.mockResolvedValue({ log: { ...row, childReflection: '' } });
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  await screen.findByText('反思已保存。');
  expect(api.updateOwnGrowthLog).toHaveBeenCalledWith(id(3), { childReflection: '' }, expect.anything(), expect.anything());
  expect(api.createOwnGrowthLog).not.toHaveBeenCalled();
});
test.each(['blank-content', 'blank-reflection', 'oversized'])('invalid %s input never creates a record or write marker', async kind => {
  const user = userEvent.setup(); open();
  await user.click(await screen.findByRole('button', { name: '新增反思' }));
  fireEvent.change(screen.getByLabelText('记录内容'), { target: { value: kind === 'blank-content' ? '   ' : '合成记录' } });
  fireEvent.change(screen.getByLabelText('我的反思'), { target: {
    value: kind === 'blank-reflection' ? '   ' : kind === 'oversized' ? '字'.repeat(501) : '合成反思'
  } });
  fireEvent.submit(screen.getByRole('button', { name: '保存反思' }).closest('form'));
  await screen.findByText('请填写记录内容和反思，反思不能超过 500 字。');
  expect(api.createOwnGrowthLog).not.toHaveBeenCalled();
  expect(api.updateOwnGrowthLog).not.toHaveBeenCalled();
  expect(Object.keys(sessionStorage).some(key => key.startsWith('family-growth.reflection-write.v1:'))).toBe(false);
});
test('a 500-character reflection is accepted and an unknown grade uses the simple prompt', async () => {
  const user = userEvent.setup(); render(<ReflectionPanel {...props} grade={null} />);
  await user.click(await screen.findByRole('button', { name: '修改反思：合成练习' }));
  expect(screen.getByLabelText('我的反思')).toHaveAttribute('placeholder', '今天的收获和下一步');
  const value = '字'.repeat(500);
  fireEvent.change(screen.getByLabelText('我的反思'), { target: { value } });
  api.updateOwnGrowthLog.mockResolvedValue({ log: { ...row, childReflection: value } });
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  await screen.findByText('反思已保存。');
  expect(api.updateOwnGrowthLog).toHaveBeenCalledWith(row.logId, { childReflection: value }, expect.anything(), expect.anything());
});
test('failure to persist the write marker sends no request and preserves the editable input', async () => {
  const user = userEvent.setup(); open(); await edit(user);
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  try {
    await user.click(screen.getByRole('button', { name: '保存反思' }));
    await screen.findByText('无法保存写入保护或存在未核对记录，请重新打开并核对。');
    expect(api.updateOwnGrowthLog).not.toHaveBeenCalled();
    expect(screen.getByLabelText('我的反思')).toHaveValue('检查结果');
  } finally { spy.mockRestore(); }
});
test('unknown create retains draft, failed/empty rereads retain lock, and explicit reconciliation never posts again', async () => {
  const user = userEvent.setup(); open();
  await user.click(await screen.findByRole('button', { name: '新增反思' }));
  await user.type(screen.getByLabelText('记录内容'), '数学练习');
  await user.type(screen.getByLabelText('我的反思'), '检查结果');
  api.createOwnGrowthLog.mockRejectedValue(new Error('lost response'));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  expect(await screen.findByText(/保存结果尚未确定/)).toBeInTheDocument();
  expect(screen.getByLabelText('我的反思')).toHaveValue('检查结果');
  expect(screen.getByRole('button', { name: '保存反思' })).toBeDisabled();
  api.listOwnGrowthLogs.mockRejectedValue(new Error('offline'));
  await user.click(screen.getByRole('button', { name: '重读全部记录并核对' }));
  await screen.findByText('读取失败，请重试。');
  expect(screen.queryByRole('button', { name: '已核对，结束上次编辑' })).not.toBeInTheDocument();
  api.listOwnGrowthLogs.mockResolvedValue(result([]));
  await user.click(screen.getByRole('button', { name: '重读全部记录并核对' }));
  await screen.findByRole('button', { name: '已核对，结束上次编辑' });
  expect(screen.getByRole('button', { name: '保存反思' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '已核对，结束上次编辑' }));
  expect(screen.queryByLabelText('我的反思')).not.toBeInTheDocument();
  expect(api.createOwnGrowthLog).toHaveBeenCalledTimes(1);
});
test('logout removes private draft; the same actor must reconcile unknown PATCH after relogin', async () => {
  const user = userEvent.setup(); open(); await edit(user);
  api.updateOwnGrowthLog.mockRejectedValue({ response: { status: 503 } });
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  await screen.findByText(/保存结果尚未确定/);
  act(() => clearChildSession());
  expect(screen.queryByDisplayValue('检查结果')).not.toBeInTheDocument();
  act(() => login(4));
  expect(screen.queryByText(/保存结果尚未确定/)).not.toBeInTheDocument();
  act(() => login());
  await screen.findByText(/保存结果尚未确定/);
  expect(screen.queryByDisplayValue('检查结果')).not.toBeInTheDocument();
  expect(api.updateOwnGrowthLog).toHaveBeenCalledTimes(1);
});
test('ordinary network reload preserves the draft, but current 403 clears all private state', async () => {
  const user = userEvent.setup(); open(); await edit(user);
  api.listOwnGrowthLogs.mockRejectedValueOnce(new Error('offline'));
  await user.click(screen.getByRole('button', { name: '重新加载反思' }));
  await screen.findByText('读取失败，请重试。');
  expect(screen.getByLabelText('我的反思')).toHaveValue('检查结果');
  api.listOwnGrowthLogs.mockRejectedValueOnce({ response: { status: 403 } });
  await user.click(screen.getByRole('button', { name: '重新加载反思' }));
  await screen.findByText('当前身份无法读取此记录。');
  expect(screen.queryByText('合成练习')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('检查结果')).not.toBeInTheDocument();
});
test('403 from a refresh invalidates a pending successful write response', async () => {
  const user = userEvent.setup(); open(); await edit(user); let finish;
  api.updateOwnGrowthLog.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  api.listOwnGrowthLogs.mockRejectedValueOnce({ response: { status: 403 } });
  await user.click(screen.getByRole('button', { name: '重新加载反思' }));
  await screen.findByText('当前身份无法读取此记录。');
  await act(async () => finish({ log: { ...row, childReflection: '迟到私有内容' } }));
  expect(screen.queryByText('反思已保存。')).not.toBeInTheDocument();
  expect(screen.queryByText('迟到私有内容')).not.toBeInTheDocument();
});
test('week replacement ignores old write success and finally and keeps the unknown marker', async () => {
  const user = userEvent.setup(); const view = open(); await edit(user); let finish;
  api.updateOwnGrowthLog.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  api.listOwnGrowthLogs.mockResolvedValue(result([]));
  view.rerender(<ReflectionPanel {...props} weekStart="2026-11-02" />);
  await screen.findByText(/保存结果尚未确定/);
  await act(async () => finish({ log: row }));
  expect(screen.queryByText('反思已保存。')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('检查结果')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新增反思' })).toBeDisabled();
  await waitFor(() => expect(api.listOwnGrowthLogs).toHaveBeenCalledTimes(2));
});

test('same-identity 403 remains denied after changing week', async () => {
  const user = userEvent.setup(); const view = open(); await edit(user);
  api.listOwnGrowthLogs.mockRejectedValueOnce({ response: { status: 403 } });
  await user.click(screen.getByRole('button', { name: '重新加载反思' }));
  await screen.findByText('当前身份无法读取此记录。');
  api.listOwnGrowthLogs.mockResolvedValue(result([{ ...row, content: '不可重新显示' }]));
  view.rerender(<ReflectionPanel {...props} weekStart="2026-11-02" />);
  await act(async () => {});
  expect(screen.getByText('当前身份无法读取此记录。')).toBeInTheDocument();
  expect(screen.queryByText('不可重新显示')).not.toBeInTheDocument();
  expect(api.listOwnGrowthLogs).toHaveBeenCalledTimes(2);
});
test('late 403 from another week of the same identity clears the current week', async () => {
  const user = userEvent.setup(); const view = open(); await edit(user); let reject;
  api.updateOwnGrowthLog.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  api.listOwnGrowthLogs.mockResolvedValue(result([{ ...row, content: '新周内容' }]));
  view.rerender(<ReflectionPanel {...props} weekStart="2026-11-02" />);
  await screen.findByText('新周内容');
  await act(async () => reject({ response: { status: 403 } }));
  expect(screen.getByText('当前身份无法读取此记录。')).toBeInTheDocument();
  expect(screen.queryByText('新周内容')).not.toBeInTheDocument();
});
test('late 403 from a replaced identity cannot deny the new authenticated session', async () => {
  const user = userEvent.setup(); open(); await edit(user); let reject;
  api.updateOwnGrowthLog.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  act(() => login());
  await screen.findByText(/保存结果尚未确定/);
  await act(async () => reject({ response: { status: 403 } }));
  expect(screen.queryByText('当前身份无法读取此记录。')).not.toBeInTheDocument();
  expect(screen.getByText(/保存结果尚未确定/)).toBeInTheDocument();
});
test.each(['pending', 'failed', 'success'])('finishing all-week reconciliation never exposes historical rows as current-week edits (%s)', async state => {
  const user = userEvent.setup(); open(); await edit(user);
  api.updateOwnGrowthLog.mockRejectedValueOnce(new Error('lost'));
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  await screen.findByText(/保存结果尚未确定/);
  const old = { ...row, logId: id(9), date: '2026-10-19', content: '历史周记录' };
  api.listOwnGrowthLogs.mockResolvedValueOnce(result([row, old]));
  await user.click(screen.getByRole('button', { name: '重读全部记录并核对' }));
  await screen.findByText('历史周记录');
  let finish;
  api.listOwnGrowthLogs.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = () => state === 'failed' ? reject(new Error('offline')) : resolve(result([row]));
  }));
  await user.click(screen.getByRole('button', { name: '已核对，结束上次编辑' }));
  expect(screen.queryByText('历史周记录')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '修改反思：历史周记录' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新增反思' })).toBeDisabled();
  if (state !== 'pending') {
    await act(async () => finish());
    expect(screen.queryByText('历史周记录')).not.toBeInTheDocument();
    if (state === 'success') expect(screen.getByRole('button', { name: '修改反思：合成练习' })).toBeEnabled();
    else expect(screen.getByRole('button', { name: '新增反思' })).toBeDisabled();
  }
  expect(api.updateOwnGrowthLog).toHaveBeenCalledTimes(1);
});
