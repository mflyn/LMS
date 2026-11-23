const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const invalid = () => Object.assign(new Error('AI_PROFILE_UNAVAILABLE'), { statusCode: 503, code: 'AI_PROFILE_UNAVAILABLE', details: [] });
const integer = n => Number.isSafeInteger(n) && n >= 0;
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const text = s => typeof s === 'string' && s.trim() && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s);
const iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const hash = o => createHash('sha256').update(canonicalize(o), 'utf8').digest('hex');
const trialFields = ['feeMode', 'estimateMethodVersion', 'referenceInputTokens', 'referenceOutputTokens',
  'estimatedReservationMicros', 'feeNoticeVersion'];
function isTrial(preview) {
  if (!preview || typeof preview !== 'object') throw invalid();
  if (!Object.hasOwn(preview, 'feeMode')) {
    if (['generationSchemaVersion', ...trialFields.slice(1)].some(k => Object.hasOwn(preview, k))) throw invalid();
    return false;
  }
  if (preview.feeMode !== 'estimate_only') throw invalid();
  return true;
}
function price(input, output, pricing, trial) {
  if (!integer(input) || (!trial && input > 8192) || !integer(output) || output > 4096
    || !integer(pricing?.inputPriceMicrosPerMillion) || !integer(pricing?.outputPriceMicrosPerMillion)) throw invalid();
  const ceil = (tokens, rate) => (BigInt(tokens) * BigInt(rate) + 999999n) / 1000000n;
  const charge = ceil(input, pricing.inputPriceMicrosPerMillion) + ceil(output, pricing.outputPriceMicrosPerMillion);
  if (charge > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid();
  return Number(charge);
}
function usageCharge(preview, usage) {
  const trial = isTrial(preview);
  if (trial) validateTrialPreview(preview);
  if (!exact(usage, ['inputTokens', 'outputTokens'])) throw invalid();
  return price(usage.inputTokens, usage.outputTokens, preview.pricing, trial);
}
function digest(preview, promptVersion) {
  const { generationInputHash, ...body } = preview;
  return hash({ ...body, promptVersion });
}
function validateTrialPreview(p, generationSchemaVersion = p?.generationSchemaVersion) {
  const ai3 = generationSchemaVersion === 'ai3-min-v2';
  const promptVersion = ai3 ? 'ai3-practice-prompt-v1' : 'ai1-prompt-v1';
  if (!isTrial(p) || !['ai1-min-v2', 'ai3-min-v2'].includes(generationSchemaVersion)
    || p.generationSchemaVersion !== generationSchemaVersion
    || !exact(p, ['generationInputHash', 'generationSchemaVersion', 'modelProfileVersion', 'pricingProfileVersion',
      'messages', 'requestOptions', 'pricing', 'sendNotAfter', 'sourceAvailable', 'inputProvenance', ...trialFields,
      ...(ai3 ? ['providerProfile', 'promptVersion', 'outputSchemaVersion'] : [])])
    || !text(p.modelProfileVersion) || !text(p.pricingProfileVersion)
    || p.sourceAvailable !== true || p.inputProvenance !== 'parent_confirmed_text'
    || p.estimateMethodVersion !== 'reference-8192-4096-v1' || p.feeNoticeVersion !== 'estimate-not-cap-v1'
    || p.referenceInputTokens !== 8192 || p.referenceOutputTokens !== 4096
    || !integer(p.estimatedReservationMicros) || !iso(p.sendNotAfter)
    || !exact(p.pricing, ['currency', 'inputPriceMicrosPerMillion', 'outputPriceMicrosPerMillion', 'checkedAt', 'expiresAt', 'sourceReference'])
    || p.pricing.currency !== 'CNY' || !text(p.pricing.sourceReference) || p.pricing.sourceReference.length > 2000
    || !iso(p.pricing.checkedAt) || !iso(p.pricing.expiresAt)
    || Date.parse(p.pricing.checkedAt) >= Date.parse(p.sendNotAfter) || Date.parse(p.sendNotAfter) >= Date.parse(p.pricing.expiresAt)
    || !exact(p.requestOptions, ['model', 'maxRequestBytes', 'maxOutputTokens', 'thinking', 'tools', 'attemptLimit'])
    || !text(p.requestOptions.model) || p.requestOptions.maxRequestBytes !== 32768 || p.requestOptions.maxOutputTokens !== 4096
    || p.requestOptions.thinking !== 'disabled' || !Array.isArray(p.requestOptions.tools) || p.requestOptions.tools.length
    || p.requestOptions.attemptLimit !== 1 || !Array.isArray(p.messages) || p.messages.length !== 2
    || !['system', 'user'].every((role, i) => exact(p.messages[i], ['role', 'content']) && p.messages[i].role === role && text(p.messages[i].content))
    || (ai3 && (p.providerProfile !== 'ai3-practice-v1' || p.promptVersion !== promptVersion || p.outputSchemaVersion !== 'ai3-practice-content-v1'))
    || p.estimatedReservationMicros !== price(8192, 4096, p.pricing, true)
    || p.generationInputHash !== digest(p, promptVersion)) throw invalid();
  return p;
}
function reservationAmount(preview) {
  if (isTrial(preview)) return validateTrialPreview(preview).estimatedReservationMicros;
  if (!integer(preview.reservedCeilingMicros)) throw invalid();
  return preview.reservedCeilingMicros;
}
function matchesConfirmation(preview, body) {
  try {
    const trial = isTrial(preview);
    if (!body || body.generationInputHash !== preview.generationInputHash || body.modelProfileVersion !== preview.modelProfileVersion
      || body.pricingProfileVersion !== preview.pricingProfileVersion || body.externalSendConfirmed !== true) return false;
    if (!trial) return ['ai1-min-v1', 'ai3-min-v1'].includes(body.schemaVersion)
      && !trialFields.some(k => Object.hasOwn(body, k)) && !Object.hasOwn(body, 'estimateAcknowledged')
      && !Object.hasOwn(body, 'expectedEstimatedReservationMicros')
      && integer(body.maxAuthorizedCostMicros) && body.maxAuthorizedCostMicros >= reservationAmount(preview);
    validateTrialPreview(preview);
    return body.schemaVersion === preview.generationSchemaVersion && body.feeMode === preview.feeMode
      && body.estimateMethodVersion === preview.estimateMethodVersion && body.feeNoticeVersion === preview.feeNoticeVersion
      && body.estimateAcknowledged === true && body.expectedEstimatedReservationMicros === preview.estimatedReservationMicros
      && !Object.hasOwn(body, 'maxAuthorizedCostMicros') && !Object.hasOwn(body, 'reservedCeilingMicros');
  } catch { return false; }
}
function buildTrialPreview(basePreview, profile, { promptVersion, generationSchemaVersion }) {
  if (!isTrial(profile) || !text(profile.sourceReference)
    || !['modelProfileVersion', 'pricingProfileVersion'].every(k => basePreview[k] === profile[k])
    || basePreview.requestOptions?.model !== profile.model
    || !['inputPriceMicrosPerMillion', 'outputPriceMicrosPerMillion', 'checkedAt', 'expiresAt'].every(k => basePreview.pricing?.[k] === profile[k])
    || promptVersion !== (generationSchemaVersion === 'ai3-min-v2' ? 'ai3-practice-prompt-v1' : 'ai1-prompt-v1')) throw invalid();
  const { generationInputHash, reservedCeilingMicros, ...base } = basePreview;
  const p = { ...base, generationSchemaVersion, feeMode: 'estimate_only', estimateMethodVersion: 'reference-8192-4096-v1',
    referenceInputTokens: 8192, referenceOutputTokens: 4096, feeNoticeVersion: 'estimate-not-cap-v1',
    requestOptions: { model: profile.model, maxRequestBytes: 32768, maxOutputTokens: 4096, thinking: 'disabled', tools: [], attemptLimit: 1 },
    pricing: { ...base.pricing, sourceReference: profile.sourceReference } };
  p.estimatedReservationMicros = price(8192, 4096, p.pricing, true);
  p.generationInputHash = digest(p, promptVersion);
  return validateTrialPreview(p, generationSchemaVersion);
}
module.exports = { isTrial, reservationAmount, usageCharge, matchesConfirmation, buildTrialPreview, validateTrialPreview };
