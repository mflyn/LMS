import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildResource } from '../../hooks/useChildResource';
import {
  getWeeklyReport,
  listFamilyReminders,
  listGrowthTasks,
  listMistakes
} from '../../services/familyApi';

const localDate = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const mondayFor = (timezone) => {
  const today = localDate(new Date(), timezone);
  const date = new Date(`${today}T00:00:00.000Z`);
  const offset = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

const TodayPage = () => {
  const { family, selectedChild } = useFamily();
  const weekStart = useMemo(() => mondayFor(family?.timezone || 'Asia/Shanghai'), [family?.timezone]);
  const loadTasks = useCallback(
    ({ childId, signal }) => listGrowthTasks({ childId, scope: 'today' }, signal),
    []
  );
  const loadReport = useCallback(
    ({ childId, signal }) => getWeeklyReport({ childId, weekStart }, signal),
    [weekStart]
  );
  const loadMistakes = useCallback(
    ({ childId, signal }) => listMistakes({ childId, reviewStatus: 'pending', pageSize: 20 }, signal),
    []
  );
  const loadReminders = useCallback(async ({ childId, signal }) => {
    const result = await listFamilyReminders({ childId }, signal);
    return {
      data: result,
      partial: Boolean(result?.meta?.partial),
      unavailableSources: result?.meta?.unavailableSources || []
    };
  }, []);

  const tasks = useChildResource({ load: loadTasks });
  const report = useChildResource({ load: loadReport });
  const mistakes = useChildResource({ load: loadMistakes });
  const reminders = useChildResource({ load: loadReminders });

  const resources = [tasks, report, mistakes, reminders];
  const loading = resources.every((resource) => resource.state === 'loading');
  const failedSources = [
    tasks.state === 'retryable_error' && 'growth_tasks',
    report.state === 'retryable_error' && 'weekly_report',
    mistakes.state === 'retryable_error' && 'mistakes',
    reminders.state === 'retryable_error' && 'reminders',
    ...(reminders.unavailableSources || [])
  ].filter(Boolean);
  const allFailed = resources.every((resource) => resource.state === 'retryable_error');
  const reloadAll = () => resources.forEach((resource) => resource.reload());

  if (!selectedChild) return <FamilyDataState state="empty" />;
  if (loading) return <FamilyDataState state="loading" />;
  if (allFailed) return <FamilyDataState state="retryable_error" onRetry={reloadAll} />;

  const taskItems = tasks.data?.items || [];
  const weekly = report.data?.report;
  const pendingMistakes = mistakes.data?.total ?? mistakes.data?.items?.length;
  const reminderItems = reminders.data?.items || [];

  return (
    <section className="family-page family-page-wide" aria-labelledby="today-page-title">
      <div className="family-page-heading">
        <div>
          <p className="family-eyebrow">{selectedChild.name}的家庭概览</p>
          <h1 id="today-page-title">今日成长</h1>
        </div>
        <div className="family-inline-actions">
          <Link className="family-button primary" to="/app/tasks">新建任务</Link>
          <Link className="family-button secondary" to="/app/logs">记录成长</Link>
          <Link className="family-button secondary" to="/app/mistakes">记录错题</Link>
        </div>
      </div>

      {failedSources.length > 0 && (
        <FamilyDataState state="partial" unavailableSources={[...new Set(failedSources)]} />
      )}

      <div className="family-metric-grid">
        <article><span>今日任务</span><strong>{tasks.data ? taskItems.length : '—'}</strong></article>
        <article><span>待完成</span><strong>{tasks.data ? taskItems.filter((item) => item.status === 'pending').length : '—'}</strong></article>
        <article><span>本周完成率</span><strong>{weekly?.taskCompletionRate == null ? '—' : `${weekly.taskCompletionRate}%`}</strong></article>
        <article><span>本周成长投入</span><strong>{weekly?.totalDurationMinutes == null ? '—' : `${weekly.totalDurationMinutes} 分钟`}</strong></article>
        <article><span>待复习错题</span><strong>{pendingMistakes ?? '—'}</strong></article>
      </div>

      <div className="family-section-grid">
        <section className="family-panel" aria-labelledby="today-task-list-title">
          <h2 id="today-task-list-title">今天的任务</h2>
          {tasks.data && taskItems.length === 0 ? <p>今天暂无任务。</p> : (
            <ul className="family-list">
              {taskItems.map((item) => <li key={item.taskId}>{item.title}</li>)}
            </ul>
          )}
        </section>
        <section className="family-panel" aria-labelledby="today-reminders-title">
          <h2 id="today-reminders-title">今日提醒</h2>
          {reminders.data && reminderItems.length === 0 ? <p>今天暂无提醒。</p> : (
            <ul className="family-list">
              {reminderItems.map((item, index) => <li key={item.sourceId || `${item.type}-${index}`}>{item.title}</li>)}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
};

export default TodayPage;
