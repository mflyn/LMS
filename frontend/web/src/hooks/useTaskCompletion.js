import { useCallback, useEffect, useRef, useState } from 'react';
import { isSessionCurrent, subscribeSessionChanges } from '../services/familySession';
import {
  createCompletionCommand, saveCompletionCommand, loadCompletionCommand, clearCompletionCommand,
  normalizeConfirmationBody, validateCompletionResult, validateConfirmationResult, classifyCompletionError
} from '../services/completionCommandStore';

const initial = () => ({ state: 'loading', task: null, command: null, recovery: null, error: '', message: '' });
const version = value => Number.isSafeInteger(value) && value >= 0;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const unavailable = () => new Error('任务详情不符合当前作品协议，请刷新或联系家长。');
const detailValid = (task, scope) => task?.taskId === scope.taskId && task.childId === scope.childId
  && task.familyId === scope.familyId && version(task.completionVersion) && version(task.checklistVersion)
  && Array.isArray(task.checklistSnapshot) && Array.isArray(task.completionMediaIds)
  && ['stable', 'pending_recovery'].includes(task.completionMediaReferenceState);
const recoveryResultValid = (payload, scope, recovery) => {
  const task = payload?.task;
  return task?.taskId === scope.taskId && task.status === 'completed' && task.parentConfirmed === false
    && task.completionVersion === recovery.targetCompletionVersion && version(task.checklistVersion)
    && task.completionMediaReferenceState === 'stable' && Array.isArray(task.completionMediaIds)
    && task.completionMediaIds.length <= 10 && new Set(task.completionMediaIds).size === task.completionMediaIds.length
    && task.completionMediaIds.every(id => typeof id === 'string' && /^[0-9a-f]{24}$/.test(id))
    && typeof task.completedAt === 'string' && Number.isFinite(Date.parse(task.completedAt));
};

// Scope and session are checked at send and receive, independently of cancellation.
export const useTaskCompletion = ({ scope, session, api }) => {
  const key = JSON.stringify([scope, session?.revision, session?.actorId]);
  const currentKey = useRef(key); currentKey.current = key;
  const lifecycle = useRef(null), busy = useRef(false), valueRef = useRef({ ...initial(), scopeKey: key });
  const identityMatches = session?.actorId === scope.actorId && session?.role === scope.role
    && (scope.role !== 'student' || scope.actorId === scope.childId);
  const [value, setValue] = useState(() => valueRef.current);
  const apply = useCallback(patch => {
    valueRef.current = { ...valueRef.current, ...patch };
    setValue(valueRef.current);
  }, []);
  const current = useCallback(run => lifecycle.current === run && run.key === key && currentKey.current === key
    && identityMatches && !run.controller.signal.aborted && isSessionCurrent(session), [key, session, identityMatches]);

  const read = useCallback(async (run, command = valueRef.current.command, message = '') => {
    try {
      const payload = await api.getTask(scope.taskId, run.controller.signal, session);
      if (!current(run)) return;
      if (!detailValid(payload?.task, scope)) throw unavailable();
      const task = payload.task;
      let recovery = null;
      if (task.completionMediaReferenceState === 'pending_recovery' && (!command || command.action === 'confirm')) {
        const result = await api.discover(scope.taskId, run.controller.signal, session);
        if (!current(run)) return;
        recovery = result?.recovery;
        if (!['none', 'recoverable', 'other_actor'].includes(recovery?.state)
          || (recovery.state === 'recoverable' && (!uuid(recovery.operationId) || !version(recovery.targetCompletionVersion)))) throw unavailable();
      }
      apply({ task, command, recovery, message, error: '', state: command ? 'uncertain'
        : task.completionMediaReferenceState === 'pending_recovery' ? 'recovery' : 'ready' });
    } catch (error) {
      if (!current(run)) return;
      if ([401, 403].includes(error?.response?.status)) {
        // A denied read invalidates private views, not the durable command's outcome.
        apply({ state: 'awaiting_auth', task: null, command, recovery: null, message: '',
          error: '当前身份无法访问此任务，请重新登录后恢复原请求。' });
        return;
      }
      apply({ state: command ? 'uncertain' : 'error', task: null, command, message,
        error: error?.response?.data?.error?.code === 'SOURCE_SERVICE_UNAVAILABLE'
          ? '来源服务暂不可用，请重试读取。' : '详情加载失败，请重试。', recovery: null });
    }
  }, [api, apply, current, scope, session]);

  useEffect(() => {
    const run = { controller: new AbortController(), key };
    lifecycle.current = run; busy.current = false; valueRef.current = { ...initial(), scopeKey: key }; setValue(valueRef.current);
    if (!identityMatches || !isSessionCurrent(session)) apply({ state: 'awaiting_auth', error: '请重新登录。' });
    else {
      try {
        const complete = loadCompletionCommand(scope);
        const confirm = scope.role === 'parent' ? loadCompletionCommand(scope, 'confirm') : null;
        if (complete && confirm) throw unavailable();
        const command = complete || confirm;
        apply({ command });
        read(run, command);
      } catch (_error) {
        apply({ state: 'blocked', error: '本地提交记录无法校验，请重新登录后使用原提交恢复。' });
      }
    }
    const unsubscribe = subscribeSessionChanges(() => {
      if (!isSessionCurrent(session) && lifecycle.current === run) {
        run.controller.abort(); busy.current = false;
        apply({ ...initial(), state: 'awaiting_auth', error: '身份已变化，请重新登录或重新打开任务。' });
      }
    });
    return () => { run.controller.abort(); unsubscribe(); if (lifecycle.current === run) lifecycle.current = null; };
  }, [key, scope, session, read, apply, identityMatches]);

  const refresh = async () => {
    const run = lifecycle.current;
    if (!run || !current(run) || busy.current) return;
    busy.current = true; apply({ state: 'loading', task: null });
    try {
      const complete = loadCompletionCommand(scope);
      const confirm = scope.role === 'parent' ? loadCompletionCommand(scope, 'confirm') : null;
      if (complete && confirm) throw unavailable();
      await read(run, valueRef.current.command || complete || confirm);
    } catch (_error) {
      if (current(run)) apply({ state: 'blocked', error: '本地提交记录无法校验，请重新登录后使用原提交恢复。' });
    } finally { if (current(run)) busy.current = false; }
  };

  const send = async command => {
    const run = lifecycle.current;
    if (!run || !current(run) || busy.current) return;
    busy.current = true;
    const wasUncertain = command.uncertain;
    apply({ command, state: 'uncertain' });
    let persisted = false;
    try {
      // Persist uncertainty before HTTP: a refresh cannot prove the server did not receive it.
      const frozen = saveCompletionCommand({ ...command, uncertain: true });
      persisted = true;
      apply({ command: frozen, state: 'sending', error: '', message: '' });
      const result = await (command.action === 'confirm' ? api.confirm : api.complete)(
        scope.taskId, frozen.body, run.controller.signal, session);
      if (!current(run)) return;
      const valid = command.action === 'confirm' ? validateConfirmationResult(result, frozen) : validateCompletionResult(result, frozen);
      if (!valid) throw new Error('Unverified completion response');
      try { clearCompletionCommand(scope, command.action); } catch (_error) { /* Replay after reload remains idempotent. */ }
      apply({ command: null, task: null });
      await read(run, null, command.action === 'confirm' ? '审核结果已确认。' : '提交结果已确认。');
    } catch (error) {
      if (!current(run)) return;
      if (!persisted) {
        apply({ error: '无法保存本次请求，未发送。请检查浏览器存储后重试。' });
        return;
      }
      const classification = command.action === 'confirm'
        ? classifyConfirmationError(error) : classifyCompletionError(error, { uncertain: wasUncertain });
      if (classification === 'terminal') {
        try { clearCompletionCommand(scope, command.action); } catch (_error) { /* Keep persisted replay safe. */ }
        apply({ command: null, task: null });
        await read(run, null, '请求未完成，任务可能已变化。请重新查看后再操作。');
      } else {
        if (command.action === 'confirm' && classification === 'uncertain') {
          await read(run, valueRef.current.command);
          if (!current(run)) return;
        }
        apply({ state: classification, error: classification === 'awaiting_auth' ? '请重新登录后恢复原请求。'
          : '尚未确认本次操作结果。请重试原请求，不要重新提交。',
        ...([401, 403].includes(error?.response?.status) || classification === 'awaiting_auth' ? { task: null } : {}) });
      }
    } finally { if (current(run)) busy.current = false; }
  };

  const submit = async form => {
    const { task, command, state } = valueRef.current;
    if (!lifecycle.current || !current(lifecycle.current) || busy.current || state !== 'ready' || command || !task || !['pending', 'completed'].includes(task.status)
      || task.completionMediaReferenceState !== 'stable') return;
    try {
      const envelope = createCompletionCommand(scope, { ...form, expectedCompletionVersion: task.completionVersion,
        expectedChecklistVersion: task.checklistVersion });
      await send(envelope);
    } catch (_error) { apply({ error: '无法保存或校验本次提交，请检查输入和浏览器存储后重试。' }); }
  };

  const confirm = async parentFeedback => {
    const { task, command, state } = valueRef.current;
    if (!lifecycle.current || !current(lifecycle.current) || scope.role !== 'parent' || busy.current || state !== 'ready' || command || !task
      || !['completed', 'confirmed'].includes(task.status) || task.completionMediaReferenceState !== 'stable') return;
    try {
      await send({ schemaVersion: 1, scope, action: 'confirm', uncertain: false,
        body: normalizeConfirmationBody({ expectedCompletionVersion: task.completionVersion, parentFeedback }) });
    } catch (_error) { apply({ error: '无法保存或校验审核请求，请检查输入和浏览器存储。' }); }
  };
  const retry = async () => {
    const { command, task } = valueRef.current;
    if (command?.action === 'confirm' && task?.completionMediaReferenceState === 'pending_recovery') return;
    if (command) await send(command);
  };

  const recover = async () => {
    const run = lifecycle.current, recovery = valueRef.current.recovery;
    if (!run || !current(run) || busy.current || recovery?.state !== 'recoverable'
      || !['recovery', 'uncertain'].includes(valueRef.current.state)) return;
    busy.current = true; apply({ state: 'sending', error: '' });
    try {
      const result = await api.recover(scope.taskId, recovery.operationId, run.controller.signal, session);
      if (!current(run)) return;
      if (!recoveryResultValid(result, scope, recovery)) throw unavailable();
      await read(run, valueRef.current.command, '原提交已恢复。');
    } catch (error) {
      if (!current(run)) return;
      if ([401, 403].includes(error?.response?.status)) {
        // Lost authorization is not evidence that the original operation terminated.
        apply({ state: 'awaiting_auth', task: null, error: '当前身份无法访问此任务，请重新登录后恢复原请求。' });
        return;
      }
      // A recovery 404 is not a durable failure of the original PATCH.
      apply({ state: 'recovery', recovery, error: '原提交尚未恢复，请重试或重新读取任务。' });
    } finally { if (current(run)) busy.current = false; }
  };

  const visible = value.scopeKey === key && identityMatches && isSessionCurrent(session) ? value
    : { ...initial(), state: identityMatches && isSessionCurrent(session) ? 'loading' : 'awaiting_auth' };
  return { ...visible, submit, confirm, retry, recover, refresh,
    busy: ['loading', 'sending'].includes(visible.state),
    editable: visible.state === 'ready' && !visible.command && ['pending', 'completed'].includes(visible.task?.status)
      && visible.task?.completionMediaReferenceState === 'stable' };
};

const classifyConfirmationError = error => {
  const status = error?.response?.status, body = error?.response?.data;
  if (status === 401 || status === 403) return 'awaiting_auth';
  if (body?.success === false && typeof body.error?.message === 'string' && status === 409
    && ['VERSION_CONFLICT', 'TASK_STATE_CONFLICT'].includes(body.error.code)) return 'terminal';
  return 'uncertain';
};
