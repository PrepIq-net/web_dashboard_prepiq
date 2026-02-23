import localFont from "next/font/local";
import { Inter } from "next/font/google";

export const inter = Inter({
  variable: "--font-inter-next",
  subsets: ["latin"],
  display: "swap",
});

export const satoshi = localFont({
  src: [
    {
      path: "../public/fonts/satoshi/Fonts/WEB/fonts/Satoshi-Variable.woff2",
      weight: "300 900",
      style: "normal",
    },
    {
      path: "../public/fonts/satoshi/Fonts/WEB/fonts/Satoshi-VariableItalic.woff2",
      weight: "300 900",
      style: "italic",
    },
  ],
  variable: "--font-satoshi-next",
  display: "swap",
  fallback: ["Inter", "system-ui", "-apple-system", "sans-serif"],
});
