const { error } = require('./growthTaskCompletionCommand');
const integer = value => Number.isSafeInteger(value) && value >= 0;

const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const invalidChecklist = () => error(400, 'CHECKLIST_ITEM_INVALID');

const normalizeChecklist = value => {
  if (!Array.isArray(value) || value.length > 5) throw invalidChecklist();
  const ids = new Set();
  return Array.from(value, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(item))
      || Object.keys(item).some(key => !['itemId', 'label', 'required'].includes(key))
      || typeof item.itemId !== 'string' || !item.itemId.trim() || item.itemId.length > 100
      || ids.has(item.itemId) || typeof item.label !== 'string'
      || !item.label.trim() || item.label.trim().length > 100
      || owns(item, 'required') && typeof item.required !== 'boolean') throw invalidChecklist();
    ids.add(item.itemId);
    return { itemId: item.itemId, label: item.label.trim(), required: item.required ?? false };
  });
};

const createChecklist = body => {
  const checklistSnapshot = owns(body, 'checklistSnapshot') ? normalizeChecklist(body.checklistSnapshot) : [];
  return { checklistSnapshot, checklistVersion: checklistSnapshot.length ? 1 : 0 };
};

// Persist the server-computed target with the existing material intent, not the request's expectation.
const checklistPatch = body => {
  const hasSnapshot = owns(body, 'checklistSnapshot');
  const hasVersion = owns(body, 'expectedChecklistVersion');
  if (!hasSnapshot && !hasVersion) return [];
  if (!hasSnapshot || !hasVersion || !integer(body.expectedChecklistVersion)
    || body.expectedChecklistVersion === Number.MAX_SAFE_INTEGER) throw error(400, 'VALIDATION_ERROR');
  return [
    { path: 'checklistSnapshot', value: normalizeChecklist(body.checklistSnapshot) },
    { path: 'checklistVersion', value: body.expectedChecklistVersion + 1 }
  ];
};

const assertChecklistPatch = values => {
  const hasSnapshot = owns(values, 'checklistSnapshot');
  const hasVersion = owns(values, 'checklistVersion');
  if (!hasSnapshot && !hasVersion) return;
  if (!hasSnapshot || !hasVersion || !integer(values.checklistVersion) || values.checklistVersion === 0) {
    throw error(400, 'VALIDATION_ERROR');
  }
  normalizeChecklist(values.checklistSnapshot);
};

const assertChecklistVersion = (task, values) => {
  assertChecklistPatch(values);
  if (owns(values, 'checklistVersion') && values.checklistVersion - 1 !== (task.checklistVersion ?? 0)) {
    throw error(409, 'VERSION_CONFLICT');
  }
};

module.exports = { normalizeChecklist, createChecklist, checklistPatch, assertChecklistPatch, assertChecklistVersion };
