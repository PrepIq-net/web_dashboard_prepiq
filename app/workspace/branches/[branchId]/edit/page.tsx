"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "iconoir-react";

import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { BranchForm } from "@/components/branches/branch-form";
import { useTranslation } from "@/lib/i18n";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useCurrentUserProfile } from "@/services";
import { useBranch, useUpdateBranch } from "@/services/branches/hooks";

export default function EditBranchPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ branchId: string }>();
  const branchId = String(params?.branchId ?? "");

  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canManage = permissions.has(PERMISSIONS.MANAGE_BRANCHES);
  const orgId = user?.organization_id ?? "";

  const branchQuery = useBranch(orgId, branchId);
  const updateBranch = useUpdateBranch(orgId, branchId);

  useEffect(() => {
    if (!userLoading && !canManage) {
      router.replace(`/workspace/branches/${branchId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, canManage, branchId]);

  const branch = branchQuery.data;

  return (
    <WorkspaceShell
      eyebrow={t("workspace.branches.edit.eyebrow")}
      title={branch?.name ?? t("workspace.branches.edit.title")}
      description={t("workspace.branches.edit.description")}
      insight={t("workspace.branches.edit.insight")}
    >
      <Link
        href={`/workspace/branches/${branchId}`}
        className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("workspace.branches.edit.backToBranch")}
      </Link>

      {branchQuery.isLoading || userLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-xl border border-surface-4 bg-surface-2"
            />
          ))}
        </div>
      ) : branchQuery.isError || !branch ? (
        <div className="rounded-xl border border-surface-4 bg-surface-2 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-text-primary">
            {t("workspace.branches.detail.notFoundTitle")}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t("workspace.branches.detail.notFoundDescription")}
          </p>
        </div>
      ) : (
        <div className="max-w-4xl">
          <BranchForm
            branch={branch}
            isSaving={updateBranch.isPending}
            onCancel={() => router.push(`/workspace/branches/${branchId}`)}
            onSubmit={(payload) =>
              updateBranch.mutate(payload, {
                onSuccess: () => router.push(`/workspace/branches/${branchId}`),
              })
            }
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
