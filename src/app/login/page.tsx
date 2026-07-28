"use client";

import "./login.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, stagger, createTimeline } from "animejs";
import { ApiError } from "@/lib/api";
import { loadSession } from "@/lib/storage";
import { useLoginMutation } from "@/lib/queries";

export default function Login() {
  const router = useRouter();
  const [regNo, setRegNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLoginMutation();
  const reducedRef = useRef(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLButtonElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

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
    const brand = brandRef.current;
    if (!brand) return;

    const letters = [...brand.querySelectorAll(".letter")];

    animate(".dot", {
      opacity: [1, 0.15, 1],
      scale: [1, 0.7, 1],
      duration: 1500,
      loop: true,
      ease: "inOutSine",
    });

    createTimeline({ defaults: { ease: "outExpo" } })
      .add(letters, {
        opacity: [0, 1],
        y: [28, 0],
        scale: [0.75, 1],
        rotate: () => `${Math.random() * 8 - 4}deg`,
        duration: 850,
        delay: stagger(75),
      })
      .add(brand, { letterSpacing: [".10em", "-.12em"], duration: 700 }, "-=430");
  }, [ready]);

  function handleBrandHover() {
    if (reducedRef.current) return;
    const brand = brandRef.current;
    if (!brand) return;
    const letters = [...brand.querySelectorAll(".letter")];
    animate(letters, {
      y: [
        { to: -5, duration: 160 },
        { to: 0, duration: 300 },
      ],
      delay: stagger(45),
      ease: "outQuad",
    });
  }

  function handlePeekClick() {
    setShowPw((p) => !p);
    if (!reducedRef.current) {
      animate(peekRef.current!, { scale: [0.8, 1], duration: 300, ease: "outBack" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const netId = regNo.trim();
    const pw = password.trim();

    if (!netId || !pw) {
      animate(shellRef.current!, {
        x: [0, -7, 6, -4, 2, 0],
        duration: 350,
        ease: "outQuad",
      });
      if (!netId) userRef.current?.focus();
      else passRef.current?.focus();
      return;
    }

    if (error) setError(null);

    loginMutation.mutate(
      { username: netId, password: pw },
      {
        onSuccess: () => {
          if (!reducedRef.current) {
            const sweep = sweepRef.current;
            const flash = flashRef.current;
            createTimeline()
              .add(shellRef.current!, {
                opacity: [1, 0],
                y: [0, -14],
                duration: 330,
                ease: "inQuart",
              })
              .add(sweep!, {
                y: ["101%", "0%"],
                duration: 650,
                ease: "inOutExpo",
              }, "-=110")
              .add(flash!, {
                opacity: [0, 1],
                scale: [0.86, 1],
                letterSpacing: [".04em", "-.12em"],
                duration: 550,
                ease: "outExpo",
              }, "-=250")
              .add(flash!, {
                opacity: [1, 0],
                scale: [1, 1.08],
                duration: 350,
                ease: "inQuad",
              }, "+=260")
              .then(() => router.replace("/dash"));
          } else {
            router.replace("/dash");
          }
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.status === 401) {
              setError("Invalid credentials.");
            } else if (err.status === 503) {
              setError("Academia servers unreachable.");
            } else {
              setError(err.detail || "Login failed.");
            }
          } else {
            setError("Network error.");
          }
        },
      }
    );
  }

  if (!ready) return <div className="jaaw-login" />;

  return (
    <div className="jaaw-login">
      <div className="noise" />

      <button className="back" onClick={() => router.push("/")}>
        &larr; back
      </button>

      <main>
        <section className="shell" ref={shellRef}>
          <div className="brand-wrap">
            <div className="brand" ref={brandRef} onMouseEnter={handleBrandHover}>
              <span className="letter">j</span>
              <span className="letter">a</span>
              <span className="letter">a</span>
              <span className="letter">w</span>
            </div>
          </div>

          <header className="copy">
            <h1>academia, but tolerable</h1>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field${regNo ? " has" : ""}`}>
              <label htmlFor="user">net id</label>
              <input
                id="user"
                ref={userRef}
                autoComplete="username"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                disabled={loginMutation.isPending}
              />
              <div className="line" />
            </div>

            <div className={`field${password ? " has" : ""}`}>
              <label htmlFor="pass">password</label>
              <input
                id="pass"
                ref={passRef}
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
              />
              <button type="button" className="peek" ref={peekRef} onClick={handlePeekClick}>
                {showPw ? "hide" : "show"}
              </button>
              <div className="line" />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button
              type="submit"
              className="submit"
              disabled={loginMutation.isPending}
            >
              <span className="submit-bg" />
              <span className="submit-content">
                {loginMutation.isPending ? "signing in\u2026" : "enter jaaw"}
                <i className="arrow">&rarr;</i>
              </span>
            </button>
          </form>
        </section>
      </main>

      <div className="sweep" ref={sweepRef} />
      <div className="flash" ref={flashRef}>jaaw</div>
    </div>
  );
}
