"use client";

import { useRef } from "react";
import { animate, stagger } from "animejs";

interface JaawLogoProps {
  className?: string;
  animateOnHover?: boolean;
}

export function JaawLogo({ className, animateOnHover = false }: JaawLogoProps) {
  const ref = useRef<HTMLSpanElement>(null);

  function handleMouseEnter() {
    if (!animateOnHover) return;
    const el = ref.current;
    if (!el) return;
    const letters = el.querySelectorAll(".jl-letter");
    animate(letters, {
      y: [{ to: -4, duration: 140 }, { to: 0, duration: 260 }],
      delay: stagger(40),
      ease: "outQuad",
    });
  }

  return (
    <span ref={ref} className={className} onMouseEnter={handleMouseEnter}>
      <span className="jl-letter">j</span>
      <span className="jl-letter">a</span>
      <span className="jl-letter">a</span>
      <span className="jl-letter">w</span>
    </span>
  );
}
