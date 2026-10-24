import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { EyeOutlined, MinusCircleOutlined, DeleteOutlined, ReloadOutlined, ZoomInOutlined } from '@ant-design/icons';
import {
  uploadPrivateMedia as requestUpload, getPrivateMediaAccess as requestAccess,
  deletePrivateMedia as requestDelete
} from '../../services/familyApi';
import { mediaRulesForPurpose, validatePrivateMediaFile } from './privateMediaRules';

const rules = mediaRulesForPurpose('task_completion');
const buttonStyle = { minWidth: 44, minHeight: 44 };
const messageForAccess = error => [401, 403, 404, 410].includes(error?.response?.status || error?.status)
  ? '图片不可访问，请确认当前账号权限。' : '暂时无法授权，请手动重试。';

const Action = ({ label, children, ...props }) => (
  <button type="button" className="family-button secondary" style={buttonStyle}
    title={label} aria-label={label} {...props}>{children}</button>
);

const CompletionImage = ({ mediaId, index, readOnly, disabled, getPrivateMediaAccess,
  deletePrivateMedia, remove, beginBusy }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [deletion, setDeletion] = useState('');
  const [confirm, setConfirm] = useState(false);
  const dialogId = useId(), trigger = useRef(null), cancel = useRef(null);
  const state = useRef({ alive: true, access: null, deleting: null, deletion: '', timer: null, revalidate: false });
  const label = `完成图片 ${index + 1}`;

  const clearAccess = useCallback(() => {
    const current = state.current;
    current.access?.finish(); current.access = null;
    clearTimeout(current.timer); current.timer = null;
    setPreview(null);
  }, []);

  useLayoutEffect(() => {
    const current = state.current; current.alive = true;
    return () => {
      current.alive = false;
      clearTimeout(current.timer);
      current.access?.finish(); current.access = null;
      current.deleting?.finish(); current.deleting = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!disabled) return;
    clearAccess(); state.current.revalidate = false; setConfirm(false);
    if (state.current.deleting) {
      state.current.deleting.finish(); state.current.deleting = null;
      state.current.deletion = 'unknown'; setDeletion('unknown');
    }
  }, [disabled, clearAccess]);

  const authorize = useCallback(async () => {
    const current = state.current;
    if (!current.alive || disabled || current.deletion) return;
    clearAccess(); setError(''); current.revalidate = true;
    const operation = { finish: beginBusy() }; current.access = operation;
    const valid = () => current.alive && current.access === operation && !current.deletion;
    try {
      const result = await getPrivateMediaAccess(mediaId);
      if (!valid()) return;
      const value = result?.access || result;
      const url = value?.url || result?.accessUrl;
      const expires = Date.parse(value?.expiresAt);
      if (typeof url !== 'string' || !['https:', 'http:'].includes(new URL(url, window.location.href).protocol)
        || !Number.isFinite(expires) || expires <= Date.now()) throw new Error('Invalid access');
      setPreview({ url });
      current.timer = setTimeout(() => {
        clearAccess(); current.revalidate = false; setError('图片授权已过期，请重新查看。');
      }, Math.min(expires - Date.now(), 300000));
    } catch (cause) {
      if (valid()) { current.revalidate = false; setError(messageForAccess(cause)); }
    } finally {
      if (valid()) { current.access = null; operation.finish(); }
    }
  }, [beginBusy, clearAccess, disabled, getPrivateMediaAccess, mediaId]);

  useEffect(() => {
    const onVisibility = () => {
      const shouldCheck = state.current.revalidate;
      clearAccess();
      if (document.visibilityState !== 'hidden' && shouldCheck) authorize();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [authorize, clearAccess]);

  useEffect(() => { if (confirm) cancel.current?.focus(); }, [confirm]);
  const closeDialog = () => { setConfirm(false); trigger.current?.focus(); };
  const erase = async () => {
    const current = state.current;
    if (disabled || !current.alive || current.deleting || current.deletion === 'deleted') return;
    clearAccess(); current.revalidate = false; setError(''); setConfirm(false);
    current.deletion = 'deleting'; setDeletion('deleting');
    const operation = { finish: beginBusy() }; current.deleting = operation;
    try {
      await deletePrivateMedia(mediaId);
      if (!current.alive || current.deleting !== operation) return;
      current.deletion = 'deleted'; setDeletion('deleted');
    } catch (_cause) {
      if (!current.alive || current.deleting !== operation) return;
      current.deletion = 'unknown'; setDeletion('unknown');
    } finally {
      if (current.alive && current.deleting === operation) { current.deleting = null; operation.finish(); }
    }
  };

  return (
    <div className="family-media-item" aria-label={label}>
      <span className="family-media-name">{label}</span>
      <div className="family-inline-actions">
        {!deletion && <Action label={`查看${label}`} disabled={disabled} onClick={authorize}><EyeOutlined aria-hidden="true" /></Action>}
        {!readOnly && <Action label={`移除${label}`} disabled={disabled || deletion === 'deleting'} onClick={() => remove(mediaId)}>
          <MinusCircleOutlined aria-hidden="true" />
        </Action>}
        {!deletion && <button ref={trigger} type="button" className="family-button secondary" style={buttonStyle}
          title={`隐私删除${label}`} aria-label={`隐私删除${label}`} disabled={disabled} onClick={() => setConfirm(true)}>
          <DeleteOutlined aria-hidden="true" />
        </button>}
        {deletion === 'unknown' && <Action label={`重试隐私删除${label}`} disabled={disabled} onClick={erase}>
          <ReloadOutlined aria-hidden="true" />重试删除
        </Action>}
      </div>
      {confirm && <div role="dialog" aria-labelledby={dialogId} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeDialog(); }
      }}>
        <strong id={dialogId}>{`隐私删除${label}`}</strong>
        <p>将删除图片资产，而不只是从本次列表移除。删除后无法查看；任务记录和奖励保持不变。</p>
        <div className="family-inline-actions">
          <button type="button" className="family-button secondary" ref={cancel} onClick={closeDialog}>取消</button>
          <button type="button" className="family-button" onClick={erase}>确认隐私删除</button>
        </div>
      </div>}
      {preview && !deletion && <>
        <img className="family-media-preview" src={preview.url} alt={label}
          style={{ width: '100%', maxWidth: 640, height: 320, objectFit: 'contain' }}
          onError={() => { clearAccess(); state.current.revalidate = false; setError('图片加载失败，请重新查看。'); }} />
        <a href={preview.url} target="_blank" rel="noopener noreferrer" aria-label={`放大${label}`} title={`放大${label}`}>
          <ZoomInOutlined aria-hidden="true" />放大
        </a>
      </>}
      {deletion && <p role="status">{deletion === 'deleted' ? '图片已隐私删除'
        : deletion === 'deleting' ? '正在隐私删除…' : '删除结果尚未确认，图片已隐藏，请重试删除。'}</p>}
      {error && <p className="family-form-error" role="alert">{error}</p>}
    </div>
  );
};

const ScopedCompletionMedia = ({ values = [], onChange, childId, scopeKey, readOnly = false, disabled = false,
  uploadPrivateMedia = requestUpload, getPrivateMediaAccess = requestAccess,
  deletePrivateMedia = requestDelete, onBusyChange }) => {
  const inputId = useId();
  const [uploading, setUploading] = useState(false), [errors, setErrors] = useState([]);
  const ids = [...new Set(values.filter(value => typeof value === 'string' && value))];
  const latestIds = useRef(ids), onBusy = useRef(onBusyChange);
  const suppliedIds = useRef(JSON.stringify(ids));
  const state = useRef({ alive: true, busy: new Set(), upload: null });
  const blocked = disabled || !childId || !scopeKey;
  useLayoutEffect(() => {
    const signature = JSON.stringify(ids);
    if (suppliedIds.current !== signature) {
      suppliedIds.current = signature; latestIds.current = ids;
    }
  });
  useLayoutEffect(() => { onBusy.current = onBusyChange; }, [onBusyChange]);
  const beginBusy = useCallback(() => {
    const current = state.current, ticket = {};
    current.busy.add(ticket);
    if (current.busy.size === 1) onBusy.current?.(true);
    return () => {
      if (!current.busy.delete(ticket) || !current.alive) return;
      if (current.busy.size === 0) onBusy.current?.(false);
    };
  }, []);
  useLayoutEffect(() => {
    const current = state.current; current.alive = true;
    return () => {
      current.alive = false; current.upload = null;
      if (current.busy.size) { current.busy.clear(); onBusy.current?.(false); }
    };
  }, []);
  useLayoutEffect(() => {
    if (!blocked && !readOnly) return;
    state.current.upload?.finish(); state.current.upload = null; setUploading(false);
  }, [blocked, readOnly]);

  const upload = async event => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    const current = state.current;
    if (blocked || readOnly || current.upload || !files.length) return;
    const operation = { finish: beginBusy() }; current.upload = operation;
    const valid = () => current.alive && current.upload === operation;
    setUploading(true); setErrors([]);
    const seen = new Set();
    const report = (file, message) => setErrors(previous => [...previous, `${file.name}：${message}`]);
    try {
      for (const file of files) {
        if (!valid()) break;
        const fingerprint = JSON.stringify([file.name, file.size, file.type, file.lastModified]);
        if (seen.has(fingerprint)) { report(file, '已选择相同文件'); continue; }
        seen.add(fingerprint);
        const invalid = validatePrivateMediaFile(file, 'task_completion');
        if (invalid) { report(file, invalid.message); continue; }
        if (latestIds.current.length >= rules.maxItems) { report(file, '完成图片不能超过 10 张'); continue; }
        try {
          const result = await uploadPrivateMedia({ file, purpose: 'task_completion', childId });
          if (!valid()) break;
          const id = (result?.media || result)?.mediaId;
          if (typeof id !== 'string' || !id) throw new Error('Invalid upload');
          if (!latestIds.current.includes(id)) {
            if (latestIds.current.length >= rules.maxItems) { report(file, '完成图片不能超过 10 张'); continue; }
            latestIds.current = [...latestIds.current, id]; onChange?.(latestIds.current);
          }
        } catch (_cause) {
          if (valid()) report(file, '上传未确认，请重试；已成功的图片会保留。');
        }
      }
    } finally {
      if (valid()) { current.upload = null; setUploading(false); operation.finish(); }
    }
  };
  const remove = id => {
    if (blocked || readOnly) return;
    latestIds.current = latestIds.current.filter(value => value !== id); onChange?.(latestIds.current);
  };
  return (
    <div className="family-media-field" style={{ minWidth: 0 }}>
      {readOnly ? <span className="family-media-label">完成图片</span> : <label htmlFor={inputId}>添加完成图片</label>}
      <p className="family-media-count" aria-live="polite">已添加 {ids.length}/10</p>
      {!readOnly && <input id={inputId} type="file" multiple accept={rules.acceptedMimeTypes.join(',')}
        disabled={blocked || uploading || ids.length >= rules.maxItems} onChange={upload} />}
      {ids.length > rules.maxItems && <p role="alert" className="family-form-error">完成图片不能超过 10 张</p>}
      {ids.map((id, index) => <CompletionImage key={id} mediaId={id} index={index} readOnly={readOnly}
        disabled={blocked} getPrivateMediaAccess={getPrivateMediaAccess} deletePrivateMedia={deletePrivateMedia}
        remove={remove} beginBusy={beginBusy} />)}
      {errors.map((error, index) => <p key={index} role="alert" className="family-form-error" style={{ overflowWrap: 'anywhere' }}>{error}</p>)}
    </div>
  );
};

// A new identity gets fresh state synchronously; old requests retain only their invalidated instance.
const TaskCompletionMedia = props => <ScopedCompletionMedia key={JSON.stringify([props.scopeKey, props.childId])} {...props} />;

export default TaskCompletionMedia;
