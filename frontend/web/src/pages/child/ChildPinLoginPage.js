import React, { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import ChildSwitchButton from '../../components/child/ChildSwitchButton';
import { captureSession } from '../../services/familySession';
import { parseChildEntry } from '../../services/childEntry';

const intentKey = (entry, manual, form) => entry.status === 'valid'
  ? `entry:${entry.familyId}:${entry.childId}`
  : entry.status === 'invalid' ? 'invalid'
    : manual ? JSON.stringify(['manual', form.familyId, form.childId]) : 'absent';

const ChildPinLoginPage = () => {
  const navigate = useNavigate(), location = useLocation();
  const { status, child, error, login, logout, clearError } = useChildAuth();
  const [, refresh] = useReducer(value => value + 1, 0);
  const [formError, setFormError] = useState(null);
  const form = useRef({ familyId: '', childId: '', pin: '' });
  const manual = useRef(false), mounted = useRef(true), intent = useRef(null);
  const pinOwner = useRef(null), request = useRef(null);
  const entry = parseChildEntry(location.hash);

  const syncIntent = useCallback((key) => {
    if (intent.current?.key === key) return;
    intent.current = { key };
    form.current.pin = '';
    pinOwner.current = null;
    request.current = null;
  }, []);
  syncIntent(intentKey(entry, manual.current, form.current));
  const renderedIntent = intent.current;

  useLayoutEffect(() => {
    mounted.current = true;
    if (!intent.current) {
      syncIntent(intentKey(parseChildEntry(window.location.hash), manual.current, form.current));
      refresh();
    }
    const change = event => {
      const hash = event.newURL ? new URL(event.newURL).hash : window.location.hash;
      syncIntent(intentKey(parseChildEntry(hash), manual.current, form.current));
      refresh();
    };
    window.addEventListener('hashchange', change);
    window.addEventListener('popstate', change);
    return () => {
      mounted.current = false;
      intent.current = null;
      window.removeEventListener('hashchange', change);
      window.removeEventListener('popstate', change);
    };
  }, [syncIntent]);

  const isCurrent = owner => mounted.current && intent.current === owner
    && intentKey(parseChildEntry(window.location.hash), manual.current, form.current) === owner?.key;
  const submitting = Boolean(request.current && request.current.owner === intent.current);
  const updateField = field => event => {
    if (!isCurrent(renderedIntent)) return;
    form.current[field] = event.target.value;
    if (field !== 'pin') syncIntent(intentKey(entry, manual.current, form.current));
    else pinOwner.current = intent.current;
    setFormError(null); clearError(); refresh();
  };
  const useManual = () => {
    manual.current = true;
    form.current = { familyId: '', childId: '', pin: '' };
    syncIntent(intentKey({ status: 'absent' }, true, form.current));
    setFormError(null); clearError();
    navigate('/child/login', { replace: true }); refresh();
  };
  const handleSubmit = async event => {
    event.preventDefault();
    const owner = renderedIntent;
    if (request.current?.owner === owner || !isCurrent(owner)) return;
    const familyId = entry.status === 'valid' ? entry.familyId : form.current.familyId.trim();
    const childId = entry.status === 'valid' ? entry.childId : form.current.childId.trim();
    if (!familyId || !childId) { setFormError('请填写家庭 ID 和孩子 ID。'); return; }
    if (pinOwner.current !== owner || !/^[0-9]{4,6}$/.test(form.current.pin)) {
      setFormError('PIN 需要填写 4 到 6 位数字。'); return;
    }
    const active = { owner }; request.current = active;
    setFormError(null); clearError(); refresh();
    try {
      const accepted = await login({ familyId, childId, pin: form.current.pin }, { isCurrent: () => isCurrent(owner) });
      if (accepted && isCurrent(owner)) navigate('/child/today', { replace: true });
    } finally {
      if (isCurrent(owner) && request.current === active) {
        form.current.pin = ''; pinOwner.current = null; request.current = null; refresh();
      }
    }
  };
  const switchToEntry = () => {
    const session = captureSession('student'), owner = renderedIntent;
    if (!session || !isCurrent(owner)) return;
    if (!window.confirm('切换孩子将清除本页未提交的内容。结果未确认的提交，需要原孩子重新登录后恢复。继续切换？')) return;
    if (captureSession('student') !== session || !isCurrent(owner)) return;
    logout(); form.current.pin = ''; pinOwner.current = null;
    setFormError(null); refresh();
  };
  const different = entry.status === 'valid' && child
    && (child.childId.toLowerCase() !== entry.childId || child.familyId.toLowerCase() !== entry.familyId);
  const showForm = entry.status === 'valid' || (entry.status === 'absent' && manual.current);

  return <main className="child-login-page">
    <section className="child-login-panel" aria-labelledby="child-login-heading">
      <p className="child-eyebrow">家庭成长追踪</p>
      <h1 id="child-login-heading">孩子登录</h1>
      {entry.status === 'invalid' && <p className="child-form-error" role="alert">入口无效，请重新打开家长准备的入口。</p>}
      {status === 'authenticated' ? <div className="child-form">
        {different ? <>
          <p>当前登录的是{child.name}，此入口指向另一个孩子。</p>
          <button type="button" className="child-primary-button" onClick={switchToEntry}>切换到此入口</button>
          <button type="button" className="child-secondary-button" onClick={() => navigate('/child/today', { replace: true })}>保留当前孩子</button>
        </> : <>
          <button type="button" className="child-primary-button" onClick={() => navigate('/child/today', { replace: true })}>继续使用{child.name}</button>
          <ChildSwitchButton />
        </>}
      </div> : <>
        {showForm ? <form className="child-form" onSubmit={handleSubmit} noValidate>
          {entry.status !== 'valid' && <>
            <label>家庭 ID<input value={form.current.familyId} onChange={updateField('familyId')} autoComplete="organization" disabled={submitting} /></label>
            <label>孩子 ID<input value={form.current.childId} onChange={updateField('childId')} autoComplete="username" disabled={submitting} /></label>
          </>}
          <label>PIN<input type="password" value={form.current.pin} onChange={updateField('pin')} inputMode="numeric"
            pattern="[0-9]{4,6}" minLength={4} maxLength={6} autoComplete="one-time-code" disabled={submitting} /></label>
          {(formError || error) && <p className="child-form-error" role="alert">{formError || error}</p>}
          <button type="submit" className="child-primary-button" disabled={submitting}>{submitting ? '正在登录...' : '进入我的成长空间'}</button>
        </form> : <>
          {entry.status === 'absent' && <p>请打开家长准备的专属入口。</p>}
          {error && <p className="child-form-error" role="alert">{error}</p>}
        </>}
        {(entry.status !== 'absent' || !manual.current) && <button type="button" className="child-secondary-button child-entry-manual" onClick={useManual}>手工填写标识</button>}
      </>}
    </section>
  </main>;
};

export default ChildPinLoginPage;
