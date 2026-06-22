"use client";

import { useMemo, useState } from "react";
import { Xmark, User, Search, Building } from "iconoir-react";
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
        firstName: member.first_name || "",
        lastName: member.last_name || "",
        email: member.email,
        role: member.role,
        profilePicture: member.profile_picture || null,
      }));
  }, [organizationMembers, user?.id]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      return (
        member.label.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        member.role?.toLowerCase().includes(q)
      );
    });
  }, [memberSearch, members]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const removeParticipant = (userId: string) => {
    setSelectedParticipantIds((prev) => prev.filter((id) => id !== userId));
  };

  const selectedMembers = useMemo(() => {
    return members.filter((member) => selectedParticipantIds.includes(member.userId));
  }, [members, selectedParticipantIds]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#2A2A2E] bg-[#1C1C1F] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between border-b border-[#2A2A2E] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Start New Conversation</h2>
            <p className="text-xs text-text-muted mt-0.5">Create a chat thread with your team members</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-all duration-200 hover:bg-surface-3 hover:text-text-primary active:scale-95"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 max-h-[calc(100vh-200px)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40]">
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">
                Select Team Members <span className="text-status-critical">*</span>
              </label>
              {selectedParticipantIds.length > 0 && (
                <span className="text-xs text-text-muted">
                  {selectedParticipantIds.length} selected
                </span>
              )}
            </div>

            {/* Selected Members Badges */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-surface-4 bg-surface-3 p-3">
                {selectedMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1C1C1F] border border-[#2A2A2E] pl-2 pr-2 py-1.5 transition-all duration-200 hover:border-[#3A3A40]"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 h-6 w-6 rounded-full overflow-hidden bg-surface-4 border border-surface-4">
                      {member.profilePicture ? (
                        <img
                          src={member.profilePicture}
                          alt={member.label}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] font-semibold text-text-muted">
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-text-primary">{member.label}</span>
                    <button
                      type="button"
                      onClick={() => removeParticipant(member.userId)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-4 hover:text-text-primary"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-surface-4 bg-surface-3 p-2 [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40]">
              {filteredMembers.length ? (
                filteredMembers.map((member) => {
                  const selected = selectedParticipantIds.includes(member.userId);
                  return (
                    <label
                      key={member.userId}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                        selected 
                          ? "bg-brand-gold/15 border border-brand-gold/30" 
                          : "hover:bg-surface-4/60 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleParticipant(member.userId)}
                        className="sr-only"
                      />
                      {/* Avatar */}
                      <div className="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden bg-surface-4 border border-surface-4">
                        {member.profilePicture ? (
                          <img
                            src={member.profilePicture}
                            alt={member.label}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-text-muted">
                            {getInitials(member.firstName, member.lastName)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {member.label}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {member.email}
                        </span>
                      </div>
                      {selected && (
                        <div className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20">
                          <svg className="h-3.5 w-3.5 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </label>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-4 mb-3">
                    <Search className="h-5 w-5 text-text-muted" />
                  </div>
                  <p className="text-sm text-text-secondary mb-1">No members found</p>
                  <p className="text-xs text-text-muted">Try adjusting your search criteria</p>
                </div>
              )}
            </div>
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2E]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-[#2A2A2E] bg-transparent px-5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-surface-3 hover:text-text-primary hover:border-[#3A3A40] active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 rounded-lg bg-gradient-to-br from-[#A8821F] to-[#8F6F18] px-6 text-sm font-semibold text-[#141416] shadow-[0_2px_8px_rgba(168,130,31,0.25)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(168,130,31,0.35)] hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {createThreadMutation.isPending ? "Creating..." : "Create Conversation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
