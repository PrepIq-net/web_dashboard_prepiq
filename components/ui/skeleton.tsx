import { Spinner } from "@/components/ui/spinner";

export function ScreenSkeleton() {
  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="text-center">
        <Spinner size="lg" color="#A8821F" />
        <p className="mt-4 text-[14px] text-[#8E8E93]">Loading...</p>
      </div>
    </div>
  );
}
