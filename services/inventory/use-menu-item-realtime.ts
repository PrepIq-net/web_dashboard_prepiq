"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHubSocket } from "../hub/use-hub-socket";
import type { HubSocketEvent } from "../hub/types";
import { inventoryQueryKeys } from "./hooks";

type MenuItemChangedPayload = Extract<
  HubSocketEvent,
  { event: "inventory.menu_item_changed" }
>["payload"];

/**
 * Live menu-item/recipe sync. The same signal fires whether the edit came
 * from the inventory page, the AI assistant chat, the command palette, or
 * the recipe-review panel (backend/inventory/realtime.py broadcasts it
 * uniformly) — so a photo swapped in one tab shows up in every other open
 * tab without a reload.
 *
 * Always invalidates the inventory queries every dashboard needs; `onChanged`
 * is the escape hatch for a page that also needs to refresh something of its
 * own (Today refreshes its unrelated production-intelligence query key).
 */
export function useMenuItemRealtime(
  branchId?: string,
  onChanged?: (payload: MenuItemChangedPayload) => void,
) {
  const queryClient = useQueryClient();
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const handleEvent = useCallback(
    (event: HubSocketEvent) => {
      if (event.event !== "inventory.menu_item_changed") return;
      if (!branchId || event.payload.branch_id !== branchId) return;

      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.menuItems(branchId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.recipes(event.payload.menu_item_id),
      });
      onChangedRef.current?.(event.payload);
    },
    [branchId, queryClient],
  );

  return useHubSocket(handleEvent);
}
