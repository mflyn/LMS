import React, { useState } from 'react';
import { useFamily } from '../../contexts/FamilyContext';
import { createChild, setChildPin } from '../../services/familyApi';

const emptyChild = () => ({ name: '', nickname: '', grade: '', school: '' });
const messageFor = (error, fallback) => (
  error?.response?.data?.error?.message || error?.message || fallback
);

const ChildrenPage = () => {
  const { children, reload } = useFamily();
  const [childForm, setChildForm] = useState(emptyChild);
  const [childBusy, setChildBusy] = useState(false);
  const [childError, setChildError] = useState('');
  const [childMessage, setChildMessage] = useState('');
  const [pinStates, setPinStates] = useState({});

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
      await createChild({
        name,
        nickname: childForm.nickname.trim(),
        grade: childForm.grade.trim(),
        school: childForm.school.trim()
      });
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

  return (
    <section className="family-page family-page-wide" aria-labelledby="children-page-title">
      <div className="family-page-heading">
        <div>
          <p className="family-eyebrow">家庭成员与孩子入口</p>
          <h1 id="children-page-title">孩子</h1>
        </div>
      </div>

      <div className="family-children-layout">
        <section className="family-children-create" aria-labelledby="add-child-title">
          <h2 id="add-child-title">添加孩子</h2>
          <form className="family-form-grid" onSubmit={saveChild}>
            <label>孩子姓名<input required value={childForm.name} onChange={(event) => setChildForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>昵称<input value={childForm.nickname} onChange={(event) => setChildForm((current) => ({ ...current, nickname: event.target.value }))} /></label>
            <label>年级<input value={childForm.grade} onChange={(event) => setChildForm((current) => ({ ...current, grade: event.target.value }))} /></label>
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
                    <p>{[child.grade, child.school].filter(Boolean).join(' · ') || '档案信息待补充'}</p>
                  </div>
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
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
};

export default ChildrenPage;
