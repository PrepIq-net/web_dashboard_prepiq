"use client";

import { useMemo, useState } from "react";
import { X, User, Search, Building } from "iconoir-react";
import { Select } from "@/components/ui/select";
import { useCreateChatThread } from "@/services/chat/hooks";
import { useBranches, useOrganizationMembers } from "@/services";
import type { UserProfile } from "@/services/users/types";
import type { ThreadType } from "@/services/chat/types";

interface CreateThreadModalProps {
  user?: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateThreadModal({ user, onClose, onSuccess }: CreateThreadModalProps) {
  const [formData, setFormData] = useState({
    thread_type: "INTERNAL" as ThreadType,
    category: "",
    branch: "",
    department: "",
    initial_message: "",
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  const createThreadMutation = useCreateChatThread();
  const { data: branches } = useBranches(user?.organization_id || "");
  const { data: organizationMembers } = useOrganizationMembers(user?.organization_id || "");

  const threadTypeOptions = [
    { value: "INTERNAL", label: "Internal Team Chat" },
    { value: "ORG_OPS", label: "Operations Discussion" },
  ];

  const branchOptions = branches?.map((branch: any) => ({
    value: branch.id,
    label: branch.name,
  })) ?? [];

  const departmentOptions = [
    { value: "KITCHEN", label: "Kitchen" },
    { value: "FRONT_OF_HOUSE", label: "Front of House" },
    { value: "MANAGEMENT", label: "Management" },
    { value: "OPERATIONS", label: "Operations" },
    { value: "CUSTOMER_SERVICE", label: "Customer Service" },
  ];

  const members = useMemo(() => {
    const currentUserId = user?.id ? String(user.id) : "";
    const raw = organizationMembers ?? [];
    return raw
      .filter((member) => member.is_active && String(member.user) !== currentUserId)
      .map((member) => ({
        userId: String(member.user),
        label: `${member.first_name} ${member.last_name}`.trim() || member.email,
        email: member.email,
        role: member.role,
      }));
  }, [organizationMembers, user?.id]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      return (
        member.label.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        member.role.toLowerCase().includes(q)
      );
    });
  }, [memberSearch, members]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const canSubmit =
    Boolean(user?.organization_id) &&
    selectedParticipantIds.length > 0 &&
    !createThreadMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user?.organization_id) return;

    try {
      await createThreadMutation.mutateAsync({
        thread_type: formData.thread_type,
        business: user.organization_id,
        branch: formData.branch || undefined,
        department: formData.department || undefined,
        category: formData.category.trim() || undefined,
        initial_message: formData.initial_message.trim() || undefined,
        participant_ids: selectedParticipantIds,
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-surface-4 bg-surface-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-4 p-6">
          <h2 className="text-lg font-semibold text-text-primary">Start New Conversation</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Conversation Type"
              options={threadTypeOptions}
              value={formData.thread_type}
              onChange={(value) => setFormData((prev) => ({ ...prev, thread_type: value as ThreadType }))}
              leadingIcon={<User className="h-4 w-4" />}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Conversation Name (Optional)</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Morning Kitchen Sync"
                className="h-12 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              />
              <p className="text-[11px] text-text-muted">
                If left blank, PrepIQ will generate a smart name based on selected members.
              </p>
            </div>
          </div>

          {branchOptions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Branch (Optional)"
                options={[{ value: "", label: "All Branches" }, ...branchOptions]}
                value={formData.branch}
                onChange={(value) => setFormData((prev) => ({ ...prev, branch: value }))}
                leadingIcon={<Building className="h-4 w-4" />}
              />
              <Select
                label="Department (Optional)"
                options={[{ value: "", label: "All Departments" }, ...departmentOptions]}
                value={formData.department}
                onChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
                leadingIcon={<Building className="h-4 w-4" />}
              />
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="text-sm font-medium text-text-secondary">
              Select Team Members <span className="text-status-critical">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search by name, email, or role"
                className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-surface-4 bg-surface-3 p-2">
              {filteredMembers.length ? (
                filteredMembers.map((member) => {
                  const selected = selectedParticipantIds.includes(member.userId);
                  return (
                    <label
                      key={member.userId}
                      className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors ${
                        selected ? "bg-brand-gold/15" : "hover:bg-surface-4/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleParticipant(member.userId)}
                        className="mt-1 h-4 w-4 rounded border-surface-4 bg-surface-2 accent-brand-gold"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">{member.label}</span>
                        <span className="block truncate text-xs text-text-muted">{member.email}</span>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="px-2 py-2 text-xs text-text-muted">No staff members found for this query.</p>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Selected: {selectedParticipantIds.length}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Initial Message (Optional)</label>
            <textarea
              value={formData.initial_message}
              onChange={(e) => setFormData((prev) => ({ ...prev, initial_message: e.target.value }))}
              placeholder="Start the conversation..."
              rows={3}
              className="w-full resize-none rounded-lg border border-surface-4 bg-surface-3 px-3 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-surface-4 bg-transparent px-4 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 rounded-lg bg-brand-gold px-6 font-medium text-surface-1 transition-all duration-200 hover:bg-brand-gold/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createThreadMutation.isPending ? "Creating..." : "Create Conversation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
