"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { RefreshCw } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", route: "/dash" },
  { label: "Attendance", route: "/dash/attendance" },
  { label: "Timetable", route: "/dash/timetable" },
  { label: "Marks", route: "/dash/marks" },
  { label: "Calendar", route: "/dash/calendar" },
  { label: "Profile", route: "/dash/profile" },
] as const;

function expandedSize() {
  return {
    w: Math.min(360, window.innerWidth * 0.88),
    h: Math.min(500, window.innerHeight * 0.72),
    r: 24,
  };
}

export function MobileNav({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const closeLabelRef = useRef<HTMLSpanElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(false);
  const isClosingRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const compact = compactRef.current;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const closeBtn = closeBtnRef.current;
    const closeLabel = closeLabelRef.current;
    const footer = footerRef.current;

    if (!shell || !compact || !panel || !scrim || !closeBtn || !closeLabel || !footer) return;

    const linksContainer = panel.querySelector<HTMLElement>(".cx-mn-links");
    const links = shell.querySelectorAll<HTMLAnchorElement>(".cx-mn-link");

    function tuneLinks() {
      if (!linksContainer) return;
      const exp = expandedSize();
      const vw = window.innerWidth;
      const padY = Math.max(20, Math.min(30, vw * 0.04)) * 2;
      const mt = Math.max(24, Math.min(40, vw * 0.05));
      const topH = 38;
      const footerH = 33;
      const available = exp.h - padY - topH - footerH - mt;
      const count = NAV_ITEMS.length;
      let fs = Math.round((available / count) / 1.28);
      fs = Math.max(20, Math.min(56, fs));
      const gap = Math.max(4, Math.round(fs * 0.08));
      linksContainer.style.setProperty("--mn-fs", `${fs}px`);
      linksContainer.style.setProperty("--mn-gap", `${gap}px`);
    }

    let pendingNav: string | null = null;

    function cleanReverse() {
      scrim!.style.pointerEvents = "none";
      panel!.style.pointerEvents = "none";
      isOpenRef.current = false;
      isClosingRef.current = false;
      if (pendingNav) {
        const url = pendingNav;
        pendingNav = null;
        router.push(url);
      }
    }

    function buildTimeline() {
      tuneLinks();
      const exp = expandedSize();
      const panelTopBits = [closeLabel!, closeBtn!].filter(Boolean);
      const t = gsap.timeline({ paused: true, defaults: { ease: "expo.inOut" } });
      t.to(scrim, { opacity: 1, duration: 0.5, ease: "power1.out" }, 0)
        .set(scrim, { pointerEvents: "auto" }, 0)
        .to(compact, { opacity: 0, duration: 0.18, ease: "power1.out" }, 0)
        .to(shell, { width: exp.w, height: exp.h, borderRadius: exp.r, duration: 0.7 }, 0)
        .set(panel, { pointerEvents: "auto" }, 0.28)
        .to(panel, { opacity: 1, duration: 0.25, ease: "power1.out" }, 0.28)
        .to(panelTopBits, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06, ease: "back.out(2)" }, 0.36)
        .to(links, { y: "0%", duration: 0.85, stagger: 0.07, ease: "expo.out" }, 0.4)
        .to(footer, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.35");
      return t;
    }

    function openMenu() {
      if (isOpenRef.current || isClosingRef.current) return;
      isOpenRef.current = true;
      shell!.classList.add("is-open");
      tlRef.current?.kill();
      tlRef.current = buildTimeline();
      tlRef.current!.play();
    }

    function closeMenu(navigateTo?: string) {
      if (!isOpenRef.current || isClosingRef.current) return;
      isClosingRef.current = true;
      pendingNav = navigateTo || null;
      shell!.classList.remove("is-open");
      const tl = tlRef.current;
      if (tl) {
        tl.eventCallback("onReverseComplete", cleanReverse);
        tl.timeScale(2.5).reverse();
      }
    }

    const onShellClick = () => { if (!isOpenRef.current && !isClosingRef.current) openMenu(); };
    const onCloseClick = (e: MouseEvent) => { e.stopPropagation(); closeMenu(); };
    const onScrimClick = () => closeMenu();
    const onKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    const onLinkClick = (e: MouseEvent) => {
      const a = e.currentTarget as HTMLAnchorElement;
      e.preventDefault();
      const href = a.getAttribute("href");
      if (!href) return;
      closeMenu(href);
    };

    const onResize = () => {
      if (isOpenRef.current) {
        const exp = expandedSize();
        gsap.set(shell, { width: exp.w, height: exp.h, borderRadius: exp.r });
        tuneLinks();
      }
    };

    shell.addEventListener("click", onShellClick);
    closeBtn.addEventListener("click", onCloseClick);
    closeLabel.addEventListener("click", onCloseClick);
    scrim.addEventListener("click", onScrimClick);
    document.addEventListener("keydown", onKeydown);
    links.forEach((a) => a.addEventListener("click", onLinkClick));
    window.addEventListener("resize", onResize);

    return () => {
      tlRef.current?.kill();
      shell.removeEventListener("click", onShellClick);
      closeBtn.removeEventListener("click", onCloseClick);
      closeLabel.removeEventListener("click", onCloseClick);
      scrim.removeEventListener("click", onScrimClick);
      document.removeEventListener("keydown", onKeydown);
      links.forEach((a) => a.removeEventListener("click", onLinkClick));
      window.removeEventListener("resize", onResize);
    };
  }, [router]);

  return (
    <>
      <div className="cx-mn-scrim" ref={scrimRef} />

      <div className="cx-mn-shell" ref={shellRef} data-mobile-nav>
        <div className="cx-mn-compact" ref={compactRef}>
          <span>menu</span>
          <i className="cx-mn-dot" />
        </div>

        <div className="cx-mn-panel" ref={panelRef}>
          <div className="cx-mn-panel-top">
            <span className="cx-mn-close-label" ref={closeLabelRef}>close</span>
            <button className="cx-mn-close-btn" ref={closeBtnRef} aria-label="Close menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="cx-mn-links">
            {NAV_ITEMS.map((item) => (
              <div className="cx-mn-link-wrap" key={item.route}>
                <Link href={item.route} className="cx-mn-link" scroll={false}>
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>

          <div className="cx-mn-footer" ref={footerRef}>
            <span>jaaw :p</span>
            <button
              className="cx-mn-refresh-btn"
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={refreshing}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={13} strokeWidth={2} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
