const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { inventory, validateInventory, saveLedger, same, cleanupOwned, identityMatches } = require('./release-build-ledger');
const services = ['gateway', 'user-service', 'progress-service', 'homework-service', 'resource-service', 'analytics-service', 'notification-service'];
function safe(ok) { if (!ok) throw Error('UNSAFE_RETAINED_BUILD'); }
async function daemonTime(run) {
  const time = JSON.parse(await run(['info', '--format', '{{json .SystemTime}}'], { capture: true }));
  safe(typeof time === 'string' && Number.isFinite(Date.parse(time)));
  return time;
}
async function pinBase(run) {
  const inspect = async ref => {
    const rows = JSON.parse(await run(['image', 'inspect', ref], { capture: true }));
    safe(Array.isArray(rows) && rows.length === 1);
    const row = rows[0];
    safe(/^sha256:[a-f0-9]{64}$/.test(row.Id) && row.Os === 'linux' && row.Architecture === 'amd64' &&
      row.Config && (!row.Config.OnBuild || (Array.isArray(row.Config.OnBuild) && row.Config.OnBuild.length === 0)));
    return row;
  };
  const selected = await inspect('node:22-alpine');
  const digest = selected.RepoDigests?.find(value => /^node@sha256:[a-f0-9]{64}$/.test(value));
  safe(digest);
  const pinned = await inspect(digest); safe(pinned.Id === selected.Id);
  return { baseId: pinned.Id, baseDigest: digest };
}
// Observation is not ownership: retain intermediates without authorizing deletion.
function validateCandidateObservation(receipt, current, previous = receipt.before) {
  for (const [kind, key] of [['containers', 'Id'], ['images', 'Id'], ['volumes', 'Name']]) {
    safe(Array.isArray(current[kind]));
    const now = new Map(current[kind].map(row => [row[key], row]));
    safe(now.size === current[kind].length && !now.has(undefined));
    for (const row of previous[kind]) { safe(now.has(row[key])); same(now.get(row[key]), row); }
  }
  safe(current.images.some(row => row.Id === receipt.baseId));
  const original = new Set(receipt.before.containers.map(row => row.Id));
  for (const row of current.containers.filter(c => !original.has(c.Id))) {
    const h = row.HostConfig, s = row.State;
    safe(/^[a-f0-9]{64}$/.test(row.Id) && identityMatches(row.Config?.Labels, receipt.identity));
    safe(s?.Running === false && ['exited', 'created'].includes(s.Status) && s.ExitCode === 0 && !s.OOMKilled);
    safe(h?.CpuPeriod === 100000 && h.CpuQuota === 180000 && h.Memory === 2816 * 1024 ** 2 &&
      h.MemorySwap === h.Memory && !h.NanoCpus && !h.Privileged && !(h.Binds || []).length && h.NetworkMode === 'bridge');
    safe(Array.isArray(row.Mounts) && row.Mounts.every(m => m.Type === 'volume' && /^[a-f0-9]{64}$/.test(m.Name) &&
      m.Destination === '/var/lib/family-growth/private-media' && m.RW === true &&
      !receipt.before.volumes.some(v => v.Name === m.Name)));
  }
}
async function inspectCandidate(run, name, tag, identity, expectedId) {
  const rows = JSON.parse(await run(['image', 'inspect', tag], { capture: true }));
  safe(Array.isArray(rows) && rows.length === 1);
  const row = rows[0];
  safe(/^sha256:[a-f0-9]{64}$/.test(row.Id) && (!expectedId || row.Id === expectedId) &&
    row.Os === 'linux' && row.Architecture === 'amd64' && identityMatches(row.Config?.Labels, identity) &&
    (!row.Config.OnBuild || (Array.isArray(row.Config.OnBuild) && row.Config.OnBuild.length === 0)) &&
    Array.isArray(row.RepoTags) && row.RepoTags.length === 1 && row.RepoTags[0] === tag);
  return { name, tag, id: row.Id };
}
async function runRetainedBuild({ root, directory, project, config, run,
  candidateOnly = false,
  prepare = options => require('./release-build-input').prepareBuildInput(options),
  verify = input => require('./release-build-input').verifyBuildInput(input), readInventory = () => inventory(run) }) {
  safe(/^family-growth-isolated-[a-z0-9-]+$/.test(project) && directory && path.isAbsolute(directory));
  const file = path.join(directory, candidateOnly ? 'candidate-build.json' : 'build-ledger.json');
  safe(!fs.existsSync(path.join(directory, 'build-ledger.json')) && !fs.existsSync(path.join(directory, 'candidate-build.json')));
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const { baseId, baseDigest } = await pinBase(run);
  const start = await daemonTime(run);
  const before = await readInventory();
  const tags = services.map(name => config.services[name].image);
  safe(tags.every((tag, index) => tag === `${project}-${services[index]}:candidate`));
  safe(!before.images.some(image => (image.RepoTags || []).some(tag => tags.includes(tag))));
  const input = await prepare({ root, directory: path.join(directory, 'input'), project,
    nonce: randomBytes(16).toString('hex'), baseDigest });
  safe(input.files.length === services.length && input.files.every((f, i) => f.name === services[i]));
  const ledger = { schema: 1, project, state: 'REGISTERING', identity: input.identity, baseId, baseDigest, before, tags,
    input, window: { start, end: start }, owned: { containers: [], images: [], volumes: [] }, completed: [] };
  if (candidateOnly) {
    ledger.schema = 2; delete ledger.owned;
    ledger.cacheCleanup = 'RETAINED_NOT_AUTHORIZED'; ledger.candidates = [];
  }
  saveLedger(file, ledger);
  try {
    for (const [index, source] of input.files.entries()) {
      await verify(input);
      ledger.state = 'IN_FLIGHT'; ledger.active = source.name; saveLedger(file, ledger);
      // A client/transport error cannot prove that the daemon has stopped building.
      await run(['build', '--pull=false', '--platform=linux/amd64', '--cpu-period=100000', '--cpu-quota=180000',
        '--memory=2816m', '--memory-swap=2816m', '--rm=false', '--force-rm=false',
        '-t', tags[index], '-f', source.dockerfile, input.context], { env: { DOCKER_BUILDKIT: '0' } });
      ledger.state = 'REGISTERING'; saveLedger(file, ledger);
      const current = await readInventory();
      ledger.window.end = await daemonTime(run);
      const previous = ledger.lastObservation;
      ledger.lastObservation = current; saveLedger(file, ledger);
      ledger.candidateIds = tags.slice(0, index + 1).map(tag => {
        const matches = current.images.filter(image => image.RepoTags?.includes(tag));
        safe(matches.length === 1); return matches[0].Id;
      });
      if (candidateOnly) {
        validateCandidateObservation(ledger, current, previous);
        const candidate = await inspectCandidate(run, source.name, tags[index], ledger.identity, ledger.candidateIds[index]);
        safe(!before.images.some(image => image.Id === candidate.id));
        ledger.candidates.push(candidate);
      } else ledger.owned = validateInventory({ ...ledger, current, previous: ledger.owned });
      safe(current.images.filter(image => image.RepoTags?.includes(tags[index])).length === 1);
      ledger.completed.push(source.name); saveLedger(file, ledger);
    }
    await verify(input);
    const current = await readInventory();
    ledger.window.end = await daemonTime(run);
    const previous = ledger.lastObservation;
    ledger.lastObservation = current; saveLedger(file, ledger);
    if (candidateOnly) {
      validateCandidateObservation(ledger, current, previous);
      same(current, previous);
      for (const c of ledger.candidates) await inspectCandidate(run, c.name, c.tag, ledger.identity, c.id);
    } else same(validateInventory({ ...ledger, current, previous: ledger.owned }), ledger.owned);
    ledger.state = candidateOnly ? 'VERIFIED' : 'CLOSED'; delete ledger.active; saveLedger(file, ledger);
    return ledger;
  } catch (error) {
    ledger.state = ledger.state === 'IN_FLIGHT' ? 'UNKNOWN' : 'FAILED';
    saveLedger(file, ledger);
    throw error;
  }
}
async function requireClosedBuild({ directory, project, run, candidateOnly = false,
  verify = input => require('./release-build-input').verifyBuildInput(input), readInventory = () => inventory(run) }) {
  safe(directory && path.isAbsolute(directory));
  const ledger = JSON.parse(fs.readFileSync(path.join(directory, candidateOnly ? 'candidate-build.json' : 'build-ledger.json'), 'utf8'));
  if (candidateOnly) {
    safe(ledger.schema === 2 && ledger.state === 'VERIFIED' && ledger.project === project &&
      ledger.cacheCleanup === 'RETAINED_NOT_AUTHORIZED' && !ledger.owned && ledger.identity.project === project);
    same(ledger.completed, services);
    same(ledger.candidates.map(c => c.name), services);
    same(ledger.tags, services.map(name => `${project}-${name}:candidate`));
    safe(new Set(ledger.candidates.map(c => c.id)).size === services.length);
    await verify(ledger.input);
    same(ledger.input.identity, ledger.identity);
    safe(ledger.input.identity.baseDigest === ledger.baseDigest);
    const current = await readInventory();
    validateCandidateObservation(ledger, current);
    same(current, ledger.lastObservation);
    for (const [i, c] of ledger.candidates.entries()) {
      safe(c.tag === ledger.tags[i] && c.id === ledger.candidateIds[i]);
      await inspectCandidate(run, c.name, c.tag, ledger.identity, c.id);
    }
    return ledger;
  }
  safe(ledger.schema === 1 && ledger.state === 'CLOSED' && ledger.project === project);
  same(ledger.completed, services);
  same(validateInventory({ ...ledger, current: await readInventory(), previous: ledger.owned }), ledger.owned);
  return ledger;
}
async function cleanupRetainedBuild({ directory, project, run, monitorStopped }) {
  safe(directory && path.isAbsolute(directory));
  const file = path.join(directory, 'build-ledger.json');
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  safe(ledger.project === project);
  await cleanupOwned({ ledger, file, run, monitorStopped });
}
module.exports = { runRetainedBuild, requireClosedBuild, cleanupRetainedBuild };
