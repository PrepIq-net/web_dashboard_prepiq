"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  useNotifications,
  useMarkNotificationsAsRead,
  useMarkNotificationsAsResolved,
} from "@/services";
import { useExplainAlert } from "@/services/assistant/hooks";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_COLORS,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from "@/services/notifications/types";
import {
  Check,
  CheckCircle,
  WarningTriangle,
  InfoCircle,
  Clock,
  Sparks,
} from "iconoir-react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";

const TAB_KEYS = [
  { id: "all", labelKey: "common.all" },
  { id: "today", labelKey: "common.today" },
  { id: "OPERATIONAL", labelKey: "workspace.notifications.tab.operational" },
  { id: "PLANNING", labelKey: "workspace.notifications.tab.planning" },
  { id: "LIVE_SERVICE", labelKey: "workspace.notifications.tab.liveService" },
  { id: "LEARNING", labelKey: "workspace.notifications.tab.learning" },
  { id: "EXECUTIVE", labelKey: "workspace.notifications.tab.executive" },
] as const;

type TabId = (typeof TAB_KEYS)[number]["id"];

const getCategoryStyles = (category: string | null | undefined) => {
  const color = NOTIFICATION_CATEGORY_COLORS[category as NotificationCategory] ?? "#8E8E93";
  const label = NOTIFICATION_CATEGORY_LABELS[category as NotificationCategory] ?? category ?? "Operational";
  return { color, label };
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [explainingId, setExplainingId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: any = {};
    if (activeTab === "today") params.is_today = true;
    if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(activeTab)) {
      params.category = activeTab;
    }
    return params;
  }, [activeTab]);

  const notificationsQuery = useNotifications(queryParams);
  const markAsReadMutation = useMarkNotificationsAsRead();
  const markAsResolvedMutation = useMarkNotificationsAsResolved();
  const explainAlertMutation = useExplainAlert();

  const notifications = notificationsQuery.data ?? [];

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, typeof notifications> = {};

    notifications.forEach((notification) => {
      const date = startOfDay(new Date(notification.created_at)).toISOString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(notification);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notifications]);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t("common.today");
    if (isYesterday(date)) return t("common.yesterday");
    return format(date, "MMMM d, yyyy");
  };

  const getUrgencyStyles = (level: string | null | undefined) => {
    switch (level) {
      case "CRITICAL":
        return {
          border: "border-l-[#C44949]",
          icon: <WarningTriangle className="h-5 w-5 text-[#C44949]" />,
        };
      case "WARNING":
        return {
          border: "border-l-[#C48B2A]",
          icon: <WarningTriangle className="h-5 w-5 text-[#C48B2A]" />,
        };
      case "INFO":
        return {
          border: "border-l-[#3A6EA5]",
          icon: <InfoCircle className="h-5 w-5 text-[#3A6EA5]" />,
        };
      default:
        return {
          border: "border-l-[#2A2A2E]",
          icon: <InfoCircle className="h-5 w-5 text-[#8E8E93]" />,
        };
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("workspace.notifications.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-semibold text-[#F5F5F7]">
            {t("workspace.notifications.title")}
          </h1>
        </div>
        <button
          onClick={() => markAsReadMutation.mutate({})}
          className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#2E2E33] bg-transparent px-4 text-[13px] font-medium text-[#F5F5F7] transition-colors hover:bg-[#232327]"
        >
          <Check className="h-4 w-4" />
          {t("workspace.notifications.markAllRead")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#2A2A2E]">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 pb-3 text-[13px] font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#A8821F]"
                : "text-[#8E8E93] hover:text-[#C7C7CC]"
            }`}
          >
            {t(tab.labelKey)}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#A8821F]" />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {notificationsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-[14px] text-[#8E8E93] animate-pulse">
              {t("workspace.notifications.loading")}
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center space-y-3 text-center">
            <CheckCircle className="h-10 w-10 text-[#2A2A2E]" />
            <div>
              <p className="text-[15px] font-medium text-[#F5F5F7]">
                {t("workspace.notifications.empty.title")}
              </p>
              <p className="mt-1 text-[13px] text-[#8E8E93]">
                {t("workspace.notifications.empty.description")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedNotifications.map(([dateStr, dateNotifications]) => (
              <div key={dateStr} className="space-y-6">
                <div className="flex items-center gap-4">
                  <h2 className="font-display text-[18px] font-semibold text-[#F5F5F7]">
                    {formatDateHeader(dateStr)}
                  </h2>
                  <div className="h-px flex-1 bg-[#2A2A2E]" />
                </div>

                <div className="space-y-3">
                  {dateNotifications.map((notification) => {
                    const styles = getUrgencyStyles(
                      notification.escalation_level,
                    );
                    const categoryStyles = getCategoryStyles(
                      notification.notification_category,
                    );
                    const isExplaining = explainingId === notification.id;
                    return (
                      <div
                        key={notification.id}
                        className={`group flex items-start gap-5 border-l-4 ${styles.border} bg-[#1C1C1F] p-5 transition-all hover:bg-[#232327] ${
                          notification.status === "READ" ? "opacity-60" : ""
                        }`}
                      >
                        <div className="mt-1 shrink-0">{styles.icon}</div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-[15px] font-semibold text-[#F5F5F7]">
                              {notification.title}
                            </h3>
                            <span className="shrink-0 text-[12px] text-[#8E8E93]">
                              {format(
                                new Date(notification.created_at),
                                "h:mm a",
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-[14px] leading-relaxed text-[#C7C7CC]">
                            {notification.body || notification.message}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div
                              className="flex items-center gap-1.5 rounded-full bg-[#141416] px-2.5 py-1 text-[11px] font-medium"
                              style={{ color: categoryStyles.color }}
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: categoryStyles.color }}
                              />
                              {categoryStyles.label}
                            </div>

                            {notification.recommended_action && (
                              <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#F5F5F7]">
                                <CheckCircle className="h-3.5 w-3.5 text-[#3F8F68]" />
                                {notification.recommended_action}
                              </div>
                            )}
                          </div>

                          {isExplaining && (
                            <div className="mt-4 rounded-[8px] border border-[#2A2A2E] bg-[#141416] p-4 text-[13px] leading-relaxed text-[#C7C7CC]">
                              {explainAlertMutation.isPending ? (
                                <p className="animate-pulse text-[#8E8E93]">
                                  {t("workspace.notifications.explainLoading")}
                                </p>
                              ) : (
                                <p>{explainAlertMutation.data?.message.content}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {notification.branch && (
                            <button
                              onClick={() => {
                                setExplainingId(notification.id);
                                explainAlertMutation.mutate({
                                  branch_id: notification.branch as string,
                                  topic: `${notification.title}: ${notification.body || notification.message}`,
                                });
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8E8E93] hover:bg-[#2A2A2E] hover:text-[#A8821F]"
                              title={t("workspace.notifications.explain")}
                            >
                              <Sparks className="h-4 w-4" />
                            </button>
                          )}
                          {notification.status === "UNREAD" && (
                            <button
                              onClick={() =>
                                markAsReadMutation.mutate({
                                  notification_ids: [notification.id],
                                })
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8E8E93] hover:bg-[#2A2A2E] hover:text-[#3F8F68]"
                              title={t("workspace.notifications.markAsRead")}
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#8E8E93] hover:bg-[#2A2A2E] hover:text-[#3F8F68]"
                            title={t("workspace.notifications.resolve")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
