// stateless Student Portal login probe for Cloudflare Workers.

const BASE = "https://sp.srmist.edu.in/srmiststudentportal";
const LOGIN_PAGE = `${BASE}/students/loginManager/youLogin.jsp`;
const LOGIN_SERVLET = `${BASE}/LoginServlet`;
const ATT_URL = `${BASE}/students/report/studentAttendanceDetails.jsp`;
const MARKS_URL = `${BASE}/students/report/studentInternalMarkDetails.jsp`;
const INNER_URL = `${BASE}/students/report/studentInternalMarkDetailsInner.jsp`;
const HOST = "sp.srmist.edu.in";
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
  const withIds = out.filter((_, i) => ids[i]);
  return {
    subjects: out.map((s, i) => ({ ...s, subjectId: ids[i] ? ids[i][1] : null, status: ids[i] ? ids[i][2] : "2" })),
    _count: withIds.length,
  };
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

async function handleCaptcha() {
  const jar = makeJar();
  const createdAt = Date.now();
  const { res } = await request(jar, LOGIN_PAGE);
  const page = parseLoginPage(await res.text());
  if (!page.nonce || !page.captchaPath) return json({ detail: "captcha unavailable" }, 503);
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
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192)
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const state = b64url(
    JSON.stringify({
      cookies: jar.object(),
      nonce: page.nonce,
      dField: page.dField,
      cField: page.cField,
      delim: page.delim,
      fields: page.fields,
      createdAt,
    }),
  );
  return json({ success: true, cdigest: state, image: `data:${mime};base64,${btoa(bin)}` });
}

async function handleLogin(body) {
  let st;
  try {
    st = JSON.parse(unb64url(body.state || ""));
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
  const netid = (body.username || body.netid || "").trim().split("@")[0];
  if (!netid || !body.password || !body.captcha) return json({ detail: "missing fields" }, 400);
  const jar = makeJar(st.cookies);
  const elapsed = Math.max(3 + Math.floor(Math.random() * 3), Math.floor((Date.now() - st.createdAt) / 1000));
  const payload = {};
  for (const n of st.fields) payload[n] = "";
  payload.username = netid;
  payload.password = body.password;
  payload.captcha = body.captcha;
  payload.fpPayload = "";
  payload.fpToken = "";
  payload.recaptchaToken = "";
  payload.telemetryPayload = b64(JSON.stringify(forgedTelemetry(st.createdAt, body.captcha.trim().length)));
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

  const [a, m] = await Promise.all([
    request(jar, ATT_URL).then(async (r) => ({ url: r.url, body: await r.res.text() })),
    request(jar, MARKS_URL).then(async (r) => ({ url: r.url, body: await r.res.text() })),
  ]);
  if (!loggedOut(a.url, a.body) && !loggedOut(m.url, m.body)) {
    const attendance = parseAttendance(a.body);
    const outer = parseMarksOuter(m.body);
    const assess = new Map();
    await Promise.all(
      outer.subjects
        .filter((s) => s.subjectId)
        .map(async (s) => {
          const r = await postForm(jar, INNER_URL, { iden: "1", hdnSubjectId: s.subjectId, status: s.status });
          if (r.res.status === 200) assess.set(s.courseCode, parseMarksInner(await r.res.text()));
        }),
    );
    const marks = outer.subjects.map((s) => ({
      courseCode: s.courseCode,
      courseType: "Internal",
      summary: s.got !== null ? `${s.got}/${s.max}` : "N/A",
      assessments: assess.get(s.courseCode) ?? [],
      totalMarksObtained: s.got,
      totalMarksMaximum: s.max,
    }));
    return json({
      success: true,
      ms: Date.now() - started,
      jar: jar.names(),
      attendance,
      marks,
    });
  }
  const f = classify(loginBody);
  return json({ detail: { type: f.type, message: f.message }, jar: jar.names() }, f.status);
}

async function handleDiag(req) {
  const serverTime = new Date().toISOString();
  let egressIp = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    egressIp = (await r.json()).ip ?? null;
  } catch {}
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
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (req.method === "GET" && url.pathname === "/captcha") return await handleCaptcha();
      if (req.method === "GET" && url.pathname === "/diag") return await handleDiag(req);
      if (req.method === "POST" && url.pathname === "/login") return await handleLogin(await req.json());
      if (req.method === "GET" && url.pathname === "/")
        return json({ ok: true, routes: ["GET /captcha", "POST /login", "GET /diag"] });
      return json({ detail: "not found" }, 404);
    } catch (e) {
      return json({ detail: String((e && e.message) || e).slice(0, 300) }, 500);
    }
  },
};
