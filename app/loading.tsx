// Instant route-transition UI for the app root. Without a loading.tsx, Next.js
// keeps the previous page frozen on screen until the destination's RSC payload
// returns, which reads as "the click did nothing / then reloaded".
export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1">
      <div
        className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </main>
  );
}
