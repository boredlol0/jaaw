"""Check the Gradio-native API + MCP surface of the deployed Space."""

import base64
import json
import os
import sys
import time

import httpx

SPACE = os.environ.get("SPACE_URL", "https://toshlol-glm-ocr-captcha.hf.space")
SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_captcha.png")


def token() -> str:
    try:
        from huggingface_hub import get_token

        return get_token() or ""
    except Exception:
        return os.environ.get("HF_TOKEN", "")


def main() -> int:
    with open(SAMPLE, "rb") as handle:
        data_url = "data:image/png;base64," + base64.b64encode(handle.read()).decode()

    headers = {"Content-Type": "application/json"}
    if token():
        headers["Authorization"] = f"Bearer {token()}"

    client = httpx.Client(timeout=300.0, headers=headers)
    failures = 0

    # --- Gradio-native API ------------------------------------------------ #
    response = client.post(
        f"{SPACE}/gradio_api/call/captcha",
        json={"data": [data_url, "Text Recognition:", 64]},
    )
    ok = response.status_code == 200
    print(f"{'PASS' if ok else 'FAIL'}  POST /gradio_api/call/captcha -> {response.status_code}")
    failures += not ok
    if ok:
        event_id = response.json()["event_id"]
        result = {}
        for _ in range(120):
            raw = client.get(f"{SPACE}/gradio_api/call/captcha/{event_id}")
            if "text/event-stream" in (raw.headers.get("content-type") or ""):
                for line in raw.text.splitlines():
                    if line.startswith("data:"):
                        result = {"data": json.loads(line[5:].strip()), "success": True}
            else:
                result = raw.json()
            if result.get("success"):
                break
            time.sleep(1)
        text = (result.get("data") or [""])[0]
        matched = text.replace(" ", "") == "A7bK9"
        print(f"{'PASS' if matched else 'FAIL'}  gradio_api result == 'A7bK9' (got {text!r})")
        failures += not matched

    # --- MCP tool listing ------------------------------------------------- #
    response = client.post(
        f"{SPACE}/gradio_api/mcp/",
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "smoke-test", "version": "1.0"},
            },
        },
        headers={"Accept": "application/json, text/event-stream"},
    )
    ok = response.status_code in (200, 406)
    print(f"{'PASS' if ok else 'FAIL'}  MCP initialize -> {response.status_code}")
    failures += not ok

    print("\n" + ("ALL GRADIO/MCP CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

