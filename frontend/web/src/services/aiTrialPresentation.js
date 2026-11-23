export const estimateNotice = '费用仅为估算，实际可能超过；不是单次或整轮费用硬上限。超估算或费用不明会停止后续发送。';
export const trialFeeFields = {
  feeMode: value => value === 'estimate_only',
  estimateMethodVersion: value => value === 'reference-8192-4096-v1',
  expectedEstimatedReservationMicros: value => Number.isSafeInteger(value) && value >= 0,
  feeNoticeVersion: value => value === 'estimate-not-cap-v1',
  estimateAcknowledged: value => value === true
};
export const isTrialPreview = preview => preview?.feeMode === 'estimate_only';
export const money = value => Number.isSafeInteger(value) && value >= 0 ? `${(value / 1000000).toFixed(6)} 元` : '待核对';
export const haltMessage = reason => ({
  estimate_exceeded: '实际费用超过估算，已停止后续发送。',
  cost_unknown: '费用未知，已停止后续发送。',
  cost_review_required: '费用待核对，已停止后续发送。',
  trial_exhausted: '本轮试用名额已用完，已停止后续发送。',
  budget_exceeded: '估算占用达到试用阈值，已停止后续发送。'
}[reason] || '已停止后续发送，请核对原操作记录。');
// Unknown fee modes never fall back to the old ceiling contract.
export function generationConfirmation(preview, profile, now = Date.now()) {
  const fail = () => { throw Object.assign(new Error('AI_PREVIEW_STALE'), { code: 'AI_PREVIEW_STALE' }); };
  if (!Number.isFinite(Date.parse(preview?.sendNotAfter)) || Date.parse(preview.sendNotAfter) <= now) fail();
  if (!Object.prototype.hasOwnProperty.call(preview, 'feeMode')) {
    if (['generationSchemaVersion', 'estimatedReservationMicros', 'feeNoticeVersion'].some(k => k in preview)
      || !Number.isSafeInteger(preview.reservedCeilingMicros) || preview.reservedCeilingMicros < 0) fail();
    return { schemaVersion: `${profile}-min-v1`, maxAuthorizedCostMicros: preview.reservedCeilingMicros };
  }
  if (!isTrialPreview(preview) || preview.generationSchemaVersion !== `${profile}-min-v2`
    || preview.estimateMethodVersion !== 'reference-8192-4096-v1' || preview.feeNoticeVersion !== 'estimate-not-cap-v1'
    || preview.referenceInputTokens !== 8192 || preview.referenceOutputTokens !== 4096
    || !Number.isSafeInteger(preview.estimatedReservationMicros) || preview.estimatedReservationMicros < 0
    || 'reservedCeilingMicros' in preview || 'maxAuthorizedCostMicros' in preview
    || preview.requestOptions?.maxRequestBytes !== 32768 || preview.requestOptions?.maxOutputTokens !== 4096
    || preview.requestOptions?.thinking !== 'disabled' || preview.requestOptions?.attemptLimit !== 1
    || !Array.isArray(preview.requestOptions?.tools) || preview.requestOptions.tools.length
    || !Array.isArray(preview.messages) || preview.messages.length !== 2
    || !['system', 'user'].every((role, i) => preview.messages[i]?.role === role && typeof preview.messages[i]?.content === 'string')
    || !preview.pricing?.sourceReference || Date.parse(preview.pricing?.expiresAt) <= now
    || !Number.isFinite(Date.parse(preview.pricing?.expiresAt))) fail();
  return { schemaVersion: `${profile}-min-v2`, feeMode: 'estimate_only', estimateMethodVersion: preview.estimateMethodVersion,
    expectedEstimatedReservationMicros: preview.estimatedReservationMicros, feeNoticeVersion: preview.feeNoticeVersion,
    estimateAcknowledged: true };
}
export const recoveryVersion = (record, profile) => record?.budget?.feeMode === 'estimate_only' ? `${profile}-min-v2` : `${profile}-min-v1`;
