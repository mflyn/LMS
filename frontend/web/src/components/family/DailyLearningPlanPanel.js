import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, CloseOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { getOwnProfile, getOwnDailyLearningPlan, saveOwnDailyLearningPlan, listOwnTasks } from '../../services/childApi';
import { getDailyLearningPlan, saveDailyLearningPlan, listGrowthTasks } from '../../services/familyApi';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { registerChildScopeReset } from '../../services/childScope';
import { familyLocalDate } from '../../services/dailyLearningPlan';
import './DailyLearningPlanPanel.css';

const STATUS = { pending: '待完成', completed: '等待家长确认', confirmed: '已确认', cancelled: '已取消', archived: '已归档' };
const invalidResponse = () => Object.assign(Error('Invalid plan scope'), { response: { status: 403 } });
const itemValues = items => items.map(({ taskId, childEstimatedMinutes: minutes }) => ({ taskId,
  childEstimatedMinutes: minutes == null || minutes === '' ? null : Number(minutes) }));
const sameItems = (left, right) => JSON.stringify(itemValues(left)) === JSON.stringify(itemValues(right));
const readMessage = (value, command) => command && value.version > command.expectedVersion && sameItems(value.items, command.items)
  ? '服务器已有与原保存相同的顺序和估时，请核对后采用，无需再次保存。'
  : '已读取服务器计划，采用后将替换当前草稿。';
const ScopedPlan = ({ role, childId, familyId, timezone, grade, session }) => {
  const [date, setDate] = useState(''), [plan, setPlan] = useState(null), [draft, setDraft] = useState([]);
  const [latest, setLatest] = useState(null), [conflict, setConflict] = useState(false), [command, setCommand] = useState(null);
  const [candidates, setCandidates] = useState([]), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [listing, setListing] = useState(false);
  const [blocked, setBlocked] = useState(false), [error, setError] = useState(''), [listError, setListError] = useState('');
  const [message, setMessage] = useState(''), [expired, setExpired] = useState(false);
  const live = useRef(false), writing = useRef(false), generation = useRef(0), listGeneration = useRef(0);
  const abort = useRef(null), listAbort = useRef(null), zone = useRef(timezone);
  const current = useCallback(() => live.current && isSessionCurrent(session), [session]);
  const invalidate = useCallback(() => {
    live.current = false; generation.current++; listGeneration.current++;
    abort.current?.abort(); listAbort.current?.abort();
  }, []);
  const deny = useCallback(() => {
    generation.current++; listGeneration.current++; abort.current?.abort(); listAbort.current?.abort();
    setPlan(null); setDraft([]); setLatest(null); setCommand(null); setCandidates([]); setMessage('');
    setLoading(false); setBusy(false); setListing(false);
    setBlocked(true); setError('当前身份无法查看此计划，请重新登录或切换孩子。');
  }, []);
  const accept = useCallback((result, localDate) => {
    const value = result?.plan;
    if (!value || value.childId !== childId || value.localDate !== localDate
      || !Number.isSafeInteger(value.version) || value.version < 0 || !Array.isArray(value.items) || value.items.length > 20
      || value.items.some(i => !i || typeof i.taskId !== 'string' || (i.task && i.task.taskId !== i.taskId))
      || new Set(value.items.map(i => i.taskId)).size !== value.items.length) throw invalidResponse();
    return value;
  }, [childId]);
  const readApi = useCallback((localDate, signal) => role === 'student'
    ? getOwnDailyLearningPlan(localDate, signal, session) : getDailyLearningPlan(childId, localDate, signal, session), [role, childId, session]);
  const loadCandidates = useCallback(async nextPage => {
    if (!current()) return;
    const ticket = ++listGeneration.current; listAbort.current?.abort(); listAbort.current = new AbortController();
    setListing(true); setListError('');
    try {
      const params = { status: 'pending', page: nextPage, pageSize: 20 }, options = { signal: listAbort.current.signal, session };
      const result = role === 'student' ? await listOwnTasks(params, options) : await listGrowthTasks({ ...params, childId }, options);
      if (!current() || ticket !== listGeneration.current) return;
      if (!Array.isArray(result?.items)) throw Error('Invalid task list');
      setCandidates(result.items); setTotal(result.total ?? result.items.length); setPage(nextPage);
    } catch (cause) {
      if (!current() || ticket !== listGeneration.current) return;
      if ([401, 403].includes(cause?.response?.status)) deny();
      else setListError('暂时无法读取其他待办，请重试。');
    } finally { if (current() && ticket === listGeneration.current) setListing(false); }
  }, [current, session, role, childId, deny]);
  const bootstrap = useCallback(async () => {
    if (!current()) return;
    const ticket = ++generation.current; abort.current?.abort(); abort.current = new AbortController();
    setLoading(true); setError(''); setMessage('');
    try {
      if (role === 'student') {
        const profile = await getOwnProfile({ signal: abort.current.signal, session });
        if (!current() || ticket !== generation.current) return;
        if (profile?.child?.childId !== childId || profile.child.familyId !== familyId) throw invalidResponse();
        zone.current = profile.timezone;
      }
      const localDate = familyLocalDate(zone.current);
      const result = await readApi(localDate, abort.current.signal);
      if (!current() || ticket !== generation.current) return;
      const value = accept(result, localDate);
      setDate(localDate); setPlan(value); setDraft(value.items); setCommand(null); setLatest(null); setConflict(false);
      setExpired(familyLocalDate(zone.current) !== localDate);
      loadCandidates(1);
    } catch (cause) {
      if (!current() || ticket !== generation.current) return;
      if ([401, 403].includes(cause?.response?.status)) deny();
      else setError('暂时无法读取计划，原草稿仍保留。');
    } finally { if (current() && ticket === generation.current) setLoading(false); }
  }, [current, session, role, childId, familyId, readApi, accept, loadCandidates, deny]);
  useEffect(() => {
    live.current = true; bootstrap();
    const unregister = registerChildScopeReset(() => {
      if (role === 'parent') { deny(); live.current = false; }
    });
    return () => { invalidate(); unregister(); };
  }, [bootstrap, role, deny, invalidate]);
  useEffect(() => {
    if (!date) return undefined;
    const check = () => { if (current() && familyLocalDate(zone.current) !== date) setExpired(true); };
    const timer = setInterval(check, 30000); window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [date, current]);
  const refresh = async () => {
    if (!current() || writing.current || blocked) return;
    const ticket = ++generation.current; abort.current?.abort(); abort.current = new AbortController(); setLoading(true); setError('');
    try {
      const value = accept(await readApi(date, abort.current.signal), date);
      if (!current() || ticket !== generation.current) return;
      setLatest(value); if (value.version !== plan.version) setConflict(true);
      setMessage(readMessage(value, command));
      loadCandidates(page);
    } catch (cause) {
      if (!current() || ticket !== generation.current) return;
      if ([401, 403].includes(cause?.response?.status)) deny(); else setError('暂时无法读取计划，原草稿仍保留。');
    } finally { if (current() && ticket === generation.current) setLoading(false); }
  };
  const submit = async original => {
    if (!current() || writing.current || blocked || expired || conflict) return;
    if (familyLocalDate(zone.current) !== date) {
      setExpired(true); setError('家庭日期已变化，原草稿不会自动保存到新一天。'); return;
    }
    writing.current = true; setBusy(true); setError(''); setMessage(''); setCommand(original);
    const ticket = ++generation.current; abort.current?.abort(); abort.current = new AbortController();
    try {
      const result = role === 'student' ? await saveOwnDailyLearningPlan(date, original, abort.current.signal, session)
        : await saveDailyLearningPlan(childId, date, original, abort.current.signal, session);
      if (!current() || ticket !== generation.current) return;
      const value = accept(result, date); setPlan(value); setDraft(value.items); setCommand(null); setLatest(null);
      setMessage('今日计划已保存。'); loadCandidates(page);
    } catch (cause) {
      if (!current() || ticket !== generation.current) return;
      const status = cause?.response?.status, code = cause?.response?.data?.error?.code;
      if ([401, 403].includes(status)) deny();
      else if (code === 'LOCAL_DATE_NOT_WRITABLE') { setExpired(true); setCommand(null); setError('家庭日期已变化，原草稿不会自动保存到新一天。'); }
      else if (status === 409) {
        setConflict(true); setError('计划或任务已变化，请读取并采用最新计划后重新选择。');
        try {
          const value = accept(await readApi(date, abort.current.signal), date);
          if (current() && ticket === generation.current) { setLatest(value); setMessage(readMessage(value, original)); }
        } catch (readError) {
          if (current() && ticket === generation.current && [401, 403].includes(readError?.response?.status)) deny();
        }
      } else if (status >= 400 && status < 500) { setCommand(null); setError('计划未被接受，请检查任务及估时后再保存。'); }
      else setError('保存结果尚未确认。可以重试原保存，或读取服务器计划核对。');
    } finally { if (current()) { writing.current = false; setBusy(false); } }
  };
  const save = () => {
    if (draft.some(i => i.estimateBadInput)) { setError('估时输入未完成，请填写整数或清空。'); return; }
    const items = draft.map(i => ({ taskId: i.taskId, childEstimatedMinutes: i.childEstimatedMinutes === '' ? null
      : i.childEstimatedMinutes == null ? null : Number(i.childEstimatedMinutes) }));
    if (items.some(i => i.childEstimatedMinutes !== null && (!Number.isInteger(i.childEstimatedMinutes)
      || i.childEstimatedMinutes < 1 || i.childEstimatedMinutes > 240))) { setError('估时请留空或填写 1 至 240 的整数。'); return; }
    submit({ expectedVersion: plan.version, items });
  };
  const changeMinutes = (id, value, badInput = false) => setDraft(items => items.map(i => i.taskId === id
    ? { ...i, childEstimatedMinutes: value, estimateBadInput: badInput } : i));
  const move = (index, delta) => setDraft(items => {
    const next = items.slice(); [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next;
  });
  const disabled = loading || busy || blocked || Boolean(command) || conflict || expired;
  const link = id => role === 'student' ? `/child/tasks/${encodeURIComponent(id)}`
    : `/app/tasks?childId=${encodeURIComponent(childId)}&taskId=${encodeURIComponent(id)}`;
  const estimateAuthor = entry => {
    const value = entry.childEstimatedMinutes;
    if (value == null || value === '') return null;
    const saved = plan.items.find(item => item.taskId === entry.taskId);
    if (!saved || Number(value) !== saved.childEstimatedMinutes) return `待保存 · ${role === 'parent' ? '家长' : '孩子'}输入`;
    if (!entry.estimateRecordedBy) return '输入者未记录';
    return entry.estimateRecordedBy.role === 'parent' ? '家长输入' : '孩子输入';
  };
  return <section className="daily-plan" aria-label="今日计划">
    <div className="daily-plan-heading"><h2>{role === 'parent' ? '今日计划 · 家长代录' : '我的今日计划'}</h2>{date && <span>{date}</span>}</div>
    {loading && <p role="status">正在读取计划…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!blocked && !plan && !loading && <button type="button" onClick={bootstrap}>重试读取计划</button>}
    {!blocked && plan && <>
      {expired && <p role="alert">这份计划已不是家庭今天的计划。</p>}
      {expired && !busy && <button type="button" onClick={bootstrap}>打开今天计划</button>}
      <div className="daily-plan-items">
        {draft.length === 0 && <p>今日计划暂无任务。</p>}
        {draft.map((entry, index) => <div className="daily-plan-item" role="group" aria-label={`计划项 ${entry.task?.title || '任务不可用'}`} key={entry.taskId}>
          <div className="daily-plan-task"><span>{index + 1}.</span>
            {entry.task && ['pending', 'completed', 'confirmed'].includes(entry.task.status)
              ? <Link to={link(entry.taskId)}>{entry.task.title}</Link> : <strong>{entry.task?.title || '任务不可用'}</strong>}
            <span>{entry.task ? STATUS[entry.task.status] : '无法访问'}</span></div>
          <fieldset disabled={disabled} className="daily-plan-controls"><legend className="sr-only">{entry.task?.title || '任务'}的计划设置</legend>
            <label>{entry.task?.title || '任务不可用'} 估计分钟<input type="number" min="1" max="240" step="1" inputMode="numeric"
              value={entry.childEstimatedMinutes ?? ''} aria-invalid={Boolean(entry.estimateBadInput)}
              // Native input also catches badInput changes when the sanitized value remains empty.
              onInput={e => changeMinutes(entry.taskId, e.target.value, e.target.validity.badInput)}
              onChange={e => changeMinutes(entry.taskId, e.target.value, e.target.validity.badInput)} /></label>
            {entry.estimateBadInput && <span role="alert">估时输入未完成，请填写整数或清空。</span>}
            {grade <= 2 && <div className="daily-plan-estimates">{[['短', 5], ['中', 15], ['长', 30]].map(([label, value]) =>
              <button type="button" key={value} onClick={() => changeMinutes(entry.taskId, value)}>{label} {value}分钟</button>)}</div>}
            <div className="daily-plan-tools">
              <button type="button" title="上移" aria-label={`上移 ${entry.task?.title || '任务'}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpOutlined /></button>
              <button type="button" title="下移" aria-label={`下移 ${entry.task?.title || '任务'}`} disabled={index === draft.length - 1} onClick={() => move(index, 1)}><ArrowDownOutlined /></button>
              <button type="button" title="移出今日计划" aria-label={`移出今日计划 ${entry.task?.title || '任务'}`} onClick={() => setDraft(items => items.filter(i => i.taskId !== entry.taskId))}><CloseOutlined /></button>
            </div>
          </fieldset>
          {estimateAuthor(entry) && <span>{estimateAuthor(entry)}</span>}
        </div>)}
      </div>
      <div className="daily-plan-actions">
        <button type="button" aria-label="保存今日计划" disabled={disabled || draft.some(i => i.estimateBadInput) || (plan.version > 0 && sameItems(draft, plan.items))} onClick={save}><SaveOutlined aria-hidden="true" /> 保存今日计划</button>
        {command && !conflict && !expired && <button type="button" disabled={busy || loading} onClick={() => submit(command)}>重试原保存</button>}
        <button type="button" aria-label="读取最新计划" disabled={busy || loading} onClick={refresh}><ReloadOutlined aria-hidden="true" /> 读取最新计划</button>
        {latest && <button type="button" disabled={busy || loading} onClick={() => {
          setPlan(latest); setDraft(latest.items); setLatest(null); setCommand(null); setConflict(false); setError(''); setMessage('已采用服务器计划。');
        }}>采用最新计划</button>}
      </div>
      <h3>其他待办</h3>
      {listing && <p role="status">正在读取待办…</p>}
      {listError && <p role="alert">{listError}<button type="button" onClick={() => loadCandidates(page)}>重试待办</button></p>}
      <ul className="daily-plan-candidates">{candidates.filter(t => !draft.some(i => i.taskId === t.taskId)).map(t => <li key={t.taskId}>
        <Link to={link(t.taskId)}>{t.title}</Link><span>{t.dueDate}</span>
        <button type="button" title="加入今日计划" aria-label={`加入今日计划 ${t.title}`} disabled={disabled || draft.length >= 20 || t.status !== 'pending'}
          onClick={() => setDraft(items => [...items, { taskId: t.taskId, childEstimatedMinutes: null, estimateRecordedBy: null, task: t }])}><PlusOutlined /></button>
      </li>)}</ul>
      <div className="daily-plan-actions">
        <button type="button" disabled={listing || page === 1} onClick={() => loadCandidates(page - 1)}>上一页待办</button>
        <span>第 {page} 页</span>
        <button type="button" disabled={listing || page * 20 >= total} onClick={() => loadCandidates(page + 1)}>下一页待办</button>
      </div>
    </>}
  </section>;
};

const DailyLearningPlanPanel = props => {
  const [, changed] = useState(0);
  useEffect(() => subscribeSessionChanges(() => changed(n => n + 1)), []);
  const session = captureSession(props.role);
  if (!isSessionCurrent(session) || (props.role === 'student' && session.actorId !== props.childId)) return <p role="alert">请重新登录后查看今日计划。</p>;
  return <ScopedPlan key={JSON.stringify([props.role, session.actorId, session.revision, props.childId, props.familyId, props.timezone, props.scopeVersion])}
    {...props} session={session} />;
};
export default DailyLearningPlanPanel;
