import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // спецификации до 20 МБ загружаются через Server Action (по умолчанию лимит 1 МБ)
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  // PDF КП и счетов: библиотека рендерится на сервере, шрифты Inter читаются с диска
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/api/documents/**": ["./src/assets/fonts/**"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
