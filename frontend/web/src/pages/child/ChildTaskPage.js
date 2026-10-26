import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import TaskCompletionEvidence from '../../components/family/TaskCompletionEvidence';
import TaskHelpPanel from '../../components/family/TaskHelpPanel';
import { useTaskCompletion } from '../../hooks/useTaskCompletion';
import { captureSession, isSessionCurrent, loadChildSession, subscribeSessionChanges } from '../../services/familySession';
import { completeOwnTask, getOwnTask, getOwnCompletionRecovery, recoverOwnTaskCompletion,
  getOwnPrivateMediaAccess, uploadOwnPrivateMedia, deleteOwnPrivateMedia } from '../../services/childApi';

const DIMENSION_LABELS = { moral: '德育', academic: '智育', physical: '体育', artistic: '美育', labor: '劳育' };
const completionApi = { getTask: getOwnTask, complete: completeOwnTask, discover: getOwnCompletionRecovery, recover: recoverOwnTaskCompletion };

const ChildTaskDetail = ({ scope, session, scopeKey, grade }) => {
  const controller = useTaskCompletion({ scope, session, api: completionApi });
  const mediaApi = useMemo(() => ({
    uploadPrivateMedia: (input, signal) => uploadOwnPrivateMedia(input, { signal, session }),
    getPrivateMediaAccess: (mediaId, signal) => getOwnPrivateMediaAccess(mediaId, { signal, session }),
    deletePrivateMedia: (mediaId, signal) => deleteOwnPrivateMedia(mediaId, { signal, session })
  }), [session]);
  const task = !['awaiting_auth', 'blocked'].includes(controller.state) && isSessionCurrent(session) ? controller.task : null;
  const helpSnapshot = useMemo(() => task ? { task } : null, [task]);
  return <section className="child-page child-task-page" aria-label="任务详情">
    <Link className="child-back-link" to="/child/today">返回今天</Link>
    {task && <>
      <div className="child-page-heading"><div>
        <span className={`child-dimension is-${task.dimension}`}>{DIMENSION_LABELS[task.dimension] || task.dimension}</span>
        <h1>{task.title}</h1>
      </div></div>
      <section className="child-section" aria-labelledby="task-plan-title">
        <h2 id="task-plan-title">任务安排</h2>
        {task.description && <p>{task.description}</p>}
        <dl className="child-detail-list">
          <div><dt>领域</dt><dd>{task.area || '未填写'}</dd></div>
          <div><dt>截止日期</dt><dd>{task.dueDate}</dd></div>
          {task.estimatedMinutes != null && <div><dt>预计用时</dt><dd>{task.estimatedMinutes} 分钟</dd></div>}
          {task.targetAmount != null && <div><dt>目标</dt><dd>{task.targetAmount} {task.unit || ''}</dd></div>}
        </dl>
        {task.attachmentMediaIds?.length > 0 && <PrivateMediaCollectionField
          key={scopeKey} label="任务附件" purpose="task_attachment" values={task.attachmentMediaIds}
          readOnly ownScope className="child-media-field" controlClassName="child-secondary-button"
          getPrivateMediaAccess={mediaApi.getPrivateMediaAccess}
        />}
      </section>
    </>}
    {!['awaiting_auth', 'blocked'].includes(controller.state) && <div id="task-independent-help"><TaskHelpPanel
      role="student" taskId={scope.taskId} familyId={scope.familyId} childId={scope.childId} taskStatus={task?.status}
      taskSnapshot={helpSnapshot} /></div>}
    <TaskCompletionEvidence controller={controller} scopeKey={scopeKey} childId={scope.childId} mediaApi={mediaApi}
      grade={grade} helpTargetId="task-independent-help" />
  </section>;
};

const ChildTaskPage = () => {
  const { taskId } = useParams();
  const [, setGeneration] = useState(0);
  useEffect(() => subscribeSessionChanges(() => setGeneration(value => value + 1)), []);
  const session = captureSession('student');
  const child = loadChildSession()?.child;
  const scope = useMemo(() => session && child ? { role: 'student', actorId: session.actorId,
    familyId: child.familyId, childId: child.childId, taskId } : null, [session, child, taskId]);
  const scopeKey = JSON.stringify([scope, session?.revision]);
  if (!scope || scope.actorId !== scope.childId || !isSessionCurrent(session)) return <section className="child-page">
    <Link to="/child/today">返回今天</Link><p role="alert">请重新登录后查看任务。</p>
  </section>;
  return <ChildTaskDetail key={scopeKey} scope={scope} session={session} scopeKey={scopeKey} grade={child.grade} />;
};

export default ChildTaskPage;
