import { z } from "zod";

export const organizationMemberRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "STAFF",
  "AUDITOR",
]);
export type OrganizationMemberRole = z.infer<
  typeof organizationMemberRoleSchema
>;

export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  user: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  profile_picture: z.string().url().nullable(),
  role: organizationMemberRoleSchema,
  is_active: z.boolean(),
  joined_at: z.string().datetime(),
  branch_name: z.string().nullable(),
  branch_id: z.string().uuid().nullable(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  business_type: z.string(),
  industry_type: z.string(),
  registration_number: z.string(),
  logo: z.string().url().nullable(),
  banner_image: z.string().url().nullable(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  website: z.string().url().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address: z.string(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable(),
  is_verified: z.boolean(),
  capacity: z.number().nullable(),
  created_at: z.string().datetime(),
  member_count: z.number(),
  slug: z.string(),
  subscription_plan: z.any().nullable(), // Placeholder until subscription types are defined
});

export type Organization = z.infer<typeof organizationSchema>;

export const organizationRegisterPayloadSchema = z.object({
  name: z.string(),
  business_type: z.string(),
  industry_type: z.string(),
  registration_number: z.string(),
  address: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type OrganizationRegisterPayload = z.infer<
  typeof organizationRegisterPayloadSchema
>;

export const addOrganizationMemberPayloadSchema = z.object({
  user_email: z.string().email(),
  role: organizationMemberRoleSchema,
});

export type AddOrganizationMemberPayload = z.infer<
  typeof addOrganizationMemberPayloadSchema
>;
