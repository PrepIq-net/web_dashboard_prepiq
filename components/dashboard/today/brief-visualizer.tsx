"use client";

import { useEffect, useRef, useState } from "react";

type BriefVisualizerProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playing: boolean;
  /** 0–1. Drives the static bar when motion is reduced or audio is silent. */
  progress: number;
};

const BAR_COUNT = 40;
const FFT_SIZE = 128;

/**
 * Live amplitude readout for the spoken brief.
 *
 * This is the surface holding the media exception in DESIGN.md §5, and it only
 * earns that by being an actual readout: every bar height is a frequency bin
 * off the playing audio, it flatlines the moment playback stops, and it has a
 * static equivalent for anyone who has asked for less motion. There is no
 * easing, no spring, and nothing animating when nothing is playing.
 *
 * Canvas rather than SVG or motion divs: 40 bars at 60fps through React
 * reconciliation would be forty state updates a frame to say one thing.
 */
export function BriefVisualizer({ audioRef, playing, progress }: BriefVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  // createMediaElementSource throws InvalidStateError if called twice for the
  // same element, so the node is created once and kept for the element's life.
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  // The global prefers-reduced-motion rule in globals.css collapses CSS
  // transitions and cannot reach a requestAnimationFrame loop, so this surface
  // has to ask in JS — and keep asking, since the setting can change mid-session.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || !playing) return;
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Built lazily inside a play gesture: an AudioContext created at mount
    // starts suspended under the browser's autoplay policy and stays that way.
    if (!contextRef.current) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      contextRef.current = new AudioContextCtor();
    }
    const audioContext = contextRef.current;
    if (audioContext.state === "suspended") void audioContext.resume();

    if (!sourceRef.current) {
      try {
        sourceRef.current = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.7;
        sourceRef.current.connect(analyser);
        analyser.connect(audioContext.destination);
        analyserRef.current = analyser;
      } catch {
        // Cross-origin audio without CORS headers taints the graph. Nothing to
        // recover here — the static bar below covers it.
        return;
      }
    }

    const analyser = analyserRef.current;
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    // Canvas cannot read Tailwind classes; sample the tokens once per run
    // rather than every frame.
    const styles = getComputedStyle(document.documentElement);
    const gold = styles.getPropertyValue("--color-brand-gold").trim() || "#A8821F";
    const idle = styles.getPropertyValue("--color-surface-4").trim() || "#2A2A2E";

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(bins);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / BAR_COUNT;
      const gap = Math.max(1, barWidth * 0.35);
      for (let index = 0; index < BAR_COUNT; index += 1) {
        // Spread the bars across the low two-thirds of the spectrum: speech
        // lives there, and the top third is near-silent for a voice track.
        const bin = Math.floor((index / BAR_COUNT) * (bins.length * 0.66));
        const amplitude = bins[bin] / 255;
        const barHeight = Math.max(2, amplitude * height);
        ctx.fillStyle = amplitude > 0.04 ? gold : idle;
        ctx.fillRect(
          index * barWidth + gap / 2,
          (height - barHeight) / 2,
          barWidth - gap,
          barHeight,
        );
      }
    };
    draw();

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [audioRef, playing, reducedMotion]);

  // Tear the graph down only on unmount: the source node is bound to the audio
  // element for its lifetime, so closing between plays would break the next one.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      analyserRef.current?.disconnect();
      sourceRef.current?.disconnect();
      void contextRef.current?.close();
      contextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  if (reducedMotion) {
    return (
      <div
        className="h-16 w-full rounded-card bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Brief playback position"
      >
        <div className="flex h-full items-center px-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
            <div
              className="h-full rounded-full bg-brand-gold transition-[width]"
              style={{
                width: `${Math.round(progress * 100)}%`,
                // --motion-duration-standard lives in :root but was never
                // mapped into @theme, so there is no duration-* utility for it.
                transitionDuration: "var(--motion-duration-standard)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={64}
      className="h-16 w-full rounded-card bg-surface-3"
      // Decorative: the transcript beside it carries the actual content, and
      // announcing a waveform frame by frame would be noise to a screen reader.
      aria-hidden="true"
    />
  );
}
