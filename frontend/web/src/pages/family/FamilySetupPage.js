import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createFamily } from '../../services/familyApi';
import { useFamily } from '../../contexts/FamilyContext';
import FamilyPageState from '../../components/family/FamilyPageState';

const FamilySetupPage = () => {
  const [familyName, setFamilyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { familyStatus, reload } = useFamily();

  if (familyStatus === 'ready') {
    return <Navigate to="/app/today" replace />;
  }

  if (familyStatus === 'unknown') {
    return <main className="family-route-state"><FamilyPageState state="loading" /></main>;
  }

  if (familyStatus === 'error') {
    return <main className="family-route-state"><FamilyPageState state="retryable_error" onRetry={reload} /></main>;
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!familyName.trim()) {
      setError('请填写家庭名称');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createFamily({ familyName: familyName.trim() });
      await reload();
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || '创建家庭失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="family-auth-page">
      <section className="family-auth-panel" aria-labelledby="family-setup-title">
        <p className="family-eyebrow">第一步</p>
        <h1 id="family-setup-title">创建家庭</h1>
        <p>先建立家庭空间，再邀请孩子开始记录成长。</p>
        <form onSubmit={submit}>
          <label htmlFor="family-name">家庭名称</label>
          <input
            id="family-name"
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
            autoComplete="organization"
            required
          />
          <p className="family-field-hint">时区将使用 Asia/Shanghai。</p>
          {error && <p className="family-form-error" role="alert">{error}</p>}
          <button type="submit" className="family-button primary" disabled={submitting}>
            {submitting ? '正在创建…' : '创建家庭'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default FamilySetupPage;
