import type { StoredDashData } from "@/lib/storage";
import type {
  AttendanceRecord,
  ScheduleEntry,
  ScheduleDay,
  AcademicCalendar,
  CalendarMonth,
} from "@/lib/api";

export function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

export function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const ROMAN_NUMERAL = /^[IVXLCDM]+$/;

function titleCaseWord(word: string): string {
  return word
    .split(/([^A-Za-z]+)/)
    .map((part) => {
      if (!part || !/[A-Za-z]/.test(part)) return part;
      if (ROMAN_NUMERAL.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

/** Normalize a course title: title-case words and swap "and" -> "&" */
export function normalizeSubject(title: string): string {
  return title
    .replace(/\band\b/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .map(titleCaseWord)
    .join(" ");
}

/** Parse "HH:MM \t" style time strings from the API */
export function parseTime(raw: string): string {
  return raw.replace(/\\t/g, "").trim();
}

/** Returns minutes since midnight for a time string like "08:00" or "03:10" */
export function timeToMinutes(t: string): number {
  const clean = parseTime(t);
  const match = clean.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
  if (!match) return 0;
  let hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const meridian = (match[3] ?? "").toLowerCase();

  if (meridian === "pm" && hours < 12) hours += 12;
  else if (meridian === "am" && hours === 12) hours = 0;
  else if (!meridian && hours < 8) hours += 12;

  return hours * 60 + minutes;
}

/** Current time as minutes since midnight */
export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export type ClassStatus = "done" | "current" | "upcoming";

export function getClassStatus(entry: ScheduleEntry): ClassStatus {
  const now = nowMinutes();
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  if (now >= end) return "done";
  if (now >= start) return "current";
  return "upcoming";
}

export function getElapsedPercent(entry: ScheduleEntry): number {
  const now = nowMinutes();
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  if (now <= start) return 0;
  if (now >= end) return 100;
  const total = end - start;
  if (total <= 0) return 0;
  return ((now - start) / total) * 100;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getNowSeconds(): number {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

export function formatMarkValue(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

/** Compute overall attendance percentage weighted by classes conducted */
export function overallAttendance(records: AttendanceRecord[]): number {
  const totalConducted = records.reduce((s, r) => s + r.classesConducted, 0);
  const totalAbsent = records.reduce((s, r) => s + r.classesAbsent, 0);
  if (totalConducted === 0) {

    if (records.length === 0) return 100;
    return records.reduce((s, r) => s + r.attendancePercentage, 0) / records.length;
  }
  return ((totalConducted - totalAbsent) / totalConducted) * 100;
}

/** Check if all records are from a finished semester (no conducted/absent data) */
export function isFinishedSemester(records: AttendanceRecord[]): boolean {
  return records.length > 0 && records.every((r) => r.classesConducted === 0 && r.classesAbsent === 0);
}

/** How many more classes a student can skip and still be >= 75% (clamped to 0) */
export function canSkip(conducted: number, absent: number): number {
  const attended = conducted - absent;
  const max = Math.floor(attended / 0.75 - conducted);
  return Math.max(0, max);
}

/** How many classes a student needs to attend to reach 75% (only positive when below 75%) */
export function needToAttend(conducted: number, absent: number): number {
  const attended = conducted - absent;
  return Math.max(0, Math.ceil(3 * conducted - 4 * attended));
}

/** Attendance color class */
export function attColor(pct: number): string {
  if (pct >= 85) return "safe";
  if (pct >= 75) return "warn";
  return "danger";
}

/** Determine "today" as Day N from the calendar day-order */
export function getTodayDayOrder(calendar?: AcademicCalendar): string | null {
  if (!calendar) return null;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (const month of calendar.months) {
    for (const entry of month.entries) {
      if (entry.date === todayStr && entry.dayOrder) {
        return normalizeDayOrder(entry.dayOrder);
      }
    }
  }
  return null;
}

export function normalizeDayOrder(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  const numberMatch = cleaned.match(/\d+/);
  if (numberMatch?.[0]) return numberMatch[0];
  return cleaned;
}

export function findScheduleDayIndexByOrder(schedule: ScheduleDay[], dayOrder: string | null): number {
  const normalizedOrder = normalizeDayOrder(dayOrder);
  if (!normalizedOrder) return -1;
  return schedule.findIndex((day) => normalizeDayOrder(day.dayLabel) === normalizedOrder);
}

export function emptyProfile(): StoredDashData["profile"] {
  return {
    name: "",
    registrationNumber: "",
    batch: "",
    semester: "",
    department: "",
    section: "",
    mobileNumber: "",
    program: "",
  };
}

export function getPreferredCalendarEntry(month: CalendarMonth, todayStr: string) {
  return (
    month.entries.find((entry) => entry.date === todayStr) ??
    month.entries.find((entry) => entry.dayOrder || entry.category === "holiday" || entry.category === "event") ??
    month.entries[0] ??
    null
  );
}

/**
 * If the current class has back-to-back entries (same courseCode, gap <= 5 min),
 * returns the end time of the last consecutive entry. Otherwise returns current.endTime.
 */
export function getEffectiveEndTime(
  current: ScheduleEntry,
  allEntries: ScheduleEntry[]
): string {

  const sorted = [...allEntries].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const startIdx = sorted.findIndex(
    (e) => e.slotCode === current.slotCode && e.courseCode === current.courseCode
  );
  if (startIdx === -1) return current.endTime;

  let effectiveEnd = current.endTime;

  for (let i = startIdx + 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (next.courseCode !== current.courseCode) break;
    const gap = timeToMinutes(next.startTime) - timeToMinutes(prev.endTime);
    if (gap > 5) break;
    effectiveEnd = next.endTime;
  }

  return effectiveEnd;
}
