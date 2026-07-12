const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const scriptPath = path.join(repositoryRoot, 'scripts/check-git-clean.sh');

const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'pipe' });

describe('repository cleanliness gate', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'family-git-clean-'));
    git(tempDir, ['init', '--quiet']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Test Runner']);
    fs.writeFileSync(path.join(tempDir, 'tracked.txt'), 'baseline\n');
    git(tempDir, ['add', 'tracked.txt']);
    git(tempDir, ['commit', '--quiet', '-m', 'baseline']);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('passes only when tracked, staged, and untracked state is clean', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);

    const clean = spawnSync('bash', [scriptPath], { cwd: tempDir, encoding: 'utf8' });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('PASS: working tree is clean');

    fs.appendFileSync(path.join(tempDir, 'tracked.txt'), 'dirty\n');
    const trackedDirty = spawnSync('bash', [scriptPath], { cwd: tempDir, encoding: 'utf8' });
    expect(trackedDirty.status).toBe(1);
    expect(trackedDirty.stdout).toContain('tracked files changed');

    git(tempDir, ['checkout', '--', 'tracked.txt']);
    fs.writeFileSync(path.join(tempDir, 'untracked.txt'), 'dirty\n');
    const untrackedDirty = spawnSync('bash', [scriptPath], { cwd: tempDir, encoding: 'utf8' });
    expect(untrackedDirty.status).toBe(1);
    expect(untrackedDirty.stdout).toContain('untracked non-ignored files');
  });
});
