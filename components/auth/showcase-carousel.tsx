"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { AnalysisMotif, PlanningMotif } from "./showcase-illustrations";

type SlideId = "today" | "analysis" | "planning";

type Slide = {
  id: SlideId;
  photo: { src: string; credit: string };
  /** Shown if the photo fails to load (e.g. the CDN is unreachable). */
  fallback: ReactNode;
};

// Copy lives in lib/i18n/{en,fr}.json under auth.showcase.<id>.{route,headline,pitch}
// — ported from the "PrepIQ Auth - Sign In" design project (claude.ai/design).
//
// Photos are curated Pexels stock (free license, no attribution required —
// credited anyway as a courtesy). Only "today" had a specific photo picked
// in the design; "analysis" and "planning" are this implementation's picks
// against the brief's "visual starting point" for each, swap freely.
const SLIDES: Slide[] = [
  {
    id: "today",
    photo: {
      src: "https://images.nappy.co/photo/8sOvn79NjVA6bryveb6xJ.jpg?width=1920",
      credit: "Photo: nappy.co",
    },
    // No illustration fits "today" specifically; the dark wash + copy alone
    // still reads fine if the photo CDN is ever unreachable.
    fallback: null,
  },
  {
    id: "analysis",
    photo: {
      src: "https://images.pexels.com/photos/6050335/pexels-photo-6050335.jpeg?auto=compress&cs=tinysrgb&w=1600",
      credit: "Photo: Pexels",
    },
    fallback: <AnalysisMotif />,
  },
  {
    id: "planning",
    photo: {
      src: "https://images.pexels.com/photos/19905186/pexels-photo-19905186.jpeg?auto=compress&cs=tinysrgb&w=1600",
      credit: "Photo: Pexels",
    },
    fallback: <PlanningMotif />,
  },
];

const SLIDE_DURATION_MS = 5000;
const TICK_MS = 100;

/**
 * Right-hand showcase panel for /login — desktop only (≥1024px per the auth
 * redesign brief). Purely decorative: a wordless, auto-rotating pitch beside
 * the (unmodified) sign-in form. Marked aria-hidden and its dot controls are
 * removed from the tab order, matching the brief's "short, wordless pitch"
 * framing — nothing here duplicates information that isn't in the product
 * itself once signed in.
 *
 * The ken-burns/rise-in/signal-bar motion is ambient marketing motion, not
 * UI-state feedback, so it intentionally runs longer than DESIGN.md §5's
 * 150–220ms interaction budget — same reasoning as the Today's Brief player
 * exception. `prefers-reduced-motion` still collapses it via the global rule
 * in app/globals.css.
 */
export function ShowcaseCarousel() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((current) => {
        const next = current + TICK_MS;
        if (next >= SLIDE_DURATION_MS) {
          setActive((a) => (a + 1) % SLIDES.length);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  function goTo(index: number) {
    setActive(index);
    setElapsed(0);
  }

  const progress = Math.min(100, (elapsed / SLIDE_DURATION_MS) * 100);

  return (
    <div
      className="relative hidden overflow-hidden bg-surface-1 lg:block lg:h-full"
      aria-hidden="true"
    >
      {SLIDES.map((slide, index) => {
        const isActive = index === active;
        const showPhoto = !photoFailed[slide.id];
        const route = t(`auth.showcase.${slide.id}.route`);
        const headline = t(`auth.showcase.${slide.id}.headline`);
        const pitch = t(`auth.showcase.${slide.id}.pitch`);

        return (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-[1100ms] ease-out"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                animation: isActive ? "auth-kenburns 6s ease-out forwards" : "none",
              }}
            >
              {showPhoto ? (
                <>
                  <Image
                    src={slide.photo.src}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="50vw"
                    className="object-cover"
                    onError={() =>
                      setPhotoFailed((current) => ({ ...current, [slide.id]: true }))
                    }
                  />
                  <span className="absolute bottom-3 right-4 z-[4] font-mono text-[10px] text-text-primary/50">
                    {slide.photo.credit}
                  </span>
                </>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,var(--color-surface-3)_0%,var(--color-surface-1)_65%)]">
                  {slide.fallback}
                </div>
              )}
            </div>

            {/* readability wash + brand-color glows, matching the design's overlay stack */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-surface-1) 15%, transparent) 0%, color-mix(in srgb, var(--color-surface-1) 10%, transparent) 40%, color-mix(in srgb, var(--color-surface-1) 97%, transparent) 92%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 15% 0%, color-mix(in srgb, var(--color-brand-gold) 18%, transparent), transparent 55%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 100% 100%, color-mix(in srgb, var(--color-status-info) 14%, transparent), transparent 60%)",
              }}
            />

            <div
              className="absolute left-14 right-14 bottom-24 z-[3]"
              style={{
                animation: isActive
                  ? "auth-rise-in 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both"
                  : "none",
              }}
            >
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-brand-gold/35 bg-brand-gold/10 py-1.5 pl-2.5 pr-3.5">
                <span className="flex h-2.5 items-end gap-[2px]">
                  <span
                    className="h-[40%] w-[3px] rounded-[1px] bg-brand-gold-hover"
                    style={{ animation: "auth-signal-bar 1.1s ease-in-out infinite" }}
                  />
                  <span
                    className="h-[70%] w-[3px] rounded-[1px] bg-brand-gold-hover"
                    style={{ animation: "auth-signal-bar 1.1s ease-in-out 0.15s infinite" }}
                  />
                  <span
                    className="h-full w-[3px] rounded-[1px] bg-brand-gold-hover"
                    style={{ animation: "auth-signal-bar 1.1s ease-in-out 0.3s infinite" }}
                  />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-brand-gold-hover">
                  {route}
                </span>
              </div>
              <h2 className="mb-4 max-w-[16ch] text-balance font-display text-[44px] font-extrabold leading-[1.08] tracking-[-0.035em] text-text-primary">
                {headline}
              </h2>
              <p className="max-w-[38ch] text-[15.5px] leading-relaxed text-text-secondary">
                {pitch}
              </p>
            </div>
          </div>
        );
      })}

      <div className="absolute left-12 top-10 z-[3] font-mono text-xs tracking-wide text-text-secondary">
        <span className="font-bold text-brand-gold-hover">
          {String(active + 1).padStart(2, "0")}
        </span>
        <span className="opacity-50"> / {String(SLIDES.length).padStart(2, "0")}</span>
      </div>

      <div className="absolute bottom-9 left-12 right-12 z-[3] flex gap-2.5">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(index)}
            className="h-[3px] flex-1 overflow-hidden rounded-sm bg-text-primary/20"
          >
            <div
              className="h-full rounded-sm bg-brand-gold"
              style={{
                width: `${index === active ? progress : index < active ? 100 : 0}%`,
                transition: index === active ? "none" : "width 0.3s ease",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
