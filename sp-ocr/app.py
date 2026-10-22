"""
Captcha Solver using GLM-OCR hosted on Hugging Face Space (Gradio Server mode + ZeroGPU).

REST API around `zai-org/GLM-OCR`:

    POST /api/captcha
        {"image": "data:image/png;base64,iVBORw0KGgo..."}
        -> {"text": "A7bK9", "elapsed_ms": 1420, ...}

    GET  /api/health   -> {"status": "ok", ...}
    GET  /api/schema   -> machine readable description of the API

`image` accepts a base64 data URL, a raw base64 payload, or an http(s) URL.

Deployment notes
----------------
* `import spaces` must happen before `import torch` on ZeroGPU: it monkeypatches
  `torch.cuda` so that GPU allocations are routed through the ZeroGPU allocator.
* The model is loaded eagerly at module scope (ZeroGPU streams the weights into
  VRAM on the first `@spaces.GPU` entry, so lazy loading would cost every caller).
* `LocalContext.request.set(...)` forwards the caller's request into the GPU
  worker so the caller's own ZeroGPU quota is billed, not the Space owner's.
"""

from __future__ import annotations

import base64
import binascii
import io
import ipaddress
import os
import re
import socket
import time
from typing import Any, Optional
from urllib.parse import urlparse

try:  # ZeroGPU runtime provides the `spaces` package.
    import spaces

    IS_ZERO_GPU = True
except ImportError:  # local / CPU fallback so the core stays testable
    IS_ZERO_GPU = False

    class _NoSpaces:
        @staticmethod
        def GPU(*args: Any, **kwargs: Any):
            if args and callable(args[0]):
                return args[0]

            def deco(fn):
                return fn

            return deco

    spaces = _NoSpaces()  # type: ignore[assignment]


import torch  # noqa: E402  (must stay after `import spaces`)
import gradio as gr  # noqa: E402
from fastapi import HTTPException, Request  # noqa: E402
from fastapi.responses import HTMLResponse  # noqa: E402
from gradio import Server  # noqa: E402
from gradio.context import LocalContext  # noqa: E402
from PIL import Image, ImageOps, UnidentifiedImageError  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from transformers import AutoModelForImageTextToText, AutoProcessor  # noqa: E402

# Configuration

MODEL_ID = os.environ.get("MODEL_ID", "zai-org/GLM-OCR")
DEFAULT_PROMPT = os.environ.get("DEFAULT_PROMPT", "Text Recognition:")
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
DEFAULT_MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "64"))
FETCH_TIMEOUT = float(os.environ.get("FETCH_TIMEOUT", "10"))
# Captchas are small; the vision tower works better on a slightly larger canvas.
DEFAULT_MIN_SIDE = int(os.environ.get("MIN_SIDE", "336"))
# ZeroGPU bills the ACTUAL task runtime, not the reserved lease. The lease only matters
# twice: it caps how long one task may run, and the scheduler refuses to start a task
# whose lease doesn't fit in the caller's remaining daily pool. So keep it tight and
# close to the real runtime (a captcha is ~0.3s warm, ~3s on a cold GPU attach) —
# a tight lease means the API keeps serving until the pool is nearly empty.
# The ZeroGPU client multiplies this by the hardware factor (x1.5 on Blackwell), so the
# enforced task limit is roughly (GPU_BASE_SECONDS + 0.03 * tokens) * 1.5 seconds.
GPU_BASE_SECONDS = float(os.environ.get("GPU_BASE_SECONDS", "3"))
GPU_RETRY_SECONDS = float(os.environ.get("GPU_RETRY_SECONDS", "15"))
GPU_SECONDS_PER_TOKEN = float(os.environ.get("GPU_SECONDS_PER_TOKEN", "0.03"))
GPU_MAX_SECONDS = int(os.environ.get("GPU_MAX_SECONDS", "120"))

# Mutable so a task that overruns the tight lease can be retried with a bigger one.
_lease_state = {"base": GPU_BASE_SECONDS}

DEVICE = os.environ.get("DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.bfloat16 if DEVICE == "cuda" else torch.float32

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[\w./+-]+)?;base64,(?P<data>.*)$", re.DOTALL)
_ALLOWED_MIME = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/bmp",
    "image/gif",
    "image/tiff",
    "image/avif",
}

# Model

print(f"[glm-ocr] loading {MODEL_ID} on {DEVICE} ({DTYPE}) ...", flush=True)
PROCESSOR = AutoProcessor.from_pretrained(MODEL_ID)
MODEL = (
    AutoModelForImageTextToText.from_pretrained(MODEL_ID, dtype=DTYPE)
    .to(DEVICE)
    .eval()
)
print("[glm-ocr] model ready", flush=True)


# Image decoding
def _decode_data_url(value: str) -> bytes:
    match = _DATA_URL_RE.match(value.strip())
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Not a base64 data URL — expected 'data:image/png;base64,<payload>'",
        )
    mime = (match.group("mime") or "").lower()
    if mime and mime not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported mime type: {mime}")
    return _decode_base64(match.group("data"))


def _decode_base64(payload: str) -> bytes:
    cleaned = "".join(payload.split())
    try:
        raw = base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image payload")
    return raw


def _assert_public_url(url: str) -> str:
    """Reject URLs pointing at private/loopback/link-local addresses (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https image URLs are supported")
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail=f"Could not resolve host '{host}'") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise HTTPException(status_code=400, detail="Refusing to fetch a non-public address")
    return url


def _fetch_url(url: str) -> bytes:
    import httpx

    safe = _assert_public_url(url)
    try:
        response = httpx.get(safe, timeout=FETCH_TIMEOUT, follow_redirects=True, max_redirects=3)
        response.raise_for_status()
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not fetch image URL: {exc}") from exc
    raw = response.content
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the maximum allowed size")
    return raw


def image_bytes_from_source(source: str) -> bytes:
    """Accept a data URL, raw base64, or http(s) URL and return raw image bytes."""
    if not source or not source.strip():
        raise HTTPException(status_code=400, detail="'image' is required")
    source = source.strip()

    if source.startswith("data:"):
        raw = _decode_data_url(source)
    elif source.startswith(("http://", "https://")):
        raw = _fetch_url(source)
    elif source.startswith("file://"):
        raise HTTPException(status_code=400, detail="file:// URLs are not supported")
    else:
        raw = _decode_base64(source)

    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the maximum allowed size")
    return raw


def to_pil(raw: bytes, min_side: int = DEFAULT_MIN_SIDE) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

    image = ImageOps.exif_transpose(image)

    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background
    image = image.convert("RGB")

    if min_side and min(image.size) < min_side:
        scale = min_side / min(image.size)
        new_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(new_size, Image.LANCZOS)

    return image


# Inference
def _gpu_duration(image: Image.Image, prompt: str, max_new_tokens: int) -> int:
    """Lease (raw seconds) reserved for one OCR task.

    The ZeroGPU client scales this by the hardware factor to get the enforced limit,
    and the scheduler requires the remaining daily quota to cover it.
    """
    tokens = max(1, int(max_new_tokens))
    return int(min(_lease_state["base"] + tokens * GPU_SECONDS_PER_TOKEN, GPU_MAX_SECONDS))


@spaces.GPU(duration=_gpu_duration)
def _run_ocr(image: Image.Image, prompt: str, max_new_tokens: int) -> str:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": prompt},
            ],
        }
    ]
    # Render the chat template, then hand the PIL image to the processor directly.
    # (transformers>=5 `apply_chat_template(tokenize=True)` loads images itself and
    # would collide with an explicit `images=` argument.)
    text = PROCESSOR.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    extra: dict = {}
    bos = PROCESSOR.tokenizer.bos_token
    if bos and text.startswith(bos):
        extra["add_special_tokens"] = False

    inputs = PROCESSOR(text=[text], images=[image], return_tensors="pt", **extra)
    inputs.pop("token_type_ids", None)
    inputs = {k: v.to(MODEL.device) if hasattr(v, "to") else v for k, v in inputs.items()}

    with torch.inference_mode():
        outputs = MODEL.generate(**inputs, max_new_tokens=int(max_new_tokens))

    generated = outputs[0][inputs["input_ids"].shape[-1] :]
    return PROCESSOR.tokenizer.decode(generated, skip_special_tokens=True).strip()


def solve(
    source: str,
    prompt: str = DEFAULT_PROMPT,
    max_new_tokens: int = DEFAULT_MAX_NEW_TOKENS,
    strip: bool = True,
    min_side: int = DEFAULT_MIN_SIDE,
) -> dict:
    """Decode an image source, run GLM-OCR, and return the recognised text."""
    raw = image_bytes_from_source(source)
    image = to_pil(raw, min_side=min_side)

    started = time.perf_counter()
    try:
        text = _run_ocr(image, prompt, max_new_tokens)
    except gr.Error as exc:
        if "abort" not in str(exc).lower():
            raise
        # The tight lease was too short for this task (e.g. a cold GPU attach on a
        # loaded node). Retry once with a generous lease.
        _lease_state["base"] = GPU_RETRY_SECONDS
        try:
            text = _run_ocr(image, prompt, max_new_tokens)
        finally:
            _lease_state["base"] = GPU_BASE_SECONDS
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return {
        "text": text.strip() if strip else text,
        "raw_text": text,
        "prompt": prompt,
        "model": MODEL_ID,
        "elapsed_ms": elapsed_ms,
        "width": image.width,
        "height": image.height,
    }


# HTTP API

class CaptchaRequest(BaseModel):
    image: str = Field(
        ...,
        description="Base64 data URL (data:image/png;base64,...), raw base64, or an http(s) image URL.",
    )
    prompt: str = Field(DEFAULT_PROMPT, description="GLM-OCR task prompt, e.g. 'Text Recognition:'.")
    max_new_tokens: int = Field(DEFAULT_MAX_NEW_TOKENS, ge=1, le=4096, description="Generation budget.")
    strip: bool = Field(True, description="Strip surrounding whitespace from the result.")
    min_side: int = Field(
        DEFAULT_MIN_SIDE,
        ge=0,
        le=4096,
        description="Upscale so the shorter side is at least this many pixels (0 disables).",
    )


class CaptchaResponse(BaseModel):
    text: str = Field(..., description="Recognised captcha text.")
    raw_text: str = Field(..., description="Untrimmed model output.")
    prompt: str
    model: str
    elapsed_ms: int
    width: int
    height: int


app = Server(
    title="GLM-OCR Captcha Solver",
    description="REST API for zai-org/GLM-OCR — accepts base64 images, returns recognised text.",
    version="1.0.0",
)


def _gpu_http_error(exc: Exception) -> HTTPException:
    """Turn a ZeroGPU failure into an actionable HTTP status.

    ZeroGPU raises ``gradio.Error`` for quota problems; left unhandled it surfaces as an
    opaque 500. Quota exhaustion is a 429, anything else GPU-side is a 503.
    """
    message = str(exc)
    lowered = message.lower()
    if "quota" in lowered or "gpu limit" in lowered or "runs limit" in lowered:
        return HTTPException(
            status_code=429,
            detail=(
                "ZeroGPU quota exhausted. Send 'Authorization: Bearer <HF_TOKEN>' so the call "
                "uses your own daily quota (5 min/day on a free account, 40 min on PRO) instead "
                f"of the shared pool, or retry later. ({message[:200]})"
            ),
        )
    return HTTPException(status_code=503, detail=f"GPU task failed: {message[:300]}")


@app.post("/api/captcha", response_model=CaptchaResponse, tags=["ocr"])
def api_captcha(payload: CaptchaRequest, request: Request) -> CaptchaResponse:
    """Solve a captcha with GLM-OCR.

    Accepts a base64 data URL, raw base64, or an http(s) image URL and returns
    the recognised text.
    """
    # Forward the caller's request so their own ZeroGPU quota is billed.
    LocalContext.request.set(gr.Request(request=request))
    try:
        result = solve(
            payload.image,
            prompt=payload.prompt,
            max_new_tokens=payload.max_new_tokens,
            strip=payload.strip,
            min_side=payload.min_side,
        )
    except gr.Error as exc:
        raise _gpu_http_error(exc) from exc
    return CaptchaResponse(**result)


@app.get("/api/health", tags=["meta"])
def api_health() -> dict:
    """Readiness probe: model id, device and GPU availability."""
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": str(MODEL.device),
        "dtype": str(DTYPE),
        "gpu": bool(torch.cuda.is_available()),
        "zero_gpu": IS_ZERO_GPU,
        "max_image_bytes": MAX_IMAGE_BYTES,
        "default_prompt": DEFAULT_PROMPT,
    }


@app.get("/api/schema", tags=["meta"])
def api_schema() -> dict:
    """Machine-readable description of this Space's HTTP API."""
    return {
        "model": MODEL_ID,
        "default_prompt": DEFAULT_PROMPT,
        "endpoints": {
            "POST /api/captcha": {
                "request": {
                    "image": "data:image/png;base64,<BASE64> | <BASE64> | https://host/img.png",
                    "prompt": DEFAULT_PROMPT,
                    "max_new_tokens": DEFAULT_MAX_NEW_TOKENS,
                    "strip": True,
                    "min_side": DEFAULT_MIN_SIDE,
                },
                "response": {
                    "text": "<recognised text>",
                    "raw_text": "<untrimmed output>",
                    "elapsed_ms": 0,
                },
            },
            "GET /api/health": {"response": {"status": "ok", "model": MODEL_ID}},
        },
        "example": {
            "curl": (
                "curl -X POST https://huggingface.co/spaces/toshlol/glm-ocr-captcha/api/captcha "
                "-H 'Content-Type: application/json' "
                "-d '{\"image\":\"data:image/png;base64,<BASE64>\"}'"
            )
        },
    }


@app.get("/", response_class=HTMLResponse)
async def homepage() -> str:
    """Tiny single-page UI so the Space is usable in a browser."""
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "index.html"), "r", encoding="utf-8") as handle:
        return handle.read()


@app.api(
    name="captcha",
    description="Solve a captcha (or OCR an image) with GLM-OCR.",
    concurrency_limit=2,
    time_limit=GPU_MAX_SECONDS,
)
def api_captcha_native(
    image: str,
    prompt: str = DEFAULT_PROMPT,
    max_new_tokens: int = DEFAULT_MAX_NEW_TOKENS,
) -> str:
    """Recognise the text in an image using GLM-OCR.

    Args:
        image: Base64 data URL, raw base64 payload, or a public http(s) image URL.
        prompt: GLM-OCR task prompt, e.g. "Text Recognition:".
        max_new_tokens: Generation budget.

    Returns:
        The recognised text.
    """
    try:
        return solve(image, prompt, max_new_tokens)["text"]
    except gr.Error as exc:
        raise _gpu_http_error(exc) from exc


if IS_ZERO_GPU:
    # ZeroGPU requires at least one decorated function to exist.
    spaces.GPU(lambda: None)


# The HF Space runtime looks for an object named `demo` to launch.
demo = app


if __name__ == "__main__":
    app.launch(server_name="0.0.0.0", server_port=7860, show_error=True, mcp_server=True)
