// Instant loading UI for /workspace/* transitions. The workspace layout (and
// its sidebar) stays mounted; only this content-area spinner swaps in while the
// destination segment streams, so navigation feels immediate instead of frozen.
export default function WorkspaceLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
