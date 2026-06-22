"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  deleteAccount,
  forgotPassword,
  getAuthSessionState,
  getCurrentUserProfile,
  getUserDetailsById,
  getUserQrCode,
  getUserRoleInfo,
  getVerificationStatus,
  loginUser,
  loginUserWithSession,
  loginWithGoogle,
  loginWithGoogleSession,
  logoutUser,
  logoutUserSession,
  refreshAccessToken,
  registerUser,
  resendOtp,
  resetPassword,
  updateCurrentUserProfile,
  uploadUserDocument,
  uploadUserPhoto,
  verifyOtp,
} from "@/services/users/service";
import type {
  ChangePasswordPayload,
  DeleteAccountPayload,
  EmailPayload,
  GoogleLoginPayload,
  LoginPayload,
  LogoutPayload,
  OtpPayload,
  RegisterPayload,
  ResetPasswordPayload,
  TokenRefreshPayload,
  UpdateProfilePayload,
} from "@/services/users/types";

export const usersQueryKeys = {
  root: ["users"] as const,
  me: () => [...usersQueryKeys.root, "me"] as const,
  verificationStatus: () => [...usersQueryKeys.root, "verification-status"] as const,
  roleInfo: () => [...usersQueryKeys.root, "role-info"] as const,
  qrCode: () => [...usersQueryKeys.root, "qr-code"] as const,
  detail: (userId: string) => [...usersQueryKeys.root, "detail", userId] as const,
};

function resetSessionCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.cancelQueries();
  queryClient.clear();
}

function invalidateCurrentUser(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: usersQueryKeys.me() });
  queryClient.invalidateQueries({ queryKey: usersQueryKeys.verificationStatus() });
  queryClient.invalidateQueries({ queryKey: usersQueryKeys.roleInfo() });
  queryClient.invalidateQueries({ queryKey: usersQueryKeys.qrCode() });
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: usersQueryKeys.me(),
    queryFn: getCurrentUserProfile,
  });
}

export function useVerificationStatus() {
  return useQuery({
    queryKey: usersQueryKeys.verificationStatus(),
    queryFn: getVerificationStatus,
  });
}

export function useUserRoleInfo() {
  return useQuery({
    queryKey: usersQueryKeys.roleInfo(),
    queryFn: getUserRoleInfo,
  });
}

export function useUserQrCode() {
  return useQuery({
    queryKey: usersQueryKeys.qrCode(),
    queryFn: getUserQrCode,
  });
}

export function useUserDetails(userId: string) {
  return useQuery({
    queryKey: usersQueryKeys.detail(userId),
    queryFn: () => getUserDetailsById(userId),
    enabled: Boolean(userId),
  });
}

export function useRegisterUser() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerUser(payload),
  });
}

export function useLoginUser() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => loginUser(payload),
  });
}

export function useSessionLoginUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => loginUserWithSession(payload),
    onSuccess: () => {
      resetSessionCache(queryClient);
    },
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: (payload: GoogleLoginPayload) => loginWithGoogle(payload),
  });
}

export function useSessionGoogleLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GoogleLoginPayload) => loginWithGoogleSession(payload),
    onSuccess: () => {
      resetSessionCache(queryClient);
    },
  });
}

export function useRefreshAccessToken() {
  return useMutation({
    mutationFn: (payload: TokenRefreshPayload) => refreshAccessToken(payload),
  });
}

export function useLogoutUser() {
  return useMutation({
    mutationFn: (payload: LogoutPayload) => logoutUser(payload),
  });
}

export function useSessionLogoutUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutUserSession,
    onSuccess: () => {
      resetSessionCache(queryClient);
    },
  });
}

export function useAuthSessionState() {
  return useQuery({
    queryKey: [...usersQueryKeys.root, "session-state"],
    queryFn: getAuthSessionState,
    staleTime: 0,
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (payload: OtpPayload) => verifyOtp(payload),
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (payload: EmailPayload) => resendOtp(payload),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: EmailPayload) => forgotPassword(payload),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
  });
}

export function useUpdateCurrentUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateCurrentUserProfile(payload),
    onSuccess: () => {
      invalidateCurrentUser(queryClient);
    },
  });
}

export function useUploadUserPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (photo: File) => uploadUserPhoto(photo),
    onSuccess: () => {
      invalidateCurrentUser(queryClient);
    },
  });
}

export function useUploadUserDocument() {
  return useMutation({
    mutationFn: (verificationDocument: File) => uploadUserDocument(verificationDocument),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (payload: DeleteAccountPayload) => deleteAccount(payload),
  });
}
