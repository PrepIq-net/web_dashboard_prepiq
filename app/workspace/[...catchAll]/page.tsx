import { notFound } from "next/navigation";

// Next only renders a segment's own not-found.tsx when `notFound()` is
// thrown from a route that actually matched within that segment — an
// arbitrary unmatched path like /workspace/typo has nothing to match, so
// without this catch-all it falls straight through to the root
// app/not-found.tsx, skipping app/workspace/layout.tsx entirely (no
// sidebar, no top nav). This catch-all IS the match: it enters the
// workspace layout, then immediately defers to app/workspace/not-found.tsx.
export default function WorkspaceCatchAll() {
  notFound();
}
