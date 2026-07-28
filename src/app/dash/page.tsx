import { Suspense } from "react";
import DashPageInner from "@/components/dashboard/dash-page";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="dash-spinner mx-auto mt-20" />}>
      <DashPageInner tab="home" />
    </Suspense>
  );
}
