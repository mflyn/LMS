import { generationConfirmation, recoveryVersion } from '../../services/aiTrialPresentation';
import { saveTutorCommand, readTutorCommand } from '../../services/tutorCommands';
import { validAi3Command } from '../../services/ai3Commands';
import { saveParentSession, captureSession } from '../../services/familySession';

const preview = profile => ({ generationSchemaVersion: `${profile}-min-v2`, feeMode: 'estimate_only',
  generationInputHash: 'f'.repeat(64), modelProfileVersion: 'synthetic', pricingProfileVersion: 'synthetic',
  estimateMethodVersion: 'reference-8192-4096-v1', feeNoticeVersion: 'estimate-not-cap-v1',
  referenceInputTokens: 8192, referenceOutputTokens: 4096, estimatedReservationMicros: 42,
  messages: [{ role: 'system', content: '系统' }, { role: 'user', content: '题目' }],
  pricing: { sourceReference: 'synthetic-only', expiresAt: '2099-01-02T00:00:00.000Z' },
  sendNotAfter: '2099-01-01T00:00:00.000Z', requestOptions: { maxRequestBytes: 32768, maxOutputTokens: 4096,
    thinking: 'disabled', tools: [], attemptLimit: 1 } });
const scope = { familyId: 'b'.repeat(24), childId: 'c'.repeat(24) };
const body = profile => ({ ...generationConfirmation(preview(profile), profile), operationId: '00000000-0000-4000-8000-000000000001',
  generationInputHash: 'f'.repeat(64), modelProfileVersion: 'synthetic', pricingProfileVersion: 'synthetic', externalSendConfirmed: true });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); saveParentSession({ token: 'synthetic', user: { id: 'a'.repeat(24), role: 'parent' } }); });
test.each(['ai1', 'ai3'])('%s v2 confirmation never carries a hard-cap authorization', profile => {
  expect(generationConfirmation(preview(profile), profile)).toEqual({ schemaVersion: `${profile}-min-v2`, feeMode: 'estimate_only',
    estimateMethodVersion: 'reference-8192-4096-v1', expectedEstimatedReservationMicros: 42,
    feeNoticeVersion: 'estimate-not-cap-v1', estimateAcknowledged: true });
});
test.each([
  { feeMode: 'unknown' }, { feeNoticeVersion: 'old' }, { reservedCeilingMicros: 42 },
  { sendNotAfter: '2000-01-01T00:00:00.000Z' }, { generationSchemaVersion: 'ai3-min-v2' },
  { pricing: { sourceReference: 'synthetic', expiresAt: 'invalid' } }, { referenceInputTokens: 0 }
])('malformed or expired preview does not downgrade: %j', change => {
  expect(() => generationConfirmation({ ...preview('ai1'), ...change }, 'ai1')).toThrow('AI_PREVIEW_STALE');
});
test('v2 original body survives storage; missing acknowledgement and mixed v1 ceiling are rejected', () => {
  const command = { action: 'generate', targetId: 'd'.repeat(24), body: { ...body('ai1'), expectedCycleStateVersion: 1 } };
  const session = captureSession('parent');
  for (const change of [{ estimateAcknowledged: false }, { maxAuthorizedCostMicros: 42 }]) {
    expect(() => saveTutorCommand(scope, { ...command, body: { ...command.body, ...change } }, session)).toThrow('AI_COMMAND_INVALID');
  }
  saveTutorCommand(scope, command, session);
  expect(readTutorCommand(scope, session)).toEqual(command);
});
test('AI3 v2 validates acknowledgement and keeps original v1 commands valid', () => {
  const command = { action: 'generate', targetId: 'd'.repeat(24), attemptId: null,
    body: { ...body('ai3'), expectedRoundVersion: 1, deidentifiedConfirmed: true } };
  expect(validAi3Command(command)).toBe(true);
  expect(validAi3Command({ ...command, body: { ...command.body, estimateAcknowledged: false } })).toBe(false);
  expect(validAi3Command({ ...command, body: { ...command.body, maxAuthorizedCostMicros: 42 } })).toBe(false);
  expect(recoveryVersion({ budget: { feeMode: 'estimate_only' } }, 'ai3')).toBe('ai3-min-v2');
  expect(recoveryVersion({ budget: { reservedMicros: 42 } }, 'ai3')).toBe('ai3-min-v1');
});
