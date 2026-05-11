/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Self-contained Node output under `.next/standalone` for Docker / portable deploy.
   * After build, copy `public` and `.next/static` into the standalone folder (see Next.js docs).
   */
  output: "standalone",
};

export default nextConfig;
