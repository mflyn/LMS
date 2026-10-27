const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { validate } = require('../../../../scripts/check-family-docs');

const repositoryRoot = path.resolve(__dirname, '../../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

describe('family baseline documentation gate', () => {
  test('the repeatable documentation audit succeeds', () => {
    expect(() => {
      execFileSync(process.execPath, ['scripts/check-family-docs.js'], {
        cwd: repositoryRoot,
        stdio: 'pipe'
      });
    }).not.toThrow();
  });

  test('the release gate runs the documentation audit', () => {
    const packageJson = JSON.parse(read('package.json'));
    const releaseGate = read('scripts/release-family-gate.sh');

    expect(packageJson.scripts['docs:family:check']).toBe(
      'node scripts/check-family-docs.js'
    );
    expect(releaseGate).toContain('npm run docs:family:check');
  });

  test('the historical v1.6 manifest and current v1.7 traceability stay distinct', () => {
    const manifest = read(
      'docs/development/family-growth-baseline-v1.6-manifest.md'
    );
    const traceability = read(
      'docs/development/family-growth-requirement-traceability.md'
    );
    const task12Gate = read(
      'docs/development/family-growth-task12-gate.md'
    );
    const product = read('docs/product/family-learning-tracker.md');
    const architecture = read(
      'docs/architecture/family-learning-tracker-architecture.md'
    );
    const api = read('docs/api/family-learning-tracker-api.md');
    const userGuide = read('docs/user-guide/README.md');
    const childGuide = read('docs/user-guide/child-guide.md');
    const ubuntuDeployment = read('docs/deployment/local-ubuntu-deployment.md');

    expect(manifest).toContain('**status:** READY_FOR_REVIEW');
    expect(manifest).toContain(
      '**implementationEvidenceCommit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`'
    );
    expect(manifest).toContain('17 份权威文档');
    expect(manifest).toContain('70 suites / 756 tests');
    expect(manifest).toContain('25 suites / 156 tests');
    expect(manifest).not.toContain('**status:** APPROVED');

    expect(traceability).toContain('**Document status:** FGT-MVP-1.7 IMPLEMENTED / RELEASE GATE');
    expect(traceability).toContain('**Implementation conformance:** COVERED (38/38)');
    expect(traceability).toContain('**Baseline candidate:** FGT-MVP-1.7');
    expect(task12Gate).toContain('npm run test:task12:integration');
    expect(task12Gate).toContain('npm run repair:family-relationships:check');

    for (const document of [product, architecture, api]) {
      expect(document).toContain('**Baseline candidate:** FGT-MVP-1.7');
    }

    expect(userGuide).toContain('知识与能力点');
    expect(childGuide).not.toContain('姓名、昵称、年级、学校');
    expect(ubuntuDeployment).toContain('该 `.env` 位于仓库根目录');
    expect(ubuntuDeployment).not.toContain('backend/.env');
  });
});

describe('approved T1 and bounded T2/T3 closure boundaries', () => {
  const gate = 'docs/development/family-self-directed-learning-mvp-gate.md';
  const plan = 'docs/superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md';
  const reconciliation = 'docs/development/family-self-directed-learning-t1-acceptance-reconciliation.md';
  const navigation = 'docs/development/README.md';
  const operations = 'docs/deployment/completion-operations.md';
  const execution = 'docs/development/family-self-directed-learning-t2-execution.md';
  const design = 'docs/architecture/family-self-directed-learning-system-design.md';
  const approval = 'docs/development/family-self-directed-learning-t2-closure-approval.json';
  const t3Approval = 'docs/development/evidence/t3-synthetic-2026-10-25/approval.json';
  const t3Review = 'docs/development/evidence/t3-synthetic-2026-10-25/independent-review.json';
  const t3Submission = 'docs/development/evidence/t3-synthetic-2026-10-25/delivery.json';

  test('accepts the approved closure while keeping historical OPEN records', () => {
    expect(read(gate)).toContain('| T1 | CLOSED |');
    expect(read(gate)).toContain('**T1:** IN_PROGRESS / OPEN');
    expect(() => validate()).not.toThrow();
  });

  test('accepts explicit synthetic T2 approval without granting device or deployment approval', () => {
    const header = read(gate).split('\n## ')[0];
    expect(header).toContain('**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY');
    expect(header).toContain('**T2 approval:** APPROVED');
    expect(header).toContain('**T2 device:** DEVICE_PENDING');
    expect(header).toContain('**T2 deployment:** T8_PENDING / NOT_AUTHORIZED');
    expect(header).toContain('**T2 deferred:** REMAINDER_DEFERRED');
    expect(read(gate)).toContain('| T2 | CLOSED |');
    expect(() => validate()).not.toThrow();
  });

  test('validates a checkout without ignored local evidence files or directories', () => {
    const original = fs.readFileSync;
    const originalExists = fs.existsSync;
    const ignoredRoot = path.join(repositoryRoot, 'release-gate-artifacts');
    const isIgnored = requested => String(requested) === ignoredRoot ||
      String(requested).startsWith(ignoredRoot + path.sep);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, ...args) => {
      if (isIgnored(requested)) throw new Error('Ignored artifacts unavailable in fresh checkout');
      return original(requested, ...args);
    });
    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation(requested => {
      return isIgnored(requested) ? false : originalExists(requested);
    });
    try {
      expect(() => validate()).not.toThrow();
    } finally {
      spy.mockRestore();
      existsSpy.mockRestore();
    }
  });

  test('closes only the approved D2B-05 query defect while preserving the failed approval snapshot', () => {
    const header = read(gate).split('\n## ')[0];
    expect(header).toContain('**T2 approval-time full regression:** FAILED / D2B-05 / REMAINDER_DEFERRED');
    expect(header).toContain('**T2 latest full regression:** PASSED / CI 40099315976 / e744cba1');
    expect(header).toContain('**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY');
    expect(JSON.parse(read(approval)).latestFullRegression).toMatchObject({ status: 'FAILED', failedTests: 1, disposition: 'REMAINDER_DEFERRED' });
    expect(header).toContain('**T2 deferred:** REMAINDER_DEFERRED');
    expect(header).toContain('**T2 device:** DEVICE_PENDING');
    expect(() => validate()).not.toThrow();
  });

  test('T3 closure requires independent passing evidence without rewriting the submission snapshot', () => {
    expect(JSON.parse(read(t3Review))).toMatchObject({ decision: 'PASS', openFindings: 0 });
    expect(JSON.parse(read(t3Submission))).toMatchObject({
      gateAtSubmission: 'OPEN', historicalIndependentBaseline: { decision: 'NEEDS_FIXES', openP2: 2 }
    });
    expect(JSON.parse(read(t3Approval))).toMatchObject({
      status: 'APPROVED', gateStatus: 'CLOSED', scope: 'ENGINEERING_SYNTHETIC_ONLY',
      retained: { device: 'DEVICE_PENDING', advancedRecoveryAndNewCleanup: 'REMAINDER_DEFERRED', 'SL-02': 'PLANNED' }
    });
    expect(() => validate()).not.toThrow();
  });

  test.each([t3Approval, t3Review])('rejects missing T3 closure evidence %s', file => {
    const original = fs.readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, ...args) => {
      if (requested === path.join(repositoryRoot, file)) throw new Error('Missing evidence');
      return original(requested, ...args);
    });
    try {
      expect(() => validate()).toThrow('T3 approval and independent review must be present');
    } finally {
      spy.mockRestore();
    }
  });

  test.each([
    ...[
      gate, execution,
      'docs/development/family-self-directed-learning-t2-qa-p2-review.md',
      'docs/development/family-self-directed-learning-t2-d2b-budget-followup.md'
    ].flatMap(file => [
      [`budget scope widens in ${file}`, file, '**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY', '**D2B budget:** APPROVED / CLOSED / PRODUCTION', 'D2B budget must remain uniquely'],
      [`isolation P3 closure missing in ${file}`, file, '**D2B isolation P3:** APPROVED / CLOSED', '', 'D2B isolation P3 must remain uniquely'],
      [`budget conflict in ${file}`, file, '**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY', '**D2B budget:** OPEN\n**D2B budget:** APPROVED / CLOSED / SYNTHETIC_ONLY', 'D2B budget must remain uniquely'],
      [`retained boundaries lost in ${file}`, file, '**D2B retained:** HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED', '**D2B retained:** ALL_PASSED', 'D2B retained must remain uniquely']
    ]),
    ['current T1 regresses', gate, '| T1 | CLOSED |', '| T1 | IN_PROGRESS |', 'exactly one CLOSED T1 row'],
    ['duplicate CLOSED row', gate, '| T1 | CLOSED |', '| T1 | CLOSED | duplicate |\n| T1 | CLOSED |', 'exactly one CLOSED T1 row'],
    ['conflicting current row', gate, '| T1 | CLOSED |', '| T1 | OPEN | stale |\n| T1 | CLOSED |', 'exactly one CLOSED T1 row'],
    ['scope widens', gate, '**T1 closure scope:** BACKEND_SYNTHETIC_ONLY', '**T1 closure scope:** PRODUCTION', 'closure scope must remain BACKEND_SYNTHETIC_ONLY'],
    ['deployment approval invented', gate, '**Production deployment:** NOT_AUTHORIZED', '**Production deployment:** AUTHORIZED', 'production deployment must remain NOT_AUTHORIZED'],
    ['T2 closure regresses', gate, '| T2 | CLOSED |', '| T2 | IN_PROGRESS |', 'exactly one CLOSED T2 row'],
    ['T2 progress is lost', gate, '| T2 | CLOSED |', '| T2 | NOT_STARTED |', 'exactly one CLOSED T2 row'],
    ['T2 row is missing', gate, '| T2 | CLOSED |', '| removed | CLOSED |', 'exactly one CLOSED T2 row'],
    ['T2 duplicate row', gate, '| T2 | CLOSED |', '| T2 | CLOSED | duplicate |\n| T2 | CLOSED |', 'exactly one CLOSED T2 row'],
    ['T2 conflicting row before', gate, '| T2 | CLOSED |', '| T2 | IN_PROGRESS | stale |\n| T2 | CLOSED |', 'exactly one CLOSED T2 row'],
    ['T2 conflicting row after', gate, '| T2 | CLOSED |', '| T2 | CLOSED | current |\n| T2 | IN_PROGRESS |', 'exactly one CLOSED T2 row'],
    ['T2 whitespace duplicate', gate, '| T2 | CLOSED |', '| T2 | CLOSED | current |\n|  T2  | CLOSED |', 'exactly one CLOSED T2 row'],
    ['T2 whitespace conflict before', gate, '| T2 | CLOSED |', '|\tT2\t| IN_PROGRESS | stale |\n| T2 | CLOSED |', 'exactly one CLOSED T2 row'],
    ['T2 whitespace conflict after', gate, '| T2 | CLOSED |', '| T2 | CLOSED | current |\n| T2  | IN_PROGRESS |', 'exactly one CLOSED T2 row'],
    ['T2 whitespace regression', gate, '| T2 | CLOSED |', '|  T2  |  IN_PROGRESS  |', 'exactly one CLOSED T2 row'],
    ['T2 closure scope widens', gate, '**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY', '**T2 closure scope:** PRODUCTION', 'T2 closure scope must remain ENGINEERING_SYNTHETIC_ONLY'],
    ['T2 scope is missing', gate, '**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY', '', 'T2 closure scope must remain ENGINEERING_SYNTHETIC_ONLY'],
    ['T2 duplicate scope', gate, '**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY', '**T2 closure scope:** ENGINEERING_SYNTHETIC_ONLY\n**T2 closure scope:** PRODUCTION', 'T2 closure scope must remain ENGINEERING_SYNTHETIC_ONLY'],
    ['T2 approval is missing', gate, '**T2 approval:** APPROVED', '', 'T2 approval must remain APPROVED'],
    ['T2 device approval invented', gate, '**T2 device:** DEVICE_PENDING', '**T2 device:** PASSED', 'T2 device must remain DEVICE_PENDING'],
    ['T2 deployment approval invented', gate, '**T2 deployment:** T8_PENDING / NOT_AUTHORIZED', '**T2 deployment:** AUTHORIZED', 'T2 deployment must remain T8_PENDING / NOT_AUTHORIZED'],
    ['T2 deferred work marked passed', gate, '**T2 deferred:** REMAINDER_DEFERRED', '**T2 deferred:** CLOSED', 'T2 deferred must remain REMAINDER_DEFERRED'],
    ['T2 execution loses scope', execution, '**Status:** T2 CLOSED / ENGINEERING_SYNTHETIC_ONLY / T2-G REMAINDER_DEFERRED', '**Status:** T2 CLOSED', 'T2 execution status must retain the bounded closed gate'],
    ['T2 approval regresses', approval, '"status": "APPROVED"', '"status": "PENDING_USER_APPROVAL"', 'T2 approval record must retain the latest explicit closure instruction'],
    ['T2 gate regresses', approval, '"gateStatus": "CLOSED"', '"gateStatus": "OPEN"', 'T2 approval record must retain the latest explicit closure instruction'],
    ['T2 batches regress', approval, '"batchStatus": "CLOSED"', '"batchStatus": "PENDING_USER_APPROVAL"', 'T2 approval record must close exactly the three reviewed P2 defects'],
    ['full regression green invented', approval, '"status": "FAILED"', '"status": "PASSED"', 'T2 approval must preserve the failed full regression and deferred D2B-05 evidence'],
    ['full regression failure count erased', approval, '"failedTests": 1', '"failedTests": 0', 'T2 approval must preserve the failed full regression and deferred D2B-05 evidence'],
    ['D2B-05 incorrectly closed', approval, '"disposition": "REMAINDER_DEFERRED"', '"disposition": "CLOSED"', 'T2 approval must preserve the failed full regression and deferred D2B-05 evidence'],
    ['failure evidence replaced', approval, 't2-p2-approved-acceptance-2026-10-24/family.json', 't2-engineering-closure-2026-10-24/family.json', 'T2 approval must preserve the failed full regression and deferred D2B-05 evidence'],
    ['historical regression header green invented', gate, '**T2 approval-time full regression:** FAILED / D2B-05 / REMAINDER_DEFERRED', '**T2 approval-time full regression:** PASSED', 'T2 approval-time full regression must remain FAILED / D2B-05 / REMAINDER_DEFERRED'],
    ['query closure missing', gate, '**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY', '', 'D2B-05 query timeout must remain APPROVED / CLOSED / QUERY_ONLY'],
    ['query closure expands to recovery', gate, '**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY', '**D2B-05 query timeout:** APPROVED / CLOSED / FULL_RECOVERY', 'D2B-05 query timeout must remain APPROVED / CLOSED / QUERY_ONLY'],
    ['query closure duplicated', gate, '**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY', '**D2B-05 query timeout:** APPROVED / CLOSED / QUERY_ONLY\n**D2B-05 query timeout:** OPEN', 'D2B-05 query timeout must remain APPROVED / CLOSED / QUERY_ONLY'],
    ['query CI evidence replaced', gate, '**T2 latest full regression:** PASSED / CI 40099315976 / e744cba1', '**T2 latest full regression:** PASSED / CI 40096601369 / a0478275', 'T2 latest full regression must remain PASSED / CI 40099315976 / e744cba1'],
    ['Git authorization invented', approval, '"git_commit_or_push", ', '', 'T2 approval must preserve prohibited operations'],
    ['T2 approval record scope widens', approval, '"scope": "ENGINEERING_SYNTHETIC_ONLY"', '"scope": "PRODUCTION"', 'T2 approval record must retain ENGINEERING_SYNTHETIC_ONLY'],
    ['T2 defect reopened', approval, '"T2-P2-JWT": "CLOSED"', '"T2-P2-JWT": "OPEN"', 'T2 approval record must close exactly the three reviewed P2 defects'],
    ['T2 approval record device passed', approval, '"device": "DEVICE_PENDING"', '"device": "PASSED"', 'T2 approval record must preserve pending and deferred boundaries'],
    ['T2 design status regresses', design, 'T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5 合成工程已关闭，T6–T9 待执行', 'T2 已批准设计并启动 T2-1 基线修复，T3–T9 待执行', 'system design must record T0 complete, T1 closed and T2 closed in section 15'],
    ['T3 closure regresses', gate, '| T3 | CLOSED |', '| T3 | IN_PROGRESS |', 'exactly one CLOSED T3 row'],
    ['T3 missing', gate, '| T3 | CLOSED |', '| removed | CLOSED |', 'exactly one CLOSED T3 row'],
    ['T3 contradictory duplicate', gate, '| T3 | CLOSED |', '| T3 | CLOSED | current |\n|  T3  | OPEN |', 'exactly one CLOSED T3 row'],
    ['T3 approval missing', gate, '**T3 approval:** APPROVED', '', 'T3 approval must remain APPROVED'],
    ['T3 gate regresses', gate, '**T3 gate:** CLOSED', '**T3 gate:** OPEN', 'T3 gate must remain CLOSED'],
    ['T3 scope widens', gate, '**T3 scope:** ENGINEERING_SYNTHETIC_ONLY', '**T3 scope:** PRODUCTION', 'T3 scope must remain ENGINEERING_SYNTHETIC_ONLY'],
    ['T3 duplicate scope', gate, '**T3 scope:** ENGINEERING_SYNTHETIC_ONLY', '**T3 scope:** ENGINEERING_SYNTHETIC_ONLY\n**T3 scope:** PRODUCTION', 'T3 scope must remain ENGINEERING_SYNTHETIC_ONLY'],
    ['T3 device falsely passed', gate, '**T3 device:** DEVICE_PENDING', '**T3 device:** PASSED', 'T3 device must remain DEVICE_PENDING'],
    ['T3 deferred falsely closed', gate, '**T3 deferred:** REMAINDER_DEFERRED', '**T3 deferred:** CLOSED', 'T3 deferred must remain REMAINDER_DEFERRED'],
    ['T3 approval record regresses', t3Approval, '"status": "APPROVED"', '"status": "PENDING_REVIEW"', 'T3 approval must retain the conditional user authorization'],
    ['T3 approval scope widens', t3Approval, '"scope": "ENGINEERING_SYNTHETIC_ONLY"', '"scope": "PRODUCTION"', 'T3 approval must retain the conditional user authorization'],
    ['T3 review candidate replaced', t3Approval, '0b7c40fca678cd5b7fc1e6bd821d03f653d7f909', '301edf7ec067a66719784d2766731e8acdbd1bad', 'T3 independent review must bind the reviewed candidate'],
    ['T3 parent denial reopened', t3Approval, '"T3-HELP-P2-PARENT-DENIAL": "CLOSED"', '"T3-HELP-P2-PARENT-DENIAL": "OPEN"', 'T3 must close exactly the independently reviewed P2 defects'],
    ['T3 loading reopened', t3Approval, '"T3-HELP-P2-LOADING": "CLOSED"', '"T3-HELP-P2-LOADING": "OPEN"', 'T3 must close exactly the independently reviewed P2 defects'],
    ['T3 prior failures erased', t3Approval, '"historicalFailures": "PRESERVED"', '"historicalFailures": "ALL_GREEN"', 'T3 approval must retain pending and deferred boundaries'],
    ['T3 approval device passed', t3Approval, '"device": "DEVICE_PENDING"', '"device": "PASSED"', 'T3 approval must retain pending and deferred boundaries'],
    ['T3 approval deferred passed', t3Approval, '"advancedRecoveryAndNewCleanup": "REMAINDER_DEFERRED"', '"advancedRecoveryAndNewCleanup": "CLOSED"', 'T3 approval must retain pending and deferred boundaries'],
    ['T3 review fails', t3Review, '"decision": "PASS"', '"decision": "NEEDS_FIXES"', 'T3 independent review must bind the reviewed candidate'],
    ['T3 review findings remain', t3Review, '"openFindings": 0', '"openFindings": 1', 'T3 independent review must bind the reviewed candidate'],
    ['T3 evidence bytes changed', t3Review, '"decision": "PASS"', '"decision":  "PASS"', 'T3 independent review must bind the reviewed candidate'],
    ['T3 original independent failure erased', t3Submission, '"decision": "NEEDS_FIXES"', '"decision": "PASS"', 'T3 must preserve its original failed independent review'],
    ['T3 original open snapshot erased', t3Submission, '"gateAtSubmission": "OPEN"', '"gateAtSubmission": "CLOSED"', 'T3 must preserve its original failed independent review'],
    ['T4 closes without approval', gate, '| T4 | IN_PROGRESS |', '| T4 | CLOSED |', 'T4 must be IN_PROGRESS'],
    ['T4 implementation disappears', gate, '| T4 | IN_PROGRESS |', '| T4 | NOT_STARTED |', 'T4 must be IN_PROGRESS'],
    ['T4 closure approval removed', gate, '关闭需用户批准 |', '自动关闭 |', 'T4 must be IN_PROGRESS'],
    ['T5 closure regresses', gate, '| T5 | CLOSED |', '| T5 | IN_PROGRESS |', 'T5 must be CLOSED'],
    ['T5 regresses to not started', gate, '| T5 | CLOSED |', '| T5 | NOT_STARTED |', 'T5 must be CLOSED'],
    ['T5 duplicate current row', gate, '| T5 | CLOSED |', '| T5 | NOT_STARTED | stale |\n| T5 | CLOSED |', 'T5 must be CLOSED'],
    ['T5 row loses closed gate', gate, '§25.5 用户已批准限定合成工程；总门禁 CLOSED', '§25.5 用户已批准限定合成工程；总门禁 OPEN', 'T5 must be CLOSED'],
    ['T5 row loses approved boundary', gate, '§25.5 用户已批准限定合成工程；总门禁 CLOSED，仅 ENGINEERING_SYNTHETIC_ONLY', '§25.5 自动关闭；总门禁 CLOSED，仅 PRODUCTION', 'T5 must be CLOSED'],
    ...[gate, plan].flatMap(file => [
      ['state', '**T5:** CLOSED', 'IN_PROGRESS', 'CLOSED'],
      ['gate', '**T5 gate:** CLOSED', 'OPEN', 'CLOSED'],
      ['approval', '**T5 approval:** APPROVED', 'REQUIRED', 'APPROVED'],
      ['scope', '**T5 scope:** LOCAL_SYNTHETIC_ONLY', 'PRODUCTION', 'LOCAL_SYNTHETIC_ONLY'],
      ['closure', '**T5 closure:** APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY', 'APPROVED / CLOSED / PRODUCTION', 'APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY'],
      ['historical failures', '**T5 historical failures:** PRESERVED', 'ALL_GREEN', 'PRESERVED'],
      ['nonblocking', '**T5 nonblocking:** T5-NB-001 OPEN_NONBLOCKING / T5-NB-002 OPEN_NONBLOCKING', 'T5-NB-001 CLOSED / T5-NB-002 CLOSED', 'T5-NB-001 OPEN_NONBLOCKING / T5-NB-002 OPEN_NONBLOCKING'],
      ['device', '**T5 device:** DEVICE_PENDING', 'PASSED', 'DEVICE_PENDING'],
      ['deployment', '**T5 deployment:** T8_PENDING / NOT_AUTHORIZED', 'AUTHORIZED', 'T8_PENDING / NOT_AUTHORIZED'],
      ['deferred', '**T5 deferred:** REMAINDER_DEFERRED', 'CLOSED', 'REMAINDER_DEFERRED'],
      ['Git', '**T5 Git:** BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY', 'AUTHORIZED', 'BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY']
    ].flatMap(([name, before, changed, expected]) => [
      [`T5 ${name} falsely changed in ${file}`, file, before, before.slice(0, before.indexOf('** ') + 3) + changed, `T5 current ${name} must remain ${expected}`],
      [`T5 ${name} missing in ${file}`, file, before, '', `T5 current ${name} must remain ${expected}`],
      [`T5 ${name} contradicts in ${file}`, file, before, `${before}\n${before.slice(0, before.indexOf('** ') + 3)}${changed}`, `T5 current ${name} must remain ${expected}`]
    ])),
    ...Array.from({ length: 4 }, (_, index) => `T${index + 6}`).map(task => [
      `${task} starts without approval`, gate, `| ${task} | NOT_STARTED |`, `| ${task} | IN_PROGRESS |`, `keep ${task} as NOT_STARTED`
    ]),
    ...Array.from({ length: 4 }, (_, index) => `T${index + 6}`).map(task => [
      `${task} has conflicting current rows`, gate, `| ${task} | NOT_STARTED |`, `| ${task} | CLOSED | invented |\n| ${task} | NOT_STARTED |`, `keep ${task} as NOT_STARTED`
    ]),
    ['plan status regresses', plan, 'T1 后端工程已关闭', 'T1 执行中', 'approved T1 plan status'],
    ['T2 plan status regresses', plan, 'T2 合成工程已关闭', 'T2 合成工程待批准', 'approved T1 plan status'],
    ['R4 remains unchecked', plan, '- [x] R4 入口验收及 T1 关闭：CLOSED', '- [ ] R4 入口验收及 T1 关闭：CLOSED', 'approved R4 plan checkbox'],
    ['reconciliation T1 remains pending', reconciliation, '**T1:** CLOSED', '**T1:** OPEN', 'reconciliation T1 must be CLOSED'],
    ['reconciliation R4 remains pending', reconciliation, '**R4:** CLOSED', '**R4:** OPEN', 'reconciliation R4 must be CLOSED'],
    ['R4 table remains pending', reconciliation, '| R4 正式入口验收及 T1 关闭 | CLOSED |', '| R4 正式入口验收及 T1 关闭 | OPEN |', 'approved R4 reconciliation row'],
    ['navigation regresses', navigation, 'T1 后端工程已关闭', 'T1 执行中', 'navigation must reflect T1 backend closure'],
    ['T2 navigation regresses', navigation, 'T2 合成工程已关闭', 'T2 合成工程待批准', 'navigation must reflect T1 backend closure'],
    ['operations status regresses', operations, '**Status:** CLOSED（R1–R4 及 T1 后端工程总门禁', '**Status:** OPEN（R1–R4 及 T1 后端工程总门禁', 'operations must reflect T1 backend closure']
  ])('rejects %s without changing files', (_name, file, before, after, message) => {
    const source = read(file);
    expect(source).toContain(before);
    const mutated = source.replace(before, after);
    expect(mutated).not.toBe(source);
    const original = fs.readFileSync;
    const target = path.join(repositoryRoot, file);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, ...args) => {
      return requested === target ? mutated : original(requested, ...args);
    });
    try {
      expect(() => validate()).toThrow(message);
    } finally {
      spy.mockRestore();
    }
  });

  test('accepts one T2 row with normalized Markdown whitespace', () => {
    const source = read(gate);
    const before = '| T2 | CLOSED |';
    expect(source).toContain(before);
    const mutated = source.replace(before, '|\tT2  |  CLOSED\t|');
    const original = fs.readFileSync;
    const target = path.join(repositoryRoot, gate);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, ...args) => {
      return requested === target ? mutated : original(requested, ...args);
    });
    try {
      expect(() => validate()).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
