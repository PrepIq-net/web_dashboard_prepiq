"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "iconoir-react";
import { toast } from "react-hot-toast";
import { ModalShell } from "@/components/ui/modal-shell";
import { useTranslation } from "@/lib/i18n";
import { useWebPush } from "@/services/notifications/web-push";

const DISMISSED_KEY = "prepiq.push-primer-dismissed";

/**
 * Single source of truth for the push opt-in ask, used in two surfaces:
 *
 *  - "auto" (Today): opens itself once, unprompted, the first time there's
 *    nothing decided yet. Clicking "Remind me later" closes it and stops it
 *    auto-opening again (localStorage flag, shared with "link" below) — that
 *    never blocks enabling later.
 *  - "link" (notifications dropdown, /workspace/notifications, Settings):
 *    renders nothing but a small text nudge that opens the exact same modal
 *    on click. Never auto-opens — this is how "remind me later" gets a
 *    second chance without nagging on every page load.
 *
 * Content branches on the real browser permission, not just "have we asked":
 * once actually denied, offering "Enable" again is a dead end (the browser
 * won't re-prompt — only the user, from their own site settings, can undo
 * it), so that state shows the steps instead.
 */
export function PushPrimingModal({ surface }: { surface: "auto" | "link" }) {
  const { t } = useTranslation();
  const { permission, isEnabling, enable, isSupported, isGranted, canPrompt } =
    useWebPush();
  const [remindLater, setRemindLater] = useState(true);
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    setRemindLater(window.localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const denied = permission === "denied";
  // Nothing left to ask once granted, and nothing to show on browsers that
  // can't receive push at all.
  const eligible = isSupported && !isGranted && (canPrompt || denied);

  useEffect(() => {
    if (surface !== "auto" || autoOpenedRef.current) return;
    if (remindLater || !canPrompt) return;
    autoOpenedRef.current = true;
    setOpen(true);
  }, [surface, remindLater, canPrompt]);

  if (!eligible) return null;

  const handleRemindLater = () => {
    setOpen(false);
    setRemindLater(true);
    window.localStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleEnable = async () => {
    const outcome = await enable();
    if (outcome === "granted") {
      toast.success(t("settings.notifications.webPush.enabled"));
      setOpen(false);
      return;
    }
    if (outcome === "unconfigured") toast.error(t("settings.notifications.webPush.unconfigured"));
    else if (outcome === "denied") toast.error(t("settings.notifications.webPush.denied"));
    else if (outcome === "error") toast.error(t("settings.notifications.webPush.error"));
    // Leave the drawer open — a denied/error outcome flips `permission`, and
    // this re-renders straight into the denied content below rather than
    // making the user reopen it to see what to do next.
  };

  return (
    <>
      {surface === "link" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-brand-gold transition-colors hover:text-brand-gold-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold"
        >
          <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("push.nudge.label")}
        </button>
      ) : null}

      <ModalShell
        open={open}
        title={denied ? t("push.modal.deniedTitle") : t("push.modal.askTitle")}
        description={
          denied ? t("push.modal.deniedDescriptionWeb") : t("push.modal.askDescription")
        }
        onClose={() => setOpen(false)}
        footer={
          denied ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-full border border-brand-gold/45 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
            >
              {t("push.modal.gotIt")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRemindLater}
                className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
              >
                {t("push.modal.remindLater")}
              </button>
              <button
                type="button"
                disabled={isEnabling}
                onClick={handleEnable}
                className="inline-flex h-10 items-center rounded-full border border-brand-gold/45 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEnabling
                  ? t("settings.notifications.webPush.enabling")
                  : t("push.modal.enable")}
              </button>
            </>
          )
        }
      />
    </>
  );
}
