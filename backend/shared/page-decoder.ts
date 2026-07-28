import * as cheerio from "cheerio";

export class PageDecoder {
  static decode(rawHtml: string): string | null {
    if (!rawHtml) {
      return null;
    }

    if (
      rawHtml.toLowerCase().includes("concurrent") &&
      rawHtml.toLowerCase().includes("terminate")
    ) {
      return "CONCURRENT_ERROR";
    }

    const sanitizedMatch = rawHtml.match(/pageSanitizer\.sanitize\('(.+?)'\)/);
    if (sanitizedMatch?.[1]) {
      try {
        return sanitizedMatch[1]
          .replace(/\\u([\dA-Fa-f]{4})/g, (_, code: string) =>
            String.fromCharCode(Number.parseInt(code, 16)),
          )
          .replace(/\\x([\dA-Fa-f]{2})/g, (_, code: string) =>
            String.fromCharCode(Number.parseInt(code, 16)),
          )
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\-/g, "-")
          .replace(/\\\//g, "/");
      } catch {
        return null;
      }
    }

    const $ = cheerio.load(rawHtml);
    const hiddenValue = $("div.zc-pb-embed-placeholder-content").attr("zmlvalue");

    if (hiddenValue) {
      return hiddenValue
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\\-/g, "-")
        .replace(/\\\//g, "/");
    }

    return null;
  }
}
