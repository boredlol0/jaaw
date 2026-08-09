"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * Fixed top banner shown while the browser reports being offline.
 * The service worker serves cached assets, so the app still works —
 * this just lets the user know the data may be stale.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, () => true);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-10050 flex items-center justify-center gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 font-mono text-[11px] tracking-tight text-amber-300 backdrop-blur-md animate-in fade-in slide-in-from-top duration-300"
    >
      <span className="relative flex size-1.5 shrink-0">
        {/* <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" /> */}
        <span className="relative inline-flex size-1.5 rounded-full bg-amber-400" />
      </span>
      you&apos;re offline — showing cached data
    </div>
  );
}
