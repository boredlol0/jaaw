import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { AcademicCalendar, CalendarEntry, CalendarMonth } from "../../types";
import { strip } from "../../utils/text";

const MONTH_LOOKUP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export class CalendarParser {
  static extract(
    htmlContent: string | null,
    plannerType: "ODD" | "EVEN",
  ): AcademicCalendar {
    if (!htmlContent) {
      return {
        plannerType,
        academicYearLabel: "",
        sourcePage: "",
        months: [],
      };
    }

    const $ = cheerio.load(htmlContent);
    const title = strip($("h2, h3").filter((_, el) => $(el).text().includes("Academic Planner")).first().text());
    const table = $("table").first();

    if (table.length === 0) {
      return {
        plannerType,
        academicYearLabel: extractAcademicYearLabel(title),
        sourcePage: extractSourcePage(plannerType),
        months: [],
      };
    }

    const rows = table.find("tr").toArray();
    const headerCells = table.find("th").toArray();
    const monthHeaders = extractMonthHeaders($, headerCells);
    const months = new Map<string, CalendarMonth>();

    for (const row of rows) {
      const cells = $(row).find("td").toArray();
      if (cells.length === 0) {
        continue;
      }

      monthHeaders.forEach((monthHeader, groupIndex) => {
        const base = groupIndex * 5;
        if (base + 4 >= cells.length) {
          return;
        }

        const dayOfMonth = strip($(cells[base]).text());
        const day = strip($(cells[base + 1]).text());
        const titleText = strip($(cells[base + 2]).text());
        const dayOrder = strip($(cells[base + 3]).text());

        if (!dayOfMonth || !day || !/^\d+$/.test(dayOfMonth)) {
          return;
        }

        const date = `${monthHeader.year}-${String(monthHeader.monthIndex).padStart(2, "0")}-${dayOfMonth.padStart(2, "0")}`;
        const entry: CalendarEntry = {
          date,
          day,
          title: titleText || null,
          dayOrder: sanitizeValue(dayOrder),
          category: getCategory(titleText, dayOrder),
          month: monthHeader.month,
          monthIndex: monthHeader.monthIndex,
          rawMonthLabel: monthHeader.label,
        };

        const monthKey = `${monthHeader.year}-${monthHeader.monthIndex}`;
        const existingMonth = months.get(monthKey);
        if (!existingMonth) {
          months.set(monthKey, {
            month: monthHeader.month,
            monthIndex: monthHeader.monthIndex,
            year: monthHeader.year,
            label: monthHeader.label,
            entries: [entry],
          });
          return;
        }

        existingMonth.entries.push(entry);
      });
    }

    return {
      plannerType,
      academicYearLabel: extractAcademicYearLabel(title),
      sourcePage: extractSourcePage(plannerType),
      months: Array.from(months.values()).map((month) => ({
        ...month,
        entries: month.entries.sort((left, right) => left.date.localeCompare(right.date)),
      })),
    };
  }

  static resolveSemester(now = new Date()): "ODD" | "EVEN" {
    const month = now.getMonth() + 1;
    return month >= 7 ? "ODD" : "EVEN";
  }
}

function extractMonthHeaders($: cheerio.CheerioAPI, headerCells: Element[]) {
  return headerCells
    .map((cell) => strip($(cell).text()))
    .filter((text) => /^[A-Za-z]{3}\s+'\d{2}$/.test(text))
    .map((label) => {
      const match = label.match(/^([A-Za-z]{3})\s+'(\d{2})$/);
      if (!match) {
        return null;
      }

      const month = match[1];
      const monthIndex = MONTH_LOOKUP[month];
      const year = 2000 + Number.parseInt(match[2], 10);
      if (!monthIndex) {
        return null;
      }

      return { label, month, monthIndex, year };
    })
    .filter((value): value is { label: string; month: string; monthIndex: number; year: number } => Boolean(value));
}

function getCategory(title: string, dayOrder: string): CalendarEntry["category"] {
  const normalizedTitle = strip(title).toLowerCase();
  const normalizedDayOrder = strip(dayOrder);

  if (!normalizedTitle && sanitizeValue(normalizedDayOrder) === null) {
    return "empty";
  }

  if (normalizedTitle.includes("holiday")) {
    return "holiday";
  }

  if (normalizedDayOrder && normalizedDayOrder !== "-") {
    return "working-day";
  }

  return "event";
}

function sanitizeValue(value: string): string | null {
  const cleaned = strip(value);
  return cleaned && cleaned !== "-" ? cleaned : null;
}

function extractAcademicYearLabel(title: string): string {
  const match = title.match(/(\d{4})\s*-\s*(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function extractSourcePage(plannerType: "ODD" | "EVEN"): string {
  return plannerType === "ODD" ? "Academic_Planner_2025_26_ODD" : "Academic_Planner_2025_26_EVEN";
}
