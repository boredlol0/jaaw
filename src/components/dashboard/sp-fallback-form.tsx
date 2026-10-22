"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiSpCaptcha,
  apiSpLogin,
  apiSpRefresh,
  type AttendanceRecord,
  type MarkRecord,
} from "@/lib/api";
import { decodeLocal, encodeLocal, loadSession, updateDashSection } from "@/lib/storage";
import { QK } from "@/lib/queries";

const SP_KEY = "jaaw_sp";

interface SpStored {
  cookies?: Record<string, string>;
  netid?: string;
  password?: string;
  cachedAt?: number;
}

function loadSp(): SpStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SpStored;
  } catch {
    return null;
  }
}

function saveSp(patch: Partial<SpStored>): void {
  if (typeof window === "undefined") return;
  const current = loadSp() ?? {};
  localStorage.setItem(
    SP_KEY,
    JSON.stringify({ ...current, ...patch, cachedAt: Date.now() }),
  );
}

function loadSpCookies(): Record<string, string> | null {
  const cookies = loadSp()?.cookies;
  return cookies && Object.keys(cookies).length > 0 ? cookies : null;
}

function saveSpCookies(cookies: Record<string, string>): void {
  saveSp({ cookies });
}

/** Drop only the session; stored credentials stay so they can be pre-filled. */
function clearSpCookies(): void {
  if (typeof window === "undefined") return;
  const stored = loadSp();
  if (!stored) return;
  delete stored.cookies;
  localStorage.setItem(SP_KEY, JSON.stringify(stored));
}

function loadSpCreds(): { netid: string; password: string } | null {
  const stored = loadSp();
  if (!stored?.netid) return null;
  return {
    netid: decodeLocal(stored.netid),
    password: stored.password ? decodeLocal(stored.password) : "",
  };
}

function saveSpCreds(netid: string, password: string): void {
  saveSp({ netid: encodeLocal(netid), password: encodeLocal(password) });
}

/** User-facing copy for the Student Portal login failure types the bridge returns. */
const SP_LOGIN_ERROR_COPY: Record<string, string> = {
  WRONG_CAPTCHA: "Invalid captcha. Please try again.",
  INVALID_CREDENTIALS: "Invalid credentials. Please try again.",
  OCR_FAILED: "Automatic captcha solving is unavailable right now — please enter the captcha below.",
  CAPTCHA_UNAVAILABLE: "The Student Portal did not serve a captcha — please try again.",
  CAPTCHA_FETCH_FAILED: "Could not reach the Student Portal captcha — please try again.",
  BAD_STATE: "The captcha session expired — please try again.",
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = err.detail as unknown;
    if (detail && typeof detail === "object") {
      const type = (detail as { type?: unknown }).type;
      if (typeof type === "string") {
        return SP_LOGIN_ERROR_COPY[type] ?? "Something went wrong while logging in. Please try again.";
      }
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
    if (typeof detail === "string" && detail) return detail;
    return err.message || "Something went wrong.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

const inputClass =
  "h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-[13px] font-normal normal-case tracking-normal text-[#f4f2ea] placeholder:text-[#8d8d95]/60 outline-none focus:border-[#e7a63f]/60";

export function SpFallbackForm({ kind }: { kind: "attendance" | "marks" }) {
  const queryClient = useQueryClient();
  const [captchaImg, setCaptchaImg] = useState<string | null>(null);
  const [cdigest, setCdigest] = useState<string | null>(null);
  const [netid, setNetid] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [phase, setPhase] = useState<"loading" | "refreshing" | "ready" | "submitting">("loading");
  const [error, setError] = useState<string | null>(null);
  /** Why the automatic (captcha-less) sign-in didn't work, if it was attempted. */
  const [autoError, setAutoError] = useState<string | null>(null);
  /** True while the component is mounted — guards setState after unmount. */
  const aliveRef = useRef(true);
  /** Ensures the automatic sign-in is fired at most once per mount. */
  const startedRef = useRef(false);

  async function loadCaptcha(opts?: { silent?: boolean }) {
    if (!opts?.silent) setPhase("loading");
    setError(null);
    try {
      const { data } = await apiSpCaptcha();
      if (!aliveRef.current) return;
      setCaptchaImg(data.image);
      setCdigest(data.cdigest);
      setPhase("ready");
    } catch (err) {
      if (!aliveRef.current) return;
      setError(errorMessage(err));
      setPhase("ready");
    }
  }

  useEffect(() => {
    // StrictMode remounts effects in dev, and a login POST is not idempotent —
    // a double sign-in would burn two Student Portal attempts (the portal allows
    // three). `aliveRef` is restored on the re-run so the first attempt can still
    // apply its result; `startedRef` stops a second attempt from being fired.
    aliveRef.current = true;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      // Pre-fill saved SP credentials so only the captcha has to be typed.
      const creds = loadSpCreds();
      if (creds) {
        setNetid(creds.netid);
        setPassword(creds.password);
      }

      // 1) Reuse the stored Student Portal session while it still works.
      const cookies = loadSpCookies();
      if (cookies) {
        try {
          const { data } = await apiSpRefresh(cookies);
          if (!aliveRef.current) return;
          applySpData(data.attendance, data.marks, data.session.cookies);
          // Refresh worked but portal genuinely has no rows: stay on the form
          // with a fresh captcha so the user can retry the full login.
          if (data.attendance.length === 0 && data.marks.length === 0) {
            await loadCaptcha();
          }
          return;
        } catch {
          clearSpCookies();
        }
      }
      if (!aliveRef.current) return;

      // 2) The session is gone — sign in again and let the bridge solve the captcha.
      if (creds?.netid && creds.password) {
        setPhase("refreshing");
        try {
          const { data } = await apiSpLogin({
            netid: creds.netid.trim(),
            password: creds.password,
          });
          if (!aliveRef.current) return;
          applySpData(data.attendance, data.marks, data.session.cookies);
          if (data.attendance.length === 0 && data.marks.length === 0) {
            await loadCaptcha();
          }
          return;
        } catch (err) {
          if (!aliveRef.current) return;
          setAutoError(errorMessage(err));
        }
      }

      // 3) Fall back to the manual captcha form.
      if (!aliveRef.current) return;
      await loadCaptcha();
    })();

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySpData(
    attendance: AttendanceRecord[],
    marks: MarkRecord[],
    cookies: Record<string, string>,
  ) {
    saveSpCookies(cookies);
    updateDashSection("attendance", attendance);
    updateDashSection("marks", marks);
    const username = loadSession()?.session.username ?? "none";
    queryClient.setQueryData(QK.attendance(username), attendance);
    queryClient.setQueryData(QK.marks(username), marks);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "submitting" || !cdigest) return;
    setPhase("submitting");
    setError(null);
    setAutoError(null);
    saveSpCreds(netid.trim(), password);
    try {
      const { data } = await apiSpLogin({
        netid: netid.trim(),
        password,
        captcha: captcha.trim(),
        cdigest,
      });
      applySpData(data.attendance, data.marks, data.session.cookies);
    } catch (err) {
      const msg = errorMessage(err);
      setCaptcha("");
      // Keep the form on screen while the next captcha is fetched.
      await loadCaptcha({ silent: true });
      // loadCaptcha clears the error, so restore the login failure last.
      setError(msg);
    } finally {
      setPhase("ready");
    }
  }

  if (phase === "loading" || phase === "refreshing") {
    return (
      <div className="relative z-2 rounded-[22px] border border-white/10 bg-white/4 p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7a63f]">
          Student Portal fallback
        </p>
        <h2 className="mt-3 font-[Unbounded,sans-serif] text-xl font-bold leading-snug text-[#f4f2ea]">
          {phase === "refreshing" ? "Restoring your session" : "Connecting to Student Portal"}
        </h2>
        <div className="mt-6 flex items-center gap-3">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-[#e7a63f]/25 border-t-[#e7a63f]" />
          <p className="text-[13px] leading-relaxed text-[#8d8d95]">
            {phase === "refreshing"
              ? "Your Student Portal session expired. Signing you back in and solving the captcha automatically…"
              : "Checking your Student Portal session…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-2 rounded-[22px] border border-white/10 bg-white/4 p-6 sm:p-8"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7a63f]">
        Student Portal fallback
      </p>
      <h2 className="mt-3 font-[Unbounded,sans-serif] text-xl font-bold leading-snug text-[#f4f2ea]">
        Try logging in with Student Portal
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#8d8d95]">
        {kind === "attendance"
          ? "Academia returned no attendance rows. Enter your Student Portal credentials below to fetch attendance from SP instead."
          : "Academia returned no mark rows. Enter your Student Portal credentials below to fetch marks from SP instead."}
      </p>

      {autoError && (
        <p className="mt-4 rounded-xl border border-[#e7a63f]/25 bg-[#e7a63f]/8 px-4 py-3 text-[13px] leading-relaxed text-[#e7a63f]">
          Automatic sign-in didn&apos;t work — {autoError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
          NetID
          <input
            type="text"
            name="netid"
            autoComplete="username"
            placeholder="e.g. ab1234"
            value={netid}
            onChange={(e) => setNetid(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
            Captcha
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {captchaImg ? (
              <button
                type="button"
                onClick={() => loadCaptcha()}
                title="Refresh captcha"
                className="h-11 max-w-full shrink-0 self-start overflow-hidden rounded-xl border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captchaImg} alt="Student Portal captcha" className="h-full w-auto max-w-full" />
              </button>
            ) : (
              <div className="flex h-11 shrink-0 items-center self-start rounded-xl border border-white/10 px-4 text-[12px] text-[#8d8d95]">
                Unavailable
              </div>
            )}
            <input
              type="text"
              name="captcha"
              autoComplete="off"
              placeholder="Enter captcha"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              className={`${inputClass} w-full min-w-0 sm:flex-1`}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-[13px] leading-relaxed text-[#e08080]">{error}</p>
      )}

      <button
        type="submit"
        disabled={phase !== "ready" || !cdigest}
        className="mt-6 h-11 w-full rounded-xl bg-[#e7a63f] text-[12px] font-bold uppercase tracking-[0.18em] text-[#241203] transition hover:bg-[#e7a63f]/90 disabled:opacity-40 sm:w-auto sm:px-10"
      >
        {phase === "submitting" ? "Logging in…" : "Login"}
      </button>
    </form>
  );
}
