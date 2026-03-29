"use client";

import { useState } from "react";
import {
  useNotifications,
  useMarkNotificationsAsRead,
  useMarkNotificationsAsResolved,
} from "@/services";
import {
  Check,
  Filter,
  CheckCircle,
  WarningTriangle,
  InfoCircle,
  Clock,
  Menu,
} from "iconoir-react";
import { format } from "date-fns";

export default function NotificationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("UNREAD");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("");
  const [domainFilter, setDomainFilter] = useState<string>("");

  const notificationsQuery = useNotifications({
    status: statusFilter || undefined,
    urgency: urgencyFilter || undefined,
    domain: domainFilter || undefined,
  });

  const markAsReadMutation = useMarkNotificationsAsRead();
  const markAsResolvedMutation = useMarkNotificationsAsResolved();

  const notifications = notificationsQuery.data ?? [];

  const handleMarkAllRead = () => {
    markAsReadMutation.mutate({});
  };

  const getUrgencyIcon = (level: string | null | undefined) => {
    switch (level) {
      case "CRITICAL":
        return <WarningTriangle className="h-5 w-5 text-[#FF3B30]" />;
      case "WARNING":
        return <WarningTriangle className="h-5 w-5 text-[#FFCC00]" />;
      case "INFO":
        return <InfoCircle className="h-5 w-5 text-[#34C759]" />;
      default:
        return <InfoCircle className="h-5 w-5 text-[#8E8E93]" />;
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Operational Intelligence
          </p>
          <h1 className="mt-1 font-display text-[32px] font-semibold text-[#F5F5F7]">
            Decision Queue
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#2A2A2E] bg-[#1C1C1F] px-4 text-[13px] font-medium text-[#C7C7CC] transition-colors hover:bg-[#232327] hover:text-[#F5F5F7]"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[#2A2A2E] bg-[#1C1C1F] p-4">
        <div className="flex items-center gap-2 text-[#8E8E93]">
          <Filter className="h-4 w-4" />
          <span className="text-[13px] font-medium">Filters:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-[6px] border border-[#2A2A2E] bg-[#232327] px-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
        >
          <option value="">All Status</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
        </select>

        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="h-9 rounded-[6px] border border-[#2A2A2E] bg-[#232327] px-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
        >
          <option value="">All Urgency</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="h-9 rounded-[6px] border border-[#2A2A2E] bg-[#232327] px-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
        >
          <option value="">All Domains</option>
          <option value="PRODUCTION">Production</option>
          <option value="FINANCE">Finance</option>
          <option value="INVENTORY">Inventory</option>
          <option value="STAFF">Staff</option>
        </select>
      </div>

      <div className="space-y-4">
        {notificationsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center rounded-[12px] border border-[#2A2A2E] bg-[#1C1C1F]">
            <p className="text-[14px] text-[#8E8E93]">
              Loading intelligence feed...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center space-y-3 rounded-[12px] border border-[#2A2A2E] bg-[#1C1C1F] text-center">
            <CheckCircle className="h-10 w-10 text-[#2A2A2E]" />
            <div>
              <p className="text-[15px] font-medium text-[#F5F5F7]">
                Inbox Zero
              </p>
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                No notifications found matching your filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A2E] overflow-hidden rounded-[12px] border border-[#2A2A2E] bg-[#1C1C1F]">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`group flex items-start gap-4 p-5 transition-colors hover:bg-[#232327] ${
                  notification.status === "UNREAD"
                    ? "bg-[#1C1C1F]"
                    : "bg-[#1C1C1F]/50 opacity-70"
                }`}
              >
                <div className="mt-1 shrink-0">
                  {getUrgencyIcon(notification.escalation_level)}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-[#F5F5F7]">
                      {notification.title || "Intelligence Alert"}
                    </h3>
                    <span className="shrink-0 text-[12px] text-[#8E8E93]">
                      {format(
                        new Date(notification.created_at),
                        "MMM d, h:mm a",
                      )}
                    </span>
                  </div>

                  <p className="text-[14px] leading-relaxed text-[#C7C7CC]">
                    {notification.body || notification.message}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 rounded-full bg-[#232327] px-2.5 py-1 text-[11px] font-medium text-[#A8821F]">
                      <Menu className="h-3 w-3" />
                      {notification.domain || "SYSTEM"}
                    </div>

                    {notification.recommended_action && (
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#F5F5F7]">
                        <Clock className="h-3.5 w-3.5 text-[#34C759]" />
                        {notification.recommended_action}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {notification.status === "UNREAD" && (
                    <button
                      onClick={() =>
                        markAsReadMutation.mutate({
                          notification_ids: [notification.id],
                        })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8E8E93] transition-colors hover:bg-[#2A2A2E] hover:text-[#34C759]"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      markAsResolvedMutation.mutate({
                        notification_ids: [notification.id],
                      })
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8E8E93] transition-colors hover:bg-[#2A2A2E] hover:text-[#34C759]"
                    title="Resolve"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
