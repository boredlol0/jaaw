import * as cheerio from "cheerio";
import type { MarkAssessment, MarkRecord } from "../../types";
import { strip } from "../../utils/text";

const COURSE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;
const VIEW_DETAILS_PATTERN =
  /funViewComponentWiseMarks\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*([0-9]+)\s*\)/;

export interface SpMarkSubject {
  courseCode: string;
  title: string;
  obtained: number | null;
  maximum: number | null;
  subjectId: string | null;
  status: string;
}

/**
 * Parses the Student Portal internal-marks pages.
 * Outer: Code / Description / Mark-Max + View Details button carrying (subjectId, status).
 * Inner: Entered on / Component / Mark-Max rows.
 * Output matches the MarkRecord shape the frontend already uses.
 */
export class SpMarksParser {
  static extractOuter(htmlContent: string | null): SpMarkSubject[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const table = $("table")
      .filter((_, el) => {
        const head = $(el).find("thead").text();
        return head.includes("Mark / Max. Mark") && head.includes("Description");
      })
      .first();

    if (!table.length) return [];

    const subjects: SpMarkSubject[] = [];

    table.find("tbody tr").each((_, row) => {
      const columns = $(row).find("td").toArray();
      if (columns.length < 3) return;

      const code = strip($(columns[0]).text());
      if (!COURSE_CODE_PATTERN.test(code)) return;

      const title = strip($(columns[1]).text());
      const scoreText = strip($(columns[2]).text());

      let obtained: number | null = null;
      let maximum: number | null = null;
      if (scoreText.includes("/")) {
        const [gotRaw, maxRaw] = scoreText.split("/", 2);
        const got = Number.parseFloat(gotRaw.trim());
        const max = Number.parseFloat(maxRaw.trim());
        if (!Number.isNaN(got) && !Number.isNaN(max)) {
          obtained = got;
          maximum = max;
        }
      }

      let subjectId: string | null = null;
      let status = "2";
      const onclick =
        $(row).find("button[onclick]").attr("onclick") ??
        $(row).find("a[onclick]").attr("onclick") ??
        "";
      const match = onclick.match(VIEW_DETAILS_PATTERN);
      if (match) {
        subjectId = match[1];
        status = match[4];
      }

      subjects.push({ courseCode: code, title, obtained, maximum, subjectId, status });
    });

    return subjects;
  }

  static extractInner(htmlContent: string | null): MarkAssessment[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const assessments: MarkAssessment[] = [];

    $("table tbody tr").each((_, row) => {
      const columns = $(row).find("td").toArray();
      if (columns.length < 3) return;

      const title = strip($(columns[1]).text());
      const markText = strip($(columns[2]).text());
      if (!title || !markText.includes("/")) return;

      const [gotRaw, maxRaw] = markText.split("/", 2);
      assessments.push({
        title,
        obtainedMarks: gotRaw.trim(),
        maximumMarks: maxRaw.trim(),
      });
    });

    return assessments;
  }

  static toMarkRecords(
    subjects: SpMarkSubject[],
    assessmentsByCode: Map<string, MarkAssessment[]>,
  ): MarkRecord[] {
    return subjects.map((subject) => {
      const assessments = assessmentsByCode.get(subject.courseCode) ?? [];
      const hasTotals = subject.obtained !== null && subject.maximum !== null;
      return {
        courseCode: subject.courseCode,
        courseType: "Internal",
        summary: hasTotals ? `${subject.obtained}/${subject.maximum}` : "N/A",
        assessments,
        totalMarksObtained: hasTotals ? subject.obtained : null,
        totalMarksMaximum: hasTotals ? subject.maximum : null,
      };
    });
  }
}
