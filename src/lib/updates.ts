import type { AttendanceRecord, MarkRecord } from "@/lib/api";
import { attendanceMargin } from "@/components/dashboard/utils";
import { loadSession, saveSession } from "@/lib/storage";
import type { StoredDashData } from "@/lib/storage";

export type UpdateKind = "attendance" | "marks";

export interface UpdateEntry {
  id: string;
  kind: UpdateKind;
  courseCode: string;
  courseTitle: string;
  field: "margin" | "total";
  before: string | number | null;
  after: string | number | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let current: UpdateEntry[] = [];
let resolved = false;

function emit(): void {
  listeners.forEach((l) => l());
}

export function subscribeUpdates(cb: Listener): () => void {
  listeners.add(cb);
  cb();
  return () => {
    listeners.delete(cb);
  };
}

export function getUpdates(): UpdateEntry[] {
  return current;
}

export function dismissUpdates(): void {
  current = [];
  emit();
}

function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function diffAttendance(
  prev: AttendanceRecord[],
  next: AttendanceRecord[]
): UpdateEntry[] {
  const entries: UpdateEntry[] = [];
  const nextByCode = new Map(next.map((r) => [r.courseCode, r]));
  const prevByCode = new Map(prev.map((r) => [r.courseCode, r]));

  for (const [code, neu] of nextByCode) {
    const old = prevByCode.get(code);
    if (!old) continue;

    const oldMargin = attendanceMargin(old.classesConducted, old.classesAbsent);
    const newMargin = attendanceMargin(neu.classesConducted, neu.classesAbsent);
    if (oldMargin !== newMargin) {
      entries.push({
        id: id(),
        kind: "attendance",
        courseCode: code,
        courseTitle: neu.courseTitle,
        field: "margin",
        before: oldMargin,
        after: newMargin,
      });
    }
  }

  return entries;
}

function formatTotal(obtained: number | null, max: number | null): string | null {
  if (obtained === null || max === null) return null;
  return `${obtained}/${max}`;
}

function diffMarks(prev: MarkRecord[], next: MarkRecord[]): UpdateEntry[] {
  const entries: UpdateEntry[] = [];
  const nextByCode = new Map(next.map((r) => [r.courseCode, r]));
  const prevByCode = new Map(prev.map((r) => [r.courseCode, r]));

  for (const [code, neu] of nextByCode) {
    const old = prevByCode.get(code);
    if (!old) continue;

    const before = formatTotal(old.totalMarksObtained, old.totalMarksMaximum);
    const after = formatTotal(neu.totalMarksObtained, neu.totalMarksMaximum);
    if (before !== after) {
      entries.push({
        id: id(),
        kind: "marks",
        courseCode: code,
        courseTitle: neu.summary || code,
        field: "total",
        before,
        after,
      });
    }
  }

  return entries;
}

function diffData(prev: StoredDashData, next: StoredDashData): UpdateEntry[] {
  console.log("Diffing data");
  console.log(prev.attendance);
  console.log(next.attendance);
  return [
    ...diffAttendance(
      (prev.attendance as AttendanceRecord[]) ?? [],
      (next.attendance as AttendanceRecord[]) ?? []
    ),
    ...diffMarks(
      (prev.marks as MarkRecord[]) ?? [],
      (next.marks as MarkRecord[]) ?? []
    ),
  ];
}

/**
 * Called whenever a full refresh delivers fresh data (launch + manual refresh).
 * - First run (feature just shipped): seeds the baseline silently.
 * - First call of a session: diffs fresh data against the stored baseline and
 *   surfaces the result in the updates modal.
 * - Later calls in the same session: only advance the baseline silently so
 *   already-visible changes are never re-reported.
 */
export function processLaunchUpdates(fresh: StoredDashData): void {
  if (typeof window === "undefined") return;
  console.log("Processing launch updates");
  const stored = loadSession();
  if (!stored) return;

  const prev = stored.dash;
  if (!prev || !prev.updatesSeeded) {
    saveSession({ ...stored, dash: { ...fresh, updatesSeeded: true } });
    current = [];
    resolved = true;
    emit();
    return;
  }

  if (!resolved) {
    current = diffData(prev, fresh);
    resolved = true;
  }

  saveSession({ ...stored, dash: { ...fresh, updatesSeeded: true } });
  emit();
}
