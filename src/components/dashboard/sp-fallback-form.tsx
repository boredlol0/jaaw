"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiSpCaptcha,
  apiSpLogin,
  type AttendanceRecord,
  type MarkRecord,
} from "@/lib/api";
import { loadSession } from "@/lib/storage";
import { processSectionsUpdate } from "@/lib/updates";
import { loadSpCreds, restoreSp, saveSpCreds, saveSpCookies } from "@/lib/sp";
import { QK } from "@/lib/queries";

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
    aliveRef.current = true;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const creds = loadSpCreds();
      if (creds) {
        setNetid(creds.netid);
        setPassword(creds.password);
      }

      setPhase("loading");
      const { data: restored, error } = await restoreSp((stage) => {
        if (stage === "login" && aliveRef.current) setPhase("refreshing");
      });
      if (!aliveRef.current) return;
      if (restored) {
        applySpData(restored.attendance, restored.marks);
        if (restored.empty) await loadCaptcha();
        return;
      }
      if (error) setAutoError(errorMessage(error));
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
    cookies?: Record<string, string>,
  ) {
    if (cookies) saveSpCookies(cookies);
    processSectionsUpdate({ attendance, marks });
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
      await loadCaptcha({ silent: true });
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
