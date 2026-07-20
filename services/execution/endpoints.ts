const BASE = `/api/execution`;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const executionEndpoints = {
  board: (branchId: string, date: string) =>
    `${BASE}/tasks/${buildQuery({ branch_id: branchId, date })}`,

  generate: () => `${BASE}/tasks/generate/`,

  recommendations: (branchId: string, date: string) =>
    `${BASE}/tasks/recommendations/${buildQuery({ branch_id: branchId, date })}`,

  confirm: () => `${BASE}/tasks/confirm/`,

  create: () => `${BASE}/tasks/create/`,

  taskDetail: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/${buildQuery({ branch_id: branchId })}`,

  taskStatus: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/status/${buildQuery({ branch_id: branchId })}`,

  taskAssign: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/assign/${buildQuery({ branch_id: branchId })}`,

  // Self-service claim/release: POST to claim an unassigned task for yourself,
  // DELETE to drop a claim you made. No MANAGE_TASKS required.
  taskClaim: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/claim/${buildQuery({ branch_id: branchId })}`,

  myTasks: (date: string) => `${BASE}/me/tasks/${buildQuery({ date })}`,
};
