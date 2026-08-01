"use client";

import { useEffect, useRef } from "react";
import type { AttendanceRecord } from "@/lib/api";
import { isFinishedSemester } from "./utils";
import gsap from "gsap";

function tierFor(pct: number) {
  if (pct >= 85) return { bg: "var(--cx-green-bg)", fg: "var(--cx-green-fg)" };
  if (pct >= 75) return { bg: "var(--cx-amber-bg)", fg: "var(--cx-amber-fg)" };
  return { bg: "var(--cx-brick-bg)", fg: "var(--cx-brick-fg)" };
}

function computeMargin(conducted: number, absent: number): number {
  const attended = conducted - absent;
  return Math.floor(attended / 0.75 - conducted);
}

function animateValue(el: Element, target: number, suffix = "", decimals = 0, dur = 1.1, delay = 0) {
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target,
    duration: dur,
    delay,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = `${obj.v.toFixed(decimals)}${suffix}`;
    },
  });
}

export function AttendanceTab({
  records,
  overallPct,
}: {
  records: AttendanceRecord[];
  overallPct: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const finished = records.length > 0 && isFinishedSemester(records);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.1 });

      tl.fromTo(".cx-att-kicker", { opacity: 0 }, { opacity: 1, duration: 0.6 })
        .fromTo(
          ".cx-att-hero-card",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" },
          "-=0.3",
        )
        .fromTo(
          ".cx-att-row",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "expo.out" },
          "-=0.35",
        );

      const heroEl = el.querySelector(".cx-att-hero-value");
      if (heroEl) {
        gsap.killTweensOf(heroEl);
        animateValue(heroEl, overallPct, "%", 1, 1.3, 0.55);
      }

      el.querySelectorAll(".cx-att-margin-val").forEach((valEl, i) => {
        const margin = parseFloat((valEl as HTMLElement).dataset.margin ?? "0");
        const isReq = (valEl as HTMLElement).dataset.req === "true";
        gsap.killTweensOf(valEl);
        animateValue(valEl, Math.abs(margin), isReq ? " required" : " margin", 0, 0.9, 0.9 + i * 0.08);
      });

      el.querySelectorAll(".cx-att-pct, .cx-att-row-pct").forEach((pctEl, i) => {
        const target = parseFloat((pctEl as HTMLElement).dataset.count ?? "0");
        gsap.killTweensOf(pctEl);
        animateValue(pctEl, target, "%", 1, 0.6, 1.0 + i * 0.08);
      });
    }, el);

    return () => ctx.revert();
  }, [overallPct, records]);

  if (finished) {
    return (
      <div ref={rootRef} className="cx-attendance-tab">
        <div className="cx-att-grid" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-1" aria-hidden="true" />
        <div className="cx-att-glow cx-att-glow-2" aria-hidden="true" />
        <div className="cx-att-grain" aria-hidden="true" />

        <div className="cx-att-kicker">
          <span>Attendance</span>
          <span className="cx-att-date">{today}</span>
        </div>

        <div
          className="cx-att-hero-card"
          style={{ background: "var(--cx-indigo-bg)", color: "var(--cx-indigo-fg)" }}
        >
          <div className="cx-att-hero-top">
            <span className="cx-att-hero-label">Overall attendance</span>
          </div>
          <div className="cx-att-hero-value" data-count={overallPct}>
            0.0%
          </div>
          <div className="cx-att-hero-meta">
            Final semester result
          </div>
        </div>

        <div className="cx-att-row-list">
          {records.map((r, i) => {
            const tier = tierFor(r.attendancePercentage);
            return (
              <article
                key={`${r.courseCode}-${i}`}
                className="cx-att-row"
                style={{ background: tier.bg, color: tier.fg }}
              >
                <div className="cx-att-row-left">
                  <div className="cx-att-row-code">
                    {r.courseCode}
                    <span className="cx-att-row-tag">{r.courseType}</span>
                  </div>
                  <div className="cx-att-row-name">
                    {r.courseTitle}
                  </div>
                </div>
                <div className="cx-att-pct" data-count={r.attendancePercentage}>
                  0.0%
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="cx-attendance-tab">
      <div className="cx-att-grid" aria-hidden="true" />
      <div className="cx-att-glow cx-att-glow-1" aria-hidden="true" />
      <div className="cx-att-glow cx-att-glow-2" aria-hidden="true" />
      <div className="cx-att-grain" aria-hidden="true" />

      <div className="cx-att-kicker">
        <span>Attendance</span>
        <span className="cx-att-date">{today}</span>
      </div>

      <div
        className="cx-att-hero-card"
        style={{ background: "var(--cx-indigo-bg)", color: "var(--cx-indigo-fg)" }}
      >
        <div className="cx-att-hero-top">
          <span className="cx-att-hero-label">Overall attendance</span>
        </div>
        <div className="cx-att-hero-value" data-count={overallPct}>
          0.0%
        </div>
        <div className="cx-att-hero-meta">
          Across all subjects
        </div>
      </div>

      <div className="cx-att-row-list">
        {records.map((r, i) => {
          const margin = computeMargin(r.classesConducted, r.classesAbsent);
          const marginColor =
            margin > 0 ? "#3d6b4f" :
              margin === 0 ? "#e7a63f" :
                "#c94f4f";

          return (
            <article
              key={`${r.courseCode}-${i}`}
              className="cx-att-row"
            >
              <div className="cx-att-row-left">
                <div className="cx-att-row-code">
                  {r.courseCode}
                  <span className="cx-att-row-tag">{r.courseType}</span>
                </div>
                <div className="cx-att-row-name">
                  {r.courseTitle}
                </div>
                <div className="cx-att-row-pct" data-count={r.attendancePercentage}>
                  0.0%
                </div>
              </div>
              <div className="cx-att-row-right">
                <div
                  className="cx-att-margin-val"
                  data-margin={margin}
                  data-req={margin < 0}
                  style={{ color: marginColor }}
                >
                  0
                </div>
                <div className="cx-att-margin-label" style={{ color: marginColor }}>
                  {margin < 0 ? "required" : margin === 0 ? "margin" : "margin"}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
