import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import {
  createKnowledgePoint,
  listKnowledgePoints,
  updateKnowledgePoint
} from '../../services/familyApi';

const DIMENSIONS = [
  ['moral', '德育'],
  ['academic', '智育'],
  ['physical', '体育'],
  ['artistic', '艺术'],
  ['labor', '劳动']
];
const MASTERY_LEVELS = [
  ['not_started', '未开始'],
  ['learning', '学习中'],
  ['basic', '基本掌握'],
  ['skilled', '熟练'],
  ['needs_review', '需要复习']
];
const dimensionLabel = Object.fromEntries(DIMENSIONS);
const masteryLabel = Object.fromEntries(MASTERY_LEVELS);
const emptyCreate = () => ({ dimension: 'academic', subject: '', area: '', name: '', masteryLevel: 'not_started' });
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '操作失败，请重试。';
const matchesFilters = (point, filters) => (
  (!filters.dimension || point.dimension === filters.dimension)
  && (!filters.subject || point.subject === filters.subject)
  && (!filters.area || point.area === filters.area)
  && (!filters.masteryLevel || point.masteryLevel === filters.masteryLevel)
);
const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const KnowledgePointsPage = () => {
  const { selectedChild, selectedChildId } = useFamily();
  const [filters, setFilters] = useState({ dimension: '', subject: '', area: '', masteryLevel: '' });
  const load = useCallback(({ childId, signal }) => listKnowledgePoints({
    childId,
    ...filters,
    pageSize: 100
  }, signal), [filters]);
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const [items, setItems] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => setItems(resource.data?.items || []), [resource.data]);
  useEffect(() => {
    setCreateOpen(false);
    setCreateForm(emptyCreate());
    setEditor(null);
    setBusy(false);
    setError('');
    setMessage('');
  }, [selectedChildId]);

  const changeFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const openCreate = () => {
    setCreateForm(emptyCreate());
    setCreateOpen(true);
    setError('');
  };
  const openEditor = (point) => {
    setEditor({
      point,
      masteryLevel: point.masteryLevel,
      practiceCount: String(point.practiceCount ?? 0),
      mistakeCount: String(point.mistakeCount ?? 0),
      lastReviewedAt: localDateTime(point.lastReviewedAt)
    });
    setError('');
  };

  const savePoint = async (event) => {
    event.preventDefault();
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    try {
      const result = await createKnowledgePoint({
        childId: selectedChildId,
        dimension: createForm.dimension,
        subject: createForm.dimension === 'academic' ? createForm.subject.trim() : '',
        area: createForm.dimension === 'academic' ? '' : createForm.area.trim(),
        name: createForm.name.trim(),
        masteryLevel: createForm.masteryLevel
      });
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      if (matchesFilters(result.knowledgePoint, filters)) {
        setItems((current) => [result.knowledgePoint, ...current]);
      }
      setCreateOpen(false);
      setCreateForm(emptyCreate());
      setMessage('知识或能力点已创建。');
    } catch (saveError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setError(messageFor(saveError));
    } finally {
      if (mutationGuard.isCurrentScope(mutationScope)) setBusy(false);
    }
  };

  const saveUpdate = async (event) => {
    event.preventDefault();
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    try {
      const payload = {
        masteryLevel: editor.masteryLevel,
        practiceCount: Number(editor.practiceCount),
        mistakeCount: Number(editor.mistakeCount)
      };
      payload.lastReviewedAt = editor.lastReviewedAt ? new Date(editor.lastReviewedAt).toISOString() : null;
      const result = await updateKnowledgePoint(editor.point.knowledgePointId, payload);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setItems((current) => (
        matchesFilters(result.knowledgePoint, filters)
          ? current.map((item) => (
            item.knowledgePointId === result.knowledgePoint.knowledgePointId ? result.knowledgePoint : item
          ))
          : current.filter((item) => item.knowledgePointId !== result.knowledgePoint.knowledgePointId)
      ));
      setEditor(null);
      setMessage('知识或能力点已更新。');
    } catch (saveError) {
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setError(messageFor(saveError));
    } finally {
      if (mutationGuard.isCurrentScope(mutationScope)) setBusy(false);
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;

  return (
    <section className="family-page family-page-wide" aria-labelledby="knowledge-points-page-title">
      <div className="family-page-heading">
        <div>
          <p className="family-eyebrow">{selectedChild.name}的五育成长档案</p>
          <h1 id="knowledge-points-page-title">知识与能力点</h1>
        </div>
        <button type="button" className="family-button primary" onClick={openCreate}>新增知识或能力点</button>
      </div>

      <div className="family-filter-bar" aria-label="知识与能力点筛选">
        <label>维度筛选<select value={filters.dimension} onChange={(event) => changeFilter('dimension', event.target.value)}><option value="">全部维度</option>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>学科筛选<input value={filters.subject} onChange={(event) => changeFilter('subject', event.target.value)} /></label>
        <label>领域筛选<input value={filters.area} onChange={(event) => changeFilter('area', event.target.value)} /></label>
        <label>掌握程度筛选<select value={filters.masteryLevel} onChange={(event) => changeFilter('masteryLevel', event.target.value)}><option value="">全部程度</option>{MASTERY_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {message && <p className="family-success-message" role="status">{message}</p>}
      {resource.state !== 'loading' && items.length === 0 && <p className="family-empty-copy">暂无符合条件的知识或能力点。</p>}
      <div className="family-record-list">
        {items.map((point) => (
          <article className="family-record" data-testid={`point-row-${point.knowledgePointId}`} key={point.knowledgePointId}>
            <div className="family-record-main">
              <span className={`family-dimension is-${point.dimension}`}>{dimensionLabel[point.dimension] || point.dimension}</span>
              <h2>{point.name}</h2>
              <p>{point.subject || point.area || '未填写领域'} · {masteryLabel[point.masteryLevel] || point.masteryLevel}</p>
              <p>练习 {point.practiceCount ?? 0} 次 · 错误 {point.mistakeCount ?? 0} 次</p>
            </div>
            <button type="button" className="family-button secondary" aria-label={`更新${point.name}`} onClick={() => openEditor(point)}>更新</button>
          </article>
        ))}
      </div>

      {createOpen && (
        <FamilyDialog labelledBy="knowledge-point-create-title" onClose={() => !busy && setCreateOpen(false)}>
          <form onSubmit={savePoint}>
            <div className="family-page-heading"><h2 id="knowledge-point-create-title">新增知识或能力点</h2><button type="button" className="family-button secondary" disabled={busy} onClick={() => setCreateOpen(false)}>关闭</button></div>
            <div className="family-form-grid">
              <label>成长维度<select required value={createForm.dimension} onChange={(event) => setCreateForm((current) => ({ ...current, dimension: event.target.value }))}>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {createForm.dimension === 'academic'
                ? <label>学科<input required value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} /></label>
                : <label>领域<input required value={createForm.area} onChange={(event) => setCreateForm((current) => ({ ...current, area: event.target.value }))} /></label>}
              <label>名称<input required maxLength="100" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>掌握程度<select value={createForm.masteryLevel} onChange={(event) => setCreateForm((current) => ({ ...current, masteryLevel: event.target.value }))}>{MASTERY_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {error && <p className="family-form-error" role="alert">{error}</p>}
            <button type="submit" className="family-button primary" disabled={busy}>{busy ? '正在保存' : '保存知识或能力点'}</button>
          </form>
        </FamilyDialog>
      )}

      {editor && (
        <FamilyDialog labelledBy="knowledge-point-update-title" onClose={() => !busy && setEditor(null)}>
          <form onSubmit={saveUpdate}>
            <div className="family-page-heading"><div><h2 id="knowledge-point-update-title">更新知识或能力点</h2><p>{editor.point.name}</p></div><button type="button" className="family-button secondary" disabled={busy} onClick={() => setEditor(null)}>关闭</button></div>
            <div className="family-form-grid">
              <label>掌握程度<select value={editor.masteryLevel} onChange={(event) => setEditor((current) => ({ ...current, masteryLevel: event.target.value }))}>{MASTERY_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>练习次数<input required type="number" min="0" step="1" value={editor.practiceCount} onChange={(event) => setEditor((current) => ({ ...current, practiceCount: event.target.value }))} /></label>
              <label>错误次数<input required type="number" min="0" step="1" value={editor.mistakeCount} onChange={(event) => setEditor((current) => ({ ...current, mistakeCount: event.target.value }))} /></label>
              <label>最后复习时间<input type="datetime-local" value={editor.lastReviewedAt} onChange={(event) => setEditor((current) => ({ ...current, lastReviewedAt: event.target.value }))} /></label>
            </div>
            {error && <p className="family-form-error" role="alert">{error}</p>}
            <button type="submit" className="family-button primary" disabled={busy}>{busy ? '正在保存' : '保存更新'}</button>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

export default KnowledgePointsPage;
