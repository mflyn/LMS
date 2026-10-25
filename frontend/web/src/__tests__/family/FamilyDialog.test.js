import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FamilyDialog from '../../components/family/FamilyDialog';
import TaskCompletionMedia from '../../components/family/TaskCompletionMedia';

let root, trigger;
beforeEach(() => {
  root = document.createElement('div'); root.id = 'root';
  trigger = document.createElement('button'); trigger.textContent = 'Open'; root.append(trigger);
  document.body.append(root); trigger.focus();
});
afterEach(() => root.remove());
const dialog = (children, onClose = jest.fn()) => <FamilyDialog labelledBy="title" onClose={onClose}>
  <h2 id="title">Review</h2>{children}
</FamilyDialog>;

test.each(['removed', 'disabled', 'hidden'])('recovers focus when the active control is %s', async change => {
  const close = jest.fn();
  const view = render(dialog(<><button>Close</button><button>Confirm</button></>, close));
  screen.getByRole('button', { name: 'Confirm' }).focus();
  view.rerender(dialog(<><button>Close</button>{change !== 'removed' &&
    <button disabled={change === 'disabled'} hidden={change === 'hidden'}>Confirm</button>}</>, close));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('keeps background inert, traps outside focus and both Tab directions, and restores the trigger', async () => {
  const user = userEvent.setup();
  const view = render(dialog(<><button>First</button><button hidden>Hidden</button><button>Last</button></>));
  expect(root).toHaveAttribute('inert');
  trigger.focus();
  expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  await user.tab({ shift: true }); expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  await user.tab(); expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  view.unmount();
  expect(root).not.toHaveAttribute('inert'); expect(root).not.toHaveAttribute('aria-hidden');
  expect(trigger).toHaveFocus();
});

test('a dialog without controls remains focused and handles Tab and Escape from BODY', () => {
  const close = jest.fn(); render(dialog(<p>Waiting</p>, close));
  const section = screen.getByRole('dialog'); expect(section).toHaveFocus();
  fireEvent.keyDown(document.body, { key: 'Tab' }); expect(section).toHaveFocus();
  fireEvent.keyDown(document.body, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1);
});

test('inner privacy Escape closes only the inner prompt; outer unmount leaves no focus listener', async () => {
  const user = userEvent.setup(), close = jest.fn();
  const view = render(dialog(<><button>Close</button><TaskCompletionMedia values={['000000000000000000000008']}
    readOnly childId="child" scopeKey="parent" /></>, close));
  await user.click(screen.getByRole('button', { name: '隐私删除完成图片 1' }));
  expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '隐私删除完成图片 1' })).toHaveFocus();
  expect(close).not.toHaveBeenCalled();
  await user.keyboard('{Escape}'); expect(close).toHaveBeenCalledTimes(1);
  view.unmount(); trigger.focus(); expect(trigger).toHaveFocus();
  fireEvent.keyDown(document.body, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1);
});

test('restores preexisting root attributes and tolerates a removed trigger on identity unmount', () => {
  root.setAttribute('aria-hidden', 'false'); root.setAttribute('inert', '');
  const view = render(dialog(<button>Close</button>));
  trigger.remove(); view.unmount();
  expect(root).toHaveAttribute('aria-hidden', 'false'); expect(root).toHaveAttribute('inert');
});

test('returns to a surviving sibling action if confirmation removes its original trigger', () => {
  const fallback = document.createElement('button'); fallback.textContent = 'View work'; root.append(fallback);
  const view = render(dialog(<button>Close</button>));
  trigger.remove(); view.unmount(); expect(fallback).toHaveFocus();
});
