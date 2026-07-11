import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useChildAuth } from '../../contexts/ChildAuthContext';

const ChildPinLoginPage = () => {
  const navigate = useNavigate();
  const { status, error, login, clearError } = useChildAuth();
  const [form, setForm] = useState({ familyId: '', childId: '', pin: '' });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/child/today" replace />;

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const familyId = form.familyId.trim();
    const childId = form.childId.trim();
    if (!familyId || !childId) {
      setFormError('请填写家庭 ID 和孩子 ID。');
      return;
    }
    if (!/^[0-9]{4,6}$/.test(form.pin)) {
      setFormError('PIN 需要填写 4 到 6 位数字。');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    clearError();
    const pin = form.pin;
    try {
      const accepted = await login({ familyId, childId, pin });
      if (accepted) navigate('/child/today', { replace: true });
    } finally {
      setForm((current) => ({ ...current, pin: '' }));
      setSubmitting(false);
    }
  };

  return (
    <main className="child-login-page">
      <section className="child-login-panel" aria-labelledby="child-login-heading">
        <p className="child-eyebrow">家庭成长追踪</p>
        <h1 id="child-login-heading">孩子登录</h1>
        <form className="child-form" onSubmit={handleSubmit} noValidate>
          <label>
            家庭 ID
            <input
              value={form.familyId}
              onChange={updateField('familyId')}
              autoComplete="organization"
              disabled={submitting}
            />
          </label>
          <label>
            孩子 ID
            <input
              value={form.childId}
              onChange={updateField('childId')}
              autoComplete="username"
              disabled={submitting}
            />
          </label>
          <label>
            PIN
            <input
              type="password"
              value={form.pin}
              onChange={updateField('pin')}
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="one-time-code"
              disabled={submitting}
            />
          </label>
          {(formError || error) && <p className="child-form-error" role="alert">{formError || error}</p>}
          <button type="submit" className="child-primary-button" disabled={submitting}>
            {submitting ? '正在登录...' : '进入我的成长空间'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default ChildPinLoginPage;
