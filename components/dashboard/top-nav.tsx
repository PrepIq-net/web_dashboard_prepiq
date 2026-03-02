"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Bell, LogOut, NavArrowDown, Search, User } from "iconoir-react";
import {
  useCurrentUserProfile,
  useMarkNotificationsAsRead,
  useNotifications,
  useSessionLogoutUser,
} from "@/services";

const TopNavComponent = memo(function DashboardTopNav() {
  const { data: user } = useCurrentUserProfile();
  const notificationsQuery = useNotifications();
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
            Dashboard
          </p>
          <h1 className="mt-1 font-display text-[30px] font-semibold leading-[38px] text-[#F5F5F7]">
            Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <label className="relative min-w-[220px] flex-1 lg:min-w-[340px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
            <input
              type="text"
              placeholder="Search reports, branches, settings..."
              className="h-10 w-full rounded-[8px] bg-[#232327] pl-9 pr-3 text-[13px] text-[#F5F5F7] placeholder:text-[#8E8E93] focus:outline-none focus:ring-1 focus:ring-[#A8821F]"
            />
          </label>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label="Notifications"
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
                    Notifications
                  </p>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-[#A8821F] hover:text-[#D2A53A]"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {notificationsQuery.isLoading ? (
                    <p className="py-2 text-[12px] text-[#8E8E93]">
                      Loading notifications...
                    </p>
                  ) : notifications.length ? (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() =>
                          markAsReadMutation.mutate({
                            notification_ids: [notification.id],
                          })
                        }
                        className="w-full border-b border-[#2A2A2E] px-0.5 py-2 text-left last:border-b-0"
                      >
                        <p className="text-[12px] text-[#F5F5F7]">
                          {notification.title || "Notification"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8E8E93]">
                          {notification.body ||
                            notification.message ||
                            "No details available."}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="space-y-2 py-2">
                      <p className="text-[12px] text-[#C7C7CC]">
                        No new notifications.
                      </p>
                      <p className="text-[11px] text-[#8E8E93]">
                        You will see forecast, supplier, and compliance alerts
                        here.
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
              <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <div className="border-b border-[#2A2A2E] pb-3">
                  <p className="text-[13px] font-medium text-[#F5F5F7]">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8E8E93]">
                    {user?.email}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#A8821F]">
                    {user?.organization_role || "Member"}
                  </p>
                </div>
                <div className="mt-3 space-y-1">
                  <Link
                    href="/workspace/settings"
                    className="flex items-center gap-2 rounded-[8px] px-2 py-2 text-[12px] text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7]"
                    onClick={() => setAvatarMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profile & Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="w-full rounded-[8px] px-2 py-2 text-left text-[12px] text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7] inline-flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {logoutMutation.isPending ? "Signing out..." : "Sign out"}
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
