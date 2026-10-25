const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const codec = require('../services/userDeletionRecoveryEvidence');
const { makeUnsignedEvidence } = require('./fixtures/userDeletionRecoveryEvidence');

const instrumentCodec = () => {
  const calls = [];
  const api = { ...codec };
  for (const name of ['validateEvidence', 'serializeEvidence', 'validateAndSerializeEvidence']) {
    api[name] = (...args) => { calls.push(name); return codec[name](...args); };
  }
  return { api, calls };
};
const load = async (name, api) => {
  const filename = require.resolve('../services/' + name);
  const context = { module: { exports: {} }, Buffer, require: dependency =>
    dependency === './userDeletionRecoveryEvidence' ? api : require(dependency) };
  vm.runInNewContext(await fs.readFile(filename, 'utf8'), context, { filename });
  return context.module.exports;
};

test('combined encoding fully validates once and returns detached canonical evidence', () => {
  const input = codec.sealEvidence(makeUnsignedEvidence('committed'));
  const expected = codec.serializeEvidence(input);
  const result = codec.validateAndSerializeEvidence(input);
  expect(result.encoded).toBe(expected);
  expect(result.proof).toEqual(JSON.parse(expected));
  expect(result.proof).not.toBe(input);
  expect(result.proof.tombstone).not.toBe(input.tombstone);
  input.tombstone.childId = '000000000000000000000099';
  expect(result.proof.tombstone.childId).toBe(JSON.parse(expected).tombstone.childId);
  result.proof.operations[0].after.version = 999;
  expect(input.operations[0].after.version).toBe(JSON.parse(expected).operations[0].after.version);
  expect(JSON.parse(result.encoded)).toEqual(JSON.parse(expected));
  expect(() => codec.validateAndSerializeEvidence(input)).toThrow('USER_DELETION_EVIDENCE_INVALID');
});

test.each(['hash', 'child', 'getter'])('combined encoding rejects %s corruption without executing getters', kind => {
  const input = codec.sealEvidence(makeUnsignedEvidence('committed'));
  const getter = jest.fn(() => []);
  if (kind === 'hash') input.evidenceHash = '0'.repeat(64);
  if (kind === 'child') {
    input.operations[0].after.childId = '000000000000000000000099';
    const { evidenceHash, ...unsigned } = input;
    input.evidenceHash = createHash('sha256').update(canonicalize(unsigned)).digest('hex');
  }
  if (kind === 'getter') Object.defineProperty(input, 'operations', { enumerable: true, get: getter });
  expect(() => codec.validateAndSerializeEvidence(input)).toThrow('USER_DELETION_EVIDENCE_INVALID');
  expect(getter).not.toHaveBeenCalled();
});

test('proof cache validates and encodes one time per miss, with detached returns and fresh cache validation', async () => {
  const proof = codec.sealEvidence(makeUnsignedEvidence('committed'));
  const { api, calls } = instrumentCodec();
  const { createUserDeletionProofCache } = await load('userDeletionRestoreProof', api);
  const read = jest.fn(async () => proof), cache = createUserDeletionProofCache({ journal: { read } });
  const id = proof.tombstone.mediaId, first = await cache.read(id);
  expect(calls).toEqual(['validateAndSerializeEvidence']);
  first.tombstone.childId = '000000000000000000000099';
  expect(await cache.read(id)).toEqual(proof);
  expect(read).toHaveBeenCalledTimes(1);
  proof.evidenceHash = '0'.repeat(64);
  await expect(createUserDeletionProofCache({ journal: { read } }).read(id))
    .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
});

test('physical reader uses one full decode validation plus the existing session encoding and rejects noncanonical bytes', async () => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lms-evidence-encoding-'));
  try {
    await fs.chmod(root, 0o700);
    const directory = path.join(root, 'user-deletions-v2'); await fs.mkdir(directory, { mode: 0o700 });
    const proof = codec.sealEvidence(makeUnsignedEvidence('committed'));
    const file = path.join(directory, proof.tombstone.mediaId + '.json');
    await fs.writeFile(file, codec.serializeEvidence(proof), { mode: 0o600 });
    const { api, calls } = instrumentCodec();
    const { createUserDeletionRecoveryReader } = await load('userDeletionRecoveryReader', api);
    expect(await createUserDeletionRecoveryReader({ root }).read(proof.tombstone.mediaId)).toEqual(proof);
    expect(calls).toEqual(['validateAndSerializeEvidence', 'serializeEvidence']);
    await fs.writeFile(file, JSON.stringify(proof, null, 2) + '\n');
    await expect(createUserDeletionRecoveryReader({ root }).read(proof.tombstone.mediaId))
      .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
