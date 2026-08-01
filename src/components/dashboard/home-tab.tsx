"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import gsap from "gsap";
import type { AttendanceRecord, ScheduleEntry } from "@/lib/api";
import type { DashState, Tab } from "@/types/dashboard";
import {
  formatDuration,
  getClassStatus,
  getEffectiveEndTime,
  getNowSeconds,
  isFinishedSemester,
  parseTime,
  timeToMinutes,
} from "./utils";

function isLab(entry: { slotType: string }): boolean {
  return entry.slotType.toLowerCase() === "practical";
}

function cardColors(entry: { slotType: string }): { bg: string; fg: string } {
  return isLab(entry)
    ? { bg: "var(--cx-teal-bg)", fg: "var(--cx-teal-fg)" }
    : { bg: "var(--cx-indigo-bg)", fg: "var(--cx-indigo-fg)" };
}

function slotTypeLabel(entry: { slotType: string; rawType: string }): string {
  if (isLab(entry)) return "LAB";
  if (entry.rawType) return entry.rawType.toUpperCase();
  return "TH";
}

function ttFormatDuration(start: string, end: string): string {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function HomeTab({
  state,
  overallPct,
  totalCanSkip,
  avgMarksPct,
  dangerCourses,
  currentEntry,
  nextEntry,
  todayEntries,
  todayDayOrder,
  navigateToTab,
}: {
  state: DashState;
  overallPct: number;
  totalCanSkip: number;
  avgMarksPct: number | null;
  dangerCourses: AttendanceRecord[];
  currentEntry?: ScheduleEntry;
  nextEntry?: ScheduleEntry;
  todayEntries: ScheduleEntry[];
  todayDayOrder: string | null;
  navigateToTab: (tab: Tab) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || !rootRef.current) return;
    animated.current = true;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.05 });
      tl.fromTo(
        ".cx-home-today .cx-section-kicker",
        { opacity: 0 },
        { opacity: 1, duration: 0.6 }
      );
      tl.fromTo(
        ".cx-home-today .cx-day-title",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.3"
      );
      // tl.fromTo(
      //   ".cx-home-today .cx-tt-row, .cx-home-today .cx-tt-break",
      //   { opacity: 0, y: 14 },
      //   { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 },
      //   "-=0.3"
      // );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const currentClass = todayEntries.find((e) => getClassStatus(e) === "current");
  const upcomingClass = todayEntries.find((e) => getClassStatus(e) === "upcoming");
  const nowSec = getNowSeconds();
  const countdownValue = (() => {
    if (currentClass) {
      const effectiveEnd = getEffectiveEndTime(currentClass, todayEntries);
      const endSec = timeToMinutes(effectiveEnd) * 60;
      return formatDuration(endSec - nowSec);
    }
    if (upcomingClass) {
      return `Free until ${parseTime(upcomingClass.startTime)}`;
    }
    return "Done";
  })();
  const countdownDetail = (() => {
    if (currentClass) {
      return `Ends at ${parseTime(getEffectiveEndTime(currentClass, todayEntries))}`;
    }
    if (upcomingClass) {
      return `${upcomingClass.courseTitle} / ${upcomingClass.room}`;
    }
    return "All classes over";
  })();
  const trackedClass = currentEntry ?? nextEntry;
  const trackedAttendance = trackedClass
    ? state.attendance.find((r) => r.courseCode === trackedClass.courseCode)
    : null;
  const alertCourse = dangerCourses[0];
  const marksCount = state.marks.filter((m) => m.totalMarksMaximum !== null).length;
  const overviewCards = [
    {
      id: "countdown",
      label: currentClass ? "Current Class" : "Next Up",
      title: countdownValue,
      subtitle: countdownDetail,
      meta: todayDayOrder ? `DO${todayDayOrder}` : "Holiday",
      Icon: CalendarClock,
      tab: "timetable" as Tab,
      tone: "indigo",
    },
    {
      id: "attendance",
      label: "Attendance",
      title: `${overallPct.toFixed(1)}%`,
      subtitle: isFinishedSemester(state.attendance)
        ? "Semester completed"
        : `Average across all subjects`,
      meta: trackedAttendance
        ? `${trackedAttendance.attendancePercentage.toFixed(1)}% ${currentEntry ? "now" : "next"}`
        : `Attendance`,
      Icon: BarChart3,
      tab: "attendance" as Tab,
      tone: overallPct >= 75 ? "teal" : "cream",
    },
    {
      id: "marks",
      label: "Marks",
      title: avgMarksPct !== null ? `${avgMarksPct.toFixed(1)}%` : "--",
      subtitle: avgMarksPct !== null ? `Average across ${marksCount} subjects` : "No marks uploaded yet",
      meta: "Internal score",
      Icon: TrendingUp,
      tab: "marks" as Tab,
      tone: "amber",
    },
  ];

  const todayDate = new Date();
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = todayDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="cx-home-tab" data-tick={clockTick}>
      <div className="cx-home-grid" aria-hidden="true" />
      <div className="cx-home-glow cx-home-glow-1" aria-hidden="true" />
      <div className="cx-home-glow cx-home-glow-2" aria-hidden="true" />
      <div className="cx-home-grain" aria-hidden="true" />

      <section className="cx-home-section cx-home-overview">
        <div className="dash-section-label cx-section-kicker">
          <span>Quick overview</span>
          <span className="cx-section-date">{dateLabel}</span>
        </div>

        <div className="cx-stat-grid">
          {overviewCards.map(({ id, label, title, subtitle, meta, Icon, tab, tone }) => {
            return (
              <button
                key={id}
                type="button"
                className={`dash-c-card cx-stat-card is-${tone}`}
                onClick={() => navigateToTab(tab)}
              >
                <span className="cx-stat-top">
                  <span className="cx-stat-id">
                    <span className="cx-stat-icon" aria-hidden="true">
                      <Icon size={16} strokeWidth={2.2} />
                    </span>
                    <span className="cx-stat-label">{label}</span>
                  </span>
                  <span className="cx-stat-badge">
                    {meta}
                    <ChevronRight size={12} strokeWidth={2.6} aria-hidden="true" />
                  </span>
                </span>
                <span>
                  <span className="cx-stat-value">{title}</span>
                  <span className="cx-stat-meta">{subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="cx-home-section cx-home-today" ref={rootRef}>
        <div className="dash-section-label cx-section-kicker cx-today-kicker">
          <span>Today&apos;s classes</span>
          {todayDayOrder && <span className="cx-section-date">Day order {todayDayOrder}</span>}
        </div>

        <div className="cx-day-title-wrap">
          <h2 className="cx-day-title" aria-label={dayName}>
            <span className="cx-day-letters" aria-hidden="true">
              {[...dayName].map((letter, index) => (
                <span key={`${letter}-${index}`}>{letter}</span>
              ))}
            </span>
            <span className="cx-day-dot" aria-hidden="true">
              &bull;
            </span>
          </h2>
        </div>

        {todayEntries.length === 0 ? (
          <div className="dash-c-card cx-class-empty">
            <span className="cx-scribble">nothing on today, enjoy!</span>
            <p>{todayDayOrder ? "No classes today." : "No class order for today."}</p>
          </div>
        ) : (
          <div style={{ marginTop: 26 }}>
            {todayEntries.map((entry, i) => {
              const prev = todayEntries[i - 1];
              const gap = prev
                ? timeToMinutes(entry.startTime) - timeToMinutes(prev.endTime)
                : 0;
              const isLive = getClassStatus(entry) === "current";
              const c = cardColors(entry);
              const typeLabel = slotTypeLabel(entry);
              const dur = ttFormatDuration(entry.startTime, entry.endTime);

              return (
                <div key={`${entry.slotCode}-${i}`}>
                  {gap > 5 && prev && (
                    <div className="cx-tt-break">
                      {(() => {
                        const gapMins = timeToMinutes(entry.startTime) - timeToMinutes(prev.endTime);
                        const h = Math.floor(gapMins / 60);
                        const m = gapMins % 60;
                        let label = "";
                        if (h > 0 && m > 0) label = `${h}h ${m}m break`;
                        else if (h > 0) label = `${h}h break`;
                        else label = `${m}m break`;
                        return label;
                      })()}
                    </div>
                  )}

                  <div className={`cx-tt-row${isLive ? " is-live" : ""}`} style={{ margin: "16px 0" }}>
                    <div className="cx-tt-time">
                      <div className="cx-tt-time-start">{parseTime(entry.startTime)}</div>
                      <div className="cx-tt-time-end">{parseTime(entry.endTime)}</div>
                    </div>

                    <div className="cx-tt-dot-col">
                      <span className={`cx-tt-dot${isLive ? " is-live" : ""}`} />
                    </div>

                    <div
                      className="cx-tt-card"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {isLive && (
                        <span className="cx-tt-live-tag">
                          <i />
                          Live now
                        </span>
                      )}

                      <div className="cx-tt-card-left">
                        <div className="cx-tt-card-code">{entry.courseCode}</div>
                        <div className="cx-tt-card-name">{entry.courseTitle}</div>
                        <div className="cx-tt-card-meta">
                          <span>{entry.room}</span>
                          <span>{entry.faculty.split("(")[0].trim()}</span>
                        </div>
                      </div>

                      <div className="cx-tt-right">
                        <div className="cx-tt-type-badge">{typeLabel}</div>
                        {dur && <div className="cx-tt-duration">{dur}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
