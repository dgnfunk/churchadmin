/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.10.227"],
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }
    ] }, { source: "/sw-dev.js", headers: [{ key: "Content-Type", value: "application/javascript; charset=utf-8" }, { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }, { source: "/check-in/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    { source: "/api/check-in/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "192.168.10.227:3000"]
    }
  }
};

export default nextConfig;
