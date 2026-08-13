"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Bounces a page back to `/` once its access requirement is DEFINITIVELY
 * unmet — the identity/permission query resolved successfully and the user
 * genuinely lacks the permission.
 *
 * Every workspace page that gates itself on a permission used to write this
 * as `if (!isLoading && !canAccess) router.replace("/")`, which conflates
 * "we don't know yet" with "confirmed unauthorized" in two separate ways:
 *
 * 1. `isLoading` (TanStack Query v5) is `status === "pending" && isFetching`
 *    — narrower than "hasn't settled". Between a failed attempt and its
 *    retry (the backoff delay `retry: 1` waits out), `fetchStatus` goes
 *    `"idle"` while `status` is still `"pending"`, so `isLoading` reads
 *    `false` even though the query has neither succeeded nor failed yet.
 *    `isPending` (`status === "pending"`, regardless of fetch activity)
 *    doesn't have that gap — it only clears once the query truly settles.
 * 2. Even past that, a query that *errors* (a dropped connection, a cold
 *    `/api/proxy` compile, any transient blip — most likely right after a
 *    hard refresh, when every query on the page starts from zero at once)
 *    also makes it settle with no data, so `!isError` still has to be
 *    checked explicitly.
 *
 * Getting either wrong bounced a legitimately authorized user to `/` —
 * which re-routes by role to Today or Dashboard — losing the page they
 * were actually on. Pass `isPending` from the query itself, not `isLoading`.
 */
export function useAccessGate(params: {
  canAccess: boolean;
  isPending: boolean;
  isError: boolean;
}): void {
  const router = useRouter();
  const { canAccess, isPending, isError } = params;

  useEffect(() => {
    if (!isPending && !isError && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, isPending, isError]);
}
