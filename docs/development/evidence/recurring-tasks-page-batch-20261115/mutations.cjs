const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = process.cwd();
const temp = fs.mkdtempSync('/tmp/recurring-b3-mutations-');
fs.cpSync(path.join(root, 'frontend/web/src'), path.join(temp, 'src'), { recursive: true });
fs.copyFileSync(path.join(root, 'frontend/web/package.json'), path.join(temp, 'package.json'));
fs.symlinkSync(path.join(root, 'frontend/web/node_modules'), path.join(temp, 'node_modules'));
const service = 'src/services/recurringCommands.js', session = 'src/services/familySession.js', page = 'src/pages/family/RecurringPlansPage.js';
const originals = Object.fromEntries([service, session, page].map(f => [f, fs.readFileSync(path.join(temp, f), 'utf8')]));
const mutations = [
  ['marker', service, 'localStorage.setItem(RECURRING_MARKER_PREFIX + key, encoded);', '', 'persist only minimal'],
  ['notfound', service, "if (receipt?.state === 'not_found') return false;", "if (receipt?.state === 'not_found') { localStorage.removeItem(RECURRING_MARKER_PREFIX + key); return true; }", 'not_found and mismatched'],
  ['scope', service, '&& id(receipt.result?.data?.plan?.id) && receipt.result.data.plan.childId === marker.childId\n      && (marker.action === \'create\' || receipt.result.data.plan.id === marker.targetPlanId)', '', 'matching succeeded|success for'],
  ['slots', service, '...(operationId ? [operationId] : [])', '...[]', 'interleaved tabs'],
  ['reauth', session, "if (role === 'parent') clearRecurringBodies(nextActor);", '', 'same actor authentication'],
  ['logout', session, "const ai3Only = reason === 'expired';", "const ai3Only = reason === 'expired'; for (const key of Object.keys(localStorage)) if (key.startsWith('family-growth.recurring-marker.v1:')) localStorage.removeItem(key);", 'explicit logout'],
  ['late', service, 'assertSessionCurrent(session);\n  check(isCurrent());\n  check(same(readRecurringCommand(scope, session, marker.operationId)?.marker, marker));', '', 'session changes while succeeded'],
  ['abort', page, 'const command = readRecurringCommand(scope, session, prompt.marker.operationId);\n      if (!command || command.corrupt || JSON.stringify(command.marker) !== JSON.stringify(prompt.marker))', 'const command = readMarker();\n      if (!command || command.corrupt)', 'abort confirmation']
];
const results = [];
for (const [name, file, from, to, pattern] of mutations) {
  for (const [f, source] of Object.entries(originals)) fs.writeFileSync(path.join(temp, f), source);
  let source = originals[file];
  if (source.split(from).length !== 2) throw new Error('mutation is not unique: ' + name);
  source = source.replace(from, to);
  // Both direct save and observed revision cleanup enforce this boundary; remove both for this single invariant.
  if (name === 'reauth') source = source.replace("if (role === 'parent' && session) clearRecurringBodies(actor(role, session), value.revision);", '');
  fs.writeFileSync(path.join(temp, file), source);
  const output = '/tmp/recurring-b3-mutation-' + name;
  const result = cp.spawnSync(process.execPath, [path.join(temp, 'node_modules/react-scripts/bin/react-scripts.js'), 'test', '--watchAll=false', '--runInBand',
    '--runTestsByPath', 'src/__tests__/family/recurringCommands.test.js', 'src/__tests__/family/RecurringPlansPage.test.js', '--testNamePattern=' + pattern,
    '--json', '--outputFile=' + output + '.json'], { cwd: temp, env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 60000 });
  fs.writeFileSync(output + '.log', result.stdout + result.stderr);
  const report = JSON.parse(fs.readFileSync(output + '.json'));
  results.push({ name, exitCode: result.status, failed: report.numFailedTests, passed: report.numPassedTests, skippedByFocusedSelection: report.numPendingTests });
  if (result.status !== 1 || report.numFailedTests < 1) throw new Error('mutation survived: ' + name);
}
fs.writeFileSync('/tmp/recurring-b3-mutations-summary.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
const files = [service, session, page, 'src/__tests__/family/recurringCommands.test.js', 'src/__tests__/family/RecurringPlansPage.test.js'];
fs.writeFileSync('/tmp/recurring-b3-mutations-binding.json', JSON.stringify({ files: files.map(file => ({ file: 'frontend/web/' + file,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'frontend/web', file))).digest('hex') })), results }, null, 2));
