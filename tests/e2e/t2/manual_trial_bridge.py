"""Explicit two-checkout v2 acceptance: formal main/lifespan, SDK HTTP substitute only."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx
import pytest

from tests.services.ai1.lms_acceptance import local as local, TOKEN, calls, private_json
from tests.services.ai1.lms_business_acceptance import run_lms
from deeptutor.services.ai1_store import OperationStore


@contextmanager
def formal_server(root, profile):
    repo = Path(os.environ['AI3_DEEPTUTOR_ROOT'])
    for namespace, store in [('AI1', 'operations.sqlite'), ('AI3', 'practice.sqlite')]:
        OperationStore(root / store, initialize=namespace == 'AI3')
        private_json(root / (namespace + '.json'), {
            'mode': 'enabled', 'storeContinuous': True, 'storePath': str(root / store),
            'serviceTokenFile': str(root / 'service-token'), 'providerKeyFile': str(root / 'provider-token'),
            'profile': {**profile, 'estimateAcknowledged': True}})
    private_json(root / 'profile.json', profile)
    listener = socket.socket()
    listener.bind(('127.0.0.1', 0))
    origin = 'http://127.0.0.1:' + str(listener.getsockname()[1])
    env = {'PATH': os.defpath, 'HOME': str(root / 'home'), 'DEEPTUTOR_HOME': str(root / 'home'),
           'PYTHONPATH': str(repo), 'PYTHONDONTWRITEBYTECODE': '1',
           **{'DEEPTUTOR_' + n + '_CONFIG_FILE': str(root / (n + '.json')) for n in ['AI1', 'AI3']}}
    process = None
    with (root / 'formal-server.log').open('w') as log:
        try:
            process = subprocess.Popen([sys.executable, '-B', str(Path(__file__).resolve()), '--serve',
                                        str(listener.fileno()), str(root)], cwd=repo, env=env,
                                       stdout=log, stderr=subprocess.STDOUT, pass_fds=(listener.fileno(),))
            listener.close()
            with httpx.Client(trust_env=False, timeout=0.3) as client:
                deadline = time.monotonic() + 15
                while True:
                    assert process.poll() is None, (root / 'formal-server.log').read_text()
                    try:
                        if client.get(origin + '/health/ready').status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert time.monotonic() < deadline, 'Formal runtime readiness deadline'
                    time.sleep(0.05)
            yield origin
        finally:
            listener.close()
            if process is not None:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
                    raise AssertionError('Formal runtime stop deadline exceeded')


@pytest.mark.parametrize('engine', ['chromium', 'webkit'])
def test_manual_trial_formal_browser(local, engine):
    root, _ = local
    now = time.time_ns() // 1000000
    iso = lambda ms: datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    profile = {'feeMode': 'estimate_only', 'sourceReference': 'synthetic-only-no-price-authority',
               'model': 'synthetic-model', 'modelProfileVersion': 'synthetic-trial-v2', 'pricingProfileVersion': 'synthetic-price-v2',
               'checkedAt': iso(now - 60000), 'expiresAt': iso(now + 3600000), 'callWindowMs': 60000,
               'clockMarginMs': 5000, 'inputPriceMicrosPerMillion': 1000000, 'outputPriceMicrosPerMillion': 2000000}
    lms = Path(os.environ['AI1_LMS_ROOT'])
    config = root / 'playwright.config.cjs'
    config.write_text('const base=require(' + json.dumps(str(lms / 'playwright.t2.config.js')) +
                      ');module.exports={...base,testDir:' + json.dumps(str(lms / 'tests/e2e/t2')) +
                      ',testMatch:"manualTrial.acceptance.js",outputDir:' + json.dumps(str(root / 'screenshots')) +
                      ',use:{...base.use,browserName:' + json.dumps(engine) + ',viewport:{width:820,height:1180}}};\n')
    with formal_server(root, profile) as origin:
        env = {'PATH': os.defpath, 'HOME': os.environ['HOME'], 'NODE_ENV': 'test',
               'NODE_PATH': os.environ['AI1_NODE_PATH'], 'MONGOMS_SYSTEM_BINARY': os.environ['AI1_MONGO_BINARY'],
               'MONGOMS_RUNTIME_DOWNLOAD': 'false', 'T2_WEB_BUILD': os.environ['T2_WEB_BUILD'],
               'AI1_ACTUAL_REMOTE_ORIGIN': origin, 'AI1_ACTUAL_REMOTE_PROFILE': json.dumps(profile),
               'TRIAL_EVIDENCE_ROOT': str(root)}
        code = run_lms([os.environ['AI1_NODE'], str(Path(os.environ['AI1_NODE_PATH']) / '@playwright/test/cli.js'),
                        'test', '--config=' + str(config)], cwd=lms, env=env, log_path=root / 'playwright.log')
        assert code == 0, (root / 'playwright.log').read_text()
        attempts = calls(root)
        assert len(attempts) == 2 and [a['profile'] for a in attempts] == ['ai1', 'ai3']
        assert all(a['body']['max_tokens'] == 4096 and a['body']['stream'] is False for a in attempts)


def serve():
    fd, root = int(sys.argv[2]), Path(sys.argv[3])
    def deny_outbound(event, values):
        if event in {'socket.connect', 'socket.sendto'} and values[0].family in {socket.AF_INET, socket.AF_INET6}:
            raise RuntimeError('Synthetic runtime forbids external sockets')
    sys.addaudithook(deny_outbound)
    import uvicorn
    from deeptutor.api import main
    from deeptutor.services.ai1_provider import RestrictedCompletionProvider as Provider1
    from deeptutor.services.ai3_provider import RestrictedCompletionProvider as Provider3
    profile = {**json.loads((root / 'profile.json').read_text()), 'estimateAcknowledged': True}
    def response(namespace, request):
        body = json.loads(request.content)
        with (root / 'attempts.jsonl').open('a') as output:
            output.write(json.dumps({'profile': namespace, 'body': body}) + '\n')
        text = '6180' if namespace == 'ai1' else json.dumps({'instructions': 'Show steps.', 'exercises': [
            {'exerciseId': 'q1', 'questionText': '132 * 24', 'answerForParent': '3168', 'rubricForParent': 'Align tens.'},
            {'exerciseId': 'q2', 'questionText': '203 * 31', 'answerForParent': '6293', 'rubricForParent': 'Align tens.'}]})
        result = {'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': profile['model'],
                  'choices': [{'index': 0, 'finish_reason': 'stop', 'message': {'role': 'assistant', 'content': text}}]}
        if namespace == 'ai1':
            result['usage'] = {'prompt_tokens': 100, 'completion_tokens': 50, 'total_tokens': 150}
        return httpx.Response(200, json=result)
    for namespace, provider in [('ai1', Provider1), ('ai3', Provider3)]:
        runtime = getattr(main.app.state, namespace + '_runtime')
        runtime._provider = provider(profile=profile, counter=None, clock=lambda: time.time_ns() // 1000000,
            key_loader=lambda: 'synthetic-provider-credential-00001',
            transport_factory=lambda n=namespace: httpx.MockTransport(lambda request: response(n, request)))
    # No route insertion: both operation namespaces must be assembled by main/lifespan.
    uvicorn.Server(uvicorn.Config(main.app, lifespan='on', access_log=False, log_level='error')).run(sockets=[socket.socket(fileno=fd)])


if __name__ == '__main__':
    assert len(sys.argv) == 4 and sys.argv[1] == '--serve'
    serve()
