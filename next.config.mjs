/** @type {import('next').NextConfig} */
const nextConfig = {
  // Recharts ships modern ESM that can trigger runtime interop issues in some Next.js browser bundles.
  transpilePackages: ["recharts", "victory-vendor"]
};

export default nextConfig;
