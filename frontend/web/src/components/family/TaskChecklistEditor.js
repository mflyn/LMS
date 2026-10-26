import React from 'react';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

let sequence = 0;
const newItemId = rows => {
  const ids = new Set(rows.map(row => row.itemId));
  let id;
  do { id = `item-${Date.now().toString(36)}-${++sequence}`; } while (ids.has(id));
  return id;
};

export const checklistForForm = rows => (rows || []).map(row => ({
  itemId: row.itemId, label: row.label, required: row.required === true
}));

const TaskChecklistEditor = ({ value, onChange, disabled = false }) => {
  const update = (index, patch) => onChange(value.map((row, position) => position === index ? { ...row, ...patch } : row));
  const move = (index, delta) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return <fieldset className="task-checklist-editor" disabled={disabled}>
    <legend>自检清单（{value.length}/5）</legend>
    {value.map((row, index) => <div className="task-checklist-editor-row" key={row.itemId}>
      <label>检查项 {index + 1}<input value={row.label} required maxLength={100}
        onChange={event => update(index, { label: event.target.value })} /></label>
      <label className="task-checklist-priority"><input type="checkbox" checked={row.required}
        onChange={event => update(index, { required: event.target.checked })} />重点项 {index + 1}</label>
      <div className="family-inline-actions">
        <button type="button" className="family-button secondary" disabled={index === 0}
          aria-label={`上移检查项 ${index + 1}`} title="上移" onClick={() => move(index, -1)}><ArrowUpOutlined /></button>
        <button type="button" className="family-button secondary" disabled={index === value.length - 1}
          aria-label={`下移检查项 ${index + 1}`} title="下移" onClick={() => move(index, 1)}><ArrowDownOutlined /></button>
        <button type="button" className="family-button secondary" aria-label={`删除检查项 ${index + 1}`} title="删除"
          onClick={() => onChange(value.filter((_, position) => position !== index))}><DeleteOutlined /></button>
      </div>
    </div>)}
    <button type="button" className="family-button secondary" disabled={value.length >= 5}
      onClick={() => onChange([...value, { itemId: newItemId(value), label: '', required: false }])}>
      <PlusOutlined aria-hidden="true" />添加检查项</button>
  </fieldset>;
};

export default TaskChecklistEditor;
