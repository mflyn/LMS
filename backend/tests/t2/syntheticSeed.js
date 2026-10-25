const { randomUUID } = require('crypto');
const expectData = (response, status = 200) => {
  if (response.status !== status || response.data?.success !== true) {
    const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(response.data?.error?.code || '') ? response.data.error.code : 'UNKNOWN';
    throw Object.assign(new Error(`T2 synthetic HTTP setup failed (${response.status} ${code})`), { code: 'T2_SEED_FAILED' });
  }
  return response.data.data;
};

const createSeed = ({ api, models }) => {
  let promise;
  const seed = () => {
    if (promise) return promise;
    promise = (async () => {
      await models.Role.create([{ name: 'parent', description: 'Synthetic parent', permissions: [] },
        { name: 'student', description: 'Synthetic child', permissions: [] }]);
      const actors = {}, clients = {}, suffix = randomUUID().slice(0, 8);
      for (const name of ['parent', 'coparent', 'outsider']) {
        const credentials = { username: `t2_${name}_${suffix}`, password: 'SyntheticFamily123' };
        const registration = expectData(await api.registerParent({ ...credentials, name: `Synthetic ${name}`,
          email: `${credentials.username}@example.test`, role: 'parent' }), 201);
        actors[name] = { ...credentials, userId: String(registration.user.id || registration.user._id) };
        clients[name] = api.asParent(expectData(await api.loginParent(credentials)).token);
      }
      const family = expectData(await clients.parent.post('/api/families', { familyName: 'Synthetic T2 Family', timezone: 'Asia/Shanghai' }), 201).family;
      const invitation = expectData(await clients.parent.post(`/api/families/${family.familyId}/parent-invitations`, {}), 201).invitation;
      expectData(await clients.coparent.post('/api/parent-invitations/accept', { token: invitation.token, familyRole: 'guardian' }));
      const foreignFamily = expectData(await clients.outsider.post('/api/families', { familyName: 'Synthetic Foreign Family', timezone: 'Asia/Shanghai' }), 201).family;
      const tasks = {};
      for (const [name, owner, pin] of [['child', 'parent', '2468'], ['sibling', 'parent', '1357'], ['foreignChild', 'outsider', '8642']]) {
        const child = expectData(await clients[owner].post('/api/children', { name: `Synthetic ${name}`, grade: 3 }), 201).child;
        expectData(await clients[owner].post(`/api/children/${child.childId}/pin`, { pin }));
        actors[name] = { userId: child.childId, childId: child.childId, familyId: owner === 'parent' ? family.familyId : foreignFamily.familyId, pin };
        const created = expectData(await clients[owner].post('/api/growth-tasks', { childId: child.childId, title: `Synthetic ${name} work`,
          dimension: 'academic', taskType: 'practice', dueDate: new Date().toISOString().slice(0, 10), estimatedMinutes: 15 }), 201).task;
        tasks[name === 'foreignChild' ? 'foreign' : name] = expectData(await clients[owner].get('/api/growth-tasks/' + created.taskId)).task;
      }
      const bytes = await require('sharp')({ create: { width: 24, height: 24, channels: 3, background: '#20a080' } }).png().toBuffer();
      return { familyId: family.familyId, foreignFamilyId: foreignFamily.familyId, actors, tasks,
        image: { bytes, mimeType: 'image/png', name: 'synthetic-work.png' } };
    })();
    return promise;
  };
  const login = async name => {
    const actor = (await seed()).actors[name];
    if (!actor) throw Object.assign(new Error('T2 unknown synthetic actor'), { code: 'T2_UNKNOWN_ACTOR' });
    const result = actor.pin
      ? await api.loginChild({ familyId: actor.familyId, childId: actor.childId, pin: actor.pin })
      : await api.loginParent({ username: actor.username, password: actor.password });
    const { token } = expectData(result);
    return actor.pin ? api.asChild(token) : api.asParent(token);
  };
  return { seed, login };
};
module.exports = { createSeed, expectData };
