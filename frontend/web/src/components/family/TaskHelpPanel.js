import React, { useCallback, useEffect, useRef, useState } from 'react';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { getOwnTask, updateOwnTaskHelp } from '../../services/childApi';
import { getGrowthTask, updateTaskHelp } from '../../services/familyApi';
import './TaskHelpPanel.css';

export const HELP_LABELS = {
  instruction_unclear: '没看懂要求', cannot_start: '不知道怎么开始', stuck_midway: '做到一半卡住',
  uncertain_result: '不确定做得对不对', fatigued: '有点累了', other: '其他帮助'
};
const apis = { student: { read: getOwnTask, update: updateOwnTaskHelp }, parent: { read: getGrowthTask, update: updateTaskHelp } };
const normalizeText = value => value.normalize('NFC').trim();

const ScopedHelp = ({ taskId, familyId, childId, role, session, onUpdated, taskStatus, taskSnapshot }) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [helpType, setHelpType] = useState('instruction_unclear');
  const [note, setNote] = useState('');
  const [response, setResponse] = useState('');
  const [command, setCommand] = useState(null);
  const live = useRef(false), writing = useRef(false), generation = useRef(0), abort = useRef(null);
  const current = useCallback(() => live.current && isSessionCurrent(session), [session]);
  const accept = useCallback(result => {
    const value = result?.task;
    if (!value || value.taskId !== taskId || value.familyId !== familyId || value.childId !== childId
      || !Number.isSafeInteger(value.helpVersion ?? 0) || (value.helpVersion ?? 0) < 0) {
      throw Object.assign(Error('Task scope mismatch'), { response: { status: 403 } });
    }
    return value;
  }, [taskId, familyId, childId]);
  const deny = () => {
    setTask(null); setCommand(null); setEditing(false); setNote(''); setResponse(''); setMessage(''); setBlocked(true);
    setError('当前身份无法查看此求助，请重新登录或返回任务列表。');
  };
  const receiveTask = useCallback(value => {
    setTask(previous => previous && (previous.helpVersion ?? 0) > (value.helpVersion ?? 0) ? previous : value);
  }, []);
  useEffect(() => {
    if (!taskSnapshot || !current() || blocked || busy) return;
    try { receiveTask(accept(taskSnapshot)); }
    catch { deny(); }
  }, [taskSnapshot, current, blocked, busy, receiveTask, accept]);
  const refresh = useCallback(async () => {
    if (!current()) return;
    const ticket = ++generation.current;
    abort.current?.abort(); abort.current = new AbortController();
    setLoading(true); setTask(null); setError('');
    try {
      const result = await apis[role].read(taskId, abort.current.signal, session);
      if (!current() || ticket !== generation.current) return;
      receiveTask(accept(result));
    } catch (cause) {
      if (!current() || ticket !== generation.current) return;
      if ([401, 403, 404].includes(cause?.response?.status)) deny();
      else setError('暂时无法读取求助，请重试读取。');
    } finally { if (current() && ticket === generation.current) setLoading(false); }
  }, [current, role, taskId, session, accept, receiveTask]);
  useEffect(() => {
    live.current = true; refresh();
    return () => { live.current = false; generation.current += 1; abort.current?.abort(); };
  }, [refresh]);

  const submit = async original => {
    if (!current() || writing.current || blocked) return;
    writing.current = true; setBusy(true); setError(''); setMessage(''); setCommand(original);
    const ticket = ++generation.current;
    abort.current?.abort(); abort.current = new AbortController();
    // This write owns the state now; the superseded read's finally cannot clear loading.
    setLoading(false);
    try {
      const result = await apis[role].update(taskId, original, abort.current.signal, session);
      if (!current() || ticket !== generation.current) return;
      const next = accept(result);
      receiveTask(next); setCommand(null); setEditing(false); setNote(''); setResponse('');
      setMessage(original.action === 'resolve' ? '求助已处理。' : '求助已发送。');
      onUpdated?.(next);
    } catch (cause) {
      if (!current() || ticket !== generation.current) return;
      const status = cause?.response?.status;
      if ([401, 403, 404].includes(status)) deny();
      else if (status === 409) {
        setCommand(null); setEditing(false); setNote(''); setResponse('');
        setMessage('求助或任务状态已变化，请查看最新内容后再决定。');
        await refresh();
      } else if (status >= 400 && status < 500) {
        setCommand(null); setError('求助内容未被接受，请检查后再提交。');
      } else {
        setError('结果尚未确认。可重试原求助操作，或先读取最新状态。');
      }
    } finally { if (current()) { writing.current = false; setBusy(false); } }
  };
  const send = event => {
    event.preventDefault();
    const value = normalizeText(editing ? note : response);
    if ([...value].length > 200) { setError('说明和回应最多 200 字。'); return; }
    submit(editing ? { action: 'request', expectedHelpVersion: task.helpVersion ?? 0, helpType, note: value }
      : { action: 'resolve', expectedHelpVersion: task.helpVersion ?? 0, parentResponse: value });
  };
  const help = task?.helpRequest;
  const actionable = task && !['cancelled', 'archived'].includes(task.status);
  const canRequest = task?.status === 'pending' && (!taskStatus || taskStatus === 'pending');
  const canResolve = role === 'parent' && actionable && help?.status === 'pending';
  const buttonClass = role === 'student' ? 'child-secondary-button' : 'family-button secondary';
  return <section className="task-help-panel" aria-label="任务求助">
    <h2>任务求助</h2>
    {loading && <p role="status">正在读取求助…</p>}
    {error && <p role="alert" className="family-form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!blocked && !loading && !task && <button type="button" className={buttonClass} onClick={refresh}>重试读取</button>}
    {task && <>
      {role === 'parent' && <h3>{task.title}</h3>}
      {help ? <div className="task-help-record">
        <p>{help.status === 'pending' ? '等待家长帮助' : '家长已处理'}</p>
        <p>{HELP_LABELS[help.helpType] || '其他帮助'}</p>
        {help.note && <p>{help.note}</p>}
        {help.status === 'resolved' && <div><h3>家长回应</h3><p>{help.parentResponse || '家长已处理这次求助。'}</p></div>}
      </div> : <p>暂无求助</p>}
      {command ? <div className="family-inline-actions">
        <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => submit(command)}>重试原求助操作</button>
        <button type="button" className={buttonClass} disabled={busy || loading} onClick={refresh}>读取最新求助</button>
      </div> : <>
        {canRequest && !editing && <button type="button" className={buttonClass} onClick={() => { setEditing(true); setError(''); }}>
          {role === 'parent' ? '代孩子求助' : help?.status === 'pending' ? '更新求助' : help ? '再次求助' : '我需要帮助'}</button>}
        {((editing && canRequest) || canResolve) && <form onSubmit={send} className="task-help-form">
          {editing ? <>
            <label>哪里需要帮助<select value={helpType} onChange={event => setHelpType(event.target.value)}>
              {Object.entries(HELP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>补充说明（可不填）<textarea value={note} onChange={event => setNote(event.target.value)} /></label>
          </> : <label>给孩子的回应（可不填）<textarea value={response} onChange={event => setResponse(event.target.value)} /></label>}
          <div className="family-inline-actions">
            <button type="submit" className={buttonClass} disabled={busy}>{editing ? '发送求助' : '标记已处理'}</button>
            {editing && <button type="button" className={buttonClass} disabled={busy} onClick={() => { setEditing(false); setNote(''); }}>取消</button>}
          </div>
        </form>}
      </>}
    </>}
  </section>;
};

const TaskHelpPanel = props => {
  const [, changed] = useState(0);
  useEffect(() => subscribeSessionChanges(() => changed(value => value + 1)), []);
  const session = captureSession(props.role);
  if (!isSessionCurrent(session) || (props.role === 'student' && session.actorId !== props.childId)) {
    return <p role="alert">请重新登录后查看求助。</p>;
  }
  return <ScopedHelp key={JSON.stringify([props.role, session.actorId, session.revision, props.familyId, props.childId, props.taskId])}
    {...props} session={session} />;
};
export default TaskHelpPanel;
