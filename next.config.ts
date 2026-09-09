import type { NextConfig } from "next";

const securityHeaders = [
  // Evita clickjacking (iframes maliciosos con tu tienda)
  { key: "X-Frame-Options",        value: "SAMEORIGIN" },
  // Evita MIME-type sniffing (archivos disfrazados de JS/CSS)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Evita filtración de URL al hacer requests externos
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  // Deshabilita funciones del browser que no usás
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // DNS Prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Permite acceso desde IPs locales en modo desarrollo (mobile testing, red local)
  allowedDevOrigins: [
    "192.168.1.93",
    "192.168.0.*",
    "192.168.1.*",
    "10.0.0.*",
  ],

  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
