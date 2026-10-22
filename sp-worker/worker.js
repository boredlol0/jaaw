// stateless Student Portal login probe for Cloudflare Workers.

const BASE = "https://sp.srmist.edu.in/srmiststudentportal";
const LOGIN_PAGE = `${BASE}/students/loginManager/youLogin.jsp`;
const LOGIN_SERVLET = `${BASE}/LoginServlet`;
const ATT_URL = `${BASE}/students/report/studentAttendanceDetails.jsp`;
const MARKS_URL = `${BASE}/students/report/studentInternalMarkDetails.jsp`;
const INNER_URL = `${BASE}/students/report/studentInternalMarkDetailsInner.jsp`;
const HOST = "sp.srmist.edu.in";
const OCR_URL = "https://toshlol-glm-ocr-captcha.hf.space/api/captcha";
const OCR_TIMEOUT_MS = 45000;
const OCR_ATTEMPTS = 2;
const PLAUSIBLE_CAPTCHA = /^[A-Za-z0-9]{4,12}$/;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const COMMON_HEADERS = {
  "user-agent": UA,
  referer: LOGIN_PAGE,
  origin: "https://sp.srmist.edu.in",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const b64url = (s) =>
  b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => {
  const pad = s + "===".slice((s.length + 3) % 4);
  const bin = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  return decodeURIComponent(escape(bin));
};
const rnd = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const first = (text, res) => {
  for (const r of res) {
    const m = text.match(r);
    if (m && m[1]) return m[1];
  }
  return null;
};

function makeJar(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    header() {
      return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    names() {
      return [...map.keys()];
    },
    object() {
      return Object.fromEntries(map);
    },
    capture(res) {
      const getSet = res.headers.getSetCookie ? res.headers.getSetCookie() : null;
      const raws = getSet && getSet.length ? getSet : [res.headers.get("set-cookie")].filter(Boolean);
      for (const h of raws) {
        const part = h.split(";")[0];
        const i = part.indexOf("=");
        if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
      }
    },
  };
}

async function request(jar, url, { method = "GET", body = null, headers = {} } = {}) {
  let currentUrl = url;
  let current = { method, body, headers };
  for (let hop = 0; hop <= 10; hop++) {
    const h = new Headers({ ...COMMON_HEADERS, ...current.headers });
    const ck = jar.header();
    if (ck) h.set("cookie", ck);
    const init = { method: current.method, headers: h, redirect: "manual" };
    if (current.body) {
      init.body = current.body;
      if (!h.has("content-type")) h.set("content-type", "application/x-www-form-urlencoded");
    }
    const res = await fetch(currentUrl, init);
    jar.capture(res);
    const loc = res.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
      await res.arrayBuffer().catch(() => undefined);
      currentUrl = new URL(loc, currentUrl).toString();
      if ([301, 302, 303].includes(res.status)) current = { method: "GET", body: null, headers: {} };
      continue;
    }
    return { res, url: currentUrl };
  }
  throw new Error("too many redirects");
}

const postForm = (jar, url, data, headers) =>
  request(jar, url, { method: "POST", body: new URLSearchParams(data), headers });

function parseLoginPage(html) {
  const nonce =
    first(html, [/nonce\s*:\s*'([^']+)'/, /SECURE_CONFIG\.nonce\s*=\s*'([^']+)'/, /id="fpNonce"\s*value="([^"]+)"/]) ?? "";
  const dField = first(html, [/domainFieldName\s*=\s*['"]([^'"]+)['"]/]) ?? "dtoken_x";
  const cField = first(html, [/captchaFieldName\s*=\s*['"]([^'"]+)['"]/]) ?? "cptoken_x";
  const delim = first(html, [/randomDelimiter\s*=\s*'([^']+)'/]) ?? "0000";
  const m = html.match(/id="secure_captcha"[^>]*data-src="([^"]+)"/);
  const captchaPath = m ? m[1].replace(/&amp;/g, "&") : null;
  const fields = [...html.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*>/gi)].map((x) => x[1]);
  return { nonce, dField, cField, delim, captchaPath, fields };
}

function forgedTelemetry(createdAt, captchaLen) {
  const now = Date.now();
  return {
    startTime: createdAt,
    currentDomain: HOST,
    timezoneOffset: -330,
    screenWidth: 1536,
    screenHeight: 864,
    colorDepth: 24,
    devicePixelRatio: 1.25,
    platform: "Win32",
    userAgent: UA,
    language: "en-US",
    hardwareConcurrency: 12,
    deviceMemory: 8,
    touchSupport: false,
    webdriver: false,
    mouseClicks: rint(8, 25),
    mouseMovements: rint(60, 140),
    keystrokeCount: captchaLen + rint(8, 20),
    typingSpeedMs: rint(800, 2500),
    canvasHash: `-${rnd(7)}`,
    submitTime: now,
    timeOnPageMs: Math.max(0, now - createdAt),
  };
}

const CODE_RE = /^[A-Z0-9]{6,12}$/;
function rows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1])),
  );
}
function parseAttendance(html) {
  const out = [];
  for (const cells of rows(html)) {
    if (cells.length < 6 || !CODE_RE.test(cells[0])) continue;
    const conducted = parseInt(cells[2], 10);
    const absent = parseInt(cells[4], 10);
    const percent = parseFloat(cells[5]);
    if (Number.isNaN(conducted) || Number.isNaN(absent) || Number.isNaN(percent)) continue;
    out.push({
      courseCode: cells[0],
      courseTitle: cells[1],
      courseType: "Theory",
      slot: "",
      classesConducted: conducted,
      classesAbsent: absent,
      attendancePercentage: percent,
    });
  }
  return out;
}
function parseMarksOuter(html) {
  const out = [];
  for (const cells of rows(html)) {
    if (cells.length < 3 || !CODE_RE.test(cells[0])) continue;
    let got = null,
      max = null;
    if (cells[2].includes("/")) {
      const [a, b] = cells[2].split("/", 2);
      const g = parseFloat(a),
        t = parseFloat(b);
      if (!Number.isNaN(g) && !Number.isNaN(t)) {
        got = g;
        max = t;
      }
    }
    out.push({ courseCode: cells[0], title: cells[1], got, max });
  }
  const ids = [
    ...html.matchAll(/funViewComponentWiseMarks\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*,\s*([0-9]+)\s*\)/g),
  ];
  return out.map((s, i) => ({ ...s, subjectId: ids[i] ? ids[i][1] : null, status: ids[i] ? ids[i][2] : "2" }));
}
function parseMarksInner(html) {
  const out = [];
  for (const cells of rows(html)) {
    if (cells.length < 3 || !cells[2].includes("/")) continue;
    const [a, b] = cells[2].split("/", 2);
    if (!cells[1]) continue;
    out.push({ title: cells[1], obtainedMarks: a.trim(), maximumMarks: b.trim() });
  }
  return out;
}

const loggedOut = (url, body) => {
  const l = body.toLowerCase();
  return (
    url.toLowerCase().includes("youlogin") ||
    l.includes("thegr8loginloader") ||
    l.includes('id="login_form"')
  );
};

async function followLoaders(jar, url, body) {
  let u = url,
    b = body;
  for (let i = 0; i < 5 && /theGR8LoginLoader/i.test(b); i++) {
    const target = new URL("../../students/loginManager/youLogin.jsp", u).toString();
    const { res } = await postForm(jar, target, {});
    u = res.url;
    b = await res.text();
  }
  return { url: u, body: b };
}

function classify(body) {
  const m = body.match(/alert-icon-content[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ||
    body.match(/alert-danger[^>]*>([\s\S]*?)<\/div>/i);
  const text = m ? stripTags(m[1]).replace(/^alert\b/i, "").trim() : "";
  const blob = text.toLowerCase();
  if (blob.includes("captcha")) return { status: 401, type: "WRONG_CAPTCHA", message: text };
  if (blob.includes("locked")) return { status: 403, type: "ACCOUNT_LOCKED", message: text };
  if (blob.includes("invalid") || blob.includes("attempts remaining") || blob.includes("unsuccessful"))
    return { status: 401, type: "INVALID_CREDENTIALS", message: text };
  return { status: 401, type: "LOGIN_FAILED", message: text || "login failed" };
}

async function fetchCaptchaState() {
  const jar = makeJar();
  const createdAt = Date.now();
  const { res } = await request(jar, LOGIN_PAGE);
  const page = parseLoginPage(await res.text());
  if (!page.nonce || !page.captchaPath) return { error: "captcha unavailable" };
  const curl = new URL(page.captchaPath, "https://sp.srmist.edu.in").toString();
  const img = await request(jar, curl, {
    headers: {
      "X-Domain-Proof": b64(`${page.nonce}:${HOST}`),
      Accept: "image/png, image/jpeg, image/svg+xml, image/*",
      Referer: LOGIN_PAGE,
    },
  });
  const buf = new Uint8Array(await img.res.arrayBuffer());
  const mime = (img.res.headers.get("content-type") || "image/png").split(";")[0].trim();
  if (!/^image\//i.test(mime)) throw new Error(`captcha endpoint returned "${mime}" instead of an image`);
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192)
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const state = {
    cookies: jar.object(),
    nonce: page.nonce,
    dField: page.dField,
    cField: page.cField,
    delim: page.delim,
    fields: page.fields,
    createdAt,
  };
  return { jar, page, state, image: `data:${mime};base64,${btoa(bin)}` };
}

async function handleCaptcha() {
  let cap;
  try {
    cap = await fetchCaptchaState();
  } catch (e) {
    return json({ detail: `captcha fetch failed: ${String((e && e.message) || e).slice(0, 200)}` }, 502);
  }
  if (cap.error) return json({ detail: "captcha unavailable" }, 503);
  return json({ success: true, cdigest: b64url(JSON.stringify(cap.state)), image: cap.image });
}

/**
 * Solve a captcha image with the GLM-OCR Space (zai-org/GLM-OCR).
 * Uses the HF_TOKEN secret so the call is billed to that token owner's ZeroGPU quota
 * instead of the Space owner's shared quota.
 */
async function ocrCaptcha(env, imageDataUrl) {
  const headers = { "content-type": "application/json" };
  const token = env && env.HF_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(OCR_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ image: imageDataUrl, prompt: "Text Recognition:", max_new_tokens: 24 }),
    signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let hint = "";
    if (res.status === 429) {
      hint = token
        ? " ZeroGPU quota exhausted - the HF_TOKEN owner is out of daily GPU time."
        : " No HF_TOKEN secret is set, so the call fell back to the Space owner's shared quota.";
    }
    throw new Error(`GLM-OCR Space returned ${res.status}.${hint} ${body.slice(0, 200)}`.trim());
  }
  const data = await res.json();
  const text = String((data && data.text) ?? "")
    .split("\n")[0]
    .replace(/\s+/g, "");
  if (!text) throw new Error("GLM-OCR returned no text for the captcha image");
  return text;
}

/**
 * Fetch a portal captcha and solve it with GLM-OCR.
 * A fresh captcha is pulled for every attempt, so retries never consume a portal
 * login attempt — only the single final submission does.
 */
async function solveCaptchaWithOcr(env) {
  let ocrError = null;
  for (let attempt = 1; attempt <= OCR_ATTEMPTS; attempt++) {
    let cap;
    try {
      cap = await fetchCaptchaState();
    } catch (e) {
      throw Object.assign(new Error(`Could not fetch the portal captcha: ${String((e && e.message) || e).slice(0, 200)}`), {
        type: "CAPTCHA_FETCH_FAILED",
      });
    }
    if (cap.error) {
      throw Object.assign(new Error("The portal did not expose a captcha image."), { type: "CAPTCHA_UNAVAILABLE" });
    }
    try {
      const text = await ocrCaptcha(env, cap.image);
      if (PLAUSIBLE_CAPTCHA.test(text) || attempt === OCR_ATTEMPTS) return { text, state: cap.state };
      ocrError = new Error(`OCR returned an implausible captcha: "${text}"`);
    } catch (e) {
      ocrError = e;
      if (attempt === OCR_ATTEMPTS) break;
    }
  }
  throw Object.assign(ocrError || new Error("captcha OCR failed"), { type: "OCR_FAILED" });
}

async function handleLogin(body, env) {
  const netid = (body.username || body.netid || "").trim().split("@")[0];
  if (!netid || !body.password) return json({ detail: "missing fields" }, 400);

  let st;
  let captchaAnswer = (body.captcha || "").trim();

  if (captchaAnswer) {
    // Explicit path: caller solved the captcha and sent the captcha state back.
    const blob = body.state || body.cdigest || "";
    try {
      st = JSON.parse(unb64url(blob));
      if (!st || typeof st !== "object" || !st.cookies) throw new Error("bad shape");
    } catch {
      return json(
        {
          detail: {
            type: "BAD_STATE",
            message: "State is corrupted or truncated — GET /captcha fresh and send the full cdigest untouched.",
          },
        },
        400,
      );
    }
  } else {
    // Self-service path: fetch a fresh captcha from the portal and solve it with GLM-OCR.
    let solved;
    try {
      solved = await solveCaptchaWithOcr(env);
    } catch (e) {
      const type = (e && e.type) || "OCR_FAILED";
      const status = type === "CAPTCHA_UNAVAILABLE" ? 503 : 502;
      return json(
        {
          detail: {
            type,
            message: `Captcha solving failed: ${String((e && e.message) || e).slice(0, 300)}`,
          },
        },
        status,
      );
    }
    st = solved.state;
    captchaAnswer = solved.text;
  }

  const jar = makeJar(st.cookies);
  const elapsed = Math.max(3 + Math.floor(Math.random() * 3), Math.floor((Date.now() - st.createdAt) / 1000));
  const payload = {};
  for (const n of st.fields) payload[n] = "";
  payload.username = netid;
  payload.password = body.password;
  payload.captcha = captchaAnswer;
  payload.fpPayload = "";
  payload.fpToken = "";
  payload.recaptchaToken = "";
  payload.telemetryPayload = b64(JSON.stringify(forgedTelemetry(st.createdAt, captchaAnswer.length)));
  payload[st.dField] = b64(HOST.split("").reverse().join(""));
  payload[st.cField] = b64(`${elapsed}${st.delim}3`);

  const started = Date.now();
  let post = await postForm(jar, LOGIN_SERVLET, payload, {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  });
  let loginUrl = post.url;
  let loginBody = await post.res.text();
  if (/theGR8LoginLoader/i.test(loginBody)) {
    const f = await followLoaders(jar, loginUrl, loginBody);
    loginUrl = f.url;
    loginBody = f.body;
  }

  const data = await fetchPortalData(jar);
  if (data) {
    const { attendance, marks } = data;
    return json({
      success: true,
      source: "sp",
      ms: Date.now() - started,
      attendance,
      marks,
      session: { cookies: jar.object() },
    });
  }
  const f = classify(loginBody);
  return json({ detail: { type: f.type, message: f.message }, jar: jar.names() }, f.status);
}

async function fetchPortalData(jar) {
  const [a, m] = await Promise.all([
    request(jar, ATT_URL).then(async (r) => {
      let url = r.url,
        body = await r.res.text();
      if (/theGR8LoginLoader/i.test(body)) ({ url, body } = await followLoaders(jar, url, body));
      return { url, body };
    }),
    request(jar, MARKS_URL).then(async (r) => {
      let url = r.url,
        body = await r.res.text();
      if (/theGR8LoginLoader/i.test(body)) ({ url, body } = await followLoaders(jar, url, body));
      return { url, body };
    }),
  ]);
  if (loggedOut(a.url, a.body) || loggedOut(m.url, m.body)) return null;
  const attendance = parseAttendance(a.body);
  const subjects = parseMarksOuter(m.body);
  const assess = new Map();
  await Promise.all(
    subjects
      .filter((s) => s.subjectId)
      .map(async (s) => {
        try {
          const r = await postForm(jar, INNER_URL, { iden: "1", hdnSubjectId: s.subjectId, status: s.status });
          if (r.res.status === 200) assess.set(s.courseCode, parseMarksInner(await r.res.text()));
        } catch { }
      }),
  );
  const marks = subjects.map((s) => ({
    courseCode: s.courseCode,
    courseType: "Internal",
    summary: s.got !== null ? `${s.got}/${s.max}` : "N/A",
    assessments: assess.get(s.courseCode) ?? [],
    totalMarksObtained: s.got,
    totalMarksMaximum: s.max,
  }));
  const markCodes = new Set(marks.map((x) => x.courseCode.trim().toLowerCase()));
  for (const c of attendance) {
    if (!markCodes.has(c.courseCode.trim().toLowerCase())) {
      marks.push({
        courseCode: c.courseCode,
        courseType: "Internal",
        summary: "N/A",
        assessments: [],
        totalMarksObtained: null,
        totalMarksMaximum: null,
      });
    }
  }
  return { attendance, marks };
}

async function handleRefresh(body) {
  const cookies = body.cookies;
  if (!cookies || Object.keys(cookies).length === 0) {
    return json(
      { detail: { type: "SESSION_EXPIRED", message: "Student Portal session expired. Log in again." } },
      401,
    );
  }
  const jar = makeJar(cookies);
  const data = await fetchPortalData(jar);
  if (!data) {
    return json(
      { detail: { type: "SESSION_EXPIRED", message: "Student Portal session expired. Log in again." } },
      401,
    );
  }
  return json({
    success: true,
    source: "sp",
    attendance: data.attendance,
    marks: data.marks,
    session: { cookies: jar.object() },
  });
}

async function handleDiag(req) {
  const serverTime = new Date().toISOString();
  let egressIp = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    egressIp = (await r.json()).ip ?? null;
  } catch { }
  const jar = makeJar();
  const t0 = Date.now();
  let portalDate = null,
    bytes = null,
    err = null;
  try {
    const { res } = await request(jar, LOGIN_PAGE);
    portalDate = res.headers.get("date");
    bytes = (await res.text()).length;
  } catch (e) {
    err = String(e).slice(0, 200);
  }
  return json({
    success: true,
    serverTime,
    portalDate,
    skewMs: portalDate ? Date.now() - Date.parse(portalDate) : null,
    egressIp,
    colo: req.cf ? req.cf.colo : null,
    portalLatencyMs: err ? null : Date.now() - t0,
    loginPageBytes: bytes,
    cookiesIssued: jar.names(),
    portalError: err,
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    url.pathname = url.pathname.replace(/^\/sp(?=\/|$)/, "");
    try {
      if (req.method === "GET" && url.pathname === "/captcha") return await handleCaptcha();
      if (req.method === "GET" && url.pathname === "/diag") return await handleDiag(req);
      if (req.method === "POST" && url.pathname === "/login") return await handleLogin(await req.json(), env);
      if (req.method === "POST" && url.pathname === "/refresh")
        return await handleRefresh(await req.json());
      if (req.method === "GET" && url.pathname === "/")
        return json({
          ok: true,
          routes: [
            "GET /captcha",
            "POST /login (username+password — captcha solved by GLM-OCR)",
            "POST /login (username+password+captcha+cdigest — caller solves it)",
            "POST /refresh",
            "GET /diag",
          ],
        });
      return json({ detail: "not found" }, 404);
    } catch (e) {
      return json({ detail: String((e && e.message) || e).slice(0, 300) }, 500);
    }
  },
};
