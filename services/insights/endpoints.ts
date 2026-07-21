const BASE = `/api/insights`;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const insightsEndpoints = {
  summary: (branchId: string) =>
    `${BASE}/summary/${buildQuery({ branch_id: branchId })}`,

  feed: (branchId: string, params?: { status?: string; type?: string }) =>
    `${BASE}/feed/${buildQuery({ branch_id: branchId, ...params })}`,

  opportunities: (branchId: string) =>
    `${BASE}/opportunities/${buildQuery({ branch_id: branchId })}`,

  rootCauses: (branchId: string, outcome?: string) =>
    `${BASE}/root-causes/${buildQuery({ branch_id: branchId, outcome })}`,

  // Branch scope travels in the body here — the insight id already identifies
  // the branch, and the server re-derives it rather than trusting the caller.
  status: (insightId: string) => `${BASE}/${insightId}/status/`,

  runs: (branchId: string) => `${BASE}/runs/${buildQuery({ branch_id: branchId })}`,
};
