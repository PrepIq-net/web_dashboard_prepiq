import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import * as branchService from "./service";
import type {
  CreateBranchPayload,
  UpdateBranchPayload,
  CreateDepartmentPayload,
  CreateStaffInvitePayload,
  AcceptInvitePayload,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Query keys — structured for surgical cache invalidation
// ─────────────────────────────────────────────────────────────────────────────
export const branchKeys = {
  all: ["branches"] as const,
  org: (orgId: string) => [...branchKeys.all, orgId] as const,

  branches: (orgId: string) => [...branchKeys.org(orgId), "branches"] as const,
  branch: (orgId: string, branchId: string) =>
    [...branchKeys.branches(orgId), branchId] as const,

  departments: (orgId: string) =>
    [...branchKeys.org(orgId), "departments"] as const,
  department: (orgId: string, deptId: string) =>
    [...branchKeys.departments(orgId), deptId] as const,

  invites: (orgId: string) => [...branchKeys.org(orgId), "invites"] as const,
  inviteContext: (orgId: string) =>
    [...branchKeys.org(orgId), "invite-context"] as const,

  staff: (orgId: string) => [...branchKeys.org(orgId), "staff"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────────

export function useBranches(orgId: string) {
  return useQuery({
    queryKey: branchKeys.branches(orgId),
    queryFn: () => branchService.listBranches(orgId),
    enabled: !!orgId,
  });
}

export function useBranch(orgId: string, branchId: string) {
  return useQuery({
    queryKey: branchKeys.branch(orgId, branchId),
    queryFn: () => branchService.getBranch(orgId, branchId),
    enabled: !!orgId && !!branchId,
  });
}

export function useCreateBranch(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBranchPayload) =>
      branchService.createBranch(orgId, payload),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.branches(orgId) });
      toast.success(`Branch "${branch.name}" created.`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create branch.");
    },
  });
}

export function useUpdateBranch(orgId: string, branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBranchPayload) =>
      branchService.updateBranch(orgId, branchId, payload),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.branches(orgId) });
      queryClient.invalidateQueries({
        queryKey: branchKeys.branch(orgId, branchId),
      });
      toast.success(`Branch "${branch.name}" updated.`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update branch.");
    },
  });
}

export function useDeleteBranch(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      branchService.deleteBranch(orgId, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.branches(orgId) });
      toast.success("Branch removed.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete branch.");
    },
  });
}

export function useSetPrimaryBranch(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      branchService.setPrimaryBranch(orgId, branchId),
    onSuccess: (branch) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.branches(orgId) });
      toast.success(`"${branch.name}" set as primary branch.`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to set primary branch.");
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────────────────────

export function useDepartments(orgId: string) {
  return useQuery({
    queryKey: branchKeys.departments(orgId),
    queryFn: () => branchService.listDepartments(orgId),
    enabled: !!orgId,
  });
}

export function useCreateDepartment(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) =>
      branchService.createDepartment(orgId, payload),
    onSuccess: (dept) => {
      queryClient.invalidateQueries({
        queryKey: branchKeys.departments(orgId),
      });
      toast.success(`Department "${dept.name}" created.`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create department.");
    },
  });
}

export function useUpdateDepartment(orgId: string, deptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateDepartmentPayload>) =>
      branchService.updateDepartment(orgId, deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: branchKeys.departments(orgId),
      });
      toast.success("Department updated.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update department.");
    },
  });
}

export function useDeleteDepartment(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deptId: string) =>
      branchService.deleteDepartment(orgId, deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: branchKeys.departments(orgId),
      });
      toast.success("Department removed.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete department.");
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Invites
// ─────────────────────────────────────────────────────────────────────────────

export function useStaffInvites(orgId: string) {
  return useQuery({
    queryKey: branchKeys.invites(orgId),
    queryFn: () => branchService.listInvites(orgId),
    enabled: !!orgId,
  });
}

export function useStaffInviteContext(orgId: string) {
  return useQuery({
    queryKey: branchKeys.inviteContext(orgId),
    queryFn: () => branchService.getStaffInviteContext(orgId),
    enabled: !!orgId,
  });
}

export function useCreateInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaffInvitePayload) =>
      branchService.createInvite(orgId, payload),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.invites(orgId) });
      toast.success(`Invite sent to ${invite.email}.`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send invite.");
    },
  });
}

export function useRevokeInvite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, reason }: { inviteId: string; reason?: string }) =>
      branchService.revokeInvite(orgId, inviteId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.invites(orgId) });
      toast.success("Invite revoked.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to revoke invite.");
    },
  });
}

/** Read-only lookup — used on the invite acceptance page before any auth */
export function useValidateInviteToken(token: string) {
  return useQuery({
    queryKey: ["invite-validation", token],
    queryFn: () => branchService.validateInviteToken(token),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (payload: AcceptInvitePayload) =>
      branchService.acceptInvite(payload),
    onSuccess: () => {
      toast.success("Welcome aboard! Invite accepted.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to accept invite.");
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Assignments
// ─────────────────────────────────────────────────────────────────────────────

export function useStaffAssignments(orgId: string) {
  return useQuery({
    queryKey: branchKeys.staff(orgId),
    queryFn: () => branchService.listStaffAssignments(orgId),
    enabled: !!orgId,
  });
}

export function useRemoveStaff(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason?: string }) =>
      branchService.removeStaff(orgId, memberId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.staff(orgId) });
      toast.success("Staff member removed.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove staff member.");
    },
  });
}
