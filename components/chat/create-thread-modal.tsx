"use client";

import { useState } from "react";
import { X, User, PriorityHigh, Building } from "iconoir-react";
import { Select } from "@/components/ui/select";
import { useCreateChatThread, useThreadTags } from "@/services/chat/hooks";
import { useBranches } from "@/services";
import type { UserProfile } from "@/services/users/types";
import type { ThreadType, ThreadPriority } from "@/services/chat/types";

interface CreateThreadModalProps {
  user?: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateThreadModal({ user, onClose, onSuccess }: CreateThreadModalProps) {
  const [formData, setFormData] = useState({
    thread_type: "INTERNAL" as ThreadType,
    category: "",
    priority: "MEDIUM" as ThreadPriority,
    branch: "",
    department: "",
    initial_message: "",
  });

  const createThreadMutation = useCreateChatThread();
  const { data: branches } = useBranches(user?.organization_id || "");
  const { data: tags } = useThreadTags();

  const threadTypeOptions = [
    { value: "INTERNAL", label: "Internal Team Chat" },
    { value: "ORG_OPS", label: "Operations Discussion" },
  ];

  const priorityOptions = [
    { value: "LOW", label: "Low Priority" },
    { value: "MEDIUM", label: "Medium Priority" },
    { value: "HIGH", label: "High Priority" },
    { value: "URGENT", label: "Urgent" },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.organization_id || !formData.category.trim()) return;

    try {
      await createThreadMutation.mutateAsync({
        thread_type: formData.thread_type,
        business: user.organization_id,
        branch: formData.branch || undefined,
        department: formData.department || undefined,
        priority: formData.priority,
        category: formData.category.trim(),
        initial_message: formData.initial_message.trim() || undefined,
      });
      
      onSuccess();
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-surface-2 rounded-xl border border-surface-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-4">
          <h2 className="text-lg font-semibold text-text-primary">Start New Conversation</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Thread Type */}
          <Select
            label="Conversation Type"
            options={threadTypeOptions}
            value={formData.thread_type}
            onChange={(value) => setFormData(prev => ({ ...prev, thread_type: value as ThreadType }))}
            leadingIcon={<User className="h-4 w-4" />}
          />

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Topic/Category *
            </label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Daily Operations, Menu Planning, Staff Schedule"
              className="h-12 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
            />
          </div>

          {/* Priority */}
          <Select
            label="Priority Level"
            options={priorityOptions}
            value={formData.priority}
            onChange={(value) => setFormData(prev => ({ ...prev, priority: value as ThreadPriority }))}
            leadingIcon={<PriorityHigh className="h-4 w-4" />}
          />

          {/* Branch (if available) */}
          {branchOptions.length > 0 && (
            <Select
              label="Branch (Optional)"
              options={[{ value: "", label: "All Branches" }, ...branchOptions]}
              value={formData.branch}
              onChange={(value) => setFormData(prev => ({ ...prev, branch: value }))}
              leadingIcon={<Building className="h-4 w-4" />}
            />
          )}

          {/* Department */}
          <Select
            label="Department (Optional)"
            options={[{ value: "", label: "All Departments" }, ...departmentOptions]}
            value={formData.department}
            onChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
            leadingIcon={<Building className="h-4 w-4" />}
          />

          {/* Initial Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Initial Message (Optional)
            </label>
            <textarea
              value={formData.initial_message}
              onChange={(e) => setFormData(prev => ({ ...prev, initial_message: e.target.value }))}
              placeholder="Start the conversation with a message..."
              rows={3}
              className="w-full rounded-lg border border-surface-4 bg-surface-3 px-3 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-surface-4 bg-transparent text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createThreadMutation.isPending || !formData.category.trim()}
              className="h-10 px-6 rounded-lg bg-brand-gold text-surface-1 font-medium transition-all duration-200 hover:bg-brand-gold/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createThreadMutation.isPending ? "Creating..." : "Start Conversation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}