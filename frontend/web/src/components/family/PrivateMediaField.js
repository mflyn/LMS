import React, { useId, useState } from 'react';
import {
  getPrivateMediaAccess as requestPrivateMediaAccess,
  uploadPrivateMedia as requestPrivateMediaUpload
} from '../../services/familyApi';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const apiMessage = (error) => error?.response?.data?.error?.message || error?.message || '图片处理失败，请重试。';

const PrivateMediaField = ({
  label,
  childId,
  purpose,
  value,
  onChange,
  onUploaded,
  onRemoved,
  uploadPrivateMedia = requestPrivateMediaUpload,
  getPrivateMediaAccess = requestPrivateMediaAccess
}) => {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedUrl, setSignedUrl] = useState('');

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setSignedUrl('');

    if (!ALLOWED_TYPES.has(file.type)) {
      setError('仅支持 JPEG、PNG 或 WebP 图片');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('图片不能超过 10 MiB');
      return;
    }

    setBusy(true);
    try {
      const result = await uploadPrivateMedia({ childId, purpose, file });
      const mediaId = result?.media?.mediaId || result?.mediaId;
      if (!mediaId) throw new Error('上传响应缺少 mediaId');
      onUploaded?.(mediaId, value);
      onChange(mediaId);
    } catch (uploadError) {
      setError(apiMessage(uploadError));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const view = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await getPrivateMediaAccess(value);
      const url = result?.access?.url || result?.accessUrl || result?.url;
      if (!url) throw new Error('授权响应缺少访问地址');
      setSignedUrl(url);
    } catch (accessError) {
      setError(apiMessage(accessError));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setSignedUrl('');
    setError('');
    onRemoved?.(value);
    onChange(null);
  };

  return (
    <div className="family-media-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={upload}
        disabled={busy || !childId}
      />
      {value && (
        <div className="family-inline-actions">
          <button type="button" className="family-button secondary" onClick={view} disabled={busy}>
            查看{label}
          </button>
          <button type="button" className="family-button secondary" onClick={remove} disabled={busy}>
            移除{label}
          </button>
        </div>
      )}
      {signedUrl && <img className="family-media-preview" src={signedUrl} alt={`${label}预览`} />}
      {error && <p className="family-form-error" role="alert">{error}</p>}
    </div>
  );
};

export default PrivateMediaField;
