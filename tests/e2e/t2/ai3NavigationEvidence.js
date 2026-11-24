const { performance } = require('node:perf_hooks');
const fs = require('node:fs/promises');

const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const routeIdentity = value => {
  try {
    const url = new URL(value), roundId = url.searchParams.get('roundId');
    return { practiceRoute: url.pathname === '/child/practice', roundId: validId(roundId) ? roundId : null };
  } catch { return { practiceRoute: false, roundId: null }; }
};
const detailIdentity = request => {
  try {
    const match = new URL(request.url()).pathname.match(/^\/api\/ai3\/practice-rounds\/([a-f0-9]{24})$/);
    return request.method() === 'GET' && match ? match[1] : null;
  } catch { return null; }
};

function observeAi3Navigation(page) {
  const events = [], requests = new Map(), started = performance.now();
  let stopped = false;
  const record = data => { if (!stopped) events.push({ ms: Math.round(performance.now() - started), ...data }); };
  const request = req => {
    const roundId = detailIdentity(req);
    if (roundId) { const requestId = requests.size + 1; requests.set(req, requestId); record({ event: 'detail-start', requestId, roundId }); }
  };
  const response = res => { const requestId = requests.get(res.request()); if (requestId) record({ event: 'detail-response', requestId, status: res.status() }); };
  const finished = req => { const requestId = requests.get(req); if (requestId) record({ event: 'detail-finished', requestId }); };
  const failed = req => { const requestId = requests.get(req); if (requestId) record({ event: 'detail-failed', requestId }); };
  const navigated = frame => { if (frame === page.mainFrame()) record({ event: 'navigation', ...routeIdentity(frame.url()) }); };
  const listeners = { request, response, requestfinished: finished, requestfailed: failed, framenavigated: navigated };
  for (const [name, listener] of Object.entries(listeners)) page.on(name, listener);
  return {
    mark(roundId, exerciseCount, stage) {
      if (!validId(roundId) || ![2, 3].includes(exerciseCount) || !['selected', 'first-upload', 'revision-upload'].includes(stage)) throw new Error('Invalid synthetic navigation marker');
      record({ event: stage, roundId, exerciseCount, route: routeIdentity(page.url()) });
    },
    async capture(signal) {
      const snapshot = await page.evaluate(() => {
        const url = new URL(location.href), roundId = url.searchParams.get('roundId');
        const route = { practiceRoute: url.pathname === '/child/practice', roundId: /^[a-f0-9]{24}$/.test(roundId || '') ? roundId : null };
        const detail = document.querySelector('[aria-label="练习详情"]');
        const states = ['待作答', '已通过', '请再练一次', '等待家长审核', '已撤回', '准备中'];
        const input = detail?.querySelector('input[type="file"]');
        const state = { visibility: document.visibilityState, detailPresent: Boolean(detail),
          states: Array.from(detail?.querySelectorAll('h2,h3') || []).map(n => n.textContent).filter(t => states.includes(t)),
          uploadPresent: Boolean(input), uploadDisabled: input ? input.matches(':disabled') : null,
          uploadLabelMatches: Boolean(input && Array.from(input.labels || []).some(n => n.textContent === '添加练习图片')),
          alertPresent: Boolean(document.querySelector('[role="alert"]')) };
        return { route, state };
      });
      if (!signal?.aborted) record({ event: 'final-state', route: snapshot.route, state: snapshot.state });
    },
    stop() {
      stopped = true;
      for (const [name, listener] of Object.entries(listeners)) page.off(name, listener);
      return { schema: 'ai3-navigation-evidence-v1', events };
    }
  };
}

async function finishAi3Navigation({ context, observation, info, failure }) {
  const errors = failure ? [failure] : [];
  if (observation) {
    const controller = new AbortController();
    let timer;
    try {
      // Diagnostics must not consume the remaining cleanup window indefinitely.
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error('AI3 evidence capture exceeded 1000ms'), { code: 'AI3_EVIDENCE_CAPTURE_TIMEOUT' }));
        }, 1000);
      });
      await Promise.race([observation.capture(controller.signal), deadline]);
    } catch (error) { errors.push(error); }
    finally { clearTimeout(timer); }
  }
  try { await context.close(); } catch (error) { errors.push(error); }
  try {
    if (observation) {
      const body = JSON.stringify(observation.stop(), null, 2);
      const target = info.outputPath('ai3-child-navigation.json');
      await fs.writeFile(target, body);
      await info.attach('ai3-child-navigation', { path: target, contentType: 'application/json' });
    }
  } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'AI3 flow and evidence cleanup failures');
}

module.exports = { observeAi3Navigation, finishAi3Navigation };
