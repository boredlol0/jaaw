import { SP_HEADERS } from "./sp-config";

type CookieMap = Map<string, string>;

export class SpSession {
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

  cookieNames(): string[] {
    return Array.from(this.cookies.keys());
  }

  async get(url: string, extraHeaders?: Record<string, string>): Promise<Response> {
    return this.request(url, { method: "GET" }, extraHeaders);
  }

  async getBytes(url: string, extraHeaders?: Record<string, string>): Promise<{ contentType: string; bytes: Uint8Array }> {
    const res = await this.get(url, extraHeaders);
    const buffer = new Uint8Array(await res.arrayBuffer());
    return { contentType: res.headers.get("content-type") ?? "", bytes: buffer };
  }

  async postForm(
    url: string,
    data: Record<string, string>,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    return this.request(
      url,
      {
        method: "POST",
        body: new URLSearchParams(data),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      },
      extraHeaders,
    );
  }

  private async request(url: string, init: RequestInit, extraHeaders?: Record<string, string>): Promise<Response> {
    let currentUrl = url;
    let currentInit: RequestInit = init;

    for (let hop = 0; hop <= 10; hop++) {
    const headers = new Headers(SP_HEADERS);
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    }
    if (currentInit.headers) {
      new Headers(currentInit.headers).forEach((value, key) => headers.set(key, value));
    }
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) headers.set("cookie", cookieHeader);

    // Manual redirects: fetch's transparent following drops Set-Cookie headers
    // from intermediate 3xx responses (e.g. a rotated JSESSIONID on login),
    // so walk the chain and capture cookies at every hop.
    const response = await fetch(currentUrl, { ...currentInit, headers, redirect: "manual" });
    this.captureCookies(response);

    const status = response.status;
    const location = response.headers.get("location");
    if (
      (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
      location
    ) {
      await response.arrayBuffer().catch(() => undefined);
      currentUrl = new URL(location, currentUrl).toString();
      if (status === 301 || status === 302 || status === 303) {
        const nextHeaders: Record<string, string> = {};
        new Headers(currentInit.headers).forEach((value, key) => {
          if (key.toLowerCase() !== "content-type" && key.toLowerCase() !== "content-length") {
            nextHeaders[key] = value;
          }
        });
        currentInit = { method: "GET", headers: nextHeaders };
      }
      continue;
    }
    return response;
    }

    throw new Error("Too many redirects");
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
      if (separatorIndex < 1) continue;
      const name = cookiePart.slice(0, separatorIndex).trim();
      const value = cookiePart.slice(separatorIndex + 1).trim();
      this.cookies.set(name, value);
    }
  }
}
