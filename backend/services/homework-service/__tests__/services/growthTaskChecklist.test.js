const { normalizeChecklist, createChecklist, checklistPatch, assertChecklistPatch,
  assertChecklistVersion } = require('../../services/growthTaskChecklist');
const { parseGrowthTaskCreate, parseGrowthTaskPatch, entriesToMongoSet } = require('../../services/growthTaskPatch');

const item = (itemId = 'read', label = ' Read the question ') => ({ itemId, label });
const rejects = (action, code = 'CHECKLIST_ITEM_INVALID') => {
  expect(action).toThrow(expect.objectContaining({ code }));
};

describe('T4 strict checklist boundary', () => {
  test.each([0, 1, 5])('%i items normalize without changing IDs or the caller', count => {
    const input = Array.from({ length: count }, (_, index) => item(`Read-${index}`));
    const original = JSON.parse(JSON.stringify(input));
    const output = normalizeChecklist(input);
    expect(output).toEqual(input.map(entry => ({ ...entry, label: entry.label.trim(), required: false })));
    expect(input).toEqual(original);
    if (count) expect(output[0]).not.toBe(input[0]);
  });
  test('IDs are case sensitive, stable, and not normalized', () => {
    expect(normalizeChecklist([item('a'), item('A'), item(' a ')]).map(entry => entry.itemId))
      .toEqual(['a', 'A', ' a ']);
    expect(normalizeChecklist([{ ...item(), required: true }])[0].required).toBe(true);
  });
  test.each([
    undefined, null, {}, 'read', Array(1), [null], [undefined], [1], [['read']],
    [item(), item()], Array.from({ length: 6 }, (_, i) => item(String(i))),
    [item('')], [item(' ')], [item('a'.repeat(101))], [item(1)],
    [item('a', '')], [item('a', '   ')], [item('a', 'a'.repeat(101))], [item('a', 1)],
    [{ ...item(), required: 'false' }], [{ ...item(), required: null }],
    [{ ...item(), required: undefined }], [{ ...item(), extra: true }], [new Date()]
  ])('rejects invalid snapshot %# before casting', input => rejects(() => normalizeChecklist(input)));
  test('label and ID maximum lengths are accepted; labels trim before length validation', () => {
    expect(normalizeChecklist([item('i'.repeat(100), ` ${'l'.repeat(100)} `)])[0].label).toHaveLength(100);
  });
  test('create initializes empty/omitted version zero and nonempty version one', () => {
    expect(createChecklist({})).toEqual({ checklistSnapshot: [], checklistVersion: 0 });
    expect(createChecklist({ checklistSnapshot: [] })).toEqual(createChecklist({}));
    expect(createChecklist({ checklistSnapshot: [item()] }).checklistVersion).toBe(1);
    rejects(() => createChecklist({ checklistSnapshot: null }));
  });
  test.each([undefined, null, -1, 0.5, '0', true, Infinity, Number.MAX_SAFE_INTEGER])(
    'patch rejects invalid expected version %s', expectedChecklistVersion => {
      rejects(() => checklistPatch({ checklistSnapshot: [], expectedChecklistVersion }), 'VALIDATION_ERROR');
    });
  test('patch fields must be paired and target is server-derived', () => {
    expect(checklistPatch({ title: 'ordinary edit' })).toEqual([]);
    rejects(() => checklistPatch({ checklistSnapshot: [] }), 'VALIDATION_ERROR');
    rejects(() => checklistPatch({ expectedChecklistVersion: 0 }), 'VALIDATION_ERROR');
    expect(checklistPatch({ checklistSnapshot: [], expectedChecklistVersion: 0 })).toEqual([
      { path: 'checklistSnapshot', value: [] }, { path: 'checklistVersion', value: 1 }
    ]);
  });
  test('legacy zero is read only and stale versions conflict', () => {
    const task = { title: 'legacy' };
    const target = { checklistSnapshot: [], checklistVersion: 1 };
    expect(() => assertChecklistVersion(task, target)).not.toThrow();
    expect(task).toEqual({ title: 'legacy' });
    rejects(() => assertChecklistVersion({ checklistVersion: 1 }, target), 'VERSION_CONFLICT');
    expect(() => assertChecklistVersion({ checklistVersion: 5 }, { title: 'ordinary' })).not.toThrow();
  });
  test.each([{ checklistVersion: 1 }, { checklistSnapshot: [] },
    { checklistSnapshot: [], checklistVersion: 0 }, { checklistSnapshot: [], checklistVersion: '1' }])(
    'persisted patch rejects incomplete or invalid target %#', patch => {
      rejects(() => assertChecklistPatch(patch), 'VALIDATION_ERROR');
    });
  test('only enabled parser accepts new public fields; result version is never a public input', () => {
    const options = { checklistEnabled: true };
    const input = { childId: '012345678901234567890123', title: 'Task', taskType: 'practice',
      dimension: 'academic', dueDate: '2026-10-26', checklistSnapshot: [item()] };
    rejects(() => parseGrowthTaskCreate(input), 'VALIDATION_ERROR');
    expect(parseGrowthTaskCreate(input, options).taskInput).toMatchObject({ checklistVersion: 1,
      checklistSnapshot: [{ itemId: 'read', label: 'Read the question', required: false }] });
    const patch = { checklistSnapshot: [], expectedChecklistVersion: 0 };
    rejects(() => parseGrowthTaskPatch(patch), 'VALIDATION_ERROR');
    expect(entriesToMongoSet(parseGrowthTaskPatch(patch, options).entries)).toEqual({ checklistSnapshot: [], checklistVersion: 1 });
    rejects(() => parseGrowthTaskPatch({ ...patch, checklistVersion: 1 }, options), 'VALIDATION_ERROR');
    rejects(() => parseGrowthTaskCreate({ ...input, checklistVersion: 1 }, options), 'VALIDATION_ERROR');
    rejects(() => entriesToMongoSet([{ path: 'checklistVersion', value: 1 }]), 'VALIDATION_ERROR');
  });
});
