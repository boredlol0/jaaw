"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { MarkRecord, CourseCatalogEntry } from "@/lib/api";

function tierColor(pct: number): string {
  if (pct >= 80) return "var(--cx-teal-bg)";
  if (pct >= 60) return "var(--cx-amber-bg)";
  return "var(--cx-brick-bg)";
}

function todayStr(): string {
  const n = new Date();
  return n.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SubjectCard({
  record,
  courseName,
  index,
}: {
  record: MarkRecord;
  courseName: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const compFillsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const animKeyRef = useRef(0);

  const totalPct =
    record.totalMarksObtained != null &&
    record.totalMarksMaximum != null &&
    record.totalMarksMaximum > 0
      ? (record.totalMarksObtained / record.totalMarksMaximum) * 100
      : 0;

  const hasAssessments = record.assessments.length > 0;
  const tier = tierColor(totalPct);

  useEffect(() => {
    const parent = cardRef.current?.closest(".cx-marks-tab") as HTMLElement | null;
    if (!parent || parent.dataset.ready !== "true") return;

    animKeyRef.current += 1;
    const delay = 0.5 + index * 0.1;

    const obj = { v: scoreRef.current ? parseFloat(scoreRef.current.textContent || "0") : 0 };
    gsap.killTweensOf(obj);
    gsap.to(obj, {
      v: record.totalMarksObtained ?? 0,
      duration: 1.1,
      delay,
      ease: "power2.out",
      onUpdate: () => {
        if (scoreRef.current) {
          scoreRef.current.textContent = obj.v.toFixed(2);
        }
      },
    });

    gsap.killTweensOf(barRef.current);
    gsap.to(barRef.current, {
      width: `${Math.min(totalPct, 100)}%`,
      duration: 1,
      delay: 0.6 + index * 0.1,
      ease: "power2.out",
    });
  }, [index, record.totalMarksObtained, totalPct]);

  useEffect(() => {
    if (!open || !hasAssessments) return;
    const fills: HTMLDivElement[] = [];
    compFillsRef.current.forEach((el) => fills.push(el));
    if (fills.length === 0) return;

    gsap.fromTo(
      fills,
      { width: "0%" },
      {
        width: (i, el) => el.dataset.pct + "%",
        duration: 0.7,
        stagger: 0.05,
        ease: "power2.out",
        delay: 0.1,
      }
    );
  }, [open, hasAssessments]);

  const toggle = () => {
    const body = bodyRef.current;
    if (!body) return;

    if (open) {
      gsap.to(body, { height: 0, duration: 0.4, ease: "power2.inOut" });
      cardRef.current?.classList.remove("is-open");
      setOpen(false);
    } else {
      cardRef.current?.classList.add("is-open");
      gsap.set(body, { height: "auto" });
      const h = body.scrollHeight;
      gsap.fromTo(
        body,
        { height: 0 },
        {
          height: h,
          duration: 0.45,
          ease: "power2.inOut",
          onComplete: () => gsap.set(body, { height: "auto" }),
        }
      );
      setOpen(true);
    }
  };

  return (
    <article
      className={`cx-mk-card${open ? " is-open" : ""}`}
      ref={cardRef}
      style={{ "--cx-tier-color": tier } as React.CSSProperties}
    >
      <div className="cx-mk-head" onClick={toggle}>
        <div>
          <div className="cx-mk-code">
            {record.courseCode}
            <span className="cx-mk-code-tag">&middot; {record.courseType}</span>
          </div>
          <div className="cx-mk-name">{courseName}</div>
        </div>
        <div className="cx-mk-score-wrap">
          <div className="cx-mk-score" style={{ color: tier }}>
            <span ref={scoreRef}>0.00</span>
            <span className="cx-mk-score-max">
              /{record.totalMarksMaximum != null ? record.totalMarksMaximum.toFixed(2) : "\u2014"}
            </span>
          </div>
          <div className="cx-mk-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
      <div className="cx-mk-bar-track">
        <div
          className="cx-mk-bar-fill"
          ref={barRef}
          style={{ background: tier }}
          data-pct={Math.min(totalPct, 100)}
        />
      </div>
      <div className="cx-mk-body" ref={bodyRef}>
        {hasAssessments && (
          <div className="cx-mk-components">
            {record.assessments.map((a, j) => {
              const obtained = parseFloat(a.obtainedMarks);
              const max = parseFloat(a.maximumMarks);
              const rowPct = max > 0 ? (obtained / max) * 100 : 0;
              const rowTier = tierColor(rowPct);

              return (
                <div className="cx-mk-comp-row" key={j}>
                  <span className="cx-mk-comp-label">{a.title}</span>
                  <div className="cx-mk-comp-track">
                    <div
                      className="cx-mk-comp-fill"
                      ref={(el) => {
                        if (el) compFillsRef.current.set(j, el);
                      }}
                      style={{ background: rowTier }}
                      data-pct={rowPct}
                    />
                  </div>
                  <span
                    className="cx-mk-comp-score"
                    style={{ color: rowTier }}
                  >
                    {obtained.toFixed(2)}
                    <span className="cx-mk-comp-score-max">
                      /{max.toFixed(2)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export function MarksTab({
  marks,
  courses,
}: {
  marks: MarkRecord[];
  courses: CourseCatalogEntry[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const courseMap = Object.fromEntries(
    courses.map((c) => [c.courseCode, c.courseTitle])
  );

  useEffect(() => {
    if (!rootRef.current || marks.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.05 });

      tl.fromTo(".cx-mk-kicker", { opacity: 0 }, { opacity: 1, duration: 0.6 });
      tl.fromTo(
        ".cx-mk-card",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "expo.out" },
        "-=0.3"
      );
    }, rootRef);

    const parent = rootRef.current;
    parent.dataset.ready = "true";

    return () => ctx.revert();
  }, [marks]);

  return (
    <div className="cx-marks-tab" ref={rootRef}>
      <div className="cx-mk-grid" />
      <div className="cx-mk-glow cx-mk-glow-1" />
      <div className="cx-mk-glow cx-mk-glow-2" />
      <div className="cx-mk-grain" />

      <div className="cx-mk-kicker">
        <span>Marks</span>
        <span className="cx-mk-kicker-date">{todayStr()}</span>
      </div>

      {marks.length === 0 ? (
        <div className="cx-mk-empty">No marks yet.</div>
      ) : (
        <div>
          {marks.map((m, i) => (
            <SubjectCard
              key={`${m.courseCode}-${m.courseType}-${i}`}
              record={m}
              courseName={courseMap[m.courseCode] ?? m.courseCode}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
