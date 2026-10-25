import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const FamilyDialog = ({ labelledBy, onClose, children }) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousParent = previousFocus?.parentElement;
    const root = document.getElementById('root');
    const previousHidden = root?.getAttribute('aria-hidden');
    const previousInert = root?.getAttribute('inert');
    const dialog = dialogRef.current;
    const available = node => node instanceof HTMLElement && !node.matches(':disabled')
      && !node.closest('[hidden], [inert], [aria-hidden="true"]')
      && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
    const controls = () => Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(available);
    const focusInside = () => (controls()[0] || dialog).focus();
    const ensureFocus = () => {
      if (!dialog.contains(document.activeElement) || !available(document.activeElement)) focusInside();
    };
    focusInside();
    root?.setAttribute('aria-hidden', 'true');
    root?.setAttribute('inert', '');
    // Removing or disabling the focused form does not reliably emit focusin.
    const observer = new MutationObserver(ensureFocus);
    observer.observe(dialog, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['disabled', 'hidden', 'tabindex', 'style', 'class', 'aria-hidden'] });
    const handleKeyDown = event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault(); closeRef.current(); return;
      }
      if (event.key !== 'Tab') return;
      const focusable = controls(), first = focusable[0], last = focusable.at(-1);
      const active = document.activeElement;
      if (!first || !focusable.includes(active)) {
        event.preventDefault(); (event.shiftKey ? last || dialog : first || dialog).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('focusin', ensureFocus);
    // Bubble so an inner privacy prompt can consume Escape before the outer dialog.
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', ensureFocus);
      document.removeEventListener('keydown', handleKeyDown);
      if (root) {
        if (previousHidden === null) root.removeAttribute('aria-hidden');
        else root.setAttribute('aria-hidden', previousHidden);
        if (previousInert === null) root.removeAttribute('inert');
        else root.setAttribute('inert', previousInert);
      }
      if (previousFocus?.isConnected && available(previousFocus)) previousFocus.focus?.();
      else if (previousParent?.isConnected) {
        Array.from(previousParent.querySelectorAll(FOCUSABLE)).find(available)?.focus();
      }
    };
  }, []);

  return createPortal(
    <div className="family-dialog-backdrop">
      <section
        ref={dialogRef}
        className="family-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body
  );
};

export default FamilyDialog;
