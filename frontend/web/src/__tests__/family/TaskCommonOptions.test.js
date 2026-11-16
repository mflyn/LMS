import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TaskOptionFields from '../../components/family/TaskOptionFields';
import { validateTaskOptions } from '../../components/family/taskCommonOptions';

const base = { dimension: 'academic', taskType: 'practice', area: '计算练习', subject: '数学' };
function Harness({ dimension = 'academic', initial = {}, recurring = false, onSave = () => {} }) {
  const [form, setForm] = useState({ ...base, ...initial });
  const current = { ...form, dimension };
  return <form onSubmit={e => { e.preventDefault(); const optionErrors = validateTaskOptions(current, recurring);
    setForm(f => ({ ...f, optionErrors })); if (!Object.keys(optionErrors).length) onSave(current); }}>
    <TaskOptionFields form={current} setForm={setForm} recurring={recurring} />
    <button>Save</button>
  </form>;
}
const select = (name, label) => {
  const field = screen.getByRole('combobox', { name, exact: true });
  const value = Array.from(field.options).find(o => o.textContent === label).value;
  fireEvent.change(field, { target: { value } });
};
test.each(['math', 'Math', '其他', 'other', 'custom', 'preset:0', '锻炼'])('legacy subject %s stays literal without mount writes', value => {
  const save = jest.fn(); render(<Harness initial={{ subject: value }} onSave={save} />);
  expect(screen.getByLabelText('其他学科')).toHaveValue(value); expect(save).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByText('Save').closest('form'));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ subject: value }));
});
test('dimension options change without overwriting the existing area or subject draft', () => {
  const r = render(<Harness />); select('学科', '其他（手工输入）');
  fireEvent.change(screen.getByLabelText('其他学科'), { target: { value: '  私有自定义  ' } });
  r.rerender(<Harness dimension="physical" />);
  expect(screen.getByLabelText('其他具体项目')).toHaveValue('计算练习');
  expect(screen.queryByLabelText('其他学科')).not.toBeInTheDocument();
  r.rerender(<Harness />); expect(screen.getByLabelText('其他学科')).toHaveValue('  私有自定义  ');
  expect(screen.getByRole('combobox', { name: '具体项目', exact: true }).selectedOptions[0]).toHaveTextContent('计算练习');
});
test('explicit other to preset clears old text; ordinary rerender retains unfinished other mode', () => {
  const r = render(<Harness />); select('学科', '其他（手工输入）');
  fireEvent.change(screen.getByLabelText('其他学科'), { target: { value: 'old' } });
  select('学科', '数学'); select('学科', '其他（手工输入）'); r.rerender(<Harness />);
  expect(screen.getByLabelText('其他学科')).toHaveValue('');
});
test.each(['taskType', 'area', 'subject'])('direct submit rejects whitespace other %s', field => {
  expect(validateTaskOptions({ ...base, [field]: '   ', optionModes: { [field]: true } })).toHaveProperty(field);
});
test('optional recurring empty/null values pass, but explicit empty other does not', () => {
  expect(validateTaskOptions({ ...base, area: null, subject: '' }, true)).toEqual({});
  expect(validateTaskOptions({ ...base, dimension: 'physical', subject: '', optionModes: { subject: true } }, true))
    .toHaveProperty('subject');
  expect(validateTaskOptions({ ...base, dimension: 'physical', subject: '', optionModes: { subject: true } })).toEqual({});
});
