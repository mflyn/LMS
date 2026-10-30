// Explicit outer-runner entry, after monitor shutdown and scoped Compose teardown.
// Never called by the release EXIT trap while the monitor is still inspecting builders.
const { cleanupRetainedBuild } = require('./release-retained-build');
const { docker } = require('./release-isolated-compose');
if (require.main === module) {
  const [directory, project, barrier] = process.argv.slice(2);
  cleanupRetainedBuild({ directory, project, run: docker, monitorStopped: barrier === '--monitor-stopped' })
    .catch(() => { console.error('RETAINED_BUILD_CLEANUP_INCOMPLETE'); process.exitCode = 1; });
}
