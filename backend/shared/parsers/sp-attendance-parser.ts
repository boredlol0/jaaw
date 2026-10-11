import * as cheerio from "cheerio";
import type { AttendanceRecord } from "../../types";
import { strip } from "../../utils/text";

const COURSE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

/**
 * Parses the Student Portal attendance page
 * (Course Wise Attendance: Code / Description / Max. hours / Att. hours / Absent hours / Total Percentage).
 * Returns the same AttendanceRecord shape as the academia parser so the frontend needs no changes.
 */
export class SpAttendanceParser {
  static extract(htmlContent: string | null): AttendanceRecord[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const table = $("table")
      .filter((_, el) => {
        const head = $(el).find("thead").text();
        return head.includes("Max. hours") && head.includes("Total Percentage");
      })
      .first();

    if (!table.length) return [];

    const courses: AttendanceRecord[] = [];

    table.find("tbody tr").each((_, row) => {
      const columns = $(row).find("td").toArray();
      if (columns.length < 6) return;

      const code = strip($(columns[0]).text());
      if (!COURSE_CODE_PATTERN.test(code)) return;

      const title = strip($(columns[1]).text());
      const conducted = Number.parseInt(strip($(columns[2]).text()), 10);
      const absent = Number.parseInt(strip($(columns[4]).text()), 10);
      const percent = Number.parseFloat(strip($(columns[5]).text()));

      if (Number.isNaN(conducted) || Number.isNaN(absent) || Number.isNaN(percent)) return;

      courses.push({
        courseCode: code,
        courseTitle: title,
        courseType: "Theory",
        slot: "",
        classesConducted: conducted,
        classesAbsent: absent,
        attendancePercentage: percent,
      });
    });

    return courses;
  }
}
