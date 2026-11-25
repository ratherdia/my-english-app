import {
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Languages,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnimationStyle,
  ExpressionItem,
  GeneratedAudioClip,
  StoryScene,
} from '../types';
import {
  decodeAudioClips,
  scheduleDialogueAudio,
  scheduleOriginalScore,
} from '../utils/audioEngine';
import {
  speakDialogueLineWebSpeech,
  stopWebSpeech,
  unlockWebSpeech,
} from '../utils/speechFallback';
import {
  CREDIT_TEXT,
  TOTAL_VIDEO_DURATION,
  getActiveSceneAndLine,
  renderFrameToCanvas,
  wrapSubtitleTwoLines,
} from '../utils/videoCanvasRenderer';

interface VerticalVideoPlayerProps {
  scenes: StoryScene[];
  expressions: ExpressionItem[];
  audioClips: Record<string, GeneratedAudioClip>;
  animationStyle: AnimationStyle;
  seekRequestSec?: number | null;
  onSeekHandled?: () => void;
  showKorean: boolean;
  onToggleKorean: () => void;
  onEnsureVoices?: () => Promise<Record<string, GeneratedAudioClip>>;
  isSynthesizingVoices?: boolean;
  compact?: boolean;
}

export function VerticalVideoPlayer({
  scenes,
  expressions,
  audioClips,
  animationStyle,
  seekRequestSec,
  onSeekHandled,
  showKorean,
  onToggleKorean,
  onEnsureVoices,
  isSynthesizingVoices = false,
  compact = false,
}: VerticalVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const decodedCacheRef = useRef<Record<string, AudioBuffer>>({});
  const audioClipsRef = useRef<Record<string, GeneratedAudioClip>>(audioClips);
  const lastSpokenLineIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);
  const playbackAnchorRef = useRef<{ perfStart: number; offsetSec: number }>({
    perfStart: 0,
    offsetSec: 0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [imagesReady, setImagesReady] = useState(0);

  useEffect(() => {
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Preload all 4 scene images into HTMLImageElement cache
  useEffect(() => {
    let mounted = true;
    scenes.forEach((scene) => {
      if (!scene.imageUrl) return;
      const existing = imagesRef.current[scene.id];
      if (existing && existing.src.endsWith(scene.imageUrl)) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (mounted) setImagesReady((n) => n + 1);
      };
      img.src = scene.imageUrl;
      imagesRef.current[scene.id] = img;
    });
    return () => {
      mounted = false;
    };
  }, [scenes]);

  // Draw current frame whenever time, scenes, style, Korean toggle, or images change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFrameToCanvas({
      ctx,
      width: canvas.width,
      height: canvas.height,
      timeSec: currentTime,
      scenes,
      images: imagesRef.current,
      animationStyle,
      showKorean,
    });
  }, [currentTime, scenes, animationStyle, showKorean, imagesReady]);

  const stopAudio = useCallback(() => {
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
    }
    stopWebSpeech();
    lastSpokenLineIdRef.current = null;
  }, []);

  const allLinesHaveGeminiClips = useMemo(() => {
    const ids = scenes.flatMap((s) => s.lines.map((l) => l.id));
    return ids.length > 0 && ids.every((id) => Boolean(audioClips[id]));
  }, [scenes, audioClips]);

  const startAudioFrom = useCallback(
    async (
      offsetSec: number,
      overrideClips?: Record<string, GeneratedAudioClip>
    ) => {
      stopAudio();
      if (isMuted) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const activeClips = overrideClips ?? audioClips;
      const allLineIds = scenes.flatMap((s) => s.lines.map((l) => l.id));
      const useCompleteGeminiSet =
        allLineIds.length > 0 && allLineIds.every((id) => Boolean(activeClips[id]));

      if (useCompleteGeminiSet) {
        decodedCacheRef.current = await decodeAudioClips(ctx, activeClips);
      } else {
        decodedCacheRef.current = {};
      }

      const startAt = ctx.currentTime + 0.03;
      const stopScore = scheduleOriginalScore(ctx, ctx.destination, startAt, offsetSec);
      const stopVoices = useCompleteGeminiSet
        ? scheduleDialogueAudio(
            ctx,
            ctx.destination,
            scenes,
            decodedCacheRef.current,
            startAt,
            offsetSec
          )
        : () => {};

      stopAudioRef.current = () => {
        stopScore();
        stopVoices();
      };
    },
    [audioClips, isMuted, scenes, stopAudio]
  );

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAudio]);

  // Handle external seek requests (e.g., clicking a timestamp from Expressions list)
  useEffect(() => {
    if (seekRequestSec === null || seekRequestSec === undefined) return;
    const clamped = Math.max(0, Math.min(TOTAL_VIDEO_DURATION, seekRequestSec));
    setCurrentTime(clamped);
    playbackAnchorRef.current = {
      perfStart: performance.now(),
      offsetSec: clamped,
    };
    if (isPlaying) {
      void startAudioFrom(clamped);
    }
    onSeekHandled?.();
  }, [seekRequestSec, isPlaying, startAudioFrom, onSeekHandled]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    const tick = () => {
      const elapsed =
        (performance.now() - playbackAnchorRef.current.perfStart) / 1000;
      const nextTime = playbackAnchorRef.current.offsetSec + elapsed;
      if (nextTime >= TOTAL_VIDEO_DURATION) {
        setCurrentTime(TOTAL_VIDEO_DURATION);
        setIsPlaying(false);
        stopAudio();
        return;
      }

      const { line: activeLine } = getActiveSceneAndLine(scenes, nextTime);
      if (activeLine && activeLine.id !== lastSpokenLineIdRef.current) {
        lastSpokenLineIdRef.current = activeLine.id;
        if (!allLinesHaveGeminiClips) {
          speakDialogueLineWebSpeech(activeLine, isMutedRef.current);
        }
      } else if (!activeLine) {
        lastSpokenLineIdRef.current = null;
      }

      setCurrentTime(nextTime);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [allLinesHaveGeminiClips, isPlaying, scenes, stopAudio]);

  const unlockAudioSync = () => {
    unlockWebSpeech();
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
      return;
    }

    unlockAudioSync();

    const startFrom = currentTime >= TOTAL_VIDEO_DURATION - 0.1 ? 0 : currentTime;
    setCurrentTime(startFrom);
    playbackAnchorRef.current = {
      perfStart: performance.now(),
      offsetSec: startFrom,
    };
    setIsPlaying(true);

    await startAudioFrom(startFrom, audioClipsRef.current);
  };

  const handleRestart = async () => {
    unlockAudioSync();
    setCurrentTime(0);
    playbackAnchorRef.current = { perfStart: performance.now(), offsetSec: 0 };
    setIsPlaying(true);

    await startAudioFrom(0, audioClipsRef.current);
  };

  const handleSeek = async (targetSec: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_VIDEO_DURATION, targetSec));
    lastSpokenLineIdRef.current = null;
    stopWebSpeech();
    setCurrentTime(clamped);
    playbackAnchorRef.current = {
      perfStart: performance.now(),
      offsetSec: clamped,
    };
    if (isPlaying) {
      await startAudioFrom(clamped, audioClipsRef.current);
    }
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    if (nextMuted) {
      stopAudio();
    } else if (isPlaying) {
      unlockAudioSync();
      const ctx = audioCtxRef.current!;
      const startAt = ctx.currentTime + 0.03;
      const stopScore = scheduleOriginalScore(ctx, ctx.destination, startAt, currentTime);
      const stopVoices = scheduleDialogueAudio(
        ctx,
        ctx.destination,
        scenes,
        decodedCacheRef.current,
        startAt,
        currentTime
      );
      stopAudioRef.current = () => {
        stopScore();
        stopVoices();
      };
    }
  };

  const { scene: activeScene, line: activeLine } = useMemo(
    () => getActiveSceneAndLine(scenes, currentTime),
    [scenes, currentTime]
  );

  const activeSubtitleLines = useMemo(
    () => (activeLine ? wrapSubtitleTwoLines(activeLine.text, 30).slice(0, 2) : []),
    [activeLine]
  );

  const hasVoiceClips = allLinesHaveGeminiClips;
  const matchedExprs = useMemo(() => {
    if (!activeLine) return [];
    return expressions.filter((e) => activeLine.usedExpressionIds.includes(e.id));
  }, [activeLine, expressions]);

  const formatClock = (sec: number) => {
    const whole = Math.floor(sec);
    const tenths = Math.floor((sec - whole) * 10);
    return `00:${String(whole).padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 9:16 Vertical Video Stage */}
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-3xl bg-[#181014] shadow-md ${
          compact ? 'max-w-[290px]' : 'max-w-[360px]'
        } aspect-[9/16]`}
      >
        <canvas
          ref={canvasRef}
          width={720}
          height={1280}
          className="h-full w-full object-cover"
        />

        {/* Top Scene Phase Indicator (clean unboxed typographic scrim) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent px-4 pt-3.5 pb-6 text-xs font-medium text-white/90">
          <span>
            Scene {activeScene.sceneNumber} · {activeScene.phase}
          </span>
          <span className="font-mono tabular-nums">
            {formatClock(currentTime)} / 00:30.0
          </span>
        </div>

        {/* Interactive Play Tap Overlay when paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label="Play 30-second animated clip"
            className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFFDF8]/95 text-[#E11D48] shadow-lg transition-transform hover:scale-105">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </span>
          </button>
        )}
      </div>

      {/* Live Spoken Line & Expression Context Bar (accessible DOM caption mirror) */}
      <div className="rounded-2xl border border-[#EDE3D8] bg-white px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-2 text-xs text-[#6B5D63]">
          <span>
            {activeLine
              ? `${activeLine.speaker} · ${activeLine.emotion}`
              : currentTime >= 28.3
                ? CREDIT_TEXT
                : `${activeScene.phase} · ${activeScene.sfxCue}`}
          </span>
          <span className="font-mono tabular-nums">
            {hasVoiceClips
              ? 'Gemini American Voices + Score'
              : isSynthesizingVoices
                ? 'Syncing Cloud Voices (American Speech Ready)'
                : 'American English Voices + Score'}
          </span>
        </div>
        <p className="mt-1 min-h-[2.5rem] font-semibold text-[#1F1A1C]">
          {activeSubtitleLines.length > 0
            ? activeSubtitleLines.join(' ')
            : currentTime >= 28.3
              ? 'Humorous freeze-frame finale'
              : activeScene.description}
        </p>
        {matchedExprs.length > 0 && (
          <p className="mt-1 text-xs text-[#6D28D9]">
            Movie expression:{' '}
            {matchedExprs
              .map((e) => `${e.phrase} (${e.korean} · ${e.movie})`)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Transport Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#BE123C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] whitespace-nowrap shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                {currentTime >= TOTAL_VIDEO_DURATION - 0.1 ? 'Replay' : 'Play 30s'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label="Restart from 00:00"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6DCD0] bg-white px-3 text-[#4B3F44] transition-colors hover:bg-[#FAF4EC]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6DCD0] bg-white px-3 text-[#4B3F44] transition-colors hover:bg-[#FAF4EC]"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleKorean}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            showKorean
              ? 'border-[#6D28D9] bg-[#F5F3FF] text-[#5B21B6]'
              : 'border-[#E6DCD0] bg-white text-[#4B3F44] hover:bg-[#FAF4EC]'
          }`}
        >
          <Languages className="h-4 w-4" />
          {showKorean ? '한국어 자막 ON' : '한국어 자막 OFF'}
        </button>
      </div>

      {/* 4-Scene Timeline Scrubber */}
      <div className="rounded-2xl border border-[#EDE3D8] bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[#6B5D63]">
          <span>4-Scene Timeline</span>
          <span className="font-mono tabular-nums">
            {currentTime.toFixed(1)}s / 30.0s
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={TOTAL_VIDEO_DURATION}
          step={0.1}
          value={currentTime}
          onChange={(e) => void handleSeek(Number(e.target.value))}
          aria-label="Seek 30-second video timeline"
          className="mb-3 h-2 w-full cursor-pointer accent-[#E11D48]"
        />

        <div className="grid grid-cols-4 gap-1.5">
          {scenes.map((scene) => {
            const isActive = activeScene.id === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => void handleSeek(scene.startTime + 0.05)}
                className={`min-h-[44px] rounded-xl px-2 py-1.5 text-left transition-colors ${
                  isActive
                    ? 'bg-[#FFF1F2] text-[#9F1239] ring-1 ring-[#FDA4AF]'
                    : 'bg-[#FAF6F0] text-[#57494F] hover:bg-[#F3ECE2]'
                }`}
              >
                <div className="truncate text-xs font-semibold">
                  {scene.sceneNumber}. {scene.phase}
                </div>
                <div className="font-mono text-[11px] tabular-nums opacity-75">
                  {scene.startTime}–{scene.endTime}s
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
