import { z } from "zod";
import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { branchEndpoints } from "./endpoints";
import {
  branchSchema,
  departmentSchema,
  staffInviteSchema,
  staffRoleEnum,
  staffInviteContextSchema,
  staffAssignmentSchema,
  inviteValidationSchema,
  type CreateBranchPayload,
  type UpdateBranchPayload,
  type CreateDepartmentPayload,
  type CreateStaffInvitePayload,
  type AcceptInvitePayload,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────────

export async function listBranches(orgId: string) {
  return apiClientWithSchema(
    branchEndpoints.list(orgId),
    z.union([
      z.array(branchSchema),
      z.object({ results: z.array(branchSchema) }),
    ]).transform((payload) => ("results" in payload ? payload.results : payload)),
    { method: "GET" },
  );
}

export async function getBranch(orgId: string, branchId: string) {
  return apiClientWithSchema(
    branchEndpoints.detail(orgId, branchId),
    branchSchema,
    { method: "GET" },
  );
}

export async function createBranch(
  orgId: string,
  payload: CreateBranchPayload,
) {
  return apiClientWithSchema(branchEndpoints.list(orgId), branchSchema, {
    method: "POST",
    body: { ...payload, organization: orgId },
  });
}

export async function updateBranch(
  orgId: string,
  branchId: string,
  payload: UpdateBranchPayload,
) {
  return apiClientWithSchema(
    branchEndpoints.detail(orgId, branchId),
    branchSchema,
    { method: "PATCH", body: payload },
  );
}

export async function deleteBranch(orgId: string, branchId: string) {
  return apiClient<{ message: string }>(
    branchEndpoints.detail(orgId, branchId),
    {
      method: "DELETE",
    },
  );
}

export async function setPrimaryBranch(orgId: string, branchId: string) {
  return apiClientWithSchema(
    branchEndpoints.setPrimary(orgId, branchId),
    branchSchema,
    { method: "POST" },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────────────────────

export async function listDepartments(orgId: string) {
  return apiClientWithSchema(
    branchEndpoints.departments(orgId),
    z.array(departmentSchema),
    { method: "GET" },
  );
}

export async function createDepartment(
  orgId: string,
  payload: CreateDepartmentPayload,
) {
  return apiClientWithSchema(
    branchEndpoints.departments(orgId),
    departmentSchema,
    { method: "POST", body: { ...payload, organization: orgId } },
  );
}

export async function updateDepartment(
  orgId: string,
  deptId: string,
  payload: Partial<CreateDepartmentPayload>,
) {
  return apiClientWithSchema(
    branchEndpoints.departmentDetail(orgId, deptId),
    departmentSchema,
    { method: "PATCH", body: payload },
  );
}

export async function deleteDepartment(orgId: string, deptId: string) {
  return apiClient<void>(branchEndpoints.departmentDetail(orgId, deptId), {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Invites
// ─────────────────────────────────────────────────────────────────────────────

export async function listInvites(orgId: string) {
  return apiClientWithSchema(
    branchEndpoints.invites(orgId),
    z.array(staffInviteSchema),
    { method: "GET" },
  );
}

export async function getStaffInviteContext(orgId: string) {
  return apiClientWithSchema(
    branchEndpoints.staffInviteContext(orgId),
    staffInviteContextSchema,
    { method: "GET" },
  );
}

export async function createInvite(
  orgId: string,
  payload: CreateStaffInvitePayload,
) {
  const response = await apiClient<unknown>(branchEndpoints.invites(orgId), {
    method: "POST",
    body: payload,
  });

  const fullInvite = staffInviteSchema.safeParse(response);
  if (fullInvite.success) {
    return fullInvite.data;
  }

  const wrappedFullInvite = z
    .object({
      data: staffInviteSchema,
    })
    .safeParse(response);
  if (wrappedFullInvite.success) {
    return wrappedFullInvite.data.data;
  }

  const minimalInvite = z
    .object({
      email: z.string().email(),
      role: staffRoleEnum,
      branch: z.string().uuid().optional().nullable(),
    })
    .safeParse(response);
  if (minimalInvite.success) {
    return {
      id: "invite-created",
      organization: orgId,
      email: minimalInvite.data.email,
      role: minimalInvite.data.role,
      branch: minimalInvite.data.branch ?? null,
      status: "PENDING" as const,
      created_at: new Date().toISOString(),
    };
  }

  const wrappedMinimalInvite = z
    .object({
      data: z.object({
        email: z.string().email(),
        role: staffRoleEnum,
        branch: z.string().uuid().optional().nullable(),
      }),
    })
    .safeParse(response);
  if (wrappedMinimalInvite.success) {
    return {
      id: "invite-created",
      organization: orgId,
      email: wrappedMinimalInvite.data.data.email,
      role: wrappedMinimalInvite.data.data.role,
      branch: wrappedMinimalInvite.data.data.branch ?? null,
      status: "PENDING" as const,
      created_at: new Date().toISOString(),
    };
  }

  throw new Error("Unexpected invite response format.");
}

export async function revokeInvite(
  orgId: string,
  inviteId: string,
  reason?: string,
) {
  return apiClient<{ message: string }>(
    branchEndpoints.revokeInvite(orgId, inviteId),
    { method: "POST", body: reason ? { reason } : undefined },
  );
}

/** GET /invites/accept/?token=... — validate token before accepting */
export async function validateInviteToken(token: string) {
  return apiClientWithSchema(
    `${branchEndpoints.acceptInvite()}?token=${encodeURIComponent(token)}`,
    inviteValidationSchema,
    { method: "GET" },
  );
}

/** POST /invites/accept/ */
export async function acceptInvite(payload: AcceptInvitePayload) {
  return apiClient<{ message: string; membership_id: string }>(
    branchEndpoints.acceptInvite(),
    { method: "POST", body: payload },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Assignments
// ─────────────────────────────────────────────────────────────────────────────

export async function listStaffAssignments(orgId: string) {
  const response = await apiClientWithSchema(
    branchEndpoints.staffAssignments(orgId),
    z.union([
      z.array(staffAssignmentSchema),
      z.object({ results: z.array(staffAssignmentSchema) }),
      z.object({
        success: z.boolean().optional(),
        data: z.union([
          z.array(staffAssignmentSchema),
          z.object({ results: z.array(staffAssignmentSchema) }),
        ]),
      }),
    ]),
    { method: "GET" },
  );

  if (Array.isArray(response)) return response;
  if ("results" in response) return response.results;
  if (Array.isArray(response.data)) return response.data;
  return response.data.results;
}

export async function removeStaff(
  orgId: string,
  memberId: string,
  reason?: string,
) {
  return apiClient<{ message: string }>(
    branchEndpoints.removeStaff(orgId, memberId),
    { method: "POST", body: reason ? { reason } : undefined },
  );
}
