import { apiClientWithSchema } from "@/lib/api/client";
import { organizationsEndpoints } from "./endpoints";
import {
  organizationSchema,
  organizationRegisterPayloadSchema,
  organizationMemberSchema,
  addOrganizationMemberPayloadSchema,
  type Organization,
  type OrganizationRegisterPayload,
  type OrganizationMember,
  type AddOrganizationMemberPayload,
} from "./types";
import { apiMessageResponseSchema } from "@/services/users/types";
import { z } from "zod";

export async function registerOrganization(
  payload: OrganizationRegisterPayload,
) {
  const body = organizationRegisterPayloadSchema.parse(payload);
  return apiClientWithSchema(
    organizationsEndpoints.register,
    organizationSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function getMyOrganizations() {
  return apiClientWithSchema(
    organizationsEndpoints.list,
    z.array(organizationSchema),
    {
      method: "GET",
    },
  );
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

export async function getOrganizationMembers(id: string) {
  return apiClientWithSchema(
    organizationsEndpoints.members(id),
    z.array(organizationMemberSchema),
    {
      method: "GET",
    },
  );
}

export async function addOrganizationMember(
  orgId: string,
  payload: AddOrganizationMemberPayload,
) {
  const body = addOrganizationMemberPayloadSchema.parse(payload);
  return apiClientWithSchema(
    organizationsEndpoints.addMember(orgId),
    organizationMemberSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function removeOrganizationMember(orgId: string, userId: string) {
  return apiClientWithSchema(
    organizationsEndpoints.removeMember(orgId, userId),
    apiMessageResponseSchema,
    {
      method: "DELETE",
    },
  );
}
