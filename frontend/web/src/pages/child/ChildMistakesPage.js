import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { listOwnMistakes, reviewOwnMistake, createOwnMistake } from '../../services/childApi';

const REASON_OPTIONS = [
  ['concept', '概念不懂'],
  ['careless', '粗心'],
  ['misreading', '审题错误'],
  ['calculation', '计算错误'],
  ['memory', '记忆不牢'],
  ['method', '方法不会'],
  ['time', '时间不够']
];

const messageFor = (error, fallback = '暂时无法保存复习结果。') => error?.response?.data?.error?.message
  || error?.message
  || fallback;

const reasonLabelFor = (reason) => REASON_OPTIONS.find(([value]) => value === reason)?.[1] || reason;

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
  const [newExplanation, setNewExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setShowForm(false);
    setNewSubject('');
    setNewReason('');
    setNewExplanation('');
  };

  const saveNewMistake = async () => {
    if (!newSubject.trim() || !newReason.trim()) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await createOwnMistake({
        subject: newSubject.trim(),
        reason: newReason.trim(),
        childExplanation: newExplanation.trim() || undefined
      });
      const created = result?.mistake;
      if (!created?.mistakeId) throw new Error('保存响应缺少错题记录');

      setItems((current) => [
        created,
        ...current.filter((item) => item.mistakeId !== created.mistakeId)
      ]);
      setDrafts((current) => ({
        ...current,
        [created.mistakeId]: created.childExplanation || ''
      }));
      resetForm();
      setMessage('错题已记录。');
    } catch (e) {
      setError(messageFor(e, '暂时无法记录错题。'));
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

      <div className="child-inline-actions child-mistake-create-actions">
        <button
          type="button"
          className="child-primary-button"
          disabled={saving}
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? '取消' : '记录新错题'}
        </button>
      </div>

      {showForm && (
        <form
          className="child-form child-mistake-row child-mistake-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveNewMistake();
          }}
        >
          <h2>记录新错题</h2>
          <label>
            科目
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              disabled={saving}
              maxLength={100}
              placeholder="例如：数学"
              required
            />
          </label>
          <label>
            错因
            <select
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              disabled={saving}
              required
            >
              <option value="">选择错因</option>
              {REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            错题说明（选填）
            <textarea
              value={newExplanation}
              onChange={(event) => setNewExplanation(event.target.value)}
              disabled={saving}
              maxLength={1000}
              placeholder="可以写下题目、自己的答案或哪里没想明白"
            />
          </label>
          <button
            type="submit"
            className="child-primary-button"
            disabled={saving || !newSubject.trim() || !newReason.trim()}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </form>
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
                <div>
                  <span className="child-dimension is-academic">智育</span>
                  <span>{item.subject}</span>
                  <span>{reasonLabelFor(item.reason)}</span>
                </div>
                <h2>{title}</h2>
                <span>{item.reviewed ? '继续巩固' : '待复习'}</span>
              </div>
              <label>
                我的解释（{title}）
                <textarea
                  maxLength={1000}
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
