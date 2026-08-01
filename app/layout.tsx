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
  title: {
    template: "%s | PrepIQ",
    default: "PrepIQ — Strategic Kitchen Intelligence & Margin Protection",
  },
  description: "Operational intelligence infrastructure for modern kitchens. Protect margins, reduce waste by up to 40%, and scale production with precision using AI-powered demand forecasting.",
  keywords: ["kitchen intelligence", "margin protection", "demand forecasting", "waste reduction", "operational excellence", "PrepIQ", "SaaS"],
  authors: [{ name: "PrepIQ Engineering" }],
  creator: "PrepIQ",
  publisher: "PrepIQ",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://app.prepiq.com"), // Standard for Next.js 14+ relative assets
  openGraph: {
    title: "PrepIQ — Strategic Kitchen Intelligence & Margin Protection",
    description: "AI-powered daily prep intelligence for commercial kitchens. Predict demand, reduce waste, and protect margins.",
    url: "https://app.prepiq.com",
    siteName: "PrepIQ Dashboard",
    images: [
      {
        url: "/og-dashboard.png",
        width: 1200,
        height: 630,
        alt: "PrepIQ Operational Intelligence Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrepIQ — Strategic Kitchen Intelligence & Margin Protection",
    description: "AI-powered daily prep intelligence for commercial kitchens. Predict demand, reduce waste, and protect margins.",
    images: ["/og-dashboard.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <body
        className={`${inter.variable} ${satoshi.variable} font-sans antialiased`}
      >
        {impersonation && <ImpersonationBanner context={impersonation} />}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
