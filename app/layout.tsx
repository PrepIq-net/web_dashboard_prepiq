import type { Metadata } from "next";
import { inter, satoshi } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrepIQ",
  description: "Kitchen Intelligence & Margin Protection System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${satoshi.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
