import { timeToMinutes } from "./utils";

export function BreakIndicator({
  prevEnd,
  nextStart,
}: {
  prevEnd: string;
  nextStart: string;
}) {
  const gapMins =
    timeToMinutes(nextStart) - timeToMinutes(prevEnd);

  const hours = Math.floor(gapMins / 60);
  const mins = gapMins % 60;

  let label: string;
  if (hours > 0 && mins > 0) {
    label = `${hours}h ${mins}m break`;
  } else if (hours > 0) {
    label = `${hours}h break`;
  } else {
    label = `${mins}m break`;
  }

  return (
    <div className="flex items-center justify-center gap-3 py-1.5">
      <svg
        className="shrink-0 opacity-50"
        width="14"
        height="28"
        viewBox="0 0 14 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7 0 Q 14 8, 7 14 T 7 28"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        className="text-[11px] tracking-[-0.01em]"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--muted-ink)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
