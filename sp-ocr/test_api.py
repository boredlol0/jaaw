"""Smoke test the deployed Space's public API."""

import base64
import io
import json
import os
import sys

import httpx
from PIL import Image

SPACE = os.environ.get(
    "SPACE_URL", "https://toshlol-glm-ocr-captcha.hf.space"
)
SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_captcha.png")
EXPECTED = "A7bK9"


def data_url(path: str) -> str:
    with open(path, "rb") as handle:
        return "data:image/png;base64," + base64.b64encode(handle.read()).decode()


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}", flush=True)
    return ok


def main() -> int:
    # A HF token makes the call use the caller's own ZeroGPU quota instead of the
    # Space owner's (free-tier quota is only a few GPU-minutes per day).
    headers = {}
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token:
        try:
            from huggingface_hub import get_token

            token = get_token()
        except Exception:
            token = None
    if token:
        headers["Authorization"] = f"Bearer {token}"

    client = httpx.Client(timeout=300.0, headers=headers)
    failures = 0

    # 1. health
    response = client.get(f"{SPACE}/api/health")
    health = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    failures += not check("GET /api/health -> 200", response.status_code == 200, str(response.status_code))
    failures += not check("health reports model", health.get("model") == "zai-org/GLM-OCR", json.dumps(health))

    # 2. landing page
    response = client.get(f"{SPACE}/")
    failures += not check("GET / -> 200 html", response.status_code == 200 and "<html" in response.text.lower())

    # 3. the actual OCR call
    payload = {"image": data_url(SAMPLE)}
    response = client.post(f"{SPACE}/api/captcha", json=payload)
    if response.status_code != 200:
        print("body:", response.text[:800], flush=True)
    failures += not check("POST /api/captcha -> 200", response.status_code == 200, str(response.status_code))
    body = response.json() if response.status_code == 200 else {}
    failures += not check(
        f"recognised text == {EXPECTED}",
        body.get("text", "").replace(" ", "") == EXPECTED,
        f"got {body.get('text')!r} in {body.get('elapsed_ms')} ms",
    )

    # 4. raw base64 (no data-url prefix) is accepted too
    with open(SAMPLE, "rb") as handle:
        raw_b64 = base64.b64encode(handle.read()).decode()
    response = client.post(f"{SPACE}/api/captcha", json={"image": raw_b64})
    failures += not check("raw base64 accepted", response.status_code == 200, str(response.status_code))

    # 5. bad input -> 400, not a 500
    response = client.post(f"{SPACE}/api/captcha", json={"image": "data:image/png;base64,not-base64!!"})
    failures += not check("invalid base64 -> 400", response.status_code == 400, str(response.status_code))

    # 6. missing field -> 422
    response = client.post(f"{SPACE}/api/captcha", json={})
    failures += not check("missing image -> 422", response.status_code == 422, str(response.status_code))

    # 7. schema endpoint
    response = client.get(f"{SPACE}/api/schema")
    failures += not check("GET /api/schema -> 200", response.status_code == 200, str(response.status_code))

    print(f"\n{'ALL CHECKS PASSED' if failures == 0 else str(failures) + ' CHECK(S) FAILED'}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
