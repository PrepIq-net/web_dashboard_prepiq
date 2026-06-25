import type { NextConfig } from "next";

/**
 * Derive a Next.js remotePattern from NEXT_PUBLIC_API_BASE_URL so that
 * <Image> can load media served by the Django backend (dev: local filesystem,
 * prod: Cloudinary CDN returns absolute URLs so the backend host isn't needed
 * in production, but it's harmless to include it).
 */
function backendImagePattern(): { protocol: "http" | "https"; hostname: string; port?: string } {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/";
  try {
    const { protocol, hostname, port } = new URL(raw);
    return {
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      ...(port ? { port } : {}),
    };
  } catch {
    return { protocol: "http", hostname: "127.0.0.1", port: "8000" };
  }
}

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["iconoir-react"],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  images: {
    remotePatterns: [
      // Cloudinary CDN — used in production and when CLOUDINARY_FORCE=true in dev
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Django backend — used in dev (local filesystem storage)
      backendImagePattern(),
    ],
  },
};

export default nextConfig;
