import {
  apiSpLogin,
  apiSpRefresh,
  type AttendanceRecord,
  type MarkRecord,
} from "@/lib/api";
import { decodeLocal, encodeLocal } from "@/lib/storage";

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

export function loadSpCookies(): Record<string, string> | null {
  const cookies = loadSp()?.cookies;
  return cookies && Object.keys(cookies).length > 0 ? cookies : null;
}

export function saveSpCookies(cookies: Record<string, string>): void {
  saveSp({ cookies });
}

export function clearSpCookies(): void {
  if (typeof window === "undefined") return;
  const stored = loadSp();
  if (!stored) return;
  delete stored.cookies;
  localStorage.setItem(SP_KEY, JSON.stringify(stored));
}

export function loadSpCreds(): { netid: string; password: string } | null {
  const stored = loadSp();
  if (!stored?.netid) return null;
  return {
    netid: decodeLocal(stored.netid),
    password: stored.password ? decodeLocal(stored.password) : "",
  };
}

export function saveSpCreds(netid: string, password: string): void {
  saveSp({ netid: encodeLocal(netid), password: encodeLocal(password) });
}

export interface SpData {
  attendance: AttendanceRecord[];
  marks: MarkRecord[];
  /** Portal auth ok but it served no rows. */
  empty: boolean;
}

/**
 * Try to restore Student Portal data without user interaction:
 * 1. reuse stored SP cookies via /sp/refresh
 * 2. on failure, auto login with saved creds (worker solves the captcha)
 * `error` carries the failed login-stage error for caller-facing copy.
 */
export async function restoreSp(
  onStage?: (stage: "refresh" | "login") => void,
): Promise<{ data: SpData | null; error: unknown }> {
  const toSpData = (data: {
    attendance: AttendanceRecord[];
    marks: MarkRecord[];
    session: { cookies: Record<string, string> };
  }): SpData => ({
    attendance: data.attendance,
    marks: data.marks,
    empty: data.attendance.length === 0 && data.marks.length === 0,
  });

  const cookies = loadSpCookies();
  if (cookies) {
    onStage?.("refresh");
    try {
      const { data } = await apiSpRefresh(cookies);
      saveSpCookies(data.session.cookies);
      return { data: toSpData(data), error: null };
    } catch {
      clearSpCookies();
    }
  }

  const creds = loadSpCreds();
  if (creds?.netid && creds.password) {
    onStage?.("login");
    try {
      const { data } = await apiSpLogin({
        netid: creds.netid.trim(),
        password: creds.password,
      });
      saveSpCookies(data.session.cookies);
      return { data: toSpData(data), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  return { data: null, error: null };
}
