"use client";

import { Suspense } from "react";
import CloverConnectedContent from "./connected-content";
import { ScreenSkeleton } from "@/components/ui/skeleton";

export default function CloverConnectedPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <CloverConnectedContent />
    </Suspense>
  );
}
