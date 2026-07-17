import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { executionEndpoints } from "./endpoints";
import {
  confirmResponseSchema,
  generateResponseSchema,
  kitchenTaskSchema,
  taskBoardSchema,
  taskMutationResponseSchema,
  type CreateTaskPayload,
  type TaskStatus,
  type UpdateTaskPayload,
} from "./types";

export async function getTaskBoard(branchId: string, date: string) {
  return apiClientWithSchema(
    executionEndpoints.board(branchId, date),
    taskBoardSchema,
    { method: "GET" },
  );
}

export async function generateTasks(branchId: string, date: string) {
  return apiClientWithSchema(
    executionEndpoints.generate(),
    generateResponseSchema,
    { method: "POST", body: { branch_id: branchId, date } },
  );
}

export async function confirmTasks(
  branchId: string,
  date: string,
  taskIds: string[],
) {
  return apiClientWithSchema(
    executionEndpoints.confirm(),
    confirmResponseSchema,
    { method: "POST", body: { branch_id: branchId, date, task_ids: taskIds } },
  );
}

export async function createTask(payload: CreateTaskPayload) {
  return apiClientWithSchema(
    executionEndpoints.create(),
    taskMutationResponseSchema,
    { method: "POST", body: payload },
  );
}

export async function updateTask(
  taskId: string,
  branchId: string,
  payload: UpdateTaskPayload,
) {
  return apiClientWithSchema(
    executionEndpoints.taskDetail(taskId, branchId),
    kitchenTaskSchema,
    { method: "PATCH", body: payload },
  );
}

export async function deleteTask(taskId: string, branchId: string) {
  return apiClient<unknown>(executionEndpoints.taskDetail(taskId, branchId), {
    method: "DELETE",
  });
}

export async function setTaskStatus(
  taskId: string,
  branchId: string,
  status: TaskStatus,
) {
  return apiClientWithSchema(
    executionEndpoints.taskStatus(taskId, branchId),
    kitchenTaskSchema,
    { method: "POST", body: { status } },
  );
}

export async function assignTask(
  taskId: string,
  branchId: string,
  userId: string | null,
) {
  return apiClientWithSchema(
    executionEndpoints.taskAssign(taskId, branchId),
    taskMutationResponseSchema,
    { method: "POST", body: { user_id: userId } },
  );
}
