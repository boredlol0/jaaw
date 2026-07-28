import { AttendanceParser } from "../../shared/parsers/attendance-parser";
import { MarksParser } from "../../shared/parsers/marks-parser";
import { loadLoginData, loadRefreshData, buildLoginResponse } from "../../shared/loader";

export async function login(creds: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string }) {
  const loginData = await loadLoginData(creds);
  return buildLoginResponse(loginData);
}

export async function refresh(creds: { username?: string; password?: string; cookies?: Record<string, string>; captcha?: string; cdigest?: string }) {
  const data = await loadRefreshData(creds);

  return {
    success: true,
    attendance: AttendanceParser.extract(data.attendanceHtml),
    marks: MarksParser.extract(data.attendanceHtml),
    courses: data.courses,
    schedule: data.schedule,
    calendar: data.calendar,
    session: { cookies: data.client.sessionManager.getCookieObject() },
    metadata: data.metadata,
  };
}
