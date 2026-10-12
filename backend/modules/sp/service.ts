import * as cheerio from "cheerio";
import { HttpError } from "../../shared/errors";
import { SpSession } from "../../shared/sp-session";
import {
  SP_ATTENDANCE_URL,
  SP_HOST,
  SP_INNER_MARKS_URL,
  SP_LOGIN_SERVLET,
  SP_LOGIN_URL,
  SP_MARKS_URL,
  SP_NAV_HEADERS,
  SP_USER_AGENT,
} from "../../shared/sp-config";
import { SpAttendanceParser } from "../../shared/parsers/sp-attendance-parser";
import { SpMarksParser } from "../../shared/parsers/sp-marks-parser";
import type { MarkAssessment } from "../../types";

const SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 50;

interface SpLoginSession {
  session: SpSession;
  nonce: string;
  domainFieldName: string;
  captchaFieldName: string;
  randomDelimiter: string;
  fieldNames: string[];
  createdAt: number;
}

const loginSessions = new Map<string, SpLoginSession>();

function randomHex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function b64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

function pruneSessions(): void {
  const now = Date.now();
  for (const [key, entry] of loginSessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) loginSessions.delete(key);
  }
  while (loginSessions.size > MAX_SESSIONS) {
    const oldest = loginSessions.keys().next().value;
    if (oldest === undefined) break;
    loginSessions.delete(oldest);
  }
}

function extractFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

interface LoginPageData {
  nonce: string;
  domainFieldName: string;
  captchaFieldName: string;
  randomDelimiter: string;
  captchaPath: string | null;
  fieldNames: string[];
}

function parseLoginPage(html: string): LoginPageData {
  const nonce =
    extractFirst(html, [
      /nonce\s*:\s*'([^']+)'/,
      /SECURE_CONFIG\.nonce\s*=\s*'([^']+)'/,
      /id="fpNonce"\s*value="([^"]+)"/,
    ]) ?? "";
  const domainFieldName =
    extractFirst(html, [/domainFieldName\s*=\s*['"]([^'"]+)['"]/]) ?? "dtoken_x";
  const captchaFieldName =
    extractFirst(html, [/captchaFieldName\s*=\s*['"]([^'"]+)['"]/]) ?? "cptoken_x";
  const randomDelimiter =
    extractFirst(html, [/randomDelimiter\s*=\s*'([^']+)'/]) ?? "0000";

  const $ = cheerio.load(html);
  const rawSrc = $("#secure_captcha").attr("data-src") ?? null;
  const captchaPath = rawSrc ? rawSrc.replace(/&amp;/g, "&") : null;

  const fieldNames = $("input[name]")
    .toArray()
    .map((el) => $(el).attr("name"))
    .filter((name): name is string => Boolean(name));

  return { nonce, domainFieldName, captchaFieldName, randomDelimiter, captchaPath, fieldNames };
}

function forgedTelemetry(input: {
  userAgent: string;
  nonce: string;
  sessionStart: number;
  captchaLen: number;
}): Record<string, unknown> {
  const now = Date.now();
  const start = input.sessionStart;
  const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
  return {
    startTime: start,
    currentDomain: SP_HOST,
    timezoneOffset: -330,
    screenWidth: 1536,
    screenHeight: 864,
    colorDepth: 24,
    devicePixelRatio: 1.25,
    platform: "Win32",
    userAgent: input.userAgent,
    language: "en-US",
    hardwareConcurrency: 12,
    deviceMemory: 8,
    touchSupport: false,
    webdriver: false,
    // Plausible for a user who typed netid + password + captcha.
    mouseClicks: rand(8, 25),
    mouseMovements: rand(60, 140),
    keystrokeCount: input.captchaLen + rand(8, 20),
    typingSpeedMs: rand(800, 2500),
    canvasHash: `-${randomHex(7)}`,
    submitTime: now,
    timeOnPageMs: Math.max(0, now - start),
  };
}

function pageTitle(body: string): string {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

const NO_COLOR = process.env.NO_COLOR === "1" || process.env.NO_COLOR === "true";

function spLog(...args: unknown[]): void {
  if (process.env.SP_DEBUG === "0") return;
  if (NO_COLOR) {
    console.log("[sp]", ...args);
    return;
  }
  console.log("\x1b[36m[sp]\x1b[0m", ...args);
}

function spErr(...args: unknown[]): void {
  if (process.env.SP_DEBUG === "0") return;
  if (NO_COLOR) {
    console.error("[sp]", ...args);
    return;
  }
  console.error("\x1b[31m[sp]\x1b[0m", ...args);
}

function spDump(step: string, body: string): void {
  if (process.env.SP_DEBUG !== "body") return;
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "temp", "sp-debug");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${Date.now()}-${step}.html`), body);
  } catch {
    // Debug dumps must never break the flow.
  }
}

function fingerprint(body: string): string {
  const low = body.toLowerCase();
  const marks = [
    "alert-icon-content",
    "alert-danger",
    "invalid",
    "captcha",
    "thegr8loginloader",
    "loginform",
    "youlogin",
    "hrdsystem",
    "logout",
    "attendance",
    "internal mark",
    "terminate",
    "expire",
    "session",
  ];
  const hits = marks.filter((m) => low.includes(m));
  return `len=${body.length} title=${JSON.stringify(pageTitle(body))} markers=[${hits.join(",")}]`;
}

function isLoggedOut(url: string, body: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerBody = body.toLowerCase();
  return (
    lowerUrl.includes("youlogin") ||
    lowerBody.includes("thegr8loginloader") ||
    lowerBody.includes("loginform") ||
    lowerBody.includes('id="login_form"')
  );
}

/**
 * The portal chains JS auto-submit loader forms (`.theGR8LoginLoader` posting to
 * youLogin.jsp) that a browser runs automatically. Emulate them: POST the empty
 * form to the loader target until a real page (or the login form) comes back.
 */
async function followLoaders(
  session: SpSession,
  url: string,
  body: string,
): Promise<{ url: string; body: string }> {
  let currentUrl = url;
  let currentBody = body;
  for (let hop = 0; hop < 5; hop++) {
    if (!/theGR8LoginLoader/i.test(currentBody)) break;
    const target = new URL("../../students/loginManager/youLogin.jsp", currentUrl).toString();
    let res: Response;
    try {
      res = await session.postForm(target, {});
    } catch {
      break;
    }
    currentUrl = res.url;
    currentBody = await res.text();
  }
  return { url: currentUrl, body: currentBody };
}

function classifyLoginFailure(body: string): {
  status: number;
  type: string;
  message: string;
  alertHtml: string;
} {
  const $ = cheerio.load(body);
  const alertEl = $(".alert-icon-content").first().length
    ? $(".alert-icon-content").first()
    : $(".alert-danger").first();
  // Raw alert markup (first 500 chars) — error banners carry no PII, invaluable for debugging.
  const alertHtml = alertEl.length
    ? (alertEl.html() ?? "").replace(/\s+/g, " ").trim().slice(0, 500)
    : "";
  let alertText = alertEl.length ? alertEl.text().replace(/\s+/g, " ").trim() : "";
  if (/^alert\b/i.test(alertText)) alertText = alertText.slice(5).trim();
  const blob = alertText.toLowerCase();
  const base = { alertHtml };

  if (blob.includes("invalid captcha") || (blob.includes("captcha") && blob.length > 0)) {
    return { status: 401, type: "WRONG_CAPTCHA", message: alertText || "Invalid captcha.", ...base };
  }
  if (blob.includes("locked")) {
    return { status: 403, type: "ACCOUNT_LOCKED", message: alertText, ...base };
  }
  if (
    blob.includes("invalid login credentials") ||
    blob.includes("attempts remaining") ||
    blob.includes("invalid") ||
    blob.includes("unsuccessful") ||
    blob.includes("user id or password")
  ) {
    return { status: 401, type: "INVALID_CREDENTIALS", message: alertText, ...base };
  }
  return { status: 401, type: "LOGIN_FAILED", message: alertText || "Student Portal login failed.", ...base };
}

async function fetchCaptchaImage(
  session: SpSession,
  page: LoginPageData,
  nonce: string,
): Promise<{ image: string; contentType: string }> {
  if (!page.captchaPath) throw new HttpError(503, "Student Portal captcha is unavailable right now.");
  const captchaUrl = new URL(page.captchaPath, "https://sp.srmist.edu.in").toString();
  const { contentType, bytes } = await session.getBytes(captchaUrl, {
    "X-Domain-Proof": b64(`${nonce}:${SP_HOST}`),
    Accept: "image/png, image/jpeg, image/svg+xml, image/*",
    Referer: SP_LOGIN_URL,
  });
  const mime = contentType.split(";")[0].trim() || "image/png";
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  return { image: dataUrl, contentType: mime };
}

export async function spCaptcha(): Promise<{ cdigest: string; image: string }> {
  pruneSessions();
  const session = new SpSession();
  let pageHtml: string;
  try {
    const res = await session.get(SP_LOGIN_URL);
    pageHtml = await res.text();
  } catch {
    throw new HttpError(503, "Student Portal is unreachable right now.");
  }
  const page = parseLoginPage(pageHtml);
  if (!page.nonce || !page.captchaPath) {
    throw new HttpError(503, "Student Portal captcha is unavailable right now.");
  }
  let image: string;
  try {
    ({ image } = await fetchCaptchaImage(session, page, page.nonce));
  } catch {
    throw new HttpError(503, "Student Portal captcha is unavailable right now.");
  }
  const sid = `${Date.now().toString(36)}${randomHex(8)}`;
  loginSessions.set(sid, {
    session,
    nonce: page.nonce,
    domainFieldName: page.domainFieldName,
    captchaFieldName: page.captchaFieldName,
    randomDelimiter: page.randomDelimiter,
    fieldNames: page.fieldNames,
    createdAt: Date.now(),
  });
  pruneSessions();
  return { cdigest: sid, image };
}

export interface SpLoginInput {
  netid?: string;
  username?: string;
  password: string;
  captcha: string;
  cdigest: string;
}

async function fetchPortalData(session: SpSession) {
  const [attRes, marksRes] = await Promise.all([
    session.get(SP_ATTENDANCE_URL),
    session.get(SP_MARKS_URL),
  ]);
  let attUrl = attRes.url;
  let marksUrl = marksRes.url;
  let [attHtml, marksHtml] = await Promise.all([attRes.text(), marksRes.text()]);

  if (/theGR8LoginLoader/i.test(attHtml)) {
    ({ url: attUrl, body: attHtml } = await followLoaders(session, attUrl, attHtml));
  }
  if (/theGR8LoginLoader/i.test(marksHtml)) {
    ({ url: marksUrl, body: marksHtml } = await followLoaders(session, marksUrl, marksHtml));
  }

  const attLoggedOut = isLoggedOut(attUrl, attHtml);
  const marksLoggedOut = isLoggedOut(marksUrl, marksHtml);
  if (attLoggedOut || marksLoggedOut) return null;

  const attendance = SpAttendanceParser.extract(attHtml);
  const subjects = SpMarksParser.extractOuter(marksHtml);

  const assessmentsByCode = new Map<string, MarkAssessment[]>();
  await Promise.all(
    subjects
      .filter((s) => s.subjectId)
      .map(async (subject) => {
        try {
          const innerRes = await session.postForm(SP_INNER_MARKS_URL, {
            iden: "1",
            hdnSubjectId: subject.subjectId as string,
            status: subject.status,
          });
          if (innerRes.status === 200) {
            assessmentsByCode.set(subject.courseCode, SpMarksParser.extractInner(await innerRes.text()));
          }
        } catch {
          // Leave assessments empty for this subject on network failure.
        }
      }),
  );

  const marks = SpMarksParser.toMarkRecords(subjects, assessmentsByCode);

  // Courses present in attendance but missing from marks get an N/A row (same as before).
  const markCodes = new Set(marks.map((m) => m.courseCode.trim().toLowerCase()));
  for (const course of attendance) {
    if (!markCodes.has(course.courseCode.trim().toLowerCase())) {
      marks.push({
        courseCode: course.courseCode,
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

export async function spLogin(input: SpLoginInput) {
  const netid = (input.netid ?? input.username ?? "").trim().split("@")[0];
  if (!netid || !input.password || !input.captcha) {
    throw new HttpError(400, "netid, password and captcha are required");
  }
  pruneSessions();
  const cached = loginSessions.get(input.cdigest);
  if (!cached) {
    throw new HttpError(401, {
      type: "CAPTCHA_REQUIRED",
      message: "Captcha expired. Fetch a new captcha and try again.",
    });
  }
  loginSessions.delete(input.cdigest);

  const { session, nonce, domainFieldName, captchaFieldName, randomDelimiter, fieldNames, createdAt } = cached;
  const elapsedSec = Math.max(
    3 + Math.floor(Math.random() * 3),
    Math.max(0, Math.floor((Date.now() - createdAt) / 1000)),
  );

  const userAgent = SP_USER_AGENT;
  const payload: Record<string, string> = {};
  for (const name of fieldNames) payload[name] = "";
  payload.username = netid;
  payload.password = input.password;
  payload.captcha = input.captcha;
  // Proven by a captured working browser login: fpPayload goes out EMPTY.
  // A filled fpPayload (stale nonce/ts) is treated as tampering and bounced silently.
  payload.fpPayload = "";
  payload.fpToken = "";
  payload.recaptchaToken = "";
  payload.telemetryPayload = b64(
    JSON.stringify(
      forgedTelemetry({
        userAgent,
        nonce,
        sessionStart: createdAt,
        captchaLen: input.captcha.trim().length,
      }),
    ),
  );
  payload[domainFieldName] = b64(SP_HOST.split("").reverse().join(""));
  payload[captchaFieldName] = b64(`${elapsedSec}${randomDelimiter}3`);

  let loginBody = "";
  let loginFinalUrl = "";
  let loginStatus = 0;
  spLog(`login POST -> jar before=[${session.cookieNames().join(",")}] fields=[${Object.keys(payload).join(",")}]`);
  try {
    const loginRes = await session.postForm(SP_LOGIN_SERVLET, payload, SP_NAV_HEADERS);
    loginStatus = loginRes.status;
    loginFinalUrl = loginRes.url;
    loginBody = await loginRes.text();
  } catch {
    throw new HttpError(503, "Student Portal is unreachable right now.");
  }

  if (/theGR8LoginLoader/i.test(loginBody)) {
    const followed = await followLoaders(session, loginFinalUrl, loginBody);
    loginFinalUrl = followed.url;
    loginBody = followed.body;
  }

  let data: { attendance: unknown[]; marks: unknown[] } | null = null;
  try {
    data = await fetchPortalData(session);
  } catch {
    throw new HttpError(503, "Student Portal is unreachable right now.");
  }

  if (!data) {
    const failure = classifyLoginFailure(loginBody);
    // Forward the portal's own error text when present; otherwise describe what came back
    // so the frontend shows something actionable instead of a generic failure.
    const message =
      failure.type === "LOGIN_FAILED"
        ? `Student Portal login failed (portal returned "${pageTitle(loginBody) || "an unknown page"}"). Check your NetID/password and try a fresh captcha.`
        : failure.message;
    spErr(`login failed -> type=${failure.type} message=${JSON.stringify(message)}`);
    spErr(`login failed -> page ${fingerprint(loginBody)} alert=${JSON.stringify(failure.alertHtml)}`);
    throw new HttpError(failure.status, { type: failure.type, message });  }
  spLog(`login ok -> attendance=${data.attendance.length} marks=${data.marks.length}`);
  return {
    success: true,
    source: "sp",
    attendance: data.attendance,
    marks: data.marks,
    session: { cookies: session.getCookieObject() },
  };
}

export async function spRefresh(cookies?: Record<string, string>) {
  if (!cookies || Object.keys(cookies).length === 0) {
    throw new HttpError(401, {
      type: "SESSION_EXPIRED",
      message: "Student Portal session expired. Log in again.",
    });
  }
  const session = new SpSession(cookies);
  let data: { attendance: unknown[]; marks: unknown[] } | null = null;
  try {
    data = await fetchPortalData(session);
  } catch {
    throw new HttpError(503, "Student Portal is unreachable right now.");
  }
  if (!data) {
    throw new HttpError(401, {
      type: "SESSION_EXPIRED",
      message: "Student Portal session expired. Log in again.",
    });
  }
  return {
    success: true,
    source: "sp",
    attendance: data.attendance,
    marks: data.marks,
    session: { cookies: session.getCookieObject() },
  };
}
