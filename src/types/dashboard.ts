import type { ComponentType } from "react";
import {
    CalendarDays,
    HomeIcon,
    NotebookTabs,
    Table2,
    TrendingUp,
    User,
    UserCircle
} from "lucide-react";
import type { StoredDashData } from "@/lib/storage";
import type {
    AttendanceRecord,
    MarkRecord,
    ScheduleDay,
    CourseCatalogEntry,
    AcademicCalendar,
} from "@/lib/api";

export type Tab = "home" | "attendance" | "timetable" | "marks" | "calendar" | "profile";

export type NavIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

export const TAB_ROUTES: Record<Tab, string> = {
    home: "/dash",
    attendance: "/dash/attendance",
    timetable: "/dash/timetable",
    marks: "/dash/marks",
    calendar: "/dash/calendar",
    profile: "/dash/profile",
};

export const DASH_NAV_ITEMS: { id: Tab; Icon: NavIcon; label: string }[] = [
    { id: "home", Icon: HomeIcon, label: "Home" },
    { id: "attendance", Icon: NotebookTabs, label: "Attend" },
    { id: "timetable", Icon: Table2, label: "Table" },
    { id: "marks", Icon: TrendingUp, label: "Marks" },
    { id: "calendar", Icon: CalendarDays, label: "Cal" },
    { id: "profile", Icon: UserCircle, label: "Profile" },
];

export interface DashState {
    profile: StoredDashData["profile"];
    attendance: AttendanceRecord[];
    marks: MarkRecord[];
    schedule: ScheduleDay[];
    courses: CourseCatalogEntry[];
    calendar: AcademicCalendar;
}
