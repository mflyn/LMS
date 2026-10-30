import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import ReflectionPanel from '../../components/family/ReflectionPanel';
import { useFamily } from '../../contexts/FamilyContext';
import { getWeeklyReport, updateWeeklyReportFeedback } from '../../services/familyApi';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { familyLocalDate } from '../../services/dailyLearningPlan';
import { assertLearningScope, isLearningDenied, isLearningId, learningReadMessage } from '../../services/learningSources';
import { reflectionWeek } from '../../services/reflection';

const DIMENSIONS = [
  ['moral', '德育'], ['academic', '智育'], ['physical', '体育'],
  ['artistic', '美育'], ['labor', '劳育']
];

const feedbackOf = report => ({ parentNote: report?.parentNote || '', nextWeekSuggestion: report?.nextWeekSuggestion || '' });
const ScopedReport = ({ family, selectedChild, weekStart, session, isAllowed, deny }) => {
  const markerKey = `family-growth.weekly-feedback-write.v1:${JSON.stringify([session.actorId, family.familyId, selectedChild.childId, weekStart])}`;
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState({ parentNote: '', nextWeekSuggestion: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [unknown, setUnknown] = useState(() => { try { return sessionStorage.getItem(markerKey) !== null; } catch { return true; } });
  const [latest, setLatest] = useState(null);
  const alive = useRef(true), writing = useRef(false), dirty = useRef(false), sequence = useRef(0);
  const current = useCallback(() => alive.current && isAllowed(), [isAllowed]);
  const validate = useCallback(value => {
    assertLearningScope(value, 'reportId', value?.reportId, family.familyId, selectedChild.childId);
    if (!isLearningId(value.reportId) || value.weekStart !== weekStart) {
      throw Object.assign(new Error('Invalid report scope'), { response: { status: 403 } });
    }
    return value;
  }, [family.familyId, selectedChild.childId, weekStart]);
  const load = useCallback(async (reconcile = false) => {
    if (!current()) return;
    const ticket = ++sequence.current;
    setLoading(true); setError(''); setLatest(null);
    try {
      const result = await getWeeklyReport({ childId: selectedChild.childId, weekStart }, undefined, session);
      if (!current()) return;
      const value = validate(result?.report);
      if (ticket !== sequence.current) return;
      setReport(value);
      if (reconcile) setLatest(value);
      else if (!dirty.current && !writing.current) setFeedback(feedbackOf(value));
    } catch (cause) {
      if (isAllowed() && isLearningDenied(cause)) { deny(); return; }
      if (current() && ticket === sequence.current) setError(learningReadMessage(cause));
    } finally { if (current() && ticket === sequence.current) setLoading(false); }
  }, [current, selectedChild.childId, weekStart, session, validate, deny, isAllowed]);
  useEffect(() => {
    alive.current = true; load();
    return () => { alive.current = false; };
  }, [load]);

  const saveFeedback = async (event) => {
    event.preventDefault();
    if (!current() || writing.current || unknown || !report) return;
    if (feedback.parentNote.length > 1000 || feedback.nextWeekSuggestion.length > 1000) { setError('反馈不能超过 1000 字。'); return; }
    try {
      if (sessionStorage.getItem(markerKey) !== null) { setUnknown(true); return; }
      sessionStorage.setItem(markerKey, 'pending');
      if (sessionStorage.getItem(markerKey) !== 'pending') throw new Error('storage');
    } catch { setUnknown(true); setError('无法保存写入保护，请核对后重试。'); return; }
    sequence.current += 1; setLoading(false);
    writing.current = true; setBusy(true); setError(''); setMessage(''); setLatest(null);
    try {
      const result = await updateWeeklyReportFeedback(report.reportId, feedback, undefined, session);
      if (!current()) return;
      const value = validate(result?.report);
      if (value.reportId !== report.reportId) throw new Error('Report changed');
      sessionStorage.removeItem(markerKey);
      setFeedback(feedbackOf(value)); dirty.current = false;
      setMessage('周报反馈已保存。');
    } catch (saveError) {
      if (isAllowed() && isLearningDenied(saveError)) { deny(); return; }
      if (!current()) return;
      if ([400, 409, 422].includes(saveError?.response?.status)) {
        try { sessionStorage.removeItem(markerKey); setError('保存被拒绝，请核对反馈。'); }
        catch { setUnknown(true); }
      } else setUnknown(true);
    } finally {
      if (current()) {
        // Reads begun before or during this write cannot refill its now-saved form.
        sequence.current += 1; setLoading(false); setLatest(null);
        writing.current = false; setBusy(false);
      }
    }
  };
  const adopt = () => {
    if (!current() || busy || !latest) return;
    try {
      sessionStorage.removeItem(markerKey); setUnknown(false); setFeedback(feedbackOf(latest));
      dirty.current = false; setLatest(null); setMessage('已采用重新读取的反馈。');
    } catch { setError('无法解除写入保护，请稍后重试。'); }
  };

  const stats = report?.statistics || {};
  return (
    <>
      <button type="button" className="family-button" disabled={loading} onClick={() => load(unknown)}>{unknown ? '重读周报反馈' : '重新加载周报'}</button>
      {loading && <FamilyDataState state="loading" />}
      {error && <p role="alert">{error}</p>}
      {unknown && <p role="alert">周报反馈保存结果尚未确定，请重读核对后再编辑。</p>}
      {latest && <div><p>已读取的家长寄语：{latest.parentNote || '空白'}</p><p>已读取的下周建议：{latest.nextWeekSuggestion || '空白'}</p>
        <button type="button" className="family-button" disabled={busy} onClick={adopt}>采用重新读取的反馈</button></div>}
      {report && (
        <>
          <div className="family-metric-grid">
            <article><span>记录天数</span><strong>{stats.recordDays ?? '—'}</strong></article>
            <article><span>成长投入</span><strong>{stats.totalDurationMinutes == null ? '—' : `${stats.totalDurationMinutes} 分钟`}</strong></article>
            <article><span>任务完成率</span><strong>{stats.taskCompletionRate == null ? '—' : `${stats.taskCompletionRate}%`}</strong></article>
            <article><span>新增错题</span><strong>{stats.mistakeCount ?? '—'}</strong></article>
          </div>
          <div className="family-section-grid">
            <section className="family-panel"><h2>五育投入</h2><ul className="family-list">{DIMENSIONS.map(([value, label]) => { const task = stats.dimensionTaskStats?.[value]; const duration = stats.dimensionDurations?.[value] || 0; return <li key={value}><strong>{label}</strong><span>{task ? `${task.completed}/${task.planned} 个任务` : '暂无任务'} · {duration} 分钟</span></li>; })}</ul></section>
            <section className="family-panel"><h2>建议复习</h2>{stats.reviewKnowledgePoints?.length ? <ul className="family-list">{stats.reviewKnowledgePoints.map((point) => <li key={point}>{point}</li>)}</ul> : <p>本周暂无待复习知识点。</p>}<h2>系统建议</h2><p>{report.generatedSuggestion || '暂无建议。'}</p></section>
          </div>
          <form className="family-panel family-feedback-form" onSubmit={saveFeedback}>
            <h2>家长反馈</h2>
            <label>家长寄语<textarea maxLength="1000" disabled={busy || unknown} value={feedback.parentNote} onChange={(event) => { dirty.current = true; setFeedback((value) => ({ ...value, parentNote: event.target.value })); }} /></label>
            <label>下周建议<textarea maxLength="1000" disabled={busy || unknown} value={feedback.nextWeekSuggestion} onChange={(event) => { dirty.current = true; setFeedback((value) => ({ ...value, nextWeekSuggestion: event.target.value })); }} /></label>
            {message && <p className="family-success-message" role="status">{message}</p>}
            <button type="submit" className="family-button primary" disabled={busy || unknown}>保存周报反馈</button>
          </form>
        </>
      )}
    </>
  );
};

const ReportScope = props => {
  const { session, family, selectedChild, weekStart } = props;
  const alive = useRef(true), refused = useRef(false);
  const [denied, setDenied] = useState(false);
  const isAllowed = useCallback(() => alive.current && !refused.current && isSessionCurrent(session), [session]);
  const deny = useCallback(() => {
    if (!isAllowed()) return;
    refused.current = true; setDenied(true);
  }, [isAllowed]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (denied) return <p role="alert">当前身份无法读取此记录。</p>;
  return <>
    <ScopedReport {...props} key={weekStart} isAllowed={isAllowed} deny={deny} />
    <ReflectionPanel role="parent" familyId={family.familyId} childId={selectedChild.childId} grade={selectedChild.grade}
      weekStart={weekStart} isAllowed={isAllowed} onDenied={deny} />
  </>;
};

const ReportsPage = () => {
  const { family, selectedChild, childScopeVersion } = useFamily();
  const [query, setQuery] = useSearchParams();
  const [, changed] = useState(0);
  useEffect(() => subscribeSessionChanges(() => changed(n => n + 1)), []);
  const session = captureSession('parent');
  if (!selectedChild || !family) return <FamilyDataState state="empty" />;
  if (!isSessionCurrent(session)) return <p role="alert">请重新登录后查看周报。</p>;
  let weekStart;
  try { weekStart = reflectionWeek(query.get('weekStart') || familyLocalDate(family.timezone)).from; }
  catch { weekStart = ''; }
  return <section className="family-page family-page-wide" aria-labelledby="reports-page-title">
    <div className="family-page-heading">
      <div><p className="family-eyebrow">{selectedChild.name}的阶段总结</p><h1 id="reports-page-title">周报</h1></div>
      <label>周一开始<input type="date" value={weekStart} onChange={event => {
        if (event.target.value) setQuery({ weekStart: reflectionWeek(event.target.value).from });
      }} /></label>
    </div>
    {weekStart ? <ReportScope family={family} selectedChild={selectedChild} weekStart={weekStart} session={session}
      key={`${session.actorId}:${session.revision}:${family.familyId}:${selectedChild.childId}:${childScopeVersion}`} />
      : <p role="alert">请选择有效日期，并确认家庭时区。</p>}
  </section>;
};

export default ReportsPage;
