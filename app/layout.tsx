import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { inter, satoshi } from "@/lib/fonts";
import { Providers } from "@/app/providers";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { AUTH_COOKIES, parseImpersonation } from "@/lib/auth/cookies";
import "./globals.css";

function resolveHtmlLang(acceptLanguage: string | null): string {
  const supported = new Set(["en", "fr"]);
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((p) => p.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find((l) => supported.has(l));
  return preferred ?? "en";
}

export const metadata: Metadata = {
  metadataBase: new URL("https://app.prepiq.com"), // Standard for Next.js 14+ relative assets
  title: {
    template: "%s | PrepIQ Dashboard",
    default: "PrepIQ | Kitchen Intelligence & Operational AI Platform",
  },
  description:
    "Real-time kitchen intelligence, automated demand forecasting, prep scheduling, and operational AI analysis for restaurants.",
  keywords: [
    "Kitchen Intelligence",
    "Restaurant Forecasting",
    "Food Waste Reduction",
    "Kitchen AI Analyst",
    "Prep IQ",
  ],
  robots: "index, follow",
  applicationName: "PrepIQ",
  authors: [{ name: "PrepIQ Engineering" }],
  creator: "PrepIQ",
  publisher: "PrepIQ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PrepIQ",
  },
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "PrepIQ | Kitchen Intelligence & Operational AI Platform",
    description:
      "Real-time kitchen intelligence, automated demand forecasting, prep scheduling, and operational AI analysis for restaurants.",
    url: "https://app.prepiq.com",
    siteName: "PrepIQ Dashboard",
    images: [
      {
        url: "/og-dashboard.png",
        width: 1600,
        height: 896,
        alt: "PrepIQ Kitchen Intelligence & Operational AI Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrepIQ | Kitchen Intelligence & Operational AI Platform",
    description:
      "Real-time kitchen intelligence, automated demand forecasting, prep scheduling, and operational AI analysis for restaurants.",
    images: ["/og-dashboard.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/icon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

const APP_URL = "https://app.prepiq.com";

const buildJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${APP_URL}/#software`,
  name: "PrepIQ",
  url: APP_URL,
  description:
    "Real-time kitchen intelligence, automated demand forecasting, prep scheduling, and operational AI analysis for restaurants.",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Restaurant Management Software",
  operatingSystem: "Web",
  publisher: {
    "@type": "Organization",
    name: "PrepIQ",
    url: APP_URL,
  },
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = buildJsonLd();

  const headersList = await headers();
  const lang = resolveHtmlLang(headersList.get("accept-language"));

  // Read at the root so the notice covers every route — there is no page where
  // an admin should be able to lose track of whose account they are viewing.
  const cookieStore = await cookies();
  const impersonation = parseImpersonation(
    cookieStore.get(AUTH_COOKIES.impersonation)?.value,
  );

  return (
    <html lang={lang}>
      <head>
        {/* Plain <script>, not next/script: JSON-LD must be in the initial HTML
            response. next/script defers injection to the client, so crawlers
            that do not execute JS see no structured data at all. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${satoshi.variable} font-sans antialiased`}
      >
        {impersonation && <ImpersonationBanner context={impersonation} />}
        <Providers
          cacheScope={impersonation ? `imp:${impersonation.email}` : undefined}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
