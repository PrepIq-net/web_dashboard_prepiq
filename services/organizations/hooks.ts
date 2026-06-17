import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as organizationService from "./service";
import { toast } from "react-hot-toast";
import type {
  AddOrganizationMemberPayload,
  OrganizationRegisterPayload,
  OrganizationFinancialOverviewQuery,
} from "./types";
import { usersQueryKeys } from "../users/hooks";
import { branchKeys } from "../branches/hooks";

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: (id: string) => [...organizationKeys.all, "detail", id] as const,
  members: (id: string) => [...organizationKeys.all, "members", id] as const,
  financialOverview: (id: string, params?: OrganizationFinancialOverviewQuery) =>
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
    mutationFn: ({ userId, custom_role_slug }: { userId: string; custom_role_slug: string }) =>
      organizationService.updateOrganizationMember(id, userId, { custom_role_slug }),
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
    queryFn: () => organizationService.getOrganizationFinancialOverview(id, params),
    enabled: Boolean(id) && enabled,
  });
}
