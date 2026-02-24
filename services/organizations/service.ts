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
