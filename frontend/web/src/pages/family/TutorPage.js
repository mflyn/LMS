import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useFamily } from '../../contexts/FamilyContext';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { registerChildScopeReset } from '../../services/childScope';
import { tutorApi } from '../../services/tutorApi';
import { confirmedTutorResult, isDefinitiveTutorRejection } from '../../services/tutorResponse';
import { readTutorCommand, saveTutorCommand, finishTutorCommand, newTutorOperationId } from '../../services/tutorCommands';

const oid = value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const blank = () => ({ questionText: '', answerText: '', parentContext: '', textbookLabel: '人教版数学四年级上册，版次由家长核对', deidentified: false });
const noChecks = () => ({ mathCorrect: false, gradeAppropriate: false, chapterAppropriate: false, wordingReviewed: false });
const checkLabels = { mathCorrect: '数学正确', gradeAppropriate: '适合年级', chapterAppropriate: '符合章节', wordingReviewed: '表述已核对' };
const statuses = { ready: '待生成', generating: '处理中', candidate: '待人工审核', approved: '已批准', rejected: '已拒绝', closed: '已关闭',
  reserved: '已预留', dispatching: '发送状态待核对', unknown: '结果未知', succeeded: '已生成', failed: '已终结失败',
  superseded: '已有后续修订', parent_approved: '家长已批准' };
const money = value => Number.isSafeInteger(value) ? `${(value / 1000000).toFixed(6)} 元` : '待核对';
const code = error => error?.response?.data?.error?.code || error?.code;
const message = error => ({ AI_DISABLED: 'AI 生成尚未启用。', AI_PROFILE_UNAVAILABLE: '价格或模型配置暂不可用。',
  AI_PREVIEW_STALE: '预览已过期或变化。请核对原任务状态，结束后重新创建预览。', AI_VERSION_CONFLICT: '候选已变化，请重新查看详情后决定。',
  AI_BUDGET_EXCEEDED: '可用预算不足，未获准新增发送。', AI_SOURCE_SUBJECT_UNSUPPORTED: '本阶段只支持数学来源。',
  AI_SOURCE_CYCLE_ACTIVE: '该来源已有活动讲解，请核对讲解记录。', AI_OPERATION_UNRESOLVED: '原任务尚未收敛，不能重新生成。',
  AI_STORE_ISOLATED: '存储连续性待核对，费用占用和原记录保持不变。', IDEMPOTENCY_KEY_REUSED: '原命令与已保存记录冲突，不能换编号重试。',
  AI_COMMAND_UNRESOLVED: '还有未完成的原命令。', AI_COMMAND_INVALID: '命令不完整，请核对输入。' }[code(error)] ||
  (error?.response?.status === 400 ? '输入未通过校验，请核对文字与必填项。' : '本次结果暂未确认，请保留原命令并显式核对。'));

function TutorWorkspace({ scope, session, search, currentScope }) {
  const navigate = useNavigate(), params = new URLSearchParams(search);
  const selectedId = params.get('cycleId'), sourceType = params.get('sourceType'), sourceId = params.get('sourceId');
  const source = ['task', 'mistake'].includes(sourceType) && oid(sourceId) ? { type: sourceType, id: sourceId } : null;
  const [detail, setDetail] = useState(null), [cycles, setCycles] = useState([]), [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1), [jobsPage, setJobsPage] = useState(1), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [loading, setLoading] = useState({});
  const [form, setForm] = useState(blank), [consent, setConsent] = useState(false);
  const [revision, setRevision] = useState(''), [reason, setReason] = useState(''), [comment, setComment] = useState('');
  const [checks, setChecks] = useState(noChecks), [closeReason, setCloseReason] = useState('');
  const [pending, setPending] = useState(() => { try { return readTutorCommand(scope, session); } catch { return { corrupt: true }; } });
  const live = useRef(true), epoch = useRef({ value: 0 }), requests = useRef({}), writing = useRef(false);
  const current = generation => live.current && generation === epoch.current.value && isSessionCurrent(session) && currentScope();
  useLayoutEffect(() => {
    const clock = epoch.current;
    live.current = true;
    return () => {
      live.current = false; clock.value++;
      Object.values(requests.current).forEach(r => r.controller.abort());
    };
  }, []);
  const deny = () => {
    epoch.current.value++;
    Object.values(requests.current).forEach(r => r.controller.abort()); requests.current = {};
    writing.current = false; setBusy(false); setLoading({}); setBlocked(true);
    setDetail(null); setCycles([]); setJobs([]); setPending(null); setForm(blank()); setRevision(''); setReason('');
    setComment(''); setChecks(noChecks()); setConsent(false); setCloseReason('');
    setError('当前身份无法继续查看这些私有讲解。');
  };
  const refresh = async (kind, requestedPage = 1) => {
    const generation = epoch.current.value;
    if (!current(generation) || (kind === 'detail' && !oid(selectedId))) return;
    requests.current[kind]?.controller.abort();
    const request = { controller: new AbortController() }; requests.current[kind] = request;
    setLoading(value => ({ ...value, [kind]: true }));
    try {
      const options = { session, signal: request.controller.signal };
      const data = kind === 'detail' ? await tutorApi.detail(selectedId, options) : await tutorApi[kind](scope.childId, requestedPage, options);
      if (!current(generation) || requests.current[kind] !== request) return;
      if (kind === 'detail') {
        if (data?.cycle?.childId !== scope.childId || data.cycle.id !== selectedId || !Array.isArray(data.artifacts)) {
          deny(); return;
        }
        setDetail(data); setConsent(false); setChecks(noChecks()); setRevision(''); setReason(''); setComment('');
      } else {
        if (!Array.isArray(data?.items) || (kind === 'cycles' && data.items.some(item => item.childId !== scope.childId))) { deny(); return; }
        if (kind === 'cycles') { setCycles(data.items); setPage(requestedPage); }
        else { setJobs(data.items); setJobsPage(requestedPage); }
      }
      setBlocked(false); setError('');
      setPending(readTutorCommand(scope, session));
    } catch (cause) {
      if (!current(generation)) return;
      // A current-identity denial invalidates ALL private reads, including an earlier in-flight detail request.
      if ([401, 403].includes(cause?.response?.status)) { deny(); return; }
      if (requests.current[kind] === request && cause?.code !== 'ERR_CANCELED') setError(message(cause));
    } finally {
      if (current(generation) && requests.current[kind] === request) setLoading(value => ({ ...value, [kind]: false }));
    }
  };
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  useEffect(() => {
    refreshRef.current('cycles'); refreshRef.current('jobs'); if (oid(selectedId)) refreshRef.current('detail');
  }, [selectedId]);
  const open = id => navigate(`/app/tutor?childId=${scope.childId}&cycleId=${id}`);
  const execute = async saved => {
    const generation = epoch.current.value;
    if (!current(generation) || blocked || writing.current || saved?.corrupt) return;
    let original;
    try { original = saveTutorCommand(scope, saved, session); } catch (cause) { setError(message(cause)); return; }
    writing.current = true; setBusy(true); setPending(original); setError('');
    try {
      const request = { controller: new AbortController() }; requests.current.write = request;
      const options = { session, signal: request.controller.signal };
      const data = original.action === 'create' ? await tutorApi.create(original.body, options)
        : await tutorApi[original.action](original.targetId, original.body, options);
      if (!current(generation)) return;
      const id = confirmedTutorResult(original, data, scope, session);
      finishTutorCommand(scope, original.body.operationId, session); setPending(null);
      if (id === selectedId) await refresh('detail'); else open(id);
      refresh('cycles', page); refresh('jobs', jobsPage);
    } catch (cause) {
      if (!current(generation)) return;
      if ([401, 403].includes(cause?.response?.status)) { deny(); return; }
      if (isDefinitiveTutorRejection(cause)) {
        finishTutorCommand(scope, original.body.operationId, session); setPending(null);
      }
      if (code(cause) === 'AI_VERSION_CONFLICT') {
        requests.current.detail?.controller.abort(); delete requests.current.detail;
        setDetail(null); setChecks(noChecks()); setRevision(''); setReason(''); setComment(''); setConsent(false);
      }
      setError(message(cause));
    } finally { if (current(generation)) { writing.current = false; setBusy(false); } }
  };
  const mutate = (action, targetId, body) => {
    if (pending || blocked || writing.current || !current(epoch.current.value)) return;
    execute({ action, targetId, body: { schemaVersion: 'ai1-min-v1', operationId: newTutorOperationId(), ...body } });
  };
  const create = event => {
    event.preventDefault(); if (!source || !form.deidentified) return;
    mutate('create', null, { childId: scope.childId, source, input: { questionText: form.questionText,
      answerText: form.answerText.trim() ? form.answerText : null, parentContext: form.parentContext },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: form.textbookLabel,
      chapterLabel: '多位数乘两位数' }, deidentifiedConfirmed: true });
  };
  const a = detail?.artifacts.find(item => item.id === detail.cycle.currentArtifactId);
  const seen = () => ({ artifactId: a.id, artifactVersion: a.version, artifactContentHash: a.contentHash,
    expectedArtifactReviewVersion: a.reviewVersion, expectedCycleStateVersion: detail.cycle.stateVersion });
  const locked = busy || Boolean(pending) || blocked;
  const pagination = (kind, number, length) => <nav className="family-inline-actions" aria-label={kind === 'cycles' ? '讲解分页' : '恢复分页'}>
    <button type="button" className="family-button secondary" title="上一页" aria-label={`${kind}上一页`} disabled={number <= 1 || loading[kind]}
      onClick={() => refresh(kind, number - 1)}><LeftOutlined /></button><span>第 {number} 页</span>
    <button type="button" className="family-button secondary" title="下一页" aria-label={`${kind}下一页`} disabled={length < 20 || loading[kind]}
      onClick={() => refresh(kind, number + 1)}><RightOutlined /></button></nav>;
  return <section className="family-page tutor-page" aria-labelledby="tutor-title">
    <div className="family-page-heading"><div><h1 id="tutor-title">家长讲解备课</h1><p>仅供家长备课，未经人工核验不可使用。</p></div>
      <button type="button" className="family-button secondary" aria-label="刷新记录" onClick={() => { refresh('cycles', page); refresh('jobs', jobsPage); }}><ReloadOutlined /> 刷新记录</button></div>
    {error && <p className="family-form-error" role="alert">{error}</p>}
    {!blocked && pending && <div role="status"><p>{pending.corrupt ? '本地命令损坏，已阻止新写入。重新登录后请核对服务端记录。' : '有待核对的原命令，不会自动再次发送。'}</p>
      {!pending.corrupt && <button type="button" className="family-button secondary" disabled={busy} onClick={() => execute(pending)}>重试原命令</button>}</div>}
    {!blocked && source && !selectedId && <form onSubmit={create}>
      <h2>{source.type === 'task' ? '任务来源' : '错题来源'} · 四年级上册数学</h2><p>章节：多位数乘两位数（家长声明）</p>
      <fieldset className="task-editor-fields" disabled={locked}>
        <label className="family-field-wide">教材说明<input required maxLength={200} value={form.textbookLabel} onChange={e => setForm({ ...form, textbookLabel: e.target.value })} /></label>
        <label className="family-field-wide">题目文字<textarea required maxLength={4000} value={form.questionText} onChange={e => setForm({ ...form, questionText: e.target.value })} /></label>
        <label className="family-field-wide">可选作答文字<textarea maxLength={4000} value={form.answerText} onChange={e => setForm({ ...form, answerText: e.target.value })} /></label>
        <label className="family-field-wide">家长补充<textarea maxLength={500} value={form.parentContext} onChange={e => setForm({ ...form, parentContext: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.deidentified} onChange={e => setForm({ ...form, deidentified: e.target.checked })} /> 已核对文字，不含个人信息或链接</label>
        <button type="submit" className="family-button primary" disabled={!form.deidentified || !form.questionText.trim()}>创建外发预览</button>
      </fieldset></form>}
    {oid(selectedId) && <button type="button" className="family-button secondary" aria-label="刷新详情" onClick={() => refresh('detail')}><ReloadOutlined /> 刷新详情</button>}
    {!blocked && detail && <section aria-label="讲解详情">
      {detail.cycle.status === 'approved' && <Link to={`/app/learning?childId=${scope.childId}&cycleId=${detail.cycle.id}`}>预览孩子可见内容</Link>}
      <h2>{statuses[detail.cycle.status] || detail.cycle.status}</h2>
      {detail.job && <p>生成任务：{statuses[detail.job.status]} · 预留 {money(detail.job.budget?.reservedMicros)} · 已结算 {money(detail.job.budget?.settledMicros)}
        {detail.job.failureCode && ` · ${detail.job.failureCode}`}</p>}
      {detail.cycle.status === 'ready' && !detail.job && detail.preview && <section aria-label="完整外发预览">
        <h3>完整外发预览</h3>{detail.preview.messages.map((m, i) => <div key={i}><strong>{m.role}</strong><pre className="tutor-text">{m.content}</pre></div>)}
        <p>模型 {detail.preview.requestOptions.model} · 模型配置 {detail.preview.modelProfileVersion} · 计价配置 {detail.preview.pricingProfileVersion}</p>
        <p>费用上界 {money(detail.preview.reservedCeilingMicros)} · 最晚发送 {detail.preview.sendNotAfter}</p>
        <p>输入上限 {detail.preview.requestOptions.maxInputTokens} tokens · 输出上限 {detail.preview.requestOptions.maxOutputTokens} tokens · 思考关闭 · 单次发送</p>
        <label><input type="checkbox" checked={consent} disabled={locked} onChange={e => setConsent(e.target.checked)} /> 确认以上完整文字及费用上界，发送生成</label>
        <button type="button" className="family-button primary" disabled={locked || !consent} onClick={() => {
          if (Date.parse(detail.preview.sendNotAfter) <= Date.now()) { setError('预览已过期，请关闭旧周期后重新创建预览。'); return; }
          mutate('generate', detail.cycle.id, { expectedCycleStateVersion: detail.cycle.stateVersion,
            generationInputHash: detail.preview.generationInputHash, modelProfileVersion: detail.preview.modelProfileVersion,
            pricingProfileVersion: detail.preview.pricingProfileVersion, maxAuthorizedCostMicros: detail.preview.reservedCeilingMicros, externalSendConfirmed: true });
        }}>生成候选讲解</button></section>}
      <div className="tutor-versions">{detail.artifacts.map(item => <article className="family-record" key={item.id}>
        <h3>版本 {item.version} · {item.origin === 'ai_generation' ? 'AI 原文' : '人工修订'} · {statuses[item.status] || item.status}</h3>
        <pre className="tutor-text">{item.text}</pre><p>记录者 {item.createdBy} · {item.createdAt}</p>
        <p className="tutor-hash">正文摘要 {item.contentHash}</p>
        {item.derivedFromArtifactId && <p>派生自 {item.derivedFromArtifactId}</p>}
        {item.revisionReason && <p>修订原因：{item.revisionReason}</p>}
        {item.review && <p>审核者 {item.review.reviewerId} · {item.review.time} · {item.review.decision === 'approve' ? '批准' : '拒绝'} · {item.review.comment}</p>}
      </article>)}</div>
      {detail.cycle.status === 'candidate' && a && <fieldset className="task-editor-fields" disabled={locked}>
        <label className="family-field-wide">修订文字<textarea maxLength={12000} value={revision} onChange={e => setRevision(e.target.value)} /></label>
        <label className="family-field-wide">修订原因<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button type="button" className="family-button secondary" disabled={!revision.trim() || !reason.trim() || revision === a.text}
          onClick={() => mutate('revise', detail.cycle.id, { ...seen(), revisedText: revision, revisionReason: reason })}>保存修订版本</button>
        <div className="family-checkbox-row">{Object.entries(checkLabels).map(([k, label]) => <label key={k}><input type="checkbox" checked={checks[k]}
          onChange={e => setChecks({ ...checks, [k]: e.target.checked })} />{label}</label>)}</div>
        <label className="family-field-wide">审核意见<input maxLength={500} value={comment} onChange={e => setComment(e.target.value)} /></label>
        <div className="family-inline-actions"><button type="button" className="family-button primary" disabled={!Object.values(checks).every(Boolean)}
          onClick={() => mutate('review', detail.cycle.id, { ...seen(), decision: 'approve', comment, checks })}>批准所见版本</button>
          <button type="button" className="family-button secondary" disabled={!comment.trim()}
            onClick={() => mutate('review', detail.cycle.id, { ...seen(), decision: 'reject', comment, checks })}>拒绝所见版本</button></div>
      </fieldset>}
      {detail.cycle.status !== 'closed' && !['reserved', 'dispatching', 'unknown'].includes(detail.job?.status) && <fieldset className="task-editor-fields" disabled={locked}>
        <label className="family-field-wide">关闭原因<input maxLength={500} value={closeReason} onChange={e => setCloseReason(e.target.value)} /></label>
        <button type="button" className="family-button secondary" disabled={!closeReason.trim()} onClick={() => mutate('close', detail.cycle.id,
          { expectedCycleStateVersion: detail.cycle.stateVersion, reason: closeReason })}>关闭讲解周期</button></fieldset>}
    </section>}
    {!blocked && <><section aria-label="本人待处理任务"><h2>本人待处理任务</h2>{jobs.map(job => <article className="family-record" key={job.id}>
      <p>{statuses[job.status] || job.status}</p><button type="button" className="family-button secondary" onClick={() => open(job.cycleId)}>查看原记录</button>
      {job.canRecover && <button type="button" className="family-button secondary" disabled={locked} onClick={() => mutate('recover', job.id, {})}>恢复原任务</button>}
    </article>)}{!jobs.length && <p>{loading.jobs ? '正在读取' : '暂无待处理任务'}</p>}{pagination('jobs', jobsPage, jobs.length)}</section>
      <section aria-label="讲解记录"><h2>讲解记录</h2>{cycles.map(c => <article className="family-record" key={c.id}>
        <p>{c.source.type === 'task' ? '任务' : '错题'} · {statuses[c.status]} · {c.createdAt}</p>
        <button type="button" className="family-button secondary" onClick={() => open(c.id)}>查看讲解</button></article>)}
        {!cycles.length && <p>{loading.cycles ? '正在读取' : '暂无讲解记录'}</p>}{pagination('cycles', page, cycles.length)}</section></>}
  </section>;
}

export default function TutorPage() {
  const { family, selectedChildId, childScopeVersion } = useFamily(), location = useLocation();
  const [revision, bump] = useState(0), generation = useRef({ value: 0 });
  const session = captureSession('parent'), observedSession = useRef(session);
  useLayoutEffect(() => {
    const owner = generation.current;
    const reset = () => { owner.value++; bump(value => value + 1); };
    const offSession = subscribeSessionChanges(event => {
      if (event.role !== 'parent') return;
      const next = captureSession('parent');
      if (next === observedSession.current) return;
      observedSession.current = next; reset();
    });
    const offChild = registerChildScopeReset(reset);
    // Workspace cleanup invalidates requests on unmount, including StrictMode replay.
    return () => { offSession(); offChild(); };
  }, []);
  const params = new URLSearchParams(location.search);
  const token = generation.current.value;
  if (!session || !oid(family?.familyId) || !oid(selectedChildId)) return <p role="status">请登录并选择孩子。</p>;
  if (params.has('childId') && params.get('childId') !== selectedChildId) return <p role="alert">该入口不属于当前选择的孩子。</p>;
  return <TutorWorkspace key={`${session.revision}:${selectedChildId}:${childScopeVersion}:${revision}:${location.search}`}
    scope={{ familyId: family.familyId, childId: selectedChildId }} session={session} search={location.search}
    currentScope={() => generation.current.value === token} />;
}
