import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as organizationService from "./service";
import { toast } from "react-hot-toast";
import type { OrganizationRegisterPayload } from "./types";
import { usersQueryKeys } from "../users/hooks";

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  details: (id: string) => [...organizationKeys.all, "detail", id] as const,
  members: (id: string) => [...organizationKeys.all, "members", id] as const,
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
