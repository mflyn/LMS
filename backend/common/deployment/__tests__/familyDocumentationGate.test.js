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

    expect(traceability).toContain('**Document status:** READY_FOR_REVIEW');
    expect(traceability).toContain('**Implementation conformance:** COVERED (35/35)');
    expect(traceability).toContain('**Baseline candidate:** FGT-MVP-1.6');
    expect(traceability).toContain('70 backend suites / 756 tests');

    for (const document of [product, architecture, api]) {
      expect(document).toContain('**Baseline candidate:** FGT-MVP-1.6');
    }

    expect(userGuide).toContain('知识与能力点');
    expect(childGuide).not.toContain('姓名、昵称、年级、学校');
    expect(ubuntuDeployment).toContain('该 `.env` 位于仓库根目录');
    expect(ubuntuDeployment).not.toContain('backend/.env');
  });
});
