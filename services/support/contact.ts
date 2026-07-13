"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Client bindings for the landing-hosted support pipeline. All calls go
 * through this app's own /api/support/* route handlers, which verify the
 * session server-side and forward to the landing app with a shared key.
 */

export type SupportContactType = "BUG" | "FEATURE_REQUEST" | "INQUIRY" | "FEEDBACK";

export interface FeatureBoardEntry {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: "NEW" | "IN_PROGRESS";
  votes: number;
  hasVoted: boolean;
  createdAt: string;
}

export interface SubmitSupportResult {
  id: string;
  reference: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export async function submitSupportRequest(
  form: FormData,
): Promise<SubmitSupportResult> {
  const response = await fetch("/api/support/submit", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Could not send your request"));
  }
  return response.json();
}

export async function getFeatureBoard(): Promise<FeatureBoardEntry[]> {
  const response = await fetch("/api/support/board", { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readError(response, "Could not load the feature board"));
  }
  const payload = (await response.json()) as { requests?: FeatureBoardEntry[] };
  return payload.requests ?? [];
}

export async function toggleFeatureVote(
  id: string,
): Promise<{ votes: number; voted: boolean }> {
  const response = await fetch("/api/support/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Could not register your vote"));
  }
  return response.json();
}

export const featureBoardKey = ["support", "feature-board"] as const;

export function useFeatureBoard() {
  return useQuery({
    queryKey: featureBoardKey,
    queryFn: getFeatureBoard,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitSupportRequest() {
  return useMutation({ mutationFn: submitSupportRequest });
}

export function useToggleFeatureVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleFeatureVote,
    onSuccess: (result, id) => {
      queryClient.setQueryData<FeatureBoardEntry[]>(featureBoardKey, (entries) =>
        entries?.map((entry) =>
          entry.id === id
            ? { ...entry, votes: result.votes, hasVoted: result.voted }
            : entry,
        ),
      );
    },
  });
}
