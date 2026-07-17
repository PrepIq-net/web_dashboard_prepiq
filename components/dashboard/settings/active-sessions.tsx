"use client";

import { useState } from "react";
import { Computer, Phone, LogOut } from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { useTranslation } from "@/lib/i18n";
import {
  useLoginSessions,
  useRevokeAllLoginSessions,
  useRevokeLoginSession,
} from "@/services/users/hooks";
import type { LoginSession } from "@/services/users/types";

/**
 * "Active sessions / devices" — lists every place the account is currently
 * signed in and lets the user revoke a specific device or sign out everywhere
 * else. Backed by the Redis session registry (see users/session_store.py):
 * revoking kills that session's access token on its next request.
 */
export function ActiveSessions() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useLoginSessions();
  const revokeOne = useRevokeLoginSession();
  const revokeAll = useRevokeAllLoginSessions();

  const [pendingRevoke, setPendingRevoke] = useState<LoginSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const sessions = data?.sessions ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  function handleRevoke() {
    if (!pendingRevoke) return;
    revokeOne.mutate(pendingRevoke.id, {
      onSuccess: () => {
        toast.success(t("settings.sessions.revoked"));
        setPendingRevoke(null);
      },
      onError: () => toast.error(t("settings.sessions.revokeFailed")),
    });
  }

  function handleRevokeAll() {
    revokeAll.mutate(
      { keep_current: true },
      {
        onSuccess: () => {
          toast.success(t("settings.sessions.signedOutOthers"));
          setRevokeAllOpen(false);
        },
        onError: () => toast.error(t("settings.sessions.revokeFailed")),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {t("settings.sessions.title")}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {t("settings.sessions.subtitle")}
          </p>
        </div>
        {otherCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => setRevokeAllOpen(true)}
            className="shrink-0"
          >
            <LogOut className="h-4 w-4" />
            {t("settings.sessions.signOutOthers")}
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      )}
      {isError && (
        <p className="text-sm text-status-critical">
          {t("settings.sessions.loadFailed")}
        </p>
      )}
      {!isLoading && !isError && sessions.length === 0 && (
        <p className="text-sm text-text-muted">{t("settings.sessions.empty")}</p>
      )}

      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            revokeLabel={t("settings.sessions.revoke")}
            currentLabel={t("settings.sessions.thisDevice")}
            activePrefix={t("settings.sessions.activePrefix")}
            onRevoke={() => setPendingRevoke(session)}
          />
        ))}
      </div>

      <ConfirmActionModal
        open={Boolean(pendingRevoke)}
        title={t("settings.sessions.revokeTitle")}
        description={t("settings.sessions.revokeConfirm", {
          device: pendingRevoke?.device ?? "",
        })}
        confirmLabel={t("settings.sessions.revoke")}
        tone="critical"
        isConfirming={revokeOne.isPending}
        onClose={() => setPendingRevoke(null)}
        onConfirm={handleRevoke}
      />

      <ConfirmActionModal
        open={revokeAllOpen}
        title={t("settings.sessions.signOutOthers")}
        description={t("settings.sessions.signOutOthersConfirm")}
        confirmLabel={t("settings.sessions.signOutOthers")}
        tone="critical"
        isConfirming={revokeAll.isPending}
        onClose={() => setRevokeAllOpen(false)}
        onConfirm={handleRevokeAll}
      />
    </div>
  );
}

function SessionRow({
  session,
  revokeLabel,
  currentLabel,
  activePrefix,
  onRevoke,
}: {
  session: LoginSession;
  revokeLabel: string;
  currentLabel: string;
  activePrefix: string;
  onRevoke: () => void;
}) {
  const isMobile = session.client === "mobile";
  const Icon = isMobile ? Phone : Computer;
  const lastSeen =
    session.last_seen > 0
      ? formatDistanceToNow(new Date(session.last_seen * 1000), {
          addSuffix: true,
        })
      : "";
  const meta = [session.platform, session.ip].filter(Boolean).join(" · ");

  return (
    <div className="rounded-lg border border-surface-4 bg-[#141416] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="text-brand-gold mt-0.5">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              {session.device || (isMobile ? "Mobile app" : "Browser")}
            </h3>
            {session.current && (
              <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 text-xs font-medium text-brand-gold">
                {currentLabel}
              </span>
            )}
          </div>
          {meta && <p className="text-sm text-text-muted mt-1">{meta}</p>}
          {lastSeen && (
            <p className="text-xs text-text-muted mt-1">
              {activePrefix} {lastSeen}
            </p>
          )}
        </div>
      </div>
      {!session.current && (
        <div className="shrink-0">
          <Button variant="ghost" onClick={onRevoke}>
            {revokeLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
