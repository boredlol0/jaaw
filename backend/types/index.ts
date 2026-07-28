export interface Credentials {
  username?: string;
  password?: string;
  cookies?: Record<string, string>;
  captcha?: string;
  cdigest?: string;
}

export interface CalendarRequest extends Credentials {
  date?: string;
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

export interface StudentProfile {
  name: string;
  registrationNumber: string;
  batch: string;
  semester: string;
  department: string;
  section: string;
  mobileNumber: string;
  program: string;
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

export interface CourseSlotLookup {
  courseCode: string;
  courseTitle: string;
  credits: string;
  rawType: string;
  faculty: string;
  room: string;
  slotLabel: string;
  slotCode: string;
  slotType: string;
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

export interface CaptchaRequiredDetail {
  type: "CAPTCHA_REQUIRED";
  message: string;
  cdigest: string;
  image: string;
}

export interface CookiesInvalidDetail {
  type: "COOKIES_INVALID";
  message: string;
}

export interface AcademiaResponseTime {
  login?: number;
  profile?: number;
  attendance?: number;
  timetable?: number;
  calendar?: number;
}

export interface LoginMetadata {
  loginBy: "credentials" | "cookies";
  academiaResponseTime: AcademiaResponseTime;
}
