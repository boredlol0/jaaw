"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Download } from "lucide-react";
import type { ScheduleDay } from "@/lib/api";
import { parseTime, timeToMinutes, normalizeSubject } from "./utils";
import { isMobile } from 'react-device-detect';
import Image from "next/image";

function extractAllTimeSlots(days: ScheduleDay[]): { start: string; end: string; minutes: number }[] {
  const seen = new Set<string>();
  const slots: { start: string; end: string; minutes: number }[] = [];

  for (const day of days) {
    for (const entry of day.entries) {
      const key = `${parseTime(entry.startTime)}-${parseTime(entry.endTime)}`;
      if (!seen.has(key)) {
        seen.add(key);
        slots.push({
          start: parseTime(entry.startTime),
          end: parseTime(entry.endTime),
          minutes: timeToMinutes(entry.startTime),
        });
      }
    }
  }

  slots.sort((a, b) => a.minutes - b.minutes);
  return slots;
}

function dayLabel(day: ScheduleDay): string {
  const num = day.dayLabel.replace(/[^0-9]/g, "");
  return `DO${num}`;
}

function findEntry(day: ScheduleDay, start: string): ScheduleDay["entries"][number] | undefined {
  return day.entries.find((e) => parseTime(e.startTime) === start);
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

function fitFontSize(el: HTMLElement, availW: number, availH: number): number {
  const text = (el.textContent || "").trim();
  if (!text) return 0;
  const ctx = getMeasureCtx();
  if (!ctx) return 10;

  const cs = window.getComputedStyle(el);
  const words = text.split(/\s+/);
  const lineHeight = 1.2;

  for (let size = 18; size >= 6; size--) {
    ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    const spaceW = ctx.measureText(" ").width;
    let lines = 1;
    let lineW = 0;
    let fits = true;
    for (const word of words) {
      const ww = ctx.measureText(word).width;
      if (ww > availW) {
        fits = false;
        break;
      }
      const add = lineW === 0 ? ww : ww + spaceW;
      if (lineW + add <= availW) lineW += add;
      else {
        lines += 1;
        lineW = ww;
      }
    }
    if (!fits) continue;
    if (lines * size * lineHeight <= availH) return size;
  }
  return 6;
}

function sizeExportText(table: HTMLElement): HTMLElement[] {
  const sized: HTMLElement[] = [];
  table.querySelectorAll<HTMLElement>(".cx-tt-export-cell-title").forEach((title) => {
    const td = title.closest<HTMLElement>(".cx-tt-export-td");
    if (!td) return;
    const room = title.parentElement?.querySelector<HTMLElement>(".cx-tt-export-room");

    const cs = window.getComputedStyle(td);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const borderL = parseFloat(cs.borderLeftWidth) || 0;

    const availW = td.clientWidth - padL - padR - borderL;
    const availH = td.clientHeight - padT - padB;
    const gap = 3;
    const roomH = room && room.textContent ? room.offsetHeight + gap : 0;
    const titleH = Math.max(20, availH - roomH);

    const size = fitFontSize(title, availW, titleH);
    if (size > 0) {
      title.style.fontSize = `${size}px`;
      sized.push(title);
    }
  });
  return sized;
}

function resetExportText(sized: HTMLElement[]): void {
  sized.forEach((el) => {
    el.style.fontSize = "";
  });
}

export function TimetableImageDownload({
  schedule,
  semester,
}: {
  schedule: ScheduleDay[];
  semester?: string;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const timeSlots = extractAllTimeSlots(schedule);
  const sortedDays = [...schedule].sort((a, b) => {
    const an = Number.parseInt(a.dayLabel.replace(/[^0-9]/g, "")) || 0;
    const bn = Number.parseInt(b.dayLabel.replace(/[^0-9]/g, "")) || 0;
    return an - bn;
  });

  const handleDownload = async () => {
    if (!tableRef.current || timeSlots.length === 0) return;
    setDownloading(true);
    try {
      const el = tableRef.current;
      await document.fonts.ready;
      const fixedW = Math.max(600, 72 + timeSlots.length * 150 + 56);
      el.style.width = `${fixedW}px`;
      const sized = sizeExportText(el);
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#0a0a0b",
          logging: false,
          useCORS: true,
        });
      } finally {
        resetExportText(sized);
        el.style.width = "";
      }
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const file = new File([blob], "timetable.png", { type: "image/png" });
      if (isMobile && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: "Timetable", title: "Timetable" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "timetable.png";
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  if (timeSlots.length === 0) return null;

  const hasLab = sortedDays.some((d) => d.entries.some((e) => e.slotType.toLowerCase() === "practical"));
  const hasTheory = sortedDays.some((d) => d.entries.some((e) => e.slotType.toLowerCase() !== "practical"));

  return (
    <>
      <button
        className="cx-tt-dl-btn"
        onClick={handleDownload}
        disabled={downloading}
        aria-label="Download timetable as image"
      >
        <Download size={14} strokeWidth={2} />
        {downloading ? "..." : "Download"}
      </button>

      <div ref={tableRef} className="cx-tt-table-export">
        <div className="cx-tt-export-top-bar">
          <Image src="/logo.png" alt="" className="cx-tt-export-logo" width={40} height={40} />
          <div className="cx-tt-export-title">
            <span className="cx-tt-export-title-main">Timetable</span>
            {semester && semester.trim() && semester !== "N/A" && (
              <span className="cx-tt-export-title-sub">Semester {semester}</span>
            )}
          </div>
        </div>

        <table className="cx-tt-export-table">
          <thead>
            <tr>
              <th className="cx-tt-export-th cx-tt-export-th-day"></th>
              {timeSlots.map((slot, i) => (
                <th key={i} className="cx-tt-export-th">
                  <span className="cx-tt-export-th-start">{slot.start}</span>
                  <span className="cx-tt-export-th-end">{slot.end}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDays.map((day, di) => (
              <tr key={di}>
                <td className="cx-tt-export-td cx-tt-export-td-day">{dayLabel(day)}</td>
                {timeSlots.map((slot, si) => {
                  const entry = findEntry(day, slot.start);
                  const isLab = entry?.slotType.toLowerCase() === "practical";
                  return (
                    <td
                      key={si}
                      className={`cx-tt-export-td${entry ? (isLab ? " is-lab" : " is-theory") : ""}`}
                    >
                      {entry ? (
                        <div className="cx-tt-export-cell">
                          <div className="cx-tt-export-cell-title">{normalizeSubject(entry.courseTitle)}</div>
                          <div className="cx-tt-export-room">{entry.room}</div>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cx-tt-export-footer">
          {(hasLab || hasTheory) ? (
            <div className="cx-tt-export-legend">
              {hasTheory && (
                <span className="cx-tt-legend-item">
                  <span className="cx-tt-legend-swatch is-theory" />
                  Theory
                </span>
              )}
              {hasLab && (
                <span className="cx-tt-legend-item">
                  <span className="cx-tt-legend-swatch is-lab" />
                  Lab
                </span>
              )}
            </div>
          ) : <span />}
          <span className="cx-tt-export-watermark">powered by jaaw</span>
        </div>
      </div>
    </>
  );
}
