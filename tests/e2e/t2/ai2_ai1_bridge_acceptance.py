"""PUB01/FLOW01: actual local AI1 approval into AI2, synthetic Provider transport only."""

import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time

import pytest

from tests.services.ai1.lms_browser_acceptance import PROFILE, calls, run_lms, serve
from tests.services.ai1.lms_browser_acceptance import local as local


@pytest.mark.parametrize("source", ["task", "mistake"])
@pytest.mark.parametrize("engine", ["chromium", "webkit"])
def test_actual_ai1_ai2_bridge(local, source, engine):
    root, store = local
    lms = Path(os.environ["AI1_LMS_ROOT"])
    modules = Path(os.environ["AI1_NODE_PATH"])
    mongo = Path(os.environ["AI1_MONGO_BINARY"])
    build = Path(os.environ["T2_WEB_BUILD"])
    assert mongo.is_absolute() and mongo.is_file()
    assert modules.is_absolute() and (modules / "@playwright/test/cli.js").is_file()
    assert build.is_absolute() and (build / "index.html").is_file()
    assert (lms / "tests/e2e/t2/ai2Ai1Bridge.acceptance.js").is_file()
    now = time.time_ns() // 1000000

    def iso(ms):
        return (
            datetime.fromtimestamp(ms / 1000, timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    profile = copy.deepcopy(PROFILE)
    profile.update({"checkedAt": iso(now - 60000), "expiresAt": iso(now + 3600000)})
    config = root / "playwright.config.cjs"
    config.write_text(
        "const base = require("
        + json.dumps(str(lms / "playwright.t2.config.js"))
        + ");\nmodule.exports={...base,testDir:"
        + json.dumps(str(lms / "tests/e2e/t2"))
        + ",globalTimeout:100000,testMatch:'ai2Ai1Bridge.acceptance.js',outputDir:"
        + json.dumps(str(root / "screenshots"))
        + ",use:{...base.use,browserName:"
        + json.dumps(engine)
        + ",viewport:{width:820,height:1180}}};\n"
    )
    # DeepTutor denies outbound sockets; JS restricts Node TCP and browser requests to local endpoints.
    with serve(root, fault="none", profile=profile, now=now) as (origin, _):
        env = {
            "PATH": os.defpath,
            "HOME": os.environ["HOME"],
            "NODE_ENV": "test",
            "NODE_PATH": str(modules),
            "MONGOMS_SYSTEM_BINARY": str(mongo),
            "MONGOMS_RUNTIME_DOWNLOAD": "false",
            "T2_WEB_BUILD": str(build),
            "AI1_ACTUAL_REMOTE_ORIGIN": origin,
            "AI1_ACTUAL_REMOTE_PROFILE": json.dumps(profile),
            "AI1_ACTUAL_REMOTE_FAULT": "none",
            "AI1_ACTUAL_SOURCE": source,
            "AI1_ACTUAL_REQUESTS": str(root / "requests.jsonl"),
            "AI1_ACTUAL_RESULT": str(root / "bridge-result.json"),
        }
        code = run_lms(
            [
                os.environ["AI1_NODE"],
                str(modules / "@playwright/test/cli.js"),
                "test",
                "--config=" + str(config),
            ],
            cwd=lms,
            env=env,
            log_path=root / "playwright.log",
        )
        assert code == 0, (root / "playwright.log").read_text()
        result = json.loads((root / "bridge-result.json").read_text())
        remote = store.get(result["remoteOperationId"])
        assert remote["status"] == "succeeded"
        assert remote["requestHash"] == result["requestHash"]
        assert len(calls(root)) == 1
        requests = [json.loads(line) for line in (root / "requests.jsonl").read_text().splitlines()]
        assert requests == [{"method": "PUT", "id": result["remoteOperationId"]}]
        wire = store.snapshot(result["remoteOperationId"])
        assert wire["messages"] == result["previewMessages"]
        assert wire["requestOptions"] == result["previewOptions"]
        assert result["source"] == source and result["engine"] == engine
        assert result["packageVersions"] == [1, 3, 4, 6, 7] and result["attempts"] == 2
        assert result["ai1UnchangedExceptPublicationCas"] is True
        assert result["businessUnchanged"] is True
        assert result["businessWriteCallsDuringAi2"] == 0
        assert result["rejectedWriteProbeCount"] == 1
        assert result["deniedTcpProbeCount"] == 3 and result["unexpectedTcpCount"] == 0
        for filename in (
            "bridge-ai1-approved.png",
            "bridge-child-preview.png",
            "bridge-child-approved.png",
            "bridge-parent-approved.png",
        ):
            images = list((root / "screenshots").rglob(filename))
            assert len(images) == 1 and images[0].stat().st_size > 0
