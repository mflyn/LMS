import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskCompletion } from '../../hooks/useTaskCompletion';
import { assertSessionCurrent, captureSession } from '../../services/familySession';
import * as familyApi from '../../services/familyApi';
import FamilyDialog from './FamilyDialog';
import TaskCompletionEvidence from './TaskCompletionEvidence';
import LearningSourceLink from './LearningSourceLink';

const completionApi = {
  getTask: (...args) => familyApi.getGrowthTask(...args),
  complete: (...args) => familyApi.completeGrowthTask(...args),
  confirm: (...args) => familyApi.confirmGrowthTask(...args),
  discover: (...args) => familyApi.getCompletionRecovery(...args),
  recover: (...args) => familyApi.recoverTaskCompletion(...args)
};

const TaskCompletionReview = ({ taskId, familyId, childId, onClose, onTask, initialMode = 'review' }) => {
  const { user } = useAuth();
  const session = captureSession('parent');
  const scope = useMemo(() => ({ role: 'parent', actorId: user?.id, familyId, childId, taskId }),
    [user?.id, familyId, childId, taskId]);
  const controller = useTaskCompletion({ scope, session, api: completionApi });
  const scopeKey = JSON.stringify([scope, session?.revision]);
  const [editing, setEditing] = useState(initialMode === 'complete');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const mediaApi = useMemo(() => {
    const guard = fn => async (...args) => {
      assertSessionCurrent(session);
      const result = await fn(...args);
      assertSessionCurrent(session);
      return result;
    };
    return { uploadPrivateMedia: guard(familyApi.uploadPrivateMedia),
      getPrivateMediaAccess: guard(familyApi.getPrivateMediaAccess), deletePrivateMedia: guard(familyApi.deletePrivateMedia) };
  }, [session]);
  useEffect(() => { if (controller.task) onTask?.(controller.task); }, [controller.task, onTask]);
  useEffect(() => { setFeedback(''); }, [controller.task?.completionVersion]);
  const task = controller.task;
  const canConfirm = !editing && !mediaBusy && controller.state === 'ready' && !controller.command
    && task?.completionMediaReferenceState === 'stable'
    && (task.status === 'completed' || (task.status === 'confirmed' && task.starAwardState === 'pending'));

  return (
    <FamilyDialog labelledBy="completion-review-title" onClose={onClose}>
      <div className="family-page-heading">
        <h2 id="completion-review-title">作品查看与审核</h2>
        <button type="button" className="family-button secondary" onClick={onClose}>关闭</button>
      </div>
      {task && <h3>{task.title}</h3>}
      {task && controller.state === 'ready' && !editing && !controller.command && <div className="family-inline-actions">
        <LearningSourceLink item={task} />
        <Link className="family-button secondary" to={`/app/mistakes?sourceTaskId=${encodeURIComponent(task.taskId)}`}>记录错题</Link>
        <Link className="family-button secondary" to={`/app/tasks?sourceTaskId=${encodeURIComponent(task.taskId)}`}>创建订正任务</Link>
      </div>}
      <TaskCompletionEvidence controller={controller} scopeKey={scopeKey} childId={childId}
        mediaApi={mediaApi} allowEdit={editing} onMediaBusyChange={setMediaBusy} />
      {editing && <button type="button" className="family-button secondary"
        disabled={controller.busy || mediaBusy || Boolean(controller.command)} onClick={() => {
          setEditing(false); controller.refresh();
        }}>返回作品审核</button>}
      {!editing && controller.editable && (
        <button type="button" className="family-button secondary" onClick={() => setEditing(true)}>代录完成情况</button>
      )}
      {canConfirm && (
        <form onSubmit={event => { event.preventDefault(); controller.confirm(feedback); }}>
          {task.status === 'completed' && <label>家长反馈<textarea aria-label="家长反馈" maxLength={500}
            value={feedback} onChange={event => setFeedback(event.target.value)} /></label>}
          <button type="submit" className="family-button primary">
            {task.status === 'confirmed' ? '恢复本版本星星' : '确认并发放星星'}
          </button>
        </form>
      )}
    </FamilyDialog>
  );
};
export default TaskCompletionReview;
