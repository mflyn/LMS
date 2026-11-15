import React, { useLayoutEffect, useRef, useState } from 'react';
import { CopyOutlined, ExportOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSessionCurrent } from '../../services/familySession';
import { buildChildEntry } from '../../services/childEntry';

const ChildEntryActions = ({ child }) => {
  const { status, sessionSnapshot } = useAuth();
  const { familyStatus, family, children } = useFamily();
  const [feedback, setFeedback] = useState(null);
  const current = useRef(null), mounted = useRef(true), sequence = useRef(0);
  const scope = { session: sessionSnapshot, family, children, child, status, familyStatus };
  current.current = scope;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sequence.current += 1; };
  }, []);
  const valid = owner => mounted.current && owner.status === 'authenticated' && owner.familyStatus === 'ready'
    && current.current.status === 'authenticated' && current.current.familyStatus === 'ready'
    && isSessionCurrent(owner.session) && current.current.session === owner.session
    && current.current.family === owner.family && current.current.children === owner.children
    && current.current.child === owner.child && owner.children.some(row => row.childId === owner.child.childId);
  const url = valid(scope) ? buildChildEntry(window.location.origin, family?.familyId, child.childId) : null;
  const open = () => {
    if (!url || !valid(scope)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const copy = async () => {
    if (!url || !valid(scope)) return;
    const version = ++sequence.current;
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (valid(scope) && sequence.current === version) setFeedback({ scope, copied: true });
    } catch (_error) {
      if (valid(scope) && sequence.current === version) setFeedback({ scope, copied: false, url });
    }
  };
  return <div className="family-child-entry-actions">
    <div className="family-inline-actions">
      <button type="button" className="family-button secondary" disabled={!url} onClick={open} aria-label={`打开${child.name}入口`}>
        <ExportOutlined aria-hidden="true" /> 打开孩子入口
      </button>
      <button type="button" className="family-button secondary" disabled={!url} onClick={copy} aria-label={`复制${child.name}入口`}>
        <CopyOutlined aria-hidden="true" /> 复制孩子入口
      </button>
    </div>
    {feedback && valid(feedback.scope) && (feedback.copied ? <p role="status">入口已复制。</p>
      : <label>复制未完成，可手工选择链接<input aria-label={`${child.name}的专属入口`} readOnly value={feedback.url} onFocus={event => event.target.select()} /></label>)}
  </div>;
};

export default ChildEntryActions;
