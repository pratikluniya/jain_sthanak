/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles only the files the server needs, so the Docker image stays small.
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
  // Logos change almost never: phones keep them for a week instead of asking again on every page (4 Nov 2026).
  // If a logo ever changes, save it under a new file name so phones pick it up at once.
  async headers() {
    return [
      {
        source: "/:file(logo-sm.webp|loader-logo.webp|logo.png|techshree-logo.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};
export default nextConfig;
