import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnMistakes, reviewOwnMistake, createOwnMistake } from '../../services/childApi';

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
  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setShowForm(false);
    setNewSubject('');
    setNewReason('');
  };

  const saveNewMistake = async () => {
    if (!newSubject.trim() || !newReason.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createOwnMistake({ subject: newSubject.trim(), reason: newReason.trim() });
      resetForm();
      resource.reload();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

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

      <div className="child-inline-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="child-primary-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '记录新错题'}
        </button>
      </div>

      {showForm && (
        <section className="child-mistake-row" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #d9d9d9', borderRadius: 8 }}>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            科目
            <input
              type="text"
              className="child-input"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              disabled={saving}
              placeholder="例如：数学"
            />
          </label>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            错因
            <select
              className="child-input"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              disabled={saving}
            >
              <option value="">选择错因</option>
              <option value="concept">概念不懂</option>
              <option value="careless">粗心</option>
              <option value="misreading">审题错误</option>
              <option value="calculation">计算错误</option>
              <option value="memory">记忆不牢</option>
              <option value="method">方法不会</option>
              <option value="time">时间不够</option>
            </select>
          </label>
          <button
            type="button"
            className="child-primary-button"
            disabled={saving || !newSubject.trim() || !newReason.trim()}
            onClick={saveNewMistake}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </section>
      )}
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
