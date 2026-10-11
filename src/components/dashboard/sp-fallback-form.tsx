"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiSpCaptcha,
  apiSpLogin,
  apiSpRefresh,
  type AttendanceRecord,
  type MarkRecord,
} from "@/lib/api";
import { loadSession, updateDashSection } from "@/lib/storage";
import { QK } from "@/lib/queries";

const SP_KEY = "jaaw_sp";

function loadSpCookies(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cookies?: Record<string, string> };
    return parsed.cookies && Object.keys(parsed.cookies).length > 0 ? parsed.cookies : null;
  } catch {
    return null;
  }
}

function saveSpCookies(cookies: Record<string, string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SP_KEY, JSON.stringify({ cookies, cachedAt: Date.now() }));
}

function clearSpCookies(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SP_KEY);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = err.detail as unknown;
    if (detail && typeof detail === "object") {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
      const type = (detail as { type?: unknown }).type;
      if (typeof type === "string" && type) return type;
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
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting">("loading");
  const [error, setError] = useState<string | null>(null);

  async function loadCaptcha() {
    setPhase("loading");
    setError(null);
    try {
      const { data } = await apiSpCaptcha();
      setCaptchaImg(data.image);
      setCdigest(data.cdigest);
      setPhase("ready");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("ready");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cookies = loadSpCookies();
      if (cookies) {
        try {
          const { data } = await apiSpRefresh(cookies);
          if (cancelled) return;
          applySpData(data.attendance, data.marks, data.session.cookies);
          return;
        } catch {
          clearSpCookies();
        }
      }
      if (cancelled) return;
      await loadCaptcha();
    })();
    return () => {
      cancelled = true;
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
    try {
      const { data } = await apiSpLogin({
        netid: netid.trim(),
        password,
        captcha: captcha.trim(),
        cdigest,
      });
      applySpData(data.attendance, data.marks, data.session.cookies);
    } catch (err) {
      setError(errorMessage(err));
      setCaptcha("");
      await loadCaptcha();
    } finally {
      setPhase("ready");
    }
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
          <div className="flex items-center gap-3">
            {captchaImg ? (
              <button
                type="button"
                onClick={loadCaptcha}
                title="Refresh captcha"
                className="h-11 shrink-0 overflow-hidden rounded-xl border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captchaImg} alt="Student Portal captcha" className="h-full" />
              </button>
            ) : (
              <div className="flex h-11 shrink-0 items-center rounded-xl border border-white/10 px-4 text-[12px] text-[#8d8d95]">
                {phase === "loading" ? "Loading…" : "Unavailable"}
              </div>
            )}
            <input
              type="text"
              name="captcha"
              autoComplete="off"
              placeholder="Enter captcha"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              className={`${inputClass} flex-1`}
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
