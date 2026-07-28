"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, type StoredDashData, type StoredSession } from "@/lib/storage";

export function useAuthGuard({ skipRedirect = false }: { skipRedirect?: boolean } = {}) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [dash, setDash] = useState<StoredDashData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = loadSession();
    if (!loaded?.session) {
      if (!skipRedirect) router.replace("/");
      return;
    }
    setSession(loaded.session);
    setDash(loaded.dash);
    setAuthChecked(true);
  }, [router, skipRedirect]);

  return { session, dash, setDash, authChecked, mounted };
}
