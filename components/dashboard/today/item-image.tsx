"use client";

import { useEffect, useState } from "react";
import { classifyItemIcon } from "./item-visual";

export type ItemVisualSource = {
  product_image_url?: string | null;
  product_title: string;
  product_category?: string | null;
  preparation_type?: { code?: string | null } | null;
};

/**
 * Item thumbnail with a guaranteed fallback: a missing or broken URL swaps to
 * a type-appropriate icon tile — drink, dessert, bakery, bottled good — never
 * to a blank gap or bare initials. A chef scanning a busy grid recognizes a
 * cup or a glass faster than two letters of a product name, and the tile
 * still means something on the day-one item the pipeline hasn't imaged yet.
 */
export function ItemImage({
  item,
  className,
  iconClassName = "h-5 w-5",
}: {
  item: ItemVisualSource;
  className: string;
  /** Icon size for the fallback tile — bump for hero-sized banners. */
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = item.product_image_url;

  // A refreshed payload can bring a corrected URL — give it a fresh chance.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    const Icon = classifyItemIcon(item.product_category, item.preparation_type?.code);
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-4`}
        aria-hidden
      >
        <Icon className={`${iconClassName} text-text-muted`} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.product_title}
      loading="lazy"
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
