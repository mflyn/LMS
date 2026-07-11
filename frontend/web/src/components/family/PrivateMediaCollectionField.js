import React, { useId, useState } from 'react';
import {
  getPrivateMediaAccess as requestPrivateMediaAccess,
  uploadPrivateMedia as requestPrivateMediaUpload
} from '../../services/familyApi';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 100;

const apiMessage = (error) => error?.response?.data?.error?.message || error?.message || '图片处理失败，请重试。';

const PrivateMediaCollectionField = ({
  label,
  childId,
  purpose,
  values = [],
  onChange,
  onUploaded,
  onRemoved,
  uploadPrivateMedia = requestPrivateMediaUpload,
  getPrivateMediaAccess = requestPrivateMediaAccess
}) => {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedUrls, setSignedUrls] = useState({});

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setError('');

    if (values.length + files.length > MAX_ATTACHMENTS) {
      setError(`任务附件不能超过 ${MAX_ATTACHMENTS} 个`);
      event.target.value = '';
      return;
    }
    if (files.some((file) => !ALLOWED_TYPES.has(file.type))) {
      setError('仅支持 JPEG、PNG 或 WebP 图片');
      event.target.value = '';
      return;
    }
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      setError('图片不能超过 10 MiB');
      event.target.value = '';
      return;
    }

    setBusy(true);
    let nextValues = [...values];
    try {
      for (const file of files) {
        const result = await uploadPrivateMedia({ childId, purpose, file });
        const mediaId = result?.media?.mediaId || result?.mediaId;
        if (!mediaId) throw new Error('上传响应缺少 mediaId');
        if (nextValues.includes(mediaId)) continue;
        nextValues = [...nextValues, mediaId];
        onUploaded?.(mediaId, null);
        onChange(nextValues);
      }
    } catch (uploadError) {
      setError(apiMessage(uploadError));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const view = async (mediaId) => {
    setBusy(true);
    setError('');
    try {
      const result = await getPrivateMediaAccess(mediaId);
      const url = result?.access?.url || result?.accessUrl || result?.url;
      if (!url) throw new Error('授权响应缺少访问地址');
      setSignedUrls((current) => ({ ...current, [mediaId]: url }));
    } catch (accessError) {
      setError(apiMessage(accessError));
    } finally {
      setBusy(false);
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
    onChange(values.filter((value) => value !== mediaId));
  };

  return (
    <div className="family-media-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={upload}
        disabled={busy || !childId || values.length >= MAX_ATTACHMENTS}
      />
      {values.map((mediaId, index) => (
        <div className="family-media-item" key={mediaId}>
          <span>{label} {index + 1}</span>
          <div className="family-inline-actions">
            <button type="button" className="family-button secondary" onClick={() => view(mediaId)} disabled={busy}>
              查看{label} {index + 1}
            </button>
            <button type="button" className="family-button secondary" onClick={() => remove(mediaId)} disabled={busy}>
              移除{label} {index + 1}
            </button>
          </div>
          {signedUrls[mediaId] && (
            <img className="family-media-preview" src={signedUrls[mediaId]} alt={`${label} ${index + 1}预览`} />
          )}
        </div>
      ))}
      {error && <p className="family-form-error" role="alert">{error}</p>}
    </div>
  );
};

export default PrivateMediaCollectionField;
