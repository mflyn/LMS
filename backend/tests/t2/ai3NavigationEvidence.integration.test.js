const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const vm = require('node:vm');
const { observeAi3Navigation, finishAi3Navigation } = require('../../../tests/e2e/t2/ai3NavigationEvidence');

const roundId = 'a'.repeat(24), nextId = 'b'.repeat(24);
beforeEach(() => { jest.spyOn(fs, 'writeFile').mockResolvedValue(); });
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
afterEach(() => { jest.useRealTimers(); });
const pageFixture = () => {
  const page = new EventEmitter();
  page.url = () => `http://127.0.0.1/child/practice?roundId=${roundId}&token=SECRET&childId=PRIVATE`;
  page.mainFrame = () => page;
  page.evaluate = jest.fn(async callback => browserSnapshot(page, callback));
  return page;
};

test('records intended versus actual round and GET lifecycle without URL/query/body/header/error secrets', async () => {
  const page = pageFixture(), observation = observeAi3Navigation(page);
  const req = { method: () => 'GET', url: () => `http://127.0.0.1/api/ai3/practice-rounds/${roundId}?token=SECRET`,
    headers: () => { throw Error('must not read credentials'); }, postData: () => { throw Error('must not read body'); },
    failure: () => ({ errorText: 'SECRET' }) };
  const post = { method: () => 'POST', url: req.url };
  page.emit('request', post); page.emit('request', req);
  page.emit('response', { request: () => req, status: () => 200 });
  page.emit('requestfailed', req); page.emit('requestfinished', req);
  page.emit('framenavigated', page);
  observation.mark(nextId, 3, 'first-upload');
  await observation.capture(); const result = observation.stop();
  expect(result.events.map(e => e.event)).toEqual(['detail-start', 'detail-response', 'detail-failed', 'detail-finished', 'navigation', 'first-upload', 'final-state']);
  expect(result.events[5]).toMatchObject({ roundId: nextId, exerciseCount: 3, route: { practiceRoute: true, roundId } });
  expect(result.events[0]).toMatchObject({ roundId, requestId: 1 });
  expect(result.events[1]).toMatchObject({ status: 200, requestId: 1 });
  expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE|token|127\.0\.0\.1/);
  expect(page.eventNames()).toEqual([]);
});

test('does not record arbitrary routes, malformed IDs or marker text', () => {
  const page = pageFixture(), observation = observeAi3Navigation(page);
  page.emit('request', { method: () => 'GET', url: () => 'http://127.0.0.1/api/private?token=SECRET' });
  page.url = () => 'http://127.0.0.1/login?roundId=SECRET'; page.emit('framenavigated', page);
  expect(() => observation.mark('SECRET', 3, 'selected')).toThrow('Invalid synthetic');
  expect(() => observation.mark(roundId, 3, 'SECRET')).toThrow('Invalid synthetic');
  expect(observation.stop().events).toEqual([{ ms: expect.any(Number), event: 'navigation', practiceRoute: false, roundId: null }]);
});

test('capture failure still waits for context closure and preserves original plus capture failure', async () => {
  const original = new Error('upload timeout'), capture = new Error('page unavailable'), closed = deferred();
  const observation = { capture: jest.fn().mockRejectedValue(capture), stop: jest.fn().mockReturnValue({ events: [] }) };
  const context = { close: jest.fn().mockReturnValue(closed.promise) }, info = { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockResolvedValue() };
  let settled = false;
  const result = finishAi3Navigation({ context, observation, info, failure: original }).catch(e => { settled = true; return e; });
  await new Promise(setImmediate);
  expect(context.close).toHaveBeenCalledTimes(1); expect(settled).toBe(false); expect(info.attach).not.toHaveBeenCalled();
  closed.resolve(); const error = await result;
  expect(error).toBeInstanceOf(AggregateError); expect(error.errors).toEqual([original, capture]);
  expect(info.attach).toHaveBeenCalledTimes(1);
});

test('close and attachment failures cannot hide the original assertion', async () => {
  const original = new Error('original'), close = new Error('close'), attach = new Error('attach');
  const observation = { capture: jest.fn().mockResolvedValue(), stop: jest.fn().mockReturnValue({ events: [] }) };
  const result = await finishAi3Navigation({ context: { close: jest.fn().mockRejectedValue(close) }, observation,
    info: { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockRejectedValue(attach) }, failure: original }).catch(e => e);
  expect(result.errors).toEqual([original, close, attach]); expect(observation.stop).toHaveBeenCalledTimes(1);
});

test('initialization failure before observation still closes context and rethrows the same failure', async () => {
  const original = new Error('page initialization failed'), close = jest.fn().mockResolvedValue();
  await expect(finishAi3Navigation({ context: { close }, info: {}, failure: original })).rejects.toBe(original);
  expect(close).toHaveBeenCalledTimes(1);
});

test('successful flow captures then closes then attaches without manufacturing a failure', async () => {
  const calls = [];
  await finishAi3Navigation({ context: { close: async () => calls.push('close') },
    observation: { capture: async () => calls.push('capture'), stop: () => { calls.push('stop'); return { events: [] }; } },
    info: { outputPath: name => '/synthetic/'+name, attach: async () => {
      expect(fs.writeFile).toHaveBeenCalledWith('/synthetic/ai3-child-navigation.json', JSON.stringify({ events: [] }, null, 2));
      calls.push('attach');
    } } });
  expect(calls).toEqual(['capture', 'close', 'stop', 'attach']);
});

test('evidence write failure is propagated after closure, never reported as a successful capture', async () => {
  const disk = new Error('write failed'), close = jest.fn().mockResolvedValue(), attach = jest.fn();
  fs.writeFile.mockRejectedValueOnce(disk);
  await expect(finishAi3Navigation({ context: { close },
    observation: { capture: jest.fn().mockResolvedValue(), stop: () => ({ events: [] }) },
    info: { outputPath: name => '/synthetic/'+name, attach } })).rejects.toBe(disk);
  expect(close).toHaveBeenCalledTimes(1); expect(attach).not.toHaveBeenCalled();
});

test('pending capture has a bounded wait, then waits for closure and preserves the original failure', async () => {
  jest.useFakeTimers();
  const captured = deferred(), closed = deferred(), original = new Error('upload failed');
  const observation = { capture: jest.fn().mockReturnValue(captured.promise), stop: () => ({ events: [{ event: 'detail-start' }] }) };
  const context = { close: jest.fn().mockReturnValue(closed.promise) };
  const info = { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockResolvedValue() };
  let settled = false;
  const done = finishAi3Navigation({ context, observation, info, failure: original }).catch(e => { settled = true; return e; });
  try {
    await jest.advanceTimersByTimeAsync(999);
    expect(context.close).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false); expect(fs.writeFile).not.toHaveBeenCalled();
    closed.resolve(); const error = await done;
    expect(error.errors[0]).toBe(original);
    expect(error.errors[1]).toMatchObject({ code: 'AI3_EVIDENCE_CAPTURE_TIMEOUT' });
    expect(info.attach).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.writeFile.mock.calls[0][1]).events).toEqual([{ event: 'detail-start' }]);
    expect(jest.getTimerCount()).toBe(0);
  } finally { captured.resolve(); closed.resolve(); await done; }
});

test.each(['resolve', 'reject'])('late capture %s after timeout cannot change the saved receipt or hide timeout', async completion => {
  jest.useFakeTimers();
  const captured = deferred(), page = pageFixture(); page.evaluate = jest.fn().mockReturnValue(captured.promise);
  const observation = observeAi3Navigation(page), close = jest.fn().mockResolvedValue();
  const done = finishAi3Navigation({ context: { close }, observation,
    info: { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockResolvedValue() } }).catch(e => e);
  try {
    await jest.advanceTimersByTimeAsync(1000);
    expect(close).toHaveBeenCalledTimes(1);
    const error = await done;
    expect(error).toMatchObject({ code: 'AI3_EVIDENCE_CAPTURE_TIMEOUT' });
    const receipt = observation.stop(), before = JSON.stringify(receipt);
    const saved = fs.writeFile.mock.calls[0][1];
    if (completion === 'reject') captured.reject(new Error('late closed page'));
    else captured.resolve({ route: { practiceRoute: true, roundId }, state: { states: ['已通过'] } });
    await jest.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(receipt)).toBe(before);
    expect(fs.writeFile.mock.calls[0][1]).toBe(saved);
    expect(receipt.events).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  } finally { captured.resolve(); await done; }
});

test('timed-out snapshot cannot append while context closure is still pending', async () => {
  jest.useFakeTimers();
  const captured = deferred(), closed = deferred(), page = pageFixture();
  page.evaluate = jest.fn().mockReturnValue(captured.promise);
  const observation = observeAi3Navigation(page), context = { close: jest.fn().mockReturnValue(closed.promise) };
  const done = finishAi3Navigation({ context, observation,
    info: { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockResolvedValue() } }).catch(e => e);
  try {
    await jest.advanceTimersByTimeAsync(1000); expect(context.close).toHaveBeenCalledTimes(1);
    captured.resolve({ route: { practiceRoute: true, roundId }, state: { states: ['已通过'] } });
    await jest.advanceTimersByTimeAsync(0);
    expect(fs.writeFile).not.toHaveBeenCalled();
    closed.resolve(); expect(await done).toMatchObject({ code: 'AI3_EVIDENCE_CAPTURE_TIMEOUT' });
    expect(JSON.parse(fs.writeFile.mock.calls[0][1]).events).toEqual([]);
  } finally { captured.resolve(); closed.resolve(); await done; }
});

test('successful capture cancels its deadline and never aborts after the receipt is saved', async () => {
  jest.useFakeTimers();
  let signal;
  await finishAi3Navigation({ context: { close: jest.fn().mockResolvedValue() },
    observation: { capture: async value => { signal = value; }, stop: () => ({ events: [] }) },
    info: { outputPath: name => '/synthetic/'+name, attach: jest.fn().mockResolvedValue() } });
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(1000);
  expect(signal.aborted).toBe(false);
});

test('stop prevents a late snapshot from mutating the returned event collection', async () => {
  const page = pageFixture(), captured = deferred(); page.evaluate = jest.fn().mockReturnValue(captured.promise);
  const observation = observeAi3Navigation(page), pending = observation.capture(), receipt = observation.stop();
  captured.resolve({ route: { practiceRoute: true, roundId }, state: { states: ['已通过'] } });
  await pending; expect(receipt.events).toEqual([]); expect(page.eventNames()).toEqual([]);
});

function browserSnapshot(page, callback) {
  const input = { matches: () => false, labels: [{ textContent: '添加练习图片' }] };
  const detail = { querySelector: () => input, querySelectorAll: () => [{ textContent: '待作答' }, { textContent: 'PRIVATE QUESTION' }] };
  return vm.runInNewContext('('+callback.toString()+')()', {
    URL, location: { href: page.url() }, document: { visibilityState: 'visible', querySelector: selector => selector === '[aria-label="练习详情"]' ? detail : null }
  });
}

test('route and DOM are captured together even if navigation occurs before evaluate resolves', async () => {
  const page = pageFixture(), observation = observeAi3Navigation(page);
  page.evaluate = jest.fn(async callback => {
    const captured = browserSnapshot(page, callback);
    page.url = () => `http://127.0.0.1/child/practice?roundId=${nextId}`;
    return captured;
  });
  await observation.capture(); const event = observation.stop().events[0];
  expect(event.route).toEqual({ practiceRoute: true, roundId });
  expect(event.state).toMatchObject({ states: ['待作答'], uploadPresent: true, uploadDisabled: false, uploadLabelMatches: true });
  expect(JSON.stringify(event)).not.toMatch(/SECRET|PRIVATE|token|127\.0\.0\.1/);
});

test.each([roundId, 'SECRET'])('synchronous browser snapshot allowlists the route and DOM for ID %s', async id => {
  const page = pageFixture(); page.url = () => `http://127.0.0.1/child/practice?roundId=${id}&token=SECRET`;
  page.evaluate = jest.fn(async callback => browserSnapshot(page, callback));
  const observation = observeAi3Navigation(page); await observation.capture();
  const event = observation.stop().events[0];
  expect(event.route).toEqual({ practiceRoute: true, roundId: id === roundId ? roundId : null });
  expect(event.state.states).toEqual(['待作答']);
  expect(JSON.stringify(event)).not.toMatch(/SECRET|PRIVATE|token|127\.0\.0\.1/);
});
