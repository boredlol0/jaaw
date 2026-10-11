"use client";

import { useEffect, useState } from "react";
import { attendanceMargin, type LabSessionInfo } from "./utils";

interface TheorySplitModalProps {
  courseCode: string;
  courseTitle: string;
  conducted: number;
  absent: number;
  lab: LabSessionInfo;
  missed: number;
  onApply: (missedSessions: number) => void;
  onClear: () => void;
  onClose: () => void;
}

function marginColor(margin: number): string {
  if (margin > 0) return "#3d6b4f";
  if (margin === 0) return "#e7a63f";
  return "#c94f4f";
}

function pct(attended: number, conducted: number): string {
  if (conducted <= 0) return "—";
  return `${((attended / conducted) * 100).toFixed(1)}%`;
}

export function TheorySplitModal({
  courseCode,
  courseTitle,
  conducted,
  absent,
  lab,
  missed,
  onApply,
  onClear,
  onClose,
}: TheorySplitModalProps) {
  const [draft, setDraft] = useState(String(missed));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasLab = lab.sessions > 0 && lab.labHours > 0;
  const missedNum = Math.max(0, Math.floor(Number(draft) || 0));

  const labAbsentHours = missedNum * lab.hoursPerSession;
  const theoryConducted = conducted - lab.labHours;
  const theoryAbsent = absent - labAbsentHours;

  const invalidReason = !hasLab
    ? "No lab sessions found in the timetable for this course."
    : theoryConducted < 0
      ? "Lab hours exceed total conducted hours — timetable mismatch."
      : labAbsentHours > absent
        ? "Lab absents exceed total absents — lower the missed count."
        : labAbsentHours > lab.labHours
          ? "Missed lab hours exceed conducted lab hours."
          : null;

  const theoryMargin = invalidReason ? 0 : attendanceMargin(theoryConducted, theoryAbsent);
  const labMargin = invalidReason
    ? 0
    : attendanceMargin(lab.labHours, Math.min(labAbsentHours, lab.labHours));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm [font-family:'Space_Mono',monospace]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Split theory and lab attendance for ${courseCode}`}
    >
      <div
        className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#131316] p-6 text-[#f4f2ea] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e7a63f]">
          Theory / lab split
        </p>
        <h2 className="mt-2 font-[Unbounded,sans-serif] text-lg font-bold leading-snug">
          {courseCode}
        </h2>
        <p className="mt-1 text-[12px] text-[#8d8d95]">{courseTitle}</p>

        <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-[#8d8d95]">
          {hasLab ? (
            <>
              Lab conducted so far:{" "}
              <span className="font-bold text-[#f4f2ea]">
                {lab.labHours} hrs
              </span>{" "}
              ({lab.sessions} sessions &times; {lab.hoursPerSession}{" "}
              {lab.hoursPerSession === 1 ? "hr" : "hrs"})
              <br />
              Combined: {conducted - absent}/{conducted} &middot; Theory is the remainder.
            </>
          ) : (
            "No lab sessions found in the timetable for this course."
          )}
        </p>

        {hasLab && (
          <label className="mt-4 flex flex-col gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
            Lab classes missed
            <input
              type="number"
              min={0}
              max={lab.sessions}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-[13px] font-normal normal-case tracking-normal text-[#f4f2ea] outline-none focus:border-[#e7a63f]/60"
            />
          </label>
        )}

        {hasLab && !invalidReason && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
                  Theory
                </p>
                <p className="mt-1 text-[13px] font-bold">
                  {theoryConducted - theoryAbsent}/{theoryConducted} &middot;{" "}
                  {pct(theoryConducted - theoryAbsent, theoryConducted)}
                </p>
              </div>
              <span
                className="font-[Unbounded,sans-serif] text-xl font-black"
                style={{ color: marginColor(theoryMargin) }}
              >
                {Math.abs(theoryMargin)}
                <span className="ml-1 align-middle font-[Space_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.12em]">
                  {theoryMargin < 0 ? "req" : "margin"}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d8d95]">
                  Lab
                </p>
                <p className="mt-1 text-[13px] font-bold">
                  {lab.labHours - Math.min(labAbsentHours, lab.labHours)}/{lab.labHours} &middot;{" "}
                  {pct(lab.labHours - Math.min(labAbsentHours, lab.labHours), lab.labHours)}
                </p>
              </div>
              <span
                className="font-[Unbounded,sans-serif] text-xl font-black"
                style={{ color: marginColor(labMargin) }}
              >
                {Math.abs(labMargin)}
                <span className="ml-1 align-middle font-[Space_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.12em]">
                  {labMargin < 0 ? "req" : "margin"}
                </span>
              </span>
            </div>
          </div>
        )}

        {invalidReason && (
          <p className="mt-4 text-[13px] leading-relaxed text-[#e08080]">{invalidReason}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {missed > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="h-10 rounded-xl border border-white/10 px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95] transition hover:bg-white/5 hover:text-[#f4f2ea]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d8d95] transition hover:bg-white/5 hover:text-[#f4f2ea]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!!invalidReason || !hasLab}
            onClick={() => onApply(missedNum)}
            className="h-10 rounded-xl bg-[#e7a63f] px-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#241203] transition hover:bg-[#e7a63f]/90 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
