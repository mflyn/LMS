import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import LearningSourceLink from '../../components/family/LearningSourceLink';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import { createMistake, getMistake, getGrowthTask, listMistakes, updateMistake, uploadPrivateMedia, getPrivateMediaAccess } from '../../services/familyApi';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { assertLearningScope, isLearningId, isLearningDenied, learningReadMessage, sourceErrorCode } from '../../services/learningSources';

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

const ScopedMistakesPage = ({ session }) => {
  const { family, selectedChild, selectedChildId } = useFamily();
  const location = useLocation(), navigate = useNavigate();
  const [filters, setFilters] = useState({ subject: '', reviewStatus: '' });
  const load = useCallback(
    ({ childId, signal }) => listMistakes({ childId, ...filters, pageSize: 100 }, signal),
    [filters]
  );
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const denied = useRef(false);
  const canDelete = useCallback(() => isSessionCurrent(session) && !denied.current, [session]);
  const mediaDrafts = useDraftMedia({ canDelete });
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blankMistake());
  const [busy, setBusy] = useState(false);
  const [mediaUploadCount, setMediaUploadCount] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [readTarget, setReadTarget] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const generation = useRef(0), writing = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  const isCurrent = useCallback((version, scope) => mounted.current && generation.current === version
    && isSessionCurrent(session) && mutationGuard.isCurrentScope(scope), [session, mutationGuard]);
  const clearPrivate = useCallback(() => {
    generation.current += 1; writing.current = false; denied.current = true;
    mediaDrafts.cancel(); setItems([]); setForm(blankMistake()); setEditor(null); setReadTarget(null);
    setSavedId(null); setMessage(''); setBusy(false); setMediaUploadCount(0); setBlocked(true);
  }, [mediaDrafts]);

  useEffect(() => {
    if (isLearningDenied(resource.error)) clearPrivate();
    else if (!denied.current) setItems(resource.data?.items || []);
  }, [resource.data, resource.error, clearPrivate]);

  const closeEditor = () => {
    if (mediaUploadCount > 0) return;
    generation.current += 1; writing.current = false;
    mediaDrafts.cancel();
    setEditor(null); setForm(blankMistake()); setReadTarget(null); setBusy(false);
  };

  const trackMediaUpload = (active) => {
    setMediaUploadCount((current) => Math.max(0, current + (active ? 1 : -1)));
  };

  const setDetail = (item) => {
    setForm(item ? {
      ...blankMistake(),
      ...item,
      questionMediaIds: normalizedMediaIds(item, 'questionMediaIds', 'questionMediaId'),
      childAnswerMediaIds: normalizedMediaIds(item, 'childAnswerMediaIds', 'childAnswerMediaId')
    } : blankMistake());
    setEditor(item ? { mode: 'edit', item } : { mode: 'create' });
    setError('');
  };

  const read = async (target) => {
    if (!target || writing.current || denied.current || !isSessionCurrent(session)) return;
    const version = ++generation.current, scope = mutationGuard.captureScope();
    writing.current = true; setBusy(true); setError(''); setReadTarget(target);
    setEditor(null); setForm(blankMistake());
    try {
      if (target.kind === 'source') {
        const result = await getGrowthTask(target.id);
        if (!isCurrent(version, scope)) return;
        const source = assertLearningScope(result.task, 'taskId', target.id, family?.familyId, selectedChildId);
        setForm({ ...blankMistake(), subject: source.subject || '' });
        setEditor({ mode: 'create', sourceTaskId: source.taskId, sourceTitle: source.title });
      } else {
        const result = await getMistake(target.id);
        if (!isCurrent(version, scope)) return;
        assertLearningScope(result.mistake, 'mistakeId', target.id, family?.familyId, selectedChildId);
        if (target.recovery) mediaDrafts.commit();
        setDetail(result.mistake);
      }
      setReadTarget(null);
    } catch (cause) {
      if (!isCurrent(version, scope)) return;
      if (isLearningDenied(cause)) clearPrivate();
      setError(learningReadMessage(cause));
    } finally {
      if (isCurrent(version, scope)) { writing.current = false; setBusy(false); }
    }
  };
  const readRef = useRef(read); readRef.current = read;
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sourceId = params.get('sourceTaskId'), mistakeId = params.get('mistakeId');
    if (!sourceId && !mistakeId) return;
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
    if ((sourceId && mistakeId) || params.has('sourceMistakeId') || !isLearningId(sourceId || mistakeId)
      || (params.has('childId') && params.get('childId') !== selectedChildId)) {
      clearPrivate(); setError('当前身份无法读取此记录。'); return;
    }
    readRef.current({ kind: sourceId ? 'source' : 'detail', id: (sourceId || mistakeId).toLowerCase() });
  }, [location.pathname, location.search, navigate, selectedChildId, clearPrivate]);
  const openEditor = item => {
    if (busy || blocked || !isSessionCurrent(session)) return;
    if (item) { read({ kind: 'detail', id: item.mistakeId }); return; }
    generation.current += 1; mediaDrafts.cancel(); setReadTarget(null); setDetail(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editor || writing.current || editor.recovery || mediaUploadCount > 0 || blocked || !isSessionCurrent(session)) return;
    const mutationScope = mutationGuard.captureScope();
    const version = ++generation.current;
    writing.current = true; setBusy(true);
    setError('');
    setMessage(''); setSavedId(null);
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
    if (editor.mode === 'create' && editor.sourceTaskId) payload.sourceTaskId = editor.sourceTaskId;
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
    // Protect submitted uploads before the request can outlive this identity or dialog.
    mediaDrafts.retainSubmitted();
    try {
      const result = editor.mode === 'create'
        ? await createMistake({ childId: selectedChildId, ...payload })
        : await updateMistake(editor.item.mistakeId, payload);
      if (!isCurrent(version, mutationScope)) return;
      if (!result?.mistake?.mistakeId) throw new Error('保存结果尚未确认');
      mediaDrafts.commit();
      setItems((current) => editor.mode === 'create'
        ? [result.mistake, ...current]
        : current.map((item) => (item.mistakeId === result.mistake.mistakeId ? result.mistake : item)));
      setMessage(editor.mode === 'create' ? '错题已记录。' : '复盘已保存。');
      setSavedId(result.mistake.mistakeId); setEditor(null); setForm(blankMistake());
    } catch (saveError) {
      if (!isCurrent(version, mutationScope)) return;
      if (isLearningDenied(saveError) && saveError?.response?.status !== 404) {
        clearPrivate(); setError('当前身份无法继续查看或修改错题。'); return;
      }
      if (sourceErrorCode(saveError) === 'SOURCE_SERVICE_UNAVAILABLE') {
        // This error is explicitly pre-write, so these uploads are still owned drafts.
        [...form.questionMediaIds, ...form.childAnswerMediaIds].forEach(mediaId => {
          if (editor.mode === 'create') mediaDrafts.replace(mediaId);
        });
        setError('来源服务暂不可用，本次尚未保存，可手动重试。');
      } else if (!saveError?.response || saveError.response.status >= 500) {
        const id = editor.item?.mistakeId || saveError?.response?.data?.error?.details?.resourceId;
        setEditor(previous => ({ ...previous, recovery: { id: isLearningId(id) ? id : null } }));
        setError('保存结果尚未确认，附件已保留。请先读取原错题或核对列表，避免重复记录。');
      } else setError(messageFor(saveError));
    } finally {
      if (isCurrent(version, mutationScope)) { writing.current = false; setBusy(false); }
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;
  const mediaVersion = generation.current, mediaScope = mutationGuard.captureScope();
  const mediaCurrent = () => isCurrent(mediaVersion, mediaScope) && !denied.current;
  const guardMedia = fn => async (...args) => {
    if (!mediaCurrent()) throw new Error('当前身份已变化');
    try {
      const result = await fn(...args);
      if (!mediaCurrent()) throw new Error('当前身份已变化');
      return result;
    } catch (cause) {
      if (mediaCurrent() && [401, 403].includes(cause?.response?.status)) {
        clearPrivate(); setError('当前身份无法继续查看或修改错题。');
      }
      throw cause;
    }
  };
  const mediaApi = { uploadPrivateMedia: guardMedia(uploadPrivateMedia), getPrivateMediaAccess: guardMedia(getPrivateMediaAccess) };

  return (
    <section className="family-page family-page-wide" aria-labelledby="mistakes-page-title">
      <div className="family-page-heading">
        <div>{!blocked && <p className="family-eyebrow">{selectedChild.name}的学习复盘</p>}<h1 id="mistakes-page-title">错题</h1><p>错题仅用于智育学习复盘</p></div>
        <button type="button" className="family-button primary" disabled={busy || blocked || resource.state === 'loading'} onClick={() => openEditor(null)}>记录错题</button>
      </div>
      <div className="family-filter-bar" aria-label="错题筛选">
        <label>学科筛选<input value={filters.subject} onChange={(event) => setFilters((value) => ({ ...value, subject: event.target.value }))} /></label>
        <label>复习状态<select value={filters.reviewStatus} onChange={(event) => setFilters((value) => ({ ...value, reviewStatus: event.target.value }))}><option value="">全部</option><option value="pending">待复习</option><option value="reviewed">已复习</option><option value="mastered">已掌握</option></select></label>
      </div>
      {message && <p className="family-success-message" role="status">{message}</p>}
      {error && !editor && <p className="family-form-error" role="alert">{error}</p>}
      {savedId && !editor && !blocked && <button type="button" className="family-button secondary" onClick={() => read({ kind: 'detail', id: savedId })}>查看已保存错题</button>}
      {readTarget && !blocked && <button type="button" className="family-button secondary" disabled={busy} onClick={() => read(readTarget)}>{readTarget.recovery ? '继续读取原错题' : '重试读取'}</button>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'retryable_error', 'error'].includes(resource.state) && items.length === 0 && <p className="family-empty-copy">暂无错题</p>}
      <div className="family-record-list">
        {!blocked && items.map((item) => (
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
      {editor && !blocked && (
        <FamilyDialog labelledBy="mistake-editor-title" onClose={closeEditor}>
          <form onSubmit={save}>
            <div className="family-page-heading"><h2 id="mistake-editor-title">{editor.mode === 'create' ? '记录错题' : '错题复盘'}</h2><button type="button" className="family-button secondary" disabled={mediaUploadCount > 0} onClick={closeEditor}>关闭</button></div>
            {error && <p className="family-form-error" role="alert">{error}</p>}
            {editor.sourceTitle && <p>来源任务：{editor.sourceTitle}</p>}
            {editor.mode === 'edit' && <div className="family-inline-actions"><LearningSourceLink item={editor.item} />
              <button type="button" className="family-button secondary" disabled={busy || mediaUploadCount > 0 || Boolean(editor.recovery)}
                onClick={() => navigate(`/app/tasks?sourceMistakeId=${encodeURIComponent(editor.item.mistakeId)}`)}>创建订正任务</button></div>}
            {editor.recovery && <button type="button" className="family-button secondary" disabled={busy} onClick={() => {
              if (editor.recovery.id) read({ kind: 'detail', id: editor.recovery.id, recovery: true });
              else { closeEditor(); resource.reload(); setMessage('请核对错题列表，避免重复记录。'); }
            }}>{editor.recovery.id ? '继续读取原错题' : '核对错题列表'}</button>}
            <fieldset className="task-editor-fields" disabled={busy || Boolean(editor.recovery)}>
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
              <PrivateMediaCollectionField {...mediaApi} label="题目附件" childId={selectedChildId} purpose="mistake_question" values={form.questionMediaIds} onUploaded={(...args) => { if (mediaCurrent()) mediaDrafts.replace(...args); }} onRemoved={id => { if (mediaCurrent()) mediaDrafts.remove(id); }} onBusyChange={value => { if (mediaCurrent()) trackMediaUpload(value); }} onChange={mediaIds => { if (mediaCurrent()) setForm(value => ({ ...value, questionMediaIds: mediaIds })); }} />
              <PrivateMediaCollectionField {...mediaApi} label="答案附件" childId={selectedChildId} purpose="mistake_answer" values={form.childAnswerMediaIds} onUploaded={(...args) => { if (mediaCurrent()) mediaDrafts.replace(...args); }} onRemoved={id => { if (mediaCurrent()) mediaDrafts.remove(id); }} onBusyChange={value => { if (mediaCurrent()) trackMediaUpload(value); }} onChange={mediaIds => { if (mediaCurrent()) setForm(value => ({ ...value, childAnswerMediaIds: mediaIds })); }} />
            </div>
            <button type="submit" className="family-button primary" disabled={busy || mediaUploadCount > 0 || resource.state === 'loading'}>{editor.mode === 'create' ? '保存错题' : '保存复盘'}</button>
            </fieldset>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

const MistakesPage = () => {
  const { family, selectedChildId, childScopeVersion } = useFamily();
  const [, setRevision] = useState(0);
  useEffect(() => subscribeSessionChanges(() => setRevision(value => value + 1)), []);
  const session = captureSession('parent');
  if (!session) return <p role="alert">请重新登录后查看错题。</p>;
  return <ScopedMistakesPage key={JSON.stringify([session.actorId, session.revision,
    family?.familyId, selectedChildId, childScopeVersion])} session={session} />;
};
export default MistakesPage;
