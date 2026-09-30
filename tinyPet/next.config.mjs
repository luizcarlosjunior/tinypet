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
  const connect = ["'self'", "https://viacep.com.br"];
  // Presigned PUT uploads go straight from the browser to the S3 bucket.
  if (process.env.S3_BUCKET) connect.push(`https://${process.env.S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`, `https://s3.${S3_REGION}.amazonaws.com`);
  if (isDev) connect.push("ws://localhost:*", "ws://127.0.0.1:*"); // HMR
  return [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    // 'wasm-unsafe-eval': client-side video transcoding (ffmpeg.wasm fallback, wasm AAC encoder).
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    // mediabunny / ffmpeg.wasm workers (blob: workers and /ffmpeg/worker.js).
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect.join(" ")}`,
    "font-src 'self' data:",
    // Blog posts may embed YouTube (privacy-enhanced domain first).
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
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
  // Enforced part: framing only. The full policy starts as Report-Only until violations are reviewed.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: csp() },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev server (e.g. a test instance on another port) use its own build dir instead of sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  transpilePackages: ["@tinypet/shared"],
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2", "sharp"] },
  images: { remotePatterns: remotePatterns() },
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
