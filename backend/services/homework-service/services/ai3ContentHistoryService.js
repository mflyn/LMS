const M = require('../models/Ai3');
const C = require('./ai3Contract');
const { pagination } = require('./ai2Contract');

const scope = round => ({ familyId: round.familyId, childId: round.childId, roundId: round._id });
const corrupt = () => C.error(503, 'AI3_NOT_READY');
const summary = row => ({ id: String(row._id), roundId: String(row.roundId), version: row.version,
  contentHash: row.contentHash, childSnapshotHash: row.childSnapshotHash, origin: row.origin,
  derivedFromContentId: row.derivedFromContentId === null ? null : String(row.derivedFromContentId),
  createdBy: String(row.createdBy), createdAt: row.createdAt.toISOString() });

function validateContent(row, round) {
  try {
    if (!C.isId(String(row._id)) || !C.isId(String(row.createdBy))
      || !Number.isSafeInteger(row.version) || row.version < 1
      || !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime())) throw corrupt();
    if (row.version === 1
      ? !['ai_generation', 'parent_manual'].includes(row.origin) || row.derivedFromContentId !== null
      : row.origin !== 'parent_revision' || !C.isId(String(row.derivedFromContentId))) throw corrupt();
    const normalized = C.normalize('revise_content', {
      schemaVersion: 'ai3-min-v1', operationId: '00000000-0000-4000-8000-000000000000',
      expectedRoundVersion: 1, expectedContentId: null, expectedContentVersion: null, expectedContentHash: null,
      content: row.content, reason: row.reason
    });
    if (normalized.reason !== row.reason || normalized.content.exercises.length !== round.exerciseCount
      || C.hash(normalized.content) !== row.contentHash || C.hash(row.content) !== row.contentHash
      || C.hash(C.childSnapshot(row.content)) !== row.childSnapshotHash
      || C.hash(row.childSnapshot) !== row.childSnapshotHash) throw corrupt();
  } catch (_) { throw corrupt(); }
}

function createAi3ContentHistoryService({ parentOnly, resource, transact } = {}) {
  if ([parentOnly, resource, transact].some(fn => typeof fn !== 'function')) throw new TypeError('AI3 history authority and transaction helpers required');

  async function validatePage(rows, round, session) {
    rows.forEach(row => validateContent(row, round));
    const revisions = rows.filter(row => row.version > 1);
    if (!revisions.length) return;
    // Only the returned page and its immediate links are read in the same authorization snapshot.
    const predecessors = await M.Content.find({ ...scope(round),
      _id: { $in: revisions.map(row => row.derivedFromContentId) } }).select('_id version').session(session).lean();
    const versions = new Map(predecessors.map(row => [String(row._id), row.version]));
    if (revisions.some(row => versions.get(String(row.derivedFromContentId)) !== row.version - 1)) throw corrupt();
  }

  async function listContents({ identity, roundId, page, pageSize }) {
    parentOnly(identity);
    return transact(async session => {
      const round = await resource(M.Round, identity, roundId, session);
      const paging = pagination(page, pageSize);
      const rows = await M.Content.find(scope(round)).sort({ version: -1, _id: -1 })
        .skip(paging.skip).limit(paging.pageSize).session(session).lean();
      await validatePage(rows, round, session);
      return { items: rows.map(summary), page: paging.page, pageSize: paging.pageSize };
    });
  }

  async function getContent({ identity, roundId, contentId }) {
    parentOnly(identity);
    return transact(async session => {
      const round = await resource(M.Round, identity, roundId, session);
      if (!C.isId(contentId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
      const row = await M.Content.findOne({ ...scope(round), _id: contentId }).session(session).lean();
      if (!row) throw C.error(404, 'RESOURCE_NOT_FOUND');
      await validatePage([row], round, session);
      return { content: { ...summary(row), content: row.content, childSnapshot: row.childSnapshot, reason: row.reason } };
    });
  }

  return { listContents, getContent };
}

module.exports = { createAi3ContentHistoryService };
