import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import CompletionRecoveryList from '../../components/family/CompletionRecoveryList';
import DailyLearningPlanPanel from '../../components/family/DailyLearningPlanPanel';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnReminders, listOwnTasks } from '../../services/childApi';
import { captureSession, isSessionCurrent, loadChildSession, subscribeSessionChanges } from '../../services/familySession';
import { isLearningId, mistakeUrl } from '../../services/learningSources';

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
  confirmed: '已确认',
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

const ChildTodayContent = ({ session, child }) => {
  const loadTasks = useCallback(
    ({ signal }) => listOwnTasks({ scope: 'today', pageSize: 100 }, { signal, session }),
    [session]
  );
  const loadReminders = useCallback(async ({ signal }) => {
    const result = await listOwnReminders({}, { signal, session });
    return {
      data: result,
      partial: Boolean(result?.meta?.partial),
      unavailableSources: result?.meta?.unavailableSources || []
    };
  }, [session]);
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
        <Link className="child-back-link" to="/child/reflection">本周反思</Link>
      </div>

      <DailyLearningPlanPanel role="student" childId={child.childId} familyId={child.familyId} grade={child.grade} />
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
                {item.starAwardState === 'awarded' && <span>星星已到账</span>}
                {item.starAwardState === 'pending' && <span>星星待到账</span>}
              </>
            );
            return ['pending', 'completed', 'confirmed'].includes(item.status) ? (
              <Link className="child-task-row" to={`/child/tasks/${item.taskId}`} key={item.taskId}>{content}</Link>
            ) : (
              <article className="child-task-row" key={item.taskId}>{content}</article>
            );
          })}
        </div>
      </section>

      <CompletionRecoveryList role="student" childId={session.actorId} />
      <section className="child-section" aria-labelledby="child-reminders-title">
        <h2 id="child-reminders-title">今日提醒</h2>
        {reminders.data && reminderItems.length === 0 && <p className="child-empty-copy">今天暂无提醒。</p>}
        <ul className="child-reminder-list">
          {reminderItems.map((item, index) => (
            <li key={item.sourceId || item.reminderId || `${item.type}-${index}`}>{item.title}
              {item.type === 'mistake_review' && item.childId === child.childId && isLearningId(item.sourceId)
                && <Link className="child-back-link" to={mistakeUrl('student', item.sourceId)}>复习此错题</Link>}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};

const ChildTodayPage = () => {
  const [, setGeneration] = useState(0);
  useEffect(() => subscribeSessionChanges(() => setGeneration(value => value + 1)), []);
  const identity = { session: captureSession('student'), child: loadChildSession()?.child };
  if (!identity.session || !identity.child || !isSessionCurrent(identity.session)) {
    return <p role="alert">请重新登录后查看今天的任务。</p>;
  }
  return <ChildTodayContent key={JSON.stringify([identity.session.actorId, identity.child.familyId,
    identity.child.childId, identity.session.revision])} session={identity.session} child={identity.child} />;
};

export default ChildTodayPage;
