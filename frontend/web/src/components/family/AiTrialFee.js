import React, { useEffect } from 'react';
import { estimateNotice, money, haltMessage } from '../../services/aiTrialPresentation';

export function TrialPreviewFee({ preview }) {
  return <><p>{estimateNotice}</p>
    <p>估算费用 {money(preview.estimatedReservationMicros)} · 最晚发送 {preview.sendNotAfter}</p>
    <p>参考输入 8192 tokens（未计数），不是输入计数结果或硬上限；输出上限 4096 tokens；请求大小上限 32 KiB；思考关闭；单次发送。</p>
    <p>计价来源：{preview.pricing?.sourceReference} · 核对时间 {preview.pricing?.checkedAt} · 有效期 {preview.pricing?.expiresAt}</p>
    <p>每百万 tokens：输入 {money(preview.pricing?.inputPriceMicrosPerMillion)}；输出 {money(preview.pricing?.outputPriceMicrosPerMillion)}。</p>
  </>;
}

export function usePreviewExpiry(preview, setConsent) {
  useEffect(() => {
    if (!preview) return;
    let timer;
    const check = () => {
      const remaining = Date.parse(preview.sendNotAfter) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) setConsent(false);
      else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [preview, setConsent]);
}
export function TrialResultFee({ record }) {
  const fee = record?.budget;
  if (fee?.feeMode !== 'estimate_only') return null;
  return <div role="status"><p>估算预留 {money(fee.estimatedReservationMicros)} · {fee.chargeStatus === 'usage_priced'
    ? `按用量计价 ${money(fee.usagePricedMicros)}` : fee.chargeStatus === 'released'
      ? '已确认未发送，费用预留已释放，试用名额不返还。' : fee.chargeStatus === 'unknown'
        ? '费用未知，保留原预留与原命令。' : '费用尚未结算。'}</p>
    {record.sendBlocked && <p>{haltMessage(record.sendBlockReason)} 历史查询和人工修订仍可继续。</p>}</div>;
}
