/** Shared constants previously re-declared per workspace page. */

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Stable empty array for query fallbacks — keeps referential equality so
 * memos/effects that depend on `data ?? EMPTY_LIST` don't re-fire every render.
 */
export const EMPTY_LIST: never[] = [];
