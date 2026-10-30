const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createHash } = require('crypto');
const { validate } = require('./check-release-isolation');

async function runIsolated({ phase, config, project, port, root, composeArgs, run, timeout = '240', buildDirectory }) {
  validate(config, project, port);
  if (!['build', 'start'].includes(phase) || !/^\d+$/.test(timeout)) throw Error('INVALID_ISOLATED_STAGE');
  const services = ['gateway', 'user-service', 'progress-service', 'homework-service', 'resource-service', 'analytics-service', 'notification-service'];
  for (const name of services) {
    const s = config.services[name];
    const file = name === 'gateway' ? 'backend/gateway/Dockerfile' : `backend/services/${name}/Dockerfile`;
    if (s.image !== `${project}-${name}:candidate` || s.build?.context !== root || s.build.dockerfile !== file ||
        Object.keys(s.build).some(key => !['context', 'dockerfile'].includes(key))) {
      throw Error('UNSAFE_BUILD_TARGET');
    }
  }
  if (phase === 'build') {
    return require('./release-retained-build').runRetainedBuild({ root, directory: buildDirectory, project, config, run, candidateOnly: true });
  }
  const mongo = config.services.mongo;
  if (Number(mongo.cpus) + 0.4 > 2 || Number(mongo.mem_limit) + 256 * 1024 ** 2 > 3 * 1024 ** 3) {
    throw Error('UNSAFE_PREPARATION_BUDGET');
  }
  const receipt = await require('./release-retained-build').requireClosedBuild({ directory: buildDirectory, project, run, candidateOnly: true });
  const images = Object.fromEntries(receipt.candidates.map(c => [c.name, c.id]));
  // The verified IDs, not mutable build tags, are used by both preparation and Compose.
  const pinnedFile = path.join(buildDirectory, 'candidate-images.json');
  const pinned = JSON.stringify({ services: Object.fromEntries(services.map(name => [name, { image: images[name], pull_policy: 'never' }])) });
  try { fs.writeFileSync(pinnedFile, pinned, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST' || !fs.lstatSync(pinnedFile).isFile() || fs.readFileSync(pinnedFile, 'utf8') !== pinned) {
      throw Error('UNSAFE_PINNED_BUILD_CONFIG');
    }
  }
  const compose = args => run(['compose', ...composeArgs, '--file', pinnedFile, ...args]);
  const input = fs.readFileSync(path.join(root, 'scripts/release-isolated-prepare.js'), 'utf8');
  const runner = fs.readFileSync(path.join(root, 'scripts/run-isolated-prepare.sh'), 'utf8');
  const job = async (service, step) => {
    const env = { ...config.services[service].environment, SYNTHETIC_PREPARATION: step };
    const args = ['run', '--rm', '-i', '--name', `${project}-prepare-${step}`,
      '--label', `com.docker.compose.project=${project}`, '--label', 'com.docker.compose.service=release-prepare',
      '--label', `lms.isolation.run=${project}`,
      '--cpus=0.4', '--memory=256m', '--memory-swap=256m', '--pids-limit=128',
      '--network', `${project}_app-network`, '--workdir', '/app', '--entrypoint', 'sh'];
    for (const key of Object.keys(env)) args.push('--env', key);
    if (service === 'resource-service') {
      for (const mount of config.services[service].volumes) {
        args.push('--mount', `type=volume,src=${project}_${mount.source},dst=${mount.target}`);
      }
    }
    args.push('--pull=never', images[service], '-c', runner, 'isolated-prepare', createHash('sha256').update(input).digest('hex'), step);
    await run(args, { env, input, job: step });
  };
  await compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', timeout, 'mongo']);
  await compose(['run', '--rm', '--no-deps', 'mongo-init']);
  await job('gateway', 'fresh');
  for (const name of ['resource-data', 'completion-journal']) {
    await run(['volume', 'create', '--label', `com.docker.compose.project=${project}`,
      '--label', `com.docker.compose.volume=${name}`, `${project}_${name}`]);
  }
  for (const service of services.filter(s => s !== 'gateway')) await job(service, service.replace('-service', ''));
  await job('resource-service', 'storage');
  await job('homework-service', 'preflight-homework');
  await job('resource-service', 'preflight-resource');
  await compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', timeout]);
}

function docker(args, { env = {}, input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env: { ...process.env, ...env }, stdio: [input ? 'pipe' : 'ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'] });
    let output = '';
    if (capture) { child.stdout.on('data', b => { output += b; }); child.stderr.resume(); }
    if (input) { child.stdin.on('error', () => {}); child.stdin.end(input); }
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(Error('ISOLATED_DOCKER_COMMAND_FAILED')));
  });
}
if (require.main === module) {
  const [phase, ...composeArgs] = process.argv.slice(2);
  docker(['compose', ...composeArgs, 'config', '--format', 'json'], { capture: true })
    .then(source => {
      const config = JSON.parse(source);
      return runIsolated({ phase, config, project: config.name, port: process.env.FAMILY_GATEWAY_HOST_PORT,
        root: path.resolve(__dirname, '..'), composeArgs, run: docker,
        buildDirectory: process.env.RELEASE_GATE_BUILD_DIRECTORY,
        timeout: process.env.RELEASE_GATE_HEALTH_TIMEOUT_SECONDS || '240' });
    }).catch(() => { console.error('ISOLATED_RELEASE_STAGE_FAILED'); process.exitCode = 1; });
}
module.exports = { runIsolated, docker };
