import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a PrepIQ account — real-time kitchen intelligence, automated demand forecasting, and prep scheduling for restaurants.",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}