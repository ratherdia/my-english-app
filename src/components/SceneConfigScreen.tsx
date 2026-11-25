import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  RotateCcw,
  Volume2,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_STORY_CONFIG } from '../data/defaultStory';
import type {
  AnimationStyle,
  CharacterProfile,
  StoryConfig,
  VoiceRole,
} from '../types';
import {
  speakDialogueLineWebSpeech,
  unlockWebSpeech,
} from '../utils/speechFallback';

interface SceneConfigScreenProps {
  config: StoryConfig;
  onChange: (next: StoryConfig) => void;
  onBack: () => void;
  onGenerateStoryboard: () => Promise<void>;
  onContinueWithCurrent: () => void;
  isGenerating: boolean;
  errorMsg: string | null;
}

const ANIMATION_STYLES: Array<{
  style: AnimationStyle;
  subtitle: string;
}> = [
  { style: '3D Animation', subtitle: 'Warm Pixar-style depth & lighting' },
  { style: '2D Animation', subtitle: 'Bold expressive hand-drawn frames' },
  { style: 'Clay', subtitle: 'Tactile stop-motion miniature texture' },
  { style: 'Watercolor', subtitle: 'Soft storybook ink & pigment wash' },
  { style: 'Realistic', subtitle: 'Photorealistic miniature fruit cinema' },
];

const VOICE_OPTIONS: Array<{ value: VoiceRole; label: string }> = [
  { value: 'emotional-female', label: 'Emotional American Female' },
  { value: 'nervous-male', label: 'Confident to Nervous Male' },
  { value: 'confident-female', label: 'Confident American Female' },
];

export function SceneConfigScreen({
  config,
  onChange,
  onBack,
  onGenerateStoryboard,
  onContinueWithCurrent,
  isGenerating,
  errorMsg,
}: SceneConfigScreenProps) {
  const [auditioningId, setAuditioningId] = useState<string | null>(null);

  const updateCharacter = (
    id: string,
    patch: Partial<CharacterProfile>
  ) => {
    onChange({
      ...config,
      characters: config.characters.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    });
  };

  const handleAuditionCharacter = async (char: CharacterProfile) => {
    setAuditioningId(char.id);
    const sampleLine =
      char.voiceRole === 'emotional-female'
        ? 'What?! That really crosses the line!'
        : char.voiceRole === 'nervous-male'
          ? 'Wait! Hear me out. Please, keep it together!'
          : "The thing is, we're getting married next week.";

    unlockWebSpeech();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          lines: [
            {
              id: `audition-${char.id}`,
              speaker: char.name,
              text: sampleLine,
              emotion: char.personality,
            },
          ],
          characters: [{ name: char.name, voiceRole: char.voiceRole }],
        }),
      });
      const data = (await response.json()) as {
        clips?: Array<{ audioDataUrl: string }>;
      };
      const url = data.clips?.[0]?.audioDataUrl;
      if (!response.ok || !url) {
        throw new Error('TTS unavailable');
      }
      const audio = new Audio(url);
      audio.onended = () => setAuditioningId(null);
      audio.onerror = () => setAuditioningId(null);
      await audio.play();
    } catch {
      speakDialogueLineWebSpeech(
        {
          id: `audition-${char.id}`,
          speaker: char.name,
          text: sampleLine,
          korean: '',
          emotion: char.personality,
          startTime: 0,
          endTime: 3.5,
          usedExpressionIds: [],
        },
        false
      );
      setTimeout(() => setAuditioningId(null), 2600);
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">
            Step 02 · Cast, World & Look
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F1A1C] sm:text-3xl">
            Configure Characters, Setting & Style
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5E5056]">
            Keep the default <em>Berry Betrayal</em> cast or customize the setting,
            story premise, voice personas, and visual animation style.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_STORY_CONFIG)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD0] bg-white px-4 py-2 text-xs font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Default Cast
        </button>
      </div>

      {/* Story World Inputs */}
      <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-4">
        <h2 className="text-base font-bold text-[#1F1A1C]">Story & Location</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
              Story Title
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => onChange({ ...config, title: e.target.value })}
              className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
              Genre
            </label>
            <input
              type="text"
              value={config.genre}
              onChange={(e) => onChange({ ...config, genre: e.target.value })}
              className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
            Setting / Location
          </label>
          <input
            type="text"
            value={config.location}
            onChange={(e) => onChange({ ...config, location: e.target.value })}
            className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
            Plot Premise
          </label>
          <textarea
            rows={3}
            value={config.premise}
            onChange={(e) => onChange({ ...config, premise: e.target.value })}
            className="w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] p-3.5 text-sm leading-relaxed text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
          />
        </div>
      </section>

      {/* Animation Style Selector (5 required styles) */}
      <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-[#1F1A1C]">Animation Style</h2>
          <span className="text-xs text-[#6B5D63]">5 render styles</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {ANIMATION_STYLES.map((item) => {
            const active = config.animationStyle === item.style;
            return (
              <button
                key={item.style}
                type="button"
                onClick={() => onChange({ ...config, animationStyle: item.style })}
                className={`min-h-[68px] rounded-2xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-[#6D28D9] bg-[#F5F3FF] text-[#4C1D95]'
                    : 'border-[#EDE3D8] bg-[#FFFDF8] text-[#1F1A1C] hover:bg-[#FAF4EC]'
                }`}
              >
                <div className="text-sm font-bold">{item.style}</div>
                <div className="mt-1 text-xs leading-snug opacity-80">
                  {item.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Character Consistency Roster */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-[#1F1A1C]">
            Character Design & Voice Cast
          </h2>
          <span className="text-xs text-[#6B5D63]">
            Consistent proportions & outfits across all 4 scenes
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {config.characters.map((char) => (
            <div
              key={char.id}
              className="rounded-3xl border border-[#EDE3D8] bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#F3ECE2] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: char.colorHex }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) =>
                      updateCharacter(char.id, { name: e.target.value })
                    }
                    aria-label={`${char.name} name`}
                    className="w-32 bg-transparent text-base font-bold text-[#1F1A1C] focus:outline-none"
                  />
                </div>
                <span className="text-xs text-[#6B5D63]">{char.fruitType}</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5E5056]">
                  Visual Design
                </label>
                <textarea
                  rows={3}
                  value={char.appearance}
                  onChange={(e) =>
                    updateCharacter(char.id, { appearance: e.target.value })
                  }
                  className="w-full rounded-xl border border-[#E6DCD0] bg-[#FFFDF8] p-2.5 text-xs leading-relaxed text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5E5056]">
                  Personality
                </label>
                <input
                  type="text"
                  value={char.personality}
                  onChange={(e) =>
                    updateCharacter(char.id, { personality: e.target.value })
                  }
                  className="min-h-[40px] w-full rounded-xl border border-[#E6DCD0] bg-[#FFFDF8] px-3 text-xs text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5E5056]">
                  American English Voice
                </label>
                <div className="flex gap-2">
                  <select
                    value={char.voiceRole}
                    onChange={(e) => {
                      const role = e.target.value as VoiceRole;
                      const found = VOICE_OPTIONS.find((v) => v.value === role);
                      updateCharacter(char.id, {
                        voiceRole: role,
                        voiceLabel: found?.label ?? char.voiceLabel,
                      });
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-[#E6DCD0] bg-[#FFFDF8] px-3 text-xs font-medium text-[#1F1A1C] focus:border-[#6D28D9] focus:outline-none"
                  >
                    {VOICE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={auditioningId === char.id}
                    onClick={() => void handleAuditionCharacter(char)}
                    aria-label={`Audition ${char.name} voice`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-3 text-xs font-semibold text-[#5B21B6] transition-colors hover:bg-[#EDE9FE] disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {auditioningId === char.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {auditioningId === char.id ? 'Playing' : 'Test'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-[#FDA4AF] bg-[#FFF1F2] px-4 py-3 text-sm text-[#9F1239]"
        >
          {errorMsg}
        </div>
      )}

      {/* Navigation & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#E6DCD0] bg-white px-5 py-3 text-sm font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerateStoryboard}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#6D28D9] bg-[#F5F3FF] px-5 py-3 text-sm font-semibold text-[#5B21B6] transition-colors hover:bg-[#EDE9FE] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isGenerating ? 'Writing 4-Scene Script...' : 'Rewrite Script with Gemini'}
          </button>

          <button
            type="button"
            onClick={onContinueWithCurrent}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#1F1A1C] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#362E31] whitespace-nowrap shrink-0"
          >
            Open Storyboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
