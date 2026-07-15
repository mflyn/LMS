import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import {
  createOwnMistake,
  deleteOwnPrivateMedia,
  getOwnPrivateMediaAccess,
  listOwnMistakes,
  reviewOwnMistake,
  uploadOwnPrivateMedia
} from '../../services/childApi';

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
const normalizedMediaIds = (item, field, legacyField) => {
  if (Array.isArray(item?.[field])) return item[field];
  return item?.[legacyField] ? [item[legacyField]] : [];
};

const ChildMediaCollection = (props) => (
  <PrivateMediaCollectionField
    {...props}
    ownScope
    className="child-media-field"
    controlClassName="child-secondary-button"
    uploadPrivateMedia={uploadOwnPrivateMedia}
    getPrivateMediaAccess={getOwnPrivateMediaAccess}
  />
);

const ChildMistakeCreateForm = ({ onCancel, onCreated, setError, setMessage }) => {
  const mediaDrafts = useDraftMedia({ deleteMedia: deleteOwnPrivateMedia });
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [questionMediaIds, setQuestionMediaIds] = useState([]);
  const [childAnswerMediaIds, setChildAnswerMediaIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const trackUpload = (active) => setUploadCount((current) => Math.max(0, current + (active ? 1 : -1)));
  const close = () => {
    mediaDrafts.cancel();
    onCancel();
  };

  const save = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !reason.trim() || saving || uploadCount > 0) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await createOwnMistake({
        subject: subject.trim(),
        reason: reason.trim(),
        childExplanation: explanation.trim() || undefined,
        questionMediaIds,
        childAnswerMediaIds
      });
      const created = result?.mistake;
      if (!created?.mistakeId) throw new Error('保存响应缺少错题记录');
      mediaDrafts.commit();
      onCreated(created);
    } catch (error) {
      setError(messageFor(error, '暂时无法记录错题。'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="child-form child-mistake-row child-mistake-create-form" onSubmit={save}>
      <h2>记录新错题</h2>
      <label>
        科目
        <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={saving} maxLength={100} placeholder="例如：数学" required />
      </label>
      <label>
        错因
        <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} required>
          <option value="">选择错因</option>
          {REASON_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        错题说明（选填）
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} disabled={saving} maxLength={1000} placeholder="可以写下题目、自己的答案或哪里没想明白" />
      </label>
      <div className="child-media-grid">
        <ChildMediaCollection label="题目附件" purpose="mistake_question" values={questionMediaIds} onChange={setQuestionMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
        <ChildMediaCollection label="答案附件" purpose="mistake_answer" values={childAnswerMediaIds} onChange={setChildAnswerMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
      </div>
      <div className="child-inline-actions">
        <button type="button" className="child-secondary-button" disabled={saving || uploadCount > 0} onClick={close}>取消</button>
        <button type="submit" className="child-primary-button" disabled={saving || uploadCount > 0 || !subject.trim() || !reason.trim()}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  );
};

const ChildMistakeRow = ({ item, disabled, onBusyChange, onReviewed, setError, setMessage }) => {
  const mediaDrafts = useDraftMedia({ deleteMedia: deleteOwnPrivateMedia });
  const title = item.knowledgePointName || item.subject;
  const [explanation, setExplanation] = useState(item.childExplanation || '');
  const [questionMediaIds, setQuestionMediaIds] = useState(
    normalizedMediaIds(item, 'questionMediaIds', 'questionMediaId')
  );
  const [childAnswerMediaIds, setChildAnswerMediaIds] = useState(
    normalizedMediaIds(item, 'childAnswerMediaIds', 'childAnswerMediaId')
  );
  const [dirtyGroups, setDirtyGroups] = useState({ question: false, answer: false });
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    setExplanation(item.childExplanation || '');
    setQuestionMediaIds(normalizedMediaIds(item, 'questionMediaIds', 'questionMediaId'));
    setChildAnswerMediaIds(normalizedMediaIds(item, 'childAnswerMediaIds', 'childAnswerMediaId'));
    setDirtyGroups({ question: false, answer: false });
  }, [item]);

  const trackUpload = (active) => setUploadCount((current) => Math.max(0, current + (active ? 1 : -1)));
  const updateQuestionMedia = (mediaIds) => {
    setQuestionMediaIds(mediaIds);
    setDirtyGroups((current) => ({ ...current, question: true }));
  };
  const updateAnswerMedia = (mediaIds) => {
    setChildAnswerMediaIds(mediaIds);
    setDirtyGroups((current) => ({ ...current, answer: true }));
  };

  const saveReview = async (mastered) => {
    if (disabled || uploadCount > 0) return;
    onBusyChange(item.mistakeId);
    setMessage('');
    setError('');
    const payload = {
      childExplanation: explanation.trim() || undefined,
      reviewed: true,
      mastered
    };
    if (dirtyGroups.question) payload.questionMediaIds = questionMediaIds;
    if (dirtyGroups.answer) payload.childAnswerMediaIds = childAnswerMediaIds;
    try {
      const result = await reviewOwnMistake(item.mistakeId, payload);
      mediaDrafts.commit();
      onReviewed(result.mistake);
    } catch (error) {
      setError(messageFor(error));
    } finally {
      onBusyChange(null);
    }
  };

  return (
    <article className="child-mistake-row">
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
        <textarea maxLength={1000} value={explanation} onChange={(event) => setExplanation(event.target.value)} disabled={disabled} />
      </label>
      <div className="child-media-grid">
        <ChildMediaCollection label={`题目附件（${title}）`} purpose="mistake_question" values={questionMediaIds} onChange={updateQuestionMedia} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
        <ChildMediaCollection label={`答案附件（${title}）`} purpose="mistake_answer" values={childAnswerMediaIds} onChange={updateAnswerMedia} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
      </div>
      <div className="child-inline-actions">
        <button type="button" className="child-secondary-button" aria-label={`我还不会 ${title}`} disabled={disabled || uploadCount > 0} onClick={() => saveReview(false)}>我还不会</button>
        <button type="button" className="child-primary-button" aria-label={`我已经会了 ${title}`} disabled={disabled || uploadCount > 0} onClick={() => saveReview(true)}>我已经会了</button>
      </div>
    </article>
  );
};

const ChildMistakesPage = () => {
  const loadMistakes = useCallback(
    ({ signal }) => listOwnMistakes({ mastered: false, pageSize: 100 }, signal),
    []
  );
  const resource = useChildDataResource({ load: loadMistakes });
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (resource.data?.items) setItems(resource.data.items);
  }, [resource.data]);

  const created = (mistake) => {
    setItems((current) => [mistake, ...current.filter((item) => item.mistakeId !== mistake.mistakeId)]);
    setShowForm(false);
    setMessage('错题已记录。');
  };

  const reviewed = (mistake) => {
    setItems((current) => (
      mistake.mastered
        ? current.filter((item) => item.mistakeId !== mistake.mistakeId)
        : current.map((item) => (item.mistakeId === mistake.mistakeId ? mistake : item))
    ));
    setMessage(mistake.mastered ? '做得好，这道错题已掌握。' : '已记录，之后继续复习。');
  };

  return (
    <section className="child-page" aria-labelledby="child-mistakes-title">
      <div className="child-page-heading">
        <div><p className="child-eyebrow">慢慢弄懂每一道题</p><h1 id="child-mistakes-title">错题</h1></div>
      </div>
      {message && <p className="child-success-message" role="status">{message}</p>}
      {error && <p className="child-form-error" role="alert">{error}</p>}
      <div className="child-inline-actions child-mistake-create-actions">
        {!showForm && (
          <button type="button" className="child-primary-button" onClick={() => { setMessage(''); setError(''); setShowForm(true); }}>记录新错题</button>
        )}
      </div>
      {showForm && <ChildMistakeCreateForm onCancel={() => setShowForm(false)} onCreated={created} setError={setError} setMessage={setMessage} />}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'error', 'retryable_error'].includes(resource.state) && items.length === 0 && <p className="child-empty-copy">暂无待复习错题。</p>}
      <div className="child-mistake-list">
        {items.map((item) => (
          <ChildMistakeRow key={item.mistakeId} item={item} disabled={Boolean(busyId)} onBusyChange={setBusyId} onReviewed={reviewed} setError={setError} setMessage={setMessage} />
        ))}
      </div>
    </section>
  );
};

export default ChildMistakesPage;
