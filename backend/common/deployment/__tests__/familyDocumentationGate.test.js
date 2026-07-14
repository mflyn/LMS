const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

  test('the review candidate records current main evidence without self-approval', () => {
    const manifest = read(
      'docs/development/family-growth-baseline-v1.6-manifest.md'
    );
    const traceability = read(
      'docs/development/family-growth-requirement-traceability.md'
    );

    expect(manifest).toContain('**status:** READY_FOR_REVIEW');
    expect(manifest).toContain(
      '**implementationEvidenceCommit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`'
    );
    expect(manifest).toContain('70 suites / 755 tests');
    expect(manifest).toContain('25 suites / 156 tests');
    expect(manifest).not.toContain('**status:** APPROVED');

    expect(traceability).toContain('**Document status:** READY_FOR_REVIEW');
    expect(traceability).toContain('**Baseline candidate:** FGT-MVP-1.6');
  });
});
