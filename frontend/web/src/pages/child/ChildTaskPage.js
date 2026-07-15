import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { completeOwnTask, getOwnPrivateMediaAccess, getOwnTask } from '../../services/childApi';

const DIMENSION_LABELS = {
  moral: '德育', academic: '智育', physical: '体育', artistic: '美育', labor: '劳育'
};
const STATUS_LABELS = {
  pending: '待完成',
  completed: '等待家长确认',
  confirmed: '已获得星星',
  cancelled: '已取消',
  archived: '已归档'
};

const numericValue = (value) => (value === '' ? undefined : Number(value));
const errorMessage = (error) => error?.response?.data?.error?.message || error?.message || '提交失败，请稍后重试。';
const isConflict = (error) => error?.response?.status === 409
  || error?.response?.data?.error?.code === 'TASK_STATE_CONFLICT';

const ChildTaskPage = () => {
  const { taskId } = useParams();
  const loadTask = useCallback(async ({ signal }) => {
    const result = await getOwnTask(taskId, signal);
    return result?.task || null;
  }, [taskId]);
  const resource = useChildDataResource({ load: loadTask });
  const [task, setTask] = useState(null);
  const [form, setForm] = useState({
    actualMinutes: '',
    actualAmount: '',
    difficulty: 'normal',
    needsHelp: false,
    childNote: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (resource.data) setTask(resource.data);
  }, [resource.data]);

  const updateField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitCompletion = async (event) => {
    event.preventDefault();
    if (submitting || task?.status !== 'pending') return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const result = await completeOwnTask(taskId, {
        actualMinutes: numericValue(form.actualMinutes),
        actualAmount: numericValue(form.actualAmount),
        difficulty: form.difficulty,
        needsHelp: form.needsHelp,
        childNote: form.childNote.trim() || undefined
      });
      setTask(result.task);
      setMessage('已提交，等待家长确认。');
    } catch (completionError) {
      if (isConflict(completionError)) {
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else {
        setError(errorMessage(completionError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!task && resource.state === 'loading') return <FamilyDataState state="loading" />;
  if (!task && resource.state === 'retryable_error') {
    return <FamilyDataState state="retryable_error" onRetry={resource.reload} />;
  }
  if (!task && resource.state === 'error') return <FamilyDataState state="error" error={resource.error} />;
  if (!task) return <FamilyDataState state="empty" />;

  return (
    <section className="child-page child-task-page" aria-labelledby="child-task-title">
      <Link className="child-back-link" to="/child/today">返回今天</Link>
      <div className="child-page-heading">
        <div>
          <span className={`child-dimension is-${task.dimension}`}>{DIMENSION_LABELS[task.dimension] || task.dimension}</span>
          <h1 id="child-task-title">{task.title}</h1>
          <p>{STATUS_LABELS[task.status] || task.status}</p>
        </div>
      </div>

      <section className="child-section" aria-labelledby="task-plan-title">
        <h2 id="task-plan-title">任务安排</h2>
        {task.description && <p>{task.description}</p>}
        <dl className="child-detail-list">
          <div><dt>领域</dt><dd>{task.area || '未填写'}</dd></div>
          <div><dt>截止日期</dt><dd>{task.dueDate}</dd></div>
          {task.estimatedMinutes !== undefined && <div><dt>预计用时</dt><dd>{task.estimatedMinutes} 分钟</dd></div>}
          {task.targetAmount !== undefined && <div><dt>目标</dt><dd>{task.targetAmount} {task.unit || ''}</dd></div>}
        </dl>
        {task.attachmentMediaIds?.length > 0 && (
          <PrivateMediaCollectionField
            label="任务附件"
            purpose="task_attachment"
            values={task.attachmentMediaIds}
            readOnly
            ownScope
            className="child-media-field"
            controlClassName="child-secondary-button"
            getPrivateMediaAccess={getOwnPrivateMediaAccess}
          />
        )}
      </section>

      {message && <p className="child-success-message" role="status">{message}</p>}
      {error && <p className="child-form-error" role="alert">{error}</p>}

      {task.status === 'pending' && (
        <section className="child-section" aria-labelledby="task-completion-title">
          <h2 id="task-completion-title">记录完成情况</h2>
          <form className="child-form" onSubmit={submitCompletion}>
            <label>实际用时（分钟）<input type="number" min="0" value={form.actualMinutes} onChange={updateField('actualMinutes')} /></label>
            <label>实际完成数量<input type="number" min="0" value={form.actualAmount} onChange={updateField('actualAmount')} /></label>
            <label>完成难度<select value={form.difficulty} onChange={updateField('difficulty')}><option value="easy">轻松</option><option value="normal">刚刚好</option><option value="hard">有挑战</option></select></label>
            <label className="child-checkbox"><input type="checkbox" checked={form.needsHelp} onChange={updateField('needsHelp')} />我需要帮助</label>
            <label>我的一句话<textarea maxLength={200} value={form.childNote} onChange={updateField('childNote')} /></label>
            <button type="submit" className="child-primary-button" disabled={submitting}>
              {submitting ? '正在提交...' : '提交完成情况'}
            </button>
          </form>
        </section>
      )}
    </section>
  );
};

export default ChildTaskPage;
