import { apiClientWithSchema } from "@/lib/api/client";
import { organizationsEndpoints } from "./endpoints";
import {
  addOrganizationMemberPayloadSchema,
  organizationSchema,
  organizationMemberSchema,
  organizationRegisterPayloadSchema,
  organizationFinancialOverviewSchema,
  permissionSchema,
  roleSchema,
  roleCreateUpdatePayloadSchema,
  type AddOrganizationMemberPayload,
  type UpdateOrganizationMemberPayload,
  type OrganizationFinancialOverviewQuery,
  type OrganizationRegisterPayload,
  type Permission,
  type Role,
  type RoleCreateUpdatePayload,
} from "./types";
import { z } from "zod";

const organizationsListResponseSchema = z.union([
  z.array(organizationSchema),
  z.object({
    results: z.array(organizationSchema),
  }),
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.object({
      count: z.number().optional(),
      next: z.string().nullable().optional(),
      previous: z.string().nullable().optional(),
      results: z.array(organizationSchema),
    }),
  }),
]);

export async function registerOrganization(
  payload: OrganizationRegisterPayload,
) {
  // We don't use schema.parse here because it might strip the logo File object
  // if not handled carefully, and we want to support multipart for the logo.
  const hasLogo = payload.logo instanceof File;

  if (hasLogo) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value instanceof File ? value : String(value));
      }
    });

    return apiClientWithSchema(
      organizationsEndpoints.register,
      organizationSchema,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  return apiClientWithSchema(
    organizationsEndpoints.register,
    organizationSchema,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function getMyOrganizations() {
  const response = await apiClientWithSchema(
    organizationsEndpoints.list,
    organizationsListResponseSchema,
    {
      method: "GET",
    },
  );

  if (Array.isArray(response)) return response;
  if ("results" in response) return response.results;
  return response.data.results;
}

export async function getOrganizationDetail(id: string) {
  return apiClientWithSchema(
    organizationsEndpoints.detail(id),
    organizationSchema,
    {
      method: "GET",
    },
  );
}

export async function getOrganizationMembers(id: string) {
  const response = await apiClientWithSchema(
    organizationsEndpoints.members(id),
    z.union([
      z.array(organizationMemberSchema),
      z.object({ results: z.array(organizationMemberSchema) }),
      z.object({
        success: z.boolean().optional(),
        data: z.union([
          z.array(organizationMemberSchema),
          z.object({ results: z.array(organizationMemberSchema) }),
        ]),
      }),
    ]),
    {
      method: "GET",
    },
  );

  if (Array.isArray(response)) return response;
  if ("results" in response) return response.results;
  if (Array.isArray(response.data)) return response.data;
  return response.data.results;
}

export async function updateOrganization(
  id: string,
  payload: Partial<OrganizationRegisterPayload>,
) {
  return apiClientWithSchema(
    organizationsEndpoints.detail(id),
    organizationSchema,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function addOrganizationMember(
  id: string,
  payload: AddOrganizationMemberPayload,
) {
  const validatedPayload = addOrganizationMemberPayloadSchema.parse(payload);
  return apiClientWithSchema(
    organizationsEndpoints.addMember(id),
    organizationMemberSchema,
    {
      method: "POST",
      body: validatedPayload,
    },
  );
}

export async function removeOrganizationMember(id: string, userId: string) {
  return apiClientWithSchema(
    organizationsEndpoints.removeMember(id, userId),
    z.object({
      message: z.string(),
    }),
    {
      method: "DELETE",
    },
  );
}

export async function updateOrganizationMember(
  id: string,
  userId: string,
  payload: UpdateOrganizationMemberPayload,
) {
  return apiClientWithSchema(
    organizationsEndpoints.updateMember(id, userId),
    organizationMemberSchema,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function getOrganizationFinancialOverview(
  id: string,
  params: OrganizationFinancialOverviewQuery = {},
) {
  const searchParams = new URLSearchParams();
  if (params.timeframe) searchParams.set("timeframe", params.timeframe);
  if (params.start_date) searchParams.set("start_date", params.start_date);
  if (params.end_date) searchParams.set("end_date", params.end_date);
  if (params.branch_id) searchParams.set("branch_id", params.branch_id);

  const url = `${organizationsEndpoints.financialOverview(id)}${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  return apiClientWithSchema(url, organizationFinancialOverviewSchema, {
    method: "GET",
  });
}

export async function getOrganizationPermissions(
  id: string,
): Promise<Permission[]> {
  const response = await apiClientWithSchema(
    organizationsEndpoints.permissions(id),
    z.union([
      z.array(permissionSchema),
      z.object({
        success: z.boolean().optional(),
        data: z.array(permissionSchema),
      }),
    ]),
    {
      method: "GET",
    },
  );

  return Array.isArray(response) ? response : response.data;
}

export async function getOrganizationRoles(id: string): Promise<Role[]> {
  const response = await apiClientWithSchema(
    organizationsEndpoints.roles(id),
    z.union([
      z.array(roleSchema),
      z.object({
        success: z.boolean().optional(),
        data: z.array(roleSchema),
      }),
    ]),
    {
      method: "GET",
    },
  );

  return Array.isArray(response) ? response : response.data;
}

export async function createOrganizationRole(
  id: string,
  payload: RoleCreateUpdatePayload,
): Promise<Role> {
  return apiClientWithSchema(organizationsEndpoints.roles(id), roleSchema, {
    method: "POST",
    body: payload,
  });
}

export async function updateOrganizationRole(
  id: string,
  roleId: string,
  payload: RoleCreateUpdatePayload,
): Promise<Role> {
  return apiClientWithSchema(
    organizationsEndpoints.roleDetail(id, roleId),
    roleSchema,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteOrganizationRole(
  id: string,
  roleId: string,
): Promise<{ message: string }> {
  return apiClientWithSchema(
    organizationsEndpoints.roleDetail(id, roleId),
    z.object({ message: z.string() }),
    {
      method: "DELETE",
    },
  );
}

export type LifecycleReason = {
  reason_choice?: string;
  reason_details?: string;
};

export async function leaveOrganization(
  id: string,
  reason?: LifecycleReason,
): Promise<{ message: string }> {
  return apiClientWithSchema(
    organizationsEndpoints.leave(id),
    z.object({ message: z.string() }),
    {
      method: "POST",
      body: reason ?? {},
    },
  );
}

export async function transferOrganizationOwnership(
  id: string,
  userId: string,
  reason?: LifecycleReason,
): Promise<{ message: string }> {
  return apiClientWithSchema(
    organizationsEndpoints.transferOwnership(id),
    z.object({ message: z.string() }),
    {
      method: "POST",
      body: { user_id: userId, ...(reason ?? {}) },
    },
  );
}

export async function deleteOrganization(
  id: string,
  reason?: LifecycleReason,
): Promise<void> {
  // 204 No Content — no body to validate. The reason travels in the DELETE body
  // (the proxy forwards it and DRF reads request.data on DELETE).
  await apiClientWithSchema(
    organizationsEndpoints.detail(id),
    z.any(),
    {
      method: "DELETE",
      body: reason ?? {},
    },
  );
}
