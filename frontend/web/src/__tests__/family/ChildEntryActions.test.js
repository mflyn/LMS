import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ChildEntryActions from '../../components/family/ChildEntryActions';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { captureSession, saveParentSession } from '../../services/familySession';
import { buildChildEntry, parseChildEntry } from '../../services/childEntry';

jest.mock('../../contexts/FamilyContext', () => ({ useFamily: jest.fn() }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
const familyId = 'f'.repeat(24), childId = 'a'.repeat(24);
const child = { childId, name: '合成孩子' };
let family;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks();
  saveParentSession({ token: 'synthetic-parent', user: { id: 'parent', role: 'parent' } });
  useAuth.mockReturnValue({ status: 'authenticated', sessionSnapshot: captureSession('parent') });
  family = { familyStatus: 'ready', family: { familyId }, children: [child] };
  useFamily.mockReturnValue(family);
});
afterEach(() => { jest.restoreAllMocks(); delete navigator.clipboard; });

test('opens a fixed same-origin entry with no opener or credential fields', () => {
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  render(<ChildEntryActions child={child} />);
  fireEvent.click(screen.getByRole('button', { name: '打开合成孩子入口' }));
  expect(open).toHaveBeenCalledWith(`http://localhost/child/login#familyId=${familyId}&childId=${childId}`, '_blank', 'noopener,noreferrer');
  expect(captureSession('parent')?.actorId).toBe('parent');
});

test.each(['missing', 'failure'])('copy %s provides a selectable link without claiming success', async mode => {
  if (mode === 'failure') Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  render(<ChildEntryActions child={child} />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '复制合成孩子入口' })));
  expect(screen.getByLabelText('合成孩子的专属入口')).toHaveValue(`http://localhost/child/login#familyId=${familyId}&childId=${childId}`);
  expect(screen.queryByText('入口已复制。')).not.toBeInTheDocument();
});

test('copy reports success only after the current clipboard request resolves', async () => {
  let finish;
  const writeText = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<ChildEntryActions child={child} />);
  fireEvent.click(screen.getByRole('button', { name: '复制合成孩子入口' }));
  expect(screen.queryByText('入口已复制。')).not.toBeInTheDocument();
  await act(async () => finish());
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(`http://localhost/child/login#familyId=${familyId}&childId=${childId}`);
  expect(screen.getByText('入口已复制。')).toBeInTheDocument();
});

test.each(['loading', 'anonymous', 'other-family', 'removed-child'])('%s cannot open or copy a child entry', mode => {
  if (mode === 'loading') useFamily.mockReturnValue({ ...family, familyStatus: 'loading' });
  if (mode === 'anonymous') useAuth.mockReturnValue({ status: 'anonymous', sessionSnapshot: null });
  if (mode === 'other-family') useFamily.mockReturnValue({ ...family, family: { familyId: 'b'.repeat(24) }, children: [] });
  if (mode === 'removed-child') useFamily.mockReturnValue({ ...family, children: [] });
  const open = jest.spyOn(window, 'open').mockReturnValue(null), writeText = jest.fn();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<ChildEntryActions child={child} />);
  for (const button of screen.queryAllByRole('button')) fireEvent.click(button);
  expect(open).not.toHaveBeenCalled(); expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('合成孩子的专属入口')).not.toBeInTheDocument();
});

test.each(['success', 'failure'])('late clipboard %s cannot restore an old family link', async outcome => {
  let finish;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(() => new Promise((resolve, reject) => {
    finish = () => outcome === 'success' ? resolve() : reject(new Error('denied'));
  })) } });
  const view = render(<ChildEntryActions child={child} />);
  fireEvent.click(screen.getByRole('button', { name: '复制合成孩子入口' }));
  useFamily.mockReturnValue({ ...family, family: { familyId: 'b'.repeat(24) }, children: [] });
  view.rerender(<ChildEntryActions child={child} />);
  await act(async () => finish());
  expect(screen.queryByLabelText('合成孩子的专属入口')).not.toBeInTheDocument();
  expect(screen.queryByText('入口已复制。')).not.toBeInTheDocument();
});

test('stale parent actions fail closed even before the next render', () => {
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  render(<ChildEntryActions child={child} />);
  saveParentSession({ token: 'synthetic-new', user: { id: 'other-parent', role: 'parent' } });
  fireEvent.click(screen.getByRole('button', { name: '打开合成孩子入口' }));
  expect(open).not.toHaveBeenCalled();
});

test('canonicalizes IDs and rejects malformed, duplicate, extra and oversized fields', () => {
  expect(buildChildEntry('https://synthetic.invalid', familyId.toUpperCase(), childId)).toBe(`https://synthetic.invalid/child/login#familyId=${familyId}&childId=${childId}`);
  expect(parseChildEntry(`#childId=${childId.toUpperCase()}&familyId=${familyId}`)).toEqual({ status: 'valid', familyId, childId });
  expect(parseChildEntry('')).toEqual({ status: 'absent' });
  for (const hash of ['#', '#familyId=bad', `#familyId=${familyId}&childId=`,
    `#familyId=${familyId}&childId=${childId}&childId=${childId}`, `#familyId=${familyId}&childId=${childId}&next=x`,
    `#familyId=${familyId}&childId=%FF`, `#familyId=${familyId}&childId=%ZZ`,
    ...['a'.repeat(23), 'a'.repeat(25), 'g'.repeat(24)].map(id => `#familyId=${familyId}&childId=${id}`), '#'.padEnd(257, 'a')]) {
    expect(parseChildEntry(hash)).toEqual({ status: 'invalid' });
  }
  expect(buildChildEntry('https://synthetic.invalid', 'bad', childId)).toBeNull();
});
