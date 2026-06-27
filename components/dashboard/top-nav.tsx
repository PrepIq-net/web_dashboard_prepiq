"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Bell, LogOut, NavArrowDown, Search, ProfileCircle, Settings } from "iconoir-react";
import {
  useCurrentUserProfile,
  useMarkNotificationsAsRead,
  useNotifications,
  useSessionLogoutUser,
} from "@/services";
import { useTranslation } from "@/lib/i18n";

const TopNavComponent = memo(function DashboardTopNav() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const notificationsQuery = useNotifications({
    status: "UNREAD",
    is_today: true,
    limit: 10,
  });
  const markAsReadMutation = useMarkNotificationsAsRead();
  const logoutMutation = useSessionLogoutUser();
  const router = useRouter();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);

  const notifications = notificationsQuery.data ?? [];
  const unreadNotifications = notifications.filter(
    (notification) => notification.status === "UNREAD",
  );

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    const target = event.target as Node;

    if (
      notificationsRef.current &&
      !notificationsRef.current.contains(target)
    ) {
      setNotificationsOpen(false);
    }
    if (avatarRef.current && !avatarRef.current.contains(target)) {
      setAvatarMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [handleOutsideClick]);

  const handleMarkAllRead = () => {
    markAsReadMutation.mutate({});
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setAvatarMenuOpen(false);
        router.replace("/login");
      },
      onError: () => {
        setAvatarMenuOpen(false);
        router.replace("/login");
      },
    });
  };

  return (
    <div className="mb-10 -mx-2 border-b border-[#2A2A2E] px-2 pb-5 sm:-mx-4 sm:px-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("dashboard.overview.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-[30px] font-semibold leading-[38px] text-[#F5F5F7]">
            {t("dashboard.overview.title")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <label className="relative min-w-[220px] flex-1 lg:min-w-[340px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
            <input
              type="text"
              placeholder={t("dashboard.topNav.searchPlaceholder")}
              className="h-10 w-full rounded-[8px] bg-[#232327] pl-9 pr-3 text-[13px] text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
            />
          </label>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label={t("dashboard.topNav.notifications")}
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#232327] text-[#C7C7CC] transition-colors duration-150 hover:bg-[#2A2A2E] hover:text-[#F5F5F7]"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications.length ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A8821F] px-1 text-[10px] font-semibold text-[#141416]">
                  {unreadNotifications.length > 9
                    ? "9+"
                    : unreadNotifications.length}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-[360px] rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                    {t("dashboard.topNav.notifications")}
                  </p>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-[#A8821F] hover:text-[#D2A53A]"
                  >
                    {t("dashboard.topNav.markAllRead")}
                  </button>
                </div>
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {notificationsQuery.isLoading ? (
                    <p className="py-2 text-[12px] text-[#8E8E93]">
                      {t("common.loading")}
                    </p>
                  ) : notifications.length ? (
                    <>
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            markAsReadMutation.mutate({
                              notification_ids: [notification.id],
                            })
                          }
                          className="group w-full border-b border-[#2A2A2E] px-1 py-2.5 text-left transition-colors hover:bg-[#232327] last:border-b-0"
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                notification.escalation_level === "CRITICAL"
                                  ? "bg-[#FF3B30]"
                                  : notification.escalation_level === "WARNING"
                                    ? "bg-[#FFCC00]"
                                    : notification.escalation_level === "INFO"
                                      ? "bg-[#34C759]"
                                      : "bg-[#8E8E93]"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-[#F5F5F7]">
                                {notification.title || "Notification"}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#8E8E93] group-hover:text-[#C7C7CC]">
                                {notification.body ||
                                  notification.message ||
                                  "No details available."}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      <div className="pt-2">
                        <Link
                          href="/workspace/notifications"
                          onClick={() => setNotificationsOpen(false)}
                          className="flex w-full items-center justify-center rounded-[6px] bg-[#232327] py-2 text-[11px] font-medium text-[#A8821F] transition-colors hover:bg-[#2A2A2E] hover:text-[#D2A53A]"
                        >
                          {t("dashboard.topNav.viewAllNotifications")}
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 py-4 text-center">
                      <p className="text-[12px] text-[#C7C7CC]">
                        {t("dashboard.topNav.noAlertsToday")}
                      </p>
                      <p className="mx-auto max-w-[200px] text-[11px] leading-relaxed text-[#8E8E93]">
                        {t("dashboard.topNav.alertsDescription")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={avatarRef}>
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#232327] pl-2 pr-2.5 text-left transition-colors duration-150 hover:bg-[#2A2A2E]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-gold/20 text-brand-gold">
                <span className="text-[11px] font-semibold">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </span>
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[120px] truncate text-[12px] font-medium text-[#F5F5F7]">
                  {user?.first_name} {user?.last_name}
                </p>
              </div>
              <NavArrowDown
                className={`h-4 w-4 text-[#8E8E93] transition-transform ${
                  avatarMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {avatarMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-[#2E2E33] bg-[#1C1C1F] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Identity header */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2A2A2E]">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold font-semibold text-[13px] select-none">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#F5F5F7]">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="truncate text-[11px] text-[#8E8E93] mt-0.5">
                      {user?.email}
                    </p>
                    {user?.organization_role && (
                      <span className="mt-1.5 inline-block rounded-md bg-brand-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-gold">
                        {user.organization_role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2">
                  <Link
                    href="/workspace/profile"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7] transition-colors"
                  >
                    <ProfileCircle className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                    <span>{t("dashboard.topNav.myProfile")}</span>
                  </Link>
                  <Link
                    href="/workspace/settings"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7] transition-colors"
                  >
                    <Settings className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                    <span>{t("dashboard.topNav.workspaceSettings")}</span>
                  </Link>
                </div>

                {/* Sign out — separated */}
                <div className="border-t border-[#2A2A2E] p-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-[#8E8E93] hover:bg-[#2A2A2E] hover:text-[#C44949] transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>{logoutMutation.isPending ? t("dashboard.topNav.signingOut") : t("dashboard.topNav.signOut")}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

export { TopNavComponent as DashboardTopNav };
