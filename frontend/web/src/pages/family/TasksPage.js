import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import TaskCompletionReview from '../../components/family/TaskCompletionReview';
import CompletionRecoveryList from '../../components/family/CompletionRecoveryList';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import { captureSession } from '../../services/familySession';
import {
  cancelOrArchiveGrowthTask,
  createGrowthTask,
  listGrowthTasks,
  updateGrowthTask
} from '../../services/familyApi';

const DIMENSIONS = [
  ['moral', '德育'],
  ['academic', '智育'],
  ['physical', '体育'],
  ['artistic', '美育'],
  ['labor', '劳育']
];
const STATUS_LABELS = {
  pending: '待完成',
  completed: '待家长确认',
  confirmed: '已确认',
  cancelled: '已取消',
  archived: '已归档'
};

const emptyForm = () => ({
  dimension: 'academic',
  subject: '',
  area: '',
  title: '',
  taskType: 'practice',
  description: '',
  dueDate: '',
  estimatedMinutes: '',
  targetAmount: '',
  unit: '',
  priority: 'medium',
  attachmentMediaIds: []
});

const numeric = (value) => (value === '' ? undefined : Number(value));
const errorCode = (error) => error?.response?.data?.error?.code;
const errorMessage = (error) => error?.response?.data?.error?.message || error?.message || '操作失败，请重试。';

const ScopedTasksPage = () => {
  const { family, selectedChild, selectedChildId, childScopeVersion } = useFamily();
  const [filters, setFilters] = useState({ scope: '', dimension: '', status: '' });
  const load = useCallback(
    ({ childId, signal }) => listGrowthTasks({ childId, ...filters, pageSize: 100 }, signal),
    [filters]
  );
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const mediaDrafts = useDraftMedia();
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [action, setAction] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (resource.data?.items) setItems(resource.data.items);
    if (resource.state === 'empty') setItems([]);
  }, [resource.data, resource.state]);

  useEffect(() => {
    mediaDrafts.cancel();
    setEditor(null);
    setAction(null);
    setReview(null);
    setMessage('');
    setError('');
    setBusy(false);
  }, [mediaDrafts, selectedChildId]);

  const closeEditor = () => {
    mediaDrafts.cancel();
    setEditor(null);
  };

  const replaceTask = useCallback((nextTask) => {
    setItems((current) => {
      const exists = current.some((item) => item.taskId === nextTask.taskId);
      return exists
        ? current.map((item) => (item.taskId === nextTask.taskId ? nextTask : item))
        : [nextTask, ...current];
    });
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setEditor({ mode: 'create' });
    setError('');
  };

  const openEdit = (task) => {
    if (task.childId !== selectedChildId) return;
    setForm({ ...emptyForm(), ...task, attachmentMediaIds: task.attachmentMediaIds || [] });
    setEditor({ mode: 'edit', task });
    setError('');
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (editor?.mode === 'edit' && editor.task.childId !== selectedChildId) return;
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    setMessage('');
    const payload = {
      dimension: form.dimension,
      area: form.area,
      title: form.title,
      taskType: form.taskType,
      description: form.description || undefined,
      dueDate: form.dueDate,
      estimatedMinutes: numeric(form.estimatedMinutes),
      targetAmount: numeric(form.targetAmount),
      unit: form.unit || undefined,
      priority: form.priority,
      attachmentMediaIds: form.attachmentMediaIds
    };
    if (form.dimension === 'academic') payload.subject = form.subject;
    try {
      const result = editor.mode === 'create'
        ? await createGrowthTask({ childId: selectedChildId, ...payload })
        : await updateGrowthTask(editor.task.taskId, payload);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      mediaDrafts.commit();
      replaceTask(result.task);
      setEditor(null);
      setMessage(editor.mode === 'create' ? '任务已创建。' : '任务已更新。');
    } catch (taskError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      if (errorCode(taskError) === 'TASK_STATE_CONFLICT') {
        setEditor(null);
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else {
        setError(errorMessage(taskError));
      }
    } finally {
      if (mutationGuard.isCurrentScope(mutationScope)) setBusy(false);
    }
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (!action || action.task.childId !== selectedChildId) return;
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    try {
      const result = await cancelOrArchiveGrowthTask(action.task.taskId);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      replaceTask(result.task);
      setAction(null);
      if (result.starAward?.amount) setMessage(`已发放 ${result.starAward.amount} 颗星`);
      else setMessage('任务状态已更新。');
    } catch (taskError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      if (errorCode(taskError) === 'TASK_STATE_CONFLICT') {
        setAction(null);
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else setError(errorMessage(taskError));
    } finally {
      if (mutationGuard.isCurrentScope(mutationScope)) setBusy(false);
    }
  };

  const openAction = (type, task) => {
    if (task.childId !== selectedChildId) return;
    if (type === 'complete' || type === 'confirm' || type === 'review') {
      setReview({ taskId: task.taskId, childId: selectedChildId, mode: type === 'complete' ? 'complete' : 'review' });
      return;
    }
    setAction({ type, task });
    setError('');
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;

  return (
    <section className="family-page family-page-wide" aria-labelledby="tasks-page-title">
      <div className="family-page-heading">
        <div><p className="family-eyebrow">{selectedChild.name}的成长安排</p><h1 id="tasks-page-title">任务</h1></div>
        <button type="button" className="family-button primary" disabled={resource.state === 'loading'} onClick={openCreate}>新建任务</button>
      </div>

      <div className="family-filter-bar" aria-label="任务筛选">
        <label>时间范围<select value={filters.scope} onChange={(event) => setFilters((value) => ({ ...value, scope: event.target.value }))}><option value="">全部</option><option value="today">今天</option><option value="week">本周</option></select></label>
        <label>筛选维度<select value={filters.dimension} onChange={(event) => setFilters((value) => ({ ...value, dimension: event.target.value }))}><option value="">全部</option>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>任务状态<select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><option value="">全部</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      {message && <p className="family-success-message" role="status">{message}</p>}
      {error && <p className="family-form-error" role="alert">{error}</p>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'retryable_error', 'error'].includes(resource.state) && items.length === 0 && <p className="family-empty-copy">暂无成长任务</p>}

      <div className="family-record-list">
        {items.map((item) => (
          <article className="family-record" key={item.taskId}>
            <div className="family-record-main">
              <div className="family-inline-actions"><span className={`family-dimension is-${item.dimension}`}>{DIMENSIONS.find(([value]) => value === item.dimension)?.[1]}</span><span>{STATUS_LABELS[item.status] || item.status}</span></div>
              <h2>{item.title}</h2>
              <p>{item.area} · 截止 {item.dueDate}</p>
            </div>
            <div className="family-inline-actions">
              <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`查看 ${item.title}`} onClick={() => openAction('review', item)}>查看作品</button>
              {item.status === 'pending' && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`编辑 ${item.title}`} onClick={() => openEdit(item)}>编辑</button>}
              {item.status === 'pending' && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`完成 ${item.title}`} onClick={() => openAction('complete', item)}>完成</button>}
              {item.status === 'completed' && <button type="button" className="family-button primary" disabled={resource.state === 'loading'} aria-label={`确认 ${item.title}`} onClick={() => openAction('confirm', item)}>确认</button>}
              {!['cancelled', 'archived'].includes(item.status) && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`${item.status === 'pending' ? '取消' : '归档'} ${item.title}`} onClick={() => openAction('remove', item)}>{item.status === 'pending' ? '取消' : '归档'}</button>}
            </div>
          </article>
        ))}
      </div>

      <CompletionRecoveryList role="parent" childId={selectedChildId}
        onOpen={row => setReview({ taskId: row.taskId, childId: row.childId, mode: 'review' })} />
      {review && review.childId === selectedChildId && (
        <TaskCompletionReview key={`${family?.familyId}-${selectedChildId}-${childScopeVersion}-${review.taskId}`}
          taskId={review.taskId} familyId={family?.familyId} childId={selectedChildId}
          initialMode={review.mode} onClose={() => setReview(null)} onTask={replaceTask} />
      )}

      {editor && (
        <FamilyDialog labelledBy="task-editor-title" onClose={closeEditor}>
          <form onSubmit={saveTask}>
            <div className="family-page-heading"><h2 id="task-editor-title">{editor.mode === 'create' ? '新建任务' : '编辑任务'}</h2><button type="button" className="family-button secondary" onClick={closeEditor}>关闭</button></div>
            <div className="family-form-grid">
              <label>成长维度<select value={form.dimension} onChange={(event) => setForm((value) => ({ ...value, dimension: event.target.value }))}>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {form.dimension === 'academic' && <label>学科<input required value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} /></label>}
              <label>任务标题<input required value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
              <label>活动领域<input required value={form.area} onChange={(event) => setForm((value) => ({ ...value, area: event.target.value }))} /></label>
              <label>截止日期<input required type="date" value={form.dueDate} onChange={(event) => setForm((value) => ({ ...value, dueDate: event.target.value }))} /></label>
              <label>任务类型<select value={form.taskType} onChange={(event) => setForm((value) => ({ ...value, taskType: event.target.value }))}><option value="practice">练习</option><option value="exercise">锻炼</option><option value="habit">习惯</option><option value="reading">阅读</option><option value="chore">劳动</option></select></label>
              <label>预计用时（分钟）<input type="number" min="0" value={form.estimatedMinutes} onChange={(event) => setForm((value) => ({ ...value, estimatedMinutes: event.target.value }))} /></label>
              <label>目标数量<input type="number" min="0" value={form.targetAmount} onChange={(event) => setForm((value) => ({ ...value, targetAmount: event.target.value }))} /></label>
              <label>单位<input value={form.unit} onChange={(event) => setForm((value) => ({ ...value, unit: event.target.value }))} /></label>
              <label>优先级<select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
            </div>
            <label className="family-field-wide">说明<textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
            <PrivateMediaCollectionField label="任务附件" childId={selectedChildId} purpose="task_attachment" values={form.attachmentMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onChange={(mediaIds) => setForm((value) => ({ ...value, attachmentMediaIds: mediaIds }))} />
            <button type="submit" className="family-button primary" disabled={busy || resource.state === 'loading'}>保存任务</button>
          </form>
        </FamilyDialog>
      )}

      {action && (
        <FamilyDialog labelledBy="task-action-title" onClose={() => setAction(null)}>
          <form onSubmit={submitAction}>
            <div className="family-page-heading"><h2 id="task-action-title">{action.task.status === 'pending' ? '取消任务' : '归档任务'}</h2><button type="button" className="family-button secondary" onClick={() => setAction(null)}>关闭</button></div>
            <button type="submit" className="family-button primary" disabled={busy || resource.state === 'loading'}>{`确认${action.task.status === 'pending' ? '取消' : '归档'}`}</button>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

const TasksPage = () => {
  const { family, selectedChildId, childScopeVersion } = useFamily();
  const session = captureSession('parent');
  return <ScopedTasksPage key={JSON.stringify([family?.familyId, selectedChildId, childScopeVersion,
    session?.actorId, session?.revision])} />;
};

export default TasksPage;
