import { ApiError } from "@/lib/api/errors";
import { apiClientWithSchema } from "@/lib/api/client";
import { usersEndpoints } from "@/services/users/endpoints";
import {
  apiMessageResponseSchema,
  comprehensiveUserSchema,
  deleteAccountPayloadSchema,
  emailPayloadSchema,
  googleLoginPayloadSchema,
  googleLoginResponseSchema,
  loginPayloadSchema,
  loginResponseSchema,
  logoutPayloadSchema,
  otpPayloadSchema,
  photoUploadResponseSchema,
  registerPayloadSchema,
  registerResponseSchema,
  resetPasswordPayloadSchema,
  sessionGoogleLoginResponseSchema,
  sessionLoginResponseSchema,
  sessionStateResponseSchema,
  tokenRefreshPayloadSchema,
  tokenRefreshResponseSchema,
  updateLocationDeprecatedResponseSchema,
  updateProfilePayloadSchema,
  userProfileSchema,
  userQrCodeSchema,
  userRoleInfoSchema,
  verificationStatusResponseSchema,
  type DeleteAccountPayload,
  type EmailPayload,
  type GoogleLoginPayload,
  type LoginPayload,
  type LogoutPayload,
  type OtpPayload,
  type RegisterPayload,
  type ResetPasswordPayload,
  type TokenRefreshPayload,
  type UpdateProfilePayload,
} from "@/services/users/types";

function toFormData(payload: UpdateProfilePayload): FormData {
  const formData = new FormData();

  if (payload.phone !== undefined) formData.append("phone", payload.phone);
  if (payload.job_title !== undefined)
    formData.append("job_title", payload.job_title);
  if (payload.first_name !== undefined)
    formData.append("first_name", payload.first_name);
  if (payload.last_name !== undefined)
    formData.append("last_name", payload.last_name);
  if (payload.profile_picture !== undefined) {
    formData.append("profile_picture", payload.profile_picture);
  }

  return formData;
}

export async function registerUser(payload: RegisterPayload) {
  const body = registerPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.register,
    registerResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function loginUser(payload: LoginPayload) {
  const body = loginPayloadSchema.parse(payload);
  return apiClientWithSchema(usersEndpoints.auth.login, loginResponseSchema, {
    method: "POST",
    body,
  });
}

export async function loginUserWithSession(payload: LoginPayload) {
  const body = loginPayloadSchema.parse(payload);
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  const data = (await response.json()) as unknown;
  return sessionLoginResponseSchema.parse(data);
}

export async function loginWithGoogle(payload: GoogleLoginPayload) {
  const body = googleLoginPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.googleLogin,
    googleLoginResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function loginWithGoogleSession(payload: GoogleLoginPayload) {
  const body = googleLoginPayloadSchema.parse(payload);
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  const data = (await response.json()) as unknown;
  return sessionGoogleLoginResponseSchema.parse(data);
}

export async function refreshAccessToken(payload: TokenRefreshPayload) {
  const body = tokenRefreshPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.refresh,
    tokenRefreshResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function logoutUser(payload: LogoutPayload) {
  const body = logoutPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.logout,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function logoutUserSession() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  const data = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new Error("Logout failed");
  }

  return apiMessageResponseSchema.parse(data);
}

export async function getAuthSessionState() {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new Error("Failed to resolve auth session state");
  }

  return sessionStateResponseSchema.parse(data);
}

export async function verifyOtp(payload: OtpPayload) {
  const body = otpPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.verifyOtp,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function resendOtp(payload: EmailPayload) {
  const body = emailPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.resendOtp,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function forgotPassword(payload: EmailPayload) {
  const body = emailPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.forgotPassword,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const body = resetPasswordPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.auth.resetPassword,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function getVerificationStatus() {
  return apiClientWithSchema(
    usersEndpoints.auth.verificationStatus,
    verificationStatusResponseSchema,
  );
}

export async function getCurrentUserProfile() {
  return apiClientWithSchema(usersEndpoints.profile.me, userProfileSchema);
}

export async function updateCurrentUserProfile(payload: UpdateProfilePayload) {
  const parsed = updateProfilePayloadSchema.parse(payload);

  return apiClientWithSchema(usersEndpoints.profile.update, userProfileSchema, {
    method: "PATCH",
    body: parsed.profile_picture ? toFormData(parsed) : parsed,
  });
}

export async function updateUserLocationDeprecated() {
  return apiClientWithSchema(
    usersEndpoints.profile.updateLocation,
    updateLocationDeprecatedResponseSchema,
    { method: "PATCH" },
  );
}

export async function uploadUserPhoto(photo: File) {
  const formData = new FormData();
  formData.append("photo", photo);

  return apiClientWithSchema(
    usersEndpoints.profile.uploadPhoto,
    photoUploadResponseSchema,
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function uploadUserDocument(verificationDocument: File) {
  const formData = new FormData();
  formData.append("verification_document", verificationDocument);

  return apiClientWithSchema(
    usersEndpoints.profile.uploadDocuments,
    apiMessageResponseSchema,
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function deleteAccount(payload: DeleteAccountPayload) {
  const body = deleteAccountPayloadSchema.parse(payload);
  return apiClientWithSchema(
    usersEndpoints.profile.deleteAccount,
    apiMessageResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function getUserRoleInfo() {
  return apiClientWithSchema(usersEndpoints.profile.roles, userRoleInfoSchema);
}

export async function getUserQrCode() {
  return apiClientWithSchema(usersEndpoints.profile.qrCode, userQrCodeSchema);
}

export async function getUserDetailsById(userId: string) {
  return apiClientWithSchema(
    usersEndpoints.profile.details(userId),
    comprehensiveUserSchema,
  );
}
