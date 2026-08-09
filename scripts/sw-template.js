/**
 * Built by scripts/generate-sw.mjs via workbox-build `injectManifest`, which
 * replaces the manifest placeholder with the precache list and `__BUILD_SHA__`
 * with CF_PAGES_COMMIT_SHA (fallback: git HEAD, then a timestamp).
 */

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  getCacheKeyForURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

const VERSION = "__BUILD_SHA__";

const PAGE_CACHE = "jaaw-pages";
const FONT_CACHE = "jaaw-fonts";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Map a navigation pathname to its static-exported HTML file.
 * `/dash/attendance` -> `/dash/attendance.html`, `/` -> `/index.html`.
 */
function resolveRouteHtml(pathname) {
  const cleaned = pathname.replace(/\/+$/, "");
  if (cleaned === "" || cleaned === "/") return "/index.html";
  return `${cleaned}.html`;
}

async function serveCachedHtml(pathname) {
  const fallbackUrl = resolveRouteHtml(pathname);
  const fallbackKey = getCacheKeyForURL(fallbackUrl);
  if (fallbackKey) {
    const cached = await caches.match(fallbackKey);
    if (cached) return cached;
  }
  const indexKey = getCacheKeyForURL("/index.html");
  if (indexKey) {
    const cached = await caches.match(indexKey);
    if (cached) return cached;
  }
  return null;
}

const navigationRoute = new NavigationRoute(async ({ request, url }) => {
  try {
    const response = await new NetworkFirst({
      cacheName: PAGE_CACHE,
    }).handle({ request });
    if (response && response.ok) return response;
    throw new Error("navigation failed");
  } catch {
    const fallback = await serveCachedHtml(url.pathname);
    if (fallback) return fallback;
    return Response.error();
  }
});

registerRoute(navigationRoute);

const FONT_ORIGINS = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://fonts.cdnfonts.com",
];

registerRoute(
  ({ url }) => FONT_ORIGINS.some((origin) => url.origin === origin),
  new StaleWhileRevalidate({
    cacheName: FONT_CACHE,
  })
);

self.addEventListener("install", () => {
  console.log(`[jaaw sw] installed (build ${VERSION})`);
});

self.addEventListener("activate", () => {
  console.log(`[jaaw sw] activated (build ${VERSION})`);
});
