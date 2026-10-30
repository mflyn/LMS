const fs = require('fs');
const assert = require('assert/strict');
const { createHash } = require('crypto');

const fullId = /^[a-f0-9]{64}$/;
const imageId = /^sha256:[a-f0-9]{64}$/;
const keys = { containers: 'Id', images: 'Id', volumes: 'Name' };
function requireSafe(ok) { if (!ok) throw Error('UNPROVEN_BUILD_OBJECT'); }
function identityMatches(labels, identity) {
  return labels && labels['lms.isolation.run'] === identity.project &&
    labels['lms.isolation.nonce'] === identity.nonce && labels['lms.isolation.context'] === identity.contextHash &&
    labels['lms.isolation.role'] === 'builder' && !Object.keys(labels).some(k => k.startsWith('com.docker.compose.'));
}
function mapObjects(rows, key) {
  requireSafe(Array.isArray(rows));
  const map = new Map(rows.map(row => [row[key], row]));
  requireSafe(map.size === rows.length && !map.has(undefined));
  return map;
}
function same(a, b) {
  try { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); } catch { throw Error('BUILD_OBJECT_CHANGED'); }
}
function timestamp(value) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireSafe(match);
  const millis = Date.parse(`${match[1]}${match[3]}`);
  requireSafe(Number.isFinite(millis));
  return BigInt(millis) * 1000000n + BigInt((match[2] || '').padEnd(9, '0'));
}
function validateInventory({ before, current, identity, baseId, tags, previous, window, candidateIds }) {
  requireSafe(imageId.test(baseId));
  const start = timestamp(window?.start), end = timestamp(window?.end);
  requireSafe(end >= start);
  // Docker volumes expose second-resolution CreatedAt; ownership still requires a new exact ID/mount.
  const createdInWindow = (stamp, seconds = false) => timestamp(stamp) >=
    (seconds ? start / 1000000000n * 1000000000n : start) && timestamp(stamp) <= end;
  const owned = {};
  for (const [kind, key] of Object.entries(keys)) {
    const old = mapObjects(before[kind], key), now = mapObjects(current[kind], key);
    for (const [id, row] of old) { requireSafe(now.has(id)); same(now.get(id), row); }
    for (const row of previous?.[kind] || []) { requireSafe(now.has(row[key])); same(now.get(row[key]), row); }
    owned[kind] = [...now.values()].filter(row => !old.has(row[key]));
  }
  const images = mapObjects(current.images, 'Id');
  requireSafe(images.has(baseId));
  const ownedImages = mapObjects(owned.images, 'Id');
  requireSafe(Array.isArray(candidateIds) && candidateIds.length > 0);
  const allowed = new Set();
  for (const candidate of candidateIds) {
    requireSafe(ownedImages.has(candidate) && ownedImages.get(candidate).RepoTags?.some(tag => tags.includes(tag)));
    let id = candidate;
    const visited = new Set();
    while (id !== baseId) {
      requireSafe(ownedImages.has(id) && !visited.has(id));
      visited.add(id); allowed.add(id); id = ownedImages.get(id).Parent;
    }
  }
  requireSafe(owned.images.every(image => allowed.has(image.Id)));
  const ancestors = new Set([baseId]);
  const pending = [...owned.images];
  while (pending.length) {
    const index = pending.findIndex(row => ancestors.has(row.Parent));
    requireSafe(index >= 0);
    const [row] = pending.splice(index, 1);
    requireSafe(imageId.test(row.Id) && createdInWindow(row.Created) && identityMatches(row.Config?.Labels, identity));
    requireSafe((row.RepoTags || []).every(tag => tag === '<none>:<none>' || tags.includes(tag)));
    ancestors.add(row.Id);
  }
  const volumeNames = new Set();
  for (const row of owned.containers) {
    const h = row.HostConfig, s = row.State;
    requireSafe(fullId.test(row.Id) && createdInWindow(row.Created) && identityMatches(row.Config?.Labels, identity));
    requireSafe(ancestors.has(row.Image) && s?.Running === false && ['exited', 'created'].includes(s.Status) && s.ExitCode === 0 && !s.OOMKilled);
    requireSafe(h?.CpuPeriod === 100000 && h.CpuQuota === 180000 && h.Memory === 2816 * 1024 ** 2 &&
      h.MemorySwap === h.Memory && !h.NanoCpus && !h.Privileged && !(h.Binds || []).length && h.NetworkMode === 'bridge');
    requireSafe(Array.isArray(row.Mounts));
    // A runtime container can inherit image labels. Only the daemon's legacy commit
    // provenance links a retained container to an image actually produced in this build.
    requireSafe(owned.images.filter(image => image.Container === row.Id && image.Parent === row.Image).length === 1);
    for (const mount of row.Mounts) {
      requireSafe(mount.Type === 'volume' && fullId.test(mount.Name) &&
        mount.Destination === '/var/lib/family-growth/private-media' && mount.RW === true);
      requireSafe(!before.volumes.some(v => v.Name === mount.Name));
      volumeNames.add(mount.Name);
    }
  }
  for (const image of owned.images) {
    if (image.Container === '') {
      requireSafe(Array.isArray(image.BuildCommand) && image.BuildCommand.length === 3 &&
        image.BuildCommand[0] === '/bin/sh' && image.BuildCommand[1] === '-c' && /^#\(nop\) COPY /.test(image.BuildCommand[2]));
    } else {
      requireSafe(fullId.test(image.Container) && owned.containers.some(row => row.Id === image.Container && row.Image === image.Parent));
    }
  }
  for (const row of owned.volumes) {
    requireSafe(fullId.test(row.Name) && volumeNames.has(row.Name) && row.Driver === 'local' &&
      createdInWindow(row.CreatedAt, true) && !Object.keys(row.Options || {}).length &&
      Object.keys(row.Labels || {}).length === 1 && row.Labels['com.docker.volume.anonymous'] === '');
  }
  same([...volumeNames].sort(), owned.volumes.map(v => v.Name).sort());
  for (const row of before.containers) requireSafe(!(row.Mounts || []).some(m => volumeNames.has(m.Name)));
  return owned;
}

// Never persist Config.Env, commands, host paths, credentials or build stdout.
const digest = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
function safeLabels(labels = {}) {
  const result = {};
  const patterns = { 'lms.isolation.run': /^family-growth-isolated-[a-z0-9-]+$/,
    'lms.isolation.nonce': /^[a-f0-9]{32}$/, 'lms.isolation.context': /^[a-f0-9]{64}$/, 'lms.isolation.role': /^builder$/ };
  for (const [key, pattern] of Object.entries(patterns)) {
    if (labels?.[key] !== undefined) result[key] = pattern.test(labels[key]) ? labels[key] : `invalid:${digest(labels[key])}`;
  }
  if (Object.keys(labels || {}).some(key => key.startsWith('com.docker.compose.'))) result['com.docker.compose.present'] = true;
  return result;
}
const privateObject = object => Object.keys(object || {}).length ? { digest: digest(object) } : {};
function projectObject(kind, row) {
  if (kind === 'containers') return { Id: row.Id, Created: row.Created, Image: row.Image,
    Config: { Labels: safeLabels(row.Config?.Labels), LabelsDigest: digest(row.Config?.Labels) }, HostConfig: {
      ...Object.fromEntries(['CpuPeriod', 'CpuQuota', 'Memory', 'MemorySwap', 'NanoCpus', 'Privileged', 'NetworkMode']
        .map(key => [key, row.HostConfig?.[key]])), Binds: (row.HostConfig?.Binds || []).map(digest) },
    State: Object.fromEntries(['Running', 'Status', 'ExitCode', 'StartedAt', 'FinishedAt', 'OOMKilled'].map(key => [key, row.State?.[key]])),
    RestartCount: row.RestartCount,
    // Inspect may reorder mounts; preserve the projected fields and multiplicity.
    Mounts: (row.Mounts || []).map(m => ({ Type: m.Type, Name: m.Name,
      Destination: m.Destination === '/var/lib/family-growth/private-media' ? m.Destination : `sha256:${digest(m.Destination)}`, RW: m.RW }))
      .sort((a, b) => {
        const left = JSON.stringify(a), right = JSON.stringify(b);
        return left < right ? -1 : left > right ? 1 : 0;
      }) };
  if (kind === 'images') return { Id: row.Id, Parent: row.Parent, Created: row.Created,
    Container: row.Container, BuildCommand: Array.isArray(row.ContainerConfig?.Cmd) && row.ContainerConfig.Cmd.length === 3 &&
      row.ContainerConfig.Cmd[0] === '/bin/sh' && row.ContainerConfig.Cmd[1] === '-c' &&
      /^#\(nop\) COPY (?:file|dir|multi):[a-f0-9]{64} in (?:\.\/|\.\/backend) ?$/.test(row.ContainerConfig.Cmd[2])
      ? row.ContainerConfig.Cmd : undefined, BuildCommandDigest: digest(row.ContainerConfig?.Cmd),
    Config: { Labels: safeLabels(row.Config?.Labels), LabelsDigest: digest(row.Config?.Labels) }, RepoTags: [...(row.RepoTags || [])].sort() };
  return { Name: row.Name, Driver: row.Driver, CreatedAt: row.CreatedAt,
    Labels: Object.keys(row.Labels || {}).length === 1 && row.Labels['com.docker.volume.anonymous'] === ''
      ? { 'com.docker.volume.anonymous': '' } : privateObject(row.Labels), Options: privateObject(row.Options) };
}
async function inventory(run) {
  const result = {};
  for (const [kind, key] of Object.entries(keys)) {
    const singular = { containers: 'container', images: 'image', volumes: 'volume' }[kind];
    const args = kind === 'volumes' ? ['volume', 'ls', '-q'] : [singular, 'ls', '-aq', '--no-trunc'];
    const source = await run(args, { capture: true });
    const ids = [...new Set(source.trim().split(/\s+/).filter(Boolean))].sort();
    requireSafe(ids.every(id => kind === 'volumes' ? /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id) : (kind === 'images' ? imageId : fullId).test(id)));
    const rows = [];
    for (const id of ids) {
      // Raw (no --format) API 1.44 image inspect retains the legacy Container provenance.
      // Unsupported API/store or absent provenance fails closed; never infer it from stdout.
      const inspected = JSON.parse(await run([singular, 'inspect', id], { capture: true,
        ...(kind === 'images' ? { env: { DOCKER_API_VERSION: '1.44' } } : {}) }));
      requireSafe(Array.isArray(inspected) && inspected.length === 1 && inspected[0][key] === id);
      rows.push(projectObject(kind, inspected[0]));
    }
    result[kind] = rows;
  }
  return result;
}
function saveLedger(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, file);
}
async function cleanupOwned({ ledger, file, run, readInventory = () => inventory(run), monitorStopped = false }) {
  requireSafe(monitorStopped === true && ledger.schema === 1 && ledger.state === 'CLOSED');
  const current = await readInventory();
  const owned = validateInventory({ ...ledger, current, previous: ledger.owned });
  same(owned, ledger.owned);
  // This entry is called only after the outer monitor and Compose teardown have ended.
  // No new object is registered here, even if it inherited matching image labels.
  ledger.state = 'CLEANING'; saveLedger(file, ledger);
  try {
    for (const row of owned.containers) await run(['container', 'rm', row.Id]);
    for (const row of owned.volumes) await run(['volume', 'rm', row.Name]);
    const pending = [...owned.images];
    while (pending.length) {
      const index = pending.findIndex(row => !pending.some(other => other.Parent === row.Id));
      requireSafe(index >= 0);
      const [row] = pending.splice(index, 1);
      await run(['image', 'rm', '--no-prune', row.Id]);
    }
    same(await readInventory(), ledger.before);
    ledger.state = 'CLEANED'; saveLedger(file, ledger);
  } catch (error) {
    ledger.state = 'CLEANUP_INCOMPLETE'; saveLedger(file, ledger);
    throw error;
  }
}
module.exports = { validateInventory, inventory, saveLedger, cleanupOwned, identityMatches, same };
