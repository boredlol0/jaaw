import * as cheerio from "cheerio";
import type { AttendanceRecord } from "../../types";
import { strip } from "../../utils/text";

const COURSE_CODE_PATTERN = /^[A-Z0-9]{8,12}/;

export class AttendanceParser {
  static extract(htmlContent: string | null): AttendanceRecord[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const table = $("table[align=center]").filter((_, el) =>
      $(el).text().includes("Course Code") && $(el).text().includes("Attn %")
    ).first();

    if (!table.length) return [];

    const courses: AttendanceRecord[] = [];

    table.find("tr").each((_, row) => {
      const columns = $(row).find("td").toArray();
      if (columns.length < 7) return;

      const codeText = strip($(columns[0]).text());
      if (!COURSE_CODE_PATTERN.test(codeText)) return;

      const code = codeText.replace("Regular", "").trim();
      const title = strip($(columns[1]).text());
      const type = strip($(columns[2]).text());
      const slot = strip($(columns[4]).text());

      if (columns.length === 7) {
        const pctText = strip($(columns[6]).text());
        const percent = Number.parseFloat(pctText);
        if (Number.isNaN(percent)) return;

        courses.push({
          courseCode: code, courseTitle: title, courseType: type, slot,
          classesConducted: 0, classesAbsent: 0,
          attendancePercentage: percent,
        });
        return;
      }

      const conducted = Number.parseInt(strip($(columns[6]).text()), 10);
      const absent = Number.parseInt(strip($(columns[7]).text()), 10);
      const percent = Number.parseFloat(strip($(columns[8]).text()));

      if (Number.isNaN(conducted) || Number.isNaN(absent) || Number.isNaN(percent)) return;

      courses.push({
        courseCode: code, courseTitle: title, courseType: type, slot,
        classesConducted: conducted, classesAbsent: absent,
        attendancePercentage: percent,
      });
    });

    return courses;
  }
}
