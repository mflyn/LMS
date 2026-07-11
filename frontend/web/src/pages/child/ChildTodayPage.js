import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnReminders, listOwnTasks } from '../../services/childApi';

const DIMENSION_LABELS = {
  moral: '德育',
  academic: '智育',
  physical: '体育',
  artistic: '美育',
  labor: '劳育'
};

const STATUS_LABELS = {
  pending: '待完成',
  completed: '等待家长确认',
  confirmed: '已获得星星',
  cancelled: '已取消',
  archived: '已归档'
};

const ResourceError = ({ label, resource }) => {
  if (!['error', 'retryable_error'].includes(resource.state)) return null;
  return (
    <div className="child-resource-error" role="group" aria-label={`${label}加载失败`}>
      <strong>{label}</strong>
      <FamilyDataState
        state={resource.state}
        error={resource.error}
        onRetry={resource.state === 'retryable_error' ? resource.reload : undefined}
      />
    </div>
  );
};

const ChildTodayPage = () => {
  const loadTasks = useCallback(
    ({ signal }) => listOwnTasks({ scope: 'today', pageSize: 100 }, signal),
    []
  );
  const loadReminders = useCallback(async ({ signal }) => {
    const result = await listOwnReminders({}, signal);
    return {
      data: result,
      partial: Boolean(result?.meta?.partial),
      unavailableSources: result?.meta?.unavailableSources || []
    };
  }, []);
  const tasks = useChildDataResource({ load: loadTasks });
  const reminders = useChildDataResource({ load: loadReminders });
  const taskItems = tasks.data?.items || [];
  const reminderItems = reminders.data?.items || [];

  return (
    <section className="child-page" aria-labelledby="child-today-title">
      <div className="child-page-heading">
        <div>
          <p className="child-eyebrow">今天也向前一步</p>
          <h1 id="child-today-title">今天</h1>
        </div>
      </div>

      {tasks.state === 'loading' && reminders.state === 'loading' && <FamilyDataState state="loading" />}
      {reminders.state === 'partial' && (
        <FamilyDataState state="partial" unavailableSources={reminders.unavailableSources} />
      )}
      <div className="child-resource-errors">
        <ResourceError label="今天的任务" resource={tasks} />
        <ResourceError label="今日提醒" resource={reminders} />
      </div>

      <section className="child-section" aria-labelledby="child-tasks-title">
        <h2 id="child-tasks-title">今天的任务</h2>
        {tasks.data && taskItems.length === 0 && <p className="child-empty-copy">今天暂无任务。</p>}
        <div className="child-task-list">
          {taskItems.map((item) => {
            const content = (
              <>
                <span className={`child-dimension is-${item.dimension}`}>{DIMENSION_LABELS[item.dimension] || item.dimension}</span>
                <strong>{item.title}</strong>
                <span>{STATUS_LABELS[item.status] || item.status}</span>
              </>
            );
            return item.status === 'pending' ? (
              <Link className="child-task-row" to={`/child/tasks/${item.taskId}`} key={item.taskId}>{content}</Link>
            ) : (
              <article className="child-task-row" key={item.taskId}>{content}</article>
            );
          })}
        </div>
      </section>

      <section className="child-section" aria-labelledby="child-reminders-title">
        <h2 id="child-reminders-title">今日提醒</h2>
        {reminders.data && reminderItems.length === 0 && <p className="child-empty-copy">今天暂无提醒。</p>}
        <ul className="child-reminder-list">
          {reminderItems.map((item, index) => (
            <li key={item.sourceId || item.reminderId || `${item.type}-${index}`}>{item.title}</li>
          ))}
        </ul>
      </section>
    </section>
  );
};

export default ChildTodayPage;
