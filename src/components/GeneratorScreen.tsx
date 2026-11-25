import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  DialogueLine,
  GeneratedAudioClip,
  GenerationNotice,
  StoryConfig,
  StoryScene,
} from '../types';
import {
  speakDialogueLineWebSpeech,
  unlockWebSpeech,
} from '../utils/speechFallback';

interface GeneratorScreenProps {
  scenes: StoryScene[];
  storyConfig: StoryConfig;
  audioClips: Record<string, GeneratedAudioClip>;
  onAudioClipsReady: (clips: Record<string, GeneratedAudioClip>) => void;
  onUpdateSceneVideo: (sceneId: string, videoUrl: string) => void;
  videoMode: 'animated-storyboard' | 'ai-video';
  onChangeVideoMode: (mode: 'animated-storyboard' | 'ai-video') => void;
  notice: GenerationNotice | null;
  onSetNotice: (notice: GenerationNotice | null) => void;
  onBack: () => void;
  onFinishToWatch: () => void;
}

export function GeneratorScreen({
  scenes,
  storyConfig,
  audioClips,
  onAudioClipsReady,
  onUpdateSceneVideo,
  videoMode,
  onChangeVideoMode,
  notice,
  onSetNotice,
  onBack,
  onFinishToWatch,
}: GeneratorScreenProps) {
  const [isGeneratingVoices, setIsGeneratingVoices] = useState(false);
  const [isTryingVeo, setIsTryingVeo] = useState(false);
  const [playingLineId, setPlayingLineId] = useState<string | null>(null);

  const allLines = scenes.flatMap((s) => s.lines);
  const voicedCount = allLines.filter((l) => Boolean(audioClips[l.id])).length;

  const handleGenerateVoices = async () => {
    setIsGeneratingVoices(true);
    onSetNotice(null);
    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: allLines.map((l) => ({
            id: l.id,
            speaker: l.speaker,
            text: l.text,
            emotion: l.emotion,
          })),
          characters: storyConfig.characters.map((c) => ({
            name: c.name,
            voiceRole: c.voiceRole,
          })),
        }),
      });

      const data = (await response.json()) as {
        clips?: Array<{ lineId: string; speaker: string; audioDataUrl: string }>;
        partialError?: string | null;
        error?: string;
      };

      if (!response.ok || !data.clips) {
        throw new Error(data.error || 'Voice generation failed.');
      }

      const nextMap: Record<string, GeneratedAudioClip> = { ...audioClips };
      data.clips.forEach((c) => {
        nextMap[c.lineId] = {
          lineId: c.lineId,
          speaker: c.speaker,
          audioDataUrl: c.audioDataUrl,
          durationSec: 2.2,
        };
      });
      onAudioClipsReady(nextMap);
      onSetNotice(
        data.partialError
          ? {
              level: 'warning',
              title: 'Partial Gemini TTS — Browser Speech Active for Remaining Lines',
              detail: `${data.clips.length}/${allLines.length} lines synthesized via Gemini TTS; remaining lines automatically use American English browser speech synthesis during playback.`,
            }
          : {
              level: 'info',
              title: 'American English Voices Ready',
              detail: `Synthesized ${data.clips.length} dialogue clips using Gemini 3.8 TTS (Strawberry: Emotional Female, Banana: Nervous Male, Blueberry: Confident Female).`,
            }
      );
    } catch (err) {
      onSetNotice({
        level: 'warning',
        title: 'Gemini TTS Quota Reached — American English Speech Synthesis Active',
        detail: `${
          err instanceof Error ? err.message : 'Cloud TTS unavailable.'
        } Live 30-second video playback and line auditioning automatically use American English browser speech voices for Strawberry, Banana, and Blueberry.`,
      });
    } finally {
      setIsGeneratingVoices(false);
    }
  };

  const handleTryDirectVideo = async () => {
    setIsTryingVeo(true);
    onSetNotice(null);
    try {
      const firstScene = scenes[0];
      const prompt = `${storyConfig.animationStyle}, 9:16 vertical cinematic frame. ${storyConfig.location}. ${firstScene.description} Characters: ${storyConfig.characters
        .map((c) => `${c.name}: ${c.appearance}`)
        .join(' ')}`;

      const response = await fetch('/api/video/generate-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          durationSeconds: 7,
        }),
      });

      const data = (await response.json()) as {
        available?: boolean;
        videoDataUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.available || !data.videoDataUrl) {
        onChangeVideoMode('animated-storyboard');
        onSetNotice({
          level: 'warning',
          title: 'Direct AI Video Generation Unavailable — Animated Slideshow Active',
          detail:
            data.error ||
            'Direct video generation (Veo) requires a paid API key or encountered an upstream error. Using Animated Storyboard Slideshow mode with consistent 9:16 scene art, cinematic zoom/pan/freeze-frame, original score, Gemini TTS voices, and synchronized subtitles.',
        });
        return;
      }

      onUpdateSceneVideo(firstScene.id, data.videoDataUrl);
      onChangeVideoMode('ai-video');
      onSetNotice({
        level: 'info',
        title: 'Direct AI Video Clip Ready',
        detail: 'Scene 1 video clip generated with Gemini Omni Flash.',
      });
    } catch (err) {
      onChangeVideoMode('animated-storyboard');
      onSetNotice({
        level: 'warning',
        title: 'Direct AI Video Generation Unavailable — Animated Slideshow Active',
        detail:
          err instanceof Error
            ? `${err.message} Falling back to Animated Storyboard Slideshow mode.`
            : 'Falling back to Animated Storyboard Slideshow mode.',
      });
    } finally {
      setIsTryingVeo(false);
    }
  };

  const playSingleClip = (line: DialogueLine) => {
    unlockWebSpeech();
    const clip = audioClips[line.id];
    if (!clip) {
      setPlayingLineId(line.id);
      speakDialogueLineWebSpeech(line, false);
      setTimeout(() => setPlayingLineId(null), 1800);
      return;
    }
    setPlayingLineId(line.id);
    const audio = new Audio(clip.audioDataUrl);
    audio.onended = () => setPlayingLineId(null);
    audio.onerror = () => setPlayingLineId(null);
    void audio.play();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#E11D48]">
            Step 04 · Voice & 9:16 Video Assembly
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F1A1C] sm:text-3xl">
            Produce Voices & 30-Second Animation
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5E5056]">
            Generate expressive American English voiceovers for Strawberry,
            Banana, and Blueberry, review the four 9:16 scenes, and assemble your
            final 30-second vertical drama.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#5E5056]">
          <span className="font-mono tabular-nums">
            {voicedCount}/{allLines.length} lines voiced
          </span>
          <span aria-hidden="true">·</span>
          <span>Style: {storyConfig.animationStyle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">9:16 · 30s</span>
        </div>
      </div>

      {/* Honest Status / Fallback Notification */}
      {notice && (
        <div
          role={notice.level === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
            notice.level === 'error'
              ? 'border-[#FDA4AF] bg-[#FFF1F2] text-[#9F1239]'
              : notice.level === 'warning'
                ? 'border-[#F59E0B] bg-[#FEFCE8] text-[#854D0E]'
                : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
          }`}
        >
          {notice.level === 'info' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-bold">{notice.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed">{notice.detail}</p>
          </div>
        </div>
      )}

      {/* Production Section 1: Natural American English Voices */}
      <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#1F1A1C]">
              1. Natural American English Character Voices
            </h2>
            <p className="mt-0.5 text-xs text-[#6B5D63]">
              Strawberry (Emotional Female) · Banana (Nervous Male) · Blueberry
              (Confident Female) — Live English character speech is ready now; optionally
              synthesize Gemini Studio WAVs below.
            </p>
          </div>

          <button
            type="button"
            disabled={isGeneratingVoices}
            onClick={handleGenerateVoices}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E11D48] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#BE123C] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isGeneratingVoices ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {isGeneratingVoices
              ? `Synthesizing ${allLines.length} Lines...`
              : voicedCount === allLines.length
                ? 'Regenerate Studio Voices'
                : 'Synthesize Studio Voices (Optional)'}
          </button>
        </div>

        <div className="divide-y divide-[#F3ECE2] rounded-2xl border border-[#EFE6DC] bg-[#FFFDF8]">
          {allLines.map((line) => {
            const hasClip = Boolean(audioClips[line.id]);
            const isLinePlaying = playingLineId === line.id;
            return (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#1F1A1C]">
                      {line.speaker}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-[#6B5D63]">{line.emotion}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#8C7C83]">
                      {line.startTime.toFixed(1)}s
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium text-[#2D2428]">
                    “{line.text}”
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => playSingleClip(line)}
                  aria-label={`Play voice for ${line.speaker}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-3 text-xs font-semibold text-[#5B21B6] hover:bg-[#EDE9FE] whitespace-nowrap shrink-0"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {isLinePlaying
                    ? 'Speaking...'
                    : hasClip
                      ? 'Audition (Gemini)'
                      : 'Audition'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Production Section 2: 4 Consistent 9:16 Scenes & Render Mode */}
      <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#1F1A1C]">
              2. Four 9:16 Animated Scenes & Motion Engine
            </h2>
            <p className="mt-0.5 text-xs text-[#6B5D63]">
              Active mode:{' '}
              <strong>
                {videoMode === 'ai-video'
                  ? 'Direct AI Video (Veo)'
                  : 'Animated Storyboard Slideshow (Zoom, Pan, Slow-Mo, Freeze-Frame + Original Score)'}
              </strong>
            </p>
          </div>

          <button
            type="button"
            disabled={isTryingVeo}
            onClick={handleTryDirectVideo}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD0] bg-[#FFFDF8] px-4 py-2 text-xs font-semibold text-[#3F3539] transition-colors hover:bg-[#FAF4EC] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isTryingVeo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-[#6D28D9]" />
            )}
            {isTryingVeo ? 'Checking Veo API...' : 'Try Direct AI Video (Veo)'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="overflow-hidden rounded-2xl border border-[#EFE6DC] bg-[#FAF6F0]"
            >
              <div className="relative aspect-[9/16] w-full bg-[#1F1A1C]">
                {scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={`Scene ${scene.sceneNumber} ${scene.phase}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-white/70">
                    Scene {scene.sceneNumber}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white">
                  <div className="text-xs font-bold">
                    {scene.sceneNumber}. {scene.phase}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-white/80">
                    {scene.startTime}–{scene.endTime}s
                  </div>
                </div>
              </div>
              <div className="p-2.5 text-[11px] leading-snug text-[#5E5056]">
                {scene.cameraDirection}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation & Final Assemble CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#E6DCD0] bg-white px-5 py-3 text-sm font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Storyboard
        </button>

        <button
          type="button"
          onClick={onFinishToWatch}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#1F1A1C] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#362E31] whitespace-nowrap shrink-0"
        >
          <Film className="h-4 w-4 text-[#FDE047]" />
          Watch & Export 30s Clip
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
