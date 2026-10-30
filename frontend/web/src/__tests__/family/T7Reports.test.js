import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../pages/family/ReportsPage';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';

jest.mock('../../services/familyApi');
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({
  family: { familyId: '000000000000000000000002', timezone: 'Asia/Shanghai' },
  selectedChildId: '000000000000000000000001', childScopeVersion: 1,
  selectedChild: { childId: '000000000000000000000001', name: '合成孩子', grade: 4 }
}) }));
const id = n => String(n).padStart(24, '0');
const report = (weekStart, note = '') => ({ reportId: id(weekStart === '2026-10-26' ? 4 : 5),
  familyId: id(2), childId: id(1), weekStart, weekEnd: '2026-11-01', parentNote: note,
  nextWeekSuggestion: '', frozen: true, statistics: { recordDays: 3, totalDurationMinutes: 40 } });
const open = () => render(<MemoryRouter initialEntries={['/app/reports?weekStart=2026-10-26']}><ReportsPage /></MemoryRouter>);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-parent', user: { id: id(8), role: 'parent' } });
  api.getWeeklyReport.mockImplementation(({ weekStart }) => Promise.resolve({ report: report(weekStart) }));
  api.listGrowthLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
});
test.each(['success', 'failure'])('switching weeks ignores old feedback %s and old finally while the new week saves', async outcome => {
  const user = userEvent.setup(); open();
  await user.type(await screen.findByLabelText('家长寄语'), '甲周草稿');
  let oldFinish, newFinish;
  api.updateWeeklyReportFeedback.mockImplementationOnce(() => new Promise((resolve, reject) => {
    oldFinish = () => outcome === 'success' ? resolve({ report: report('2026-10-26', '甲周结果') }) : reject(new Error('old failure'));
  })).mockImplementationOnce(() => new Promise(resolve => { newFinish = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  fireEvent.change(screen.getByLabelText('周一开始'), { target: { value: '2026-11-02' } });
  await user.type(await screen.findByLabelText('家长寄语'), '乙周草稿');
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  await act(async () => oldFinish());
  expect(screen.getByLabelText('家长寄语')).toHaveValue('乙周草稿');
  expect(screen.getByRole('button', { name: '保存周报反馈' })).toBeDisabled();
  expect(screen.queryByText('周报反馈已保存。')).not.toBeInTheDocument();
  expect(screen.queryByText('old failure')).not.toBeInTheDocument();
  await act(async () => newFinish({ report: report('2026-11-02', '乙周草稿') }));
  await screen.findByText('周报反馈已保存。');
});
test('unknown feedback cannot PATCH again until explicit reread and adoption', async () => {
  const user = userEvent.setup(); open();
  await user.type(await screen.findByLabelText('家长寄语'), '待核对寄语');
  api.updateWeeklyReportFeedback.mockRejectedValueOnce(new Error('lost response'));
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  await screen.findByText(/周报反馈保存结果尚未确定/);
  expect(screen.getByLabelText('家长寄语')).toHaveValue('待核对寄语');
  api.getWeeklyReport.mockRejectedValueOnce(new Error('offline'));
  await user.click(screen.getByRole('button', { name: '重读周报反馈' }));
  await screen.findByText('读取失败，请重试。');
  expect(screen.getByRole('button', { name: '保存周报反馈' })).toBeDisabled();
  api.getWeeklyReport.mockResolvedValue({ report: report('2026-10-26', '服务端寄语') });
  await user.click(screen.getByRole('button', { name: '重读周报反馈' }));
  await user.click(await screen.findByRole('button', { name: '采用重新读取的反馈' }));
  expect(screen.getByLabelText('家长寄语')).toHaveValue('服务端寄语');
  expect(api.updateWeeklyReportFeedback).toHaveBeenCalledTimes(1);
  expect(screen.getByText('40 分钟')).toBeInTheDocument();
});
test('a same-identity denial from the old week clears the new report and reflection, and cannot be cleared by switching weeks', async () => {
  const user = userEvent.setup(); open();
  await user.type(await screen.findByLabelText('家长寄语'), '甲周草稿'); let reject;
  api.updateWeeklyReportFeedback.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  fireEvent.change(screen.getByLabelText('周一开始'), { target: { value: '2026-11-02' } });
  await screen.findByLabelText('家长寄语');
  await act(async () => reject({ response: { status: 403 } }));
  expect(screen.getByText('当前身份无法读取此记录。')).toBeInTheDocument();
  expect(screen.queryByLabelText('家长寄语')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '新增反思' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('周一开始'), { target: { value: '2026-11-09' } });
  await act(async () => {});
  expect(screen.getByText('当前身份无法读取此记录。')).toBeInTheDocument();
  expect(api.getWeeklyReport).toHaveBeenCalledTimes(2);
});
test('same-week old GET cannot overwrite successful feedback or be resubmitted with the other edited field', async () => {
  const user = userEvent.setup(); open();
  await screen.findByLabelText('家长寄语'); let finish;
  api.getWeeklyReport.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await user.click(screen.getByRole('button', { name: '重新加载周报' }));
  await user.type(screen.getByLabelText('家长寄语'), '最新寄语');
  api.updateWeeklyReportFeedback.mockResolvedValue({ report: report('2026-10-26', '最新寄语') });
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  await screen.findByText('周报反馈已保存。');
  await act(async () => finish({ report: report('2026-10-26', '已过时寄语') }));
  expect(screen.getByLabelText('家长寄语')).toHaveValue('最新寄语');
  expect(screen.getByRole('button', { name: '重新加载周报' })).toBeEnabled();
  await user.type(screen.getByLabelText('下周建议'), '下一步');
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  expect(api.updateWeeklyReportFeedback.mock.calls[1][1]).toEqual({ parentNote: '最新寄语', nextWeekSuggestion: '下一步' });
});
test('stale same-week GET denial still clears a successfully saved report', async () => {
  const user = userEvent.setup(); open();
  await screen.findByLabelText('家长寄语'); let fail;
  api.getWeeklyReport.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }));
  await user.click(screen.getByRole('button', { name: '重新加载周报' }));
  await user.type(screen.getByLabelText('家长寄语'), '最新寄语');
  api.updateWeeklyReportFeedback.mockResolvedValue({ report: report('2026-10-26', '最新寄语') });
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  await screen.findByText('周报反馈已保存。');
  await act(async () => fail({ response: { status: 403 } }));
  expect(screen.getByText('当前身份无法读取此记录。')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('最新寄语')).not.toBeInTheDocument();
});
test('a GET started during a pending write is also invalidated at write settlement', async () => {
  const user = userEvent.setup(); open();
  await user.type(await screen.findByLabelText('家长寄语'), '已提交的新寄语');
  let finishWrite, finishRead;
  api.updateWeeklyReportFeedback.mockImplementationOnce(() => new Promise(resolve => { finishWrite = resolve; }));
  await user.click(screen.getByRole('button', { name: '保存周报反馈' }));
  api.getWeeklyReport.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  await user.click(screen.getByRole('button', { name: '重新加载周报' }));
  await act(async () => finishWrite({ report: report('2026-10-26', '已提交的新寄语') }));
  expect(screen.getByRole('button', { name: '重新加载周报' })).toBeEnabled();
  await act(async () => finishRead({ report: report('2026-10-26', '写入前的旧值') }));
  expect(screen.getByLabelText('家长寄语')).toHaveValue('已提交的新寄语');
});
