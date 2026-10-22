# jaaw-sp — Student Portal Worker

Stateless Cloudflare Worker in front of the SRM Student Portal
(`sp.srmist.edu.in`). It fetches the portal's login captcha, logs in, and  
scrapes attendance and internal marks as JSON.

Two login modes:

- **Self-service** — send just `username` + `password`. The worker fetches a
fresh captcha from the portal and solves it with the
[SP OCR](https://toshlol-glm-ocr-captcha.hf.space).
- **Manual** — send `username` + `password` + `captcha` + `cdigest`, for when
the caller already fetched a captcha from `GET /captcha` and solved it.

## Layout

```text
sp-worker/
├── worker.js               # everything: routing, portal client, OCR tie-in
├── wrangler.toml           # worker config (name = "jaaw-sp")
```

## Deploy

```bash
npx wrangler secret put HF_TOKEN   # paste a Hugging Face token when prompted
npx wrangler deploy
npx wrangler secret list           # verify HF_TOKEN landed as a secret, not a var
```

> `HF_TOKEN` must be a **secret** (encrypted), not a plain-text `vars` entry in
> `wrangler.toml` — it is the token the worker authenticates to the OCR Space
> with.

## Secrets

| Name | Required | Purpose |
|---|---|---|
| `HF_TOKEN` | recommended | Sent as `Authorization: Bearer` to the OCR Space. The GPU call is then billed to the **token owner's** ZeroGPU quota (free: ~5 min/day, PRO: ~40 min/day) instead of the Space owner's shared pool. Without it every login quietly runs on the shared quota and starts failing with a quota hint once that pool is empty. |

## Endpoints

The worker serves everything under the deployment URL, with or without an
`/sp` prefix (`/sp/login` and `/login` are equivalent). CORS is `*` on every
response and `OPTIONS` is answered everywhere.

The worker is mapped to `https://api.jaaw.tosh.cc.cd/api/sp*`

### `GET /captcha`

Fetches a fresh portal captcha (login page → parse nonce/field names → image
request) and returns:

```json
{
  "success": true,
  "image": "data:image/png;base64,<BASE64>",
  "cdigest": "<base64url>"
}
```

`cdigest` is the opaque login state — base64url of
`{cookies, nonce, dField, cField, delim, fields, createdAt}`. Send it back
**untouched** in the manual login mode.

### `POST /login`

Self-service (captcha is solved for you):

```json
{ "username": "ar3699@srmist.edu.in", "password": "…" }
```

`@srmist.edu.in` and any other `@` suffix is stripped automatically (`netid`
is accepted as an alias for `username`).

Manual (caller already solved the captcha):

```json
{ "username": "ar3699", "password": "…", "captcha": "aB12Cd", "cdigest": "…" }
```

On success:

```json
{
  "success": true,
  "source": "sp",
  "ms": 1234,
  "attendance": [
    {
      "courseCode": "21CSC203P",
      "courseTitle": "Advanced Programming Practice",
      "courseType": "Theory",
      "slot": "",
      "classesConducted": 46,
      "classesAbsent": 7,
      "attendancePercentage": 84.78
    }
  ],
  "marks": [
    {
      "courseCode": "21CSC203P",
      "courseType": "Internal",
      "summary": "18/20",
      "assessments": [{ "title": "Internal Review 1", "obtainedMarks": "9", "maximumMarks": "10" }],
      "totalMarksObtained": 18,
      "totalMarksMaximum": 20
    }
  ],
  "session": { "cookies": { "JSESSIONID": "…", "…": "…" } }
}
```

Courses that appear on the attendance page but have no marks yet get a
placeholder marks entry with `summary: "N/A"`.

### `POST /refresh`

Re-scrapes attendance + marks using stored cookies instead of logging in:

```json
{ "cookies": { "JSESSIONID": "…", "…": "…" } }
```

Returns the same body shape as `/login` minus the `ms` timing field (new
cookies included). If the portal
bounces to the login page, returns `401 SESSION_EXPIRED` — the client's cue to
log in again.

### `GET /diag`

Connectivity probe: egress IP, Cloudflare colo, clock skew against the portal's
`Date` header, login-page size, cookies issued by the portal. Useful when
`/login` starts failing — it isolates "portal is down/slow" from "login logic
broke".

### `GET /`

Route list (self-documenting index).

## Errors

Every failure is `{"detail": {"type": "...", "message": "..."}}` so clients can
branch on `type` (a few edge cases — missing fields, bad routes, and raw
captcha-fetch failures on `GET /captcha` — emit a plain `{"detail": "string"}`
instead):

| type | status | meaning |
|---|---|---|
| `WRONG_CAPTCHA` | 401 | Portal rejected the captcha text (manual path: typo; OCR path: shouldn't happen) |
| `INVALID_CREDENTIALS` | 401 | Portal accepted the captcha but rejected username/password |
| `ACCOUNT_LOCKED` | 403 | Portal says the account is locked |
| `LOGIN_FAILED` | 401 | Portal failed the login with an unrecognized message |
| `OCR_FAILED` | 502 | GLM-OCR couldn't provide a plausible answer (see the hint for quota exhaustion) |
| `CAPTCHA_FETCH_FAILED` | 502 | The portal didn't serve a captcha at all |
| `CAPTCHA_UNAVAILABLE` | 503 | Login page loaded but exposed no captcha image |
| `BAD_STATE` | 400 | Manual path: `cdigest` missing/corrupt — `GET /captcha` again |
| `SESSION_EXPIRED` | 401 | `/refresh`: cookies are no longer logged in — log in again |

## How the self-service login works

One `/login` call performs at most **two captcha fetches** and exactly **one
portal submission**:

1. `GET` the login page → parse `nonce`, domain/captcha field names, the

   delimiter, captcha image path, and every form field name.
2. `GET` the captcha image (the portal requires an `X-Domain-Proof` header).
3. Post it to the GLM-OCR Space. The answer is sanity-gated against

   `/^[A-Za-z0-9]{4,12}$/`; an implausible answer retries once with a **freshly**  
     **fetched** captcha.
4. Assemble the login payload: all form fields, the base64 domain token, the

   time-delay token, and a telemetry blob. The portal's JS SDK normally builds
     that blob (mouse moves, keystrokes, time-on-page…); the worker forges a
     plausible one with randomized counters seeded from the captcha length and
     real elapsed time.
5. `POST` to `LoginServlet` once, follow the portal's `theGR8LoginLoader`

   redirect chain, then verify by scraping attendance + marks in parallel —
     the data-pages request itself is the authoritative "did we actually log
     in" check, and it doubles as the response body.

## Frontend contract

The dashboard consumes this worker through `src/lib/api.ts`
(`apiSpCaptcha` / `apiSpLogin` / `apiSpRefresh`); `SP_LOGIN_ERROR_COPY` at the
top of `src/components/dashboard/sp-fallback-form.tsx` maps the `type` codes
above to friendly copy, and that component implements the fallback login
ladder.
