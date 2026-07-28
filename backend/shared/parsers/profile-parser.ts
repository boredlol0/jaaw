import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { StudentProfile } from "../../types";
import { strip } from "../../utils/text";

export class ProfileParser {
  static extract(htmlContent: string | null): StudentProfile {
    const profile: StudentProfile = {
      name: "",
      registrationNumber: "Unknown",
      batch: "N/A",
      semester: "N/A",
      department: "N/A",
      section: "N/A",
      mobileNumber: "N/A",
      program: "N/A",
    };

    if (!htmlContent) {
      return profile;
    }

    const $ = cheerio.load(htmlContent);

    const registrationNumber = getStrongValueByLabel($, "Registration Number");
    if (registrationNumber) {
      profile.registrationNumber = registrationNumber;
    }

    const name = getStrongValueByLabel($, "Name");
    if (name) {
      profile.name = name;
    }

    const mobile = getStrongValueByLabel($, "Mobile");
    if (mobile) {
      profile.mobileNumber = mobile;
    }

    const program = getStrongValueByLabel($, "Program");
    if (program) {
      profile.program = program;
    }

    const semester = getStrongValueByLabel($, "Semester");
    if (semester) {
      profile.semester = semester;
    }

    const batch = getStrongValueByLabel($, "Batch");
    if (batch) {
      profile.batch = batch;
    }

    const departmentNode = getStrongNodeByLabel($, "Department");
    if (departmentNode) {
      const fullDepartment = strip($(departmentNode).text());
      const section = strip($(departmentNode).find("font").text());
      profile.section = section || profile.section;
      profile.department = section
        ? fullDepartment.replace(section, "").replace(/-$/, "").trim()
        : fullDepartment;
    }

    return profile;
  }
}

function getStrongValueByLabel(
  $: cheerio.CheerioAPI,
  labelText: string,
): string | null {
  const node = getStrongNodeByLabel($, labelText);
  return node ? strip($(node).text()) : null;
}

function getStrongNodeByLabel(
  $: cheerio.CheerioAPI,
  labelText: string,
): Element | null {
  let match: Element | null = null;

  $("td").each((_, cell) => {
    if (match) {
      return false;
    }

    const text = strip($(cell).text()).toLowerCase();
    if (!text.includes(labelText.toLowerCase())) {
      return;
    }

    const next = $(cell).nextAll("td").slice(0, 3);
    const siblingStrong = next.find("strong").first();
    if (siblingStrong.length > 0) {
      match = siblingStrong.get(0) ?? null;
      return false;
    }
  });

  return match;
}
