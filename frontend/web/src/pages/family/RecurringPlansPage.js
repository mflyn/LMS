import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LeftOutlined, RightOutlined, ReloadOutlined } from '@ant-design/icons';
import FamilyDialog from '../../components/family/FamilyDialog';
import { useFamily } from '../../contexts/FamilyContext';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { listRecurringPlans, getRecurringPlan, getRecurringCommand, sendRecurringCommand, abortRecurringCommand } from '../../services/familyApi';
import { RECURRING_MARKER_PREFIX, prepareRecurringCommand, readRecurringCommand, settleRecurringCommand,
  assertRecurringCommand, newRecurringOperationId } from '../../services/recurringCommands';

const dimensions = [['moral', '德育'], ['academic', '智育'], ['physical', '体育'], ['artistic', '美育'], ['labor', '劳育']];
const days = ['一', '二', '三', '四', '五', '六', '日'];
const today = zone => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const blank = zone => ({ title: '', dimension: 'physical', taskType: 'exercise', area: '', subject: '', description: '',
  estimatedMinutes: '', targetAmount: '', unit: '', priority: 'medium', startDate: today(zone), endDate: '', kind: 'weekly', weekdays: [1, 2, 3, 4, 5] });
const message = error => {
  const code = error?.response?.data?.error?.code || error?.code;
  return ({ RECURRING_PLAN_VERSION_CONFLICT: '计划已被其他家长修改。请核对原命令，解除后重新查看再决定。',
    RECURRING_TASKS_DISABLED: '重复计划暂未启用。待核对命令仍保留。', RECURRING_COMMAND_PENDING: '已有操作待核对，不能新建另一项操作。',
    RECURRING_CRYPTO_UNAVAILABLE: '当前浏览器无法安全保存命令。请使用 HTTPS 或本机安全入口。',
    RECURRING_COMMAND_INVALID: '命令或回执不一致，已保留保护，请重新核对。',
    VALIDATION_ERROR: '请检查日期、星期和任务内容。' })[code] || '请求未能确认，请重试读取或核对原命令。';
};

const ScopedPlans = ({ scope, session, childName, timezone, scopeCurrent }) => {
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null), [editor, setEditor] = useState(null), [form, setForm] = useState(null);
  const [prompt, setPrompt] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), denied = useRef(false), epoch = useRef(0), readNumber = useRef(0), writing = useRef(false);
  const current = useCallback(() => alive.current && !denied.current && scopeCurrent() && isSessionCurrent(session), [scopeCurrent, session]);
  const clearPrivate = useCallback(() => {
    denied.current = true; epoch.current++; readNumber.current++;
    setItems([]); setTotal(0); setEditor(null); setForm(null); setPrompt(null); setPending(null); setNotice('');
    setReady(false); setLoading(false); setBusy(false); setError('当前身份无权访问这些计划，请重新登录或选择有权限的孩子。');
  }, []);
  const handleError = useCallback(cause => {
    if (!alive.current || !scopeCurrent() || !isSessionCurrent(session)) return;
    if ([401, 403].includes(cause?.response?.status)) { clearPrivate(); return; }
    if (current()) setError(message(cause));
  }, [clearPrivate, current, scopeCurrent, session]);
  const readMarker = useCallback(() => {
    try { const value = readRecurringCommand(scope, session); setPending(value); return value; }
    catch { setPending({ corrupt: true }); setError('本机命令记录不可读取，已停止新提交。'); return { corrupt: true }; }
  }, [scope, session]);
  const load = useCallback(async () => {
    if (!current()) return;
    const n = ++readNumber.current; setLoading(true);
    // Refresh protection before the request, but reveal it only after current server authorization.
    if (ready) readMarker();
    try {
      const result = await listRecurringPlans({ childId: scope.childId, page, pageSize: 20 }, { session });
      if (!current() || n !== readNumber.current) return;
      if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0
        || result.items.some(p => p.childId !== scope.childId)) throw new Error('Invalid list');
      setItems(result.items); setTotal(result.total); setReady(true); readMarker();
    } catch (cause) { handleError(cause); }
    finally { if (current() && n === readNumber.current) setLoading(false); }
  }, [current, handleError, page, readMarker, ready, scope.childId, session]);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    alive.current = true;
    const invalidate = () => { alive.current = false; epoch.current++; };
    const refresh = () => { if (current()) void loadRef.current(); };
    const storage = e => { if (e.key === null || e.key?.startsWith(RECURRING_MARKER_PREFIX)) refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh); window.addEventListener('storage', storage);
    return () => { invalidate(); window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh); window.removeEventListener('storage', storage); };
  }, [current]);
  useEffect(() => { void loadRef.current(); }, [page, current]);
  const guarded = async work => {
    if (!current() || writing.current) return;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    const generation = epoch.current, valid = () => current() && epoch.current === generation;
    try { await work(valid); }
    catch (cause) { if (valid()) { handleError(cause); if (current()) readMarker(); } }
    finally { writing.current = false; if (valid()) setBusy(false); }
  };
  const terminal = async (command, receipt, valid) => {
    if (!valid()) return;
    const settled = await settleRecurringCommand(scope, command.marker, receipt, session, valid);
    if (!valid()) return;
    readMarker();
    if (!settled) { setNotice('暂未查到终态，原命令仍受保护。'); return; }
    setEditor(null); setForm(null); setPrompt(null);
    setNotice(receipt.state === 'aborted' ? '原命令已终止，未撤销任何已成功的操作。' : '原命令已确认成功，已重新读取当前计划。');
    await loadRef.current();
  };
  const dispatch = async (command, valid) => {
    await assertRecurringCommand(scope, command, session); if (!valid()) return;
    await sendRecurringCommand(command, { session }); if (!valid()) return;
    const receipt = await getRecurringCommand(command.marker.operationId, scope.childId, { session });
    await terminal(command, receipt, valid);
  };
  const query = () => guarded(async valid => {
    const command = readMarker(); if (!command || command.corrupt) return;
    const receipt = await getRecurringCommand(command.marker.operationId, scope.childId, { session });
    await terminal(command, receipt, valid);
  });
  const open = target => guarded(async valid => {
    if (readMarker()) return;
    if (!target) { setEditor({ action: 'create', target: null }); setForm(blank(timezone)); return; }
    const value = await getRecurringPlan(target.id, { session }); if (!valid()) return;
    if (value?.id !== target.id || value.childId !== scope.childId || !Number.isSafeInteger(value.version)) throw new Error('Invalid plan');
    if (value.status !== 'active' || (value.currentRevision.endDate && value.currentRevision.endDate < today(value.timezone))) {
      setNotice('此计划已停止或结束，不能修改。'); return;
    }
    const rule = value.pendingRevision || value.currentRevision;
    setEditor({ action: 'patch', target: value });
    setForm({ ...blank(value.timezone), ...rule.template, startDate: value.startDate, endDate: rule.endDate || '',
      kind: rule.schedule.kind, weekdays: rule.schedule.weekdays || [1, 2, 3, 4, 5] });
  });
  const save = e => { e.preventDefault(); void guarded(async valid => {
    if (readMarker()) return;
    const template = Object.fromEntries(['title', 'dimension', 'taskType', 'area', 'subject', 'description', 'unit', 'priority'].map(k => [k, form[k]]));
    for (const field of ['estimatedMinutes', 'targetAmount']) {
      if (form[field] === '' || form[field] == null) continue;
      if (!/^\d+(\.\d+)?$/.test(String(form[field]))) { setError('数量和预计分钟必须是完整的非负数。'); return; }
      template[field] = Number(form[field]);
    }
    const body = { operationId: newRecurringOperationId(), ...(editor.action === 'create'
      ? { childId: scope.childId, startDate: form.startDate } : { expectedVersion: editor.target.version }), endDate: form.endDate || null,
    schedule: form.kind === 'daily' ? { kind: 'daily' } : { kind: 'weekly', weekdays: form.weekdays }, template };
    const command = await prepareRecurringCommand(scope, editor.action, editor.target?.id || null, body, session, valid);
    if (!valid()) return; readMarker(); setEditor(null); setForm(null); await dispatch(command, valid);
  }); };
  const confirm = () => guarded(async valid => {
    if (prompt.type === 'abort') {
      const command = readRecurringCommand(scope, session, prompt.marker.operationId);
      if (!command || command.corrupt || JSON.stringify(command.marker) !== JSON.stringify(prompt.marker)) {
        setError('原命令已变化，请返回后重新核对。'); readMarker(); return;
      }
      const receipt = await abortRecurringCommand(command.marker, { session }); await terminal(command, receipt, valid);
    } else {
      if (readMarker()) return;
      const command = await prepareRecurringCommand(scope, 'stop', prompt.plan.id,
        { operationId: newRecurringOperationId(), expectedVersion: prompt.plan.version }, session, valid);
      if (!valid()) return; readMarker(); await dispatch(command, valid);
    }
  });
  const locked = !ready || busy || Boolean(pending) || denied.current;
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  return <section className="family-page family-page-wide recurring-plans-page" aria-labelledby="recurring-title">
    <div className="family-page-heading"><div><h1 id="recurring-title">重复计划</h1>{ready && <p>{childName} · {timezone}</p>}</div>
      <div className="family-inline-actions"><Link className="family-button secondary" to="/app/tasks">返回任务</Link>
        <button className="family-button primary" disabled={locked} onClick={() => open(null)}>新建重复计划</button></div></div>
    {error && <p role="alert" className="family-form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!denied.current && <button className="family-button secondary" onClick={() => loadRef.current()} disabled={busy}><ReloadOutlined /> 重新加载计划</button>}
    {loading && <p role="status">正在读取计划…</p>}
    {ready && pending && <section aria-label="待核对计划操作">
      <h2>{pending.corrupt ? '本机命令记录损坏' : '有一项计划操作待核对'}</h2>
      {pending.corrupt ? <p>不能安全发送新命令。请保留记录，勿通过清除站点数据解除。</p> : <div className="family-inline-actions">
        <button className="family-button secondary" disabled={busy} onClick={query}>核对原命令</button>
        {pending.body && <button className="family-button secondary" disabled={busy} onClick={() => guarded(valid => dispatch(pending, valid))}>重试原命令</button>}
        <button className="family-button secondary" disabled={busy} onClick={() => setPrompt({ type: 'abort', marker: pending.marker })}>终止未确定命令</button>
      </div>}
    </section>}
    {ready && <><p>修改从计划当地明天生效；停止保留已有任务。停机未生成的日期不补任务，也不代表已完成。</p>
      {items.length === 0 && <p>暂无重复计划</p>}
      <ul className="recurring-plan-list">{items.map(plan => <li key={plan.id}>
        <h2>{plan.currentRevision.template.title}</h2><p>{plan.timezone} · {plan.startDate} 至 {plan.currentRevision.endDate || '长期'} · {plan.status === 'stopped' ? '已停止'
          : plan.currentRevision.endDate && plan.currentRevision.endDate < today(plan.timezone) ? '已结束' : '进行中'}</p>
        <p>{plan.currentRevision.schedule.kind === 'daily' ? '每天' : `每周${plan.currentRevision.schedule.weekdays.map(d => days[d - 1]).join('、')}`}</p>
        {plan.pendingRevision && <p>{plan.status === 'stopped' ? '停止前设置的规则（不再生成）' : `新规则于 ${plan.pendingRevision.effectiveFrom} 生效`}：{plan.pendingRevision.template.title}</p>}
        <p>最近评估：{plan.generationHealth?.lastEvaluatedDate || '尚未评估'}；未生成次数：{plan.generationHealth?.skippedOccurrenceCount ?? 0}
          {plan.generationHealth?.lastFailureCode && '；生成异常，等待重试'}</p>
        <div className="family-inline-actions"><button className="family-button secondary" disabled={locked || plan.status === 'stopped'
          || Boolean(plan.currentRevision.endDate && plan.currentRevision.endDate < today(plan.timezone))} onClick={() => open(plan)}>修改计划</button>
          <button className="family-button secondary" disabled={locked || plan.status === 'stopped'} onClick={() => setPrompt({ type: 'stop', plan })}>停止计划</button></div>
      </li>)}</ul>
      <nav className="family-inline-actions" aria-label="计划分页"><button className="family-button secondary" title="上一页" aria-label="上一页" disabled={page === 1 || busy || loading} onClick={() => setPage(p => p - 1)}><LeftOutlined /></button>
        <span>第 {page} 页 · 共 {total} 项</span><button className="family-button secondary" title="下一页" aria-label="下一页" disabled={page * 20 >= total || busy || loading} onClick={() => setPage(p => p + 1)}><RightOutlined /></button></nav>
    </>}
    {editor && form && <FamilyDialog labelledBy="recurring-editor" onClose={() => { setEditor(null); setForm(null); }}>
      <h2 id="recurring-editor">{editor.action === 'create' ? '新建重复计划' : '修改明日起规则'}</h2>
      <form onSubmit={save}><fieldset className="family-form-grid recurring-fields" disabled={locked}>
        <label>计划名称<input value={form.title} required maxLength={100} onChange={e => change('title', e.target.value)} /></label>
        <label>成长维度<select value={form.dimension} onChange={e => change('dimension', e.target.value)}>{dimensions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>任务类型<input required value={form.taskType} onChange={e => change('taskType', e.target.value)} /></label>
        {['area', 'subject', 'unit'].map((k, i) => <label key={k}>{['领域', '学科', '单位'][i]}<input value={form[k] || ''} onChange={e => change(k, e.target.value)} /></label>)}
        <label>任务说明<textarea value={form.description || ''} onChange={e => change('description', e.target.value)} /></label>
        {['estimatedMinutes', 'targetAmount'].map((k, i) => <label key={k}>{['预计分钟', '目标数量'][i]}<input inputMode="decimal" value={form[k] ?? ''} onChange={e => change(k, e.target.value)} /></label>)}
        <label>优先级<select value={form.priority || 'medium'} onChange={e => change('priority', e.target.value)}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
        <label>开始日期<input type="date" required disabled={editor.action === 'patch'} value={form.startDate} onChange={e => change('startDate', e.target.value)} /></label>
        <label>结束日期（可留空）<input type="date" value={form.endDate} onChange={e => change('endDate', e.target.value)} /></label>
        <label>重复方式<select value={form.kind} onChange={e => change('kind', e.target.value)}><option value="weekly">每周指定日</option><option value="daily">每天</option></select></label>
        {form.kind === 'weekly' && <fieldset><legend>星期</legend>{days.map((d, i) => <label key={d}><input type="checkbox" checked={form.weekdays.includes(i + 1)} onChange={e => change('weekdays', e.target.checked ? [...form.weekdays, i + 1] : form.weekdays.filter(n => n !== i + 1))} />周{d}</label>)}</fieldset>}
      </fieldset>{error && <p role="alert">{error}</p>}{pending && <p>操作待核对，关闭表单不会解除原命令保护。</p>}
        <div className="family-inline-actions"><button className="family-button primary" disabled={locked}>保存计划</button><button className="family-button secondary" type="button" onClick={() => { setEditor(null); setForm(null); }}>关闭表单</button></div>
      </form></FamilyDialog>}
    {prompt && <FamilyDialog labelledBy="recurring-confirm" onClose={() => setPrompt(null)}><h2 id="recurring-confirm">{prompt.type === 'abort' ? '终止未确定命令' : '停止重复计划'}</h2>
      <p>{prompt.type === 'abort' ? '若原操作已成功，将返回原结果，不会撤销。确认终止后，尚未提交的原命令不能再执行。' : '立即停止生成；已经生成的任务原样保留，需要时单独取消。'}</p>
      {error && <p role="alert">{error}</p>}<div className="family-inline-actions"><button className="family-button primary" disabled={busy} onClick={confirm}>{prompt.type === 'abort' ? '确认终止' : '确认停止'}</button>
        <button className="family-button secondary" onClick={() => setPrompt(null)}>返回</button></div></FamilyDialog>}
  </section>;
};

export default function RecurringPlansPage() {
  const { family, selectedChild, selectedChildId, childScopeVersion } = useFamily();
  const [, update] = useState(0);
  useEffect(() => subscribeSessionChanges(() => update(n => n + 1)), []);
  const session = captureSession('parent'), familyId = family?.familyId || family?.id;
  const identity = `${session?.revision}:${familyId}:${selectedChildId}:${childScopeVersion}`;
  const latest = useRef(identity); latest.current = identity;
  const scope = React.useMemo(() => ({ familyId, childId: selectedChildId }), [familyId, selectedChildId]);
  const scopeCurrent = useCallback(() => latest.current === identity, [identity]);
  if (!session || !familyId || !selectedChildId || !selectedChild) return <p>请选择有权限的孩子。</p>;
  return <ScopedPlans key={identity} scope={scope} session={session} childName={selectedChild.name}
    timezone={family.timezone || 'Asia/Shanghai'} scopeCurrent={scopeCurrent} />;
}
