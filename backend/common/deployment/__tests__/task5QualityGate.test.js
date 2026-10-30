const path = require('path');
const { execFileSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../../../..');

const serverPaths = [
  'backend/services/analytics-service/services/weeklyReportService.js',
  'backend/services/analytics-service/__tests__/weeklyReports.test.js',
  'backend/tests/t2/weeklyReflection.integration.test.js',
  'backend/common/deployment/__tests__/task5QualityGate.test.js',
  'scripts/check-family-docs.js'
];
const browserPaths = [
  'frontend/web/src/components/family/ReflectionPanel.js',
  'frontend/web/src/pages/family/ReportsPage.js',
  'frontend/web/src/components/family/source-snapshot/Probe.js',
  'frontend/web/src/components/family/release-gate-artifacts/Probe.js'
];
const archivePaths = [
  'release-gate-artifacts/t5/source-snapshot/frontend/web/src/pages/family/TasksPage.js',
  'release-gate-artifacts/t7/preserved/backend/services/analytics-service/services/weeklyReportService.js'
];

// ESLint loads its normal flat config in Node, outside Jest's module sandbox.
const probe = `
  const fs = require('fs');
  const { ESLint } = require('eslint');
  const paths = JSON.parse(fs.readFileSync(0, 'utf8'));
  (async () => {
    const lint = new ESLint({ cwd: process.cwd() });
    const results = {};
    for (const file of paths) {
      const ignored = await lint.isPathIgnored(file);
      const config = await lint.calculateConfigForFile(file);
      const browser = file.startsWith('frontend/');
      const invalid = browser
        ? 'export default function Probe() { return <div>{__t7_missing_reference__()}</div>; }'
        : '__t7_missing_reference__();';
      const valid = browser
        ? 'export default function Probe() { return <div>ok</div>; }'
        : file.includes('__tests__')
          ? "test('synthetic', () => expect(true).toBe(true));"
          : 'module.exports = () => process.version;';
      const [bad] = await lint.lintText(invalid, { filePath: file });
      const [good] = await lint.lintText(valid, { filePath: file });
      results[file] = { ignored, noUndef: config?.rules?.['no-undef'],
        bad: { errorCount: bad.errorCount, messages: bad.messages },
        good: { errorCount: good.errorCount, warningCount: good.warningCount } };
    }
    process.stdout.write(JSON.stringify(results));
  })().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
`;

describe('stage 5 static quality gate', () => {
  let results;
  beforeAll(() => {
    results = JSON.parse(execFileSync(process.execPath, ['-e', probe], {
      cwd: repositoryRoot,
      input: JSON.stringify([...archivePaths, ...serverPaths, ...browserPaths]),
      encoding: 'utf8'
    }));
  });

  test('exports an ESLint 9 flat configuration for server and browser code', () => {
    const config = require(path.join(repositoryRoot, 'eslint.config.js'));

    expect(Array.isArray(config)).toBe(true);
    expect(config).toEqual(expect.arrayContaining([
      expect.objectContaining({
        files: expect.arrayContaining(['backend/common/contracts/**/*.js']),
        languageOptions: expect.objectContaining({
          sourceType: 'commonjs'
        })
      }),
      expect.objectContaining({
        files: expect.arrayContaining(['frontend/web/src/**/*.{js,jsx}']),
        languageOptions: expect.objectContaining({
          parserOptions: expect.objectContaining({ ecmaFeatures: { jsx: true } })
        })
      })
    ]));
  });

  test.each(archivePaths)('ignores only the root historical archive: %s', file => {
    expect(results[file].ignored).toBe(true);
  });

  test.each([...serverPaths, ...browserPaths])('keeps real source linted and rejects undefined references: %s', file => {
    const result = results[file];
    expect(result.ignored).toBe(false);
    expect(result.noUndef?.[0]).toBe(2);
    expect(result.bad.errorCount).toBeGreaterThan(0);
    expect(result.bad.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-undef', severity: 2, messageId: 'undef' })
    ]));
    expect(result.good).toEqual({ errorCount: 0, warningCount: 0 });
  });
});
