export const dailyPlanPayload = body => ({
  expectedVersion: body.expectedVersion,
  items: body.items.map(item => ({ taskId: item.taskId, childEstimatedMinutes: item.childEstimatedMinutes ?? null }))
});

export const familyLocalDate = (timezone, at = new Date()) => {
  if (!timezone) throw new Error('Family timezone required');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
