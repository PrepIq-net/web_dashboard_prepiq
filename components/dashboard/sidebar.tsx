"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Xmark } from "iconoir-react";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { MenuBurgerIcon } from "@/components/dashboard/menu-burger-icon";
import { canAccessDashboard, resolvePermissions } from "@/lib/permissions";
import {
  NAV_PAGES,
  NAV_SECTION_TITLES,
  canSeeNavPage,
} from "@/lib/command/navigation";
import { useTranslation } from "@/lib/i18n";
import type { UserProfile } from "@/services/users/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
  /** One-liner shown as a hover/focus tooltip. Omitted for self-evident pages. */
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Gap between the rail's right edge and the flyout. */
const FLYOUT_GUTTER = 10;

/**
 * Pointer dwell before a flyout opens. Without it, dragging the cursor down
 * the list strobes one panel per item; 120ms is under the ~200ms that reads as
 * lag but long enough that a pass-through never fires.
 */
const FLYOUT_DELAY_MS = 120;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flyout, setFlyout] = useState<{ top: number; left: number } | null>(null);

  // Collapsed items render no label at all, so the flyout is their only
  // affordance — it has to open for every item, not just the ones that
  // happen to carry a description.
  const hasFlyout = collapsed || Boolean(item.description);
  const open = flyout !== null;

  // Positioned with `fixed` + coordinates read off the anchor, rather than a
  // plain CSS `absolute` panel: the nav list scrolls (`overflow-y-auto`),
  // which forces `overflow-x` to `auto` too per the CSS overflow spec — an
  // absolutely-positioned flyout popping out past the rail would get silently
  // clipped by its own scroll container.
  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!hasFlyout || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    // Measured off the rail, not the link. Expanded links stop short of the
    // rail's edge, so anchoring to the link would park the flyout at a
    // different gutter in each state.
    const railRight =
      anchor.closest("aside")?.getBoundingClientRect().right ?? rect.right;
    setFlyout({
      top: rect.top + rect.height / 2,
      left: railRight + FLYOUT_GUTTER,
    });
  }, [hasFlyout]);

  const close = useCallback(() => {
    if (dwellRef.current) {
      clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
    setFlyout(null);
  }, []);

  function handleEnter() {
    if (!hasFlyout || dwellRef.current) return;
    dwellRef.current = setTimeout(() => {
      dwellRef.current = null;
      place();
    }, FLYOUT_DELAY_MS);
  }

  // Keyboard focus skips the dwell — arrowing through the rail is deliberate,
  // never a pass-through.
  function handleFocus() {
    place();
  }

  useEffect(() => close, [close]);

  // Keep the panel on screen: an item near the bottom of a scrolled rail would
  // otherwise centre its flyout half below the fold. Measured after paint
  // rather than in a layout effect (which warns during SSR); the correction
  // lands inside the entrance animation, so it is not visible.
  useEffect(() => {
    const el = flyoutRef.current;
    if (!el || !flyout) return;
    const half = el.offsetHeight / 2;
    const clamped = Math.min(
      Math.max(flyout.top, 8 + half),
      window.innerHeight - 8 - half,
    );
    if (clamped !== flyout.top) setFlyout({ ...flyout, top: clamped });
  }, [flyout]);

  // Any scroll or resize invalidates coordinates captured off the anchor.
  // Capture phase, because the nav list scrolls, not the window.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={close}
      onFocus={handleFocus}
      onBlur={close}
    >
      <Link
        ref={anchorRef}
        href={item.href}
        scroll={false}
        onClick={onNavigate}
        className={`group relative flex w-full items-center rounded-lg text-sm font-medium transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] ${FOCUS_RING}
          ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}
          ${
            active
              ? "bg-surface-2 text-text-primary shadow-[var(--shadow-level-1)]"
              : "text-text-secondary hover:bg-surface-2/60 hover:text-text-primary"
          }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold" />
        )}
        <span
          className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)]
            ${
              active
                ? "bg-surface-3 text-brand-gold"
                : "bg-surface-2 text-text-muted group-hover:text-text-secondary"
            }`}
        >
          {item.icon}
        </span>
        {!collapsed && (
          <span className="truncate tracking-[-0.01em]">{item.label}</span>
        )}
      </Link>

      {/* Flyout — always beside the rail, never below the item. Sitting under
          the link meant the panel covered the next two entries, so aiming at
          them required waiting the tooltip out. */}
      {flyout && (
        <div
          ref={flyoutRef}
          role="tooltip"
          style={{ top: flyout.top, left: flyout.left }}
          className="pointer-events-none fixed z-30 -translate-y-1/2"
        >
          <div className="animate-step-forward w-60 rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 shadow-[var(--shadow-level-2)]">
            {collapsed && (
              <p className="text-[13px] font-semibold leading-tight text-text-primary">
                {item.label}
              </p>
            )}
            {item.description && (
              <p
                className={`text-xs leading-relaxed text-text-secondary ${collapsed ? "mt-1" : ""}`}
              >
                {item.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const MemoizedSidebarLink = memo(SidebarLink);

// ─────────────────────────────────────────────────────────────────────────────
// Main sidebar
// ─────────────────────────────────────────────────────────────────────────────

/** True once the viewport is wide enough for the fixed rail. Below that the
 *  same markup becomes the mobile overlay drawer — expanded, labelled, and
 *  translated out of view until the hamburger asks for it.
 *
 *  `useSyncExternalStore` rather than state + effect: the server snapshot
 *  renders the desktop rail in SSR HTML, and the client reads the real
 *  viewport on the very first render — no collapsed-rail flash on phones. */
function subscribeToDesktopBreakpoint(callback: () => void) {
  const mql = window.matchMedia("(min-width: 1024px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function useDesktopMediaQuery() {
  return useSyncExternalStore(
    subscribeToDesktopBreakpoint,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

export const DashboardSidebar = memo(function DashboardSidebarInner({
  user,
}: {
  user?: UserProfile | null;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarState();
  const isDesktop = useDesktopMediaQuery();
  // The mobile drawer is always expanded: the collapse rail is a desktop
  // affordance, and a drawer of bare icons on a phone would be unusable.
  const effectiveCollapsed = isDesktop ? collapsed : false;

  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  // Escape closes the drawer; body scroll locks while it is open so the
  // page underneath stops moving behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, setMobileOpen]);

  const permissions = resolvePermissions(user);

  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  function isActive(href: string) {
    const norm = href.endsWith("/") && href !== "/" ? href.slice(0, -1) : href;
    return normalizedPath === norm;
  }

  const visibleSections = useMemo(
    (): NavSection[] =>
      NAV_SECTION_TITLES.map((section) => ({
        title: t(section.titleKey),
        items: NAV_PAGES.filter(
          (page) =>
            page.sectionKey === section.key && canSeeNavPage(page, permissions),
        ).map((page) => ({
          label: t(page.labelKey),
          href: page.href,
          icon: <page.icon className="h-4 w-4" />,
          permission: page.permission,
          description: page.descriptionKey ? t(page.descriptionKey) : undefined,
        })),
      })).filter((section) => section.items.length > 0),
    [permissions, t],
  );

  // The logo is a "go home" affordance, so it has to honour the same rule as
  // the nav entry — pointing everyone at /workspace/dashboard sent operational
  // staff to a page that immediately redirects them back out.
  const homeHref = canAccessDashboard(permissions)
    ? "/workspace/dashboard"
    : "/workspace/today";

  // Org logo — use organization_logo if set, else fall back to app logo
  const orgLogo = user?.organization_logo ?? null;

  const logoMark = orgLogo ? (
    <Image
      src={orgLogo}
      alt={user?.organization_name ?? "Organization"}
      width={24}
      height={24}
      className="h-6 w-6 rounded-lg object-cover"
    />
  ) : (
    <Image
      src="/logo/golden-main-transparent.png"
      alt="PrepIQ"
      width={22}
      height={22}
      className="h-[22px] w-[22px] object-contain"
      priority
    />
  );

  const logoTile =
    "inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-surface-3 to-surface-2 shadow-[var(--shadow-level-1)]";

  return (
    <>
      {/* Mobile backdrop. Clicking it closes the drawer; it only exists
          below `lg` where the rail is replaced by the overlay. */}
      {mobileOpen ? (
        <div
          aria-hidden="true"
          onClick={closeMobile}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        // Hook for the impersonation bar: being `fixed` this element ignores the
        // body padding that insets everything else, so globals.css moves it down
        // by the bar's height. See components/impersonation-banner.tsx.
        data-app-chrome="sidebar"
        // `lg:translate-none` matters: Tailwind v4's translate utilities drive
        // the CSS `translate` property (not `transform`), so `transform-none`
        // would not cancel the drawer offset. `translate: none` both restores
        // the rail and avoids a lingering stacking context at desktop sizes,
        // which would trap the nav flyouts inside the rail's z-order and make
        // them paint under the page content.
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-surface-2 bg-surface-1 transition-[width,translate] duration-[var(--motion-duration-standard)] ease-[var(--motion-ease-standard)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-none"
        } w-72 max-w-[85vw] ${effectiveCollapsed ? "lg:w-20" : "lg:w-60"}`}
        inert={!isDesktop && !mobileOpen ? true : undefined}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="border-b border-surface-2 px-4 py-5">
          {effectiveCollapsed ? (
            // Collapsed, the logo tile *is* the toggle: it cross-fades into the
            // burger on hover. The previous build floated a separate 28px button
            // at `right-0` of an 80px rail, which landed it half on top of the
            // centred logo. Home stays one click away on the nav entry below.
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                aria-expanded={false}
                className={`group relative ${logoTile} transition-shadow duration-[var(--motion-duration-standard)] ease-[var(--motion-ease-standard)] hover:shadow-[var(--shadow-level-3)] active:scale-95 ${FOCUS_RING}`}
              >
                <span className="absolute inset-0 flex items-center justify-center transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] group-hover:scale-75 group-hover:opacity-0 group-focus-visible:scale-75 group-focus-visible:opacity-0">
                  {logoMark}
                </span>
                <span className="absolute inset-0 flex scale-75 items-center justify-center text-text-secondary opacity-0 transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] group-hover:scale-100 group-hover:text-text-primary group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                  <MenuBurgerIcon className="h-4 w-4" />
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href={homeHref}
                onClick={closeMobile}
                className={`inline-flex min-w-0 flex-1 items-center gap-3 rounded-xl ${FOCUS_RING}`}
              >
                <span className={logoTile}>{logoMark}</span>
                <span className="truncate font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
                  {user?.organization_name ?? "PrepIQ"}
                </span>
              </Link>

              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                aria-expanded
                className={`group hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-2 text-text-muted transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:bg-surface-3 hover:text-text-primary active:scale-95 lg:inline-flex ${FOCUS_RING}`}
              >
                <MenuBurgerIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={closeMobile}
                aria-label={t("sidebar.closeMenu")}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-2 text-text-muted transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:bg-surface-3 hover:text-text-primary active:scale-95 lg:hidden"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Role pill */}
          {!effectiveCollapsed && user?.organization_role && (
            <div className="mt-3 px-1">
              <span className="inline-block rounded-md bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {user.organization_role}
              </span>
            </div>
          )}
        </div>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <div
          className={`flex-1 overflow-y-auto py-4 scrollbar-thin
            ${effectiveCollapsed ? "px-2" : "px-3"}`}
        >
          {visibleSections.map((section, index) => (
            <div
              key={section.title}
              className={index === 0 ? "mb-4" : "mb-4 border-t border-surface-2 pt-4"}
            >
              {!effectiveCollapsed && (
                <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-text-muted/70">
                  {section.title}
                </p>
              )}
              <nav className="space-y-0.5">
                {section.items.map((item) => (
                  <MemoizedSidebarLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={effectiveCollapsed}
                    onNavigate={closeMobile}
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* ── User identity footer ────────────────────────────────────────── */}
        {user && (
          <div className="border-t border-surface-2 p-3">
            {effectiveCollapsed ? (
              <Link
                href="/workspace/profile"
                title="My Profile"
                onClick={closeMobile}
                className={`flex justify-center rounded-full transition-opacity duration-[var(--motion-duration-fast)] hover:opacity-80 ${FOCUS_RING}`}
              >
                <div className="flex h-8 w-8 select-none items-center justify-center rounded-full border border-surface-4 bg-surface-3 text-[11px] font-semibold text-text-muted">
                  {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
                </div>
              </Link>
            ) : (
              <Link
                href="/workspace/profile"
                onClick={closeMobile}
                className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-[var(--motion-duration-fast)] hover:bg-surface-2/60 ${FOCUS_RING}`}
              >
                <div className="flex h-7 w-7 flex-shrink-0 select-none items-center justify-center rounded-full border border-surface-4 bg-surface-3 text-[11px] font-semibold text-text-muted">
                  {user.first_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium leading-tight text-text-primary transition-colors group-hover:text-brand-gold">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] leading-tight text-text-muted">
                    {user.email}
                  </p>
                </div>
              </Link>
            )}
          </div>
        )}
      </aside>
    </>
  );
});
