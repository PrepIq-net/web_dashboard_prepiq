import { Inter } from "next/font/google";
import localFont from "next/font/local";

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
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/**
 * Body font.
 *
 * This was previously a stub — an object carrying only `variable`, with no font
 * behind it — so `--font-inter-next` fell through to the `system-ui` default
 * declared in globals.css and every piece of body copy in the dashboard rendered
 * in the OS font rather than Inter. Headings were unaffected because Satoshi is
 * a real local font.
 *
 * next/font downloads and self-hosts at build time, so there is no runtime
 * request to Google and no layout shift.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter-next",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
