"use client";

import "./shell.css";
import "@/components/dashboard/css/home-tab.css";
import "@/components/dashboard/css/attendance-tab.css";
import "@/components/dashboard/css/timetable-tab.css";
import "@/components/dashboard/css/marks-tab.css";
import "@/components/dashboard/css/calendar-tab.css";
import "@/components/dashboard/css/profile-tab.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "motion/react";
import { JaawLogo } from "@/components/JaawLogo";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { loadSession, type StoredDashData } from "@/lib/storage";
import { SplashScreenVFX as SplashScreen } from "@/components/SplashScreenVFX";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import "@/components/dashboard/css/mobile-nav.css";
import { useRefreshMutation } from "@/lib/queries";

type Tab = "home" | "attendance" | "timetable" | "marks" | "calendar" | "profile";

const TAB_ITEMS: { id: Tab; label: string; icon: React.ReactNode; route: string }[] = [
  {
    id: "home",
    label: "Home",
    route: "/dash",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    id: "attendance",
    label: "Attendance",
    route: "/dash/attendance",
    icon: (
      <path d="M4 20V10M12 20V4M20 20v-7" />
    ),
  },
  {
    id: "timetable",
    label: "Timetable",
    route: "/dash/timetable",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    ),
  },
  {
    id: "marks",
    label: "Marks",
    route: "/dash/marks",
    icon: (
      <>
        <path d="M6 3h9l5 5v13H6z" />
        <path d="M15 3v5h5" />
      </>
    ),
  },
  {
    id: "calendar",
    label: "Calendar",
    route: "/dash/calendar",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    route: "/dash/profile",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
      </>
    ),
  },
];

function getActiveTab(pathname: string): Tab {
  if (pathname.startsWith("/dash/attendance")) return "attendance";
  if (pathname.startsWith("/dash/timetable")) return "timetable";
  if (pathname.startsWith("/dash/marks")) return "marks";
  if (pathname.startsWith("/dash/calendar")) return "calendar";
  if (pathname.startsWith("/dash/profile")) return "profile";
  return "home";
}

function SidebarNavLink({
  item,
  active,
}: {
  item: (typeof TAB_ITEMS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.route}
      scroll={false}
      className={cn(
        "cx-sidebar-link nav-icon",
        active && "is-active"
      )}
      aria-current={active ? "page" : undefined}
      title={item.label}
      aria-label={item.label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {item.icon}
      </svg>
      <span className="cx-sidebar-link-label">{item.label}</span>
    </Link>
  );
}

function SidebarInner({
  activeTab,
  profile,
}: {
  activeTab: Tab;
  profile: StoredDashData["profile"] | null;
}) {
  const brandRef = useRef<HTMLDivElement>(null);
  const avatarInitials =
    profile?.name
      .split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "J";

  return (
    <aside className="cx-sidebar sidebar">
      <div className="cx-sidebar-brand brand" ref={brandRef}>
        <JaawLogo className="cx-logo-short wordmark" animateOnHover />
        <span className="cx-logo-full tagline">
          just another<br />academia wrapper
        </span>
      </div>
      <nav className="cx-sidebar-nav side-nav" aria-label="Dashboard">
        {TAB_ITEMS.map((item) => (
          <SidebarNavLink
            key={item.id}
            item={item}
            active={activeTab === item.id}
          />
        ))}
      </nav>
      <div className="cx-sidebar-profile">
        <div className="cx-sidebar-avatar avatar" title={profile?.name || "Profile"}>
          {avatarInitials}
        </div>
        <div className="cx-sidebar-profile-text">
          <p>{profile?.name || "jaaw"}</p>
          <span>{profile?.registrationNumber || "Dashboard"}</span>
        </div>
      </div>
    </aside>
  );
}

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<StoredDashData["profile"] | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshMutation = useRefreshMutation((dash) => {
    setProfile(dash.profile);
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const loaded = loadSession();
    if (!loaded?.session) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loaded.dash?.profile ?? null);
    setAuthChecked(true);
  }, [mounted, router]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    refreshMutation.mutate(undefined, {
      onSettled: () => {
        setRefreshing(false);
      },
    });
  }, [refreshing, refreshMutation]);

  const activeTab = getActiveTab(pathname);
  const sidebarWidth = isDesktop ? (sidebarOpen ? 300 : 88) : 70;

  if (!mounted) {
    return <div className="fixed inset-0 bg-black z-50" />;
  }

  if (!authChecked) {
    return <div className="fixed inset-0 bg-black z-50" />;
  }

  if (!splashDone) {
    const firstName = profile?.name?.split(" ")[0] || "there";
    return (
      <div className="fixed inset-0 bg-black z-50">
        <SplashScreen name={firstName} onComplete={() => setSplashDone(true)} />
      </div>
    );
  }

  return (
    <motion.div
      className="cx-dashboard-shell h-dvh flex bg-zinc-950 text-zinc-100 overflow-hidden"
    >
      {isDesktop && (
        <motion.div
          className="cx-sidebar-motion"
          animate={{ width: sidebarWidth }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => {
            setSidebarOpen(false);
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
          }}
          onFocusCapture={() => setSidebarOpen(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setSidebarOpen(false);
            }
          }}
        >
          <SidebarInner activeTab={activeTab} profile={profile} />
        </motion.div>
      )}

      <MobileNav refreshing={refreshing} onRefresh={handleRefresh} />

      <motion.div
        animate={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="flex-1 flex flex-col min-w-0"
      >

        <div id="dash-body" className="flex-1 overflow-y-auto overflow-x-hidden md:pb-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/8 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.14]">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
