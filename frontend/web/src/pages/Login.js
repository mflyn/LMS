import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { error, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destination = location.state?.from?.pathname || '/app/today';

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const success = await login(username, password);
    setSubmitting(false);
    if (success) navigate(destination, { replace: true });
  };

  return (
    <main className="family-auth-page">
      <section className="family-auth-panel" aria-labelledby="parent-login-title">
        <p className="family-eyebrow">家庭成长追踪</p>
        <h1 id="parent-login-title">家长登录</h1>
        <p>查看孩子的学习、运动、艺术、劳动与习惯成长。</p>
        <form onSubmit={submit}>
          <label htmlFor="parent-username">用户名</label>
          <input
            id="parent-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="parent-password">密码</label>
          <input
            id="parent-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="family-form-error" role="alert">{error}</p>}
          <button type="submit" className="family-button primary" disabled={submitting}>
            {submitting ? '正在登录…' : '登录'}
          </button>
        </form>
        <p className="family-auth-footer">还没有账号？ <Link to="/register">注册家长账号</Link></p>
      </section>
    </main>
  );
};

export default Login;
