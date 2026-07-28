import { PortalClient } from "./academia-client";
import { ProfileParser } from "./parsers/profile-parser";
import { CourseParser } from "./parsers/course-parser";
import { AttendanceParser } from "./parsers/attendance-parser";
import { MarksParser } from "./parsers/marks-parser";
import { TimetableParser } from "./parsers/timetable-parser";
import { CalendarParser } from "./parsers/calendar-parser";
import { HttpError } from "./errors";
import type { Credentials, CalendarRequest, LoginMetadata } from "../types";

export async function authenticateIfNeeded(client: PortalClient, creds: Credentials, authTime?: { value: number }) {
  if (!creds.cookies) {
    const t0 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    if (authTime) authTime.value += performance.now() - t0;
  }
}

export function requireCredentials(creds: Credentials): void {
  if (!creds.username || !creds.password) {
    throw new HttpError(401, {
      type: "COOKIES_INVALID",
      message: "Cookies are invalid and no credentials were provided to fall back on",
    });
  }
}

function resolveLoginBy(creds: Credentials, didFallback: { value: boolean }): "credentials" | "cookies" {
  if (didFallback.value) return "credentials";
  return creds.cookies ? "cookies" : "credentials";
}

function resolveCalendarDate(value?: string): Date {
  if (!value) {
    return new Date();
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new HttpError(400, "date must be in YYYY-MM-DD format");
  }

  return parsedDate;
}

function normalizeBatch(batch: string): string {
  const rawBatch = String(batch || "1").trim();
  return rawBatch.includes("/") ? rawBatch.split("/").pop()?.trim() ?? "1" : rawBatch;
}

function formatBatchForGrid(batch: string): string {
  return batch === "1" ? "Batch_1" : "batch_2";
}

async function loadProfileHtml(client: PortalClient, creds: Credentials, didFallback: { value: boolean }, authTime?: { value: number }) {
  let profileHtml = await client.fetchProfile();
  if (!profileHtml || profileHtml === "CONCURRENT_ERROR") {
    requireCredentials(creds);
    const t0 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    if (authTime) authTime.value += performance.now() - t0;
    didFallback.value = true;
    profileHtml = await client.fetchProfile();
  }

  if (!profileHtml) {
    throw new HttpError(401, "Invalid Credentials");
  }

  return profileHtml;
}

async function loadCalendarForClient(client: PortalClient, creds: Credentials, date: string | undefined, didFallback: { value: boolean }, authTime?: { value: number }) {
  const plannerType = CalendarParser.resolveSemester(resolveCalendarDate(date));
  let calendarHtml = await client.fetchCalendar(plannerType);

  if (!calendarHtml || calendarHtml === "CONCURRENT_ERROR") {
    requireCredentials(creds);
    const t0 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    if (authTime) authTime.value += performance.now() - t0;
    didFallback.value = true;
    calendarHtml = await client.fetchCalendar(plannerType);
  }

  if (!calendarHtml) {
    throw new HttpError(404, "Academic calendar not found");
  }

  return CalendarParser.extract(calendarHtml, plannerType);
}

export async function loadAttendanceHtml(body: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string }, authTime?: { value: number }) {
  const creds: Credentials = body;
  const client = new PortalClient(creds.username, creds.password, creds.cookies);
  const didFallback = { value: false };

  await authenticateIfNeeded(client, creds, authTime);

  const t0 = performance.now();
  let attendanceHtml = await client.fetchAttendance();
  if (!attendanceHtml || attendanceHtml === "CONCURRENT_ERROR") {
    requireCredentials(creds);
    const t1 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    if (authTime) authTime.value += performance.now() - t1;
    didFallback.value = true;
    attendanceHtml = await client.fetchAttendance();
  }
  const attendanceTime = Math.round(performance.now() - t0);

  if (!attendanceHtml) {
    attendanceHtml = null;
  }

  const metadata: LoginMetadata = {
    loginBy: resolveLoginBy(creds, didFallback),
    academiaResponseTime: {
      login: authTime ? Math.round(authTime.value) : undefined,
      attendance: attendanceTime,
    },
  };

  return { attendanceHtml, client, metadata, didFallback: didFallback.value, attendanceTime };
}

export async function loadLoginData(body: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string }) {
  const creds: Credentials = body;
  const client = new PortalClient(creds.username, creds.password, creds.cookies);
  const didFallback = { value: false };
  const authTime = { value: 0 };

  await authenticateIfNeeded(client, creds, authTime);

  const responseTimes: Record<string, number> = {};

  let t0 = performance.now();
  let profileHtml = await client.fetchProfile();
  if (!profileHtml || profileHtml === "CONCURRENT_ERROR") {
    requireCredentials(creds);
    const t1 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    authTime.value += performance.now() - t1;
    didFallback.value = true;
    profileHtml = await client.fetchProfile();
  }
  responseTimes.profile = Math.round(performance.now() - t0);

  if (!profileHtml) {
    throw new HttpError(401, "No profile data found");
  }

  const profile = ProfileParser.extract(profileHtml);
  profile.batch = normalizeBatch(profile.batch);

  const courseSlotLookup = CourseParser.buildSlotMap(profileHtml);
  const courses = CourseParser.extract(profileHtml);

  t0 = performance.now();
  let attendanceHtml = await client.fetchAttendance();
  if (!attendanceHtml || attendanceHtml === "CONCURRENT_ERROR") {
    requireCredentials(creds);
    const t1 = performance.now();
    await client.authenticate(creds.captcha, creds.cdigest);
    authTime.value += performance.now() - t1;
    didFallback.value = true;
    attendanceHtml = await client.fetchAttendance();
  }
  responseTimes.attendance = Math.round(performance.now() - t0);

  if (!attendanceHtml) {
    attendanceHtml = null;
  }

  t0 = performance.now();
  const gridHtml = await client.fetchTimetable(formatBatchForGrid(profile.batch));
  responseTimes.timetable = Math.round(performance.now() - t0);

  const schedule = TimetableParser.extract(gridHtml, courseSlotLookup);

  t0 = performance.now();
  const calendar = await loadCalendarForClient(client, creds, undefined, didFallback, authTime);
  responseTimes.calendar = Math.round(performance.now() - t0);

  const metadata: LoginMetadata = {
    loginBy: resolveLoginBy(creds, didFallback),
    academiaResponseTime: {
      login: Math.round(authTime.value),
      profile: responseTimes.profile,
      attendance: responseTimes.attendance,
      timetable: responseTimes.timetable,
      calendar: responseTimes.calendar,
    },
  };

  return {
    client,
    profile,
    attendanceHtml,
    courses,
    schedule,
    calendar,
    metadata,
  };
}

export async function loadCalendarData(body: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string; date?: string }) {
  const creds: CalendarRequest = body;
  const client = new PortalClient(creds.username, creds.password, creds.cookies);
  const didFallback = { value: false };
  const authTime = { value: 0 };

  await authenticateIfNeeded(client, creds, authTime);

  const t0 = performance.now();
  const calendar = await loadCalendarForClient(client, creds, creds.date, didFallback, authTime);
  const calendarTime = Math.round(performance.now() - t0);

  const metadata: LoginMetadata = {
    loginBy: resolveLoginBy(creds, didFallback),
    academiaResponseTime: {
      login: Math.round(authTime.value),
      calendar: calendarTime,
    },
  };

  return {
    client,
    calendar,
    metadata,
  };
}

export async function loadRefreshData(body: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string }) {
  const creds: Credentials = body;
  const authTime = { value: 0 };
  const { attendanceHtml, client, didFallback: attendanceFallback, attendanceTime } = await loadAttendanceHtml(body, authTime);
  const didFallback = { value: attendanceFallback };

  const responseTimes: Record<string, number> = {};
  responseTimes.attendance = attendanceTime;

  let t0 = performance.now();
  const profileHtml = await loadProfileHtml(client, creds, didFallback, authTime);
  responseTimes.profile = Math.round(performance.now() - t0);

  const profile = ProfileParser.extract(profileHtml);
  profile.batch = normalizeBatch(profile.batch);
  const courseSlotLookup = CourseParser.buildSlotMap(profileHtml);
  const courses = CourseParser.extract(profileHtml);

  t0 = performance.now();
  const gridHtml = await client.fetchTimetable(formatBatchForGrid(profile.batch));
  responseTimes.timetable = Math.round(performance.now() - t0);

  const schedule = TimetableParser.extract(gridHtml, courseSlotLookup);

  t0 = performance.now();
  const calendar = await loadCalendarForClient(client, creds, undefined, didFallback, authTime);
  responseTimes.calendar = Math.round(performance.now() - t0);

  const metadata: LoginMetadata = {
    loginBy: resolveLoginBy(creds, didFallback),
    academiaResponseTime: {
      login: Math.round(authTime.value),
      profile: responseTimes.profile,
      attendance: responseTimes.attendance,
      timetable: responseTimes.timetable,
      calendar: responseTimes.calendar,
    },
  };

  return {
    client,
    attendanceHtml,
    courses,
    schedule,
    calendar,
    metadata,
  };
}

export function buildLoginResponse(loginData: Awaited<ReturnType<typeof loadLoginData>>) {
  return {
    success: true,
    profile: loginData.profile,
    attendance: AttendanceParser.extract(loginData.attendanceHtml),
    marks: MarksParser.extract(loginData.attendanceHtml),
    schedule: loginData.schedule,
    courses: loginData.courses,
    calendar: loginData.calendar,
    session: { cookies: loginData.client.sessionManager.getCookieObject() },
    metadata: loginData.metadata,
  };
}
