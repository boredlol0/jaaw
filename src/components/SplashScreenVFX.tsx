"use client";

import { useCallback, useEffect, useRef } from "react";
import { animate, stagger, createTimeline } from "animejs";
import "./splash-screen.css";

interface SplashScreenVFXProps {
  name?: string;
  className?: string;
  onComplete?: () => void;
}

export const SplashScreenVFX = ({ className, onComplete }: SplashScreenVFXProps) => {
  const reducedRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const jaawRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLElement>(null);
  const centerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const goToDashboard = useCallback(() => {
    const center = centerRef.current;
    if (!center) {
      onComplete?.();
      return;
    }

    animate(center, {
      opacity: [1, 0],
      scale: [1, 0.985],
      filter: ["blur(0px)", "blur(8px)"],
      duration: 250,
      ease: "inQuart",
      onComplete: () => onComplete?.(),
    });
  }, [onComplete]);

  useEffect(() => {
    if (reducedRef.current) {
      const t = setTimeout(() => onComplete?.(), 300);
      return () => clearTimeout(t);
    }

    const jaaw = jaawRef.current;
    const grid = gridRef.current;
    const glow = glowRef.current;
    const dot = dotRef.current;
    if (!jaaw || !grid || !glow || !dot) return;

    const letters = [...jaaw.querySelectorAll<HTMLElement>(".letter")];

    animate(grid, { opacity: [0, 0.65], duration: 500, ease: "outQuad" });
    animate(glow, { opacity: [0, 1], scale: [0.75, 1], duration: 600, ease: "outExpo" });

    animate(dot, {
      opacity: [1, 0.35, 1],
      scale: [1, 0.8, 1],
      duration: 600,
      loop: true,
      ease: "inOutSine",
      delay: 400,
    });

    createTimeline({ defaults: { ease: "outExpo" } })
      .add(letters, {
        opacity: [0, 1],
        y: [45, 0],
        scale: [0.72, 1],
        rotate: () => `${(Math.random() * 10 - 5).toFixed(1)}deg`,
        duration: 400,
        delay: stagger(50),
      })
      .add(jaaw, { letterSpacing: [".08em", "-.14em"], duration: 300 }, "-=220")
      .add(dot, { scale: [0, 1], opacity: [0, 1], duration: 200, ease: "outBack" }, "-=150")
      .add(jaaw, {
        scale: [
          { to: 1.025, duration: 150 },
          { to: 1, duration: 250 },
        ],
        duration: 400,
        ease: "outQuad",
      }, "+=80")
      .call(() => setTimeout(goToDashboard, 100));
  }, [goToDashboard, onComplete]);

  function handleJaawMouseMove(e: React.MouseEvent) {
    if (reducedRef.current) return;
    const jaaw = jaawRef.current;
    if (!jaaw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const letters = [...jaaw.querySelectorAll<HTMLElement>(".letter")];
    animate(letters, {
      y: (_target: unknown, i: number) => x * (i - 1.5) * 3,
      duration: 350,
      ease: "outQuad",
    });
  }

  function handleSkip() {
    onComplete?.();
  }

  return (
    <div className={"jaaw-splash" + (className ? " " + className : "")}>
      <div className="jaaw-splash-grid" ref={gridRef} />
      <div className="jaaw-splash-glow" ref={glowRef} />
      <div className="jaaw-splash-noise" />

      <main className="jaaw-splash-stage">
        <section className="jaaw-splash-center" ref={centerRef}>
          <div className="jaaw-splash-brand-stage">
            <div className="jaaw-splash-jaaw" ref={jaawRef} onMouseMove={handleJaawMouseMove}>
              <span className="letter">j</span>
              <span className="letter">a</span>
              <span className="letter">a</span>
              <span className="letter">w</span>
              <i className="jaaw-splash-dot" ref={dotRef} />
            </div>
          </div>
        </section>
      </main>

      <button className="jaaw-splash-skip" onClick={handleSkip}>
        skip &rarr;
      </button>
    </div>
  );
};
