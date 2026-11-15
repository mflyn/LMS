import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import DailyLearningPlanPanel from '../../components/family/DailyLearningPlanPanel';
import { CalendarOutlined, CommentOutlined, RightOutlined } from '@ant-design/icons';
import { HomeTaskIcon, HomeTaskStatus } from '../../components/family/HomePresentation';
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
  const { family, selectedChild, childScopeVersion } = useFamily();
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

  const resources = [
    { key: 'growth_tasks', label: '成长任务', resource: tasks },
    { key: 'weekly_report', label: '本周报告', resource: report },
    { key: 'mistakes', label: '待复习错题', resource: mistakes },
    { key: 'reminders', label: '今日提醒', resource: reminders }
  ];
  const loading = resources.every(({ resource }) => resource.state === 'loading');
  const failedResources = resources.filter(({ resource }) => (
    ['retryable_error', 'error'].includes(resource.state)
  ));
  const unavailableSources = reminders.unavailableSources || [];

  if (!selectedChild) return <FamilyDataState state="empty" />;
  if (loading) return <FamilyDataState state="loading" />;

  const taskItems = tasks.data?.items || [];
  const weekly = report.data?.report?.statistics;
  const pendingMistakes = mistakes.data?.total ?? mistakes.data?.items?.length;
  const reminderItems = reminders.data?.items || [];
  const helpItems = taskItems.filter(item => item.status === 'pending' && item.helpRequest?.status === 'pending');
  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    timeZone: family?.timezone || 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  }).format(new Date());

  return (
    <section className="family-page family-page-wide home-page home-parent" aria-labelledby="today-page-title">
      <div className="family-page-heading home-heading">
        <div>
          <p className="family-eyebrow">{selectedChild.name}的家庭概览</p>
          <h1 id="today-page-title">今日成长</h1>
          <p className="home-intro">看见孩子的安排，在需要时给予支持。</p>
          <p className="home-date"><CalendarOutlined aria-hidden="true" />{todayLabel}</p>
        </div>
        <div className="family-inline-actions">
          <Link className="family-button secondary" to="/app/tasks">新建任务</Link>
          <Link className="family-button primary" to="/app/logs">记录成长</Link>
          <Link className="family-button secondary" to="/app/mistakes">记录错题</Link>
          <Link className="family-button secondary" to="/app/tasks?helpStatus=pending">待处理求助</Link>
        </div>
      </div>

      {unavailableSources.length > 0 && (
        <FamilyDataState state="partial" unavailableSources={[...new Set(unavailableSources)]} />
      )}
      {failedResources.length > 0 && (
        <div className="family-resource-errors">
          {failedResources.map(({ key, label, resource }) => (
            <div role="group" aria-label={`${label}加载失败`} className="family-resource-error" key={key}>
              <strong>{label}</strong>
              <FamilyDataState
                state={resource.state}
                error={resource.error}
                onRetry={resource.state === 'retryable_error' ? resource.reload : undefined}
              />
            </div>
          ))}
        </div>
      )}

      <div className="family-metric-grid home-metrics" aria-label="成长概览">
        <article><span>今日任务</span><strong>{tasks.data ? taskItems.length : '—'}</strong></article>
        <article><span>待完成</span><strong>{tasks.data ? taskItems.filter((item) => item.status === 'pending').length : '—'}</strong></article>
        <article><span>本周完成率</span><strong>{weekly?.taskCompletionRate == null ? '—' : `${weekly.taskCompletionRate}%`}</strong></article>
        <article><span>本周成长投入</span><strong>{weekly?.totalDurationMinutes == null ? '—' : `${weekly.totalDurationMinutes} 分钟`}</strong></article>
        <article><span>待复习错题</span><strong>{pendingMistakes ?? '—'}</strong></article>
      </div>

      <div className="home-parent-grid">
        <div className="home-main-column">
          <section className="home-panel" aria-labelledby="today-task-list-title">
            <div className="home-panel-heading"><h2 id="today-task-list-title">今天的任务</h2><Link to="/app/tasks">全部任务 <RightOutlined aria-hidden="true" /></Link></div>
            <p className="home-panel-hint">让孩子参与安排，按自己的节奏完成。</p>
            {tasks.data && taskItems.length === 0 ? <p className="home-empty">今天暂无任务。</p> : (
              <ul className="home-task-rows">
                {taskItems.map(item => <li key={item.taskId}>
                  <HomeTaskIcon dimension={item.dimension} />
                  {['pending', 'completed', 'confirmed'].includes(item.status)
                    ? <Link to={`/app/tasks?childId=${encodeURIComponent(selectedChild.childId)}&taskId=${encodeURIComponent(item.taskId)}`}>{item.title}</Link>
                    : <strong>{item.title}</strong>}
                  <HomeTaskStatus status={item.status} />
                </li>)}
              </ul>
            )}
          </section>
          <div className="home-panel home-plan-panel">
            <DailyLearningPlanPanel role="parent" familyId={family?.familyId} childId={selectedChild.childId}
              timezone={family?.timezone} grade={selectedChild.grade} scopeVersion={childScopeVersion} />
          </div>
        </div>
        <aside className="home-side-column">
          <section className="home-panel home-support" aria-labelledby="today-support-title">
            <h2 id="today-support-title"><CommentOutlined aria-hidden="true" />需要你的支持</h2>
            <p>先听听孩子的思路，再给一点提示。</p>
            {helpItems.length > 0 && <ul className="home-help-list">{helpItems.map(item => <li key={item.taskId}>{item.title}<span>等待帮助</span></li>)}</ul>}
            <Link className="family-button primary" to="/app/tasks?helpStatus=pending">查看求助</Link>
            <p className="home-panel-hint">查看全部任务中的待处理求助。</p>
          </section>
          <section className="home-panel" aria-labelledby="today-reminders-title">
            <h2 id="today-reminders-title">今日提醒</h2>
            {reminders.data && reminderItems.length === 0 ? <p>今天暂无提醒。</p> : (
              <ul className="home-reminder-list">
                {reminderItems.map((item, index) => <li key={item.sourceId || `${item.type}-${index}`}>{item.title}</li>)}
              </ul>
            )}
          </section>
          <section className="home-panel home-review" aria-labelledby="today-review-title">
            <h2 id="today-review-title">本周回顾</h2>
            <p>留一点时间，和孩子聊聊这一周的收获。</p>
            <Link to="/app/reports">查看周报 <RightOutlined aria-hidden="true" /></Link>
          </section>
        </aside>
      </div>
    </section>
  );
};

export default TodayPage;
