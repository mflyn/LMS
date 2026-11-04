import React, { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined, DeleteOutlined, EyeOutlined, MinusCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { assertAi2MediaEntry, createAi2MediaApi, isAi2MediaId, validateAi2MediaFile } from '../../services/ai2MediaApi';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { IMAGE_MIME_TYPES } from './privateMediaRules';

const controlStyle = { minWidth: 44, minHeight: 44 };
const Action = ({ label, children, ...rest }) => <button type="button" className="family-button secondary"
  style={controlStyle} title={label} aria-label={label} {...rest}>{children}</button>;
const denied = error => [401, 403, 404, 410].includes(error?.response?.status || error?.status);
const selection = values => {
  try {
    if (!Array.isArray(values) || values.length > 10) throw new Error();
    const entries = Array.from(values, value => {
      if (typeof value === 'string') {
        if (!isAi2MediaId(value)) throw new Error();
        return { mediaId: value, status: 'available' };
      }
      return assertAi2MediaEntry(value, { statusRequired: true });
    });
    if (new Set(entries.map(entry => entry.mediaId)).size !== entries.length) throw new Error();
    return { entries, invalid: false };
  } catch { return { entries: [], invalid: true }; }
};

const ScopedAi2Media = ({ role, session, childId, scopeKey, values = [], onChange, readOnly = false,
  disabled = false, onBusyChange, onBlockedChange, onDenied, onViewed, onDeleted }) => {
  const api = useMemo(() => createAi2MediaApi(role), [role]);
  const selected = useMemo(() => selection(values), [values]), entries = selected.entries;
  const signature = JSON.stringify(entries);
  const [previews, setPreviews] = useState({}), [errors, setErrors] = useState({});
  const [failures, setFailures] = useState([]), [deletions, setDeletions] = useState({});
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [unavailable, setUnavailable] = useState(false), [confirm, setConfirm] = useState(null);
  const inputId = useId(), dialogId = useId(), cancelButton = useRef(null), deleteTrigger = useRef(null);
  const callbacks = useRef({});
  const state = useRef({ alive: true, jobs: new Set(), urls: {}, deletions: {}, failures: [], entries,
    signature, upload: null, unavailable: false, sequence: 0 });
  const gated = disabled || unavailable || selected.invalid || !scopeKey || !isAi2MediaId(childId)
    || !isSessionCurrent(session) || session.role !== role || (role === 'student' && session.actorId !== childId);
  const blocked = gated || busy || failures.length > 0 || entries.length === 0
    || entries.some(entry => entry.status === 'deleted' || deletions[entry.mediaId]) || Object.keys(errors).length > 0;

  useLayoutEffect(() => {
    callbacks.current = { onChange, onBusyChange, onBlockedChange, onDenied, onViewed, onDeleted };
  });
  const syncBusy = useCallback(() => {
    const current = state.current;
    if (!current.alive) return;
    const next = current.jobs.size > 0;
    setBusy(next);
    if (current.busy !== next) { current.busy = next; callbacks.current.onBusyChange?.(next); }
  }, []);
  const finish = useCallback(job => {
    if (!job || !state.current.jobs.delete(job)) return;
    job.controller.abort(); syncBusy();
  }, [syncBusy]);
  const begin = (kind, mediaId) => {
    const job = { kind, mediaId, controller: new AbortController() };
    state.current.jobs.add(job); syncBusy(); return job;
  };
  const live = job => state.current.alive && state.current.jobs.has(job)
    && !state.current.unavailable && isSessionCurrent(session);
  const options = job => ({ session, signal: job.controller.signal });
  const clearPreviews = useCallback(mediaId => {
    const current = state.current;
    const cleared = new Set(mediaId ? [mediaId] : Object.keys(current.urls));
    for (const job of [...current.jobs]) {
      if (job.kind === 'preview' && (!mediaId || job.mediaId === mediaId)) {
        cleared.add(job.mediaId); finish(job);
      }
    }
    for (const [id, preview] of Object.entries(current.urls)) {
      if (mediaId && id !== mediaId) continue;
      clearTimeout(preview.timer); URL.revokeObjectURL(preview.url); delete current.urls[id];
    }
    if (current.alive) {
      setPreviews({ ...current.urls });
      if (isSessionCurrent(session)) for (const id of cleared) callbacks.current.onViewed?.(id, false);
    }
  }, [finish, session]);
  const addFailure = (file, message) => {
    const current = state.current;
    current.failures = [...current.failures, { key: ++current.sequence, file, message }];
    setFailures(current.failures);
  };
  const dropFailure = key => {
    state.current.failures = state.current.failures.filter(item => item.key !== key);
    setFailures(state.current.failures);
  };
  const cancelUpload = useCallback(() => {
    const current = state.current, job = current.upload;
    if (!job) return;
    if (current.alive) {
      current.failures = [...current.failures, ...(job.remaining || []).map(file => ({
        key: ++current.sequence, file, message: '上传未确认或尚未上传，请重试或忽略此项。'
      }))];
      setFailures(current.failures); setUploading(false);
    }
    current.upload = null; finish(job);
  }, [finish]);
  const invalidate = useCallback(() => {
    const current = state.current;
    clearPreviews();
    cancelUpload();
    for (const job of [...current.jobs]) {
      if (job.kind === 'delete') current.deletions[job.mediaId] = 'unknown';
      finish(job);
    }
    current.upload = null;
    if (current.alive) { setUploading(false); setDeletions({ ...current.deletions }); setConfirm(null); }
  }, [clearPreviews, finish, cancelUpload]);

  useLayoutEffect(() => {
    const current = state.current; current.alive = true;
    const unsubscribe = subscribeSessionChanges(event => {
      if (event.role !== role || isSessionCurrent(session)) return;
      current.unavailable = true; setUnavailable(true); invalidate();
    });
    const visibility = () => clearPreviews();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', visibility);
    return () => {
      current.alive = false; unsubscribe();
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', visibility);
      invalidate();
      if (current.busy) { current.busy = false; callbacks.current.onBusyChange?.(false); }
    };
  }, [clearPreviews, invalidate, role, session]);
  useLayoutEffect(() => {
    const current = state.current;
    if (current.signature === signature) return;
    current.signature = signature; current.entries = entries;
    const active = new Set(entries.filter(entry => entry.status !== 'deleted').map(entry => entry.mediaId));
    for (const id of new Set([...Object.keys(current.urls), ...[...current.jobs].map(job => job.mediaId)])) {
      if (id && !active.has(id)) clearPreviews(id);
    }
    for (const job of [...current.jobs]) {
      if (job.kind === 'delete' && !active.has(job.mediaId)) finish(job);
    }
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => active.has(id))));
  }, [signature, entries, clearPreviews, finish]);
  useLayoutEffect(() => {
    if (gated) invalidate();
    else if (readOnly) cancelUpload();
  }, [gated, readOnly, invalidate, cancelUpload]);
  useLayoutEffect(() => { callbacks.current.onBlockedChange?.(Boolean(blocked)); }, [blocked]);
  useLayoutEffect(() => { if (confirm) cancelButton.current?.focus(); }, [confirm]);

  const handleDenial = error => {
    if (!state.current.alive || error?.code === 'SESSION_CHANGED' || !denied(error)) return false;
    const currentSession = captureSession(role);
    if (currentSession && currentSession !== session) return false;
    state.current.unavailable = true; setUnavailable(true); invalidate();
    callbacks.current.onDenied?.(error); return true;
  };
  const setError = (id, message) => setErrors(previous => {
    const next = { ...previous }; if (message) next[id] = message; else delete next[id]; return next;
  });
  const authorize = async mediaId => {
    const current = state.current;
    if (gated || current.deletions[mediaId] || !isSessionCurrent(session)) return;
    clearPreviews(mediaId); setError(mediaId, '');
    const job = begin('preview', mediaId);
    try {
      const result = await api.access(mediaId, options(job));
      if (!live(job)) return;
      const blob = await api.content(result.access, mediaId, options(job));
      if (!live(job)) return;
      const expires = Date.parse(result.access?.expiresAt);
      if (validateAi2MediaFile(blob) || !Number.isFinite(expires) || expires <= Date.now()) throw new Error('Invalid image');
      const preview = { url: URL.createObjectURL(blob), viewed: false };
      current.urls[mediaId] = preview;
      preview.timer = setTimeout(() => {
        clearPreviews(mediaId);
        if (current.alive) setError(mediaId, '图片授权已过期，请重新查看。');
      }, Math.min(expires - Date.now(), 300000));
      setPreviews({ ...current.urls });
    } catch (error) {
      if (!current.alive) return;
      // A same-scope denial fences newer jobs even when this preview was superseded.
      if (handleDenial(error)) return;
      if (live(job)) setError(mediaId, '图片暂时无法查看，请重试。');
    } finally { finish(job); }
  };
  const upload = async (files, retryKey) => {
    const current = state.current;
    if (gated || readOnly || role !== 'student' || current.upload || !files.length || !isSessionCurrent(session)) return;
    const job = begin('upload'); current.upload = job; setUploading(true);
    if (retryKey !== undefined) dropFailure(retryKey);
    const seen = new Set();
    try {
      for (const [index, file] of files.entries()) {
        if (!live(job)) break;
        job.remaining = files.slice(index);
        const fingerprint = JSON.stringify([file.name, file.size, file.type, file.lastModified]);
        if (seen.has(fingerprint)) { addFailure(file, '已选择相同文件'); continue; }
        seen.add(fingerprint);
        const invalidFile = validateAi2MediaFile(file);
        if (invalidFile) { addFailure(file, invalidFile); continue; }
        if (current.entries.length >= 10) { addFailure(file, '订正图片不能超过 10 张'); continue; }
        try {
          const result = await api.upload({ childId, file }, options(job));
          if (!live(job)) break;
          const media = assertAi2MediaEntry(result?.media);
          if (media.status === 'deleted') throw new Error('Deleted upload');
          if (current.entries.some(entry => entry.mediaId === media.mediaId)) {
            addFailure(file, '上传返回重复图片，请确认后忽略此项'); continue;
          }
          if (current.entries.length >= 10) { addFailure(file, '订正图片不能超过 10 张'); continue; }
          current.entries = [...current.entries, { ...media, status: 'available' }];
          callbacks.current.onChange?.(current.entries.map(entry => entry.mediaId));
        } catch (error) {
          if (!current.alive) break;
          if (handleDenial(error)) break;
          if (live(job)) addFailure(file, '上传未确认，请重试；已成功的图片会保留。');
        }
      }
    } finally {
      if (current.upload === job) { current.upload = null; if (current.alive) setUploading(false); }
      finish(job);
    }
  };
  const remove = mediaId => {
    if (gated || readOnly) return;
    clearPreviews(mediaId); setError(mediaId, '');
    state.current.entries = state.current.entries.filter(entry => entry.mediaId !== mediaId);
    callbacks.current.onChange?.(state.current.entries.map(entry => entry.mediaId));
  };
  const closeDialog = () => { setConfirm(null); deleteTrigger.current?.focus(); };
  const erase = async mediaId => {
    const current = state.current;
    if (gated || !isSessionCurrent(session) || ['deleting', 'deleted'].includes(current.deletions[mediaId])) return;
    clearPreviews(mediaId); setError(mediaId, ''); setConfirm(null);
    current.deletions[mediaId] = 'deleting'; setDeletions({ ...current.deletions });
    const job = begin('delete', mediaId);
    try {
      await api.remove(mediaId, options(job));
      if (live(job)) {
        current.deletions[mediaId] = 'deleted'; setDeletions({ ...current.deletions });
        callbacks.current.onDeleted?.(mediaId);
      }
    } catch (error) {
      if (!current.alive) return;
      if (handleDenial(error)) return;
      if (live(job)) { current.deletions[mediaId] = 'unknown'; setDeletions({ ...current.deletions }); }
    } finally { finish(job); }
  };

  return <div className="family-media-field" style={{ minWidth: 0 }}>
    {!readOnly && role === 'student' ? <label htmlFor={inputId}>添加订正图片</label> : <span className="family-media-label">订正图片</span>}
    <p className="family-media-count" aria-live="polite">已添加 {entries.length}/10</p>
    {!readOnly && role === 'student' && <input id={inputId} type="file" multiple accept={IMAGE_MIME_TYPES.join(',')}
      style={{ minHeight: 44, maxWidth: '100%' }} disabled={gated || uploading || entries.length >= 10}
      onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; upload(files); }} />}
    {selected.invalid && <p role="alert" className="family-form-error">图片列表无效：需要最多 10 个唯一的有效图片记录。</p>}
    {unavailable && <p role="alert" className="family-form-error">图片不可访问，请重新确认当前账号与内容权限。</p>}
    {entries.map((entry, index) => {
      const mediaId = entry.mediaId, label = `订正图片 ${index + 1}`;
      const deletion = entry.status === 'deleted' ? 'deleted' : deletions[mediaId];
      const preview = !gated && !deletion ? previews[mediaId] : null;
      return <div key={mediaId} className="family-media-item" aria-label={label}>
        <span className="family-media-name">{label}</span>
        <div className="family-inline-actions">
          {!deletion && <Action label={`查看${label}`} disabled={gated} onClick={() => authorize(mediaId)}><EyeOutlined aria-hidden="true" /></Action>}
          {!readOnly && <Action label={`移除${label}`} disabled={gated || deletion === 'deleting'} onClick={() => remove(mediaId)}><MinusCircleOutlined aria-hidden="true" /></Action>}
          {!deletion && <Action label={`隐私删除${label}`} disabled={gated} onClick={event => {
            deleteTrigger.current = event.currentTarget; setConfirm({ mediaId, label });
          }}><DeleteOutlined aria-hidden="true" /></Action>}
          {deletion === 'unknown' && <Action label={`重试隐私删除${label}`} disabled={gated} onClick={() => erase(mediaId)}><ReloadOutlined aria-hidden="true" /></Action>}
        </div>
        {preview && <img className="family-media-preview" src={preview.url} alt={label}
          style={{ width: '100%', maxWidth: 640, height: 320, objectFit: 'contain' }}
          onLoad={() => {
            if (state.current.urls[mediaId] !== preview || preview.viewed || !isSessionCurrent(session)) return;
            preview.viewed = true; callbacks.current.onViewed?.(mediaId, true);
          }} onError={() => {
            if (state.current.urls[mediaId] !== preview) return;
            clearPreviews(mediaId); setError(mediaId, '图片加载失败，请重新查看。');
          }} />}
        {deletion && <p role="status">{deletion === 'deleted' ? '图片已隐私删除'
          : deletion === 'deleting' ? '正在隐私删除…' : '删除结果尚未确认，图片已隐藏，请重试删除。'}</p>}
        {errors[mediaId] && <p role="alert" className="family-form-error">{errors[mediaId]}</p>}
      </div>;
    })}
    {failures.map(failure => <div key={failure.key} style={{ overflowWrap: 'anywhere' }}>
      <p role="alert" className="family-form-error">{failure.file.name}：{failure.message}</p>
      <div className="family-inline-actions">
        <Action label={`重试上传 ${failure.file.name}`} disabled={gated || readOnly || uploading || role !== 'student'}
          onClick={() => upload([failure.file], failure.key)}><ReloadOutlined aria-hidden="true" /></Action>
        <Action label={`忽略失败 ${failure.file.name}`} disabled={gated || uploading} onClick={() => dropFailure(failure.key)}><CloseOutlined aria-hidden="true" /></Action>
      </div>
    </div>)}
    {confirm && !gated && <div role="dialog" aria-labelledby={dialogId} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); closeDialog(); }
    }}>
      <strong id={dialogId}>{`隐私删除${confirm.label}`}</strong>
      <p>确认删除此图片资产？删除后无法查看，历史订正保留已删除占位。</p>
      <div className="family-inline-actions">
        <button type="button" className="family-button secondary" style={controlStyle} ref={cancelButton} onClick={closeDialog}>取消</button>
        <button type="button" className="family-button" style={controlStyle} onClick={() => erase(confirm.mediaId)}>确认隐私删除</button>
      </div>
    </div>}
  </div>;
};

// A scope or session revision gets a new instance before any private child can render.
const Ai2Media = props => <ScopedAi2Media key={JSON.stringify([props.role, props.session?.actorId,
  props.session?.revision, props.session?.token, props.childId, props.scopeKey])} {...props} />;

export default Ai2Media;
