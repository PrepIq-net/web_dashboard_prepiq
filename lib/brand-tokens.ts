export const brandTokens = {
  identity: {
    name: "PrepIQ",
    pillars: ["Intelligent", "Structured", "Controlled", "Premium"] as const,
  },
  colors: {
    background: "#141416",
    surfaces: {
      level1: "#141416",
      level2: "#1C1C1F",
      level3: "#232327",
      level4: "#2A2A2E",
    },
    brand: {
      gold: "#A8821F",
      goldHover: "#B8962E",
      goldPressed: "#8F6F18",
    },
    text: {
      primary: "#F5F5F7",
      secondary: "#C7C7CC",
      muted: "#8E8E93",
      disabled: "#5A5A60",
    },
    status: {
      critical: "#C44949",
      warning: "#C48B2A",
      success: "#3F8F68",
      info: "#3A6EA5",
    },
    border: "#2E2E33",
    chart: {
      baseline: "#6C6C73",
      grid: "#2A2A2E",
    },
  },
  typography: {
    fonts: {
      display: "Satoshi",
      body: "Inter",
      icon: "Iconoir",
    },
    scale: {
      h1: { size: 40, lineHeight: 48, weight: 600 },
      h2: { size: 32, lineHeight: 40, weight: 600 },
      h3: { size: 24, lineHeight: 32, weight: 600 },
      h4: { size: 18, lineHeight: 28, weight: 500 },
      bodyLarge: { size: 16, lineHeight: 24, weight: 400 },
      body: { size: 14, lineHeight: 22, weight: 400 },
      small: { size: 12, lineHeight: 18, weight: 400 },
      kpi: { minSize: 32, maxSize: 48, weight: 600, tracking: -0.5 },
    },
  },
  spacing: [4, 8, 12, 16, 24, 32, 40, 48, 64, 80] as const,
  layout: {
    maxWidth: 1440,
    horizontalPadding: 32,
    grid: 8,
  },
  radius: {
    button: 8,
    card: 12,
    modal: 16,
  },
  shadow: {
    level1: "0px 1px 2px rgba(0,0,0,0.3)",
    level2: "0px 8px 24px rgba(0,0,0,0.4)",
    level3: "0px 4px 12px rgba(0,0,0,0.35)",
  },
  motion: {
    durationMinMs: 150,
    durationMaxMs: 220,
    easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  },
} as const;

export type BrandTokens = typeof brandTokens;
