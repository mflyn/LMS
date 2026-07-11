import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaField from '../../components/family/PrivateMediaField';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildResource } from '../../hooks/useChildResource';
import {
  cancelOrArchiveGrowthTask,
  completeGrowthTask,
  confirmGrowthTask,
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

const TasksPage = () => {
  const { selectedChild, selectedChildId } = useFamily();
  const [filters, setFilters] = useState({ scope: '', dimension: '', status: '' });
  const load = useCallback(
    ({ childId, signal }) => listGrowthTasks({ childId, ...filters, pageSize: 100 }, signal),
    [filters]
  );
  const resource = useChildResource({ load });
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [action, setAction] = useState(null);
  const [actionForm, setActionForm] = useState({ actualMinutes: '', actualAmount: '', difficulty: 'normal', needsHelp: false, childNote: '', parentFeedback: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (resource.data?.items) setItems(resource.data.items);
    if (resource.state === 'empty') setItems([]);
  }, [resource.data, resource.state]);

  useEffect(() => {
    setEditor(null);
    setAction(null);
    setMessage('');
    setError('');
  }, [selectedChildId]);

  const replaceTask = (nextTask) => {
    setItems((current) => {
      const exists = current.some((item) => item.taskId === nextTask.taskId);
      return exists
        ? current.map((item) => (item.taskId === nextTask.taskId ? nextTask : item))
        : [nextTask, ...current];
    });
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditor({ mode: 'create' });
    setError('');
  };

  const openEdit = (task) => {
    setForm({ ...emptyForm(), ...task, attachmentMediaIds: task.attachmentMediaIds || [] });
    setEditor({ mode: 'edit', task });
    setError('');
  };

  const saveTask = async (event) => {
    event.preventDefault();
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
      replaceTask(result.task);
      setEditor(null);
      setMessage(editor.mode === 'create' ? '任务已创建。' : '任务已更新。');
    } catch (taskError) {
      if (errorCode(taskError) === 'TASK_STATE_CONFLICT') {
        setEditor(null);
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else {
        setError(errorMessage(taskError));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitAction = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let result;
      if (action.type === 'complete') {
        result = await completeGrowthTask(action.task.taskId, {
          actualMinutes: numeric(actionForm.actualMinutes),
          actualAmount: numeric(actionForm.actualAmount),
          difficulty: actionForm.difficulty,
          needsHelp: actionForm.needsHelp,
          childNote: actionForm.childNote || undefined
        });
      } else if (action.type === 'confirm') {
        result = await confirmGrowthTask(action.task.taskId, { parentFeedback: actionForm.parentFeedback || undefined });
      } else {
        result = await cancelOrArchiveGrowthTask(action.task.taskId);
      }
      replaceTask(result.task);
      setAction(null);
      if (result.starAward?.amount) setMessage(`已发放 ${result.starAward.amount} 颗星`);
      else setMessage('任务状态已更新。');
    } catch (taskError) {
      if (errorCode(taskError) === 'TASK_STATE_CONFLICT') {
        setAction(null);
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else setError(errorMessage(taskError));
    } finally {
      setBusy(false);
    }
  };

  const openAction = (type, task) => {
    setAction({ type, task });
    setActionForm({ actualMinutes: '', actualAmount: '', difficulty: 'normal', needsHelp: false, childNote: '', parentFeedback: '' });
    setError('');
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;

  return (
    <section className="family-page family-page-wide" aria-labelledby="tasks-page-title">
      <div className="family-page-heading">
        <div><p className="family-eyebrow">{selectedChild.name}的成长安排</p><h1 id="tasks-page-title">任务</h1></div>
        <button type="button" className="family-button primary" onClick={openCreate}>新建任务</button>
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
      {resource.state !== 'loading' && resource.state !== 'retryable_error' && items.length === 0 && <p className="family-empty-copy">暂无成长任务</p>}

      <div className="family-record-list">
        {items.map((item) => (
          <article className="family-record" key={item.taskId}>
            <div className="family-record-main">
              <div className="family-inline-actions"><span className={`family-dimension is-${item.dimension}`}>{DIMENSIONS.find(([value]) => value === item.dimension)?.[1]}</span><span>{STATUS_LABELS[item.status] || item.status}</span></div>
              <h2>{item.title}</h2>
              <p>{item.area} · 截止 {item.dueDate}</p>
            </div>
            <div className="family-inline-actions">
              {item.status === 'pending' && <button type="button" className="family-button secondary" aria-label={`编辑 ${item.title}`} onClick={() => openEdit(item)}>编辑</button>}
              {item.status === 'pending' && <button type="button" className="family-button secondary" aria-label={`完成 ${item.title}`} onClick={() => openAction('complete', item)}>完成</button>}
              {item.status === 'completed' && <button type="button" className="family-button primary" aria-label={`确认 ${item.title}`} onClick={() => openAction('confirm', item)}>确认</button>}
              {!['cancelled', 'archived'].includes(item.status) && <button type="button" className="family-button secondary" aria-label={`${item.status === 'pending' ? '取消' : '归档'} ${item.title}`} onClick={() => openAction('remove', item)}>{item.status === 'pending' ? '取消' : '归档'}</button>}
            </div>
          </article>
        ))}
      </div>

      {editor && (
        <section className="family-dialog" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
          <form onSubmit={saveTask}>
            <div className="family-page-heading"><h2 id="task-editor-title">{editor.mode === 'create' ? '新建任务' : '编辑任务'}</h2><button type="button" className="family-button secondary" onClick={() => setEditor(null)}>关闭</button></div>
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
            <PrivateMediaField label="任务附件" childId={selectedChildId} purpose="task_attachment" value={form.attachmentMediaIds[0] || null} onChange={(mediaId) => setForm((value) => ({ ...value, attachmentMediaIds: mediaId ? [mediaId] : [] }))} />
            <button type="submit" className="family-button primary" disabled={busy}>保存任务</button>
          </form>
        </section>
      )}

      {action && (
        <section className="family-dialog" role="dialog" aria-modal="true" aria-labelledby="task-action-title">
          <form onSubmit={submitAction}>
            <div className="family-page-heading"><h2 id="task-action-title">{action.type === 'complete' ? '记录完成' : action.type === 'confirm' ? '家长确认' : action.task.status === 'pending' ? '取消任务' : '归档任务'}</h2><button type="button" className="family-button secondary" onClick={() => setAction(null)}>关闭</button></div>
            {action.type === 'complete' && <div className="family-form-grid"><label>实际用时（分钟）<input type="number" min="0" value={actionForm.actualMinutes} onChange={(event) => setActionForm((value) => ({ ...value, actualMinutes: event.target.value }))} /></label><label>实际数量<input type="number" min="0" value={actionForm.actualAmount} onChange={(event) => setActionForm((value) => ({ ...value, actualAmount: event.target.value }))} /></label><label>难度<select value={actionForm.difficulty} onChange={(event) => setActionForm((value) => ({ ...value, difficulty: event.target.value }))}><option value="easy">简单</option><option value="normal">适中</option><option value="hard">困难</option></select></label><label className="family-checkbox"><input type="checkbox" checked={actionForm.needsHelp} onChange={(event) => setActionForm((value) => ({ ...value, needsHelp: event.target.checked }))} />需要帮助</label><label className="family-field-wide">孩子备注<textarea value={actionForm.childNote} onChange={(event) => setActionForm((value) => ({ ...value, childNote: event.target.value }))} /></label></div>}
            {action.type === 'confirm' && <label>家长反馈<textarea aria-label="家长反馈" value={actionForm.parentFeedback} onChange={(event) => setActionForm((value) => ({ ...value, parentFeedback: event.target.value }))} /></label>}
            <button type="submit" className="family-button primary" disabled={busy}>{action.type === 'complete' ? '提交完成记录' : action.type === 'confirm' ? '确认并发放星星' : `确认${action.task.status === 'pending' ? '取消' : '归档'}`}</button>
          </form>
        </section>
      )}
    </section>
  );
};

export default TasksPage;
