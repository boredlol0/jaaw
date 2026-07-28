"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { DashState } from "@/types/dashboard";
import { getInitials, getFirstName } from "./utils";
import { JaawLogo } from "@/components/JaawLogo";

interface ProfileTabProps {
  profile: DashState["profile"];
  onLogout: () => void;
  overallPct?: number;
  avgMarksPct?: number | null;
}

const NOTIF_TOGGLES = [
  {
    title: "Push Notifications",
    desc: "Marks & attendance alerts",
    on: true,
    iconBg: "rgba(43,63,174,0.35)",
    iconColor: "#8ab0ff",
    icon: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  },
  {
    title: "Install App",
    desc: "Get a better experience",
    on: true,
    iconBg: "rgba(231,166,63,0.28)",
    iconColor: "#e7a63f",
    icon: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  },
  {
    title: "Feedback",
    desc: "Send your feedback to improve the app",
    on: false,
    iconBg: "rgba(31,184,176,0.25)",
    iconColor: "#1fb8b0",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  },
];

export function ProfileTab({
  profile,
  onLogout,
  overallPct = 0,
  avgMarksPct = null,
}: ProfileTabProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [toggles, setToggles] = useState(NOTIF_TOGGLES);

  const initials = getInitials(profile.name);
  const firstName = getFirstName(profile.name);
  const lastName = profile.name.split(" ").slice(1).join(" ") || "";
  const shortDept =
    profile.department
      .replace(/Department of /i, "")
      .replace(/Computer Science and Engineering/i, "CSE")
      .replace(/Electronics and Communication Engineering/i, "ECE")
      .replace(/Mechanical Engineering/i, "Mech")
      .replace(/Electrical and Electronics Engineering/i, "EEE")
      .trim() || profile.department;

  const attPct = Math.round(overallPct);
  const mrkPct = avgMarksPct !== null ? Math.round(avgMarksPct) : 0;

  const toggleSwitch = (idx: number) => {
    setToggles((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, on: !t.on } : t)),
    );
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.05 });
      tl.fromTo(".cx-pf-kicker-kicker", { opacity: 0 }, { opacity: 1, duration: 0.6 });
      tl.fromTo(
        ".cx-pf-card",
        { opacity: 0, y: 20, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "expo.out",
        },
        "-=0.3",
      );
      tl.fromTo(
        ".cx-pf-info-tile",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 },
        "-=0.4",
      );
      tl.fromTo(
        ".cx-pf-kicker-notif",
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
        "-=0.2",
      );
      tl.fromTo(
        ".cx-pf-toggle-row",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 },
        "-=0.25",
      );
      tl.fromTo(
        ".cx-pf-logout",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.15",
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="cx-profile-tab" ref={rootRef}>
      <div className="cx-pf-grid" />
      <div className="cx-pf-glow cx-pf-glow-1" />
      <div className="cx-pf-glow cx-pf-glow-2" />
      <div className="cx-pf-grain" />

      {/* Kicker */}
      <div className="cx-pf-kicker cx-pf-kicker-kicker"><span>Profile</span></div>

      {/* Profile Card */}
      <div className="cx-pf-card-wrap">
        <div className="cx-pf-card">
          <div className="cx-pf-card-brand">
            <JaawLogo className="cx-pf-card-jaaw" />
          </div>
          <div className="cx-pf-card-body">
            <div className="cx-pf-card-avatar">{initials}</div>
            <h2 className="cx-pf-card-name">
              {firstName}
              {lastName && <> <br />{lastName}</>}
            </h2>
            <span className="cx-pf-card-regno">{profile.registrationNumber}</span>
            <div className="cx-pf-card-dept">{shortDept}</div>
            <div className="cx-pf-card-divider" />
            <div className="cx-pf-card-stats">
              <div className="cx-pf-card-stat">
                <span className="num">{attPct}%</span>
                <span className="code">attendance</span>
              </div>
              <div className="cx-pf-card-stat">
                <span className="num">{mrkPct}%</span>
                <span className="code">marks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="cx-pf-info-grid">
        <div className="cx-pf-info-tile">
          <div className="lbl">Program</div>
          <div className="val">{profile.program || "B.Tech"}</div>
        </div>
        <div className="cx-pf-info-tile">
          <div className="lbl">Semester</div>
          <div className="val">{profile.semester}</div>
        </div>
        <div className="cx-pf-info-tile">
          <div className="lbl">Batch</div>
          <div className="val">{profile.batch}</div>
        </div>
        <div className="cx-pf-info-tile">
          <div className="lbl">Section</div>
          <div className="val">{profile.section}</div>
        </div>
      </div>

      {/* Notifications */}
      <div className="cx-pf-kicker cx-pf-kicker-notif"><span>Settings</span></div>

      {toggles.map((t, i) => (
        <div className="cx-pf-toggle-row" key={t.title}>
          <div className="cx-pf-toggle-left">
            <span
              className="cx-pf-toggle-icon"
              style={{ background: t.iconBg, color: t.iconColor }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: t.icon }}
              />
            </span>
            <div>
              <div className="cx-pf-toggle-title">{t.title}</div>
              <div className="cx-pf-toggle-desc">{t.desc}</div>
            </div>
          </div>
          <div
            className={`cx-pf-toggle-switch${t.on ? " is-on" : ""}`}
            onClick={() => toggleSwitch(i)}
          />
        </div>
      ))}

      {/* Logout */}
      <button className="cx-pf-logout" onClick={onLogout}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        Logout
      </button>
    </div>
  );
}
