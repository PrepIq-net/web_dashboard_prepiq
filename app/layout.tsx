import type { Metadata } from "next";
import { inter, satoshi } from "@/lib/fonts";
import { Providers } from "@/app/providers";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${satoshi.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
