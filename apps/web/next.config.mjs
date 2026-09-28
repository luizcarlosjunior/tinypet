/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tinypet/shared", "@tinypet/db"],
  experimental: { serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2", "sharp"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "localhost" }] },
};
export default nextConfig;
