"use client";

import { Suspense } from "react";
import { ToastConnectedContent } from "./connected-content";

export default function ToastConnectedPage() {
  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="w-full max-w-lg h-64 rounded-lg bg-[#1C1C1F] animate-pulse" />
        }
      >
        <ToastConnectedContent />
      </Suspense>
    </div>
  );
}
