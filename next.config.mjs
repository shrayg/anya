/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  {
    // Report-Only: tighter policy for monitoring. Residual unsafe-inline/unsafe-eval
    // remain because Next.js App Router + HeroUI still need them in production without
    // a full nonce pipeline. Turnstile + Square checkout domains are allowlisted.
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com https://*.squarecdn.com https://*.squareup.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const noStore = {
  key: "Cache-Control",
  value: "private, no-store, max-age=0",
};

const nextConfig = {
  // Allow build-then-swap deploys: `NEXT_DIST_DIR=.next.new npm run build`
  // while production still serves `.next`. Only relative `.next*` dirs allowed.
  distDir: (() => {
    const raw = process.env.NEXT_DIST_DIR?.trim();
    if (!raw || raw === ".next") return ".next";
    if (/^\.next[\w.-]*$/.test(raw)) return raw;
    throw new Error(
      `Refusing unsafe NEXT_DIST_DIR="${raw}". Use a relative .next* directory name.`,
    );
  })(),
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: [
    "got-scraping",
    "got",
    "header-generator",
    "http2-wrapper",
    "ow",
  ],
  turbopack: {
    root: import.meta.dirname,
  },
  async redirects() {
    return [
      // OathNet hub removed — tools fan into category modules. Permanent so
      // bookmarks / stale tabs never paint the old BREACHES/STEALER chip wall.
      {
        source: "/dashboard/search/oathnet",
        destination: "/dashboard/search/stealer-logs",
        permanent: true,
      },
      {
        source: "/dashboard/search/oathnet/:path*",
        destination: "/dashboard/search/stealer-logs",
        permanent: true,
      },
      // Password Search removed — fold into Breaches hub.
      {
        source: "/dashboard/search/password-search",
        destination: "/dashboard/search/breaches",
        permanent: true,
      },
      {
        source: "/dashboard/search/password-search/:path*",
        destination: "/dashboard/search/breaches",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/",
        headers: [noStore],
      },
      {
        source: "/auth",
        headers: [noStore],
      },
      {
        source: "/dashboard/:path*",
        headers: [noStore],
      },
      {
        source: "/api/:path*",
        headers: [noStore],
      },
      // Error / not-found HTML must never be CDN-cached with long s-maxage.
      {
        source: "/404",
        headers: [noStore],
      },
      {
        source: "/_not-found",
        headers: [noStore],
      },
      {
        source: "/_error",
        headers: [noStore],
      },
    ];
  },
};

export default nextConfig;
