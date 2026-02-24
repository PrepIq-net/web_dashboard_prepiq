import { apiClientWithSchema } from "@/lib/api/client";
import { organizationsEndpoints } from "./endpoints";
import {
  organizationSchema,
  organizationRegisterPayloadSchema,
  type Organization,
  type OrganizationRegisterPayload,
} from "./types";
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
