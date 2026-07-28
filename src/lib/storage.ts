/**
 * jaaw storage utilities
 *
 * XOR-based credential obfuscation for localStorage.
 * NOT cryptographic security — purely obscures plaintext
 * from casual inspection of DevTools / storage.
 */

const STORAGE_KEY = "jaaw_session";
const XOR_KEY = "jaaw_xk";



function xorEncode(str: string): string {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(
      str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
    );
  }

  return btoa(unescape(encodeURIComponent(out)));
}

function xorDecode(encoded: string): string {
  try {
    const str = decodeURIComponent(escape(atob(encoded)));
    let out = "";
    for (let i = 0; i < str.length; i++) {
      out += String.fromCharCode(
        str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
      );
    }
    return out;
  } catch {
    return "";
  }
}



export interface StoredSession {
  username: string;
  password: string;
  cookies: Record<string, string>;
}

export interface StoredDashData {
  profile: {
    name: string;
    registrationNumber: string;
    batch: string;
    semester: string;
    department: string;
    section: string;
    mobileNumber: string;
    program: string;
  };
  attendance: unknown[];
  marks: unknown[];
  schedule: unknown[];
  courses: unknown[];
  calendar: unknown;
  cachedAt: number;
}

export interface StoredAll {
  session: StoredSession;
  dash: StoredDashData | null;
}



/** Persist credentials + optional dash data to localStorage (XOR-obfuscated). */
export function saveSession(data: StoredAll): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, xorEncode(raw));
}

/** Read the stored session. Returns null if nothing saved or decode fails. */
export function loadSession(): StoredAll | null {
  if (typeof window === "undefined") return null;
  const encoded = localStorage.getItem(STORAGE_KEY);
  if (!encoded) return null;
  try {
    const raw = xorDecode(encoded);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAll;
  } catch {
    return null;
  }
}

/** Update only the dash portion of the stored session. */
export function updateDashData(dash: StoredDashData): void {
  const existing = loadSession();
  if (!existing) return;
  saveSession({ ...existing, dash });
}

/** Clear the session (logout). */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Quick check: is there a valid session? */
export function hasSession(): boolean {
  return loadSession() !== null;
}
