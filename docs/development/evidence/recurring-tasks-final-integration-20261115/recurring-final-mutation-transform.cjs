module.exports = { process(source, filename) {
  const mode = process.env.RECURRING_REVIEW_MUTATION;
  let from, to;
  if (mode === 'audit' && filename.endsWith('/growthTaskCompletionConfirmationService.js')) {
    from = "if (task.status === 'completed') {";
    to = "if (['completed', 'confirmed'].includes(task.status)) {";
  }
  if (mode === 'date' && filename.endsWith('/recurringTaskPlanService.js')) {
    from = 'Task.findOne({ recurringPlanId: plan._id, occurrenceDate: today })';
    to = 'Task.findOne({ recurringPlanId: plan._id })';
  }
  if (mode === 'cleanup' && filename.endsWith('/recurringBarrier.js')) {
    from = 'await Promise.all(pending)';
    to = '[]';
  }
  if (from) {
    if (source.split(from).length !== 2) throw new Error('Mutation target is not unique');
    source = source.replace(from, to);
  }
  return { code: source };
} };
