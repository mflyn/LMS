const fs = require('fs'), cp = require('child_process'), crypto = require('crypto'), path = require('path');
const root = process.cwd();
const config = { ...require(path.join(root, 'backend/tests/t2/jest.config.js')),
  rootDir: path.join(root, 'backend/tests/t2'), transform: { '\\.js$': '<TMP>/recurring-final-mutation-transform.cjs' } };
const results = [];
for (const [mode, pattern] of [['audit', 'real star loss'], ['date', 'two injected local dates']]) {
  const output = '<TMP>/recurring-final-mutation-' + mode;
  const result = cp.spawnSync(process.execPath, ['<DEPENDENCIES>/node_modules/jest/bin/jest.js',
    '--config=' + JSON.stringify(config), '--runInBand', '--no-cache', '--runTestsByPath',
    path.join(root, 'backend/tests/t2/recurringPlans.integration.test.js'), '--testNamePattern=' + pattern,
    '--json', '--outputFile=' + output + '.json'], { cwd: root, env: { ...process.env,
    NODE_PATH: '<DEPENDENCIES>/node_modules', RECURRING_REVIEW_MUTATION: mode }, encoding: 'utf8', timeout: 180000 });
  fs.writeFileSync(output + '.log', result.stdout + result.stderr);
  const report = JSON.parse(fs.readFileSync(output + '.json'));
  const failed = report.testResults.flatMap(suite => suite.assertionResults).filter(test => test.status === 'failed');
  if (result.status !== 1 || failed.length !== 1 || !failed[0].fullName.includes(pattern)) throw new Error('Mutation not caught: ' + mode);
  results.push({ mode, exitCode: result.status, failed: failed.length, assertions: failed.map(test => test.fullName) });
}
const files = ['backend/tests/t2/recurringPlans.integration.test.js', 'backend/services/homework-service/services/recurringTaskPlanService.js',
  'backend/services/homework-service/services/growthTaskCompletionConfirmationService.js'];
const report = { results, sources: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })) };
fs.writeFileSync('<TMP>/recurring-final-mutations-result.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
