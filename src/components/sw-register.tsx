"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and silently promotes new versions.
 *
 * When a deploy lands, the browser picks up the new sw.js, installs it,
 * and we post SKIP_WAITING so it activates immediately. The page reloads
 * naturally on the next navigation/visit — no prompt.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        const promote = (worker: ServiceWorker) => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        };

        if (reg.waiting) {
          promote(reg.waiting);
          return;
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") promote(newWorker);
          });
        });
      } catch (err) {
        console.warn("[jaaw sw] registration failed:", err);
      }
    };

    register();
  }, []);

  return null;
}
