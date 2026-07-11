import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import FamilyDialog from '../../components/family/FamilyDialog';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildMutationGuard, useChildResource } from '../../hooks/useChildResource';
import { createGrowthLog, listGrowthLogs, updateGrowthLog } from '../../services/familyApi';

const DIMENSIONS = [
  ['moral', '德育'], ['academic', '智育'], ['physical', '体育'],
  ['artistic', '美育'], ['labor', '劳育']
];

const blankLog = () => ({
  date: '', dimension: 'academic', area: '', subject: '', content: '',
  durationMinutes: '', amount: '', unit: '', focusLevel: '', difficulty: '',
  physicalState: '', mood: '', childReflection: '', parentNote: ''
});
const numberOrUndefined = (value) => (value === '' ? undefined : Number(value));
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '保存失败，请重试。';

const GrowthLogsPage = () => {
  const { selectedChild, selectedChildId } = useFamily();
  const [filters, setFilters] = useState({ from: '', to: '', dimension: '' });
  const load = useCallback(
    ({ childId, signal }) => listGrowthLogs({ childId, ...filters, pageSize: 100 }, signal),
    [filters]
  );
  const resource = useChildResource({ load });
  const mutationGuard = useChildMutationGuard();
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blankLog());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setItems(resource.data?.items || []);
  }, [resource.data]);
  useEffect(() => {
    setEditor(null);
    setError('');
    setMessage('');
    setBusy(false);
  }, [selectedChildId]);

  const openEditor = (log) => {
    setForm(log ? { ...blankLog(), ...log } : blankLog());
    setEditor(log ? { mode: 'edit', log } : { mode: 'create' });
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    const mutationScope = mutationGuard.captureScope();
    setBusy(true);
    setError('');
    const payload = {
      date: form.date,
      dimension: form.dimension,
      area: form.area,
      subject: form.dimension === 'academic' ? form.subject : '',
      content: form.content,
      durationMinutes: numberOrUndefined(form.durationMinutes),
      amount: numberOrUndefined(form.amount),
      unit: form.unit,
      focusLevel: form.focusLevel || undefined,
      difficulty: form.difficulty || undefined,
      physicalState: form.physicalState || undefined,
      mood: form.mood || undefined,
      childReflection: form.childReflection,
      parentNote: form.parentNote
    };
    try {
      const result = editor.mode === 'create'
        ? await createGrowthLog({ childId: selectedChildId, ...payload })
        : await updateGrowthLog(editor.log.logId, payload);
      if (!mutationGuard.isCurrentScope(mutationScope)) return;
      setItems((current) => editor.mode === 'create'
        ? [result.log, ...current]
        : current.map((item) => (item.logId === result.log.logId ? result.log : item)));
      setMessage(editor.mode === 'create' ? '成长记录已保存。' : '成长记录已更新。');
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
    <section className="family-page family-page-wide" aria-labelledby="growth-logs-title">
      <div className="family-page-heading">
        <div><p className="family-eyebrow">{selectedChild.name}的每日成长</p><h1 id="growth-logs-title">记录</h1></div>
        <button type="button" className="family-button primary" disabled={resource.state === 'loading'} onClick={() => openEditor(null)}>记录成长</button>
      </div>
      <div className="family-filter-bar" aria-label="成长记录筛选">
        <label>开始日期<input type="date" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} /></label>
        <label>结束日期<input type="date" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} /></label>
        <label>筛选维度<select value={filters.dimension} onChange={(event) => setFilters((value) => ({ ...value, dimension: event.target.value }))}><option value="">全部</option>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {message && <p className="family-success-message" role="status">{message}</p>}
      {error && <p className="family-form-error" role="alert">{error}</p>}
      {resource.state === 'loading' && <FamilyDataState state="loading" />}
      {resource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={resource.reload} />}
      {resource.state === 'error' && <FamilyDataState state="error" error={resource.error} />}
      {!['loading', 'retryable_error', 'error'].includes(resource.state) && items.length === 0 && <p className="family-empty-copy">暂无成长记录</p>}
      <div className="family-record-list">
        {items.map((item) => (
          <article className="family-record" key={item.logId}>
            <div className="family-record-main">
              <div className="family-inline-actions"><span className={`family-dimension is-${item.dimension}`}>{DIMENSIONS.find(([value]) => value === item.dimension)?.[1]}</span><span>{item.date}</span></div>
              <h2>{item.content}</h2>
              <p>{item.subject || item.area || '综合成长'}{item.durationMinutes != null ? ` · ${item.durationMinutes} 分钟` : ''}</p>
            </div>
            <button type="button" className="family-button secondary" disabled={resource.state === 'loading'} aria-label={`编辑 ${item.content}`} onClick={() => openEditor(item)}>编辑</button>
          </article>
        ))}
      </div>
      {editor && (
        <FamilyDialog labelledBy="growth-log-editor-title" onClose={() => setEditor(null)}>
          <form onSubmit={save}>
            <div className="family-page-heading"><h2 id="growth-log-editor-title">{editor.mode === 'create' ? '记录成长' : '编辑成长记录'}</h2><button type="button" className="family-button secondary" onClick={() => setEditor(null)}>关闭</button></div>
            <div className="family-form-grid">
              <label>日期<input required type="date" value={form.date} onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))} /></label>
              <label>成长维度<select value={form.dimension} onChange={(event) => setForm((value) => ({ ...value, dimension: event.target.value }))}>{DIMENSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {form.dimension === 'academic' && <label>学科<input value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} /></label>}
              <label>领域<input value={form.area} onChange={(event) => setForm((value) => ({ ...value, area: event.target.value }))} /></label>
              <label>时长（分钟）<input type="number" min="0" value={form.durationMinutes} onChange={(event) => setForm((value) => ({ ...value, durationMinutes: event.target.value }))} /></label>
              <label>完成数量<input type="number" min="0" value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} /></label>
              <label>单位<input value={form.unit} onChange={(event) => setForm((value) => ({ ...value, unit: event.target.value }))} /></label>
              <label>专注程度<select value={form.focusLevel} onChange={(event) => setForm((value) => ({ ...value, focusLevel: event.target.value }))}><option value="">未记录</option><option value="good">专注</option><option value="normal">一般</option><option value="distracted">分心</option></select></label>
              <label>难度<select value={form.difficulty} onChange={(event) => setForm((value) => ({ ...value, difficulty: event.target.value }))}><option value="">未记录</option><option value="easy">简单</option><option value="normal">适中</option><option value="hard">困难</option></select></label>
              <label>身体状态<select value={form.physicalState} onChange={(event) => setForm((value) => ({ ...value, physicalState: event.target.value }))}><option value="">未记录</option><option value="energetic">精力充沛</option><option value="normal">正常</option><option value="tired">疲劳</option><option value="unwell">不适</option></select></label>
              <label>心情<select value={form.mood} onChange={(event) => setForm((value) => ({ ...value, mood: event.target.value }))}><option value="">未记录</option><option value="happy">开心</option><option value="calm">平静</option><option value="resistant">抗拒</option><option value="anxious">焦虑</option></select></label>
            </div>
            <label className="family-field-wide">记录内容<textarea required value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} /></label>
            <label className="family-field-wide">孩子自评<textarea value={form.childReflection} onChange={(event) => setForm((value) => ({ ...value, childReflection: event.target.value }))} /></label>
            <label className="family-field-wide">家长备注<textarea value={form.parentNote} onChange={(event) => setForm((value) => ({ ...value, parentNote: event.target.value }))} /></label>
            <button type="submit" className="family-button primary" disabled={busy || resource.state === 'loading'}>保存成长记录</button>
          </form>
        </FamilyDialog>
      )}
    </section>
  );
};

export default GrowthLogsPage;
