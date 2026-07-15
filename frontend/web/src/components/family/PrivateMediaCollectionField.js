import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  getPrivateMediaAccess as requestPrivateMediaAccess,
  uploadPrivateMedia as requestPrivateMediaUpload
} from '../../services/familyApi';
import {
  formatMediaSize,
  isPdfMedia,
  mediaIdOf,
  mediaRulesForPurpose,
  validatePrivateMediaFile
} from './privateMediaRules';

const apiMessage = (error) => error?.response?.data?.error?.message || error?.message || '附件处理失败，请重试。';

const PrivateMediaCollectionField = ({
  label,
  childId,
  purpose,
  values = [],
  onChange,
  onUploaded,
  onRemoved,
  onBusyChange,
  uploadPrivateMedia = requestPrivateMediaUpload,
  getPrivateMediaAccess = requestPrivateMediaAccess
}) => {
  const inputId = useId();
  const rules = mediaRulesForPurpose(purpose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [descriptors, setDescriptors] = useState({});
  const [signedUrls, setSignedUrls] = useState({});

  useEffect(() => {
    const supplied = values.filter((value) => typeof value === 'object' && mediaIdOf(value));
    if (supplied.length === 0) return;
    setDescriptors((current) => ({
      ...current,
      ...Object.fromEntries(supplied.map((value) => [mediaIdOf(value), value]))
    }));
  }, [values]);

  const items = useMemo(() => values.map((value) => {
    const mediaId = mediaIdOf(value);
    const supplied = typeof value === 'object' ? value : {};
    return { ...supplied, ...descriptors[mediaId], mediaId };
  }).filter((value) => value.mediaId), [descriptors, values]);

  const ids = useMemo(() => items.map((item) => item.mediaId), [items]);

  const setBusyState = (value) => {
    setBusy(value);
    onBusyChange?.(value);
  };

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setError('');
    setBusyState(true);
    let nextIds = [...ids];

    try {
      for (const file of files) {
        if (nextIds.length >= rules.maxItems) {
          setError(`${file.name}：附件不能超过 ${rules.maxItems} 个`);
          break;
        }
        const validationError = validatePrivateMediaFile(file, purpose);
        if (validationError) {
          setError(`${file.name}：${validationError.message}`);
          break;
        }
        try {
          const result = await uploadPrivateMedia({ childId, purpose, file });
          const descriptor = result?.media || result;
          const mediaId = descriptor?.mediaId;
          if (!mediaId) throw new Error('上传响应缺少 mediaId');
          setDescriptors((current) => ({ ...current, [mediaId]: descriptor }));
          if (nextIds.includes(mediaId)) continue;
          nextIds = [...nextIds, mediaId];
          onUploaded?.(mediaId, null);
          onChange?.(nextIds);
        } catch (uploadError) {
          setError(`${file.name}：${apiMessage(uploadError)}`);
          break;
        }
      }
    } finally {
      setBusyState(false);
      event.target.value = '';
    }
  };

  const requestAccess = async (item) => {
    setBusyState(true);
    setError('');
    try {
      const result = await getPrivateMediaAccess(item.mediaId);
      const url = result?.access?.url || result?.accessUrl || result?.url;
      if (!url) throw new Error('授权响应缺少访问地址');
      if (result?.media) {
        setDescriptors((current) => ({ ...current, [item.mediaId]: result.media }));
      }
      setSignedUrls((current) => ({ ...current, [item.mediaId]: url }));
    } catch (accessError) {
      setError(apiMessage(accessError));
    } finally {
      setBusyState(false);
    }
  };

  const remove = (mediaId) => {
    setError('');
    setSignedUrls((current) => {
      const next = { ...current };
      delete next[mediaId];
      return next;
    });
    onRemoved?.(mediaId);
    onChange?.(ids.filter((value) => value !== mediaId));
  };

  return (
    <div className="family-media-field">
      <label htmlFor={inputId}>{label}</label>
      <p className="family-media-count" aria-live="polite">已添加 {items.length}/{rules.maxItems}</p>
      <input
        id={inputId}
        type="file"
        accept={rules.acceptedMimeTypes.join(',')}
        multiple
        onChange={upload}
        disabled={busy || !childId || items.length >= rules.maxItems}
      />
      {items.map((item, index) => {
        const itemLabel = item.displayName || `${label} ${index + 1}`;
        const pdf = isPdfMedia(item);
        const details = [
          formatMediaSize(item.sizeBytes),
          pdf && item.pageCount ? `${item.pageCount} 页` : ''
        ].filter(Boolean).join(' · ');
        return (
          <div className="family-media-item" key={item.mediaId}>
            <span className="family-media-name">{itemLabel}</span>
            {details && <span className="family-media-meta">{details}</span>}
            <div className="family-inline-actions">
              <button
                type="button"
                className="family-button secondary"
                onClick={() => requestAccess(item)}
                disabled={busy}
                aria-label={`${pdf ? '下载' : '预览'}${label} ${index + 1}`}
              >
                {pdf ? '下载' : '预览'}
              </button>
              <button
                type="button"
                className="family-button secondary"
                onClick={() => remove(item.mediaId)}
                disabled={busy}
                aria-label={`移除${label} ${index + 1}`}
              >
                移除
              </button>
            </div>
            {!pdf && signedUrls[item.mediaId] && (
              <img className="family-media-preview" src={signedUrls[item.mediaId]} alt={`${itemLabel} 预览`} />
            )}
            {pdf && signedUrls[item.mediaId] && (
              <a href={signedUrls[item.mediaId]} download={item.displayName || true}>
                保存{itemLabel}
              </a>
            )}
          </div>
        );
      })}
      {error && <p className="family-form-error" role="alert">{error}</p>}
    </div>
  );
};

export default PrivateMediaCollectionField;
