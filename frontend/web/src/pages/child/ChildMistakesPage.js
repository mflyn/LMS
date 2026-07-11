import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnMistakes, reviewOwnMistake } from '../../services/childApi';

const messageFor = (error) => error?.response?.data?.error?.message
  || error?.message
  || '暂时无法保存复习结果。';

const ChildMistakesPage = () => {
  const loadMistakes = useCallback(
    ({ signal }) => listOwnMistakes({ mastered: false, pageSize: 100 }, signal),
    []
  );
  const resource = useChildDataResource({ load: loadMistakes });
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resource.data?.items) return;
    setItems(resource.data.items);
    setDrafts((current) => resource.data.items.reduce((next, item) => ({
      ...next,
      [item.mistakeId]: current[item.mistakeId] ?? item.childExplanation ?? ''
    }), {}));
  }, [resource.data]);

  const updateDraft = (mistakeId) => (event) => {
    setDrafts((current) => ({ ...current, [mistakeId]: event.target.value }));
  };

  const saveReview = async (item, mastered) => {
    if (busyId) return;
    setBusyId(item.mistakeId);
    setMessage('');
    setError('');
    try {
      const explanation = drafts[item.mistakeId]?.trim();
      const result = await reviewOwnMistake(item.mistakeId, {
        childExplanation: explanation || undefined,
        reviewed: true,
        mastered
      });
      const updated = result.mistake;
      setItems((current) => (
        updated.mastered
          ? current.filter((entry) => entry.mistakeId !== updated.mistakeId)
          : current.map((entry) => (entry.mistakeId === updated.mistakeId ? updated : entry))
      ));
      setDrafts((current) => ({
        ...current,
        [updated.mistakeId]: updated.childExplanation || ''
      }));
      setMessage(updated.mastered ? '做得好，这道错题已掌握。' : '已记录，之后继续复习。');
    } catch (reviewError) {
      setError(messageFor(reviewError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="child-page" aria-labelledby="child-mistakes-title">
      <div className="child-page-heading">
        <div>
          <p className="child-eyebrow">慢慢弄懂每一道题</p>
          <h1 id="child-mistakes-title">错题</h1>
        </div>
      </div>

      {message && <p className="child-success-message" role="status">{message}</p>}
      {error && <p className="child-form-error" role="alert">{error}</p>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}

      {!['loading', 'error', 'retryable_error'].includes(resource.state) && items.length === 0 && (
        <p className="child-empty-copy">暂无待复习错题。</p>
      )}

      <div className="child-mistake-list">
        {items.map((item) => {
          const title = item.knowledgePointName || item.subject;
          const busy = busyId === item.mistakeId;
          return (
            <article className="child-mistake-row" key={item.mistakeId}>
              <div className="child-record-heading">
                <div><span className="child-dimension is-academic">智育</span><span>{item.subject}</span></div>
                <h2>{title}</h2>
                <span>{item.reviewed ? '继续巩固' : '待复习'}</span>
              </div>
              <label>
                我的解释（{title}）
                <textarea
                  maxLength={500}
                  value={drafts[item.mistakeId] || ''}
                  onChange={updateDraft(item.mistakeId)}
                  disabled={busy}
                />
              </label>
              <div className="child-inline-actions">
                <button
                  type="button"
                  className="child-secondary-button"
                  aria-label={`我还不会 ${title}`}
                  disabled={Boolean(busyId)}
                  onClick={() => saveReview(item, false)}
                >
                  我还不会
                </button>
                <button
                  type="button"
                  className="child-primary-button"
                  aria-label={`我已经会了 ${title}`}
                  disabled={Boolean(busyId)}
                  onClick={() => saveReview(item, true)}
                >
                  我已经会了
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ChildMistakesPage;
