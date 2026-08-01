"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import type { ScheduleDay, AcademicCalendar } from "@/lib/api";
import {
  normalizeDayOrder,
  getTodayDayOrder,
  findScheduleDayIndexByOrder,
  timeToMinutes,
  getClassStatus,
  parseTime,
  normalizeSubject,
} from "./utils";
import { TimetableImageDownload } from "./timetable-image-download";

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

function formatDuration(start: string, end: string): string {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function todayStr(): string {
  const n = new Date();
  return n.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TimetableTab({
  schedule,
  calendar,
  dayOrderParam,
  semester,
}: {
  schedule: ScheduleDay[];
  calendar: AcademicCalendar;
  dayOrderParam: string | null;
  semester?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const preferredDayOrder = normalizeDayOrder(dayOrderParam) ?? getTodayDayOrder(calendar);
  const preferredDayIndex = findScheduleDayIndexByOrder(schedule, preferredDayOrder);
  const [selectedDay, setSelectedDay] = useState<number | null>(
    preferredDayIndex >= 0 ? preferredDayIndex : null
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (preferredDayIndex >= 0) {
        setSelectedDay(preferredDayIndex);
        setReady(true);
        return;
      }

      if (dayOrderParam) {
        setSelectedDay(null);
        setReady(true);
        return;
      }

      if (!dayOrderParam && !getTodayDayOrder(calendar)) {
        setSelectedDay(null);
      }
      setReady(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, [calendar, dayOrderParam, preferredDayIndex]);

  const todayDayOrder = getTodayDayOrder(calendar);
  const dayEntries = selectedDay !== null ? schedule[selectedDay]?.entries ?? [] : [];

  useEffect(() => {
    if (!ready || !rootRef.current || selectedDay === null) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.05 });

      tl.fromTo(
        ".cx-tt-kicker",
        { opacity: 0 },
        { opacity: 1, duration: 0.6 }
      );

      tl.fromTo(
        ".cx-tt-day-tab",
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.04 },
        "-=0.35"
      );

      tl.fromTo(
        ".cx-tt-row, .cx-tt-break",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 },
        "-=0.3"
      );
    }, rootRef);

    return () => ctx.revert();
  }, [ready, selectedDay]);

  const handleDayClick = (i: number) => {
    setSelectedDay(i);
  };

  const entries = dayEntries;
  const isEmpty = entries.length === 0;

  return (
    <div className="cx-timetable-tab" ref={rootRef}>
      <div className="cx-tt-grid" />
      <div className="cx-tt-glow cx-tt-glow-1" />
      <div className="cx-tt-glow cx-tt-glow-2" />
      <div className="cx-tt-grain" />

      <div className="cx-tt-kicker">
        <span>Timetable</span>
        <span className="cx-tt-kicker-right">
          {/* <span className="cx-tt-kicker-date">{todayStr()}</span> */}
          <TimetableImageDownload schedule={schedule} semester={semester} />
        </span>
      </div>

      <div className="cx-tt-day-tabs">
        {schedule.map((day, i) => {
          const dayNum = day.dayLabel.replace(/[^0-9]/g, "");
          const isActive = selectedDay === i;
          const isToday =
            todayDayOrder !== null &&
            normalizeDayOrder(day.dayLabel) === todayDayOrder;

          return (
            <button
              key={day.dayLabel}
              className={`cx-tt-day-tab${isActive ? " is-active" : ""}`}
              onClick={() => handleDayClick(i)}
              aria-label={`Day ${dayNum}`}
            >
              D{String(dayNum).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <div className="cx-tt-empty">No classes for this day.</div>
      ) : (
        <div className="cx-tt-timeline" ref={timelineRef}>
          {entries.map((entry, i) => {
            const prev = entries[i - 1];
            const gap =
              prev
                ? timeToMinutes(entry.startTime) - timeToMinutes(prev.endTime)
                : 0;

            const isLive = getClassStatus(entry) === "current";
            const c = cardColors(entry);
            const typeLabel = slotTypeLabel(entry);
            const dur = formatDuration(entry.startTime, entry.endTime);

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

                <div className={`cx-tt-row${isLive ? " is-live" : ""}`}>
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
                      <div className="cx-tt-card-name">{normalizeSubject(entry.courseTitle)}</div>
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
    </div>
  );
}
