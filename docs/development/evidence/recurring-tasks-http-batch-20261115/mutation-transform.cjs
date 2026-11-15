module.exports = { process(source, filename) {
  const replacements = {
    cursor: ['recurringTaskPlanScanner.js', '{ _id: KEY, version: cursor.version }', '{ _id: KEY }'],
    drain: ['recurringTaskPlanScanner.js', 'if (!active) return;', 'if (true) return;'],
    body: ['backend/gateway/server.js', 'req.body = req[RECURRING_BODY]; next();', 'next();'],
    partial: ['completionRetentionReadinessHelpers.js',
      'canonicalize(index.partialFilterExpression || null) === canonicalize(spec.partialFilterExpression)', 'true'],
    unknown: ['recurringTaskPlanScanner.js',
      "if (shutdownFailure || !active && unresolved.size) throw error(503, 'RECURRING_SCAN_STOP_UNKNOWN');", ''],
    health: ['recurringTaskPlanScanner.js', 'healthWriteFailures++;', "throw error(503, 'RECURRING_SCAN_FAILED');"],
    terminal: ['recurringTaskPlanScanner.js', '[eligible, ...(unresolved.size ? [{ _id: { $in: [...unresolved] } }] : [])]', '[eligible]']
  };
  const [suffix, from, to] = replacements[process.env.RECURRING_MUTATION];
  if (filename.endsWith(suffix)) {
    if (source.split(from).length !== 2) throw new Error('Mutation anchor missing or ambiguous');
    source = source.replace(from, to);
  }
  return { code: source };
} };
