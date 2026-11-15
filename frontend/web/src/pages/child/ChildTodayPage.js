import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import CompletionRecoveryList from '../../components/family/CompletionRecoveryList';
import DailyLearningPlanPanel from '../../components/family/DailyLearningPlanPanel';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnReminders, listOwnTasks } from '../../services/childApi';
import { captureSession, isSessionCurrent, loadChildSession, subscribeSessionChanges } from '../../services/familySession';
import { isLearningId, mistakeUrl } from '../../services/learningSources';
import { BookOutlined, CheckCircleOutlined, CommentOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { HomeTaskIcon, HomeTaskStatus } from '../../components/family/HomePresentation';
import readingCompanion from '../../assets/home-reading-companion.webp';

const DIMENSION_LABELS = {
  moral: '德育',
  academic: '智育',
  physical: '体育',
  artistic: '美育',
  labor: '劳育'
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
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const nextTaskRef = useRef(null);
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
  const nextTask = taskItems.find(item => item.taskId === selectedTaskId && item.status === 'pending')
    || taskItems.find(item => item.status === 'pending');

  return (
    <section className="child-page home-page home-child" aria-labelledby="child-today-title">
      <div className="child-page-heading home-heading">
        <div>
          <p className="child-eyebrow">今天也向前一步</p>
          <h1 id="child-today-title" aria-label="今天">{child.name}，今天想先做哪一件？</h1>
          <p className="home-intro">自己安排，一步一步来。</p>
          <Link className="child-back-link home-learning-entry" to="/child/learning">我的学习包</Link>
        </div>
        <img className="home-companion" src={readingCompanion} width="180" height="116" alt="" />
      </div>

      {tasks.state === 'loading' && reminders.state === 'loading' && <FamilyDataState state="loading" />}
      {reminders.state === 'partial' && (
        <FamilyDataState state="partial" unavailableSources={reminders.unavailableSources} />
      )}
      <div className="child-resource-errors">
        <ResourceError label="今天的任务" resource={tasks} />
        <ResourceError label="今日提醒" resource={reminders} />
      </div>

      <section className="home-panel home-choices" aria-labelledby="child-tasks-title">
        <h2 id="child-tasks-title">今天的任务</h2>
        {tasks.data && taskItems.length === 0 && <p className="child-empty-copy">今天暂无任务。</p>}
        <p className="home-panel-hint">点开任务看看要求，也可以选择接下来想做的一项。</p>
        <div className="child-task-list home-task-choices">
          {taskItems.map((item) => {
            const content = (
              <>
                <HomeTaskIcon dimension={item.dimension} />
                <span className={`child-dimension is-${item.dimension}`}>{DIMENSION_LABELS[item.dimension] || item.dimension}</span>
                <strong>{item.title}</strong>
                <HomeTaskStatus status={item.status} />
                {item.starAwardState === 'awarded' && <span>星星已到账</span>}
                {item.starAwardState === 'pending' && <span>星星待到账</span>}
              </>
            );
            return <div className={`home-task-choice ${nextTask?.taskId === item.taskId ? 'is-selected' : ''}`} key={item.taskId}>
              {['pending', 'completed', 'confirmed'].includes(item.status)
                ? <Link className="child-task-row" to={`/child/tasks/${item.taskId}`}>{content}</Link>
                : <article className="child-task-row">{content}</article>}
              {item.status === 'pending' && <button type="button" className="home-choose-button"
                aria-label={`选择任务 ${item.title}`} aria-pressed={nextTask?.taskId === item.taskId} aria-controls="home-next-task"
                onClick={() => {
                  setSelectedTaskId(item.taskId);
                  nextTaskRef.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
                  nextTaskRef.current?.focus({ preventScroll: true });
                }}>{nextTask?.taskId === item.taskId ? '已选择' : '接下来做这项'}</button>}
            </div>;
          })}
        </div>
      </section>

      <div className="home-child-grid">
        {nextTask && <section className="home-panel home-task-focus" aria-label="接下来可以做" id="home-next-task" ref={nextTaskRef} tabIndex={-1}>
          <span className="home-eyebrow">接下来可以做</span>
          <h2 aria-live="polite">{nextTask.title}</h2>
          <p>先读清任务要求，遇到困难可以求助。</p>
          <ol className="home-learning-steps" aria-label="完成任务的小提示">
            {[[BookOutlined, '读懂任务'], [EditOutlined, '动手完成'], [CheckCircleOutlined, '自己检查'], [CommentOutlined, '简短回顾']].map(([Icon, label]) =>
              <li key={label}><Icon aria-hidden="true" /><span>{label}</span></li>)}
          </ol>
          <div className="home-focus-actions">
            <Link className="home-action primary" to={`/child/tasks/${nextTask.taskId}`}>查看这项任务</Link>
            <Link className="home-action secondary" to={`/child/tasks/${nextTask.taskId}#task-independent-help`}>我需要帮助</Link>
          </div>
        </section>}
        <section className="home-panel home-child-reminders" aria-labelledby="child-reminders-title">
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
      </div>
      <div className="home-panel home-plan-panel">
        <DailyLearningPlanPanel role="student" childId={child.childId} familyId={child.familyId} grade={child.grade} />
      </div>
      <div className="home-recovery"><CompletionRecoveryList role="student" childId={session.actorId} /></div>
      <div className="home-reflection">
        <p>留一点时间，想想今天的小收获。</p>
        <Link to="/child/reflection">本周反思 <RightOutlined aria-hidden="true" /></Link>
      </div>
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
