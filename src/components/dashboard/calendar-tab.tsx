"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import type { AcademicCalendar, CalendarEntry } from "@/lib/api";
import { normalizeDayOrder } from "./utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const TIER_STYLES: Record<string, { bg: string; fg: string }> = {
  holiday: { bg: "var(--cx-green-bg)", fg: "var(--cx-green-fg)" },
  event: { bg: "var(--cx-brick-bg)", fg: "var(--cx-brick-fg)" },
  dayorder: { bg: "var(--cx-bg-2)", fg: "var(--cx-fg)" },
  plain: { bg: "var(--cx-bg-2)", fg: "var(--cx-fg)" },
};

function tierFor(entry: CalendarEntry | undefined): { bg: string; fg: string } {
  if (!entry) return TIER_STYLES.plain;
  if (entry.category === "holiday") return TIER_STYLES.holiday;
  if (entry.category === "event") return TIER_STYLES.event;
  if (entry.dayOrder && normalizeDayOrder(entry.dayOrder)) return TIER_STYLES.dayorder;
  return TIER_STYLES.holiday;
}

function getBadge(
  entry: CalendarEntry | undefined,
): { label: string; sub: string } | null {
  if (!entry) return null;
  if (entry.category === "holiday") return { label: "Holiday", sub: "holiday" };
  if (entry.category === "event")
    return { label: entry.title || "Event", sub: "event" };
  if (entry.dayOrder && normalizeDayOrder(entry.dayOrder))
    return {
      label: `DO ${normalizeDayOrder(entry.dayOrder)}`,
      sub: "Day order",
    };
  return { label: "Holiday", sub: "holiday" };
}

function getCellLabel(entry: CalendarEntry | undefined): string | null {
  if (!entry) return null;
  if (entry.category === "holiday") return "Holiday";
  if (entry.category === "event") return entry.title || "Event";
  if (entry.dayOrder && normalizeDayOrder(entry.dayOrder))
    return `DO ${normalizeDayOrder(entry.dayOrder)}`;
  return "Holiday";
}

export function CalendarTab({ calendar }: { calendar: AcademicCalendar }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [monthIdx, setMonthIdx] = useState(() => {
    const idx = calendar.months.findIndex(
      (m) => m.monthIndex === today.getMonth() + 1 && m.year === today.getFullYear(),
    );
    return Math.max(0, idx);
  });
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const month = calendar.months[monthIdx];

  const dayMap: Record<number, CalendarEntry> = {};
  if (month) {
    for (const entry of month.entries) {
      const dayNum = parseInt(entry.date.split("-")[2], 10);
      dayMap[dayNum] = entry;
    }
  }

  const firstDate = month
    ? new Date(month.year, month.monthIndex - 1, 1)
    : new Date();
  const leadingEmpties = firstDate.getDay();
  const daysInMonth = month
    ? new Date(month.year, month.monthIndex, 0).getDate()
    : 0;

  const selectedEntry = dayMap[selectedDay];
  const selectedDateObj = month
    ? new Date(month.year, month.monthIndex - 1, selectedDay)
    : new Date();
  const selectedDateStr = month
    ? `${WEEKDAY_NAMES[selectedDateObj.getDay()]}, ${MONTH_NAMES[month.monthIndex - 1]} ${selectedDay}`
    : "";
  const selectedTier = tierFor(selectedEntry);
  const selectedBadge = getBadge(selectedEntry);

  const handleDayClick = useCallback((day: number) => {
    setSelectedDay(day);
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;
    gsap.fromTo(
      heroRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
  }, [selectedDay]);

  useEffect(() => {
    const grid = rootRef.current?.querySelector(".cx-cal-grid");
    if (!grid) return;
    gsap.fromTo(
      ".cx-cal-cell:not(.is-blank)",
      { opacity: 0 },
      { opacity: 1, duration: 0.4, stagger: 0.012, ease: "power2.out" },
    );
  }, [monthIdx]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.05 });
      tl.fromTo(".cx-cal-kicker", { opacity: 0 }, { opacity: 1, duration: 0.6 });
      tl.fromTo(
        ".cx-cal-hero",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" },
        "-=0.3",
      );
      tl.fromTo(".cx-cal-nav", { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.3");
    }, rootRef);
    return () => ctx.revert();
  }, []);

  if (!month) {
    return (
      <div className="cx-calendar-tab" ref={rootRef}>
        <div className="cx-cal-grid-bg" />
        <div className="cx-cal-glow cx-cal-glow-1" />
        <div className="cx-cal-glow cx-cal-glow-2" />
        <div className="cx-cal-grain" />
        <div className="cx-cal-kicker"><span>Calendar</span></div>
        <div className="cx-cal-empty">No calendar data.</div>
      </div>
    );
  }

  const monthLabel = `${MONTH_NAMES[month.monthIndex - 1].slice(0, 3)} \u2019${String(month.year).slice(2)}`;

  return (
    <div className="cx-calendar-tab" ref={rootRef}>
      <div className="cx-cal-grid-bg" />
      <div className="cx-cal-glow cx-cal-glow-1" />
      <div className="cx-cal-glow cx-cal-glow-2" />
      <div className="cx-cal-grain" />

      <div className="cx-cal-kicker"><span>Calendar</span></div>
      <div
        className="cx-cal-hero"
        ref={heroRef}
        style={{ background: selectedTier.bg, color: selectedTier.fg }}
      >
        <div>
          <div className="cx-cal-hero-label">Selected day</div>
          <div className="cx-cal-hero-date">{selectedDateStr}</div>
          <div className="cx-cal-hero-desc">
            {selectedEntry
              ? selectedEntry.title || selectedBadge?.label || "No entry for this day yet."
              : "No entry for this day yet."}
          </div>
        </div>
        {selectedBadge && (
          <div className="cx-cal-hero-badge">
            <div className="tag">{selectedBadge.label}</div>
            <div className="sub">{selectedBadge.sub}</div>
          </div>
        )}
      </div>
      <div className="cx-cal-nav">
        <button
          className="cx-cal-nav-btn"
          onClick={() => {
            const next = Math.max(0, monthIdx - 1);
            setMonthIdx(next);
            setSelectedDay(1);
          }}
          disabled={monthIdx === 0}
          aria-label="Previous month"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="cx-cal-month">{monthLabel}</div>
        <button
          className="cx-cal-nav-btn"
          onClick={() => {
            const next = Math.min(calendar.months.length - 1, monthIdx + 1);
            setMonthIdx(next);
            setSelectedDay(1);
          }}
          disabled={monthIdx === calendar.months.length - 1}
          aria-label="Next month"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="cx-cal-weekdays">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div className="cx-cal-grid">
        {Array.from({ length: leadingEmpties }).map((_, i) => (
          <div key={`blank-${i}`} className="cx-cal-cell is-blank" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const entry = dayMap[day];
          const tier = tierFor(entry);
          const isSelected = day === selectedDay;
          const label = getCellLabel(entry);

          return (
            <button
              key={day}
              className={`cx-cal-cell${isSelected ? " is-selected" : ""}`}
              style={{ background: tier.bg, color: tier.fg }}
              onClick={() => handleDayClick(day)}
              aria-label={`Day ${day}`}
            >
              <span className="cx-cal-daynum">{day}</span>
              {label && <span className="cx-cal-label">{label}</span>}
              {entry?.title && entry.category !== "event" && (
                <span className="cx-cal-desc">{entry.title}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="cx-cal-list">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(month.year, month.monthIndex - 1, day);
          const entry = dayMap[day];
          const tier = tierFor(entry);
          const isSelected = day === selectedDay;
          const badge = getBadge(entry);

          return (
            <button
              key={day}
              className={`cx-cal-list-row${isSelected ? " is-selected" : ""}`}
              style={{ "--row-bg": tier.bg, "--row-fg": tier.fg } as React.CSSProperties}
              onClick={() => handleDayClick(day)}
              aria-label={`Day ${day}`}
            >
              <div className="cx-cal-list-left">
                <div className="cx-cal-list-daynum">{day}</div>
                <div className="cx-cal-list-weekday">
                  {WEEKDAY_NAMES[date.getDay()].slice(0, 3)}
                </div>
              </div>
              <div className="cx-cal-list-info">
                {badge && <div className="cx-cal-list-badge">{badge.label}</div>}
                {entry?.title && entry.category !== "event" && (
                  <div className="cx-cal-list-title">{entry.title}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
