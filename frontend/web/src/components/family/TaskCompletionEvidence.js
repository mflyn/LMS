import React, { useEffect, useId, useState } from 'react';
import { EditOutlined, ReloadOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons';
import TaskCompletionMedia from './TaskCompletionMedia';
import './TaskCompletionEvidence.css';

const STATUS = { pending: '待完成', completed: '等待家长确认', confirmed: '已确认', cancelled: '已取消', archived: '已归档' };
const DIFFICULTY = { easy: '轻松', normal: '刚刚好', hard: '有挑战' };
const evidenceFor = task => task.completionEvidence || task;
const formFor = task => {
  const evidence = evidenceFor(task);
  return { actualMinutes: evidence.actualMinutes ?? '', actualAmount: evidence.actualAmount ?? '',
    difficulty: evidence.difficulty || 'normal', needsHelp: evidence.needsHelp === true, childNote: evidence.childNote || '',
    checkedItemIds: [...(evidence.checkedItemIds || [])], completionMediaIds: [...task.completionMediaIds] };
};

const EvidenceBody = ({ controller, scopeKey, childId, mediaApi, allowEdit, onMediaBusyChange, grade, helpTargetId }) => {
  const { task } = controller;
  const headingId = useId();
  const [form, setForm] = useState(() => formFor(task));
  const [editing, setEditing] = useState(task.status === 'pending');
  const [mediaBusy, setMediaBusy] = useState(false);
  useEffect(() => {
    onMediaBusyChange?.(mediaBusy);
    return () => onMediaBusyChange?.(false);
  }, [mediaBusy, onMediaBusyChange]);
  const [inputError, setInputError] = useState('');
  const evidence = evidenceFor(task);
  const junior = grade === 1;
  const missingPriority = task.checklistSnapshot.some(item => item.required && !form.checkedItemIds.includes(item.itemId));
  const eligible = ['pending', 'completed'].includes(task.status);
  const showForm = allowEdit && eligible && editing && ['ready', 'sending'].includes(controller.state);
  const editable = allowEdit && eligible && controller.editable;
  const disabled = !editable || controller.busy || mediaBusy;
  const update = field => event => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm(previous => ({ ...previous, [field]: value }));
  };
  const submit = event => {
    event.preventDefault();
    if (disabled) return;
    const payload = { difficulty: form.difficulty, needsHelp: form.needsHelp, childNote: form.childNote.trim(),
      checkedItemIds: [...form.checkedItemIds], completionMediaIds: [...form.completionMediaIds] };
    for (const field of ['actualMinutes', 'actualAmount']) {
      if (form[field] === '') continue;
      const value = Number(form[field]);
      if (!Number.isFinite(value) || value < 0) { setInputError('实际用时和数量应为不小于 0 的数字。'); return; }
      payload[field] = value;
    }
    setInputError('');
    controller.submit(payload);
  };
  const media = (values, readOnly) => <TaskCompletionMedia
    values={values} onChange={completionMediaIds => setForm(previous => ({ ...previous, completionMediaIds }))}
    childId={childId} scopeKey={scopeKey} readOnly={readOnly}
    disabled={controller.busy || (!readOnly && !editable) || Boolean(controller.command) || controller.state !== 'ready'}
    uploadPrivateMedia={mediaApi.uploadPrivateMedia} getPrivateMediaAccess={mediaApi.getPrivateMediaAccess}
    deletePrivateMedia={mediaApi.deletePrivateMedia} onBusyChange={setMediaBusy}
  />;

  const optionalFields = <>
    <div className="task-completion-fields">
      <label>实际用时（分钟）<input type="number" min="0" step="any" value={form.actualMinutes} onChange={update('actualMinutes')} /></label>
      <label>实际完成数量<input type="number" min="0" step="any" value={form.actualAmount} onChange={update('actualAmount')} /></label>
    </div>
    <label>我的一句话<textarea maxLength={200} value={form.childNote} onChange={update('childNote')} /></label>
  </>;

  return <section className={`task-completion-evidence${junior ? ' task-completion-junior' : ''}`} aria-labelledby={headingId}>
    <div className="task-completion-heading"><h2 id={headingId}>完成情况</h2>
      <span className="task-completion-version">作品版本 {task.completionVersion}</span></div>
    <dl className="task-completion-facts">
      <div><dt>任务状态</dt><dd>{STATUS[task.status] || task.status}</dd></div>
      {['parent', 'student'].includes(evidence.submittedByActor?.role) && <div><dt>提交者</dt>
        <dd>{evidence.submittedByActor.role === 'parent' ? '家长代录' : '孩子本人提交'}</dd></div>}
      <div><dt>星星状态</dt><dd>{task.starAwardState === 'awarded' ? '星星已到账'
        : task.starAwardState === 'pending' ? '星星待到账' : task.starAwardState === 'not_applicable' ? '尚未发星' : '暂无发星记录'}</dd></div>
    </dl>
    {showForm ? <form className="task-completion-form" onSubmit={submit}>
      <fieldset disabled={disabled}>
        <legend>{task.status === 'completed' ? '修改本次完成' : '记录完成情况'}</legend>
        {grade === 4 && <p className="task-completion-copy">提交前，再看看题目、答案和作品是否一致。</p>}
        {task.checklistSnapshot.length > 0 && <div className="task-completion-checklist" role="group" aria-label="完成清单">
          {task.checklistSnapshot.map(row => <label key={row.itemId} className="task-completion-checkbox">
            <input type="checkbox" checked={form.checkedItemIds.includes(row.itemId)} onChange={event => {
              const checked = event.target.checked;
              setForm(previous => ({ ...previous, checkedItemIds: checked ? [...previous.checkedItemIds, row.itemId]
                : previous.checkedItemIds.filter(itemId => itemId !== row.itemId) }));
            }} />{row.label}{row.required ? '（重点项）' : ''}
          </label>)}
        </div>}
        {missingPriority && <p className="task-completion-reminder" role="status">还有重点项未勾选，可以如实提交。
          {helpTargetId && <> <a href={`#${helpTargetId}`}>需要帮助</a></>}</p>}
        <div className="task-completion-fields">
          <label>完成难度<select value={form.difficulty} onChange={update('difficulty')}>
            {Object.entries(DIFFICULTY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <label className="task-completion-checkbox"><input type="checkbox" checked={form.needsHelp} onChange={update('needsHelp')} />完成时需要帮助</label>
        {junior ? <details className="task-completion-optional"><summary>补充记录（选填）</summary>{optionalFields}</details> : optionalFields}
      </fieldset>
      <h3>完成作品</h3>{media(form.completionMediaIds, false)}
      {inputError && <p className="task-completion-error" role="alert">{inputError}</p>}
      <div className="task-completion-actions">
        <button type="submit" className="task-completion-primary" disabled={disabled}><SendOutlined aria-hidden="true" />
          {controller.state === 'sending' ? '正在提交...' : task.status === 'completed' ? '提交修改' : '提交完成情况'}</button>
        {task.status === 'completed' && <button type="button" disabled={disabled} onClick={() => {
          setForm(formFor(task)); setEditing(false); setInputError('');
        }}><UndoOutlined aria-hidden="true" />取消修改</button>}
      </div>
    </form> : <>
      {task.checklistSnapshot.length > 0 && <ul className="task-completion-checklist" aria-label="已提交清单">
        {task.checklistSnapshot.map(row => <li key={row.itemId}>{row.label}：{evidence.checkedItemIds?.includes(row.itemId) ? '已完成' : '未勾选'}</li>)}
      </ul>}
      <dl className="task-completion-facts">
        <div><dt>实际用时</dt><dd>{evidence.actualMinutes == null ? '未填写' : `${evidence.actualMinutes} 分钟`}</dd></div>
        <div><dt>实际完成数量</dt><dd>{evidence.actualAmount == null ? '未填写' : `${evidence.actualAmount} ${task.unit || ''}`}</dd></div>
        <div><dt>完成难度</dt><dd>{DIFFICULTY[evidence.difficulty] || '未填写'}</dd></div>
        <div><dt>完成时需要帮助</dt><dd>{evidence.needsHelp == null ? '未填写' : evidence.needsHelp ? '需要帮助' : '独立完成'}</dd></div>
      </dl>
      <h3>我的一句话</h3><p className="task-completion-copy">{evidence.childNote || '未填写'}</p>
      <h3>完成作品</h3>{!task.completionMediaIds.length && <p>未添加作品</p>}{media(task.completionMediaIds, true)}
      {editable && <button type="button" disabled={controller.busy || mediaBusy} onClick={() => setEditing(true)}>
        <EditOutlined aria-hidden="true" />修改本次完成</button>}
    </>}
    <section className="task-completion-feedback" aria-label="家长反馈">
      <h3>家长反馈</h3><p className="task-completion-copy">{task.parentFeedback || '暂无家长反馈'}</p>
    </section>
  </section>;
};

const TaskCompletionEvidence = ({ controller, scopeKey, childId, mediaApi, allowEdit = true, onMediaBusyChange, grade, helpTargetId }) => {
  const { state, task, command, recovery, busy, error, message } = controller;
  const privateVisible = state !== 'awaiting_auth' && state !== 'blocked';
  const confirmBlocked = command?.action === 'confirm' && task?.completionMediaReferenceState === 'pending_recovery';
  const discovering = state === 'recovery' || confirmBlocked;
  const retryAllowed = command && !confirmBlocked && ['uncertain', 'ready', 'error'].includes(state);
  return <div className="task-completion-panel">
    {message && <p role="status">{message}</p>}
    {error && <p className="task-completion-error" role="alert">{error}</p>}
    {state === 'loading' && <p role="status">正在加载任务详情...</p>}
    {state === 'sending' && <p role="status">正在确认请求结果...</p>}
    {state === 'awaiting_auth' && !error && <p role="alert">请重新登录后查看任务。</p>}
    {state === 'blocked' && !error && <p role="alert">提交记录暂时无法校验，请重新登录后查看恢复状态。</p>}
    {state === 'uncertain' && !error && <p role="status">本次请求结果尚未确认。</p>}
    {discovering && <p role="status">{recovery?.state === 'recoverable' ? '有一笔未完成的提交，可继续原提交。'
      : recovery?.state === 'other_actor' ? '另一位提交者正在处理，请等待原提交者恢复。' : '提交状态尚未就绪，请刷新详情后再查看。'}</p>}
    <div className="task-completion-actions">
      {retryAllowed && <button type="button" disabled={busy} onClick={controller.retry}><ReloadOutlined aria-hidden="true" />
        {command.action === 'confirm' ? '重试本次审核' : '重试本次提交'}</button>}
      {privateVisible && discovering && recovery?.state === 'recoverable' && <button type="button" disabled={busy} onClick={controller.recover}>
        <ReloadOutlined aria-hidden="true" />继续上次提交</button>}
      <button type="button" disabled={busy || !privateVisible} onClick={controller.refresh}><ReloadOutlined aria-hidden="true" />刷新详情</button>
    </div>
    {task && privateVisible && <EvidenceBody
      key={JSON.stringify([scopeKey, task.taskId, task.completionVersion, task.checklistVersion, task.status])}
      controller={controller} scopeKey={scopeKey} childId={childId} mediaApi={mediaApi} allowEdit={allowEdit}
      onMediaBusyChange={onMediaBusyChange} grade={grade} helpTargetId={helpTargetId}
    />}
  </div>;
};

export default TaskCompletionEvidence;
