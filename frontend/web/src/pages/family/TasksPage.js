import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import TaskCompletionReview from '../../components/family/TaskCompletionReview';
import TaskHelpPanel, { HELP_LABELS } from '../../components/family/TaskHelpPanel';
import CompletionRecoveryList from '../../components/family/CompletionRecoveryList';
import TaskChecklistEditor, { checklistForForm } from '../../components/family/TaskChecklistEditor';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import {
  cancelOrArchiveGrowthTask,
  createGrowthTask,
  getGrowthTask,
  getMistake,
  listGrowthTasks,
  updateGrowthTask
} from '../../services/familyApi';
import { assertLearningScope, isLearningId, isLearningDenied, learningReadMessage } from '../../services/learningSources';

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
  attachmentMediaIds: [],
  checklistSnapshot: []
});

const numeric = (value) => (value === '' ? undefined : Number(value));
const formFromTask = task => ({
  ...Object.fromEntries(Object.entries(emptyForm()).map(([key, fallback]) => [key, task[key] ?? fallback])),
  checklistSnapshot: checklistForForm(task.checklistSnapshot)
});
const errorCode = (error) => error?.response?.data?.error?.code;
const errorMessage = (error) => error?.response?.data?.error?.message || error?.message || '操作失败，请重试。';

const ScopedTasksPage = () => {
  const { family, selectedChild, selectedChildId, childScopeVersion } = useFamily();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => {
    const helpStatus = new URLSearchParams(location.search).get('helpStatus');
    return { scope: '', dimension: '', status: '', helpStatus: ['pending', 'resolved'].includes(helpStatus) ? helpStatus : '' };
  });
  const [page, setPage] = useState(1);
  const changeFilter = (field, value) => {
    denied.current = false;
    setPage(1);
    setFilters(current => ({ ...current, [field]: value,
      ...(field === 'helpStatus' && value ? { scope: '', status: '' } : {}) }));
  };
  const load = useCallback(
    ({ childId, signal }) => listGrowthTasks({ childId, ...filters, page, pageSize: 20 }, signal),
    [filters, page]
  );
  const resource = useChildResource({ load });
  const helpAccessDenied = [401, 403].includes(resource.error?.response?.status);
  const mutationGuard = useChildMutationGuard();
  const ownerSession = useRef(captureSession('parent'));
  const denied = useRef(false);
  const canDeleteDraft = useCallback(() => isSessionCurrent(ownerSession.current) && !denied.current, []);
  const mediaDrafts = useDraftMedia({ canDelete: canDeleteDraft });
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [action, setAction] = useState(null);
  const [review, setReview] = useState(null);
  const [helpTask, setHelpTask] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [privateBlocked, setPrivateBlocked] = useState(false);
  const [sourceTarget, setSourceTarget] = useState(null);
  const [savedTaskId, setSavedTaskId] = useState(null);
  const editorGeneration = useRef(0);
  const writing = useRef(false);
  useEffect(() => () => { editorGeneration.current += 1; }, []);

  const clearPrivateEditor = useCallback(() => {
    editorGeneration.current += 1;
    writing.current = false;
    denied.current = true;
    mediaDrafts.cancel();
    setItems([]); setEditor(null); setForm(emptyForm()); setAction(null); setReview(null); setHelpTask(null);
    setSourceTarget(null); setSavedTaskId(null); setMessage('');
    setBusy(false); setMediaBusy(false); setPrivateBlocked(true);
  }, [mediaDrafts]);

  useEffect(() => {
    if (helpAccessDenied) clearPrivateEditor();
  }, [helpAccessDenied, clearPrivateEditor]);

  useEffect(() => {
    if (denied.current) return;
    if (resource.data?.items) setItems(resource.data.items);
    if (resource.state === 'empty') setItems([]);
    if (['ready', 'empty'].includes(resource.state)) setPrivateBlocked(false);
  }, [resource.data, resource.state]);

  useEffect(() => {
    if (!['ready', 'empty'].includes(resource.state) || !Number.isInteger(resource.data?.total)) return;
    const lastPage = Math.max(1, Math.ceil(resource.data.total / 20));
    if (page > lastPage) setPage(lastPage);
  }, [resource.state, resource.data, page]);

  useEffect(() => {
    mediaDrafts.cancel();
    setEditor(null);
    setAction(null);
    setReview(null);
    setMessage('');
    setError('');
    setBusy(false);
  }, [mediaDrafts, selectedChildId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('taskId'), childId = params.get('childId');
    if (!taskId || (childId && childId !== selectedChildId) || !isLearningId(taskId)
      || !isSessionCurrent(ownerSession.current) || privateBlocked || helpAccessDenied) return;
    setReview({ taskId, childId: selectedChildId, mode: 'review' });
    params.delete('taskId'); params.delete('childId');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate, selectedChildId, privateBlocked, helpAccessDenied]);

  const readSource = async target => {
    if (writing.current || privateBlocked || !isSessionCurrent(ownerSession.current)) return;
    const scope = mutationGuard.captureScope(), generation = ++editorGeneration.current;
    const current = () => generation === editorGeneration.current && isSessionCurrent(ownerSession.current)
      && mutationGuard.isCurrentScope(scope);
    setSourceTarget(target); setEditor(null); setReview(null); setAction(null); setHelpTask(null);
    setForm(emptyForm()); setError(''); setBusy(true); writing.current = true;
    try {
      const isTask = target.field === 'sourceTaskId';
      const result = isTask ? await getGrowthTask(target.id) : await getMistake(target.id);
      if (!current()) return;
      const source = assertLearningScope(isTask ? result.task : result.mistake,
        isTask ? 'taskId' : 'mistakeId', target.id, family?.familyId, selectedChildId);
      const title = isTask ? source.title : source.knowledgePointName || source.subject;
      setForm({ ...emptyForm(), subject: source.subject || '', title: `${title || '错题'}订正`,
        area: '错题订正', taskType: '错题订正' });
      setEditor({ mode: 'create', source: { [target.field]: target.id }, sourceTitle: title });
      setSourceTarget(null);
    } catch (cause) {
      if (!current()) return;
      if (isLearningDenied(cause)) clearPrivateEditor();
      setError(learningReadMessage(cause));
    } finally { if (current()) { writing.current = false; setBusy(false); } }
  };
  const readSourceRef = useRef(readSource); readSourceRef.current = readSource;
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fields = ['sourceTaskId', 'sourceMistakeId'].filter(field => params.has(field));
    if (!fields.length) return;
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
    if (fields.length !== 1 || !isLearningId(params.get(fields[0])) || params.has('taskId')
      || (params.has('childId') && params.get('childId') !== selectedChildId)) {
      clearPrivateEditor(); setError('当前身份无法读取此记录。'); return;
    }
    readSourceRef.current({ field: fields[0], id: params.get(fields[0]).toLowerCase() });
  }, [location.pathname, location.search, navigate, selectedChildId, clearPrivateEditor]);

  const closeEditor = () => {
    editorGeneration.current += 1;
    writing.current = false;
    setBusy(false);
    setMediaBusy(false);
    mediaDrafts.cancel();
    setEditor(null);
    setSourceTarget(null);
    setForm(emptyForm());
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
    if (writing.current || sourceTarget) return;
    editorGeneration.current += 1;
    setForm(emptyForm());
    setEditor({ mode: 'create' });
    setError('');
  };

  const openEdit = (task) => {
    if (task.childId !== selectedChildId) return;
    editorGeneration.current += 1;
    setForm(formFromTask(task));
    setEditor({ mode: 'edit', task });
    setError('');
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (!editor || writing.current || mediaBusy || editor.recovery || privateBlocked) return;
    if (editor?.mode === 'edit' && editor.task.childId !== selectedChildId) return;
    const mutationScope = mutationGuard.captureScope();
    const session = captureSession('parent'), generation = ++editorGeneration.current;
    const current = () => generation === editorGeneration.current && isSessionCurrent(session)
      && mutationGuard.isCurrentScope(mutationScope);
    const checklist = checklistForForm(form.checklistSnapshot).map(item => ({ ...item, label: item.label.trim() }));
    if (checklist.some(item => !item.label || item.label.length > 100)) {
      setError('检查项应为 1 至 100 字。'); return;
    }
    writing.current = true;
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
      priority: form.priority
    };
    if (editor.mode === 'create' && editor.source) Object.assign(payload, editor.source);
    if (editor.mode === 'create'
      || JSON.stringify(form.attachmentMediaIds) !== JSON.stringify(editor.task.attachmentMediaIds || [])) {
      payload.attachmentMediaIds = form.attachmentMediaIds;
    }
    if (form.dimension === 'academic') payload.subject = form.subject;
    if (editor.mode === 'create' || JSON.stringify(checklist) !== JSON.stringify(checklistForForm(editor.task.checklistSnapshot))) {
      payload.checklistSnapshot = checklist;
      if (editor.mode === 'edit') payload.expectedChecklistVersion = editor.task.checklistVersion ?? 0;
    }
    mediaDrafts.retainSubmitted();
    try {
      const result = editor.mode === 'create'
        ? await createGrowthTask({ childId: selectedChildId, ...payload })
        : await updateGrowthTask(editor.task.taskId, payload);
      if (!current()) return;
      mediaDrafts.commit();
      replaceTask(result.task);
      setSavedTaskId(result.task.taskId);
      setEditor(null);
      setMessage(editor.mode === 'create' ? '任务已创建。' : '任务已更新。');
    } catch (taskError) {
      if (!current()) return;
      if ([401, 403].includes(taskError?.response?.status)) {
        clearPrivateEditor(); setError('当前账号无法继续查看或修改此任务。'); resource.reload(); return;
      }
      if (errorCode(taskError) === 'TASK_STATE_CONFLICT') {
        setEditor(null);
        setMessage('任务状态已变化，已重新加载。');
        resource.reload();
      } else if (errorCode(taskError) === 'VERSION_CONFLICT' || errorCode(taskError) === 'RESOURCE_CONFLICT') {
        setEditor(previous => ({ ...previous, recovery: { kind: 'conflict', taskId: editor.task?.taskId } }));
        setError('任务已被修改，请重新读取后再编辑。');
      } else if (errorCode(taskError) === 'SOURCE_SERVICE_UNAVAILABLE') {
        if (editor.mode === 'create') form.attachmentMediaIds.forEach(id => mediaDrafts.replace(id));
        setError('来源服务暂不可用，本次尚未保存，可手动重试。');
      } else if (!taskError?.response || taskError.response.status >= 500) {
        const taskId = editor.task?.taskId || taskError?.response?.data?.error?.details?.resourceId;
        const requestedMaterials = Object.prototype.hasOwnProperty.call(payload, 'attachmentMediaIds');
        setEditor(previous => ({ ...previous, recovery: { kind: 'unknown', taskId,
          payload: editor.mode === 'create' ? { attachmentMediaIds: [...payload.attachmentMediaIds] } : payload,
          canResume: Boolean(taskId) && (requestedMaterials || errorCode(taskError) === 'MEDIA_REFERENCE_PENDING') } }));
        setError('保存结果尚未确认，已保留本次修改。请先重新读取任务。');
      } else {
        setError(errorMessage(taskError));
      }
    } finally {
      if (current()) { writing.current = false; setBusy(false); }
    }
  };

  const readEditor = async (resume = false) => {
    const recovery = editor?.recovery;
    if (!recovery || writing.current || privateBlocked) return;
    if (!recovery.taskId) { closeEditor(); resource.reload(); setMessage('请核对任务列表，避免重复新建。'); return; }
    const mutationScope = mutationGuard.captureScope(), session = captureSession('parent');
    const generation = ++editorGeneration.current;
    const current = () => generation === editorGeneration.current && isSessionCurrent(session)
      && mutationGuard.isCurrentScope(mutationScope);
    writing.current = true; setBusy(true); setError('');
    try {
      const result = resume && recovery.canResume
        ? await updateGrowthTask(recovery.taskId, recovery.payload)
        : await getGrowthTask(recovery.taskId);
      if (!current()) return;
      if (!result.task || result.task.childId !== selectedChildId || result.task.familyId !== family?.familyId) {
        clearPrivateEditor(); setError('任务身份无法校验，请重新读取任务列表。'); return;
      }
      replaceTask(result.task);
      if (resume) { mediaDrafts.commit(); setEditor(null); setForm(emptyForm()); setMessage('本次修改已恢复。'); return; }
      if (result.task.status !== 'pending') { closeEditor(); setMessage('任务状态已变化，已重新读取。'); return; }
      if (recovery.canResume) {
        setMessage('已读取当前任务；材料修改可能仍在处理中，可继续原修改。');
        return;
      }
      mediaDrafts.cancel();
      setForm(formFromTask(result.task));
      setEditor({ mode: 'edit', task: result.task });
      setMessage('已读取最新任务，请核对后再编辑。');
    } catch (cause) {
      if (!current()) return;
      if ([401, 403].includes(cause?.response?.status)) {
        clearPrivateEditor(); setError('当前账号无法继续查看或修改此任务。'); resource.reload(); return;
      }
      if (resume && ['VERSION_CONFLICT', 'RESOURCE_CONFLICT', 'TASK_STATE_CONFLICT'].includes(errorCode(cause))) {
        setEditor(previous => ({ ...previous, recovery: { kind: 'conflict', taskId: recovery.taskId } }));
        setError('原修改已不能接续，请重新读取当前任务。');
      } else setError(errorMessage(cause));
    } finally { if (current()) { writing.current = false; setBusy(false); } }
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
      if (filters.helpStatus) resource.reload();
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

  const openAction = (type, task, trigger) => {
    if (task.childId !== selectedChildId) return;
    if (type === 'complete' || type === 'confirm' || type === 'review') {
      // Safari pointer activation does not focus buttons automatically.
      trigger?.focus();
      setReview({ taskId: task.taskId, childId: selectedChildId, mode: type === 'complete' ? 'complete' : 'review' });
      return;
    }
    setAction({ type, task });
    setError('');
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;
  const accessBlocked = privateBlocked || helpAccessDenied;
  const mediaGeneration = editorGeneration.current;
  const mediaCurrent = () => mediaGeneration === editorGeneration.current && !accessBlocked
    && isSessionCurrent(ownerSession.current);

  return (
    <section className="family-page family-page-wide" aria-labelledby="tasks-page-title">
      <div className="family-page-heading">
        <div>{!accessBlocked && <p className="family-eyebrow">{selectedChild.name}的成长安排</p>}<h1 id="tasks-page-title">任务</h1></div>
        <button type="button" className="family-button primary" disabled={accessBlocked || resource.state === 'loading'} onClick={openCreate}>新建任务</button>
      </div>

      <div className="family-filter-bar" aria-label="任务筛选">
        <label>时间范围<select value={filters.scope} onChange={(event) => changeFilter('scope', event.target.value)}><option value="">全部</option><option value="today">今天</option><option value="week">本周</option></select></label>
        <label>筛选维度<select value={filters.dimension} onChange={(event) => changeFilter('dimension', event.target.value)}><option value="">全部</option>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>任务状态<select value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="">全部</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>求助状态<select value={filters.helpStatus} onChange={(event) => changeFilter('helpStatus', event.target.value)}><option value="">全部</option><option value="pending">待处理求助</option><option value="resolved">已处理求助</option></select></label>
      </div>

      {message && !editor && <p className="family-success-message" role="status">{message}</p>}
      {error && !editor && <p className="family-form-error" role="alert">{error}</p>}
      {sourceTarget && !accessBlocked && <button type="button" className="family-button secondary" disabled={busy} onClick={() => readSource(sourceTarget)}>重试读取来源</button>}
      {savedTaskId && !editor && !accessBlocked && <button type="button" className="family-button secondary" onClick={() => setReview({ taskId: savedTaskId, childId: selectedChildId, mode: 'review' })}>查看已保存任务</button>}
      {accessBlocked && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'}
        onClick={() => { denied.current = false; resource.reload(); }}>重新读取任务</button>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!accessBlocked && !['loading', 'retryable_error', 'error'].includes(resource.state) && items.length === 0 && <p className="family-empty-copy">暂无成长任务</p>}

      <div className="family-record-list">
        {!accessBlocked && !['loading', 'retryable_error', 'error'].includes(resource.state) && items.map((item) => (
          <article className="family-record" key={item.taskId}>
            <div className="family-record-main">
              <div className="family-inline-actions"><span className={`family-dimension is-${item.dimension}`}>{DIMENSIONS.find(([value]) => value === item.dimension)?.[1]}</span><span>{STATUS_LABELS[item.status] || item.status}</span></div>
              <h2>{item.title}</h2>
              <p>{item.area} · 截止 {item.dueDate}</p>
              {item.helpRequest && <p>{item.helpRequest.status === 'pending' ? '待处理求助' : '求助已处理'} · {HELP_LABELS[item.helpRequest.helpType]}</p>}
            </div>
            <div className="family-inline-actions">
              <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`查看 ${item.title}`} onClick={event => openAction('review', item, event.currentTarget)}>查看作品</button>
              <button type="button" className="family-button secondary" aria-label={`求助 ${item.title}`} onClick={event => { event.currentTarget.focus(); setHelpTask(item.taskId); }}>求助</button>
              {item.status === 'pending' && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`编辑 ${item.title}`} onClick={() => openEdit(item)}>编辑</button>}
              {item.status === 'pending' && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`完成 ${item.title}`} onClick={event => openAction('complete', item, event.currentTarget)}>完成</button>}
              {item.status === 'completed' && <button type="button" className="family-button primary" disabled={resource.state === 'loading'} aria-label={`确认 ${item.title}`} onClick={event => openAction('confirm', item, event.currentTarget)}>确认</button>}
              {!['cancelled', 'archived'].includes(item.status) && <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`${item.status === 'pending' ? '取消' : '归档'} ${item.title}`} onClick={() => openAction('remove', item)}>{item.status === 'pending' ? '取消' : '归档'}</button>}
            </div>
          </article>
        ))}
      </div>

      <nav className="family-inline-actions" aria-label="任务分页">
        <button type="button" className="family-button secondary" aria-label="上一页任务" title="上一页任务"
          disabled={page <= 1 || resource.state === 'loading'} onClick={() => setPage(value => value - 1)}><LeftOutlined /></button>
        <span>第 {page} 页 · 共 {accessBlocked ? 0 : resource.data?.total ?? 0} 项</span>
        <button type="button" className="family-button secondary" aria-label="下一页任务" title="下一页任务"
          disabled={page * 20 >= (resource.data?.total ?? 0) || resource.state === 'loading'} onClick={() => setPage(value => value + 1)}><RightOutlined /></button>
      </nav>

      {helpTask && !accessBlocked && <FamilyDialog labelledBy="task-help-title" onClose={() => setHelpTask(null)}>
        <div className="family-page-heading"><h2 id="task-help-title">{selectedChild.name}的求助</h2>
          <button type="button" className="family-button secondary" onClick={() => setHelpTask(null)}>关闭</button></div>
        <TaskHelpPanel role="parent" taskId={helpTask} familyId={family?.familyId} childId={selectedChildId} onUpdated={resource.reload} />
      </FamilyDialog>}

      {!accessBlocked && <CompletionRecoveryList role="parent" childId={selectedChildId}
        onOpen={row => setReview({ taskId: row.taskId, childId: row.childId, mode: 'review' })} />}
      {!accessBlocked && review && review.childId === selectedChildId && (
        <TaskCompletionReview key={`${family?.familyId}-${selectedChildId}-${childScopeVersion}-${review.taskId}`}
          taskId={review.taskId} familyId={family?.familyId} childId={selectedChildId}
          initialMode={review.mode} onClose={() => setReview(null)} onTask={replaceTask} />
      )}

      {editor && !accessBlocked && (
        <FamilyDialog labelledBy="task-editor-title" onClose={closeEditor}>
          <form onSubmit={saveTask}>
            <div className="family-page-heading"><h2 id="task-editor-title">{editor.mode === 'create' ? '新建任务' : '编辑任务'}</h2><button type="button" className="family-button secondary" onClick={closeEditor}>关闭</button></div>
            {error && <p className="family-form-error" role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            {editor.sourceTitle && <p>订正来源：{editor.sourceTitle}</p>}
            {editor.recovery && <div className="family-inline-actions">
              <button type="button" className="family-button secondary" disabled={busy} onClick={() => readEditor()}>重新读取任务</button>
              {editor.recovery.canResume && <button type="button" className="family-button primary" disabled={busy}
                onClick={() => readEditor(true)}>继续原修改</button>}
            </div>}
            <fieldset className="task-editor-fields" disabled={busy || Boolean(editor.recovery)}>
            <div className="family-form-grid">
              <label>成长维度<select value={form.dimension} onChange={(event) => setForm((value) => ({ ...value, dimension: event.target.value }))}>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {form.dimension === 'academic' && <label>学科<input required value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} /></label>}
              <label>任务标题<input required value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
              <label>活动领域<input required value={form.area} onChange={(event) => setForm((value) => ({ ...value, area: event.target.value }))} /></label>
              <label>截止日期<input required type="date" value={form.dueDate} onChange={(event) => setForm((value) => ({ ...value, dueDate: event.target.value }))} /></label>
              <label>任务类型<select value={form.taskType} onChange={(event) => setForm((value) => ({ ...value, taskType: event.target.value }))}><option value="practice">练习</option><option value="错题订正">错题订正</option><option value="exercise">锻炼</option><option value="habit">习惯</option><option value="reading">阅读</option><option value="chore">劳动</option></select></label>
              <label>预计用时（分钟）<input type="number" min="0" value={form.estimatedMinutes} onChange={(event) => setForm((value) => ({ ...value, estimatedMinutes: event.target.value }))} /></label>
              <label>目标数量<input type="number" min="0" value={form.targetAmount} onChange={(event) => setForm((value) => ({ ...value, targetAmount: event.target.value }))} /></label>
              <label>单位<input value={form.unit} onChange={(event) => setForm((value) => ({ ...value, unit: event.target.value }))} /></label>
              <label>优先级<select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
            </div>
            <label className="family-field-wide">说明<textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
            <TaskChecklistEditor value={form.checklistSnapshot}
              onChange={checklistSnapshot => setForm(value => ({ ...value, checklistSnapshot }))} />
            <PrivateMediaCollectionField label="任务附件" childId={selectedChildId} purpose="task_attachment" values={form.attachmentMediaIds}
              onBusyChange={value => { if (mediaCurrent()) setMediaBusy(value); }}
              onUploaded={(...args) => { if (mediaCurrent()) mediaDrafts.replace(...args); }}
              onRemoved={(...args) => { if (mediaCurrent()) mediaDrafts.remove(...args); }}
              onChange={mediaIds => { if (mediaCurrent()) setForm(value => ({ ...value, attachmentMediaIds: mediaIds })); }} />
            <button type="submit" className="family-button primary" disabled={busy || mediaBusy || resource.state === 'loading'}>保存任务</button>
            </fieldset>
          </form>
        </FamilyDialog>
      )}

      {action && !accessBlocked && (
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
  const [, setSessionRevision] = useState(0);
  useEffect(() => subscribeSessionChanges(() => setSessionRevision(value => value + 1)), []);
  const session = captureSession('parent');
  if (!session) return <p role="alert">请重新登录后查看任务。</p>;
  return <ScopedTasksPage key={JSON.stringify([family?.familyId, selectedChildId, childScopeVersion,
    session?.actorId, session?.revision])} />;
};

export default TasksPage;
