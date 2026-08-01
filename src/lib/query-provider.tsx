"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { updateDashSection, type DashSection } from "@/lib/storage";

const DASH_SECTIONS = new Set<string>([
  "profile",
  "attendance",
  "marks",
  "schedule",
  "courses",
  "calendar",
]);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 1000 * 60 * 60 * 24,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        queryCache: new QueryCache({
          onSuccess: (_data, query) => {
            const section = query.queryKey[0];
            if (typeof section === "string" && DASH_SECTIONS.has(section)) {
              updateDashSection(section as DashSection, query.state.data);
            }
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
