import React from 'react';

const stateCopy = {
  loading: '正在加载数据…',
  empty: '暂无数据。',
  partial: '部分数据暂不可用',
  error: '无法加载数据。',
  retryable_error: '暂时无法加载数据，请重试。'
};

const sourceLabels = {
  tasks: '任务数据',
  mistakes: '错题数据',
  logs: '成长记录',
  weeklyReport: '周报数据',
  analytics: '分析数据',
  progress: '进度数据',
  homework: '作业数据',
  notifications: '通知数据',
  resources: '资源数据'
};

const errorMessage = (error) => error?.response?.data?.error?.message || error?.message;

const FamilyDataState = ({ state, unavailableSources = [], error, onRetry }) => {
  if (state === 'ready') return null;

  return (
    <section className={`family-data-state is-${state}`} aria-live="polite">
      <p>{stateCopy[state] || stateCopy.retryable_error}</p>
      {state === 'error' && errorMessage(error) && <p className="family-form-error">{errorMessage(error)}</p>}
      {state === 'partial' && unavailableSources.length > 0 && (
        <ul aria-label="暂不可用的数据来源">
          {unavailableSources.map((source) => <li key={source}>{sourceLabels[source] || source}</li>)}
        </ul>
      )}
      {state === 'retryable_error' && onRetry && (
        <button type="button" className="family-button secondary" onClick={onRetry}>
          重新加载数据
        </button>
      )}
    </section>
  );
};

export default FamilyDataState;
