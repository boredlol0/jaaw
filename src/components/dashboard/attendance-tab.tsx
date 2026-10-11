"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AcademicCalendar, AttendanceRecord, ScheduleDay } from "@/lib/api";
import {
  attendanceMargin,
  countLabSessions,
  isFinishedSemester,
  normalizeDayOrder,
  overallAttendance,
  predictAttendance,
  toDateKey,
  type LabSessionInfo,
} from "./utils";
import gsap from "gsap";
import { CalendarDaysIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { SpFallbackForm } from "./sp-fallback-form";
import { TheorySplitModal } from "./theory-split-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function tierFor(pct: number) {
  if (pct >= 85) return { bg: "var(--cx-green-bg)", fg: "var(--cx-green-fg)" };
  if (pct >= 75) return { bg: "var(--cx-amber-bg)", fg: "var(--cx-amber-fg)" };
  return { bg: "var(--cx-brick-bg)", fg: "var(--cx-brick-fg)" };
}

/** Joint theory+lab courses have codes ending in J — their attendance is combined. */
function isJointCourse(courseCode: string): boolean {
  return /j$/i.test(courseCode.trim());
}

function JointCourseNote() {
  return (
    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e7a63f]">
      Theory + lab combined
    </div>
  );
}

interface TheoryLabSplit {
  theoryConducted: number;
  theoryAbsent: number;
  theoryMargin: number;
  labConducted: number;
  labAbsent: number;
  labMargin: number;
}

/** Split a joint course's combined attendance into theory + lab parts.
 *  Returns null when the split is impossible with the given missed lab count. */
function splitTheoryLab(
  r: AttendanceRecord,
  missedSessions: number,
  lab: LabSessionInfo,
): TheoryLabSplit | null {
  if (lab.sessions === 0 || lab.labHours === 0) return null;
  const labAbsent = missedSessions * lab.hoursPerSession;
  const theoryConducted = r.classesConducted - lab.labHours;
  if (theoryConducted < 0 || labAbsent > r.classesAbsent || labAbsent > lab.labHours) {
    return null;
  }
  const theoryAbsent = r.classesAbsent - labAbsent;
  return {
    theoryConducted,
    theoryAbsent,
    theoryMargin: attendanceMargin(theoryConducted, theoryAbsent),
    labConducted: lab.labHours,
    labAbsent,
    labMargin: attendanceMargin(lab.labHours, labAbsent),
  };
}

function splitPct(attended: number, conducted: number): string {
  if (conducted <= 0) return "—";
  return `${((attended / conducted) * 100).toFixed(1)}%`;
}

const SPLIT_KEY = "jaaw_theory_split";

function loadSplitSel(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SPLIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [code, missed] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof missed === "number" && Number.isFinite(missed) && missed >= 0) {
        out[code] = Math.floor(missed);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function animateValue(el: Element, target: number, suffix = "", decimals = 0, dur = 1.1, delay = 0) {
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target,
    duration: dur,
    delay,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = `${obj.v.toFixed(decimals)}${suffix}`;
    },
  });
}

interface Predicted {
  records: AttendanceRecord[];
  overallPct: number;
  dateKeys: string[];
}

export function AttendanceTab({
  records,
  overallPct,
  schedule,
  calendar,
}: {
  records: AttendanceRecord[];
  overallPct: number;
  schedule: ScheduleDay[];
  calendar: AcademicCalendar;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const finished = records.length > 0 && isFinishedSemester(records);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date[]>([]);
  const [predicted, setPredicted] = useState<Predicted | null>(null);
  const justApplied = useRef(false);

  const [splitSel, setSplitSel] = useState<Record<string, number>>(loadSplitSel);
  const [splitCode, setSplitCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_KEY, JSON.stringify(splitSel));
    } catch {
    }
  }, [splitSel]);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const displayRecords = predicted?.records ?? records;
  const displayOverallPct = predicted?.overallPct ?? overallPct;

  const labMap = useMemo(() => {
    const map = new Map<string, LabSessionInfo>();
    for (const r of displayRecords) {
      if (isJointCourse(r.courseCode) && !map.has(r.courseCode)) {
        map.set(r.courseCode, countLabSessions(r.courseCode, calendar, schedule));
      }
    }
    return map;
  }, [displayRecords, calendar, schedule]);

  const splitTarget = splitCode
    ? (displayRecords.find((r) => r.courseCode === splitCode) ?? null)
    : null;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.1 });

      tl.fromTo(".cx-att-kicker", { opacity: 0 }, { opacity: 1, duration: 0.6 })
        .fromTo(
          ".cx-att-hero-card",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" },
          "-=0.3",
        )
        .fromTo(
          ".cx-att-row",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "expo.out" },
          "-=0.35",
        );
    }, el);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const heroEl = el.querySelector(".cx-att-hero-value");
      if (heroEl && displayRecords.length > 0) {
        gsap.killTweensOf(heroEl);
        animateValue(heroEl, displayOverallPct, "%", 1, 1.3, 0.25);
      }

      el.querySelectorAll(".cx-att-margin-val").forEach((valEl, i) => {
        const margin = parseFloat((valEl as HTMLElement).dataset.margin ?? "0");
        const isReq = (valEl as HTMLElement).dataset.req === "true";
        gsap.killTweensOf(valEl);
        animateValue(valEl, Math.abs(margin), isReq ? " required" : " margin", 0, 0.9, 0.3 + i * 0.08);
      });

      el.querySelectorAll(".cx-att-pct, .cx-att-row-pct").forEach((pctEl, i) => {
        const target = parseFloat((pctEl as HTMLElement).dataset.count ?? "0");
        gsap.killTweensOf(pctEl);
        animateValue(pctEl, target, "%", 1, 0.6, 0.35 + i * 0.08);
      });
    }, el);

    return () => ctx.revert();
  }, [displayOverallPct, displayRecords, splitSel]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      if (justApplied.current) justApplied.current = false;
      else setPredicted(null);
      setSelected([]);
    }
  }

  function handlePredict() {
    const keys = selected.map(toDateKey);
    if (keys.length === 0) return;
    const newRecords = predictAttendance(records, calendar, schedule, keys);
    const changed = newRecords.some(
      (r, i) => r.classesAbsent !== (records[i]?.classesAbsent ?? 0),
    );
    if (!changed) {
      const perDate = keys.map((key) => {
        for (const month of calendar.months) {
          const entry = month.entries.find((e) => e.date === key);
          if (entry) {
            const idx = schedule.findIndex((d) => normalizeDayOrder(d.dayLabel) === normalizeDayOrder(entry.dayOrder));
            return {
              key,
              foundInCalendar: true,
              dayOrder: entry.dayOrder,
              scheduleIndex: idx,
              courses: idx >= 0 ? schedule[idx].entries.map((e) => e.courseCode) : [],
            };
          }
        }
        return { key, foundInCalendar: false, dayOrder: null, scheduleIndex: -1, courses: [] };
      });
      console.warn(
        "[predict] no attendance rows changed for selected dates",
        {
          keys,
          attendanceCourseCodes: records.map((r) => r.courseCode),
          calendarMonths: calendar.months.map((m) => ({ label: m.label, entries: m.entries.length })),
          scheduleDays: schedule.map((d) => ({ label: d.dayLabel, courses: d.entries.map((e) => e.courseCode) })),
          perDate,
        },
      );
    }
    setPredicted({ records: newRecords, overallPct: overallAttendance(newRecords), dateKeys: keys });
    justApplied.current = true;
    setOpen(false);
  }

  function handleClear() {
    setSelected([]);
    setPredicted(null);
  }

  if (records.length === 0) {
    return (
      <div ref={rootRef} className="cx-attendance-tab">
        <div className="cx-att-grid" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-1" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-2" aria-hidden="true" />
        <div className="cx-att-grain" aria-hidden="true" />

        <div className="cx-att-kicker">
          <span>Attendance</span>
          <span className="cx-att-date">{todayLabel}</span>
        </div>

        <div
          className="cx-att-hero-card"
          style={{ background: "var(--cx-brick-bg)", color: "var(--cx-brick-fg)" }}
        >
          <div className="cx-att-hero-top">
            <span className="cx-att-hero-label">Attendance unavailable</span>
          </div>
          <div className="cx-att-hero-value">No data</div>
          <div className="cx-att-hero-meta">
            Failed to get attendance from Academia.
          </div>
        </div>

        <SpFallbackForm kind="attendance" />
      </div>
    );
  }

  const predictControl = (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cx-predict-btn" aria-label="Predict attendance">
          {predicted ? (
            <>
              <span className="cx-predict-dot" />
              <span>Predicting&middot;{predicted.dateKeys.length}</span>
            </>
          ) : (
            <>
              <CalendarDaysIcon className="cx-predict-icon" />
              <span>Predict</span>
            </>
          )}
          <ChevronDownIcon className={open ? "cx-predict-chevron cx-predict-chevron--open" : "cx-predict-chevron"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-85 font-['Space_Mono',monospace] [--cell-size:--spacing(8)] [--primary:#ffffff] [--primary-foreground:#0a0a0b] border-border/60 bg-[#131316]/95 text-[#f4f2ea] shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        <Calendar
          mode="multiple"
          selected={selected}
          onSelect={(dates) => setSelected(dates ?? [])}
          disabled={{ before: todayStart }}
          classNames={{ root: "w-full", months: "flex w-full flex-col gap-4", month: "flex w-full flex-col gap-4", week: "mt-2 flex w-full" }}
          className="rounded-md border border-white/5 p-1.5"
        />
        <div className="flex items-center justify-between gap-2 border-t border-white/5 px-1 pt-2.5 pb-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8d8d95]">
            {selected.length === 0
              ? "No days selected"
              : `${selected.length} day${selected.length === 1 ? "" : "s"} selected`}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 border-white/10 bg-transparent text-[#8d8d95] hover:bg-white/5 hover:text-[#f4f2ea]"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handlePredict}
              disabled={selected.length === 0}
              className="h-8 bg-[#e7a63f] text-[#241203] hover:bg-[#e7a63f]/90 disabled:opacity-40"
            >
              Predict
            </Button>
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (finished) {
    return (
      <div ref={rootRef} className="cx-attendance-tab">
        <div className="cx-att-grid" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-1" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-2" aria-hidden="true" />
        <div className="cx-att-grain" aria-hidden="true" />

        <div className="cx-att-kicker">
          <span>Attendance</span>
          <span className="cx-att-date">{todayLabel}</span>
        </div>

        <div
          className="cx-att-hero-card"
          style={{ background: "var(--cx-indigo-bg)", color: "var(--cx-indigo-fg)" }}
        >
          <div className="cx-att-hero-top">
            <span className="cx-att-hero-label">Overall attendance</span>
          </div>
          <div className="cx-att-hero-value" data-count={displayOverallPct}>
            0.0%
          </div>
          <div className="cx-att-hero-meta">
            Final semester result
          </div>
        </div>

        <div className="cx-att-row-list">
          {displayRecords.map((r, i) => {
            const tier = tierFor(r.attendancePercentage);
            return (
              <article
                key={`${r.courseCode}-${i}`}
                className="cx-att-row"
                style={{ background: tier.bg, color: tier.fg }}
              >
                <div className="cx-att-row-left">
                  <div className="cx-att-row-code">
                    {r.courseCode}
                    <span className="cx-att-row-tag">{r.courseType}</span>
                  </div>
                  <div className="cx-att-row-name">
                    {r.courseTitle}
                  </div>
                  {isJointCourse(r.courseCode) && <JointCourseNote />}
                </div>
                <div className="cx-att-pct" data-count={r.attendancePercentage}>
                  0.0%
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={predicted ? "cx-attendance-tab cx-attendance-tab--predict" : "cx-attendance-tab"}>
      <div className="cx-att-grid" aria-hidden="true" />
      <div className="cx-att-glow cx-att-glow-1" aria-hidden="true" />
      <div className="cx-att-glow cx-att-glow-2" aria-hidden="true" />
      <div className="cx-att-grain" aria-hidden="true" />

      <div className="cx-att-kicker">
        <span>Attendance</span>
        {predictControl}
      </div>

      <div
        className="cx-att-hero-card"
        style={{ background: "var(--cx-indigo-bg)", color: "var(--cx-indigo-fg)" }}
      >
        <div className="cx-att-hero-top">
          <span className="cx-att-hero-label">Overall attendance</span>
          {predicted && (
            <span className="cx-att-predict-stamp" aria-hidden="true">
              Prediction
            </span>
          )}
        </div>
        <div className="cx-att-hero-value" data-count={displayOverallPct}>
          0.0%
        </div>
        <div className="cx-att-hero-meta">
          {predicted
            ? `Simulating ${predicted.dateKeys.length} absent day${predicted.dateKeys.length === 1 ? "" : "s"}`
            : "Across all subjects"}
        </div>
      </div>

      <div className="cx-att-row-list">
        {displayRecords.map((r, i) => {
          const margin = attendanceMargin(r.classesConducted, r.classesAbsent);
          const marginColor =
            margin > 0 ? "#3d6b4f" :
              margin === 0 ? "#e7a63f" :
                "#c94f4f";

          const isJoint = isJointCourse(r.courseCode);
          const lab = isJoint ? labMap.get(r.courseCode) : undefined;
          const missed = splitSel[r.courseCode];
          const split =
            isJoint && missed != null && lab ? splitTheoryLab(r, missed, lab) : null;
          const theoryColor = split
            ? split.theoryMargin > 0 ? "#3d6b4f" : split.theoryMargin === 0 ? "#e7a63f" : "#c94f4f"
            : marginColor;
          const labColor = split
            ? split.labMargin > 0 ? "#3d6b4f" : split.labMargin === 0 ? "#e7a63f" : "#c94f4f"
            : marginColor;

          return (
            <article
              key={`${r.courseCode}-${i}`}
              className="cx-att-row"
            >
              <div className="cx-att-row-left">
                <div className="cx-att-row-code">
                  {r.courseCode}
                  <span className="cx-att-row-tag">{r.courseType}</span>
                </div>
                <div className="cx-att-row-name">
                  {r.courseTitle}
                </div>
                {isJoint && (
                  <>
                    <JointCourseNote />
                    <button
                      type="button"
                      onClick={() => setSplitCode(r.courseCode)}
                      className="mt-2 inline-flex items-center rounded-full border border-[#e7a63f]/40 bg-[#e7a63f]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e7a63f] transition hover:bg-[#e7a63f]/20"
                    >
                      {missed != null ? "Edit theory split" : "Calculate theory"}
                    </button>
                  </>
                )}
                <div className="cx-att-row-pct-line">
                  <div className="cx-att-row-pct" data-count={r.attendancePercentage}>
                    0%
                  </div>
                  {r.classesConducted > 0 && (
                    <span className="cx-att-row-hours">
                      &middot; {r.classesConducted - r.classesAbsent}/{r.classesConducted}
                    </span>
                  )}
                </div>
                {split && (
                  <div className="mt-1 text-[11px] font-bold tracking-wide opacity-75">
                    T {splitPct(split.theoryConducted - split.theoryAbsent, split.theoryConducted)} &middot; L{" "}
                    {splitPct(split.labConducted - split.labAbsent, split.labConducted)}
                  </div>
                )}
              </div>
              <div className="cx-att-row-right">
                {split ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8d8d95]">
                        Theory
                      </span>
                      <div
                        className="cx-att-margin-val cx-att-margin-val--split"
                        data-margin={split.theoryMargin}
                        data-req={split.theoryMargin < 0}
                        style={{ color: theoryColor }}
                      >
                        {Math.abs(split.theoryMargin)}
                        {split.theoryMargin < 0 ? " required" : " margin"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8d8d95]">
                        Lab
                      </span>
                      <div
                        className="cx-att-margin-val cx-att-margin-val--split"
                        data-margin={split.labMargin}
                        data-req={split.labMargin < 0}
                        style={{ color: labColor }}
                      >
                        {Math.abs(split.labMargin)}
                        {split.labMargin < 0 ? " required" : " margin"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cx-att-margin-val"
                    data-margin={margin}
                    data-req={margin < 0}
                    style={{ color: marginColor }}
                  >
                    0
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {splitTarget && (
        <TheorySplitModal
          courseCode={splitTarget.courseCode}
          courseTitle={splitTarget.courseTitle}
          conducted={splitTarget.classesConducted}
          absent={splitTarget.classesAbsent}
          lab={labMap.get(splitTarget.courseCode) ?? { labHours: 0, sessions: 0, hoursPerSession: 0 }}
          missed={splitSel[splitTarget.courseCode] ?? 0}
          onApply={(missedSessions) => {
            setSplitSel((prev) => ({ ...prev, [splitTarget.courseCode]: missedSessions }));
            setSplitCode(null);
          }}
          onClear={() => {
            setSplitSel((prev) => {
              const next = { ...prev };
              delete next[splitTarget.courseCode];
              return next;
            });
            setSplitCode(null);
          }}
          onClose={() => setSplitCode(null)}
        />
      )}
    </div>
  );
}
