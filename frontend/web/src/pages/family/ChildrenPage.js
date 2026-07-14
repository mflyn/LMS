import React, { useState } from 'react';
import FamilyDialog from '../../components/family/FamilyDialog';
import PrivateMediaField from '../../components/family/PrivateMediaField';
import { useFamily } from '../../contexts/FamilyContext';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import { createChild, setChildPin, updateChild } from '../../services/familyApi';

const emptyChild = () => ({ name: '', nickname: '', grade: '', school: '' });
const messageFor = (error, fallback) => (
  error?.response?.data?.error?.message || error?.message || fallback
);
const joined = (value) => Array.isArray(value) ? value.join('，') : '';
const splitList = (value) => [...new Set(
  String(value || '').split(/[，,]/).map((item) => item.trim()).filter(Boolean)
)];
const profileFor = (child) => ({
  name: child.name || '',
  grade: child.grade ?? '',
  school: child.school || '',
  textbookVersion: child.textbookVersion || '',
  interests: joined(child.interests),
  weakSubjects: joined(child.weakSubjects),
  sportsPreferences: joined(child.sportsPreferences),
  artInterests: joined(child.artInterests),
  laborHabits: joined(child.laborHabits),
  moralGoals: joined(child.moralGoals),
  avatarMediaId: child.avatarMediaId || null
});

const ChildrenPage = () => {
  const { family, children, reload } = useFamily();
  const [childForm, setChildForm] = useState(emptyChild);
  const [childBusy, setChildBusy] = useState(false);
  const [childError, setChildError] = useState('');
  const [childMessage, setChildMessage] = useState('');
  const [pinStates, setPinStates] = useState({});
  const [profileEditor, setProfileEditor] = useState(null);
  const [profileForm, setProfileForm] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMediaBusy, setProfileMediaBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const avatarDrafts = useDraftMedia();

  const updatePinState = (childId, patch) => {
    setPinStates((current) => ({
      ...current,
      [childId]: { value: '', busy: false, error: '', message: '', ...current[childId], ...patch }
    }));
  };

  const saveChild = async (event) => {
    event.preventDefault();
    const name = childForm.name.trim();
    if (!name) {
      setChildError('请填写孩子姓名');
      return;
    }

    setChildBusy(true);
    setChildError('');
    setChildMessage('');
    try {
      const payload = { name };
      if (childForm.nickname.trim()) payload.nickname = childForm.nickname.trim();
      if (childForm.grade) payload.grade = Number(childForm.grade);
      if (childForm.school.trim()) payload.school = childForm.school.trim();
      await createChild(payload);
      setChildForm(emptyChild());
      setChildMessage('孩子已添加。');
      await reload();
    } catch (error) {
      setChildError(messageFor(error, '添加孩子失败，请重试。'));
    } finally {
      setChildBusy(false);
    }
  };

  const savePin = async (event, child) => {
    event.preventDefault();
    const pin = pinStates[child.childId]?.value || '';
    if (!/^\d{4,6}$/.test(pin)) {
      updatePinState(child.childId, { error: 'PIN 需为 4 到 6 位数字', message: '' });
      return;
    }

    updatePinState(child.childId, { busy: true, error: '', message: '' });
    try {
      await setChildPin(child.childId, pin);
      updatePinState(child.childId, { value: '', busy: false, message: 'PIN 已更新。' });
    } catch (error) {
      updatePinState(child.childId, {
        value: '',
        busy: false,
        error: messageFor(error, '更新 PIN 失败，请重试。')
      });
    }
  };

  const openProfile = (child) => {
    avatarDrafts.cancel();
    setProfileEditor(child);
    setProfileForm(profileFor(child));
    setProfileError('');
    setProfileMediaBusy(false);
  };

  const closeProfile = () => {
    if (profileBusy || profileMediaBusy) return;
    avatarDrafts.cancel();
    setProfileEditor(null);
    setProfileForm(null);
    setProfileError('');
    setProfileMediaBusy(false);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const name = profileForm.name.trim();
    if (!name) {
      setProfileError('请填写孩子姓名');
      return;
    }

    setProfileBusy(true);
    setProfileError('');
    try {
      await updateChild(profileEditor.childId, {
        name,
        grade: profileForm.grade === '' ? null : Number(profileForm.grade),
        school: profileForm.school.trim(),
        textbookVersion: profileForm.textbookVersion.trim(),
        interests: splitList(profileForm.interests),
        weakSubjects: splitList(profileForm.weakSubjects),
        sportsPreferences: splitList(profileForm.sportsPreferences),
        artInterests: splitList(profileForm.artInterests),
        laborHabits: splitList(profileForm.laborHabits),
        moralGoals: splitList(profileForm.moralGoals),
        avatarMediaId: profileForm.avatarMediaId || null
      });
      avatarDrafts.commit();
      setProfileEditor(null);
      setProfileForm(null);
      setChildMessage('孩子档案已更新。');
      await reload();
    } catch (error) {
      setProfileError(messageFor(error, '更新孩子档案失败，请重试。'));
    } finally {
      setProfileBusy(false);
    }
  };

  const updateProfileField = (field, value) => setProfileForm((current) => ({ ...current, [field]: value }));

  return (
    <section className="family-page family-page-wide" aria-labelledby="children-page-title">
      <div className="family-page-heading">
        <div>
          <p className="family-eyebrow">家庭成员与孩子入口</p>
          <h1 id="children-page-title">孩子</h1>
          {family?.familyId && <p className="family-id-line"><span>家庭 ID</span><code>{family.familyId}</code></p>}
        </div>
      </div>

      <div className="family-children-layout">
        <section className="family-children-create" aria-labelledby="add-child-title">
          <h2 id="add-child-title">添加孩子</h2>
          <form className="family-form-grid" onSubmit={saveChild}>
            <label>孩子姓名<input required value={childForm.name} onChange={(event) => setChildForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>昵称<input value={childForm.nickname} onChange={(event) => setChildForm((current) => ({ ...current, nickname: event.target.value }))} /></label>
            <label>年级<select value={childForm.grade} onChange={(event) => setChildForm((current) => ({ ...current, grade: event.target.value }))}><option value="">未选择</option>{[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{grade} 年级</option>)}</select></label>
            <label>学校<input value={childForm.school} onChange={(event) => setChildForm((current) => ({ ...current, school: event.target.value }))} /></label>
            {childError && <p className="family-form-error family-field-wide" role="alert">{childError}</p>}
            {childMessage && <p className="family-success-message family-field-wide" role="status">{childMessage}</p>}
            <div className="family-field-wide">
              <button type="submit" className="family-button primary" disabled={childBusy}>
                {childBusy ? '正在添加' : '添加孩子'}
              </button>
            </div>
          </form>
        </section>

        <section className="family-children-list" aria-labelledby="children-list-title">
          <h2 id="children-list-title">孩子档案</h2>
          {children.length === 0 && <p className="family-empty-copy">还没有孩子档案。</p>}
          <div className="family-record-list">
            {children.map((child) => {
              const pinState = pinStates[child.childId] || {};
              return (
                <article className="family-record family-child-record" data-testid={`child-row-${child.childId}`} key={child.childId}>
                  <div className="family-record-main">
                    <h2>{child.name}</h2>
                    <p>{[child.grade ? `${child.grade} 年级` : '', child.school].filter(Boolean).join(' · ') || '档案信息待补充'}</p>
                    <p className="family-id-line"><span>孩子 ID</span><code>{child.childId}</code></p>
                  </div>
                  <div className="family-child-actions">
                    <button
                      type="button"
                      className="family-button secondary"
                      aria-label={`编辑${child.name}档案`}
                      onClick={() => openProfile(child)}
                    >
                      编辑档案
                    </button>
                  <form className="family-pin-form" onSubmit={(event) => savePin(event, child)}>
                    <label htmlFor={`child-pin-${child.childId}`}>{child.name}的 PIN</label>
                    <div className="family-inline-actions">
                      <input
                        id={`child-pin-${child.childId}`}
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="new-password"
                        value={pinState.value || ''}
                        onChange={(event) => updatePinState(child.childId, {
                          value: event.target.value,
                          error: '',
                          message: ''
                        })}
                      />
                      <button type="submit" className="family-button secondary" disabled={pinState.busy}>
                        {pinState.busy ? '正在设置' : '设置 PIN'}
                      </button>
                    </div>
                    {pinState.error && <p className="family-form-error" role="alert">{pinState.error}</p>}
                    {pinState.message && <p className="family-success-message" role="status">{pinState.message}</p>}
                  </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      {profileEditor && profileForm && (
        <FamilyDialog labelledBy="child-profile-editor-title" onClose={closeProfile}>
          <form onSubmit={saveProfile}>
            <div className="family-page-heading">
              <h2 id="child-profile-editor-title">编辑孩子档案</h2>
              <button type="button" className="family-button secondary" disabled={profileBusy || profileMediaBusy} onClick={closeProfile}>关闭</button>
            </div>
            <PrivateMediaField
              label="头像"
              childId={profileEditor.childId}
              purpose="avatar"
              value={profileForm.avatarMediaId}
              onChange={(value) => updateProfileField('avatarMediaId', value)}
              onUploaded={avatarDrafts.replace}
              onRemoved={avatarDrafts.remove}
              onBusyChange={setProfileMediaBusy}
            />
            <div className="family-form-grid">
              <label>孩子姓名<input required value={profileForm.name} onChange={(event) => updateProfileField('name', event.target.value)} /></label>
              <label>年级<select value={profileForm.grade} onChange={(event) => updateProfileField('grade', event.target.value)}><option value="">未选择</option>{[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{grade} 年级</option>)}</select></label>
              <label>学校<input value={profileForm.school} onChange={(event) => updateProfileField('school', event.target.value)} /></label>
              <label>教材版本<input value={profileForm.textbookVersion} onChange={(event) => updateProfileField('textbookVersion', event.target.value)} /></label>
              <label>兴趣<textarea rows="3" value={profileForm.interests} onChange={(event) => updateProfileField('interests', event.target.value)} /></label>
              <label>薄弱学科<textarea rows="3" value={profileForm.weakSubjects} onChange={(event) => updateProfileField('weakSubjects', event.target.value)} /></label>
              <label>体育偏好<textarea rows="3" value={profileForm.sportsPreferences} onChange={(event) => updateProfileField('sportsPreferences', event.target.value)} /></label>
              <label>艺术兴趣<textarea rows="3" value={profileForm.artInterests} onChange={(event) => updateProfileField('artInterests', event.target.value)} /></label>
              <label>劳动习惯<textarea rows="3" value={profileForm.laborHabits} onChange={(event) => updateProfileField('laborHabits', event.target.value)} /></label>
              <label>品德目标<textarea rows="3" value={profileForm.moralGoals} onChange={(event) => updateProfileField('moralGoals', event.target.value)} /></label>
            </div>
            <p className="family-form-hint">多个项目可使用中文或英文逗号分隔。</p>
            {profileError && <p className="family-form-error" role="alert">{profileError}</p>}
            <button type="submit" className="family-button primary" disabled={profileBusy || profileMediaBusy}>
              {profileMediaBusy ? '头像上传中' : (profileBusy ? '正在保存' : '保存孩子档案')}
            </button>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

export default ChildrenPage;
