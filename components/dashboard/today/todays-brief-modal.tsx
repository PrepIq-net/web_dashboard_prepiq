"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Pause, Play, Restart, Xmark } from "iconoir-react";

import { useTranslation } from "@/lib/i18n";
import { useModalBehaviour } from "@/components/ui/use-modal-behaviour";
import type { MorningBriefVoice } from "@/services/assistant/types";
import { BriefVisualizer } from "./brief-visualizer";

type TodaysBriefModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  brief: MorningBriefVoice | null;
  error: string | null;
  /** Shared-element id linking the trigger button to this panel. */
  layoutId: string;
  /** Offered when a brief has text but no playable audio. */
  onGenerate?: () => void;
  generating?: boolean;
};

const SPEEDS = [1, 1.25] as const;

export function TodaysBriefModal({
  open,
  onClose,
  loading,
  brief,
  error,
  layoutId,
  onGenerate,
  generating = false,
}: TodaysBriefModalProps) {
  const { t } = useTranslation();
  const { mounted } = useModalBehaviour(open, onClose);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [currentMs, setCurrentMs] = useState(0);
  const [actualDurationMs, setActualDurationMs] = useState<number | null>(null);

  const track = brief?.audio ?? null;
  const sections = useMemo(() => brief?.script.sections ?? [], [brief]);

  /**
   * Section offsets arrive either measured (the engine reported sentence
   * boundaries) or apportioned by character count. Estimates are anchored to a
   * guessed total, so once the element reports its real duration we scale them
   * onto it — otherwise the highlight drifts further out of step the longer the
   * brief runs. Measured timings are already true and are left alone.
   */
  const timedSections = useMemo(() => {
    if (!brief || !sections.length) return [];
    const reported = brief.script.timings_estimated
      ? sections[sections.length - 1]?.end_ms ?? 0
      : 0;
    if (!brief.script.timings_estimated || !actualDurationMs || !reported) {
      return sections;
    }
    const scale = actualDurationMs / reported;
    return sections.map((section) => ({
      ...section,
      start_ms: Math.round(section.start_ms * scale),
      end_ms: Math.round(section.end_ms * scale),
    }));
  }, [brief, sections, actualDurationMs]);

  const activeIndex = useMemo(() => {
    if (!playing && currentMs === 0) return -1;
    return timedSections.findIndex(
      (section) => currentMs >= section.start_ms && currentMs < section.end_ms,
    );
  }, [timedSections, currentMs, playing]);

  const totalMs =
    actualDurationMs ?? track?.duration_ms ?? timedSections[timedSections.length - 1]?.end_ms ?? 0;
  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  // Reset transport state whenever a different brief is loaded, so reopening
  // never resumes a stale position.
  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
    setActualDurationMs(null);
  }, [brief?.id]);

  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, brief?.id]);

  // Move focus into the panel on open so keyboard and screen-reader users are
  // not left behind on the page underneath.
  useEffect(() => {
    if (open && mounted) panelRef.current?.focus();
  }, [open, mounted]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      void audio.play();
    } else {
      audio.pause();
    }
  }, [speed]);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentMs(0);
    audio.playbackRate = speed;
    void audio.play();
  }, [speed]);

  const seekTo = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    setCurrentMs(ms);
  }, []);

  if (!open || !mounted) return null;

  const hasAudio = Boolean(track?.url);

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        <motion.div
          key="brief-backdrop"
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            layoutId={layoutId}
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("today.briefAudio.title")}
            className="w-full max-w-xl overflow-hidden rounded-modal border border-surface-4 bg-surface-2 shadow-2xl outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-surface-4 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t("today.briefAudio.eyebrow")}
                </p>
                <h2 className="font-display text-lg text-text-primary">
                  {t("today.briefAudio.title")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("today.briefAudio.close")}
                className="rounded-button p-2 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-gold"
              >
                <Xmark width="1.1em" height="1.1em" strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-6 py-6">
              {loading ? (
                <BriefPreparing message={t("today.briefAudio.preparing")} />
              ) : error ? (
                <p className="text-sm text-text-secondary">{error}</p>
              ) : brief ? (
                <>
                  {/* No track means nothing to visualise; an empty waveform
                      panel would just be dead space above the transcript. */}
                  {hasAudio ? (
                    <BriefVisualizer
                      audioRef={audioRef}
                      playing={playing}
                      progress={progress}
                    />
                  ) : null}

                  {hasAudio ? (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={
                          playing
                            ? t("today.briefAudio.pause")
                            : t("today.briefAudio.play")
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-button bg-brand-gold text-surface-1 transition-colors hover:bg-brand-gold-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                      >
                        {playing ? (
                          <Pause width="1.2em" height="1.2em" strokeWidth={1.5} />
                        ) : (
                          <Play width="1.2em" height="1.2em" strokeWidth={1.5} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={replay}
                        aria-label={t("today.briefAudio.replay")}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-surface-4 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-gold"
                      >
                        <Restart width="1.2em" height="1.2em" strokeWidth={1.5} />
                      </button>

                      <span className="ml-1 font-mono text-xs tabular-nums text-text-muted">
                        {formatMs(currentMs)} / {formatMs(totalMs)}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setSpeed((current) =>
                            current === SPEEDS[0] ? SPEEDS[1] : SPEEDS[0],
                          )
                        }
                        aria-label={t("today.briefAudio.speed")}
                        className="ml-auto rounded-button border border-surface-4 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-gold"
                      >
                        {speed}&times;
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-surface-3 px-4 py-3">
                      <p className="text-sm text-text-primary">
                        {t("today.briefAudio.unavailable")}
                      </p>
                      {onGenerate ? (
                        <button
                          type="button"
                          onClick={onGenerate}
                          disabled={generating}
                          className="ml-auto inline-flex h-9 items-center gap-2 rounded-button bg-brand-gold px-3.5 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                        >
                          {generating ? (
                            <>
                              <span className="thinking-dot" aria-hidden="true" />
                              {t("today.briefAudio.generating")}
                            </>
                          ) : (
                            t("today.briefAudio.generate")
                          )}
                        </button>
                      ) : null}
                    </div>
                  )}

                  <BriefTranscript
                    sections={timedSections}
                    activeIndex={activeIndex}
                    onSeek={hasAudio ? seekTo : undefined}
                    label={t("today.briefAudio.transcript")}
                  />

                  {track ? (
                    <audio
                      ref={audioRef}
                      src={track.url}
                      preload="metadata"
                      // Required for the analyser: without it a cross-origin
                      // track taints the graph and every bin reads zero.
                      crossOrigin="anonymous"
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                      onTimeUpdate={(event) =>
                        setCurrentMs(event.currentTarget.currentTime * 1000)
                      }
                      onLoadedMetadata={(event) => {
                        const seconds = event.currentTarget.duration;
                        if (Number.isFinite(seconds)) {
                          setActualDurationMs(seconds * 1000);
                        }
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
}

function BriefPreparing({ message }: { message: string }) {
  return (
    <div className="space-y-3">
      <div className="h-16 w-full animate-pulse rounded-card bg-surface-3" />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

function BriefTranscript({
  sections,
  activeIndex,
  onSeek,
  label,
}: {
  sections: { key: string; text: string; start_ms: number }[];
  activeIndex: number;
  onSeek?: (ms: number) => void;
  label: string;
}) {
  return (
    <div className="mt-6 border-t border-surface-4 pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {sections.map((section, index) => {
          const active = index === activeIndex;
          const content = (
            <p
              className={
                active
                  ? "text-sm font-medium leading-relaxed text-text-primary"
                  : "text-sm leading-relaxed text-text-muted"
              }
            >
              {section.text}
            </p>
          );
          // Seeking makes the transcript a way to navigate rather than just
          // read; without audio there is nothing to seek to.
          return onSeek ? (
            <button
              key={`${section.key}-${index}`}
              type="button"
              onClick={() => onSeek(section.start_ms)}
              className={`block w-full rounded-button px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-gold ${
                active ? "bg-surface-3" : "hover:bg-surface-3/50"
              }`}
            >
              {content}
            </button>
          ) : (
            <div key={`${section.key}-${index}`} className="px-3 py-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
