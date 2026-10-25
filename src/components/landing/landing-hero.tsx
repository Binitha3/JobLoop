"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

const screenshots = [
  { src: "/hero/paste-message.webp", alt: "Pasted customer message" },
  { src: "/hero/extraction-review.webp", alt: "Reviewing extracted order details" },
  { src: "/hero/customers-table.webp", alt: "Customer list" },
  { src: "/hero/new-order.webp", alt: "New order with line items" },
  { src: "/hero/order-detail.webp", alt: "Order details and status actions" },
  { src: "/hero/quote-section.webp", alt: "Quote details" },
  { src: "/hero/quote-pdf.webp", alt: "First page of a quote PDF" },
  { src: "/hero/order-timeline.webp", alt: "Order status timeline" },
  { src: "/hero/public-tracking.webp", alt: "Public order tracking page" },
  { src: "/hero/dashboard.webp", alt: "Job and order dashboard" },
];

const styles = `
.landing {
  --page: #f7f5f0;
  --ink: #151515;
  --muted: #5f5b54;
  --accent: #1f3a5f;
  --badge: #e3e8f0;
  --u: min(0.0694444444vw, 0.1063829787vh, 1.6px);
  color: var(--ink);
  background: var(--page);
  font-family: var(--font-geist), sans-serif;
  min-height: 100svh;
  overflow: hidden;
}
.landing * { box-sizing: border-box; }
.hero-frame {
  position: relative;
  width: min(100vw, calc(1440 * var(--u)));
  height: calc(1200 * var(--u));
  margin: 0 auto;
  overflow: visible;
}
.topbar { position: absolute; inset: calc(29 * var(--u)) calc(37 * var(--u)) auto; z-index: 30; height: calc(42 * var(--u)); }
.wordmark {
  position: absolute; left: 0; top: calc(7 * var(--u)); display: inline-flex; align-items: center;
  gap: calc(8 * var(--u)); color: var(--ink); font-size: calc(21 * var(--u)); font-weight: 600;
  letter-spacing: -.045em; text-decoration: none;
}
.wordmark-mark { width: calc(11 * var(--u)); height: calc(11 * var(--u)); background: var(--accent); display: inline-block; }
.desktop-nav { position: absolute; top: calc(2 * var(--u)); left: 50%; display: flex; align-items: center; gap: calc(31 * var(--u)); transform: translateX(-50%); }
.desktop-nav a, .top-auth a { color: var(--ink); font-size: calc(16.4 * var(--u)); font-weight: 400; text-decoration: none; white-space: nowrap; }
.desktop-nav a:hover, .text-link:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
.top-auth { position: absolute; right: 0; top: 0; display: flex; gap: calc(1 * var(--u)); }
.pill-link {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  font-size: calc(15 * var(--u)) !important; font-weight: 500 !important; text-decoration: none !important;
}
.login-pill { width: calc(92 * var(--u)); height: calc(40 * var(--u)); color: var(--ink) !important; background: #fff; }
.signup-pill { width: calc(97 * var(--u)); height: calc(40 * var(--u)); color: #fff !important; background: var(--accent); }
.landing a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
.hero-badge {
  position: absolute; z-index: 5; top: calc(96 * var(--u)); left: 50%; width: calc(340 * var(--u)); height: calc(37 * var(--u));
  display: flex; justify-content: center; align-items: center; border-radius: 999px; background: var(--badge);
  color: var(--accent); font-size: calc(16.6 * var(--u)); font-weight: 500; white-space: nowrap; translate: -50% 0;
}
.hero-title {
  position: absolute; z-index: 5; top: calc(146 * var(--u)); left: 0; width: 100%; margin: 0;
  color: var(--ink); text-align: center; font-size: calc(88 * var(--u)); font-weight: 600;
  letter-spacing: -.035em; line-height: calc(92 * var(--u));
}
.hero-title span { display: block; }
.hero-title span + span { letter-spacing: -.022em; }
.hero-subline {
  position: absolute; z-index: 5; top: calc(346 * var(--u)); left: 0; width: 100%; margin: 0;
  color: var(--muted); text-align: center; font-size: calc(20.8 * var(--u)); font-weight: 400; line-height: calc(32 * var(--u));
}
.hero-subline span { display: block; }
.carousel {
  position: absolute; z-index: 1; top: calc(500 * var(--u)); left: calc(50% - 50vw); width: 100vw; height: calc(700 * var(--u));
  overflow: visible; perspective: 1500px; perspective-origin: 50% 50%;
  touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; contain: layout paint;
}
.carousel.is-dragging { cursor: grabbing; }
.carousel-card {
  position: absolute; left: 0; top: 0; width: calc(250 * var(--u)); height: calc(420 * var(--u));
  overflow: hidden; border-radius: calc(4 * var(--u)); background: var(--page);
  box-shadow: 0 12px 32px rgb(24 31 40 / 12%); transform-style: preserve-3d; will-change: transform;
}
.carousel-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
.cta-ring {
  position: absolute; z-index: 15; top: calc(474 * var(--u)); left: 50%; width: calc(190 * var(--u)); height: calc(74 * var(--u));
  display: grid; place-items: center; border: 1px dashed #8290a0; border-radius: 999px; translate: -50% 0;
}
.cta-button {
  display: grid; place-items: center; width: calc(172 * var(--u)); height: calc(58 * var(--u));
  border-radius: 999px; color: white; background: var(--accent); font-size: calc(18 * var(--u)); font-weight: 500; text-decoration: none;
}
.hinglish-note, .approval-note {
  position: absolute; z-index: 16; color: var(--accent); font-size: calc(18 * var(--u)); font-weight: 500;
  white-space: nowrap; pointer-events: none;
}
.hinglish-note { top: calc(458 * var(--u)); left: calc(50% + 200 * var(--u)); transform: rotate(6deg); }
.hinglish-arrow { position: absolute; z-index: 8; top: calc(488 * var(--u)); left: calc(50% + 215 * var(--u)); width: calc(90 * var(--u)); height: calc(60 * var(--u)); overflow: visible; }
.approval-note { top: calc(492 * var(--u)); right: calc(50% + 103 * var(--u)); display: flex; align-items: center; gap: calc(8 * var(--u)); transform: rotate(-4deg); }
.approval-arrow { width: calc(36 * var(--u)); height: calc(14 * var(--u)); overflow: visible; flex: none; }
.arrow-note path { fill: none; stroke: var(--accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.fps-counter {
  position: fixed; z-index: 80; right: 12px; bottom: 12px; padding: 5px 8px; background: #151515;
  color: white; font: 12px/1.2 ui-monospace, monospace; pointer-events: none;
}
.info-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 64px; max-width: 1100px; margin: 0 auto; padding: 72px 32px 100px; }
.info-section { border-top: 1px solid #d9d5cd; padding-top: 18px; }
.info-section h2 { margin: 0; font-size: 20px; font-weight: 600; }
.info-section p { max-width: 480px; margin: 12px 0 0; color: var(--muted); font-size: 15px; line-height: 1.7; }
@media (prefers-reduced-motion: reduce) {
  .carousel { scroll-behavior: auto; }
}
@media (max-width: 820px) {
  .landing { --u: 1px; overflow: hidden; }
  .hero-frame { width: 100%; height: auto; min-height: 0; padding: 18px 20px 0; display: flex; flex-direction: column; align-items: center; overflow: visible; }
  .topbar { position: relative; inset: auto; width: 100%; height: 46px; flex: 0 0 46px; }
  .wordmark { top: 7px; font-size: 18px; }
  .desktop-nav { display: none; }
  .top-auth a { font-size: 13px; }
  .login-pill { width: 66px; height: 34px; }
  .signup-pill { width: 74px; height: 34px; }
  .hero-badge { position: relative; top: auto; left: auto; width: max-content; max-width: 100%; height: 30px; margin-top: 26px; padding: 0 13px; font-size: 12px; translate: none; }
  .hero-title { position: relative; top: auto; left: auto; width: 100%; margin-top: 24px; font-size: clamp(36px, 9vw, 58px); line-height: 1.04; letter-spacing: -.04em; }
  .hero-title span + span { letter-spacing: -.03em; }
  .hero-subline { position: relative; top: auto; left: auto; width: min(100%, 420px); margin-top: 16px; font-size: 15px; line-height: 1.55; }
  .hero-subline span { display: inline; }
  .hero-subline span + span::before { content: " "; }
  .cta-ring { position: relative; top: auto; left: auto; order: 1; flex: 0 0 62px; width: 174px; height: 62px; margin-top: 18px; translate: none; }
  .cta-button { width: 158px; height: 50px; font-size: 16px; }
  .hinglish-note, .hinglish-arrow, .approval-arrow { display: none; }
  .approval-note { position: relative; top: auto; right: auto; order: 2; margin-top: 10px; font-size: 14px; transform: none; }
  .carousel { position: relative; top: auto; left: 0; order: 3; width: 100vw; height: 340px; flex: 0 0 340px; margin-top: 12px; overflow: visible; perspective: 900px; }
  .carousel-card { width: 160px; height: 268px; border-radius: 4px; }
  .info-sections { grid-template-columns: 1fr; gap: 32px; padding: 50px 24px 72px; }
}
@media (max-width: 390px) {
  .hero-frame { padding-right: 14px; padding-left: 14px; }
  .hero-title { font-size: 37px; }
  .hero-subline { font-size: 14px; }
}
`;

export function LandingHero() {
  const landingRef = useRef<HTMLElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = landingRef.current;
    const carousel = root?.querySelector<HTMLElement>(".carousel");
    if (!root || !carousel) return;

    const cards = Array.from(carousel.querySelectorAll<HTMLElement>("[data-carousel-card]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 820px)");
    const measured = { width: window.innerWidth, height: window.innerHeight, unit: 1 };
    const state = { scroll: 0, velocity: 0, dragging: false, lastX: 0, lastTime: 0 };
    let visible = false;
    let previousTime = 0;
    let frameId = 0;
    let fpsFrames = 0;
    let fpsElapsed = 0;
    let fpsValue = 0;

    const measure = () => {
      measured.width = window.innerWidth;
      measured.height = window.innerHeight;
      measured.unit = mobile.matches
        ? Math.max(1, Math.min(measured.width / 640, 1.2))
        : Math.min(measured.width / 1440, measured.height / 940, 1.6);
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", measure);

    const enter = (selector: string, delay: number, rise: number) => {
      root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        element.animate(
          [
            { opacity: 0, transform: `translateY(${rise}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 520, delay, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
        );
      });
    };
    if (!reducedMotion.matches) {
      enter(".topbar", 0, -10);
      enter(".hero-badge", 120, 10);
      enter(".hero-title", 220, 14);
      enter(".hero-subline", 360, 10);
      enter(".cta-ring", 460, 8);
      enter(".carousel", 540, 18);
    }

    const params = new URLSearchParams(window.location.search);
    const showFps = process.env.NODE_ENV !== "production" && params.get("fps") === "1";
    if (fpsRef.current) fpsRef.current.hidden = !showFps;

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) previousTime = 0;
    });
    observer.observe(root.querySelector(".hero-frame") ?? root);

    const render = (time: number) => {
      frameId = requestAnimationFrame(render);
      if (!visible || document.hidden || measured.width === 0) {
        previousTime = 0;
        return;
      }

      const elapsed = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      const scale = measured.unit;
      const isMobile = mobile.matches;
      if (state.dragging) {
        state.velocity = 0;
      } else if (!reducedMotion.matches) {
        if (Math.abs(state.velocity) > 0.5) {
          state.scroll += state.velocity * elapsed;
          state.velocity *= Math.exp(-4.1 * elapsed);
          if (Math.abs(state.velocity) <= 0.5) state.velocity = 0;
        } else {
          state.scroll += (isMobile ? 18 : 34) * elapsed;
        }
      } else {
        state.scroll = 0;
      }

      const centerX = measured.width / 2;
      const centerY = isMobile ? 170 : 330 * scale;
      const pitch = isMobile ? 170 : 280;
      const denominator = isMobile ? 215 : 700;
      const totalWidth = cards.length * pitch;
      cards.forEach((card, index) => {
        const raw = index * pitch - state.scroll + totalWidth / 2;
        const t = ((raw % totalWidth) + totalWidth) % totalWidth - totalWidth / 2;
        const distance = Math.abs(t);
        const d = distance / denominator;
        const q = Math.min(d, 1.2);
        const widthU = isMobile ? 160 : 250 + 60 * d * d;
        const heightU = isMobile ? 268 : 420 + 70 * Math.pow(q, 2.6);
        const pushed = t * (1 + 0.083 * Math.pow(t / denominator, 2));
        const edgeScale = 1 + Math.min(d, 1) * 0.08;
        const scaleX = (isMobile ? widthU / 160 : widthU / 250) * edgeScale;
        const scaleY = (isMobile ? heightU / 268 : heightU / 420) * edgeScale;
        const angle = isMobile ? -Math.sign(t) * Math.min(32, d * 17) : -Math.sign(t) * Math.min(45, d * 20);
        const x = centerX + pushed * (isMobile ? 1 : scale);
        const y = centerY - (isMobile ? 0 : 12 * d * d * scale);
        const halfWidth = (widthU * scale * scaleX) / 2;
        const outside = x + halfWidth < 0 || x - halfWidth > measured.width;

        card.style.visibility = outside ? "hidden" : "visible";
        card.style.zIndex = String(100 - Math.round(d * 10));
        card.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotateY(${angle}deg) scale(${scaleX}, ${scaleY})`;
      });

      if (showFps && fpsRef.current) {
        fpsFrames += 1;
        fpsElapsed += elapsed;
        if (fpsElapsed >= 0.5) {
          fpsValue = Math.round(fpsFrames / fpsElapsed);
          fpsRef.current.textContent = `${fpsValue} FPS`;
          fpsFrames = 0;
          fpsElapsed = 0;
        }
      }
    };

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || reducedMotion.matches) return;
      state.dragging = true;
      state.lastX = event.clientX;
      state.lastTime = performance.now();
      state.velocity = 0;
      carousel.classList.add("is-dragging");
      carousel.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!state.dragging) return;
      const factor = mobile.matches ? 1 : measured.unit;
      const deltaX = event.clientX - state.lastX;
      state.scroll -= deltaX / factor;
      const now = performance.now();
      const deltaTime = Math.max((now - state.lastTime) / 1000, 0.001);
      state.velocity = -(deltaX / factor) / deltaTime;
      state.lastX = event.clientX;
      state.lastTime = now;
    };
    const pointerUp = () => {
      state.dragging = false;
      carousel.classList.remove("is-dragging");
    };
    const visibilityChange = () => {
      if (document.hidden) previousTime = 0;
    };

    carousel.addEventListener("pointerdown", pointerDown);
    carousel.addEventListener("pointermove", pointerMove);
    carousel.addEventListener("pointerup", pointerUp);
    carousel.addEventListener("pointercancel", pointerUp);
    document.addEventListener("visibilitychange", visibilityChange);
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibilityChange);
      carousel.removeEventListener("pointerdown", pointerDown);
      carousel.removeEventListener("pointermove", pointerMove);
      carousel.removeEventListener("pointerup", pointerUp);
      carousel.removeEventListener("pointercancel", pointerUp);
    };
  }, []);

  return (
    <main className="landing" ref={landingRef}>
      <style>{styles}</style>
      <section className="hero-frame" aria-label="JobLoop introduction">
        <header className="topbar">
          <Link className="wordmark" href="/" aria-label="JobLoop home">
            <span className="wordmark-mark" aria-hidden="true" />
            JobLoop
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
          </nav>
          <div className="top-auth">
            <a className="pill-link login-pill" href="/login">Log in</a>
            <a className="pill-link signup-pill" href="/signup">Sign up</a>
          </div>
        </header>

        <div className="hero-badge">Made for print shops and custom merch</div>
        <h1 className="hero-title">
          <span>Every enquiry becomes</span>
          <span>a tracked job</span>
        </h1>
        <p className="hero-subline">
          <span>Paste a customer&apos;s WhatsApp message, review the order,</span>
          <span>send a quote and share a tracking link. Built for print</span>
          <span>shops that quote every job one by one.</span>
        </p>

        <div className="hinglish-note">Hinglish works</div>
        <svg className="arrow-note hinglish-arrow" viewBox="0 0 90 60" aria-hidden="true">
          <path d="M72 2C70 28 48 46 16 54" />
          <path d="M26 44L15 54L28 60" />
        </svg>
        <div className="approval-note">
          <span>You approve it first</span>
          <svg className="arrow-note approval-arrow" viewBox="0 0 36 14" aria-hidden="true">
            <path d="M2 8C12 3 22 3 32 7" />
            <path d="M26 2L33 7L26 12" />
          </svg>
        </div>
        <div className="cta-ring">
          <a className="cta-button" href="/signup">Start a job</a>
        </div>

        <div className="carousel" aria-label="JobLoop product screenshots">
          {screenshots.map((screenshot, index) => (
            <div className="carousel-card" data-carousel-card key={screenshot.src}>
              <Image
                src={screenshot.src}
                alt={screenshot.alt}
                width={960}
                height={1588}
                sizes="(max-width: 820px) 240px, 720px"
                priority={index < 5}
                loading={index < 5 ? "eager" : "lazy"}
                draggable={false}
                style={{ backgroundColor: "#f7f5f0" }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="info-sections">
        <section className="info-section" id="how-it-works">
          <h2>How it works</h2>
          <p>
            Paste a customer message and review the extracted details. Confirm the order yourself,
            prepare a quote, then share its public tracking link with your customer.
          </p>
        </section>
        <section className="info-section" id="features">
          <h2>Made for the job</h2>
          <p>
            <strong>Keep orders organized.</strong> Store customers, services, line items, due dates
            and notes together. <strong>Prepare clear quotes.</strong> Review totals before saving
            and sharing. <strong>Keep everyone in the loop.</strong> Track status changes and give
            customers a limited public tracking page.
          </p>
        </section>
      </div>
      <div className="fps-counter" ref={fpsRef} hidden aria-live="off">0 FPS</div>
    </main>
  );
}
