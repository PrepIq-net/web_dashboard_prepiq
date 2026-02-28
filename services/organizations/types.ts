import { z } from "zod";

export const businessTypeEnum = z.enum([
  "RESTAURANT",
  "HOTEL",
  "BAKERY",
  "CLOUD_KITCHEN",
  "CATERING",
  "INSTITUTIONAL",
]);

export type BusinessType = z.infer<typeof businessTypeEnum>;

export const industryTypeEnum = businessTypeEnum;
export type IndustryType = z.infer<typeof industryTypeEnum>;

export const organizationMemberRoleEnum = z.enum([
  "ORG_OWNER",
  "OPS_DIRECTOR",
  "ORG_ADMIN",
  "GM",
  "BRANCH_MANAGER",
  "STAFF_OPERATOR",
  "AUDITOR",
  "OWNER",
  "ADMIN",
  "STAFF",
]);

export type OrganizationMemberRole = z.infer<typeof organizationMemberRoleEnum>;

export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  user: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  profile_picture: z.string().url().nullable(),
  role: organizationMemberRoleEnum,
  is_active: z.boolean(),
  joined_at: z.string().datetime(),
  branch_name: z.string().nullable(),
  branch_id: z.string().uuid().nullable(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  business_type: businessTypeEnum.nullable().optional(),
  industry_type: industryTypeEnum.nullable().optional(),
  logo: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  banner_image: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  is_verified: z.boolean().optional(),
  capacity: z.number().nullable().optional(),
  created_at: z.string().optional(),
  member_count: z.number().optional(),
  slug: z.string().optional(),
});

export type Organization = z.infer<typeof organizationSchema>;

export const organizationRegisterPayloadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  business_type: businessTypeEnum,
  industry_type: industryTypeEnum.optional(),
  capacity: z.number().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  logo: z.any().optional(),
});

export type OrganizationRegisterPayload = z.infer<
  typeof organizationRegisterPayloadSchema
>;
