"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession } from "@/lib/storage";
import type {
  AttendanceRecord,
  MarkRecord,
  ScheduleDay,
  CourseCatalogEntry,
  AcademicCalendar,
} from "@/lib/api";
import { AttendanceTab } from "./attendance-tab";
import { CalendarTab } from "./calendar-tab";
import { HomeTab } from "./home-tab";
import { MarksTab } from "./marks-tab";
import { ProfileTab } from "./profile-tab";
import { TimetableTab } from "./timetable-tab";
import type { DashState, Tab } from "@/types/dashboard";
import { TAB_ROUTES } from "@/types/dashboard";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import {
  useRefreshMutation,
  useAttendanceQuery,
  useMarksQuery,
  useScheduleQuery,
  useCalendarQuery,
  useProfileQuery,
  useCoursesQuery,
} from "@/lib/queries";
import {
  canSkip,
  findScheduleDayIndexByOrder,
  getClassStatus,
  getTodayDayOrder,
  overallAttendance,
} from "./utils";

function TimetableTabWrapper({
  schedule,
  calendar,
  semester,
}: {
  schedule: ScheduleDay[];
  calendar: AcademicCalendar;
  semester?: string;
}) {
  const searchParams = useSearchParams();
  return (
    <TimetableTab
      schedule={schedule}
      calendar={calendar}
      dayOrderParam={searchParams.get("dayOrder")}
      semester={semester}
    />
  );
}

export default function DashPage({
  tab = "home",
}: {
  tab?: Tab;
}) {
  const { session, dash, setDash, authChecked, mounted } = useAuthGuard({ skipRedirect: true });
  const router = useRouter();

  const refreshMutation = useRefreshMutation(setDash);

  const attendanceQuery = useAttendanceQuery(dash);
  const marksQuery = useMarksQuery(dash);
  const scheduleQuery = useScheduleQuery(dash);
  const calendarQuery = useCalendarQuery(dash);
  const profileQuery = useProfileQuery(dash);
  const coursesQuery = useCoursesQuery(dash);

  useEffect(() => {
    if (!authChecked || !session || !dash) return;
    const refetchFn = {
      home: () => refreshMutation.mutate(),
      attendance: () => attendanceQuery.refetch(),
      marks: () => marksQuery.refetch(),
      timetable: () => scheduleQuery.refetch(),
      calendar: () => calendarQuery.refetch(),
      profile: () => profileQuery.refetch(),
    }[tab];
    refetchFn();
  }, [tab, authChecked]);

  useEffect(() => {
    document.getElementById("dash-body")?.scrollTo({ top: 0 });
  }, [tab]);

  if (!mounted || !authChecked || !dash) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="dash-spinner" />
      </div>
    );
  }

  const state: DashState = {
    profile: profileQuery.data ?? dash.profile,
    attendance: (attendanceQuery.data ?? dash.attendance) as AttendanceRecord[],
    marks: (marksQuery.data ?? dash.marks) as MarkRecord[],
    schedule: (scheduleQuery.data ?? dash.schedule) as ScheduleDay[],
    courses: (coursesQuery.data ?? dash.courses) as CourseCatalogEntry[],
    calendar: (calendarQuery.data ?? dash.calendar) as AcademicCalendar,
  };

  const todayDayOrder = getTodayDayOrder(state.calendar);
  const todayScheduleIdx = findScheduleDayIndexByOrder(state.schedule, todayDayOrder);
  const todayScheduleDay = todayScheduleIdx >= 0 ? state.schedule[todayScheduleIdx] : null;
  const todayEntries = todayScheduleDay?.entries ?? [];

  const currentEntry = todayEntries.find((e) => getClassStatus(e) === "current");
  const nextEntry = todayEntries.find((e) => getClassStatus(e) === "upcoming");

  const overallPct = overallAttendance(state.attendance);
  const totalCanSkip = state.attendance.reduce(
    (s, r) => s + canSkip(r.classesConducted, r.classesAbsent),
    0
  );

  const marksWithData = state.marks.filter(
    (m) => m.totalMarksObtained !== null && m.totalMarksMaximum !== null && m.totalMarksMaximum > 0
  );
  const avgMarksPct =
    marksWithData.length > 0
      ? marksWithData.reduce((s, m) => s + (m.totalMarksObtained! / m.totalMarksMaximum!) * 100, 0) /
      marksWithData.length
      : null;

  const dangerCourses = state.attendance.filter(
    (r) => r.attendancePercentage < 75 && r.courseType === "Theory"
  );

  function handleLogout() {
    clearSession();
    window.location.replace("/");
  }

  function navigateToTab(tab: Tab) {
    router.push(TAB_ROUTES[tab]);
  }

  return (
    <>
      {tab === "home" && (
        <HomeTab
          state={state}
          overallPct={overallPct}
          totalCanSkip={totalCanSkip}
          avgMarksPct={avgMarksPct}
          dangerCourses={dangerCourses}
          currentEntry={currentEntry}
          nextEntry={nextEntry}
          todayEntries={todayEntries}
          todayDayOrder={todayDayOrder}
          navigateToTab={navigateToTab}
        />
      )}
      {tab === "attendance" && (
        <AttendanceTab
          records={state.attendance}
          overallPct={overallPct}
        />
      )}
      {tab === "timetable" && (
        <TimetableTabWrapper
          schedule={state.schedule}
          calendar={state.calendar}
          semester={state.profile?.semester}
        />
      )}
      {tab === "marks" && (
        <MarksTab marks={state.marks} courses={state.courses} />
      )}
      {tab === "calendar" && (
        <CalendarTab calendar={state.calendar} />
      )}
      {tab === "profile" && (
        <ProfileTab profile={state.profile} onLogout={handleLogout} overallPct={overallPct} avgMarksPct={avgMarksPct} />
      )}
    </>
  );
}
