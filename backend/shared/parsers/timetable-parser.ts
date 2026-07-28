import * as cheerio from "cheerio";
import type { CourseSlotLookup, ScheduleDay, ScheduleEntry } from "../../types";
import { strip } from "../../utils/text";

export class TimetableParser {
  static extract(
    htmlContent: string | null,
    courseSlotLookup: Record<string, CourseSlotLookup>,
  ): ScheduleDay[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const table = $("table[align=center][width=400]").filter((_, el) =>
      $(el).text().toLowerCase().includes("unified time table")
    ).first();

    if (!table.length) return [];

    const rows = table.find("tr").toArray();
    if (rows.length < 3) return [];

    const timeHeaders = $(rows[0])
      .find("td, th")
      .toArray()
      .map((cell) => strip($(cell).text()))
      .filter((text) => text.includes(":") && !text.toLowerCase().includes("from"));

    if (timeHeaders.length === 0) return [];

    const schedule: ScheduleDay[] = [];

    for (const row of rows) {
      const columns = $(row).find("td").toArray();
      if (columns.length < 2) continue;

      const dayText = strip($(columns[0]).text());
      const dayMatch = dayText.match(/Day\s*(\d+)/i);
      if (!dayMatch) continue;

      const entries: ScheduleEntry[] = [];

      columns.slice(1).forEach((cell, index) => {
        if (index >= timeHeaders.length) return;

        const rawSlot = strip($(cell).text());
        const slotCode = strip(rawSlot.split("/")[0]);
        const slotDetails = courseSlotLookup[slotCode];

        if (!slotCode || slotCode === "-" || !slotDetails) return;

        const timeLabel = normalizeTimeLabel(timeHeaders[index]);
        const [startTime, endTime] = splitTimeLabel(timeLabel);

        entries.push({
          slotCode,
          courseCode: slotDetails.courseCode,
          courseTitle: slotDetails.courseTitle,
          slotType: slotDetails.slotType,
          rawType: slotDetails.rawType,
          room: slotDetails.room || "TBA",
          faculty: slotDetails.faculty || "TBA",
          timeLabel,
          startTime,
          endTime,
        });
      });

      schedule.push({ dayLabel: `Day ${dayMatch[1]}`, entries });
    }

    return schedule;
  }
}

function normalizeTimeLabel(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
}

function splitTimeLabel(value: string): [string, string] {
  const [start = "", end = ""] = value.split("-").map((part) => strip(part));
  return [start, end];
}
