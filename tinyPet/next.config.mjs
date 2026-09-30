const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

const S3_REGION = process.env.S3_REGION ?? process.env.AWS_REGION ?? "sa-east-1";

/** Public base URL of media on AWS S3 (CloudFront/custom domain via S3_PUBLIC_URL, else the bucket URL). */
function s3PublicUrl() {
  if (process.env.S3_PUBLIC_URL) return process.env.S3_PUBLIC_URL;
  if (process.env.S3_BUCKET) return `https://${process.env.S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
  return null;
}

/** Remote image hosts: the S3 public host (when configured) and, in development, localhost. */
function remotePatterns() {
  /** @type {import('next').NextConfig["images"]["remotePatterns"]} */
  const patterns = [];
  const base = s3PublicUrl();
  if (base) {
    try {
      const u = new URL(base);
      patterns.push({ protocol: u.protocol.replace(":", ""), hostname: u.hostname, ...(u.port ? { port: u.port } : {}) });
    } catch {
      console.warn("[next.config] S3_PUBLIC_URL inválida; ignorando em images.remotePatterns");
    }
  }
  if (isDev) patterns.push({ protocol: "http", hostname: "localhost" });
  return patterns;
}

function csp() {
  // reCAPTCHA v3 (login/sign-up) and Cloudflare Web Analytics (beacon injected by Cloudflare).
  const connect = ["'self'", "https://viacep.com.br", "https://www.google.com/recaptcha/", "https://cloudflareinsights.com"];
  // Gallery "Baixar" fetches the media bytes from the public media host (CloudFront / S3_PUBLIC_URL).
  const media = s3PublicUrl();
  if (media) {
    try {
      connect.push(new URL(media).origin);
    } catch {
      /* invalid S3_PUBLIC_URL: already warned in remotePatterns */
    }
  }
  // Presigned PUT uploads go straight from the browser to the S3 bucket.
  if (process.env.S3_BUCKET) connect.push(`https://${process.env.S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`, `https://s3.${S3_REGION}.amazonaws.com`);
  if (isDev) connect.push("ws://localhost:*", "ws://127.0.0.1:*"); // HMR
  return [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    // 'wasm-unsafe-eval': client-side video transcoding (ffmpeg.wasm fallback, wasm AAC encoder).
    // 'unsafe-inline': Next 14 inline bootstrap scripts (no nonce pipeline yet). External scripts: only reCAPTCHA
    // (loaded on login/sign-up) and the Cloudflare analytics beacon.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
    // mediabunny / ffmpeg.wasm workers (blob: workers and /ffmpeg/worker.js).
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect.join(" ")}`,
    "font-src 'self' data:",
    // Blog posts may embed YouTube (privacy-enhanced domain first).
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // Enforced (CSP_REPORT_ONLY=1 switches to report-only, e.g. while debugging a new third-party script).
  process.env.CSP_REPORT_ONLY === "1" ? { key: "Content-Security-Policy-Report-Only", value: csp() } : { key: "Content-Security-Policy", value: csp() },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev server (e.g. a test instance on another port) use its own build dir instead of sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  transpilePackages: ["@tinypet/shared"],
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2", "sharp"] },
  images: { remotePatterns: remotePatterns(), formats: ["image/avif", "image/webp"], minimumCacheTTL: 2592000 },
  // Behind Cloudflare the edge compresses (Brotli/Zstd): skip gzip on the origin to save CPU.
  compress: process.env.TRUST_PROXY !== "cloudflare",
  async headers() {
    // Later entries override earlier ones for the same header key.
    return [
      { source: "/:path*", headers: securityHeaders },
      // ffmpeg.wasm fallback core (~32 MB): cache it; the files only change when @ffmpeg/core is upgraded.
      { source: "/ffmpeg/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      { source: "/convite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/.well-known/apple-app-site-association", headers: [{ key: "Content-Type", value: "application/json" }] },
      {
        // User uploads (dev/local storage): never render as a document.
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Disposition", value: "attachment" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/uploads/:file(.*\\.(?:webp|jpg|jpeg|png|gif|WEBP|JPG|JPEG|PNG|GIF))",
        headers: [{ key: "Content-Disposition", value: "inline" }],
      },
    ];
  },
};
export default nextConfig;
