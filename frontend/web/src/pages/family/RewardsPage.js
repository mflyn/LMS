import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildResource } from '../../hooks/useChildResource';
import { createReward, listRewards, redeemReward } from '../../services/familyApi';

const newKey = (rewardId) => {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `reward:${rewardId}:${random}`;
};
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '操作失败，请重试。';

const RewardsPage = () => {
  const { selectedChild, selectedChildId } = useFamily();
  const load = useCallback(
    ({ childId, signal }) => listRewards({ childId, rewardPageSize: 100, ledgerPageSize: 100 }, signal),
    []
  );
  const resource = useChildResource({ load });
  const [data, setData] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState({ title: '', requiredStars: '' });
  const [redemption, setRedemption] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => setData(resource.data || null), [resource.data]);
  useEffect(() => {
    setCreateOpen(false);
    setRedemption(null);
    setError('');
    setMessage('');
  }, [selectedChildId]);

  const saveReward = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await createReward({
        childId: selectedChildId,
        title: rewardForm.title,
        requiredStars: Number(rewardForm.requiredStars)
      });
      setData((current) => ({ ...current, rewards: { ...current.rewards, items: [result.reward, ...(current.rewards?.items || [])] } }));
      setCreateOpen(false);
      setRewardForm({ title: '', requiredStars: '' });
      setMessage('奖励已创建。');
    } catch (saveError) {
      setError(messageFor(saveError));
    } finally {
      setBusy(false);
    }
  };

  const openRedemption = (reward) => {
    setRedemption({ reward, idempotencyKey: newKey(reward.rewardId), failed: false });
    setError('');
  };

  const redeem = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await redeemReward(redemption.reward.rewardId, redemption.idempotencyKey);
      setData((current) => ({
        ...current,
        starBalance: result.starBalance,
        rewards: {
          ...current.rewards,
          items: current.rewards.items.map((item) => item.rewardId === result.rewardId ? { ...item, status: result.status } : item)
        }
      }));
      setRedemption(null);
      setMessage(`已兑换，使用 ${result.spentStars} 颗星。`);
    } catch (redeemError) {
      setRedemption((current) => ({ ...current, failed: true }));
      setError(messageFor(redeemError));
    } finally {
      setBusy(false);
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;
  const rewards = data?.rewards?.items || [];
  const ledger = data?.ledger?.items || [];

  return (
    <section className="family-page family-page-wide" aria-labelledby="rewards-page-title">
      <div className="family-page-heading"><div><p className="family-eyebrow">{selectedChild.name}的正向激励</p><h1 id="rewards-page-title">星星与奖励</h1></div><button type="button" className="family-button primary" onClick={() => { setCreateOpen(true); setError(''); }}>新建奖励</button></div>
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {message && <p className="family-success-message" role="status">{message}</p>}
      {error && !redemption && <p className="family-form-error" role="alert">{error}</p>}
      {data && <div className="family-star-balance"><span>当前星星</span><strong>{data.starBalance}</strong></div>}
      <div className="family-section-grid">
        <section className="family-panel"><h2>奖励清单</h2>{data && rewards.length === 0 ? <p>暂无奖励。</p> : <div className="family-record-list">{rewards.map((reward) => <article className="family-record" key={reward.rewardId}><div className="family-record-main"><h3>{reward.title}</h3><p>{reward.requiredStars} 颗星 · {reward.status === 'active' ? '可兑换' : '已兑换'}</p></div>{reward.status === 'active' && <button type="button" className="family-button primary" aria-label={`兑换 ${reward.title}`} disabled={data.starBalance < reward.requiredStars} onClick={() => openRedemption(reward)}>兑换</button>}</article>)}</div>}</section>
        <section className="family-panel"><h2>星星流水</h2>{data && ledger.length === 0 ? <p>暂无流水。</p> : <ul className="family-list">{ledger.map((entry) => <li key={entry.ledgerEntryId}><span>{entry.type === 'spend' ? '兑换使用' : '成长获得'}</span><strong>{entry.type === 'spend' ? '-' : '+'}{entry.amount}</strong></li>)}</ul>}</section>
      </div>
      {createOpen && <section className="family-dialog" role="dialog" aria-modal="true" aria-labelledby="reward-editor-title"><form onSubmit={saveReward}><div className="family-page-heading"><h2 id="reward-editor-title">新建奖励</h2><button type="button" className="family-button secondary" onClick={() => setCreateOpen(false)}>关闭</button></div><div className="family-form-grid"><label>奖励名称<input required value={rewardForm.title} onChange={(event) => setRewardForm((value) => ({ ...value, title: event.target.value }))} /></label><label>所需星星<input required type="number" min="1" value={rewardForm.requiredStars} onChange={(event) => setRewardForm((value) => ({ ...value, requiredStars: event.target.value }))} /></label></div>{error && <p className="family-form-error" role="alert">{error}</p>}<button type="submit" className="family-button primary" disabled={busy}>保存奖励</button></form></section>}
      {redemption && <section className="family-dialog" role="dialog" aria-modal="true" aria-labelledby="reward-redeem-title"><div><div className="family-page-heading"><h2 id="reward-redeem-title">确认兑换</h2><button type="button" className="family-button secondary" onClick={() => setRedemption(null)}>关闭</button></div><p>使用 {redemption.reward.requiredStars} 颗星兑换“{redemption.reward.title}”？</p>{error && <p className="family-form-error" role="alert">{error}</p>}<button type="button" className="family-button primary" disabled={busy} onClick={redeem}>{redemption.failed ? '重试兑换' : '确认兑换'}</button></div></section>}
    </section>
  );
};

export default RewardsPage;
