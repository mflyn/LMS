import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as childApi from '../../services/childApi';
import * as familyApi from '../../services/familyApi';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { assertLearningScope, isLearningDenied, isLearningId, learningReadMessage } from '../../services/learningSources';
import { beginReflectionWrite, clearReflectionWrite, readReflectionLogs, readReflectionWrite, reflectionWeek } from '../../services/reflection';

const DIMENSIONS = [['academic', '智育'], ['moral', '德育'], ['physical', '体育'], ['artistic', '美育'], ['labor', '劳育']];
const unknownText = '保存结果尚未确定，请重读全部记录并人工核对，不要重复提交。';

const ReflectionEditor = ({ role, familyId, childId, grade, weekStart, session, isAllowed, deny }) => {
  const reflectionInputId = useId();
  const scope = useMemo(() => ({ role, actorId: session.actorId, familyId, childId }), [role, session, familyId, childId]);
  const [rows, setRows] = useState([]);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [unknown, setUnknown] = useState(() => {
    try { return readReflectionWrite(scope); } catch { return { storageError: true }; }
  });
  const [reconciled, setReconciled] = useState(false);
  const [rowScope, setRowScope] = useState('week'), [listReady, setListReady] = useState(false);
  const alive = useRef(true), readSequence = useRef(0), writing = useRef(false);
  const controllers = useRef(new Set());
  const current = useCallback(() => alive.current && isAllowed(), [isAllowed]);
  const load = useCallback(async (all = false) => {
    if (!current()) return;
    const sequence = ++readSequence.current, controller = new AbortController();
    controllers.current.add(controller);
    setLoading(true); setError(''); setReconciled(false); setListReady(false);
    const assertActive = () => {
      if (!current() || sequence !== readSequence.current) throw Object.assign(new Error('stale'), { code: 'SESSION_CHANGED' });
    };
    try {
      const list = role === 'student' ? childApi.listOwnGrowthLogs : familyApi.listGrowthLogs;
      const result = await readReflectionLogs(query => list(query, controller.signal, session), scope,
        all ? {} : reflectionWeek(weekStart), assertActive);
      assertActive();
      setRows(result); setReconciled(all); setRowScope(all ? 'all' : 'week'); setListReady(!all);
    } catch (readError) {
      // A same-scope denial wins even when another refresh superseded this request.
      if (isAllowed() && isLearningDenied(readError)) { deny(); return; }
      if (!current()) return;
      if (sequence === readSequence.current && readError?.code !== 'SESSION_CHANGED') setError(learningReadMessage(readError));
    } finally {
      controllers.current.delete(controller);
      if (current() && sequence === readSequence.current) setLoading(false);
    }
  }, [current, role, scope, session, weekStart, isAllowed, deny]);
  useEffect(() => {
    alive.current = true;
    const pendingControllers = controllers.current;
    load();
    return () => { alive.current = false; pendingControllers.forEach(controller => controller.abort()); };
  }, [load]);

  const save = async event => {
    event.preventDefault();
    if (!current() || writing.current || unknown || !editor) return;
    if (editor.childReflection.length > 500 || (!editor.logId && (!editor.content.trim() || !editor.childReflection.trim()))) {
      setError('请填写记录内容和反思，反思不能超过 500 字。'); return;
    }
    let marker;
    try {
      reflectionWeek(editor.date);
      marker = beginReflectionWrite(scope, editor.logId ? { logId: editor.logId } : {});
    } catch {
      setError('无法保存写入保护或存在未核对记录，请重新打开并核对。'); return;
    }
    writing.current = true; setBusy(true); setError(''); setMessage(''); setReconciled(false);
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const create = role === 'student' ? childApi.createOwnGrowthLog : familyApi.createGrowthLog;
      const patch = role === 'student' ? childApi.updateOwnGrowthLog : familyApi.updateGrowthLog;
      const result = editor.logId
        ? await patch(editor.logId, { childReflection: editor.childReflection }, controller.signal, session)
        : await create({ childId, date: editor.date, dimension: editor.dimension, subject: editor.subject,
          content: editor.content.trim(), childReflection: editor.childReflection.trim() }, controller.signal, session);
      if (!current()) return;
      const log = result?.log;
      assertLearningScope(log, 'logId', editor.logId || log?.logId, familyId, childId);
      if (!isLearningId(log.logId) || typeof log.childReflection !== 'string') throw new Error('Invalid saved record');
      if (!clearReflectionWrite(scope, marker)) throw new Error('Write marker changed');
      setUnknown(null); setEditor(null); setMessage('反思已保存。');
      await load();
    } catch (saveError) {
      if (isAllowed() && isLearningDenied(saveError)) { deny(); return; }
      if (!current()) return;
      const status = saveError?.response?.status;
      if ([400, 409, 422].includes(status)) {
        try {
          if (!clearReflectionWrite(scope, marker)) throw new Error('Write marker changed');
          setError('保存被拒绝，请检查输入或重新读取记录。');
        } catch { setUnknown(marker); }
      } else setUnknown(marker);
    } finally {
      controllers.current.delete(controller);
      if (current()) { writing.current = false; setBusy(false); }
    }
  };
  const finishReconciliation = () => {
    if (!current() || !reconciled || busy || !unknown || unknown.storageError) return;
    try {
      if (!clearReflectionWrite(scope, unknown)) throw new Error('Write marker changed');
      setUnknown(null); setEditor(null); setReconciled(false); setRows([]); setRowScope('week'); setListReady(false);
      setMessage('已结束上次编辑，请重新选择记录。');
      load();
    } catch { setError('无法解除写入保护，请重新打开并核对。'); }
  };

  const locked = busy || Boolean(unknown);
  return <section className="family-panel" aria-label="成长反思">
    <div className="family-page-heading"><h2>{role === 'student' ? '我的反思' : '孩子反思与家长代录'}</h2>
      <button type="button" className="family-button" onClick={() => load()}>重新加载反思</button></div>
    {loading && <p role="status">正在读取反思…</p>}
    {error && <p role="alert" className="family-form-error">{error}</p>}
    {message && <p role="status" className="family-success-message">{message}</p>}
    {unknown && <div role="alert">
      <p>{unknown.storageError ? '无法读取写入保护，暂不能保存。请恢复浏览器存储后重新打开。' : unknownText}</p>
      {!unknown.storageError && <button type="button" className="family-button" disabled={loading || busy} onClick={() => load(true)}>重读全部记录并核对</button>}
      {reconciled && !unknown.storageError && <button type="button" className="family-button" onClick={finishReconciliation}>已核对，结束上次编辑</button>}
    </div>}
    {rowScope === 'all' && <p>以下是该孩子的全部记录。没有找到记录也不能确定上次保存失败。</p>}
    <ul className="family-list">{rows.map(log => <li key={log.logId}>
      <div><strong>{log.content}</strong><p>{log.date}</p><p>{log.childReflection || '尚未填写反思'}</p>
        {log.parentNote && <p>家长备注：{log.parentNote}</p>}</div>
      <button type="button" className="family-button" aria-label={`修改反思：${log.content}`} disabled={locked || !listReady}
        onClick={() => { setEditor({ ...log, childReflection: log.childReflection || '' }); setMessage(''); }}>修改反思</button>
    </li>)}</ul>
    {!loading && rows.length === 0 && <p>暂无成长记录。</p>}
    <button type="button" className="family-button" disabled={locked || !listReady} onClick={() => {
      setEditor({ date: weekStart, dimension: 'academic', subject: '数学', content: '', childReflection: '' }); setMessage('');
    }}>新增反思</button>
    {editor && <form className="family-feedback-form" onSubmit={save}>
      {role === 'parent' && <p>本次由家长代录。</p>}
      {!editor.logId && <>
        <label>记录日期<input type="date" required value={editor.date} disabled={locked}
          onChange={e => setEditor({ ...editor, date: e.target.value })} /></label>
        <label>成长维度<select value={editor.dimension} disabled={locked} onChange={e => setEditor({ ...editor, dimension: e.target.value })}>
          {DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>学科<input value={editor.subject} maxLength={50} disabled={locked} onChange={e => setEditor({ ...editor, subject: e.target.value })} /></label>
        <label>记录内容<textarea required maxLength={1000} value={editor.content} disabled={locked} onChange={e => setEditor({ ...editor, content: e.target.value })} /></label>
      </>}
      <label htmlFor={reflectionInputId}>{role === 'student' ? '我的反思' : '孩子反思'}</label>
      <textarea id={reflectionInputId} maxLength={500} required={!editor.logId} disabled={locked}
        placeholder={grade === 1 ? '今天学会了什么？写一句话就好。' : grade === 4 ? '哪里做得好，下一次想怎样改进？' : '今天的收获和下一步'}
        value={editor.childReflection} onChange={e => setEditor({ ...editor, childReflection: e.target.value })} />
      <button className="family-button primary" type="submit" disabled={locked}>保存反思</button>
      <button className="family-button" type="button" onClick={() => setEditor(null)}>关闭反思编辑</button>
    </form>}
  </section>;
};

// Permission revocation belongs to the identity/child, not the displayed week.
const ReflectionScope = props => {
  const { session, isAllowed: parentAllowed, onDenied } = props;
  const alive = useRef(true), refused = useRef(false);
  const [denied, setDenied] = useState(false);
  const isAllowed = useCallback(() => alive.current && !refused.current && isSessionCurrent(session)
    && (!parentAllowed || parentAllowed()), [session, parentAllowed]);
  const deny = useCallback(() => {
    if (!isAllowed()) return;
    refused.current = true; setDenied(true); onDenied?.();
  }, [isAllowed, onDenied]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (denied) return <p role="alert">当前身份无法读取此记录。</p>;
  return <ReflectionEditor {...props} key={props.weekStart} isAllowed={isAllowed} deny={deny} />;
};

const ReflectionPanel = props => {
  const [session, setSession] = useState(() => captureSession(props.role));
  useEffect(() => subscribeSessionChanges(() => setSession(captureSession(props.role))), [props.role]);
  if (!session || !isSessionCurrent(session) || (props.role === 'student' && session.actorId !== props.childId)) {
    return <p role="alert">请使用当前孩子或家长身份重新登录。</p>;
  }
  return <ReflectionScope {...props} session={session}
    key={`${session.role}:${session.actorId}:${session.revision}:${props.familyId}:${props.childId}`} />;
};
export default ReflectionPanel;
