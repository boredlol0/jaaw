import * as cheerio from "cheerio";
import { BASE_URL, DEFAULT_HEADERS, LOGIN_URL } from "../config";
import { HttpError } from "./errors";
import type { CaptchaRequiredDetail } from "../types";

type CookieMap = Map<string, string>;

export class SessionManager {
  private cookies: CookieMap;

  constructor(initialCookies?: Record<string, string>) {
    this.cookies = new Map<string, string>();

    if (initialCookies) {
      for (const [key, value] of Object.entries(initialCookies)) {
        this.cookies.set(key, value);
      }
    }
  }

  getCookieObject(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }

  async get(url: string, options?: { followRedirects?: boolean }): Promise<Response> {
    return this.request(url, {
      method: "GET",
      redirect: options?.followRedirects === false ? "manual" : "follow",
    });
  }

  async postForm(
    url: string,
    data: Record<string, string>,
    options?: { followRedirects?: boolean },
  ): Promise<Response> {
    return this.request(url, {
      method: "POST",
      body: new URLSearchParams(data),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      redirect: options?.followRedirects === false ? "manual" : "follow",
    });
  }

  async signIn(
    username: string,
    password: string,
    captcha?: string,
    cdigest?: string,
  ): Promise<boolean> {
    this.cookies = new Map<string, string>();

    const payload: Record<string, string> = {
      username,
      password,
      client_portal: "true",
      portal: "10002227248",
      servicename: "ZohoCreator",
      serviceurl: BASE_URL,
      is_ajax: "true",
      grant_type: "password",
      service_language: "en",
    };

    if (cdigest) {
      payload.cdigest = cdigest;
    }

    if (captcha) {
      payload.captcha = captcha;
    }

    const loginResponse = await this.postForm(LOGIN_URL, payload);
    const loginText = await loginResponse.text();

    if (loginText.toLowerCase().includes("concurrent")) {
      const terminated = await this.killConcurrentSessions(loginText);
      if (terminated) {
        return this.signIn(username, password, captcha, cdigest);
      }
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(loginText);
    } catch {
      throw new Error("Invalid credentials");
    }

    if (!isRecord(parsed)) {
      throw new Error("Invalid credentials");
    }

    if (parsed.status === "fail") {
      const code = typeof parsed.code === "string" ? parsed.code : null;
      if ((code === "HIP_REQUIRED" || code === "HIP_FAILED") && typeof parsed.cdigest === "string") {
        const detail: CaptchaRequiredDetail = {
          type: "CAPTCHA_REQUIRED",
          message: typeof parsed.message === "string" ? parsed.message : "Captcha required",
          cdigest: parsed.cdigest,
          image: `${BASE_URL}accounts/p/40-10002227248/webclient/v1/captcha/${parsed.cdigest}?darkmode=false`,
        };

        throw new HttpError(401, detail);
      }

      if (isRecord(parsed.error) && typeof parsed.error.msg === "string") {
        throw new Error(parsed.error.msg);
      }
    }

    if (!isRecord(parsed.data)) {
      throw new Error("Invalid credentials");
    }

    const accessToken = typeof parsed.data.access_token === "string" ? parsed.data.access_token : null;
    const redirectUrl = typeof parsed.data.oauthorize_uri === "string" ? parsed.data.oauthorize_uri : null;

    if (!accessToken || !redirectUrl) {
      throw new Error("Invalid credentials");
    }

    await this.get(`${redirectUrl}&access_token=${accessToken}`);

    if (!this.cookies.has("JSESSIONID")) {
      throw new Error("No JSESSIONID received");
    }

    return true;
  }

  private async killConcurrentSessions(htmlContent: string): Promise<boolean> {
    const $ = cheerio.load(htmlContent);
    const forms = $("form").toArray();
    let terminateForm = forms.find((form) => {
      const text = $(form).text().toLowerCase();
      const hasTerminateButton =
        $(form).find("input[value='Terminate All Sessions']").length > 0;
      return text.includes("terminate") || hasTerminateButton;
    });

    if (!terminateForm && forms.length > 0) {
      terminateForm = forms[0];
    }

    if (!terminateForm) {
      return false;
    }

    const action = $(terminateForm).attr("action");
    if (!action) {
      return false;
    }

    const actionUrl = new URL(action, BASE_URL).toString();
    const data: Record<string, string> = {};

    $(terminateForm)
      .find("input")
      .each((_, input) => {
        const name = $(input).attr("name");
        if (name) {
          data[name] = $(input).attr("value") ?? "";
        }
      });

    const submit = $(terminateForm).find("button, input[type='submit']").first();
    const submitName = submit.attr("name");
    if (submitName) {
      data[submitName] = submit.attr("value") ?? "";
    }

    try {
      const response = await this.postForm(actionUrl, data);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(DEFAULT_HEADERS);

    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    this.captureCookies(response);
    return response;
  }

  private buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private captureCookies(response: Response): void {
    const responseHeaders = response.headers as Headers & {
      getSetCookie?: () => string[];
    };

    const setCookies = responseHeaders.getSetCookie?.() ?? [];

    for (const header of setCookies) {
      const [cookiePart] = header.split(";");
      const separatorIndex = cookiePart.indexOf("=");
      if (separatorIndex < 1) {
        continue;
      }

      const name = cookiePart.slice(0, separatorIndex).trim();
      const value = cookiePart.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
