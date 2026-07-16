import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authDestination, safeInvitationReturn } from '../services/invitationReturn';

const Register = () => {
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const { error, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnLocation = safeInvitationReturn(location.state?.from);
  const destination = authDestination(location.state?.from);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setValidationError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    const success = await register({
      username: form.username,
      name: form.name,
      email: form.email,
      password: form.password
    });
    setSubmitting(false);
    if (success) navigate(destination, { replace: true });
  };

  return (
    <main className="family-auth-page">
      <section className="family-auth-panel" aria-labelledby="parent-register-title">
        <p className="family-eyebrow">家庭成长追踪</p>
        <h1 id="parent-register-title">注册家长账号</h1>
        <p>创建账号后即可建立家庭成长空间。</p>
        <form onSubmit={submit}>
          <label htmlFor="register-username">用户名</label>
          <input id="register-username" value={form.username} onChange={update('username')} autoComplete="username" minLength="3" required />
          <label htmlFor="register-name">称呼</label>
          <input id="register-name" value={form.name} onChange={update('name')} autoComplete="name" required />
          <label htmlFor="register-email">邮箱</label>
          <input id="register-email" type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
          <label htmlFor="register-password">密码</label>
          <input id="register-password" type="password" value={form.password} onChange={update('password')} autoComplete="new-password" minLength="8" required />
          <label htmlFor="register-confirm-password">确认密码</label>
          <input id="register-confirm-password" type="password" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" minLength="8" required />
          {(validationError || error) && <p className="family-form-error" role="alert">{validationError || error}</p>}
          <button type="submit" className="family-button primary" disabled={submitting}>
            {submitting ? '正在注册…' : '注册'}
          </button>
        </form>
        <p className="family-auth-footer">
          已有账号？ <Link to="/login" state={returnLocation ? { from: returnLocation } : undefined}>返回登录</Link>
        </p>
      </section>
    </main>
  );
};

export default Register;
