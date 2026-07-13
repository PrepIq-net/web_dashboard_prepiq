import { z } from "zod";

export const apiMessageResponseSchema = z.object({
  message: z.string(),
});

export const apiErrorResponseSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
    detail: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export const registerPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().max(15).optional(),
  job_title: z.string().max(100).optional(),
});

export const registerResponseSchema = z.object({
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().optional().or(z.literal("")),
  job_title: z.string().optional().or(z.literal("")),
});

export const loginPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  access: z.string(),
  refresh: z.string(),
  email: z.string().email(),
  user_id: z.string(),
  is_volunteer: z.boolean(),
  is_setup_complete: z.boolean(),
  has_organization: z.boolean(),
  missing_setup_fields: z.array(z.string()),
});

export const sessionLoginResponseSchema = z.object({
  user: z.object({
    user_id: z.string(),
    email: z.string().email(),
    is_volunteer: z.boolean(),
    is_setup_complete: z.boolean(),
    has_organization: z.boolean(),
    missing_setup_fields: z.array(z.string()),
  }),
});

export const googleLoginPayloadSchema = z.object({
  id_token: z.string().min(1),
});

export const googleLoginResponseSchema = loginResponseSchema.extend({
  created: z.boolean(),
  restored: z.boolean().optional(),
  has_password: z.boolean().optional(),
});

export const sessionGoogleLoginResponseSchema = z.object({
  user: z.object({
    user_id: z.string(),
    email: z.string().email(),
    is_volunteer: z.boolean(),
    is_setup_complete: z.boolean(),
    has_organization: z.boolean(),
    missing_setup_fields: z.array(z.string()),
    created: z.boolean(),
    restored: z.boolean().optional(),
    has_password: z.boolean().optional(),
  }),
});

export const tokenRefreshPayloadSchema = z.object({
  refresh: z.string(),
});

export const tokenRefreshResponseSchema = z.object({
  access: z.string(),
});

export const logoutPayloadSchema = z.object({
  refresh_token: z.string().min(1),
});

export const otpPayloadSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1).max(6),
  context: z.string().optional(),
});

export const emailPayloadSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordPayloadSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1).max(6),
  new_password: z.string().min(8),
});

export const verificationStatusResponseSchema = z.object({
  is_verified: z.boolean(),
  phone_verified: z.boolean(),
  email: z.string().email(),
  phone: z.string().nullable(),
});

export const sessionStateResponseSchema = z.object({
  authenticated: z.boolean(),
  hasAccessToken: z.boolean(),
  hasRefreshToken: z.boolean(),
});

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  phone_verified: z.boolean(),
  is_verified: z.boolean(),
  job_title: z.string().nullable().or(z.literal("")),
  profile_picture: z.string().url().nullable(),
  first_name: z.string(),
  last_name: z.string(),
  organization_name: z.string().nullable(),
  organization_role: z.string().nullable(),
  organization_id: z.string().nullable(),
  organization_logo: z.string().nullable(),
  has_organization: z.boolean(),
  missing_setup_fields: z.array(z.string()),
  preferred_language: z.enum(["en", "fr"]).optional().default("en"),
  permissions: z.array(z.string()).default([]),
  has_password: z.boolean().optional().default(true),
  google_linked: z.boolean().optional().default(false),
});

export const updateProfilePayloadSchema = z.object({
  phone: z.string().max(15).optional(),
  job_title: z.string().max(100).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  profile_picture: z.instanceof(File).optional(),
  preferred_language: z.enum(["en", "fr"]).optional(),
});

export const updateLocationDeprecatedResponseSchema = z.object({
  detail: z.string(),
});

export const photoUploadResponseSchema = z.object({
  message: z.string(),
  photo_url: z.string().nullable(),
});

export const changePasswordPayloadSchema = z.object({
  // Omitted when a Google-only account sets its first password.
  current_password: z.string().optional(),
  new_password: z.string().min(8),
});

export const deleteAccountPayloadSchema = z.object({
  reason_choice: z.enum(["PRIVACY", "NOT_USEFUL", "TOO_COMPLICATED", "OTHER"]),
  reason_details: z.string().max(500).optional(),
  confirm: z.literal(true),
});

export const userRoleInfoSchema = z.object({
  is_org_admin: z.boolean(),
  organization_role: z.string().nullable(),
  organization_name: z.string().nullable(),
});

export const userQrCodeSchema = z.object({
  code: z.string(),
});

export const profileDataSchema = z.object({
  phone: z.string().nullable(),
  phone_verified: z.boolean(),
  job_title: z.string().nullable().or(z.literal("")),
  profile_picture: z.string().nullable(),
  updated_at: z.string(),
});

export const userSecuritySchema = z.object({
  is_suspended: z.boolean(),
  suspension_reason: z.string(),
  suspension_date: z.string().nullable(),
  updated_at: z.string(),
});

export const organizationMembershipSchema = z
  .object({
    id: z.string(),
  })
  .passthrough();

export const comprehensiveUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  is_verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  profile: profileDataSchema.nullable().optional(),
  security_profile: userSecuritySchema.nullable().optional(),
  organization_memberships: z.array(organizationMembershipSchema),
});

export type ApiMessageResponse = z.infer<typeof apiMessageResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type SessionLoginResponse = z.infer<typeof sessionLoginResponseSchema>;

export type GoogleLoginPayload = z.infer<typeof googleLoginPayloadSchema>;
export type GoogleLoginResponse = z.infer<typeof googleLoginResponseSchema>;
export type SessionGoogleLoginResponse = z.infer<
  typeof sessionGoogleLoginResponseSchema
>;

export type TokenRefreshPayload = z.infer<typeof tokenRefreshPayloadSchema>;
export type TokenRefreshResponse = z.infer<typeof tokenRefreshResponseSchema>;

export type LogoutPayload = z.infer<typeof logoutPayloadSchema>;

export type OtpPayload = z.infer<typeof otpPayloadSchema>;
export type EmailPayload = z.infer<typeof emailPayloadSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;

export type VerificationStatusResponse = z.infer<
  typeof verificationStatusResponseSchema
>;
export type SessionStateResponse = z.infer<typeof sessionStateResponseSchema>;

export type UserProfile = z.infer<typeof userProfileSchema>;
export type UpdateProfilePayload = z.infer<typeof updateProfilePayloadSchema>;

export type UpdateLocationDeprecatedResponse = z.infer<
  typeof updateLocationDeprecatedResponseSchema
>;
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;

export type ChangePasswordPayload = z.infer<typeof changePasswordPayloadSchema>;
export type DeleteAccountPayload = z.infer<typeof deleteAccountPayloadSchema>;

export type UserRoleInfo = z.infer<typeof userRoleInfoSchema>;
export type UserQrCode = z.infer<typeof userQrCodeSchema>;

export type ComprehensiveUser = z.infer<typeof comprehensiveUserSchema>;
