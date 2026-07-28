"use client";

import "./landing.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, stagger, createTimeline } from "animejs";
import { loadSession } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showJaaw, setShowJaaw] = useState(true);
  const [showExpanded, setShowExpanded] = useState(false);
  const reducedRef = useRef(false);
  const jaawRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (loadSession() !== null) {
      router.replace("/dash");
    } else {
      setReady(true);
    }
  }, [router]);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!ready || reducedRef.current) return;
    const jaaw = jaawRef.current;
    const expanded = expandedRef.current;
    if (!jaaw || !expanded) return;

    const spans = [...jaaw.querySelectorAll("span")];
    const initials = [...expanded.querySelectorAll(".initial")];
    const rests = [...expanded.querySelectorAll(".rest")];

    animate(cursorRef.current!, {
      opacity: [1, 0.15, 1],
      duration: 850,
      loop: true,
      ease: "inOutSine",
    });

    const tl = createTimeline({ defaults: { ease: "outExpo" } });

    tl
      .add(spans, {
        opacity: [0, 1],
        y: [38, 0],
        rotate: () => `${(Math.random() * 10 - 5).toFixed(1)}deg`,
        scale: [0.78, 1],
        duration: 950,
        delay: stagger(90),
      })
      .add(jaaw, {
        letterSpacing: ["-.12em", ".12em"],
        scale: [1, 0.92],
        duration: 750,
      }, "-=280")
      .add(cursorRef.current!, {
        opacity: 0,
        scale: 0,
        duration: 250,
      }, "-=420")
      .add(jaaw, {
        opacity: 0,
        scale: [0.92, 0.82],
        filter: ["blur(0px)", "blur(8px)"],
        duration: 430,
      }, "+=180")
      .call(() => {
        setShowJaaw(false);
        setShowExpanded(true);
      })
      .add(initials, {
        opacity: [0, 1],
        y: [18, 0],
        scale: [0.85, 1],
        duration: 480,
        delay: stagger(80),
      }, "-=100")
      .add(rests, {
        maxWidth: ["0em", "8em"],
        opacity: [0, 1],
        x: [-12, 0],
        duration: 950,
        delay: stagger(100),
        ease: "outQuart",
      }, "-=250")
      .add(expanded, {
        y: [0, -10],
        duration: 550,
        ease: "outQuart",
      }, "-=300")
      .add(supportRef.current!, {
        opacity: [0, 1],
        y: [18, 0],
        duration: 700,
        ease: "outQuart",
      }, "-=200");
  }, [ready]);

  function handleExpandedHover() {
    if (reducedRef.current) return;
    const expanded = expandedRef.current;
    if (!expanded) return;
    const initials = [...expanded.querySelectorAll(".initial")];
    animate(initials, {
      y: [
        { to: -4, duration: 180 },
        { to: 0, duration: 300 },
      ],
      delay: stagger(55),
      ease: "outQuad",
    });
  }

  function handleLoginClick() {
    if (reducedRef.current) {
      router.push("/login");
      return;
    }
    animate(heroRef.current!, {
      opacity: [1, 0],
      scale: [1, 0.97],
      duration: 450,
      ease: "inQuart",
    });
    setTimeout(() => router.push("/login"), 400);
  }

  if (!ready) return <div className="fixed inset-0 z-50 overflow-hidden bg-jaaw-bg text-jaaw-ink font-sans" />;

  return (
    <div className="jaaw-landing fixed inset-0 z-50 overflow-hidden bg-jaaw-bg text-jaaw-ink font-sans">
      <div className="noise pointer-events-none absolute inset-0 opacity-[.035] contrast-150" />

      <main ref={heroRef} className="grid min-h-dvh place-items-center p-6">
        <section className="w-full max-w-275 -translate-y-[1vh] text-center">
          <div className="relative flex h-[clamp(110px,17vw,190px)] items-center justify-center">
            <div
              className="
                absolute flex items-baseline justify-center
                whitespace-nowrap
                font-mono
                text-[clamp(68px,11vw,144px)]
                font-medium
                leading-[.9]
                tracking-[-.12em]
                motion-reduce:hidden
              "
              ref={jaawRef}
              aria-hidden="true"
              style={{ visibility: showJaaw ? "visible" : "hidden" }}
            >
              <span>j</span><span>a</span><span>a</span><span>w</span>
              <i className="ml-2.25 inline-block size-1.5 -translate-y-[.2em] rounded-full bg-jaaw-ink" ref={cursorRef} />
            </div>

            <div
              className="
                absolute flex items-baseline justify-center
                gap-[clamp(14px,2.2vw,34px)]
                whitespace-nowrap
                font-mono
                text-[clamp(18px,2.9vw,39px)]
                leading-none
                max-[620px]:gap-2
                max-[620px]:text-[clamp(14px,4.2vw,22px)]"
              ref={expandedRef}
              aria-label="just another academia wrapper"
              style={{ visibility: showExpanded ? "visible" : "hidden" }}
              onMouseEnter={handleExpandedHover}
            >
              <span className="word">
                <b className="initial">j</b>
                <span className="rest">ust</span>
              </span>
              <span className="word">
                <b className="initial">a</b>
                <span className="rest">nother</span>
              </span>
              <span className="word">
                <b className="initial">a</b>
                <span className="rest">cademia</span>
              </span>
              <span className="word">
                <b className="initial">w</b>
                <span className="rest">rapper</span>
              </span>
            </div>
          </div>

          <div className="mt-[clamp(16px,3vw,34px)] translate-y-4.5 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100" ref={supportRef}>
            <p className="mb-7.5 text-[clamp(14px,1.35vw,17px)] tracking-[-.02em] text-jaaw-muted">academia, but tolerable.</p>
            <button className="login" onClick={handleLoginClick}>
              <span>
                log in <i className="inline-block transition-transform duration-250 group-hover:translate-x-1">&rarr;</i>
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
