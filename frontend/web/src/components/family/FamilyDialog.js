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

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousHidden = root?.getAttribute('aria-hidden');
    root?.setAttribute('aria-hidden', 'true');
    dialogRef.current?.querySelector(FOCUSABLE)?.focus();

    return () => {
      if (root) {
        if (previousHidden === null) root.removeAttribute('aria-hidden');
        else root.setAttribute('aria-hidden', previousHidden);
      }
      previousFocus?.focus?.();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="family-dialog-backdrop">
      <section
        ref={dialogRef}
        className="family-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>,
    document.body
  );
};

export default FamilyDialog;
