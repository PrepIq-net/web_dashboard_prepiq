import localFont from "next/font/local";

// Only define local fonts with actual files
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

// Export a dummy object for inter to maintain compatibility
export const inter = {
  variable: "--font-inter-next",
};
