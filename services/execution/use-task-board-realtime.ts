"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHubSocket } from "../hub/use-hub-socket";
import type { HubSocketEvent } from "../hub/types";
import { executionKeys } from "./hooks";

/**
 * Live task-board sync. The hub socket already reaches every signed-in org
 * member; this hook listens for execution events on it and invalidates the
 * board query, so a card another admin moves lands here within a round trip
 * instead of waiting out the stale window.
 *
 * `onGenerated` fires when the AI drafts suggestions for the watched day —
 * the cue for the "PrepIQ AI has suggested new tasks" toast.
 */
export function useTaskBoardRealtime(
  branchId?: string,
  date?: string,
  onGenerated?: (count: number) => void,
) {
  const queryClient = useQueryClient();
  const onGeneratedRef = useRef(onGenerated);
  onGeneratedRef.current = onGenerated;

  const handleEvent = useCallback(
    (event: HubSocketEvent) => {
      if (
        event.event !== "execution.board_changed" &&
        event.event !== "execution.tasks_generated"
      ) {
        return;
      }
      if (!branchId || event.payload.branch_id !== branchId) return;
      if (date && event.payload.date !== date) return;

      queryClient.invalidateQueries({
        queryKey: executionKeys.board(branchId, event.payload.date),
      });
      if (event.event === "execution.tasks_generated") {
        onGeneratedRef.current?.(event.payload.count);
      }
    },
    [branchId, date, queryClient],
  );

  return useHubSocket(handleEvent);
}
