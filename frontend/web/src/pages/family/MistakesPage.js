import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import { createMistake, listMistakes, updateMistake } from '../../services/familyApi';

const REASONS = [
  ['concept', '概念不清'], ['calculation', '计算错误'], ['careless', '粗心'],
  ['method', '方法不当'], ['other', '其他']
];
const blankMistake = () => ({
  subject: '', knowledgePointName: '', reason: 'concept', correctAnswer: '',
  parentNote: '', childExplanation: '', reviewReminderDate: '', corrected: false,
  reviewed: false, mastered: false, questionMediaIds: [], childAnswerMediaIds: []
});
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '保存失败，请重试。';
const normalizedMediaIds = (item, field, legacyField) => {
  if (Array.isArray(item?.[field])) return item[field];
  return item?.[legacyField] ? [item[legacyField]] : [];
};
const sameMediaIds = (left, right) => left.length === right.length
  && left.every((mediaId, index) => mediaId === right[index]);

const MistakesPage = () => {
  const { selectedChild, selectedChildId } = useFamily();
  const [filters, setFilters] = useState({ subject: '', reviewStatus: '' });
  const load = useCallback(
    ({ childId, signal }) => listMistakes({ childId, ...filters, pageSize: 100 }, signal),
    [filters]
  );
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const mediaDrafts = useDraftMedia();
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blankMistake());
  const [busy, setBusy] = useState(false);
  const [mediaUploadCount, setMediaUploadCount] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => setItems(resource.data?.items || []), [resource.data]);
  useEffect(() => {
    mediaDrafts.cancel();
    setEditor(null);
    setError('');
    setMessage('');
    setBusy(false);
    setMediaUploadCount(0);
  }, [mediaDrafts, selectedChildId]);

  const closeEditor = () => {
    if (mediaUploadCount > 0) return;
    mediaDrafts.cancel();
    setEditor(null);
  };

  const trackMediaUpload = (active) => {
    setMediaUploadCount((current) => Math.max(0, current + (active ? 1 : -1)));
  };

  const openEditor = (item) => {
    setForm(item ? {
      ...blankMistake(),
      ...item,
      questionMediaIds: normalizedMediaIds(item, 'questionMediaIds', 'questionMediaId'),
      childAnswerMediaIds: normalizedMediaIds(item, 'childAnswerMediaIds', 'childAnswerMediaId')
    } : blankMistake());
    setEditor(item ? { mode: 'edit', item } : { mode: 'create' });
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (mediaUploadCount > 0) return;
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    const payload = {
      subject: form.subject,
      knowledgePointName: form.knowledgePointName,
      reason: form.reason,
      correctAnswer: form.correctAnswer,
      parentNote: form.parentNote,
      childExplanation: form.childExplanation,
      reviewReminderDate: form.reviewReminderDate || undefined,
      corrected: form.corrected,
      reviewed: form.reviewed,
      mastered: form.mastered
    };
    [
      ['questionMediaIds', 'questionMediaId'],
      ['childAnswerMediaIds', 'childAnswerMediaId']
    ].forEach(([field, legacyField]) => {
      const previous = editor.mode === 'edit'
        ? normalizedMediaIds(editor.item, field, legacyField)
        : [];
      const next = form[field];
      if (editor.mode === 'create' || !sameMediaIds(previous, next)) payload[field] = next;
    });
    try {
      const result = editor.mode === 'create'
        ? await createMistake({ childId: selectedChildId, ...payload })
        : await updateMistake(editor.item.mistakeId, payload);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      mediaDrafts.commit();
      setItems((current) => editor.mode === 'create'
        ? [result.mistake, ...current]
        : current.map((item) => (item.mistakeId === result.mistake.mistakeId ? result.mistake : item)));
      setMessage(editor.mode === 'create' ? '错题已记录。' : '复盘已保存。');
      setEditor(null);
    } catch (saveError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setError(messageFor(saveError));
    } finally {
      setBusy(false);
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;

  return (
    <section className="family-page family-page-wide" aria-labelledby="mistakes-page-title">
      <div className="family-page-heading">
        <div><p className="family-eyebrow">{selectedChild.name}的学习复盘</p><h1 id="mistakes-page-title">错题</h1><p>错题仅用于智育学习复盘</p></div>
        <button type="button" className="family-button primary" disabled={resource.state === 'loading'} onClick={() => openEditor(null)}>记录错题</button>
      </div>
      <div className="family-filter-bar" aria-label="错题筛选">
        <label>学科筛选<input value={filters.subject} onChange={(event) => setFilters((value) => ({ ...value, subject: event.target.value }))} /></label>
        <label>复习状态<select value={filters.reviewStatus} onChange={(event) => setFilters((value) => ({ ...value, reviewStatus: event.target.value }))}><option value="">全部</option><option value="pending">待复习</option><option value="reviewed">已复习</option><option value="mastered">已掌握</option></select></label>
      </div>
      {message && <p className="family-success-message" role="status">{message}</p>}
      {error && <p className="family-form-error" role="alert">{error}</p>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'retryable_error', 'error'].includes(resource.state) && items.length === 0 && <p className="family-empty-copy">暂无错题</p>}
      <div className="family-record-list">
        {items.map((item) => (
          <article className="family-record" key={item.mistakeId}>
            <div className="family-record-main">
              <div className="family-inline-actions"><span className="family-dimension is-academic">智育</span><span>{item.subject}</span><span>{item.mastered ? '已掌握' : item.reviewed ? '已复习' : '待复习'}</span></div>
              <h2>{item.knowledgePointName || item.subject}</h2>
              <p>{REASONS.find(([value]) => value === item.reason)?.[1] || item.reason}{item.reviewReminderDate ? ` · ${item.reviewReminderDate} 复习` : ''}</p>
              <p>题目附件 {normalizedMediaIds(item, 'questionMediaIds', 'questionMediaId').length} · 答案附件 {normalizedMediaIds(item, 'childAnswerMediaIds', 'childAnswerMediaId').length}</p>
            </div>
            <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`复盘 ${item.knowledgePointName || item.subject}`} onClick={() => openEditor(item)}>复盘</button>
          </article>
        ))}
      </div>
      {editor && (
        <FamilyDialog labelledBy="mistake-editor-title" onClose={closeEditor}>
          <form onSubmit={save}>
            <div className="family-page-heading"><h2 id="mistake-editor-title">{editor.mode === 'create' ? '记录错题' : '错题复盘'}</h2><button type="button" className="family-button secondary" disabled={mediaUploadCount > 0} onClick={closeEditor}>关闭</button></div>
            <div className="family-form-grid">
              <label>学科<input required disabled={editor.mode === 'edit'} value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} /></label>
              <label>知识点<input value={form.knowledgePointName} onChange={(event) => setForm((value) => ({ ...value, knowledgePointName: event.target.value }))} /></label>
              <label>错误原因<select value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))}>{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>提醒复习日期<input type="date" value={form.reviewReminderDate || ''} onChange={(event) => setForm((value) => ({ ...value, reviewReminderDate: event.target.value }))} /></label>
            </div>
            <label className="family-field-wide">正确答案<textarea value={form.correctAnswer} onChange={(event) => setForm((value) => ({ ...value, correctAnswer: event.target.value }))} /></label>
            <label className="family-field-wide">孩子解释<textarea value={form.childExplanation} onChange={(event) => setForm((value) => ({ ...value, childExplanation: event.target.value }))} /></label>
            <label className="family-field-wide">家长备注<textarea value={form.parentNote} onChange={(event) => setForm((value) => ({ ...value, parentNote: event.target.value }))} /></label>
            <div className="family-checkbox-row">
              <label className="family-checkbox"><input type="checkbox" checked={form.corrected} onChange={(event) => setForm((value) => ({ ...value, corrected: event.target.checked }))} />已订正</label>
              <label className="family-checkbox"><input type="checkbox" checked={form.reviewed} onChange={(event) => setForm((value) => ({ ...value, reviewed: event.target.checked }))} />已复习</label>
              <label className="family-checkbox"><input type="checkbox" checked={form.mastered} onChange={(event) => setForm((value) => ({ ...value, mastered: event.target.checked }))} />已掌握</label>
            </div>
            <div className="family-form-grid">
              <PrivateMediaCollectionField label="题目附件" childId={selectedChildId} purpose="mistake_question" values={form.questionMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackMediaUpload} onChange={(mediaIds) => setForm((value) => ({ ...value, questionMediaIds: mediaIds }))} />
              <PrivateMediaCollectionField label="答案附件" childId={selectedChildId} purpose="mistake_answer" values={form.childAnswerMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackMediaUpload} onChange={(mediaIds) => setForm((value) => ({ ...value, childAnswerMediaIds: mediaIds }))} />
            </div>
            <button type="submit" className="family-button primary" disabled={busy || mediaUploadCount > 0 || resource.state === 'loading'}>{editor.mode === 'create' ? '保存错题' : '保存复盘'}</button>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

export default MistakesPage;
