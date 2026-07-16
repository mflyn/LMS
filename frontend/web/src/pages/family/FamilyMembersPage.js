import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FamilyDialog from '../../components/family/FamilyDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import {
  createParentInvitation,
  getActiveParentInvitation,
  leaveFamily,
  removeFamilyMember,
  revokeParentInvitation,
  transferFamilyOwnership
} from '../../services/familyApi';

const roleLabels = {
  father: '爸爸',
  mother: '妈妈',
  guardian: '监护人',
  other: '其他家长'
};

const requestError = (error) => error?.response?.data?.error?.message || '操作失败，请稍后重试';

const FamilyMembersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { family, reload } = useFamily();
  const [invitation, setInvitation] = useState(null);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const isOwner = family?.ownerParentId === user?.id;
  const parents = useMemo(() => family?.parents || [], [family]);
  const secondParent = parents.find((parent) => !parent.isOwner) || null;

  useEffect(() => {
    if (!isOwner || !family?.familyId || parents.length >= 2) {
      setInvitation(null);
      return undefined;
    }
    let active = true;
    getActiveParentInvitation(family.familyId)
      .then((payload) => { if (active) setInvitation(payload?.invitation || null); })
      .catch((currentError) => { if (active) setError(requestError(currentError)); });
    return () => { active = false; };
  }, [family?.familyId, isOwner, parents.length]);

  const createInvitation = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = await createParentInvitation(family.familyId);
      const created = payload?.invitation;
      setInvitation(created);
      setInvitationUrl(`${window.location.origin}/family/invitations#token=${encodeURIComponent(created.token)}`);
      setNotice('邀请已创建。链接只在本页本次显示，请立即发送给第二家长。');
    } catch (currentError) {
      setError(requestError(currentError));
    } finally {
      setBusy(false);
    }
  };

  const revokeInvitation = async () => {
    setBusy(true);
    setError('');
    try {
      await revokeParentInvitation(family.familyId, invitation.invitationId);
      setInvitation(null);
      setInvitationUrl('');
      setNotice('邀请已撤销。');
    } catch (currentError) {
      setError(requestError(currentError));
    } finally {
      setBusy(false);
    }
  };

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setNotice('邀请链接已复制。');
    } catch {
      setNotice('无法自动复制，请手动选择邀请链接。');
    }
  };

  const confirmAction = async () => {
    setBusy(true);
    setError('');
    try {
      if (action?.type === 'transfer') {
        await transferFamilyOwnership(family.familyId, action.parent.parentId);
        await reload();
        setNotice('家庭所有权已转移。');
      } else if (action?.type === 'remove') {
        await removeFamilyMember(family.familyId, action.parent.parentId);
        await reload();
        setNotice('第二家长已移除，历史成长记录仍会保留。');
      } else if (action?.type === 'leave') {
        await leaveFamily(family.familyId);
        await reload();
        navigate('/app/today', { replace: true });
      }
      setAction(null);
    } catch (currentError) {
      setError(requestError(currentError));
    } finally {
      setBusy(false);
    }
  };

  const slots = [parents[0] || null, parents[1] || null];

  return (
    <section className="family-page family-page-wide family-members-page">
      <div className="family-page-heading">
        <div>
          <p className="family-eyebrow">家庭共管</p>
          <h1>家庭成员</h1>
          <p>两位家长共享日常成长管理，家庭所有者负责成员治理。</p>
        </div>
        {!isOwner && (
          <button type="button" className="family-button secondary" onClick={() => setAction({ type: 'leave' })}>
            退出家庭
          </button>
        )}
      </div>

      {error && <p className="family-form-error" role="alert">{error}</p>}
      {notice && <p className="family-success-message" aria-live="polite">{notice}</p>}

      <div className="family-parent-slots">
        {slots.map((parent, index) => (
          <article className={`family-parent-slot ${parent ? '' : 'is-empty'}`} data-testid="parent-slot" key={parent?.parentId || `slot-${index}`}>
            <span className="family-parent-slot-label">家长席位 {index + 1}</span>
            {parent ? (
              <>
                <div className="family-parent-name-row">
                  <h2>{parent.name}</h2>
                  {parent.isOwner && <span className="family-owner-badge">家庭所有者</span>}
                </div>
                <p>{roleLabels[parent.familyRole] || roleLabels.other}</p>
                {isOwner && !parent.isOwner && (
                  <div className="family-inline-actions">
                    <button type="button" className="family-button secondary" onClick={() => setAction({ type: 'transfer', parent })} aria-label={`转移给${parent.name}`}>
                      转移所有权
                    </button>
                    <button type="button" className="family-button danger" onClick={() => setAction({ type: 'remove', parent })} aria-label={`移除${parent.name}`}>
                      移除
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>等待第二家长</h2>
                <p>通过一次性邀请链接加入，共同管理孩子成长。</p>
              </>
            )}
          </article>
        ))}
      </div>

      {isOwner && !secondParent && (
        <section className="family-invitation-panel" aria-labelledby="parent-invitation-heading">
          <div>
            <h2 id="parent-invitation-heading">第二家长邀请</h2>
            <p>邀请 72 小时有效；新建链接只显示一次。</p>
          </div>
          {!invitation && (
            <button type="button" className="family-button primary" disabled={busy} onClick={createInvitation}>
              邀请第二家长
            </button>
          )}
          {invitation && (
            <div className="family-invitation-active">
              <p>有效期至：{new Date(invitation.expiresAt).toLocaleString('zh-CN')}</p>
              {invitationUrl && (
                <label className="family-invitation-link">
                  本次邀请链接
                  <input value={invitationUrl} readOnly onFocus={(event) => event.target.select()} />
                </label>
              )}
              <div className="family-inline-actions">
                {invitationUrl && <button type="button" className="family-button secondary" onClick={copyInvitation}>复制链接</button>}
                <button type="button" className="family-button danger" disabled={busy} onClick={revokeInvitation}>撤销邀请</button>
              </div>
            </div>
          )}
        </section>
      )}

      {action && (
        <FamilyDialog labelledBy="family-governance-dialog-title" onClose={() => !busy && setAction(null)}>
          <h2 id="family-governance-dialog-title">
            {action.type === 'transfer' ? '确认转移所有权' : action.type === 'remove' ? '确认移除家长' : '确认退出家庭'}
          </h2>
          <p>
            {action.type === 'transfer'
              ? `${action.parent.name} 将成为家庭所有者，你仍保留共同管理权限。`
              : '成员关系会立即失效，但已经形成的孩子成长记录和操作历史会保留。'}
          </p>
          <div className="family-inline-actions">
            <button type="button" className="family-button secondary" disabled={busy} onClick={() => setAction(null)}>取消</button>
            <button type="button" className="family-button danger" disabled={busy} onClick={confirmAction}>
              {action.type === 'transfer' ? '确认转移' : action.type === 'remove' ? '确认移除' : '确认退出'}
            </button>
          </div>
        </FamilyDialog>
      )}
    </section>
  );
};

export default FamilyMembersPage;
