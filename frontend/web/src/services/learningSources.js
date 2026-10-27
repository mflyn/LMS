export const isLearningId = value => typeof value === 'string' && value.length === 24 && /^[a-f\d]{24}$/i.test(value);
export const sourceErrorCode = error => error?.response?.data?.error?.code;
export const sourceUnavailableMessage = '来源服务暂不可用，请重试读取。';
export const learningReadMessage = error => sourceErrorCode(error) === 'SOURCE_SERVICE_UNAVAILABLE'
  ? sourceUnavailableMessage : [401, 403, 404].includes(error?.response?.status)
    ? '当前身份无法读取此记录。' : '读取失败，请重试。';
export const isLearningDenied = error => [401, 403, 404].includes(error?.response?.status);
export const assertLearningScope = (row, idField, id, familyId, childId) => {
  if (!row || row[idField] !== id || row.familyId !== familyId || row.childId !== childId) {
    throw Object.assign(new Error('当前身份无法读取此记录。'), { response: { status: 403 } });
  }
  return row;
};
export const mistakeUrl = (role, id) => `/${role === 'student' ? 'child' : 'app'}/mistakes?mistakeId=${encodeURIComponent(id)}`;
export const taskUrl = (role, id) => role === 'student'
  ? `/child/tasks/${encodeURIComponent(id)}` : `/app/tasks?taskId=${encodeURIComponent(id)}`;
