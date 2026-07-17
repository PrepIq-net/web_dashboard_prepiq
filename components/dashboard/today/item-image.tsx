"use client";

import { useEffect, useState } from "react";

/**
 * Item thumbnail with a guaranteed fallback: a broken URL swaps to the
 * monogram instead of hiding the element and leaving a layout gap.
 */
export function ItemImage({
  src,
  title,
  className,
}: {
  src: string | null | undefined;
  title: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  // A refreshed payload can bring a corrected URL — give it a fresh chance.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-surface-3 text-[10px] font-bold text-text-muted`}
        aria-hidden
      >
        {title.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      loading="lazy"
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
