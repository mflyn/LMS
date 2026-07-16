import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { acceptParentInvitation, previewParentInvitation } from '../../services/familyApi';
import { invitationTokenFromHash } from '../../services/invitationReturn';

const roleOptions = [
  ['father', '爸爸'],
  ['mother', '妈妈'],
  ['guardian', '监护人'],
  ['other', '其他家长']
];

const errorMessage = (error) => error?.response?.data?.error?.message || '邀请暂时无法使用';

const ParentInvitationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => invitationTokenFromHash(location.hash));
  const [preview, setPreview] = useState(null);
  const [familyRole, setFamilyRole] = useState('guardian');
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [error, setError] = useState(token ? '' : '邀请链接不完整');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    previewParentInvitation(token)
      .then((payload) => {
        if (!active) return;
        setPreview(payload?.invitation || null);
        setStatus('ready');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(errorMessage(requestError));
        setStatus('error');
      });
    return () => { active = false; };
  }, [token]);

  const accept = async () => {
    setStatus('submitting');
    setError('');
    try {
      await acceptParentInvitation(token, familyRole);
      navigate('/app/family-members', { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
      setStatus('error');
    }
  };

  return (
    <main className="family-auth-page family-invitation-page">
      <section className="family-auth-panel" aria-labelledby="invitation-title">
        <p className="family-eyebrow">共同陪伴成长</p>
        <h1 id="invitation-title">加入家庭</h1>
        {status === 'loading' && <p aria-live="polite">正在核验邀请…</p>}
        {preview && (
          <div className="family-invitation-summary">
            <span>受邀加入</span>
            <strong>{preview.familyName}</strong>
            <p>邀请人：{preview.owner?.name || '家庭所有者'}</p>
            <p>有效期至：{new Date(preview.expiresAt).toLocaleString('zh-CN')}</p>
          </div>
        )}
        {preview && (
          <label className="family-field-wide" htmlFor="invitation-family-role">
            家庭身份
            <select
              id="invitation-family-role"
              value={familyRole}
              onChange={(event) => setFamilyRole(event.target.value)}
            >
              {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
        {error && <p className="family-form-error" role="alert">{error}</p>}
        {preview && (
          <button
            type="button"
            className="family-button primary"
            disabled={status === 'submitting'}
            onClick={accept}
          >
            {status === 'submitting' ? '正在加入…' : '接受邀请'}
          </button>
        )}
      </section>
    </main>
  );
};

export default ParentInvitationPage;
