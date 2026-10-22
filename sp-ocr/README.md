# Captcha Solver

`zai-org/GLM-OCR` (1.3B multimodal OCR model) served as a small REST API on Hugging Face
ZeroGPU to solve student portal captchas automatically.

**API base URL:** `https://toshlol-glm-ocr-captcha.hf.space`

> This folder is the source of that Space. Push it to the Hub and it deploys as-is.

## Layout

```text
sp-ocr/
├── app.py               # the Space: Gradio Server + FastAPI routes + ZeroGPU wiring
├── index.html           # single-page UI served at "/"
├── requirements.txt     # torch/torchvision pinned to ZeroGPU's allowed set
├── openapi.yaml         # OpenAPI 3.1 contract
├── sample_captcha.png   # fixture used by the tests
├── test_api.py          # live smoke test (REST surface)
├── test_gradio_api.py   # live smoke test (Gradio-native + MCP surface)
```

## Deploy

```bash
pip install -U huggingface_hub
hf auth login

hf repos create <namespace>/<space> --type space --space-sdk gradio \
  --flavor zero-a10g --public --exist-ok

hf spaces variables add <namespace>/<space> \
  --env DEVICE=cuda --env GRADIO_SSR_MODE=false \
  --env GPU_BASE_SECONDS=3 --env GPU_RETRY_SECONDS=15

hf upload <namespace>/<space> . --repo-type space --exclude "**/__pycache__/**"
```

> `--repo-type space` is required — without it `hf upload` creates a *model* repo instead.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DEVICE` | `cuda` if available | Force the device (`cuda` / `cpu`) |
| `GRADIO_SSR_MODE` | `false` | Required for the custom `/` route to serve |
| `GPU_BASE_SECONDS` | `3` | Base GPU lease (s). Tight = keeps serving until the quota pool is nearly empty |
| `GPU_RETRY_SECONDS` | `15` | Lease used for the one retry when a task overruns the tight lease |
| `GPU_SECONDS_PER_TOKEN` | `0.03` | Extra lease per generated token |
| `GPU_MAX_SECONDS` | `120` | Hard ceiling on the lease |
| `MIN_SIDE` | `336` | Upscale the image so its shorter side is at least this many px |
| `MAX_IMAGE_BYTES` | `10485760` | Reject larger uploads with `413` |
| `DEFAULT_MAX_NEW_TOKENS` | `64` | Default generation budget |
| `MODEL_ID` | `zai-org/GLM-OCR` | Model to load |
| `DEFAULT_PROMPT` | `Text Recognition:` | Default task prompt |

## Local run

```bash
pip install -r requirements.txt          # torch/torchvision come from the pinned CUDA wheels
DEVICE=cpu python app.py                  # runs on CPU, no ZeroGPU needed
```

`import spaces` falls back to a no-op decorator when the package is absent, so the model and
the API work on a plain CPU machine — only `@spaces.GPU` becomes a passthrough.

## API

### `POST /api/captcha`

```bash
curl -X POST https://toshlol-glm-ocr-captcha.hf.space/api/captcha \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $HF_TOKEN" \
  -d '{"image":"data:image/png;base64,<BASE64>"}'
```

**Request body**

| Field | Type | Default | Description |
|---|---|---|---|
| `image` | string | *required* | Base64 data URL (`data:image/png;base64,…`), raw base64, or an `http(s)` image URL |
| `prompt` | string | `Text Recognition:` | GLM-OCR task prompt (`Text Recognition:` / `Formula Recognition:` / `Table Recognition:`) |
| `max_new_tokens` | int | `64` | Generation budget (1–4096) |
| `strip` | bool | `true` | Trim whitespace from the result |
| `min_side` | int | `336` | Upscale so the shorter side is at least N px (captchas are small); `0` disables |

**Response** `200`

```json
{
  "text": "A7bK9",
  "raw_text": "A7bK9",
  "prompt": "Text Recognition:",
  "model": "zai-org/GLM-OCR",
  "elapsed_ms": 3700,
  "width": 971,
  "height": 336
}
```

**Errors** — `400` bad base64 / undecodable image / non-public URL, `413` image too large,
`422` invalid JSON body, `429` ZeroGPU quota exhausted.

### `GET /api/health`

```json
{"status":"ok","model":"zai-org/GLM-OCR","device":"cpu","dtype":"torch.bfloat16","gpu":true,"zero_gpu":true}
```

### `GET /api/schema`

Machine-readable description of the API.

Interactive OpenAPI docs live at `/docs`.

### Gradio-native API + MCP

The same model is exposed through the Gradio API and as an MCP tool:

```bash
curl -X POST https://toshlol-glm-ocr-captcha.hf.space/gradio_api/call/captcha \
  -H 'Content-Type: application/json' \
  -d '{"data":["data:image/png;base64,<BASE64>","Text Recognition:",64]}'
```

MCP endpoint: `https://toshlol-glm-ocr-captcha.hf.space/gradio_api/mcp/`

## Python client

```python
import base64, httpx, os

with open("captcha.png", "rb") as f:
    data_url = "data:image/png;base64," + base64.b64encode(f.read()).decode()

r = httpx.post(
    "https://toshlol-glm-ocr-captcha.hf.space/api/captcha",
    json={"image": data_url},
    headers={"Authorization": f"Bearer {os.environ['HF_TOKEN']}"},
    timeout=120,
)
print(r.json()["text"])
```

## ZeroGPU quota

Daily GPU quota (official tiers): **unauthenticated 2 min/day · free account 5 min/day ·
PRO 40 min/day** (resets 24 h after your first GPU usage).

**Authenticated calls are billed against the caller's own quota**; anonymous calls fall back to
the Space owner's shared pool. Send a Hugging Face token to use your own:

```bash
export HF_TOKEN=hf_xxx      # https://huggingface.co/settings/tokens
```

The quota is charged on the **actual GPU runtime** of each task (~0.3 s warm, ~3 s on a cold
GPU attach), not on the reserved lease. The lease only sets the per-task timeout and the
scheduling precondition — the remaining daily pool must cover it when the call starts — so it is
kept tight (`GPU_BASE_SECONDS=3` + `0.03 s/token`, scaled ×1.5 by the ZeroGPU client on
Blackwell ≈ a 5 s task limit). A task that overruns that limit is automatically retried once
with a larger lease (`GPU_RETRY_SECONDS=15`).

## Contract & tests

| Artifact | Path |
|---|---|
| OpenAPI 3.1 spec | [`openapi.yaml`](./openapi.yaml) |
| Smoke test | [`test_api.py`](./test_api.py) |

Run the contract against the live Space:
```bash
python test_api.py        # requires httpx + pillow
```

## Notes

* The model weights are downloaded from the Hub at runtime and cached in the container
(ephemeral — wiped on restart). Nothing is stored on the caller or the Space owner.
* `min_side` upscales small images before inference; GLM-OCR's vision tower works noticeably
better on captchas that are at least ~336 px on the short side.
* Model: [zai-org/GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) (MIT).
