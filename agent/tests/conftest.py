import os
import socket
import subprocess
import time
from pathlib import Path

import httpx
import pytest

API_DIR = Path(__file__).resolve().parents[2] / "api"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def api_url() -> str:
    """The real Bun API from ../api, on an ephemeral port with an in-memory database."""
    port = _free_port()
    proc = subprocess.Popen(
        ["bun", "run", "src/server.ts"],
        cwd=API_DIR,
        env={**os.environ, "PORT": str(port), "DB_PATH": ":memory:"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            httpx.get(f"{url}/menu", timeout=0.5)
            break
        except httpx.HTTPError:
            time.sleep(0.05)
    else:
        proc.kill()
        raise RuntimeError("bun api did not start")
    yield url
    proc.kill()
    proc.wait()
