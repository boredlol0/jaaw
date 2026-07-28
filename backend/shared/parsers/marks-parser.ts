import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { MarkAssessment, MarkRecord } from "../../types";
import { strip } from "../../utils/text";

const COURSE_CODE_RE = /^[A-Z0-9]{8,12}$/;

export class MarksParser {
  static extract(htmlContent: string | null): MarkRecord[] {
    if (!htmlContent) return [];

    const $ = cheerio.load(htmlContent);
    const table = $("table[align=center]").filter((_, el) =>
      $(el).text().includes("Course Code") && $(el).text().includes("Test Performance")
    ).first();

    if (!table.length) return [];

    const records: MarkRecord[] = [];

    table.find("tr").each((_, row) => {
      const columns = $(row).find("td").toArray();
      if (columns.length < 3) return;

      const courseCode = strip($(columns[0]).text());
      if (!COURSE_CODE_RE.test(courseCode)) return;

      const courseType = strip($(columns[1]).text());
      const performanceCell = columns[2];
      const assessments: MarkAssessment[] = [];
      let totalGot = 0;
      let totalMax = 0;
      let hasValid = false;

      $(performanceCell)
        .find("table td")
        .each((_, cell) => {
          const parts = extractStrippedStrings($, cell);
          if (parts.length < 2) return;

          const header = parts[0];
          const marks = parts[1];
          const [titlePart, totalPart = "0"] = header.includes("/")
            ? header.split("/", 2)
            : [header, "0"];

          assessments.push({
            title: titlePart.trim(),
            obtainedMarks: marks.trim(),
            maximumMarks: totalPart.trim(),
          });

          const mv = Number.parseFloat(marks);
          const tv = Number.parseFloat(totalPart);
          if (!Number.isNaN(mv) && !Number.isNaN(tv)) {
            totalGot += mv;
            totalMax += tv;
            hasValid = true;
          }
        });

      records.push({
        courseCode,
        courseType,
        summary: hasValid ? `${trimNum(totalGot)}/${trimNum(totalMax)}` : "N/A",
        assessments,
        totalMarksObtained: hasValid ? totalGot : null,
        totalMarksMaximum: hasValid ? totalMax : null,
      });
    });

    return records;
  }
}

function trimNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v);
}

function extractStrippedStrings($: cheerio.CheerioAPI, root: AnyNode): string[] {
  const parts: string[] = [];

  const visit = (node: AnyNode) => {
    if (node.type === "text") {
      const v = strip(node.data);
      if (v) parts.push(v);
      return;
    }
    $(node).contents().toArray().forEach((c) => visit(c as AnyNode));
  };

  visit(root);
  return parts;
}
