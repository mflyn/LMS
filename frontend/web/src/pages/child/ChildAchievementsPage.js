import React, { useCallback } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnRewards, listOwnTasks } from '../../services/childApi';

const ResourceError = ({ label, resource }) => {
  if (!['error', 'retryable_error'].includes(resource.state)) return null;
  return (
    <div className="child-resource-error" role="group" aria-label={`${label}加载失败`}>
      <strong>{label}</strong>
      <FamilyDataState
        state={resource.state}
        error={resource.error}
        onRetry={resource.state === 'retryable_error' ? resource.reload : undefined}
      />
    </div>
  );
};

const ChildAchievementsPage = () => {
  const loadRewards = useCallback(
    ({ signal }) => listOwnRewards({ rewardPageSize: 100, ledgerPageSize: 100 }, signal),
    []
  );
  const loadConfirmedTasks = useCallback(
    ({ signal }) => listOwnTasks({ status: 'confirmed', pageSize: 100 }, signal),
    []
  );
  const rewards = useChildDataResource({ load: loadRewards });
  const confirmedTasks = useChildDataResource({ load: loadConfirmedTasks });
  const rewardItems = rewards.data?.rewards?.items || [];
  const ledgerItems = rewards.data?.ledger?.items || [];
  const taskItems = confirmedTasks.data?.items || [];

  return (
    <section className="child-page" aria-labelledby="child-achievements-title">
      <div className="child-page-heading">
        <div>
          <p className="child-eyebrow">看见自己的每次进步</p>
          <h1 id="child-achievements-title">成就</h1>
        </div>
      </div>

      {rewards.state === 'loading' && confirmedTasks.state === 'loading' && <FamilyDataState state="loading" />}
      <div className="child-resource-errors">
        <ResourceError label="星星与奖励" resource={rewards} />
        <ResourceError label="已确认任务" resource={confirmedTasks} />
      </div>

      {rewards.data && (
        <section className="child-star-balance" aria-label="当前星星">
          <span>我的星星</span>
          <strong>{rewards.data.starBalance}</strong>
        </section>
      )}

      <div className="child-section-grid">
        <section className="child-section" aria-labelledby="available-rewards-title">
          <h2 id="available-rewards-title">家庭奖励</h2>
          {rewards.data && rewardItems.length === 0 && <p className="child-empty-copy">暂无奖励。</p>}
          <div className="child-reward-list">
            {rewardItems.map((reward) => (
              <article className="child-reward-row" key={reward.rewardId}>
                <h3>{reward.title}</h3>
                <p>{reward.requiredStars} 颗星 · {reward.status === 'active' ? '可以请家长兑换' : '已兑换'}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="child-section" aria-labelledby="star-ledger-title">
          <h2 id="star-ledger-title">星星记录</h2>
          {rewards.data && ledgerItems.length === 0 && <p className="child-empty-copy">暂无星星记录。</p>}
          <ul className="child-ledger-list">
            {ledgerItems.map((entry) => (
              <li key={entry.ledgerEntryId}>
                <span>{entry.type === 'spend' ? '兑换奖励' : '完成成长任务'}</span>
                <strong>{entry.type === 'spend' ? '-' : '+'}{entry.amount}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="child-section" aria-labelledby="confirmed-task-title">
        <h2 id="confirmed-task-title">已经完成的成长</h2>
        {confirmedTasks.data && taskItems.length === 0 && <p className="child-empty-copy">暂无已确认任务。</p>}
        <ul className="child-confirmed-list">
          {taskItems.map((item) => <li key={item.taskId}>{item.title}</li>)}
        </ul>
      </section>
    </section>
  );
};

export default ChildAchievementsPage;
