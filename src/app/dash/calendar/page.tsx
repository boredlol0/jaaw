import { Suspense } from "react";
import DashPageInner from "@/components/dashboard/dash-page";

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="dash-spinner mx-auto mt-20" />}>
      <DashPageInner tab="calendar" />
    </Suspense>
  );
}
