"use client";

import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import LoyverseConnectedContent from "./connected-content";

export default function LoyverseConnectedPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LoyverseConnectedContent />
    </Suspense>
  );
}
