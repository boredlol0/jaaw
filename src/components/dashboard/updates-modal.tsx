"use client";

import { useEffect, useState } from "react";
import {
  subscribeUpdates,
  getUpdates,
  dismissUpdates,
  type UpdateEntry,
} from "@/lib/updates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import "./css/updates-modal.css";

function marginLabel(v: string | number | null): string {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  if (!Number.isFinite(n)) return "—";
  if (n < 0) return `${-n} required`;
  if (n > 0) return `${n} margin`;
  return "at 75%";
}

function EntryRow({ entry }: { entry: UpdateEntry }) {
  if (entry.kind === "attendance" && entry.field === "margin") {
    const after =
      typeof entry.after === "number"
        ? entry.after
        : Number.parseFloat(String(entry.after));
    const dir = after < 0 ? "down" : after > 0 ? "up" : "flat";
    return (
      <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-[rgba(244,242,234,0.05)] px-6.5 py-3.5 first:border-t-0">
        <span className="min-w-0 text-[13px] leading-5 text-(--cx-fg)">
          {entry.courseTitle}
        </span>
        <span
          className="cx-upd-change inline-flex items-baseline gap-2 whitespace-nowrap text-right text-[13px] leading-5"
          data-dir={dir}
        >
          <span className="text-(--cx-muted) line-through decoration-[rgba(240,138,138,0.5)]">
            {marginLabel(entry.before)}
          </span>
          <span className="text-(--cx-muted)">&rarr;</span>
          <span className="cx-upd-new">{marginLabel(entry.after)}</span>
        </span>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-[rgba(244,242,234,0.05)] px-6.5 py-3.5 first:border-t-0">
      <span className="min-w-0 text-[13px] leading-5 text-(--cx-fg)">
        {entry.courseTitle}
      </span>
      <span
        className="cx-upd-change inline-flex items-baseline gap-2 whitespace-nowrap text-right text-[13px] leading-5"
        data-dir="flat"
      >
        <span className="text-(--cx-muted) line-through decoration-[rgba(240,138,138,0.5)]">
          {entry.before ?? "—"}
        </span>
        <span className="text-(--cx-muted)">&rarr;</span>
        <span className="cx-upd-new">{entry.after ?? "—"}</span>
      </span>
    </li>
  );
}

function UpdateSection({
  title,
  entries,
}: {
  title: string;
  entries: UpdateEntry[];
}) {
  if (!entries.length) return null;

  return (
    <li className="py-2">
      <h3 className="px-6.5 pb-2 pt-3 text-xs font-bold normal-case tracking-normal text-(--cx-muted)">
        {title}
      </h3>
      <ul className="m-0 list-none p-0">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </li>
  );
}

export function UpdatesModal() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<UpdateEntry[]>([]);
  const attendanceEntries = entries.filter(
    (entry) => entry.kind === "attendance"
  );
  const marksEntries = entries.filter((entry) => entry.kind === "marks");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      dismissUpdates();
    }
  };

  useEffect(() => {
    return subscribeUpdates(() => {
      const next = getUpdates();
      if (next.length) {
        setEntries(next);
        setOpen(true);
      }
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="cx-updates-card flex h-[min(720px,calc(100dvh-2rem))] w-[min(920px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-[22px] border border-(--cx-line) bg-(--cx-bg-2) p-0 font-['Space_Mono',monospace] text-(--cx-fg) shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        showCloseButton={false}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-(--cx-line) px-6.5 pb-4.5 pt-5.5">
          <div>
            <DialogTitle className="font-['Unbounded',sans-serif]! text-[15px] font-medium normal-case tracking-normal text-(--cx-accent)">
              recent changes
            </DialogTitle>
            <DialogDescription className="sr-only">
              Attendance and marks changes found since your last dashboard
              visit.
            </DialogDescription>
          </div>
          <span className="grid h-6.5 min-w-6.5 place-items-center rounded-full bg-(--cx-accent) px-2 text-xs text-(--cx-bg-2)">
            {entries.length}
          </span>
        </DialogHeader>
        <ul className="cx-updates-list m-0 min-h-0 flex-1 list-none overflow-y-auto px-0 py-2">
          <UpdateSection title="attendance changes" entries={attendanceEntries} />
          <UpdateSection title="marks changes" entries={marksEntries} />
        </ul>
        <DialogFooter className="m-[10px_26px_24px] shrink-0 border-0 bg-transparent p-0">
          <Button
            className="h-auto w-full cursor-pointer rounded-[14px] border border-(--cx-line) bg-transparent px-4.5 py-3 font-['Space_Mono',monospace] text-[13px] text-(--cx-fg) transition-colors hover:border-[rgba(244,242,234,0.18)] hover:bg-[rgba(244,242,234,0.06)]"
            onClick={() => handleOpenChange(false)}
          >
            done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
