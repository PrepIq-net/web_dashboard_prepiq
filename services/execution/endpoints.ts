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

  confirm: () => `${BASE}/tasks/confirm/`,

  create: () => `${BASE}/tasks/create/`,

  taskDetail: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/${buildQuery({ branch_id: branchId })}`,

  taskStatus: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/status/${buildQuery({ branch_id: branchId })}`,

  taskAssign: (taskId: string, branchId: string) =>
    `${BASE}/tasks/${taskId}/assign/${buildQuery({ branch_id: branchId })}`,

  myTasks: (date: string) => `${BASE}/me/tasks/${buildQuery({ date })}`,
};
