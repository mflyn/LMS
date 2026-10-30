import { reflectionWeek, readReflectionLogs, readReflectionWrite, beginReflectionWrite, clearReflectionWrite } from '../../services/reflection';
import { saveChildSession, clearChildSession } from '../../services/familySession';

const id = n => String(n).padStart(24, '0');
const scope = { role: 'student', actorId: id(1), familyId: id(2), childId: id(1) };
const row = n => ({ logId: id(n), familyId: id(2), childId: id(1), date: '2026-10-26', childReflection: '合成反思' });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test.each([
  ['2026-10-25', '2026-10-19', '2026-10-25'],
  ['2026-10-26', '2026-10-26', '2026-11-01'],
  ['2027-01-01', '2026-12-28', '2027-01-03']
])('week %s uses calendar arithmetic, not browser timezone', (date, from, to) => {
  expect(reflectionWeek(date)).toEqual({ from, to });
});
test.each(['', '2026-02-30', '2026-1-1', '2026-10-26\n'])('rejects invalid date %j', date => {
  expect(() => reflectionWeek(date)).toThrow();
});
test('complete recovery read includes all pages and no implicit week/dimension filter', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => row(i + 10));
  const load = jest.fn(({ page }) => Promise.resolve({ page, pageSize: 100, total: 101,
    items: page === 1 ? rows.slice(0, 100) : rows.slice(100) }));
  expect(await readReflectionLogs(load, scope)).toEqual(rows);
  expect(load.mock.calls.map(([query]) => query)).toEqual([
    { childId: id(1), page: 1, pageSize: 100 }, { childId: id(1), page: 2, pageSize: 100 }
  ]);
});
test.each(['foreign', 'duplicate', 'missing', 'changedTotal'])('incomplete or unsafe %s list cannot be used to reconcile', async mode => {
  const first = Array.from({ length: 100 }, (_, i) => row(i + 10));
  const last = mode === 'foreign' ? { ...row(110), childId: id(99) } : mode === 'duplicate' ? first[0] : row(110);
  const load = jest.fn(({ page }) => Promise.resolve({ page, pageSize: 100,
    total: page === 2 && mode === 'changedTotal' ? 102 : 101,
    items: page === 1 ? first : mode === 'missing' ? [] : [last] }));
  await expect(readReflectionLogs(load, scope)).rejects.toThrow();
});
test('unknown marker survives logout without retaining reflection, content or credentials', () => {
  saveChildSession({ token: 'secret-token', child: { childId: id(1), familyId: id(2), name: '合成孩子' } });
  const marker = beginReflectionWrite(scope, { logId: id(9), childReflection: '私密内容', token: 'secret-token' });
  clearChildSession();
  expect(readReflectionWrite(scope)).toEqual(marker);
  expect(marker.raw).not.toContain('私密内容');
  expect(marker.raw).not.toContain('secret-token');
  expect(readReflectionWrite({ ...scope, actorId: id(3), childId: id(3) })).toBeNull();
  expect(readReflectionWrite({ ...scope, familyId: id(4) })).toBeNull();
});
test('begin cannot overwrite an unresolved marker; clearing is exact-marker scoped', () => {
  const marker = beginReflectionWrite(scope, {});
  expect(() => beginReflectionWrite(scope, {})).toThrow();
  expect(clearReflectionWrite(scope, { ...marker, raw: 'wrong' })).toBe(false);
  expect(readReflectionWrite(scope)).toEqual(marker);
  expect(clearReflectionWrite(scope, marker)).toBe(true);
  expect(readReflectionWrite(scope)).toBeNull();
});
test('corrupt marker fails closed and can be explicitly reconciled without parsing private text', () => {
  beginReflectionWrite(scope, {});
  sessionStorage.setItem(sessionStorage.key(0), 'broken');
  const marker = readReflectionWrite(scope);
  expect(marker.kind).toBe('unknown');
  expect(() => beginReflectionWrite(scope, {})).toThrow();
  expect(clearReflectionWrite(scope, marker)).toBe(true);
});
test('unavailable persistence fails closed before a caller can send a write', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  try { expect(() => beginReflectionWrite(scope, {})).toThrow('quota'); } finally { spy.mockRestore(); }
});
