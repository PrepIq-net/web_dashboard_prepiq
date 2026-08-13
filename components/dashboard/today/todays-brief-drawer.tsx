"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Headset, Pause, Play, Restart, Xmark } from "iconoir-react";
import { toast } from "react-hot-toast";

import { useTranslation } from "@/lib/i18n";
import { useModalBehaviour } from "@/components/ui/use-modal-behaviour";
import {
  useCurrentConversation,
  useSendAssistantMessage,
  useStartAssistantConversation,
} from "@/services/assistant/hooks";
import type { AssistantMessage, AssistantReply, MorningBriefVoice } from "@/services/assistant/types";
import type { MorningBrief } from "@/services/production-intelligence/types";
import { BriefVisualizer } from "./brief-visualizer";

const SPEEDS = [1, 1.25] as const;

type TodaysBriefDrawerProps = {
  /** Must match the trigger's layoutId — this is the morph's other half. */
  layoutId: string;
  open: boolean;
  onClose: () => void;
  /** Reopen the drawer from the mini player. */
  onOpen: () => void;
  voiceLoading: boolean;
  brief: MorningBriefVoice | null;
  voiceError: string | null;
  /** Fetch/synthesize the spoken brief. Idempotent; callers guard on loading. */
  onListen: () => void;
  /** Written brief — the read side of the surface. */
  readBrief: MorningBrief | null;
  canAsk: boolean;
  branchId: string | null;
  date: string;
  /** Hand the thread to the full assistant drawer (e.g. to confirm an action). */
  onOpenAssistant: () => void;
  onOpenProvenance: () => void;
};

/**
 * Today's Brief — the single surface for reading and listening.
 *
 * One drawer, two ways in: the header's gold "Today's Brief" trigger and the
 * morning strip's "Open briefing" link both open it. The spoken brief is
 * fetched lazily — reading never triggers synthesis; the drawer's Listen
 * button and the gold trigger do.
 *
 * Playback outlives the drawer. The audio element lives at this component's
 * root, so closing the drawer mid-play keeps the voice going; a floating mini
 * player (bottom-right) carries pause/play, seek, reopen and stop without the
 * drawer. The drawer is always available to listen with the visualizer.
 */

export function TodaysBriefDrawer({
  layoutId,
  open,
  onClose,
  onOpen,
  voiceLoading,
  brief,
  voiceError,
  onListen,
  readBrief,
  canAsk,
  branchId,
  date,
  onOpenAssistant,
  onOpenProvenance,
}: TodaysBriefDrawerProps) {
  const { t } = useTranslation();
  const { mounted } = useModalBehaviour(open, onClose);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // The WebAudio graph belongs here, not to the visualizer: it outlives the
  // drawer so playback survives closing it, and it is created once because
  // createMediaElementSource binds an element for its whole life.
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [currentMs, setCurrentMs] = useState(0);
  const [actualDurationMs, setActualDurationMs] = useState<number | null>(null);
  // The user pressed play at least once. Gates the mini player: it only earns
  // its corner after playback is *their* active state, never on mount.
  const [engaged, setEngaged] = useState(false);
  const [question, setQuestion] = useState("");

  // Inline Q&A: the thread lives in this drawer so asking never interrupts the
  // brief or the playback. The assistant conversation is shared — opening the
  // full assistant drawer later rehydrates the same thread.
  const startConversation = useStartAssistantConversation();
  const sendMessage = useSendAssistantMessage();
  const { data: currentConversation } = useCurrentConversation(branchId ?? undefined, date);
  const [qaThread, setQaThread] = useState<AssistantMessage[]>([]);
  const [qaConversationId, setQaConversationId] = useState<string | null>(null);
  const [qaSending, setQaSending] = useState(false);
  const qaScrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest exchange in view: the thread is short, the input sits
  // directly below it, and nothing in it is worth hunting for.
  useEffect(() => {
    if (qaScrollRef.current) qaScrollRef.current.scrollTop = qaScrollRef.current.scrollHeight;
  }, [qaThread.length, qaSending]);

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
    actualDurationMs ??
    track?.duration_ms ??
    timedSections[timedSections.length - 1]?.end_ms ??
    0;
  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  // Reset transport state whenever a different brief is loaded, so reopening
  // never resumes a stale position.
  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
    setActualDurationMs(null);
  }, [brief?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, brief?.id]);

  // Move focus into the panel on open so keyboard and screen-reader users are
  // not left behind on the page underneath.
  useEffect(() => {
    if (open && mounted) panelRef.current?.focus();
  }, [open, mounted]);

  // Create the graph lazily inside a play gesture: an AudioContext created at
  // mount starts suspended under the browser's autoplay policy and stays that
  // way. The source node is bound to the audio element for its lifetime, so
  // this runs once and the graph lives until the component unmounts — closing
  // the drawer mid-play must not silence the voice.
  const ensureGraph = useCallback((audio: HTMLAudioElement) => {
    if (analyserRef.current) return analyserRef.current;
    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;
      const audioContext = new AudioContextCtor();
      if (audioContext.state === "suspended") void audioContext.resume();
      const source = audioContext.createMediaElementSource(audio);
      const node = audioContext.createAnalyser();
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.7;
      source.connect(node);
      node.connect(audioContext.destination);
      contextRef.current = audioContext;
      sourceRef.current = source;
      analyserRef.current = node;
      setAnalyser(node);
      return node;
    } catch {
      // Cross-origin audio without CORS headers taints the graph. Nothing to
      // recover here — the visualizer's idle canvas covers it.
      return null;
    }
  }, []);

  // Tear the graph down only on unmount (page leave), not on drawer close.
  useEffect(() => {
    return () => {
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();
      void contextRef.current?.close();
      contextRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      ensureGraph(audio);
      audio.playbackRate = speed;
      void audio.play();
      setEngaged(true);
    } else {
      audio.pause();
    }
  }, [speed, ensureGraph]);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    ensureGraph(audio);
    audio.currentTime = 0;
    setCurrentMs(0);
    audio.playbackRate = speed;
    void audio.play();
    setEngaged(true);
  }, [speed, ensureGraph]);

  const seekTo = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(ms, audio.duration * 1000 || ms));
    audio.currentTime = clamped / 1000;
    setCurrentMs(clamped);
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setCurrentMs(0);
    setEngaged(false);
  }, []);

  const hasAudio = Boolean(track?.url);
  const showMiniPlayer = !open && engaged && hasAudio && brief;

  // Rehydrate the day thread from the server when this drawer mounts so a
  // reopened drawer (or one opened after asking in the assistant) keeps the
  // Q&A. Only seed while the local thread is empty so an in-flight ask is
  // never clobbered.
  const currentConv = currentConversation?.conversation ?? null;
  // A branch/date switch belongs to a different day thread — drop the local
  // Q&A so the seeding effect below loads the correct one.
  useEffect(() => {
    setQaConversationId(null);
    setQaThread([]);
  }, [branchId, date]);
  useEffect(() => {
    if (!currentConv) return;
    if (qaConversationId || qaThread.length > 0) return;
    setQaConversationId(currentConv.id);
    setQaThread(currentConversation?.messages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConv?.id]);

  const appendQaReply = (reply: AssistantReply) => {
    setQaConversationId(reply.conversation.id);
    setQaThread((prev) => [...prev, reply.message]);
    setQaSending(false);
    for (const applied of reply.message.applied_actions ?? []) {
      toast.success(applied.summary);
    }
  };

  const submitQuestion = () => {
    const trimmed = question.trim();
    if (!trimmed || qaSending) return;
    if (!branchId) {
      toast.error("Select a branch first.");
      return;
    }
    setQuestion("");
    setQaThread((prev) => [
      ...prev,
      {
        id: `qa-${Date.now()}`,
        role: "user",
        content: trimmed,
        pending_action: null,
        applied_actions: null,
        metadata: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setQaSending(true);
    if (!qaConversationId) {
      startConversation.mutate(
        { branch_id: branchId, date, message: trimmed },
        {
          onSuccess: (reply) => {
            if ("message" in reply) appendQaReply(reply);
          },
          onError: () => {
            setQaSending(false);
            toast.error(t("today.briefDrawer.qaError"));
          },
        },
      );
      return;
    }
    sendMessage.mutate(
      { conversationId: qaConversationId, payload: { message: trimmed, date } },
      {
        onSuccess: appendQaReply,
        onError: () => {
          setQaSending(false);
          toast.error(t("today.briefDrawer.qaError"));
        },
      },
    );
  };

  const watchouts = readBrief?.watchouts ?? [];
  const activeSignals = readBrief?.drivers?.active_signals ?? [];
  const learnedPatterns = readBrief?.drivers?.learned_patterns ?? [];

  return (
    <>
      {/* The audio element outlives the drawer: closing mid-play keeps the
          voice running and the mini player in charge of it. */}
      {track ? (
        <audio
          ref={audioRef}
          src={track.url}
          preload="metadata"
          // Required for the analyser: without it a cross-origin track taints
          // the graph and every bin reads zero.
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

      {mounted ? (
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {open ? (
              <motion.div
                key="brief-backdrop"
                className="fixed inset-0 z-9999 flex justify-end"
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
                  className="flex h-full w-[680px] max-w-[96vw] flex-col overflow-hidden border-l border-surface-4 bg-surface-2 shadow-2xl outline-none"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="flex items-start justify-between gap-4 border-b border-surface-4 px-6 py-5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                        {t("today.briefAudio.eyebrow")}
                      </p>
                      <h2 className="mt-0.5 truncate font-display text-lg text-text-primary">
                        {readBrief?.headline ?? t("today.briefAudio.title")}
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
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                    {/* ── Player block ─────────────────────────────────── */}
                    {voiceLoading && !brief ? (
                      <BriefPreparing message={t("today.briefAudio.preparing")} />
                    ) : !brief && voiceError ? (
                      <div className="space-y-3">
                        <p className="text-sm text-text-secondary">
                          {voiceError}
                        </p>
                        <GenerateButton onClick={onListen} generating={voiceLoading} />
                      </div>
                    ) : !brief ? (
                      <div className="flex items-center gap-3 rounded-card bg-surface-3 px-4 py-3">
                        <Headset
                          width="1.15em"
                          height="1.15em"
                          strokeWidth={1.5}
                          className="shrink-0 text-brand-gold"
                        />
                        <p className="min-w-0 flex-1 text-sm text-text-primary">
                          {t("today.briefAudio.listenHint")}
                        </p>
                        <button
                          type="button"
                          onClick={onListen}
                          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-button bg-brand-gold px-3.5 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                        >
                          <Play width="0.9em" height="0.9em" strokeWidth={1.5} />
                          {t("today.briefAudio.listen")}
                        </button>
                      </div>
                    ) : brief ? (
                      <>
                        {hasAudio ? (
                          <>
                            <BriefVisualizer
                              analyser={analyser}
                              playing={playing}
                              progress={progress}
                            />
                            <div className="mt-2">
                              <BriefSeekBar
                                totalMs={totalMs}
                                currentMs={currentMs}
                                onSeek={seekTo}
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
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
                          </>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-surface-3 px-4 py-3">
                            <p className="text-sm text-text-primary">
                              {t("today.briefAudio.unavailable")}
                            </p>
                            <div className="ml-auto">
                              <GenerateButton
                                onClick={onListen}
                                generating={voiceLoading}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}

                    {/* ── Read-along transcript (spoken brief) ─────────── */}
                    {brief && sections.length > 0 ? (
                      <BriefTranscript
                        sections={timedSections}
                        activeIndex={activeIndex}
                        onSeek={hasAudio ? seekTo : undefined}
                        label={t("today.briefAudio.transcript")}
                      />
                    ) : readBrief?.narrative ? (
                      <p className="mt-6 text-sm leading-relaxed text-text-secondary">
                        {readBrief.narrative}
                      </p>
                    ) : null}

                    {/* ── Read extras (written brief) ──────────────────── */}
                    {watchouts.length > 0 ? (
                      <div className="mt-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {t("today.briefDrawer.watchouts")}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {watchouts.map((watchout) => (
                            <li
                              key={watchout}
                              className="flex items-start gap-2 text-xs text-text-secondary"
                            >
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-status-warning" />
                              {watchout}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {activeSignals.length > 0 ? (
                      <div className="mt-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {t("today.brief.signalsEyebrow")}
                        </p>
                        <ul className="mt-2 space-y-2">
                          {activeSignals.map((signal) => (
                            <li
                              key={`${signal.signal_type}-${signal.name ?? signal.label}`}
                              className="rounded-lg border border-surface-4 bg-surface-3 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-text-primary">
                                  {signal.name && signal.name !== signal.label
                                    ? `${signal.label} · ${signal.name}`
                                    : signal.label}
                                </p>
                                {signal.learned?.delta_pct != null ? (
                                  <span
                                    className={`text-xs font-semibold ${
                                      signal.learned.delta_pct >= 0
                                        ? "text-status-success"
                                        : "text-status-critical"
                                    }`}
                                  >
                                    {signal.learned.delta_pct >= 0 ? "+" : ""}
                                    {signal.learned.delta_pct.toFixed(0)}%
                                  </span>
                                ) : null}
                              </div>
                              {signal.learned && signal.learned.sample_count > 0 ? (
                                <p className="mt-0.5 text-[11px] text-text-muted">
                                  {t("today.brief.learnedTag", {
                                    count: signal.learned.sample_count,
                                  })}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {learnedPatterns.length > 0 ? (
                      <div className="mt-6">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {t("today.briefDrawer.pastLearnings")}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {learnedPatterns.slice(0, 6).map((pattern) => (
                            <li
                              key={`${pattern.signal_type}-${pattern.label}`}
                              className="flex items-start justify-between gap-3 text-xs text-text-secondary"
                            >
                              <span>{pattern.label}</span>
                              {pattern.delta_pct != null ? (
                                <span
                                  className={`shrink-0 font-semibold ${
                                    pattern.delta_pct >= 0
                                      ? "text-status-success"
                                      : "text-status-critical"
                                  }`}
                                >
                                  {pattern.delta_pct >= 0 ? "+" : ""}
                                  {pattern.delta_pct.toFixed(0)}%
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-4/60 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenProvenance();
                        }}
                        className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3"
                      >
                        {t("today.brief.provenanceCta")}
                      </button>
                      <p className="text-[11px] text-text-muted">
                        {readBrief?.generated_by === "llm"
                          ? t("today.brief.llmBadge")
                          : t("today.brief.templateBadge")}
                      </p>
                    </div>
                  </div>

                  {/* ── Ask about this briefing (inline, audio keeps playing) ── */}
                  {canAsk ? (
                    <div className="border-t border-surface-4 px-6 py-4">
                      {qaThread.length > 0 ? (
                        <div
                          ref={qaScrollRef}
                          className="mb-3 max-h-56 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin"
                        >
                          {qaThread.map((message) => (
                            <QaMessage
                              key={message.id}
                              message={message}
                              onOpenAssistant={() => {
                                onClose();
                                onOpenAssistant();
                              }}
                            />
                          ))}
                          {qaSending ? (
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[10px] font-bold text-brand-gold">
                                IQ
                              </span>
                              <span className="flex items-center gap-0.5 rounded-lg bg-surface-3 px-3 py-2">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="h-1 w-1 rounded-full bg-text-muted"
                                    style={{
                                      animation: `thinking-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                                    }}
                                  />
                                ))}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        {t("today.briefDrawer.askEyebrow")}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={question}
                          onChange={(event) => setQuestion(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              submitQuestion();
                            }
                          }}
                          placeholder={t("today.briefDrawer.askPlaceholder")}
                          className="h-9 flex-1 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                        />
                        <button
                          type="button"
                          onClick={submitQuestion}
                          disabled={!question.trim() || qaSending}
                          className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-3.5 text-xs font-semibold text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t("today.briefDrawer.askCta")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </motion.div>
            ) : null}

            {/* ── Mini player: playback without the drawer ─────────────── */}
            {showMiniPlayer ? (
              <motion.div
                key="brief-mini-player"
                className="fixed bottom-24 right-5 z-[10000] w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-surface-4 bg-surface-2 shadow-[var(--shadow-level-2)]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="flex items-center gap-3 px-4 pt-3.5">
                  <button
                    type="button"
                    onClick={onOpen}
                    title={t("today.briefAudio.title")}
                    aria-label={t("today.briefAudio.mini.open")}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-brand-gold transition-colors hover:bg-surface-4 focus-visible:outline-2 focus-visible:outline-brand-gold"
                  >
                    <Headset width="1.1em" height="1.1em" strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    onClick={onOpen}
                    title={t("today.briefAudio.mini.open")}
                    className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-brand-gold"
                  >
                    <p className="truncate text-sm font-medium text-text-primary">
                      {readBrief?.headline ?? t("today.briefAudio.title")}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {t("today.briefAudio.title")}
                    </p>
                  </button>

                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                    {formatMs(currentMs)}
                  </span>
                </div>

                <div className="mt-1 px-4">
                  <BriefSeekBar totalMs={totalMs} currentMs={currentMs} onSeek={seekTo} />
                </div>

                <div className="flex items-center justify-end gap-1.5 px-4 pb-3.5 pt-1">
                  <button
                    type="button"
                    onClick={stopPlayback}
                    aria-label={t("today.briefAudio.mini.stop")}
                    title={t("today.briefAudio.mini.stop")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-gold"
                  >
                    <Xmark width="1em" height="1em" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={
                      playing
                        ? t("today.briefAudio.pause")
                        : t("today.briefAudio.play")
                    }
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-button transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${
                      playing
                        ? "bg-brand-gold text-surface-1 hover:bg-brand-gold-hover"
                        : "border border-surface-4 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                    }`}
                  >
                    {playing ? (
                      <Pause width="1.1em" height="1.1em" strokeWidth={1.5} />
                    ) : (
                      <Play width="1.1em" height="1.1em" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </MotionConfig>
      ) : null}
    </>
  );
}

/** Compact inline Q&A row. Tool turns and spoken-brief cards are skipped;
 * applied writes read as one-line receipts; a pending confirmation hands the
 * thread to the full assistant drawer rather than stalling here. */
function QaMessage({
  message,
  onOpenAssistant,
}: {
  message: AssistantMessage;
  onOpenAssistant: () => void;
}) {
  const { t } = useTranslation();

  if (message.role === "tool" || message.role === "system") return null;
  if (message.metadata?.kind === "morning_brief_audio") return null;

  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-end" : ""}`}>
      {!isUser ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[10px] font-bold text-brand-gold">
          IQ
        </span>
      ) : null}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? "bg-brand-gold/15 text-text-primary"
            : "bg-surface-3 text-text-secondary"
        }`}
      >
        <p className="whitespace-pre-wrap text-xs leading-relaxed">
          {message.content}
        </p>
        {message.applied_actions && message.applied_actions.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {message.applied_actions.map((applied) => (
              <li
                key={applied.action_log_id}
                className="text-[11px] font-medium text-status-success"
              >
                {applied.summary}
              </li>
            ))}
          </ul>
        ) : null}
        {message.pending_action ? (
          <button
            type="button"
            onClick={onOpenAssistant}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-button border border-brand-gold/40 px-2 py-1 text-[11px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 focus-visible:outline-2 focus-visible:outline-brand-gold"
          >
            {t("today.briefDrawer.pendingHint")} —{" "}
            {t("today.briefDrawer.openAssistant")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Thin, click-to-seek scrub bar shared by the drawer and the mini player. */
function BriefSeekBar({
  totalMs,
  currentMs,
  onSeek,
}: {
  totalMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  return (
    <button
      type="button"
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs)}
      aria-valuenow={Math.round(currentMs)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
        onSeek(ratio * totalMs);
      }}
      className="group relative block h-5 w-full cursor-pointer"
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-4" />
      <div
        className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-gold"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </button>
  );
}

function GenerateButton({
  onClick,
  generating,
}: {
  onClick: () => void;
  generating: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={generating}
      className="inline-flex h-9 items-center gap-2 rounded-button bg-brand-gold px-3.5 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      {generating ? (
        <>
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-current"
                style={{ animation: `thinking-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </span>
          {t("today.briefAudio.generating")}
        </>
      ) : (
        t("today.briefAudio.generate")
      )}
    </button>
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