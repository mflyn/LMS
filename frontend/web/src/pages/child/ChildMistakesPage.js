import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import LearningSourceLink from '../../components/family/LearningSourceLink';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { useDraftMedia } from '../../hooks/useDraftMedia';
import {
  createOwnMistake,
  deleteOwnPrivateMedia,
  getOwnPrivateMediaAccess,
  getOwnMistake,
  getOwnTask,
  listOwnMistakes,
  reviewOwnMistake,
  uploadOwnPrivateMedia
} from '../../services/childApi';
import { captureSession, isSessionCurrent, loadChildSession, subscribeSessionChanges } from '../../services/familySession';
import { assertLearningScope, isLearningDenied, isLearningId, learningReadMessage, sourceErrorCode } from '../../services/learningSources';

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

// Only an uncertainty bit survives a form/session change, never the command or private contents.
const unknownCreateKey = child => `family-growth.child-mistake-unknown.v1:${child.familyId}:${child.childId}`;
const hasUnknownCreate = child => {
  try { return sessionStorage.getItem(unknownCreateKey(child)) !== null; }
  catch { return true; }
};

const ChildMediaCollection = ({ isCurrent, onDenied, ...props }) => {
  const guard = fn => async (...args) => {
    if (!isCurrent()) throw new Error('当前身份已变化');
    try {
      const result = await fn(...args);
      if (!isCurrent()) throw new Error('当前身份已变化');
      return result;
    } catch (cause) {
      if (isCurrent() && [401, 403].includes(cause?.response?.status)) onDenied();
      throw cause;
    }
  };
  return (
  <PrivateMediaCollectionField
    {...props}
    onChange={(...args) => { if (isCurrent()) props.onChange?.(...args); }}
    onUploaded={(...args) => { if (isCurrent()) props.onUploaded?.(...args); }}
    onRemoved={(...args) => { if (isCurrent()) props.onRemoved?.(...args); }}
    onBusyChange={(...args) => { if (isCurrent()) props.onBusyChange?.(...args); }}
    ownScope
    className="child-media-field"
    controlClassName="child-secondary-button"
    uploadPrivateMedia={guard(uploadOwnPrivateMedia)}
    getPrivateMediaAccess={guard(getOwnPrivateMediaAccess)}
  />
  );
};

const useActiveMistakeView = ownerCurrent => {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return useCallback(() => alive.current && ownerCurrent(), [ownerCurrent]);
};

const ChildMistakeCreateForm = ({ onCancel, onCreated, onWriteStart, onWriteSettled, onWriteRejected, setError, setMessage, isCurrent: ownerCurrent, onDenied, source }) => {
  const isCurrent = useActiveMistakeView(ownerCurrent);
  const mediaDrafts = useDraftMedia({ deleteMedia: deleteOwnPrivateMedia, canDelete: ownerCurrent });
  const [subject, setSubject] = useState(source?.subject || '');
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [questionMediaIds, setQuestionMediaIds] = useState([]);
  const [childAnswerMediaIds, setChildAnswerMediaIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [recovery, setRecovery] = useState(null);
  const writing = useRef(false);

  const trackUpload = (active) => setUploadCount((current) => Math.max(0, current + (active ? 1 : -1)));
  const close = () => {
    mediaDrafts.cancel();
    onCancel();
  };

  const save = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !reason.trim() || writing.current || recovery || uploadCount > 0 || !isCurrent()) return;
    if (!onWriteStart()) return;
    writing.current = true;
    setSaving(true);
    setMessage('');
    setError('');
    mediaDrafts.retainSubmitted();
    try {
      const result = await createOwnMistake({
        ...(source ? { sourceTaskId: source.taskId } : {}),
        subject: subject.trim(),
        reason: reason.trim(),
        childExplanation: explanation.trim() || undefined,
        questionMediaIds,
        childAnswerMediaIds
      });
      if (!isCurrent()) return;
      const created = result?.mistake;
      if (!created?.mistakeId) throw new Error('保存响应缺少错题记录');
      mediaDrafts.commit();
      onCreated(created);
    } catch (error) {
      if (!isCurrent()) return;
      if ([401, 403].includes(error?.response?.status)) { onDenied(); return; }
      if (sourceErrorCode(error) === 'SOURCE_SERVICE_UNAVAILABLE') {
        onWriteRejected();
        [...questionMediaIds, ...childAnswerMediaIds].forEach(id => mediaDrafts.replace(id));
        setError('来源服务暂不可用，本次尚未保存，可手动重试。');
      } else if (!error?.response || error.response.status >= 500) {
        const id = error?.response?.data?.error?.details?.resourceId;
        setRecovery({ id: isLearningId(id) ? id : null });
        setError('保存结果尚未确认，附件已保留。请先读取原错题或核对列表。');
      } else { onWriteRejected(); setError(messageFor(error, '暂时无法记录错题。')); }
    } finally {
      onWriteSettled();
      if (isCurrent()) { writing.current = false; setSaving(false); }
    }
  };
  const readRecovery = async () => {
    if (!isCurrent() || writing.current || !recovery?.id) return;
    writing.current = true; setSaving(true); setError('');
    try {
      const result = await getOwnMistake(recovery.id);
      if (!isCurrent()) return;
      const child = loadChildSession()?.child;
      assertLearningScope(result.mistake, 'mistakeId', recovery.id, child?.familyId, child?.childId);
      mediaDrafts.commit(); onCreated(result.mistake);
    } catch (cause) {
      if (!isCurrent()) return;
      if (isLearningDenied(cause)) onDenied();
      else setError(learningReadMessage(cause));
    } finally { if (isCurrent()) { writing.current = false; setSaving(false); } }
  };

  return (
    <form className="child-form child-mistake-row child-mistake-create-form" onSubmit={save}>
      <h2>记录新错题</h2>
      {source && <p>来源任务：{source.title}</p>}
      {recovery && (recovery.id
        ? <button type="button" className="child-secondary-button" disabled={saving} onClick={readRecovery}>继续读取原错题</button>
        : <p>保存结果未知，请重新读取错题列表并核对，避免重复记录。</p>)}
      <fieldset className="task-editor-fields" disabled={saving || Boolean(recovery)}>
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
        <ChildMediaCollection isCurrent={isCurrent} onDenied={onDenied} label="题目附件" purpose="mistake_question" values={questionMediaIds} onChange={setQuestionMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
        <ChildMediaCollection isCurrent={isCurrent} onDenied={onDenied} label="答案附件" purpose="mistake_answer" values={childAnswerMediaIds} onChange={setChildAnswerMediaIds} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
      </div>
      <div className="child-inline-actions">
        <button type="submit" className="child-primary-button" disabled={saving || uploadCount > 0 || !subject.trim() || !reason.trim()}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      </fieldset>
      <button type="button" className="child-secondary-button" disabled={saving || uploadCount > 0} onClick={close}>取消</button>
    </form>
  );
};

const ChildMistakeRow = ({ item, hideSource, disabled, onBusyChange, onReviewed, setError, setMessage, isCurrent: ownerCurrent, onDenied, onDetail }) => {
  const isCurrent = useActiveMistakeView(ownerCurrent);
  const mediaDrafts = useDraftMedia({ deleteMedia: deleteOwnPrivateMedia, canDelete: ownerCurrent });
  const writing = useRef(false);
  const [uncertain, setUncertain] = useState(false);
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
    setUncertain(false);
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
    if (disabled || uncertain || writing.current || uploadCount > 0 || !isCurrent()) return;
    writing.current = true;
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
    mediaDrafts.retainSubmitted();
    try {
      const result = await reviewOwnMistake(item.mistakeId, payload);
      if (!isCurrent()) return;
      mediaDrafts.commit();
      onReviewed(result.mistake);
    } catch (error) {
      if (!isCurrent()) return;
      if ([401, 403, 404].includes(error?.response?.status)) { onDenied(); return; }
      if (!error?.response || error.response.status >= 500) {
        setUncertain(true); setError('保存结果尚未确认，请重新读取原错题。');
      } else setError(messageFor(error));
    } finally {
      if (isCurrent()) { writing.current = false; onBusyChange(null); }
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
        <div className="child-inline-actions">
          {!hideSource && <LearningSourceLink item={item} role="student" />}
          <button type="button" className="child-secondary-button" disabled={disabled || uploadCount > 0} onClick={() => onDetail(item.mistakeId)}>查看详情 {title}</button>
        </div>
      </div>
      <label>
        我的解释（{title}）
        <textarea maxLength={1000} value={explanation} onChange={(event) => setExplanation(event.target.value)} disabled={disabled} />
      </label>
      <div className="child-media-grid">
        <ChildMediaCollection isCurrent={isCurrent} onDenied={onDenied} readOnly={uncertain} label={`题目附件（${title}）`} purpose="mistake_question" values={questionMediaIds} onChange={updateQuestionMedia} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
        <ChildMediaCollection isCurrent={isCurrent} onDenied={onDenied} readOnly={uncertain} label={`答案附件（${title}）`} purpose="mistake_answer" values={childAnswerMediaIds} onChange={updateAnswerMedia} onUploaded={mediaDrafts.replace} onRemoved={mediaDrafts.remove} onBusyChange={trackUpload} />
      </div>
      <div className="child-inline-actions">
        <button type="button" className="child-secondary-button" aria-label={`我还不会 ${title}`} disabled={disabled || uncertain || uploadCount > 0} onClick={() => saveReview(false)}>我还不会</button>
        <button type="button" className="child-primary-button" aria-label={`我已经会了 ${title}`} disabled={disabled || uncertain || uploadCount > 0} onClick={() => saveReview(true)}>我已经会了</button>
      </div>
    </article>
  );
};

const ScopedChildMistakesPage = ({ session, child }) => {
  const location = useLocation(), navigate = useNavigate();
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
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [hiddenSources, setHiddenSources] = useState(() => new Set());
  const [blocked, setBlocked] = useState(false);
  const [unknownCreate, setUnknownCreate] = useState(() => hasUnknownCreate(child));
  const [createBusy, setCreateBusy] = useState(false);
  const [listReading, setListReading] = useState(false);
  const [listChecked, setListChecked] = useState(false);
  const listReadInFlight = useRef(false), manualList = useRef(false);
  const alive = useRef(true), denied = useRef(false), generation = useRef(0);
  const focusedDetail = useRef(null);
  const isCurrent = useCallback(() => alive.current && !denied.current && isSessionCurrent(session), [session]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);
  const clearPrivate = useCallback(() => {
    denied.current = true; generation.current += 1;
    focusedDetail.current = null;
    setHiddenSources(new Set());
    setBlocked(true); setItems([]); setShowForm(false); setSource(null); setTarget(null); setBusyId(null); setMessage('');
    setError('当前身份无法继续查看或修改错题。');
  }, []);

  useEffect(() => {
    if (!isCurrent()) return;
    if (isLearningDenied(resource.error)) clearPrivate();
    else if (!manualList.current) {
      const listed = resource.data?.items || [], focused = focusedDetail.current;
      setItems(focused ? [focused, ...listed.filter(item => item.mistakeId !== focused.mistakeId)] : listed);
    }
  }, [resource.data, resource.error, clearPrivate, isCurrent]);

  const clearUnknownCreate = () => {
    if (!isCurrent()) return false;
    try { sessionStorage.removeItem(unknownCreateKey(child)); }
    catch { setError('无法保存核对状态，请保留当前页面并重试。'); return false; }
    setUnknownCreate(false); setListChecked(false);
    return true;
  };
  const startCreate = () => {
    if (!isCurrent() || unknownCreate || hasUnknownCreate(child)) return false;
    try { sessionStorage.setItem(unknownCreateKey(child), '1'); }
    catch { setError('无法保存提交保护状态，本次尚未提交。'); return false; }
    setUnknownCreate(true); setListChecked(false); setCreateBusy(true);
    return true;
  };
  const readUnknownCreateList = async () => {
    if (!isCurrent() || !unknownCreate || createBusy || listReadInFlight.current) return;
    const existingIds = new Set(items.map(item => item.mistakeId));
    listReadInFlight.current = true; manualList.current = true;
    setListReading(true); setListChecked(false); setError(''); setShowForm(false);
    try {
      const result = await listOwnMistakes({ mastered: false, pageSize: 100 });
      if (!isCurrent()) return;
      if (!Array.isArray(result?.items)) throw new Error('Invalid mistake list');
      const listed = result.items.map(row => {
        if (!isLearningId(row?.mistakeId)) throw new Error('Invalid mistake ID');
        return assertLearningScope(row, 'mistakeId', row.mistakeId, child.familyId, child.childId);
      });
      // Discovery must not replace other rows' drafts or release their unknown PATCH locks.
      setItems(current => [...current, ...listed.filter(row => !existingIds.has(row.mistakeId)
        && !current.some(item => item.mistakeId === row.mistakeId))]);
      setListChecked(true);
    } catch (cause) {
      if (!isCurrent()) return;
      if (isLearningDenied(cause)) clearPrivate();
      else setError('读取失败，保存结果仍未知，请重试读取；不要重复记录。');
    } finally {
      if (isCurrent()) { listReadInFlight.current = false; setListReading(false); }
    }
  };

  const readDetail = async next => {
    if (!isCurrent()) return;
    const version = ++generation.current;
    setTarget(next); setBusyId(next.id); setError(''); setShowForm(false); setSource(null);
    // Hiding stale source presentation must not reset row drafts or unknown-write locks.
    if (next.kind === 'detail') setHiddenSources(current => new Set(current).add(next.id));
    try {
      const result = next.kind === 'source' ? await getOwnTask(next.id) : await getOwnMistake(next.id);
      if (!isCurrent() || version !== generation.current) return;
      const row = assertLearningScope(next.kind === 'source' ? result.task : result.mistake,
        next.kind === 'source' ? 'taskId' : 'mistakeId', next.id, child.familyId, child.childId);
      if (next.kind === 'source') { setSource(row); setShowForm(true); }
      else {
        focusedDetail.current = row;
        setItems(current => [row, ...current.filter(item => item.mistakeId !== row.mistakeId)]);
        setHiddenSources(current => { const nextHidden = new Set(current); nextHidden.delete(row.mistakeId); return nextHidden; });
      }
      setTarget(null);
    } catch (cause) {
      if (!isCurrent() || version !== generation.current) return;
      if (isLearningDenied(cause)) clearPrivate();
      else setError(learningReadMessage(cause));
    } finally { if (isCurrent() && version === generation.current) setBusyId(null); }
  };
  const readRef = useRef(readDetail); readRef.current = readDetail;
  useEffect(() => {
    const params = new URLSearchParams(location.search), sourceId = params.get('sourceTaskId'), mistakeId = params.get('mistakeId');
    if (!sourceId && !mistakeId) return;
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
    if ((sourceId && mistakeId) || !isLearningId(sourceId || mistakeId)
      || (params.has('childId') && params.get('childId') !== child.childId)) { clearPrivate(); return; }
    readRef.current({ kind: sourceId ? 'source' : 'detail', id: (sourceId || mistakeId).toLowerCase() });
  }, [location.pathname, location.search, navigate, child.childId, clearPrivate]);

  const created = (mistake) => {
    if (!isCurrent()) return;
    clearUnknownCreate();
    setItems((current) => [mistake, ...current.filter((item) => item.mistakeId !== mistake.mistakeId)]);
    setShowForm(false);
    setMessage('错题已记录。');
  };

  const reviewed = (mistake) => {
    if (!isCurrent()) return;
    if (focusedDetail.current?.mistakeId === mistake.mistakeId) focusedDetail.current = mistake.mastered ? null : mistake;
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
        {!showForm && !blocked && (
          <button type="button" className="child-primary-button" disabled={Boolean(busyId) || unknownCreate} onClick={() => { setSource(null); setMessage(''); setError(''); setShowForm(true); }}>记录新错题</button>
        )}
      </div>
      {unknownCreate && !blocked && <div className="child-mistake-recovery" role="region" aria-label="未知记录核对">
        <p>上一笔记录尚待核对。列表未出现不代表保存失败，请勿重复提交。</p>
        <button type="button" className="child-secondary-button" disabled={createBusy || listReading || Boolean(busyId)} onClick={readUnknownCreateList}>重新读取错题列表</button>
        {listChecked && <button type="button" className="child-secondary-button" onClick={clearUnknownCreate}>已核对列表，结束本次记录</button>}
      </div>}
      {showForm && !blocked && <ChildMistakeCreateForm isCurrent={isCurrent} onDenied={clearPrivate} source={source}
        onWriteStart={startCreate} onWriteRejected={clearUnknownCreate} onWriteSettled={() => { if (isCurrent()) setCreateBusy(false); }}
        onCancel={() => setShowForm(false)} onCreated={created} setError={setError} setMessage={setMessage} />}
      {target && !blocked && <button type="button" className="child-secondary-button" disabled={Boolean(busyId)} onClick={() => readDetail(target)}>重试读取</button>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'error', 'retryable_error'].includes(resource.state) && items.length === 0 && <p className="child-empty-copy">暂无待复习错题。</p>}
      <div className="child-mistake-list">
        {!blocked && items.map((item) => (
          <ChildMistakeRow key={item.mistakeId} item={item} hideSource={hiddenSources.has(item.mistakeId)} isCurrent={isCurrent} onDenied={clearPrivate}
            onDetail={id => readDetail({ kind: 'detail', id })} disabled={Boolean(busyId)} onBusyChange={setBusyId} onReviewed={reviewed} setError={setError} setMessage={setMessage} />
        ))}
      </div>
    </section>
  );
};

const ChildMistakesPage = () => {
  const [, setRevision] = useState(0);
  useEffect(() => subscribeSessionChanges(() => setRevision(value => value + 1)), []);
  const session = captureSession('student'), child = loadChildSession()?.child;
  if (!session || !child) return <p role="alert">请重新登录后查看错题。</p>;
  return <ScopedChildMistakesPage key={JSON.stringify([session.actorId, session.revision, child.familyId, child.childId])}
    session={session} child={child} />;
};
export default ChildMistakesPage;
