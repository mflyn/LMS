export const TASK_TYPES = [['practice', '练习'], ['错题订正', '错题订正'], ['exercise', '锻炼'],
  ['habit', '习惯'], ['reading', '阅读'], ['chore', '劳动']];
const named = names => names.map(name => [name, name]);
export const TASK_SUBJECTS = named(['数学', '语文', '英语', '科学', '道德与法治']);
const AREAS = {
  moral: named(['礼貌待人', '遵守约定', '情绪表达']),
  academic: named(['计算练习', '课外阅读', '朗读', '写作', '错题订正']),
  physical: named(['跳绳', '跑步', '球类', '体能训练']),
  artistic: named(['绘画', '书法', '钢琴', '唱歌', '手工']),
  labor: named(['整理房间', '整理书包', '家务劳动', '烹饪'])
};
export const taskOptionFields = (form, recurring = false) => [
  { field: 'taskType', label: '任务类型', options: TASK_TYPES, required: true },
  { field: 'area', label: '具体项目', options: AREAS[form.dimension] || [], required: !recurring },
  ...((recurring || form.dimension === 'academic')
    ? [{ field: 'subject', label: '学科', options: TASK_SUBJECTS, required: !recurring }] : [])
];
export const isCustomTaskOption = (value, options, explicit) => Boolean(explicit)
  || (typeof value === 'string' && value !== '' && !options.some(([v]) => v === value));
export const validateTaskOptions = (form, recurring = false) => Object.fromEntries(
  taskOptionFields(form, recurring).flatMap(({ field, label, options, required }) => {
    const custom = isCustomTaskOption(form[field], options, form.optionModes?.[field]);
    return (required || custom) && (typeof form[field] !== 'string' || !form[field].trim())
      ? [[field, custom ? `请填写其他${label}。` : `请选择${label}。`]] : [];
  })
);
