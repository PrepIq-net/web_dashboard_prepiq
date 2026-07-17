"use client";

import { Bell, OpenNewWindow } from "iconoir-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useWebPush } from "@/services/notifications/web-push";

/**
 * Contextual soft-ask for browser push, shown in the Notifications settings tab.
 * Explains *why* before triggering the OS permission prompt. Renders nothing
 * once granted or on browsers that don't support Web Push.
 */
export function WebPushPrimingCard() {
  const { t } = useTranslation();
  const { permission, isEnabling, enable, isSupported, isGranted, canPrompt } =
    useWebPush();

  if (!isSupported || isGranted || permission === "loading") return null;

  const denied = permission === "denied";

  const handleEnable = async () => {
    const outcome = await enable();
    if (outcome === "granted") {
      toast.success(t("settings.notifications.webPush.enabled"));
    } else if (outcome === "unconfigured") {
      toast.error(t("settings.notifications.webPush.unconfigured"));
    } else if (outcome === "denied") {
      toast.error(t("settings.notifications.webPush.denied"));
    } else if (outcome === "error") {
      toast.error(t("settings.notifications.webPush.error"));
    }
  };

  return (
    <div className="rounded-2xl border border-brand-gold/40 bg-[#1C1C1F]/30 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10">
          <Bell className="h-5 w-5 text-brand-gold" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("settings.notifications.webPush.title")}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">
            {t("settings.notifications.webPush.description")}
          </p>

          <div className="mt-4">
            {denied ? (
              <p className="inline-flex items-center gap-2 text-xs text-text-muted">
                <OpenNewWindow className="h-4 w-4" strokeWidth={1.5} />
                {t("settings.notifications.webPush.blocked")}
              </p>
            ) : (
              <Button
                variant="primary"
                onClick={handleEnable}
                disabled={isEnabling || !canPrompt}
                leftIcon={<Bell className="h-4 w-4" strokeWidth={1.5} />}
              >
                {isEnabling
                  ? t("settings.notifications.webPush.enabling")
                  : t("settings.notifications.webPush.enable")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
