import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { getWeeklyReport, updateWeeklyReportFeedback } from '../../services/familyApi';

const DIMENSIONS = [
  ['moral', '德育'], ['academic', '智育'], ['physical', '体育'],
  ['artistic', '美育'], ['labor', '劳育']
];

const localDate = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const currentMonday = (timezone) => {
  const date = new Date(`${localDate(new Date(), timezone)}T00:00:00.000Z`);
  const offset = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '保存失败，请重试。';

const ReportsPage = () => {
  const { family, selectedChild } = useFamily();
  const [weekStart, setWeekStart] = useState(() => currentMonday(family?.timezone || 'Asia/Shanghai'));
  const load = useCallback(
    ({ childId, signal }) => getWeeklyReport({ childId, weekStart }, signal),
    [weekStart]
  );
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const report = resource.data?.report;
  const [feedback, setFeedback] = useState({ parentNote: '', nextWeekSuggestion: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFeedback({
      parentNote: report?.parentNote || '',
      nextWeekSuggestion: report?.nextWeekSuggestion || ''
    });
  }, [report]);

  const saveFeedback = async (event) => {
    event.preventDefault();
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    try {
      const result = await updateWeeklyReportFeedback(report.reportId, feedback);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setFeedback({
        parentNote: result.report.parentNote || '',
        nextWeekSuggestion: result.report.nextWeekSuggestion || ''
      });
      setMessage('周报反馈已保存。');
    } catch (saveError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setError(messageFor(saveError));
    } finally {
      setBusy(false);
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;

  const stats = report?.statistics || {};
  return (
    <section className="family-page family-page-wide" aria-labelledby="reports-page-title">
      <div className="family-page-heading">
        <div><p className="family-eyebrow">{selectedChild.name}的阶段总结</p><h1 id="reports-page-title">周报</h1></div>
        <label>周一开始<input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} /></label>
      </div>
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
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
            <label>家长寄语<textarea maxLength="1000" value={feedback.parentNote} onChange={(event) => setFeedback((value) => ({ ...value, parentNote: event.target.value }))} /></label>
            <label>下周建议<textarea maxLength="1000" value={feedback.nextWeekSuggestion} onChange={(event) => setFeedback((value) => ({ ...value, nextWeekSuggestion: event.target.value }))} /></label>
            {error && <p className="family-form-error" role="alert">{error}</p>}
            {message && <p className="family-success-message" role="status">{message}</p>}
            <button type="submit" className="family-button primary" disabled={busy || (!feedback.parentNote.trim() && !feedback.nextWeekSuggestion.trim())}>保存周报反馈</button>
          </form>
        </>
      )}
    </section>
  );
};

export default ReportsPage;
