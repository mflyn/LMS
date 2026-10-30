import { assertLearningScope, isLearningId } from './learningSources';

export const reflectionWeek = localDate => {
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error('请选择有效日期。');
  const date = new Date(`${localDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== localDate) throw new Error('请选择有效日期。');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const from = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { from, to: date.toISOString().slice(0, 10) };
};

// Reconciliation is not limited to the displayed week: a parent may have moved a record's date.
export const readReflectionLogs = async (load, scope, range = {}, assertActive = () => {}) => {
  const items = [], seen = new Set();
  let expectedTotal;
  for (let page = 1; ; page += 1) {
    assertActive();
    const result = await load({ childId: scope.childId, ...range, page, pageSize: 100 });
    assertActive();
    if (!result || !Array.isArray(result.items) || !Number.isInteger(result.total) || result.total < 0
      || result.page !== page || result.pageSize !== 100
      || (expectedTotal !== undefined && result.total !== expectedTotal)) throw new Error('记录列表已变化或不完整，请重新读取。');
    expectedTotal = result.total;
    if (result.items.length !== Math.min(100, expectedTotal - items.length)) throw new Error('记录列表不完整，请重新读取。');
    for (const row of result.items) {
      assertLearningScope(row, 'logId', row?.logId, scope.familyId, scope.childId);
      if (!isLearningId(row.logId) || seen.has(row.logId)) throw new Error('记录列表已变化，请重新读取。');
      seen.add(row.logId);
      items.push(row);
    }
    if (items.length === expectedTotal) return items;
  }
};

const markerKey = scope => {
  if (!['parent', 'student'].includes(scope.role)
    || ![scope.actorId, scope.familyId, scope.childId].every(isLearningId)
    || (scope.role === 'student' && scope.actorId !== scope.childId)) throw new Error('无效的反思身份。');
  return `family-growth.reflection-write.v1:${JSON.stringify([scope.role, scope.actorId, scope.familyId, scope.childId])}`;
};
export const readReflectionWrite = scope => {
  const raw = sessionStorage.getItem(markerKey(scope));
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.kind === 'create' || (data?.kind === 'patch' && isLearningId(data.logId))) return { ...data, raw };
  } catch { /* An unreadable marker still means the previous write may have reached the server. */ }
  return { kind: 'unknown', raw };
};
export const beginReflectionWrite = (scope, { logId } = {}) => {
  if (readReflectionWrite(scope)) throw new Error('请先核对上次保存结果。');
  if (logId !== undefined && !isLearningId(logId)) throw new Error('无效的记录。');
  // This local revision distinguishes successive writes; it is not a server idempotency key.
  const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const data = logId ? { kind: 'patch', logId, revision } : { kind: 'create', revision };
  const raw = JSON.stringify(data);
  sessionStorage.setItem(markerKey(scope), raw);
  if (sessionStorage.getItem(markerKey(scope)) !== raw) throw new Error('无法保存写入保护，请稍后重试。');
  return { ...data, raw };
};
export const clearReflectionWrite = (scope, marker) => {
  if (!marker || sessionStorage.getItem(markerKey(scope)) !== marker.raw) return false;
  sessionStorage.removeItem(markerKey(scope));
  return true;
};
