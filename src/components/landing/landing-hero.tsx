"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const scenes = [
  {
    label: "Customer message",
    content: (
      <>
        <div className="scene-topline"><span>WhatsApp</span><span>11:42</span></div>
        <div className="chat-person">Aanya · Indiranagar</div>
        <div className="chat-bubble typing">
          bhai 2 banner chahiye 5x3 feet, parso tak
          <span className="typing-cursor" />
        </div>
        <div className="chat-date">TODAY</div>
      </>
    ),
  },
  {
    label: "Order details review",
    content: (
      <>
        <div className="scene-label">REVIEW ORDER</div>
        <div className="review-line"><b>Customer</b><span>Aanya Sharma</span></div>
        <div className="review-line"><b>Service</b><span>Banner printing</span></div>
        <div className="review-line"><b>Quantity</b><span>2</span></div>
        <div className="review-line"><b>Size</b><span>5 × 3 ft</span></div>
        <div className="check-tag">Check this</div>
        <div className="scene-foot">You confirm before an order is created.</div>
      </>
    ),
  },
  {
    label: "Customer record",
    content: (
      <>
        <div className="scene-label">CUSTOMER</div>
        <div className="customer-initial">AS</div>
        <div className="customer-name">Aanya Sharma</div>
        <div className="customer-data">+91 98765 43210</div>
        <div className="customer-data">Indiranagar, Bengaluru</div>
        <div className="source-tag">WhatsApp</div>
        <div className="record-rule" />
        <div className="scene-foot">Customer details, together.</div>
      </>
    ),
  },
  {
    label: "Order line items",
    content: (
      <>
        <div className="scene-label">JL-0042 · ORDER</div>
        <div className="table-head"><span>SERVICE</span><span>QTY</span><span>PRICE</span></div>
        <div className="table-row"><span>Banner 5 × 3 ft</span><span>2</span><span>₹3,450</span></div>
        <div className="table-row"><span>Eyelets</span><span>8</span><span>₹320</span></div>
        <div className="record-rule" />
        <div className="table-total">
          <span>Total</span>
          <b className="counting-total" aria-label="7,220 rupees">
            ₹<span className="rolling-digit roll-7"><span className="digit-strip">{Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}</span></span>
            <span className="number-comma">,</span>
            <span className="rolling-digit roll-2"><span className="digit-strip">{Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}</span></span>
            <span className="rolling-digit roll-2"><span className="digit-strip">{Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}</span></span>
            <span className="rolling-digit roll-0"><span className="digit-strip">{Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}</span></span>
          </b>
        </div>
        <div className="scene-foot">Line items at a glance.</div>
      </>
    ),
  },
  {
    label: "Quote breakdown",
    content: (
      <>
        <div className="scene-label">QUOTE · JL-Q-0001</div>
        <div className="quote-row"><span>Subtotal</span><span>₹7,220.00</span></div>
        <div className="quote-row"><span>Discount</span><span>− ₹220.00</span></div>
        <div className="quote-row"><span>GST 18%</span><span>₹1,260.00</span></div>
        <div className="quote-row"><span>Delivery</span><span>₹150.00</span></div>
        <div className="record-rule" />
        <div className="quote-total"><span>Total</span><b>₹8,410.00</b></div>
        <div className="scene-foot">A clear quote, ready to share.</div>
      </>
    ),
  },
  {
    label: "Quote document",
    content: (
      <>
        <div className="paper-document">
          <div className="paper-brand">JobLoop</div>
          <div className="paper-caption">QUOTATION</div>
          <div className="paper-number">JL-Q-0001</div>
          <div className="paper-rule" />
          <div className="paper-copy">Prepared for<br /><b>Aanya Sharma</b></div>
          <div className="paper-copy">Banner printing · 2 pieces</div>
          <div className="paper-rule" />
          <div className="paper-total"><span>Total</span><b>₹8,410.00</b></div>
          <div className="paper-copy">Valid until 31 Oct 2026</div>
        </div>
      </>
    ),
  },
  {
    label: "WhatsApp quote reply",
    content: (
      <>
        <div className="scene-topline"><span>WhatsApp</span><span>12:06</span></div>
        <div className="chat-person">Aanya · Indiranagar</div>
        <div className="reply-bubble">
          Hi Aanya, your quote JL-Q-0001 is ready.
          <b>Total: ₹8,410.00</b>
          <span>Track your order: jobloop-seven.vercel.app/track/…</span>
        </div>
        <div className="reply-time">12:06 ✓✓</div>
      </>
    ),
  },
  {
    label: "Order status timeline",
    content: (
      <>
        <div className="scene-label">JL-0042 · STATUS</div>
        <div className="status-list">
          <div className="status-step done"><i />Enquiry<span>24 Oct</span></div>
          <div className="status-step done"><i />Quoted<span>24 Oct</span></div>
          <div className="status-step done"><i />Approved<span>25 Oct</span></div>
          <div className="status-step done"><i />In progress<span>25 Oct</span></div>
          <div className="status-step current"><i />Ready<span>28 Oct</span></div>
          <div className="status-step"><i />Delivered<span /></div>
        </div>
        <div className="status-stamp">IN PROGRESS</div>
      </>
    ),
  },
  {
    label: "Public order tracking page",
    content: (
      <>
        <div className="phone-shell">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <div className="phone-brand">Your print shop</div>
            <div className="phone-job">JL-0042</div>
            <div className="phone-current">IN PROGRESS</div>
            <div className="phone-steps">
              <div className="phone-step done">Enquiry <span>24 Oct</span></div>
              <div className="phone-step done">Quoted <span>24 Oct</span></div>
              <div className="phone-step current">In progress <span>25 Oct</span></div>
              <div className="phone-step">Ready</div>
              <div className="phone-step">Delivered</div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    label: "Dashboard summary",
    content: (
      <>
        <div className="scene-label">DASHBOARD · EXAMPLE</div>
        <div className="metric-row"><span>Pending quotes</span><b>2</b></div>
        <div className="metric-row"><span>Orders due today</span><b>1</b></div>
        <div className="metric-row"><span>Outstanding</span><b>₹8,410</b></div>
        <div className="record-rule" />
        <div className="dashboard-order">
          <b>JL-0042</b><span>Aanya Sharma</span><i>In progress</i>
        </div>
        <div className="scene-foot">Orders and balances in one view.</div>
      </>
    ),
  },
];

const styles = `
.landing {
  --page: #F7F5F0;
  --ink: #151515;
  --muted: #5F5B54;
  --accent: #1F3A5F;
  --badge: #E3E8F0;
  --white: #FFFFFF;
  --scene-blue: #EEF1F6;
  --scene-paper: #F3EFE6;
  --line: #D9D5CD;
  --soft-ink: #36332F;
  --u: min(0.0694444444vw, 0.0925925926vh);
  color: var(--ink);
  background: var(--page);
  font-family: var(--font-geist), sans-serif;
}
.landing * { box-sizing: border-box; }
.hero-frame {
  position: relative;
  width: min(100vw, 133.333333vh);
  aspect-ratio: 4 / 3;
  margin: 0 auto;
  overflow: hidden;
}
.topbar { position: absolute; inset: 29u 37u auto; z-index: 30; height: 42u; }
.wordmark {
  position: absolute; left: 0; top: 7u; display: inline-flex; align-items: center;
  gap: 8u; color: var(--ink); font-size: 21u; font-weight: 600; letter-spacing: -0.045em;
  text-decoration: none;
}
.wordmark-mark { width: 11u; height: 11u; background: var(--accent); display: inline-block; }
.desktop-nav {
  position: absolute; top: 2u; left: 468u; display: flex; align-items: center; gap: 31u;
}
.desktop-nav a, .top-auth a {
  color: var(--ink); font-size: 16.4u; font-weight: 400; text-decoration: none; white-space: nowrap;
}
.desktop-nav a:hover, .text-link:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; }
.top-auth { position: absolute; right: 0; top: 0; display: flex; gap: 1u; }
.pill-link {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  font-size: 15u !important; font-weight: 500 !important; text-decoration: none !important;
}
.login-pill { width: 92u; height: 40u; color: var(--ink) !important; background: var(--white); }
.signup-pill { width: 97u; height: 40u; color: var(--white) !important; background: var(--accent); }
.landing a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
.hero-badge {
  position: absolute; z-index: 5; top: 115u; left: 50%; transform: translateX(-50%);
  width: 340u; height: 37u; display: flex; justify-content: center; align-items: center;
  border-radius: 999px; background: var(--badge); color: var(--accent);
  font-size: 16.6u; font-weight: 500; white-space: nowrap;
}
.hero-title {
  position: absolute; z-index: 5; top: 176u; left: 0; width: 100%; margin: 0;
  color: var(--ink); text-align: center; font-size: 88u; font-weight: 600;
  letter-spacing: -0.035em; line-height: 92u;
}
.hero-title span { display: block; }
.hero-title span + span { letter-spacing: -0.022em; }
.hero-subline {
  position: absolute; z-index: 5; top: 394u; left: 0; width: 100%; margin: 0;
  color: var(--muted); text-align: center; font-size: 20.8u; font-weight: 400;
  line-height: 32u;
}
.hero-subline span { display: block; }
.carousel {
  position: absolute; inset: 0; overflow: hidden; touch-action: pan-y; cursor: grab;
  user-select: none; -webkit-user-select: none;
}
.carousel.is-dragging { cursor: grabbing; }
.carousel-card {
  position: absolute; left: 0; top: 0; overflow: hidden; background: var(--white);
  border-radius: 0; will-change: left, top, width, height, clip-path, transform;
}
.scene-canvas {
  position: absolute; left: 50%; top: 50%; width: 300px; height: 420px;
  padding: 26px 24px; transform: translate(-50%, -50%) scale(var(--scene-scale, .7));
  transform-origin: center; color: var(--soft-ink); font-family: var(--font-geist), sans-serif;
  font-size: 13px; line-height: 1.4;
}
.carousel-card:nth-child(1) .scene-canvas,
.carousel-card:nth-child(7) .scene-canvas { background: var(--scene-blue); }
.carousel-card:nth-child(2) .scene-canvas,
.carousel-card:nth-child(6) .scene-canvas { background: var(--scene-paper); }
.carousel-card:nth-child(3) .scene-canvas,
.carousel-card:nth-child(8) .scene-canvas,
.carousel-card:nth-child(10) .scene-canvas { background: var(--white); }
.carousel-card:nth-child(4) .scene-canvas,
.carousel-card:nth-child(9) .scene-canvas { background: var(--scene-blue); }
.scene-topline { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; }
.chat-person { margin-top: 42px; text-align: center; color: var(--muted); font-size: 11px; }
.chat-bubble, .reply-bubble {
  position: relative; margin-top: 26px; padding: 16px; border-radius: 12px 12px 12px 3px;
  background: var(--white); font-size: 16px; line-height: 1.55;
}
.typing { animation: message-appear 6s ease-in-out infinite; }
.typing-cursor { display: inline-block; width: 1px; height: 16px; margin-left: 2px; background: var(--accent); vertical-align: -3px; }
.chat-date { margin-top: 30px; text-align: center; color: var(--muted); font-size: 10px; letter-spacing: .12em; }
.scene-label { color: var(--muted); font-size: 11px; font-weight: 500; letter-spacing: .1em; }
.review-line { display: flex; flex-direction: column; gap: 2px; padding: 14px 0 9px; border-bottom: 1px solid var(--line); }
.review-line b { color: var(--muted); font-size: 10px; font-weight: 500; }
.review-line span { font-size: 16px; animation: field-appear 6s ease-in-out infinite; }
.review-line:nth-of-type(3) span { animation-delay: .3s; }
.review-line:nth-of-type(4) span { animation-delay: .6s; }
.review-line:nth-of-type(5) span { animation-delay: .9s; }
.check-tag { display: inline-block; margin-top: 16px; padding: 3px 8px; border: 1px solid var(--accent); color: var(--accent); font-size: 10px; }
.scene-foot { position: absolute; left: 24px; right: 24px; bottom: 25px; color: var(--muted); font-size: 11px; }
.customer-initial { display: grid; place-items: center; width: 52px; height: 52px; margin: 44px auto 12px; border: 1px solid var(--accent); color: var(--accent); font-size: 17px; }
.customer-name { text-align: center; font-size: 19px; font-weight: 500; }
.customer-data { margin-top: 7px; text-align: center; color: var(--muted); font-size: 13px; }
.source-tag { width: fit-content; margin: 19px auto; padding: 4px 11px; border: 1px solid var(--line); border-radius: 4px; font-size: 11px; }
.record-rule { height: 1px; margin: 17px 0; background: var(--line); }
.table-head, .table-row { display: grid; grid-template-columns: 1fr 36px 72px; gap: 4px; align-items: center; }
.table-head { margin-top: 39px; padding-bottom: 9px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 9px; letter-spacing: .08em; }
.table-head span:last-child, .table-row span:last-child { text-align: right; }
.table-row { min-height: 39px; border-bottom: 1px solid var(--line); font-size: 11px; }
.table-row span:nth-child(2) { text-align: center; }
.table-total, .quote-total, .paper-total { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-geist-mono), monospace; font-variant-numeric: tabular-nums; }
.table-total { margin-top: 17px; font-size: 15px; }
.counting-total { display: inline-flex; align-items: center; font-variant-numeric: tabular-nums; }
.rolling-digit { display: inline-block; width: .58em; height: 1em; overflow: hidden; line-height: 1; vertical-align: bottom; }
.digit-strip { display: flex; flex-direction: column; color: var(--soft-ink); }
.roll-7 .digit-strip { animation: roll-seven 6s ease-in-out infinite; }
.roll-2 .digit-strip { animation: roll-two 6s ease-in-out infinite; }
.roll-0 .digit-strip { animation: roll-zero 6s ease-in-out infinite; }
.number-comma { margin-right: .03em; }
.quote-row { display: flex; justify-content: space-between; margin-top: 18px; font-size: 13px; }
.quote-total { margin-top: 4px; font-size: 16px; }
.paper-document { position: absolute; inset: 28px 34px; padding: 23px 20px; background: var(--white); border: 1px solid var(--line); }
.paper-brand { font-size: 13px; font-weight: 600; }
.paper-caption { margin-top: 39px; color: var(--muted); font-size: 9px; letter-spacing: .16em; }
.paper-number { margin-top: 5px; font-family: var(--font-geist-mono), monospace; font-size: 15px; }
.paper-rule { height: 1px; margin: 17px 0; background: var(--line); }
.paper-copy { margin: 12px 0; font-size: 11px; line-height: 1.7; }
.paper-total { font-size: 12px; }
.reply-bubble { margin-top: 32px; font-size: 14px; }
.reply-bubble b, .reply-bubble span { display: block; margin-top: 10px; }
.reply-bubble span { color: var(--accent); font-size: 12px; }
.reply-time { margin-top: 7px; text-align: right; color: var(--muted); font-size: 10px; }
.status-list { position: relative; margin-top: 22px; }
.status-list::before { position: absolute; content: ""; left: 5px; top: 7px; bottom: 8px; width: 1px; background: var(--line); }
.status-step { position: relative; display: flex; align-items: center; min-height: 38px; padding-left: 23px; color: var(--muted); font-size: 13px; }
.status-step i { position: absolute; left: 0; width: 11px; height: 11px; border: 1px solid var(--line); border-radius: 50%; background: var(--scene-paper); }
.status-step span { margin-left: auto; color: var(--muted); font-family: var(--font-geist-mono), monospace; font-size: 10px; }
.status-step.done, .status-step.current { color: var(--ink); }
.status-step.done i, .status-step.current i { border-color: var(--accent); background: var(--accent); }
.status-step.current { font-weight: 500; }
.status-stamp { width: fit-content; margin: 12px 0 0 23px; padding: 5px 9px; border: 1px solid var(--accent); border-radius: 4px; color: var(--accent); font-size: 9px; font-weight: 500; letter-spacing: .09em; }
.phone-shell { position: absolute; inset: 22px 63px; padding: 23px 12px 14px; border: 2px solid var(--ink); border-radius: 26px; background: var(--white); }
.phone-speaker { position: absolute; top: 9px; left: 50%; width: 31px; height: 3px; border-radius: 4px; background: var(--line); transform: translateX(-50%); }
.phone-screen { height: 100%; padding: 11px 8px; }
.phone-brand { font-size: 9px; font-weight: 500; }
.phone-job { margin-top: 17px; font-family: var(--font-geist-mono), monospace; font-size: 17px; }
.phone-current { display: inline-block; margin-top: 7px; padding: 3px 6px; border: 1px solid var(--accent); border-radius: 4px; color: var(--accent); font-size: 7px; letter-spacing: .08em; }
.phone-steps { position: relative; margin-top: 12px; padding-left: 10px; }
.phone-steps::before { position: absolute; content: ""; left: 2px; top: 6px; bottom: 7px; width: 1px; background: var(--line); }
.phone-step { position: relative; min-height: 28px; padding-left: 9px; color: var(--muted); font-size: 8px; }
.phone-step::before { position: absolute; content: ""; left: -11px; top: 2px; width: 5px; height: 5px; border: 1px solid var(--line); border-radius: 50%; background: var(--white); }
.phone-step.done, .phone-step.current { color: var(--ink); }
.phone-step.done::before, .phone-step.current::before { border-color: var(--accent); background: var(--accent); }
.phone-step span { display: block; color: var(--muted); font-size: 7px; }
.metric-row { display: flex; align-items: center; justify-content: space-between; margin-top: 24px; padding-bottom: 13px; border-bottom: 1px solid var(--line); font-size: 13px; }
.metric-row b { font-family: var(--font-geist-mono), monospace; font-size: 18px; font-weight: 500; font-variant-numeric: tabular-nums; }
.dashboard-order { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; font-size: 10px; }
.dashboard-order b { font-family: var(--font-geist-mono), monospace; }
.dashboard-order i { grid-column: 1 / -1; color: var(--accent); font-style: normal; }
.arrow-note {
  position: absolute; z-index: 12; pointer-events: none; overflow: visible;
}
.doodle-slashes { left: 263u; top: 377u; width: 35u; height: 30u; }
.hinglish-note {
  position: absolute; z-index: 12; left: 1212u; top: 310u; color: var(--accent);
  font-family: var(--font-caveat), cursive; font-size: 27u; font-weight: 600;
  transform: rotate(16deg); white-space: nowrap;
}
.hinglish-arrow { left: 1085u; top: 348u; width: 190u; height: 210u; }
.approval-note {
  position: absolute; z-index: 12; left: 521u; top: 937u; color: var(--accent);
  font-family: var(--font-caveat), cursive; font-size: 25u; font-weight: 600;
  transform: rotate(-24deg); white-space: nowrap;
}
.approval-arrow { left: 597u; top: 920u; width: 47u; height: 27u; }
.cta-ring {
  position: absolute; z-index: 20; left: 626u; top: 901u; width: 190u; height: 74u;
  display: grid; place-items: center; border: 1px dashed var(--accent); border-radius: 999px;
}
.cta-button {
  width: 172u; height: 58u; border-radius: 999px; background: var(--accent); color: var(--white);
  display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
  font-size: 18u; font-weight: 500; transition: background-color .15s ease;
}
.cta-button:hover, .signup-pill:hover { background: var(--ink); }
.info-sections { max-width: 1080px; margin: 0 auto; padding: 64px 32px 80px; }
.info-section { display: grid; grid-template-columns: 220px 1fr; gap: 40px; padding: 30px 0; border-top: 1px solid var(--line); scroll-margin-top: 24px; }
.info-section h2 { margin: 0; font-size: 20px; font-weight: 500; }
.info-section p { max-width: 680px; margin: 0; color: var(--muted); font-size: 16px; line-height: 1.8; }
.info-section strong { color: var(--ink); font-weight: 500; }
.text-link { color: var(--accent); text-underline-offset: 4px; }
.scene-motion { animation: scene-rise 6s ease-in-out infinite; }
.carousel[data-paused="true"] .scene-canvas * { animation-play-state: paused !important; }
.carousel[data-reduced="true"] .scene-canvas * { animation: none !important; }
@keyframes message-appear { 0%, 8% { opacity: 0; transform: translateY(9px); } 18%, 77% { opacity: 1; transform: translateY(0); } 90%, 100% { opacity: 0; transform: translateY(-5px); } }
@keyframes field-appear { 0%, 10% { opacity: 0; transform: translateY(5px); } 25%, 82% { opacity: 1; transform: translateY(0); } 94%, 100% { opacity: 0; transform: translateY(-3px); } }
@keyframes scene-rise { 0%, 8% { opacity: .35; transform: translateY(6px); } 18%, 82% { opacity: 1; transform: translateY(0); } 94%, 100% { opacity: .35; transform: translateY(-3px); } }
@keyframes roll-seven { 0%, 12% { transform: translateY(0); opacity: 1; } 26%, 84% { transform: translateY(-7em); opacity: 1; } 96%, 100% { transform: translateY(-10em); opacity: 0; } }
@keyframes roll-two { 0%, 20% { transform: translateY(0); opacity: 1; } 34%, 84% { transform: translateY(-2em); opacity: 1; } 96%, 100% { transform: translateY(-10em); opacity: 0; } }
@keyframes roll-zero { 0%, 28% { transform: translateY(0); opacity: 1; } 42%, 84% { transform: translateY(0); opacity: 1; } 96%, 100% { transform: translateY(-10em); opacity: 0; } }
@media (max-width: 820px) {
  .landing { --u: min(0.15625vw, 0.092592593vh); }
  .hero-frame { width: 100%; min-height: 100svh; height: auto; aspect-ratio: auto; display: grid; grid-template-rows: 56px auto auto auto 250px auto; align-content: start; justify-items: center; gap: 17px; padding: 9px 20px 34px; overflow: hidden; }
  .topbar { position: relative; inset: auto; width: 100%; height: 48px; display: flex; justify-content: space-between; align-items: center; }
  .wordmark { position: static; gap: 7px; font-size: 19px; }
  .wordmark-mark { width: 10px; height: 10px; }
  .desktop-nav, .login-pill { display: none !important; }
  .top-auth { position: static; }
  .signup-pill { width: 88px; height: 38px; font-size: 14px !important; }
  .hero-badge { position: static; transform: none; width: auto; height: 30px; padding: 0 13px; font-size: 11px; }
  .hero-title { position: static; width: 100%; font-size: clamp(38px, 8.6vw, 56px); line-height: 1.06; letter-spacing: -.045em; }
  .hero-title span + span { letter-spacing: -.03em; }
  .hero-subline { position: static; width: 100%; font-size: 14px; line-height: 1.6; }
  .hero-subline span { display: inline; }
  .hero-subline span::after { content: " "; }
  .carousel { position: relative; inset: auto; width: calc(100% + 40px); height: 250px; margin: 0 -20px; }
  .doodle-slashes, .hinglish-note, .hinglish-arrow, .approval-arrow { display: none; }
  .approval-note { position: static; margin: 0 0 10px 8px; font-size: 21px; transform: rotate(-8deg); }
  .cta-ring { position: static; width: 190px; height: 70px; }
  .cta-button { width: 172px; height: 58px; font-size: 17px; }
  .info-sections { padding: 32px 22px 56px; }
  .info-section { grid-template-columns: 1fr; gap: 12px; padding: 22px 0; }
  .info-section h2 { font-size: 18px; }
  .info-section p { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .landing *, .landing *::before, .landing *::after { scroll-behavior: auto !important; }
  .cta-button, .signup-pill { transition: none; }
  .scene-motion, .typing, .review-line span, .digit-strip { animation: none !important; }
}
`;

const compiledStyles = styles.replace(
  /(-?\d+(?:\.\d+)?)u\b/g,
  "calc($1 * var(--u))",
);

function roundedQuadPath(width: number, topLeft: number, topRight: number, bottomLeft: number, bottomRight: number, radius: number) {
  const r = Math.min(radius, width / 2, (bottomLeft - topLeft) / 2, (bottomRight - topRight) / 2);
  return `path("M ${r} ${topLeft} Q 0 ${topLeft} 0 ${topLeft + r} L 0 ${bottomLeft - r} Q 0 ${bottomLeft} ${r} ${bottomLeft} L ${width - r} ${bottomRight} Q ${width} ${bottomRight} ${width} ${bottomRight - r} L ${width} ${topRight + r} Q ${width} ${topRight} ${width - r} ${topRight} Z")`;
}

export function LandingHero() {
  const landingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return;

    const carousel = root.querySelector<HTMLElement>(".carousel");
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-card]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 820px)");
    const visible = { value: true };
    let dragging = false;
    let pointerStartX = 0;
    let scrollStart = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;
    let velocity = 0;
    let scroll = 0;
    let previousTime: number | null = null;
    let frameId = 0;
    let clock: Animation | null = null;

    const animateEntrance = () => {
      if (reducedMotion.matches) return;
      const enter = (selector: string, delay: number, rise = 10) => {
        root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
          element.animate(
            [
              { opacity: 0, translate: `0 ${rise}px`, filter: "blur(5px)" },
              { opacity: 1, translate: "0 0", filter: "blur(0)" },
            ],
            { duration: 650, delay, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
          );
        });
      };
      enter(".topbar", 0, -12);
      enter(".hero-badge", 180, 0);
      enter(".hero-title span", 330, 18);
      enter(".hero-subline", 550, 12);
      enter(".carousel", 720, 30);
      root.querySelector<HTMLElement>(".cta-ring")?.animate(
        [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 550, delay: 950, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" },
      );
      root.querySelectorAll<SVGPathElement>("[data-draw]").forEach((path) => {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        path.animate(
          [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
          { duration: 900, delay: 1120, easing: "ease-out", fill: "forwards" },
        );
      });
      enter(".hinglish-note, .approval-note", 1300, 4);
    };

    animateEntrance();

    const pauseState = () => {
      const paused = document.hidden || !visible.value;
      carousel?.setAttribute("data-paused", String(paused || reducedMotion.matches));
      if (paused) previousTime = null;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible.value = entry.isIntersecting;
      pauseState();
    });
    observer.observe(root.querySelector(".hero-frame") ?? root);

    const onMotionChange = () => {
      carousel?.setAttribute("data-reduced", String(reducedMotion.matches));
      pauseState();
    };
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", pauseState);
    carousel?.setAttribute("data-reduced", String(reducedMotion.matches));
    pauseState();

    if (!reducedMotion.matches) {
      clock = document.documentElement.animate(
        [{ opacity: 1 }, { opacity: 1 }],
        { duration: 1_000_000_000, iterations: Infinity },
      );
    }

    const render = () => {
      frameId = requestAnimationFrame(render);
      if (!carousel || !visible.value || document.hidden) {
        previousTime = null;
        return;
      }

      const rect = carousel.getBoundingClientRect();
      const isMobile = mobile.matches;
      const units = rect.width / (isMobile ? 640 : 1440);
      const centerX = (isMobile ? 320 : 720);
      const centerY = isMobile ? 205 : 687;
      const denominator = isMobile ? 314 : 706;
      const now = Number(clock?.currentTime ?? performance.now());
      const elapsed = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;

      if (dragging) {
        velocity = 0;
      } else if (!reducedMotion.matches) {
        if (Math.abs(velocity) > 0.5) {
          scroll += velocity * elapsed;
          velocity *= Math.pow(0.05, elapsed);
          if (Math.abs(velocity) <= 0.5) velocity = 0;
        } else {
          scroll += 50 * elapsed;
        }
      }

      const totalWidth = cards.length * 196;
      cards.forEach((card, index) => {
        const raw = index * 196 - 5 * 196 - scroll + totalWidth / 2;
        const t = ((raw % totalWidth) + totalWidth) % totalWidth - totalWidth / 2;
        const d = Math.abs(t) / denominator;
        const widthU = 170 + 48 * d * d;
        const pushed = t * (1 + 0.083 * Math.pow(t / denominator, 2));
        const x = (centerX + pushed) * units;
        if (x + (widthU * units) / 2 < 0 || x - (widthU * units) / 2 > rect.width) {
          card.style.visibility = "hidden";
          return;
        }
        card.style.visibility = "visible";
        const hLeftU = 280 + 92 * Math.pow(Math.abs(t - widthU / 2) / denominator, 2.6);
        const hRightU = 280 + 92 * Math.pow(Math.abs(t + widthU / 2) / denominator, 2.6);
        const y = (centerY - 12 * d * d) * units;
        const cardWidth = widthU * units;
        const leftHeight = hLeftU * units;
        const rightHeight = hRightU * units;
        const cardHeight = Math.max(leftHeight, rightHeight);
        const topLeft = (cardHeight - leftHeight) / 2;
        const topRight = (cardHeight - rightHeight) / 2;
        const bottomLeft = topLeft + leftHeight;
        const bottomRight = topRight + rightHeight;

        card.style.left = `${x - cardWidth / 2}px`;
        card.style.top = `${y - cardHeight / 2}px`;
        card.style.width = `${cardWidth}px`;
        card.style.height = `${cardHeight}px`;
        card.style.clipPath = roundedQuadPath(
          cardWidth,
          topLeft,
          topRight,
          bottomLeft,
          bottomRight,
          15 * units,
        );
        card.style.transform = `rotate(${(t / denominator) * 8}deg)`;
        card.style.zIndex = String(100 - Math.round(d * 10));
        const sceneScale = Math.max(cardWidth / 300, cardHeight / 420);
        card.style.setProperty("--scene-scale", String(sceneScale));
      });

      if (rect.height === 0) previousTime = null;
    };

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !carousel) return;
      dragging = true;
      pointerStartX = event.clientX;
      scrollStart = scroll;
      lastPointerX = event.clientX;
      lastPointerTime = performance.now();
      velocity = 0;
      carousel.classList.add("is-dragging");
      carousel.setPointerCapture(event.pointerId);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!dragging || !carousel) return;
      const units = carousel.getBoundingClientRect().width / (mobile.matches ? 640 : 1440);
      scroll = scrollStart - (event.clientX - pointerStartX) / units;
      const now = performance.now();
      const deltaTime = Math.max((now - lastPointerTime) / 1000, 0.001);
      velocity = -((event.clientX - lastPointerX) / units) / deltaTime;
      lastPointerX = event.clientX;
      lastPointerTime = now;
    };

    const pointerUp = () => {
      if (!carousel) return;
      dragging = false;
      carousel.classList.remove("is-dragging");
    };

    carousel?.addEventListener("pointerdown", pointerDown);
    carousel?.addEventListener("pointermove", pointerMove);
    carousel?.addEventListener("pointerup", pointerUp);
    carousel?.addEventListener("pointercancel", pointerUp);
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", pauseState);
      carousel?.removeEventListener("pointerdown", pointerDown);
      carousel?.removeEventListener("pointermove", pointerMove);
      carousel?.removeEventListener("pointerup", pointerUp);
      carousel?.removeEventListener("pointercancel", pointerUp);
      clock?.cancel();
    };
  }, []);

  return (
    <main className="landing" ref={landingRef}>
      <style>{compiledStyles}</style>
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

        <div className="carousel" aria-hidden="true">
          {scenes.map((scene) => (
            <div className="carousel-card" data-carousel-card key={scene.label}>
              <div className="scene-canvas">
                <div className="scene-motion">{scene.content}</div>
              </div>
            </div>
          ))}
        </div>

        <svg className="arrow-note doodle-slashes" viewBox="0 0 36 32" fill="none" aria-hidden="true">
          <path data-draw d="M9 27L23 5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          <path data-draw d="M21 28L32 10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="hinglish-note">Hinglish works</div>
        <svg className="arrow-note hinglish-arrow" viewBox="0 0 190 210" fill="none" aria-hidden="true">
          <path data-draw d="M165 4C156 63 129 85 90 107C53 129 28 151 22 185" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
          <path data-draw d="M12 174L22 187L33 176" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="approval-note">You approve it first</div>
        <svg className="arrow-note approval-arrow" viewBox="0 0 47 27" fill="none" aria-hidden="true">
          <path data-draw d="M3 5C17 7 26 14 37 21" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
          <path data-draw d="M28 22L38 22L36 13" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="cta-ring">
          <a className="cta-button" href="/signup">Start a job</a>
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
    </main>
  );
}
