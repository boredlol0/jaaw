"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Download } from "lucide-react";
import type { ScheduleDay } from "@/lib/api";
import { parseTime, timeToMinutes } from "./utils";
import { isMobile } from 'react-device-detect';

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

export function TimetableImageDownload({
  schedule,
}: {
  schedule: ScheduleDay[];
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
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#0a0a0b",
        logging: false,
        useCORS: true,
      });
      el.style.width = "";
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
          <img src="/logo.png" alt="" className="cx-tt-export-logo" />
          <div className="cx-tt-export-title">Timetable</div>
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
                          <div className="cx-tt-export-code">{entry.courseCode}</div>
                          <div className="cx-tt-export-cell-title">{entry.courseTitle}</div>
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
