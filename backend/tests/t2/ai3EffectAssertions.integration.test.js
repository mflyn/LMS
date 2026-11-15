const { assertAi3AppliedEffects } = require('../../../tests/e2e/t2/ai3EffectAssertions');
const C = require('../../common/services/ai3ReviewEvidence');

const id = n => n.toString(16).padStart(24, '0');
const actorId = id(3), reviewedAt = '2026-11-05T00:00:00.000Z', appliedAt = '2026-11-05T00:00:01.000Z';
const effectId = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const clone = value => JSON.parse(JSON.stringify(value));
const tables = { mistake: ['Mistake', 'Ai3MistakeReceipt', 'MistakeStateEvent'],
  knowledgePoint: ['KnowledgePoint', 'Ai3MasteryReceipt', 'KnowledgePointMasteryEvent'] };

function fixture({ source = 'mistake', mastery = true, revision = 0 } = {}) {
  const s = { schemaVersion: 'ai3-final-review-v1', id: id(4), familyId: id(1), childId: id(2), roundId: id(5),
    sourcePackageId: id(6), sourceAttemptId: id(7), sourceAttemptVersion: 2, sourceAttemptPayloadHash: 'a'.repeat(64),
    sourceReviewHash: 'b'.repeat(64), source: { type: source, id: id(8) }, contentId: id(9), contentVersion: 1,
    contentHash: 'c'.repeat(64), childSnapshotHash: 'd'.repeat(64), attemptId: id(10), attemptVersion: 2,
    attemptPayloadHash: 'e'.repeat(64), reviewedByParentId: actorId, reviewedAt,
    evidenceSummary: 'Synthetic checked work', comment: '', masteryConfirmed: mastery, reviewReminderDate: '2026-11-08',
    targets: { mistake: source === 'mistake' ? { id: id(8), stateRevision: revision, effectId: effectId(1), knowledgePointId: id(11) } : null,
      knowledgePoint: mastery ? { id: id(11), stateRevision: revision, effectId: effectId(2) } : null } };
  const command = { _id: s.id, familyId: s.familyId, childId: s.childId, actorId, roundId: s.roundId,
    endpointOperation: 'ai3.review', finalReview: s, finalReviewHash: C.hash(s) };
  const database = Object.fromEntries(Object.values(tables).flat().map(name => [name, []]));
  for (const [kind, [targetTable, receiptTable, eventTable]] of Object.entries(tables)) {
    const t = s.targets[kind]; if (!t) continue;
    const request = { schemaVersion: 'ai3-review-effect-v1', effectId: t.effectId, finalReviewId: s.id,
      finalReviewHash: command.finalReviewHash, familyId: s.familyId, childId: s.childId,
      reviewedByParentId: actorId, targetId: t.id, expectedStateRevision: t.stateRevision };
    const { schemaVersion: _schemaVersion, ...identity } = request;
    const eventId = kind === 'mistake' ? id(12) : id(13);
    database[receiptTable].push({ _id: kind === 'mistake' ? id(14) : id(15), ...identity,
      requestHash: C.hash(request), status: 'applied', reviewedAt, appliedAt, decidedAt: appliedAt, eventId });
    const scope = { familyId: s.familyId, childId: s.childId };
    const evidence = { finalReviewId: s.id, finalReviewHash: command.finalReviewHash, reviewedByParentId: actorId, reviewedAt };
    if (kind === 'mistake') {
      database[targetTable].push({ _id: t.id, ...scope, subject: 'Math', knowledgePointId: id(11), stateRevision: revision + 1,
        reviewed: true, mastered: mastery, reviewReminderDate: s.reviewReminderDate, updatedBy: actorId });
      database[eventTable].push({ _id: eventId, ...scope, mistakeId: t.id, reviewed: true, mastered: mastery,
        reviewReminderDate: s.reviewReminderDate, effectiveAt: appliedAt, operationId: `ai3:${t.effectId}`,
        ai3Evidence: { effectId: t.effectId, ...evidence } });
    } else {
      database[targetTable].push({ _id: t.id, ...scope, dimension: 'academic', subject: 'Math', area: '', name: 'Synthetic math',
        masteryLevel: 'skilled', stateRevision: revision + 1, updatedByParentId: actorId });
      database[eventTable].push({ _id: eventId, ...scope, knowledgePointId: t.id, dimension: 'academic', subject: 'Math',
        area: '', name: 'Synthetic math', masteryLevel: 'skilled', sourceType: 'ai3_practice',
        operationId: t.effectId, effectiveAt: appliedAt, ...evidence });
    }
  }
  return { snapshot: { database }, command };
}
const check = f => assertAi3AppliedEffects(f.snapshot, f.command, actorId);

test.each([['mistake', true], ['mistake', false], ['task', true], ['task', false]])(
  'accepts complete %s evidence with mastery=%s without changing inputs', (source, mastery) => {
    const f = fixture({ source, mastery }), before = clone(f);
    expect(() => check(f)).not.toThrow(); expect(f).toEqual(before);
  });
test('an already-skilled point still needs a new revision and this round event', () => {
  const f = fixture({ source: 'task', revision: 7 });
  f.snapshot.database.KnowledgePointMasteryEvent.push({ ...clone(f.snapshot.database.KnowledgePointMasteryEvent[0]),
    _id: id(90), finalReviewId: id(91), operationId: effectId(9) });
  expect(() => check(f)).not.toThrow();
});
test('unconfirmed mastery does not force a previously mastered mistake to false', () => {
  const f = fixture({ mastery: false });
  f.snapshot.database.Mistake[0].mastered = true;
  f.snapshot.database.MistakeStateEvent[0].mastered = true;
  expect(() => check(f)).not.toThrow();
});

describe.each(Object.entries(tables))('%s applied effect', (kind, [targetTable, receiptTable, eventTable]) => {
  test('rejects applied receipt when the target revision was never incremented', () => {
    const f = fixture(); f.snapshot.database[targetTable][0].stateRevision = 0;
    expect(() => check(f)).toThrow(/stateRevision/);
  });
  test('rejects applied receipt when the target state was never updated', () => {
    const f = fixture(), target = f.snapshot.database[targetTable][0];
    if (kind === 'mistake') target.reviewed = false; else target.masteryLevel = 'learning';
    expect(() => check(f)).toThrow(kind === 'mistake' ? /reviewed/ : /masteryLevel/);
  });
  test('rejects receipt pointing to an existing old event even when this round event is absent', () => {
    const f = fixture(), db = f.snapshot.database, old = clone(db[eventTable][0]);
    old._id = id(90);
    if (kind === 'mistake') { old.ai3Evidence.finalReviewId = id(91); old.ai3Evidence.effectId = effectId(9); old.operationId = `ai3:${effectId(9)}`; }
    else { old.finalReviewId = id(91); old.operationId = effectId(9); }
    db[eventTable] = [old]; db[receiptTable][0].eventId = old._id;
    expect(() => check(f)).toThrow(/event/);
  });
  test('rejects a duplicate event for the same effect with a different row id', () => {
    const f = fixture(), rows = f.snapshot.database[eventTable]; rows.push({ ...clone(rows[0]), _id: id(90) });
    expect(() => check(f)).toThrow(/event/);
  });
  test.each(['familyId', 'childId', 'targetId', 'expectedStateRevision', 'requestHash', 'reviewedAt', 'appliedAt', 'decidedAt'])(
    'rejects mismatched receipt %s', field => {
      const f = fixture(), row = f.snapshot.database[receiptTable][0];
      row[field] = field === 'expectedStateRevision' ? 8 : field.endsWith('At') ? reviewedAt : field === 'requestHash' ? 'f'.repeat(64) : id(99);
      if (field === 'reviewedAt') row[field] = appliedAt;
      expect(() => check(f)).toThrow();
    });
  test.each(['familyId', 'childId', 'effectiveAt'])( 'rejects mismatched event %s', field => {
    const f = fixture(); f.snapshot.database[eventTable][0][field] = field === 'effectiveAt' ? reviewedAt : id(99);
    expect(() => check(f)).toThrow(/event/);
  });
  test('rejects an event for another target', () => {
    const f = fixture(); f.snapshot.database[eventTable][0][kind === 'mistake' ? 'mistakeId' : 'knowledgePointId'] = id(99);
    expect(() => check(f)).toThrow(/event/);
  });
  test.each(['finalReviewId', 'finalReviewHash', 'reviewedByParentId', 'reviewedAt'])(
    'rejects mismatched event audit %s', field => {
      const f = fixture(), event = f.snapshot.database[eventTable][0];
      const audit = kind === 'mistake' ? event.ai3Evidence : event;
      audit[field] = field === 'reviewedAt' ? appliedAt : field === 'finalReviewHash' ? 'f'.repeat(64) : id(99);
      expect(() => check(f)).toThrow(/event/);
    });
  test('rejects missing linked event', () => {
    const f = fixture(); f.snapshot.database[eventTable] = [];
    expect(() => check(f)).toThrow(/event/);
  });
  test('rejects a duplicate receipt hidden under another final review', () => {
    const f = fixture(), rows = f.snapshot.database[receiptTable]; rows.push({ ...clone(rows[0]), _id: id(90), finalReviewId: id(91) });
    expect(() => check(f)).toThrow(/receipt/);
  });
});

test.each(['mistake', 'knowledgePoint'])('null %s target forbids this round orphan event', kind => {
  const f = fixture({ source: 'task', mastery: false }), [, , eventTable] = tables[kind];
  f.snapshot.database[eventTable].push(kind === 'mistake'
    ? { _id: id(90), ai3Evidence: { finalReviewId: f.command.finalReview.id } }
    : { _id: id(90), finalReviewId: f.command.finalReview.id });
  expect(() => check(f)).toThrow(/event/);
});
test.each(['mistake', 'knowledgePoint'])('null %s target forbids this round receipt', kind => {
  const f = fixture({ source: 'task', mastery: false }), [, receiptTable] = tables[kind];
  f.snapshot.database[receiptTable].push({ _id: id(90), finalReviewId: f.command.finalReview.id });
  expect(() => check(f)).toThrow(/receipt/);
});
test('rejects a linked legacy mastery event without AI3 provenance', () => {
  const f = fixture(); delete f.snapshot.database.KnowledgePointMasteryEvent[0].sourceType;
  expect(() => check(f)).toThrow(/event/);
});
test('null reminder preserves a prior date rather than requiring its removal', () => {
  const f = fixture({ mastery: false }); f.command.finalReview.reviewReminderDate = null;
  f.command.finalReviewHash = C.hash(f.command.finalReview);
  const receipt = f.snapshot.database.Ai3MistakeReceipt[0]; receipt.finalReviewHash = f.command.finalReviewHash;
  const request = Object.fromEntries(['effectId', 'finalReviewId', 'finalReviewHash', 'familyId', 'childId',
    'reviewedByParentId', 'targetId', 'expectedStateRevision'].map(key => [key, receipt[key]]));
  receipt.requestHash = C.hash({ schemaVersion: 'ai3-review-effect-v1', ...request });
  f.snapshot.database.MistakeStateEvent[0].ai3Evidence.finalReviewHash = f.command.finalReviewHash;
  expect(() => check(f)).not.toThrow();
});
test('rejects a mismatched command hash or reviewer', () => {
  const f = fixture(); f.command.finalReviewHash = 'f'.repeat(64);
  expect(() => check(f)).toThrow();
  const valid = fixture(); expect(() => assertAi3AppliedEffects(valid.snapshot, valid.command, id(99))).toThrow();
});
