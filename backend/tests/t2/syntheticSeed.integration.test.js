const { createSeed } = require('./syntheticSeed');

jest.mock('sharp', () => () => ({ png: () => ({ toBuffer: async () => Buffer.from('synthetic-image') }) }));

// Contract-only seed tests: HTTP substitutes, no live services or host clock changes.
function fixtureApi() {
  const families = [], tasks = new Map();
  let childNumber = 0;
  const response = (data, status = 200) => ({ status, data: { success: true, data } });
  const api = {
    registerParent: async ({ username }) => response({ user: { id: username } }, 201),
    loginParent: async ({ username }) => response({ token: username }),
    asParent: owner => ({
      post: async (url, body) => {
        if (url === '/api/families') {
          const family = { ...body, familyId: `family-${families.length + 1}` };
          families.push(family);
          return response({ family }, 201);
        }
        if (url.endsWith('/parent-invitations')) return response({ invitation: { token: 'synthetic-invitation' } }, 201);
        if (url === '/api/parent-invitations/accept' || url.endsWith('/pin')) return response({});
        if (url === '/api/children') return response({ child: { childId: `child-${++childNumber}` } }, 201);
        if (url === '/api/growth-tasks') {
          const task = { ...body, taskId: `task-${tasks.size + 1}`, owner };
          tasks.set(task.taskId, task);
          return response({ task }, 201);
        }
        throw Error('Unexpected synthetic request');
      },
      get: async url => response({ task: tasks.get(url.split('/').pop()) })
    })
  };
  return { api, families, tasks };
}

describe('T2 synthetic seed family-local task dates (HTTP substitutes)', () => {
  afterEach(() => jest.useRealTimers());

  test.each([
    ['2026-11-14T00:00:00.000Z', '2026-11-14'],
    ['2026-11-14T15:59:59.999Z', '2026-11-14'],
    ['2026-11-14T16:00:00.000Z', '2026-11-15'],
    ['2026-11-14T23:59:59.999Z', '2026-11-15'],
    ['2026-12-31T16:00:00.000Z', '2027-01-01'],
    ['2028-02-28T16:00:00.000Z', '2028-02-29']
  ])('at %s every child receives a task due on family day %s', async (instant, expectedDate) => {
    jest.useFakeTimers({ now: new Date(instant) });
    const { api, families, tasks } = fixtureApi();
    const roleCreate = jest.fn().mockResolvedValue([]);
    const seed = createSeed({ api, models: { Role: { create: roleCreate } } });
    const first = seed.seed();
    expect(seed.seed()).toBe(first);
    const fixture = await first;
    expect(families.map(f => f.timezone)).toEqual(['Asia/Shanghai', 'Asia/Shanghai']);
    expect([...tasks.values()].map(t => t.dueDate)).toEqual([expectedDate, expectedDate, expectedDate]);
    for (const [taskName, actorName] of [['child', 'child'], ['sibling', 'sibling'], ['foreign', 'foreignChild']]) {
      expect(fixture.tasks[taskName]).toMatchObject({ childId: fixture.actors[actorName].childId, dueDate: expectedDate });
    }
    expect(await seed.seed()).toBe(fixture);
    expect(tasks.size).toBe(3);
    expect(roleCreate).toHaveBeenCalledTimes(1);
  });
});
