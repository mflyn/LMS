import React from 'react';

const stateCopy = {
  loading: '正在加载家庭信息…',
  empty: '尚未添加孩子，完成家庭初始化后可继续管理成长任务。',
  partial: '部分家庭数据暂不可用，其余信息仍可继续查看。',
  retryable_error: '暂时无法加载家庭信息，请重试。'
};

const FamilyPageState = ({ state, onRetry }) => {
  if (state === 'ready') return null;

  return (
    <section className="family-state" aria-live="polite">
      <p>{stateCopy[state]}</p>
      {state === 'retryable_error' && (
        <button type="button" className="family-button secondary" onClick={onRetry}>重新加载</button>
      )}
    </section>
  );
};

export default FamilyPageState;
