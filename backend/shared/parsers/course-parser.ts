import * as cheerio from "cheerio";
import type { CourseCatalogEntry, CourseSlot, CourseSlotLookup } from "../../types";
import { strip } from "../../utils/text";

export class CourseParser {
  static extract(htmlContent: string | null): CourseCatalogEntry[] {
    const slotLookup = this.buildSlotMap(htmlContent);
    const grouped = new Map<string, CourseCatalogEntry>();

    for (const entry of Object.values(slotLookup)) {
      const existing = grouped.get(entry.courseCode);
      const slot: CourseSlot = {
        slotCode: entry.slotCode,
        slotType: entry.slotType,
        rawType: entry.rawType,
        faculty: entry.faculty,
        room: entry.room,
        slotLabel: entry.slotLabel,
      };

      if (!existing) {
        grouped.set(entry.courseCode, {
          courseCode: entry.courseCode,
          courseTitle: entry.courseTitle,
          credits: entry.credits,
          slots: [slot],
        });
        continue;
      }

      existing.slots.push(slot);
    }

    return Array.from(grouped.values()).map((course) => ({
      ...course,
      slots: course.slots.sort((a, b) => a.slotCode.localeCompare(b.slotCode)),
    }));
  }

  static buildSlotMap(htmlContent: string | null): Record<string, CourseSlotLookup> {
    if (!htmlContent) return {};

    const $ = cheerio.load(htmlContent);
    const table = $("table.course_tbl");

    if (!table.length) return {};

    const slotLookup: Record<string, CourseSlotLookup> = {};

    table.find("tr").each((_, row) => {
      const cells = $(row).find("td").toArray();
      if (cells.length < 11) return;

      const sno = strip($(cells[0]).text());
      if (sno.toLowerCase() === "s.no" || sno === "") return;

      const courseCode = strip($(cells[1]).text());
      if (!courseCode || courseCode.length < 3) return;

      let faculty = strip($(cells[7]).text());
      if (faculty.includes("Lab Based")) faculty = "Unknown";

      const slotLabel = strip($(cells[8]).text());

      const base = {
        courseCode,
        courseTitle: strip($(cells[2]).text()),
        credits: strip($(cells[3]).text()),
        rawType: strip($(cells[6]).text()),
        faculty,
        room: strip($(cells[9]).text()),
        slotLabel,
      };

      const codes = slotLabel
        .replace(/[-/,+]/g, " ")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const code of codes) {
        const upper = code.toUpperCase();
        slotLookup[code] = {
          ...base,
          slotCode: code,
          slotType:
            upper.startsWith("P") || upper.startsWith("L") || upper === "LAB"
              ? "Practical" : "Theory",
        };
      }
    });

    return slotLookup;
  }
}
