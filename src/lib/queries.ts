import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiLogin,
  apiAttendance,
  apiMarks,
  apiProfile,
  apiCourses,
  apiSchedule,
  apiCalendar,
  apiRefresh,
  ApiError,
  type LoginResponse,
  type RefreshResponse,
  type AttendanceResponse,
  type MarksResponse,
  type ProfileResponse,
  type CoursesResponse,
  type ScheduleResponse,
  type CalendarResponse,
  type CredentialRoute,
} from "./api";
import { loadSession, saveSession, updateDashData, clearSession } from "./storage";
import type { StoredDashData, StoredSession } from "./storage";

const QK = {
  dashboard: (username: string) => ["dashboard", username] as const,
  attendance: (username: string) => ["attendance", username] as const,
  marks: (username: string) => ["marks", username] as const,
  courses: (username: string) => ["courses", username] as const,
  schedule: (username: string) => ["schedule", username] as const,
  calendar: (username: string) => ["calendar", username] as const,
  profile: (username: string) => ["profile", username] as const,
} as const;

function getCreds(session: StoredSession) {
  return {
    username: session.username.includes("@srmist.edu.in")
      ? session.username
      : `${session.username}@srmist.edu.in`,
    password: session.password,
    cookies: session.cookies,
  };
}

function handleAuthError(err: unknown): never {
  if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
    clearSession();
    window.location.replace("/");
  }
  throw err;
}

function mergeCookies(session: StoredSession, newCookies: Record<string, string>): void {
  session.cookies = { ...session.cookies, ...newCookies };
  const stored = loadSession();
  if (stored) {
    stored.session.cookies = session.cookies;
    saveSession(stored);
  }
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) =>
      apiLogin({
        username: `${username}@srmist.edu.in`,
        password,
      }),
    onSuccess: (result, { username, password }) => {
      const { data } = result;
      saveSession({
        session: { username, password, cookies: data.session.cookies },
        dash: {
          profile: data.profile,
          attendance: data.attendance,
          marks: data.marks,
          schedule: data.schedule,
          courses: data.courses,
          calendar: data.calendar,
          cachedAt: Date.now(),
        },
      });
    },
  });
}

export function useDashboardQuery() {
  const stored = loadSession();
  const queryClient = useQueryClient();

  const initialDash: StoredDashData | null = stored?.dash ?? null;

  const dashQuery = useQuery({
    queryKey: QK.dashboard(stored?.session.username ?? "none"),
    queryFn: async () => {
      if (!stored?.session) throw new Error("No session");
      const { data } = await apiRefresh(getCreds(stored.session));
      const newDash: StoredDashData = {
        profile: stored.dash?.profile ?? {
          name: "",
          registrationNumber: "",
          batch: "",
          semester: "",
          department: "",
          section: "",
          mobileNumber: "",
          program: "",
        },
        attendance: data.attendance,
        marks: data.marks,
        schedule: data.schedule,
        courses: data.courses,
        calendar: data.calendar,
        cachedAt: Date.now(),
      };
      mergeCookies(stored.session, data.session.cookies);
      updateDashData(newDash);
      return newDash;
    },
    enabled: false,
    initialData: initialDash ?? undefined,
  });

  const invalidateAll = () => {
    if (!stored?.session) return;
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return { dashQuery, invalidateAll, session: stored?.session ?? null };
}

export function useAttendanceQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.attendance(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiAttendance(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.attendance; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.attendance as AttendanceResponse["attendance"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarksQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.marks(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiMarks(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.marks; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.marks as MarksResponse["marks"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoursesQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.courses(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiCourses(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.courses; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.courses as CoursesResponse["courses"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useScheduleQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.schedule(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiSchedule(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.schedule; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.schedule as ScheduleResponse["schedule"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.calendar(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiCalendar(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.calendar; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.calendar as CalendarResponse["calendar"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfileQuery(initialDash: StoredDashData | null) {
  const session = useSession();

  return useQuery({
    queryKey: QK.profile(session?.username ?? "none"),
    queryFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiProfile(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data.profile; } catch (e) { handleAuthError(e); }
    },
    initialData: initialDash?.profile as ProfileResponse["profile"] | undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshMutation(onSetDash?: (dash: StoredDashData) => void) {
  const queryClient = useQueryClient();
  const session = useSession();

  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("No session");
      try { const { data } = await apiRefresh(getCreds(session));
      mergeCookies(session, data.session.cookies);
      return data; } catch (e) { handleAuthError(e); }
    },
    onSuccess: (data) => {
      const stored = loadSession();
      if (!stored) return;
      const username = session?.username ?? "none";
      const newDash: StoredDashData = {
        profile: stored.dash?.profile ?? {
          name: "",
          registrationNumber: "",
          batch: "",
          semester: "",
          department: "",
          section: "",
          mobileNumber: "",
          program: "",
        },
        attendance: data.attendance,
        marks: data.marks,
        schedule: data.schedule,
        courses: data.courses,
        calendar: data.calendar,
        cachedAt: Date.now(),
      };
      updateDashData(newDash);
      onSetDash?.(newDash);
      queryClient.setQueryData(QK.dashboard(username), newDash);
      queryClient.setQueryData(QK.attendance(username), data.attendance);
      queryClient.setQueryData(QK.marks(username), data.marks);
      queryClient.setQueryData(QK.schedule(username), data.schedule);
      queryClient.setQueryData(QK.courses(username), data.courses);
      queryClient.setQueryData(QK.calendar(username), data.calendar);
    },
  });
}

function useSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const stored = loadSession();
  return stored?.session ?? null;
}