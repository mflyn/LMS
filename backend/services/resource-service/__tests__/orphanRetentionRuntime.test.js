const { execFileSync } = require('child_process');
const path = require('path');
const runtime = path.resolve(__dirname, '../services/orphanRetentionRuntime.js');
test('read-only retention dependencies do not load models, create indexes or write journal directories', () => {
  const source = `const mongoose=require('mongoose');
    const r=require(${JSON.stringify(runtime)});
    const deps=r.createRetentionReadDependencies({COMPLETION_RETIREMENT_SERVICE_TOKEN:'synthetic-distinct-retirement-token-32chars',
      COMPLETION_DELETION_JOURNAL_ROOT:'/does-not-exist/synthetic-protected-root'});
    process.stdout.write(JSON.stringify({models:mongoose.modelNames(),status:typeof deps.retirementClient.status,
      upload:Object.hasOwn(deps,'uploadJournal')}));`;
  expect(JSON.parse(execFileSync(process.execPath, ['-e', source], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../../..') })))
    .toEqual({ models: [], status: 'function', upload: false });
});
