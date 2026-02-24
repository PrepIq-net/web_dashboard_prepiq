import { apiClientWithSchema } from "@/lib/api/client";
import { organizationsEndpoints } from "./endpoints";
import {
  organizationSchema,
  organizationRegisterPayloadSchema,
  type Organization,
  type OrganizationRegisterPayload,
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
