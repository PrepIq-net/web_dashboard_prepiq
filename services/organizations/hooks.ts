import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as organizationService from "./service";
import { toast } from "react-hot-toast";
import type {
  AddOrganizationMemberPayload,
  OrganizationRegisterPayload,
  OrganizationFinancialOverviewQuery,
  RoleCreateUpdatePayload,
} from "./types";
import { usersQueryKeys } from "../users/hooks";
import { branchKeys } from "../branches/hooks";

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: (id: string) => [...organizationKeys.all, "detail", id] as const,
  members: (id: string) => [...organizationKeys.all, "members", id] as const,
  permissions: (id: string) =>
    [...organizationKeys.all, "permissions", id] as const,
  roles: (id: string) => [...organizationKeys.all, "roles", id] as const,
  roleDetail: (id: string, roleId: string) =>
    [...organizationKeys.all, "role", id, roleId] as const,
  financialOverview: (
    id: string,
    params?: OrganizationFinancialOverviewQuery,
  ) =>
    [
      ...organizationKeys.all,
      "financial-overview",
      id,
      params?.timeframe ?? "",
      params?.start_date ?? "",
      params?.end_date ?? "",
      params?.branch_id ?? "",
    ] as const,
};

export function useMyOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: organizationService.getMyOrganizations,
  });
}

export function useOrganizationDetail(id: string) {
  return useQuery({
    queryKey: organizationKeys.details(id),
    queryFn: () => organizationService.getOrganizationDetail(id),
    enabled: !!id,
  });
}

export function useOrganizationMembers(id: string) {
  return useQuery({
    queryKey: organizationKeys.members(id),
    queryFn: () => organizationService.getOrganizationMembers(id),
    enabled: !!id,
  });
}

export function useRegisterOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: organizationService.registerOrganization,
    onSuccess: async (org) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.me() }),
      ]);
      toast.success(`Organization "${org.name}" created successfully!`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create organization.");
    },
  });
}

export function useUpdateOrganization(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<OrganizationRegisterPayload>) =>
      organizationService.updateOrganization(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.details(id) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      toast.success("Organization updated successfully!");
    },
  });
}

export function useAddOrganizationMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddOrganizationMemberPayload) =>
      organizationService.addOrganizationMember(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) });
      queryClient.invalidateQueries({ queryKey: branchKeys.staff(id) });
      toast.success("Member added successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add member.");
    },
  });
}

export function useUpdateOrganizationMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      custom_role_slug,
    }: {
      userId: string;
      custom_role_slug: string;
    }) =>
      organizationService.updateOrganizationMember(id, userId, {
        custom_role_slug,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) });
      toast.success("Member role updated.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update member.");
    },
  });
}

export function useRemoveOrganizationMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      organizationService.removeOrganizationMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) });
      queryClient.invalidateQueries({ queryKey: branchKeys.staff(id) });
      toast.success("Member removed successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove member.");
    },
  });
}

export function useOrganizationFinancialOverview(
  id: string,
  params?: OrganizationFinancialOverviewQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: organizationKeys.financialOverview(id, params),
    queryFn: () =>
      organizationService.getOrganizationFinancialOverview(id, params),
    enabled: Boolean(id) && enabled,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RBAC Permissions & Roles
// ─────────────────────────────────────────────────────────────────────────────

export function useOrganizationPermissions(id: string) {
  return useQuery({
    queryKey: organizationKeys.permissions(id),
    queryFn: () => organizationService.getOrganizationPermissions(id),
    enabled: !!id,
  });
}

export function useOrganizationRoles(id: string) {
  return useQuery({
    queryKey: organizationKeys.roles(id),
    queryFn: () => organizationService.getOrganizationRoles(id),
    enabled: !!id,
  });
}

export function useCreateOrganizationRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleCreateUpdatePayload) =>
      organizationService.createOrganizationRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles(id) });
      toast.success("Role created successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create role.");
    },
  });
}

export function useUpdateOrganizationRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: RoleCreateUpdatePayload;
    }) => organizationService.updateOrganizationRole(id, roleId, payload),
    onSuccess: (_role) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles(id) });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.roleDetail(id, _role.id),
      });
      toast.success("Role updated successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update role.");
    },
  });
}

export function useDeleteOrganizationRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      organizationService.deleteOrganizationRole(id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles(id) });
      toast.success("Role deleted successfully.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete role.");
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Danger zone — leave / transfer ownership / delete organization
// ─────────────────────────────────────────────────────────────────────────────

export function useLeaveOrganization(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationService.leaveOrganization(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.me() }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to leave organization.");
    },
  });
}

export function useTransferOrganizationOwnership(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      organizationService.transferOrganizationOwnership(id, userId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.details(id) }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.me() }),
      ]);
      toast.success("Ownership transferred.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to transfer ownership.");
    },
  });
}

export function useDeleteOrganization(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationService.deleteOrganization(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.me() }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete organization.");
    },
  });
}
