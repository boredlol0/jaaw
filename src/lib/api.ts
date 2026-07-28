/**
 * jaaw API client
 *
 * Supports a primary API URL with optional fallback URLs.
 * If the primary returns a non-ok response or throws, it tries each fallback
 * in order. This makes adding backup API servers trivial in the future.
 */

import { getApiUrl } from "./utils";

/** A resolved API response — data is typed at the call site */
export interface ApiResult<T = unknown> {
  data: T;
  url: string;
}

/** All routes that accept credentials body */
export type CredentialRoute =
  | "/login"
  | "/refresh"
  | "/attendance"
  | "/attendence"
  | "/marks"
  | "/profile"
  | "/courses"
  | "/schedule"
  | "/calendar";

interface CredentialsPayload {
  username: string;
  password: string;
  cookies?: Record<string, string>;
  captcha?: string;
  cdigest?: string;
  date?: string;
}

let cachedApiUrls: string[] | null = null;

async function getApiUrls(): Promise<string[]> {
  if (cachedApiUrls) return cachedApiUrls;

  const isProduction =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("pages.dev") ||
      window.location.hostname.includes("vercel.app"));

  if (!isProduction) {
    cachedApiUrls = ["http://192.168.1.17:4000"];
    return cachedApiUrls;
  }

  const res = await fetch("https://pub-7af38719b2fc4730b935ec70c74b8a0c.r2.dev/config.json");
  const data = await res.json();
  cachedApiUrls = data.apiServers;
  return cachedApiUrls!;
}

/**
 * Core fetch wrapper that tries each API URL in order.
 * Throws on total failure (all URLs exhausted).
 */
async function apiFetch<T>(
  route: string,
  payload: CredentialsPayload
): Promise<ApiResult<T>> {
  const urls = await getApiUrls();
  let lastError: unknown;

  for (const baseUrl of urls) {
    const url = `${baseUrl}${route}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });




      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = (body as { detail?: string }).detail ?? `HTTP ${res.status}`;


        if (res.status === 400 || res.status === 401 || res.status === 422) {
          throw new ApiError(res.status, detail, url);
        }


        lastError = new ApiError(res.status, detail, url);
        continue;
      }

      const data = (await res.json()) as T;
      return { data, url };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err;

    }
  }


  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(
    503,
    "All API servers are unreachable. Please check your connection.",
    urls[0]
  );
}

/** Typed error thrown by the API client */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly url: string
  ) {
    super(detail);
    this.name = "ApiError";
  }
}



export interface LoginResponse {
  success: boolean;
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
  attendance: AttendanceRecord[];
  marks: MarkRecord[];
  schedule: ScheduleDay[];
  courses: CourseCatalogEntry[];
  calendar: AcademicCalendar;
  session: { cookies: Record<string, string> };
}

export interface RefreshResponse {
  success: boolean;
  attendance: AttendanceRecord[];
  marks: MarkRecord[];
  courses: CourseCatalogEntry[];
  schedule: ScheduleDay[];
  calendar: AcademicCalendar;
  session: { cookies: Record<string, string> };
}

export interface AttendanceResponse {
  success: boolean;
  attendance: AttendanceRecord[];
  session: { cookies: Record<string, string> };
}

export interface MarksResponse {
  success: boolean;
  marks: MarkRecord[];
  session: { cookies: Record<string, string> };
}

export interface ProfileResponse {
  success: boolean;
  profile: LoginResponse["profile"];
  session: { cookies: Record<string, string> };
}

export interface CoursesResponse {
  success: boolean;
  courses: CourseCatalogEntry[];
  session: { cookies: Record<string, string> };
}

export interface ScheduleResponse {
  success: boolean;
  schedule: ScheduleDay[];
  session: { cookies: Record<string, string> };
}

export interface CalendarResponse {
  success: boolean;
  calendar: AcademicCalendar;
  session: { cookies: Record<string, string> };
}

export interface AttendanceRecord {
  courseCode: string;
  courseTitle: string;
  courseType: string;
  slot: string;
  classesConducted: number;
  classesAbsent: number;
  attendancePercentage: number;
}

export interface MarkAssessment {
  title: string;
  obtainedMarks: string;
  maximumMarks: string;
}

export interface MarkRecord {
  courseCode: string;
  courseType: string;
  summary: string;
  assessments: MarkAssessment[];
  totalMarksObtained: number | null;
  totalMarksMaximum: number | null;
}

export interface CourseSlot {
  slotCode: string;
  slotType: string;
  rawType: string;
  faculty: string;
  room: string;
  slotLabel: string;
}

export interface CourseCatalogEntry {
  courseCode: string;
  courseTitle: string;
  credits: string;
  slots: CourseSlot[];
}

export interface ScheduleEntry {
  slotCode: string;
  courseCode: string;
  courseTitle: string;
  slotType: string;
  rawType: string;
  room: string;
  faculty: string;
  timeLabel: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleDay {
  dayLabel: string;
  entries: ScheduleEntry[];
}

export interface CalendarEntry {
  date: string;
  day: string;
  title: string | null;
  dayOrder: string | null;
  category: "event" | "working-day" | "holiday" | "empty";
  month: string;
  monthIndex: number;
  rawMonthLabel: string;
}

export interface CalendarMonth {
  month: string;
  monthIndex: number;
  year: number;
  label: string;
  entries: CalendarEntry[];
}

export interface AcademicCalendar {
  plannerType: "ODD" | "EVEN";
  academicYearLabel: string;
  sourcePage: string;
  months: CalendarMonth[];
}

function normalizeDecimalString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toFixed(2);
}

function normalizeMarkSummary(summary: string): string {
  const match = summary.match(/^\s*([+-]?\d*\.?\d+)\s*\/\s*([+-]?\d*\.?\d+)\s*$/);
  if (!match) return summary;
  const obtained = normalizeDecimalString(match[1]);
  const maximum = normalizeDecimalString(match[2]);
  return `${obtained}/${maximum}`;
}

function normalizeMarks(records: MarkRecord[]): MarkRecord[] {
  return records.map((record) => ({
    ...record,
    summary: normalizeMarkSummary(record.summary),
    assessments: record.assessments.map((assessment) => ({
      ...assessment,
      obtainedMarks: normalizeDecimalString(assessment.obtainedMarks),
      maximumMarks: normalizeDecimalString(assessment.maximumMarks),
    })),
  }));
}

/** POST /login */
export async function apiLogin(creds: CredentialsPayload) {
  const result = await apiFetch<LoginResponse>("/login", creds);
  result.data.marks = normalizeMarks(result.data.marks);
  return result;
}

/** POST /refresh */
export async function apiRefresh(creds: CredentialsPayload) {
  const result = await apiFetch<RefreshResponse>("/refresh", creds);
  result.data.marks = normalizeMarks(result.data.marks);
  return result;
}

/** POST /attendance */
export async function apiAttendance(creds: CredentialsPayload) {
  return apiFetch<AttendanceResponse>("/attendance", creds);
}

/** POST /marks */
export async function apiMarks(creds: CredentialsPayload) {
  const result = await apiFetch<MarksResponse>("/marks", creds);
  result.data.marks = normalizeMarks(result.data.marks);
  return result;
}

/** POST /profile */
export async function apiProfile(creds: CredentialsPayload) {
  return apiFetch<ProfileResponse>("/profile", creds);
}

/** POST /courses */
export async function apiCourses(creds: CredentialsPayload) {
  return apiFetch<CoursesResponse>("/courses", creds);
}

/** POST /schedule */
export async function apiSchedule(creds: CredentialsPayload) {
  return apiFetch<ScheduleResponse>("/schedule", creds);
}

/** POST /calendar */
export async function apiCalendar(creds: CredentialsPayload) {
  return apiFetch<CalendarResponse>("/calendar", creds);
}
