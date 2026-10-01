// Branded standalone pages for visitors following a short link that can't be served.
// These are sent straight from the redirect routes, so they can't rely on the client bundle.

type StatusPageVariant = "expired" | "not-found";

const PAGES: Record<StatusPageVariant, { status: number; label: string; title: string; message: string; icon: string }> = {
  expired: {
    status: 410,
    label: "Link expired",
    title: "This link has expired",
    message: "The owner of this link set it to stop working after a certain date. If you still need access, ask whoever shared it for a new link.",
    // Clock
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  },
  "not-found": {
    status: 404,
    label: "Error 404",
    title: "Link not found",
    message: "We couldn't find anything at this address. The link may have been mistyped, or it may have been removed by its owner.",
    // Broken link
    icon: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 4 8"/><line x1="8" y1="12" x2="12" y2="12"/><line x1="2" y1="2" x2="22" y2="22"/>',
  },
};

export function renderStatusPage(variant: StatusPageVariant): { status: number; html: string } {
  const page = PAGES[variant];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${page.title} | Adlink</title>
  <link rel="icon" type="image/svg+xml" href="/images/adlink-logo.svg">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #f9fafb;
      background: #030712;
      overflow-x: hidden;
      position: relative;
      -webkit-font-smoothing: antialiased;
    }
    .glow {
      position: fixed;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
      z-index: 0;
    }
    .glow.blue { width: 520px; height: 520px; top: 50%; left: 50%; transform: translate(-60%, -60%); background: rgba(59, 130, 246, 0.16); }
    .glow.violet { width: 420px; height: 420px; top: 50%; left: 50%; transform: translate(-30%, -30%); background: rgba(139, 92, 246, 0.14); }
    .grid {
      position: fixed;
      inset: 0;
      z-index: 0;
      background-image:
        linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 75%);
    }
    main {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 440px;
      padding: 40px 32px 32px;
      text-align: center;
      border-radius: 20px;
      background: rgba(17, 24, 39, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: rise 0.5s ease-out both;
    }
    .icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #93c5fd;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(139, 92, 246, 0.18));
      border: 1px solid rgba(147, 197, 253, 0.25);
    }
    .icon svg { width: 32px; height: 32px; }
    .label {
      display: inline-block;
      margin-bottom: 12px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #c4b5fd;
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.25);
    }
    h1 { margin: 0 0 12px; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
    p { margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.65); }
    .brand {
      position: relative;
      z-index: 1;
      margin-top: 28px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.45);
    }
    .brand-mark {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: linear-gradient(90deg, #2563eb, #7c3aed);
      color: #fff;
    }
    .brand-mark svg { width: 12px; height: 12px; }
    .brand strong {
      font-weight: 700;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { main { animation: none; } }
    @media (max-width: 480px) { main { padding: 32px 20px 24px; } h1 { font-size: 22px; } }
  </style>
</head>
<body>
  <div class="grid" aria-hidden="true"></div>
  <div class="glow blue" aria-hidden="true"></div>
  <div class="glow violet" aria-hidden="true"></div>
  <main>
    <div class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${page.icon}</svg>
    </div>
    <span class="label">${page.label}</span>
    <h1>${page.title}</h1>
    <p>${page.message}</p>
  </main>
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </span>
    Powered by <strong>ADLink</strong>
  </div>
</body>
</html>`;
  return { status: page.status, html };
}
