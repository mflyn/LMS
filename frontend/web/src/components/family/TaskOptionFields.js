import React, { useId } from 'react';
import { isCustomTaskOption, taskOptionFields } from './taskCommonOptions';

function OptionField({ field, label, options, required, form, setForm }) {
  const id = useId(), value = form[field] ?? '';
  const custom = isCustomTaskOption(value, options, form.optionModes?.[field]);
  const index = options.findIndex(([v]) => v === value);
  const error = form.optionErrors?.[field];
  const change = (next, mode) => setForm(current => ({ ...current, [field]: next,
    optionModes: { ...current.optionModes, [field]: mode },
    optionErrors: { ...current.optionErrors, [field]: undefined } }));
  return <div className="task-option-field">
    <label htmlFor={id}>{label}</label>
    <select id={id} required={required} value={custom ? 'custom' : index >= 0 ? `preset:${index}` : ''}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => {
        const selected = event.target.value;
        if (selected === 'custom') change('', true);
        else if (selected === '') change('', false);
        else change(options[Number(selected.slice(7))][0], false);
      }}>
      <option value="">请选择</option>
      {options.map(([v, text], i) => <option key={v} value={`preset:${i}`}>{text}</option>)}
      <option value="custom">其他（手工输入）</option>
    </select>
    {custom && <><label htmlFor={`${id}-custom`}>其他{label}</label>
      <input id={`${id}-custom`} required value={value} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => change(event.target.value, true)} /></>}
    {error && <p id={`${id}-error`} className="family-form-error" role="alert">{error}</p>}
  </div>;
}

export default function TaskOptionFields({ form, setForm, recurring = false }) {
  return taskOptionFields(form, recurring).map(props =>
    <OptionField key={props.field} {...props} form={form} setForm={setForm} />);
}
