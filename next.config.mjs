/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles only the files the server needs, so the Docker image stays small.
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};
export default nextConfig;
