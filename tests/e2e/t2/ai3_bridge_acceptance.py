"""Actual AI1/AI2/AI3 applications; local synthetic Provider, counter and prices only."""

from contextlib import contextmanager
from datetime import datetime, timezone
import copy
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx
import pytest

from tests.services.ai1.lms_acceptance import PROFILE, TOKEN, calls, local as local
from tests.services.ai1.lms_business_acceptance import run_lms


@contextmanager
def combined_server(root, profile, now):
    repo = Path(os.environ["AI3_DEEPTUTOR_ROOT"])
    settings = {"mode": "enabled", "storeContinuous": True,
                "storePath": str(root / "operations.sqlite"),
                "serviceTokenFile": str(root / "service-token"),
                "providerKeyFile": str(root / "provider-token"), "profile": profile}
    for name, value in [("runtime.json", settings), ("test-clock.json", {"profile": profile, "now": now})]:
        path = root / name
        path.write_text(json.dumps(value))
        path.chmod(0o600)
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    origin = "http://127.0.0.1:" + str(listener.getsockname()[1])
    process = None
    env = {"PATH": os.defpath, "HOME": str(root / "home"), "DEEPTUTOR_HOME": str(root / "home"),
           "PYTHONPATH": str(repo), "PYTHONDONTWRITEBYTECODE": "1",
           "DEEPTUTOR_AI1_CONFIG_FILE": str(root / "runtime.json")}
    with (root / "combined-server.log").open("w") as log:
        try:
            process = subprocess.Popen([sys.executable, "-B", str(Path(__file__).resolve()), "--serve",
                                        str(listener.fileno()), str(root)], cwd=repo, env=env,
                                       stdout=log, stderr=subprocess.STDOUT, pass_fds=(listener.fileno(),))
            listener.close()
            with httpx.Client(trust_env=False, timeout=0.3) as probe:
                deadline = time.monotonic() + 15
                while True:
                    assert process.poll() is None, (root / "combined-server.log").read_text()
                    try:
                        if probe.get(origin + "/health/ready").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert time.monotonic() < deadline, "Combined application readiness deadline"
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
                    raise AssertionError("Combined application did not stop within fixture bound")


@pytest.mark.parametrize("source", ["task", "mistake"])
@pytest.mark.parametrize("engine", ["chromium", "webkit"])
def test_ai3_complete_formal_bridge(local, source, engine):
    root, store = local
    lms, modules = Path(os.environ["AI1_LMS_ROOT"]), Path(os.environ["AI1_NODE_PATH"])
    build, mongo = Path(os.environ["T2_WEB_BUILD"]), Path(os.environ["AI1_MONGO_BINARY"])
    assert (build / "index.html").is_file() and mongo.is_file()
    now = time.time_ns() // 1000000
    iso = lambda ms: datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    profile = copy.deepcopy(PROFILE)
    profile.update({"checkedAt": iso(now - 60000), "expiresAt": iso(now + 3600000)})
    config = root / "playwright.config.cjs"
    config.write_text("const base=require(" + json.dumps(str(lms / "playwright.t2.config.js"))
                      + ");module.exports={...base,testDir:" + json.dumps(str(lms / "tests/e2e/t2"))
                      + ",testMatch:'ai2Ai1Bridge.acceptance.js',outputDir:" + json.dumps(str(root / "screenshots"))
                      + ",use:{...base.use,browserName:" + json.dumps(engine) + ",viewport:{width:820,height:1180}}};\n")
    with combined_server(root, profile, now) as origin:
        env = {"PATH": os.defpath, "HOME": os.environ["HOME"], "NODE_ENV": "test", "NODE_PATH": str(modules),
               "MONGOMS_SYSTEM_BINARY": str(mongo), "MONGOMS_RUNTIME_DOWNLOAD": "false", "T2_WEB_BUILD": str(build),
               "AI1_ACTUAL_REMOTE_ORIGIN": origin, "AI1_ACTUAL_REMOTE_PROFILE": json.dumps(profile),
               "AI1_ACTUAL_REMOTE_FAULT": "none", "AI1_ACTUAL_SOURCE": source,
               "AI1_ACTUAL_REQUESTS": str(root / "requests.jsonl"), "AI1_ACTUAL_RESULT": str(root / "bridge-result.json"),
               "AI3_BRIDGE": "true", "AI3_ACTUAL_RESULT": str(root / "ai3-result.json")}
        code = run_lms([os.environ["AI1_NODE"], str(modules / "@playwright/test/cli.js"), "test", "--config=" + str(config)],
                       cwd=lms, env=env, log_path=root / "playwright.log")
        assert code == 0, (root / "playwright.log").read_text()
        ai1 = json.loads((root / "bridge-result.json").read_text())
        ai3 = json.loads((root / "ai3-result.json").read_text())
        assert store.get(ai1["remoteOperationId"])["status"] == "succeeded"
        assert len(calls(root)) == 1
        assert ai3["source"] == source and ai3["engine"] == engine
        assert ai3["counts"] == [2, 3] and ai3["closedLoops"] == 2
        assert store.get(ai3["remoteOperationId"])["status"] == "succeeded"
        provider_calls = (root / "provider-calls.jsonl").read_text().splitlines()
        assert len(provider_calls) == 1 and json.loads(provider_calls[0])["synthetic"] is True


def server_main():
    fd, root = int(sys.argv[2]), Path(sys.argv[3])
    def deny_outbound(event, values):
        if event in {"socket.connect", "socket.sendto"} and values[0].family in {socket.AF_INET, socket.AF_INET6}:
            raise RuntimeError("External sockets forbidden in synthetic application")
    sys.addaudithook(deny_outbound)
    import uvicorn
    from deeptutor.api import main
    from deeptutor.services.ai1_provider import RestrictedCompletionProvider
    from deeptutor.services.ai1_http import create_operation_app
    from deeptutor.services.ai3_operation import OperationService
    from tests.services.ai3.synthetic_server import SyntheticProvider
    settings = json.loads((root / "test-clock.json").read_text())
    profile, now = settings["profile"], settings["now"]
    class Counter:
        model_profile_version = profile["modelProfileVersion"]
        def upper_bound(self, _wire):
            return 8192
    def response(request):
        with (root / "attempts.jsonl").open("a") as output:
            output.write(json.dumps({"method": request.method, "path": request.url.path}) + "\n")
            output.flush()
            os.fsync(output.fileno())
        return httpx.Response(200, json={"id": "synthetic", "object": "chat.completion", "created": 1,
            "model": profile["model"], "choices": [{"index": 0, "finish_reason": "stop",
                "message": {"role": "assistant", "content": "6180"}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}})
    runtime = main.app.state.ai1_runtime
    runtime._clock = lambda: now
    runtime._provider = RestrictedCompletionProvider(profile=profile, counter=Counter(), clock=runtime._clock,
        key_loader=lambda: "synthetic-provider-credential-00001", transport_factory=lambda: httpx.MockTransport(response))
    from deeptutor.services.ai1_store import OperationStore
    service = OperationService(store=OperationStore(root / "operations.sqlite", initialize=False),
        provider=SyntheticProvider(root, "success"), profile=profile, mode="enabled", continuous=True, clock=lambda: now)
    from starlette.routing import Mount
    # The specific AI3 prefix must precede main's existing /internal/deeptutor mount.
    main.app.router.routes.insert(0, Mount("/internal/deeptutor/ai3",
        app=create_operation_app(service=service, token=TOKEN, dispatch_replays=False)))
    async def recorded(scope, receive, send):
        prefix = "/internal/deeptutor/operations/"
        if scope.get("type") == "http" and scope.get("path", "").startswith(prefix):
            with (root / "requests.jsonl").open("a") as output:
                output.write(json.dumps({"method": scope["method"], "id": scope["path"][len(prefix):]}) + "\n")
                output.flush()
                os.fsync(output.fileno())
        await main.app(scope, receive, send)
    uvicorn.Server(uvicorn.Config(recorded, lifespan="on", access_log=False, log_level="error")).run(sockets=[socket.socket(fileno=fd)])


if __name__ == "__main__":
    assert len(sys.argv) == 4 and sys.argv[1] == "--serve"
    server_main()
