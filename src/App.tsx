import {
  BookMarked,
  Clapperboard,
  Film,
  ListChecks,
  Palette,
  Play,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ExpressionsScreen } from './components/ExpressionsScreen';
import { FinalPlayerScreen } from './components/FinalPlayerScreen';
import { GeneratorScreen } from './components/GeneratorScreen';
import { SceneConfigScreen } from './components/SceneConfigScreen';
import { StoryboardScreen } from './components/StoryboardScreen';
import { VerticalVideoPlayer } from './components/VerticalVideoPlayer';
import {
  DEFAULT_EXPRESSIONS,
  DEFAULT_QUIZ,
  DEFAULT_SCENES,
  DEFAULT_STORY_CONFIG,
} from './data/defaultStory';
import type {
  DialogueLine,
  ExpressionItem,
  GeneratedAudioClip,
  GenerationNotice,
  QuizQuestion,
  StoryConfig,
  StoryScene,
  StudioStep,
} from './types';
import {
  speakDialogueLineWebSpeech,
  unlockWebSpeech,
} from './utils/speechFallback';
import { CREDIT_TEXT } from './utils/videoCanvasRenderer';

const STEPS: Array<{
  id: StudioStep;
  label: string;
  mobileLabel: string;
  icon: typeof BookMarked;
}> = [
  { id: 'expressions', label: 'Expressions', mobileLabel: 'Words', icon: BookMarked },
  { id: 'scene', label: 'Scene Setup', mobileLabel: 'Scene', icon: Palette },
  { id: 'storyboard', label: 'Storyboard', mobileLabel: 'Board', icon: ListChecks },
  { id: 'generate', label: 'Generate', mobileLabel: 'Produce', icon: Clapperboard },
  { id: 'watch', label: 'Watch & Quiz', mobileLabel: 'Watch', icon: Film },
];

export default function App() {
  const [step, setStep] = useState<StudioStep>('expressions');
  const [expressions, setExpressions] = useState<ExpressionItem[]>(DEFAULT_EXPRESSIONS);
  const [storyConfig, setStoryConfig] = useState<StoryConfig>(DEFAULT_STORY_CONFIG);
  const [scenes, setScenes] = useState<StoryScene[]>(DEFAULT_SCENES);
  const [audioClips, setAudioClips] = useState<Record<string, GeneratedAudioClip>>({});
  const [quiz, setQuiz] = useState<QuizQuestion[]>(DEFAULT_QUIZ);
  const [showKorean, setShowKorean] = useState(true);

  const [isSynthesizingVoices, setIsSynthesizingVoices] = useState(false);
  const [auditioningLineId, setAuditioningLineId] = useState<string | null>(null);
  const voicePromiseRef = useRef<Promise<Record<string, GeneratedAudioClip>> | null>(
    null
  );

  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [regeneratingSceneIndex, setRegeneratingSceneIndex] = useState<number | null>(
    null
  );
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [videoMode, setVideoMode] = useState<'animated-storyboard' | 'ai-video'>(
    'animated-storyboard'
  );
  const [generatorNotice, setGeneratorNotice] = useState<GenerationNotice | null>(
    null
  );

  const ensureAllVoices = useCallback(
    async (
      targetScenes: StoryScene[] = scenes,
      targetConfig: StoryConfig = storyConfig,
      currentClips: Record<string, GeneratedAudioClip> = audioClips
    ): Promise<Record<string, GeneratedAudioClip>> => {
      const allLines = targetScenes.flatMap((s) => s.lines);
      const missingLines = allLines.filter((l) => !currentClips[l.id]);
      if (missingLines.length === 0) {
        return currentClips;
      }

      if (voicePromiseRef.current) {
        return voicePromiseRef.current;
      }

      const task = (async () => {
        setIsSynthesizingVoices(true);
        try {
          const response = await fetch('/api/tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: missingLines.map((l) => ({
                id: l.id,
                speaker: l.speaker,
                text: l.text,
                emotion: l.emotion,
              })),
              characters: targetConfig.characters.map((c) => ({
                name: c.name,
                voiceRole: c.voiceRole,
              })),
            }),
          });

          const data = (await response.json()) as {
            clips?: Array<{ lineId: string; speaker: string; audioDataUrl: string }>;
            error?: string;
          };

          if (!response.ok || !data.clips) {
            throw new Error(data.error || 'Voice synthesis failed.');
          }

          const merged: Record<string, GeneratedAudioClip> = { ...currentClips };
          data.clips.forEach((c) => {
            merged[c.lineId] = {
              lineId: c.lineId,
              speaker: c.speaker,
              audioDataUrl: c.audioDataUrl,
              durationSec: 2.2,
            };
          });
          setAudioClips(merged);
          return merged;
        } catch (err) {
          setGeneratorNotice({
            level: 'warning',
            title: 'Character Voice Synthesis Unavailable',
            detail:
              err instanceof Error
                ? err.message
                : 'Unable to synthesize Gemini character voices right now.',
          });
          return currentClips;
        } finally {
          setIsSynthesizingVoices(false);
          voicePromiseRef.current = null;
        }
      })();

      voicePromiseRef.current = task;
      return task;
    },
    [audioClips, scenes, storyConfig]
  );

  const handleAuditionLine = async (line: DialogueLine) => {
    unlockWebSpeech();
    setAuditioningLineId(line.id);
    try {
      let clip = audioClips[line.id];
      if (!clip) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch('/api/tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              lines: [
                {
                  id: line.id,
                  speaker: line.speaker,
                  text: line.text,
                  emotion: line.emotion,
                },
              ],
              characters: storyConfig.characters.map((c) => ({
                name: c.name,
                voiceRole: c.voiceRole,
              })),
            }),
          });
          const data = (await res.json()) as {
            clips?: Array<{ lineId: string; speaker: string; audioDataUrl: string }>;
          };
          if (res.ok && data.clips?.[0]) {
            clip = {
              lineId: data.clips[0].lineId,
              speaker: data.clips[0].speaker,
              audioDataUrl: data.clips[0].audioDataUrl,
              durationSec: 2.2,
            };
            setAudioClips((prev) => ({ ...prev, [clip!.lineId]: clip! }));
          }
        } catch {
          // Fall back to Web Speech API below
        } finally {
          clearTimeout(timer);
        }
      }
      if (clip) {
        const audio = new Audio(clip.audioDataUrl);
        await audio.play();
      } else {
        speakDialogueLineWebSpeech(line, false);
      }
    } finally {
      setAuditioningLineId(null);
    }
  };

  const handleScenesEdited = (nextScenes: StoryScene[]) => {
    // Invalidate audio cache only for lines whose text or speaker changed
    const nextMap: Record<string, GeneratedAudioClip> = {};
    const oldLines = new Map(scenes.flatMap((s) => s.lines).map((l) => [l.id, l]));
    nextScenes.flatMap((s) => s.lines).forEach((l) => {
      const prev = oldLines.get(l.id);
      if (
        prev &&
        prev.text === l.text &&
        prev.speaker === l.speaker &&
        audioClips[l.id]
      ) {
        nextMap[l.id] = audioClips[l.id];
      }
    });
    setAudioClips(nextMap);
    setScenes(nextScenes);
  };

  const handleGenerateStoryboard = async () => {
    setIsGeneratingStoryboard(true);
    setStoryboardError(null);
    try {
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expressions,
          storyConfig,
          existingImages: scenes.map((s) => s.imageUrl),
        }),
      });
      const data = (await response.json()) as {
        scenes?: StoryScene[];
        error?: string;
      };
      if (!response.ok || !data.scenes) {
        throw new Error(data.error || 'Failed to generate storyboard.');
      }
      setScenes(data.scenes);
      setAudioClips({});
      setStep('storyboard');
    } catch (err) {
      setStoryboardError(
        err instanceof Error ? err.message : 'Unable to generate storyboard.'
      );
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleRegenerateScene = async (sceneIndex: number) => {
    setRegeneratingSceneIndex(sceneIndex);
    setStoryboardError(null);
    try {
      const response = await fetch('/api/storyboard/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          scenes,
          expressions,
          storyConfig,
        }),
      });
      const data = (await response.json()) as {
        description?: string;
        cameraDirection?: string;
        sfxCue?: string;
        lines?: StoryScene['lines'];
        error?: string;
      };
      if (!response.ok || !data.lines) {
        throw new Error(data.error || 'Failed to regenerate scene.');
      }

      const updatedScenes = scenes.map((s, idx) =>
        idx === sceneIndex
          ? {
              ...s,
              description: data.description ?? s.description,
              cameraDirection: data.cameraDirection ?? s.cameraDirection,
              sfxCue: data.sfxCue ?? s.sfxCue,
              lines: data.lines ?? s.lines,
            }
          : s
      );
      setScenes(updatedScenes);
    } catch (err) {
      setStoryboardError(
        err instanceof Error ? err.message : 'Unable to regenerate scene.'
      );
    } finally {
      setRegeneratingSceneIndex(null);
    }
  };

  const handleGenerateFreshQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizError(null);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expressions, scenes }),
      });
      const data = (await response.json()) as {
        questions?: QuizQuestion[];
        error?: string;
      };
      if (!response.ok || !data.questions) {
        throw new Error(data.error || 'Failed to generate quiz.');
      }
      setQuiz(data.questions);
    } catch (err) {
      setQuizError(
        err instanceof Error ? err.message : 'Unable to generate vocabulary quiz.'
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#1F1A1C] flex flex-col">
      {/* 3-Zone Top Bar Contract (compact 48px mobile, 64px desktop) */}
      <header className="sticky top-0 z-30 border-b border-[#EDE3D8] bg-[#FFFDF8]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-8 px-4 sm:h-16 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setStep('expressions')}
            className="font-display text-lg font-extrabold tracking-tight text-[#E11D48] whitespace-nowrap shrink-0 sm:text-xl"
          >
            Aycaramba
          </button>

          <nav
            aria-label="Studio workflow"
            className="hidden items-center gap-6 lg:flex"
          >
            {STEPS.map((item, idx) => {
              const active = step === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={`min-h-[40px] border-b-2 px-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#E11D48] text-[#1F1A1C]'
                      : 'border-transparent text-[#6B5D63] hover:text-[#1F1A1C]'
                  }`}
                >
                  {idx + 1}. {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setStep('watch')}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#1F1A1C] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#362E31] sm:min-h-[40px] sm:px-4 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current text-[#FDE047]" />
              Watch 30s Clip
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-12">
        {step === 'watch' ? (
          <FinalPlayerScreen
            title={storyConfig.title}
            scenes={scenes}
            expressions={expressions}
            audioClips={audioClips}
            animationStyle={storyConfig.animationStyle}
            quiz={quiz}
            onGenerateFreshQuiz={handleGenerateFreshQuiz}
            isGeneratingQuiz={isGeneratingQuiz}
            quizError={quizError}
            showKorean={showKorean}
            onToggleKorean={() => setShowKorean((v) => !v)}
            onEnsureVoices={() => ensureAllVoices()}
            isSynthesizingVoices={isSynthesizingVoices}
            onBackToGenerator={() => setStep('generate')}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-12">
            {/* Active Studio Step Workspace */}
            <div className="xl:col-span-8">
              {step === 'expressions' && (
                <ExpressionsScreen
                  expressions={expressions}
                  onChange={setExpressions}
                  onNext={() => setStep('scene')}
                />
              )}

              {step === 'scene' && (
                <SceneConfigScreen
                  config={storyConfig}
                  onChange={setStoryConfig}
                  onBack={() => setStep('expressions')}
                  onGenerateStoryboard={handleGenerateStoryboard}
                  onContinueWithCurrent={() => setStep('storyboard')}
                  isGenerating={isGeneratingStoryboard}
                  errorMsg={storyboardError}
                />
              )}

              {step === 'storyboard' && (
                <StoryboardScreen
                  scenes={scenes}
                  expressions={expressions}
                  audioClips={audioClips}
                  onAuditionLine={handleAuditionLine}
                  auditioningLineId={auditioningLineId}
                  onChangeScenes={handleScenesEdited}
                  onRegenerateScene={handleRegenerateScene}
                  regeneratingIndex={regeneratingSceneIndex}
                  errorMsg={storyboardError}
                  onBack={() => setStep('scene')}
                  onNext={() => setStep('generate')}
                />
              )}

              {step === 'generate' && (
                <GeneratorScreen
                  scenes={scenes}
                  storyConfig={storyConfig}
                  audioClips={audioClips}
                  onAudioClipsReady={setAudioClips}
                  onUpdateSceneVideo={(sceneId, videoUrl) =>
                    setScenes((prev) =>
                      prev.map((s) =>
                        s.id === sceneId ? { ...s, videoUrl } : s
                      )
                    )
                  }
                  videoMode={videoMode}
                  onChangeVideoMode={setVideoMode}
                  notice={generatorNotice}
                  onSetNotice={setGeneratorNotice}
                  onBack={() => setStep('storyboard')}
                  onFinishToWatch={() => setStep('watch')}
                />
              )}
            </div>

            {/* Persistent 9:16 Live Preview & 4-Scene Timeline Dock on Desktop */}
            <aside className="hidden xl:block xl:col-span-4 xl:sticky xl:top-24">
              <div className="rounded-3xl border border-[#EDE3D8] bg-[#FAF6F0] p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <span className="text-sm font-bold text-[#1F1A1C]">
                    Live 9:16 Preview
                  </span>
                  <span className="text-xs text-[#6B5D63]">
                    {storyConfig.title}
                  </span>
                </div>
                <VerticalVideoPlayer
                  scenes={scenes}
                  expressions={expressions}
                  audioClips={audioClips}
                  animationStyle={storyConfig.animationStyle}
                  showKorean={showKorean}
                  onToggleKorean={() => setShowKorean((v) => !v)}
                  onEnsureVoices={() => ensureAllVoices()}
                  isSynthesizingVoices={isSynthesizingVoices}
                  compact
                />
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="hidden border-t border-[#EDE3D8] py-6 text-center text-xs text-[#7D6E74] lg:block">
        {CREDIT_TEXT} · Aycaramba Movie English Drama Studio
      </footer>

      {/* Mobile Thumb-Zone Bottom Tab Bar (56px high; combined top+bottom <= 15% cap) */}
      <nav
        aria-label="Mobile studio navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-[#EDE3D8] bg-[#FFFDF8]/95 backdrop-blur-md lg:hidden"
      >
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-[#E11D48]' : 'text-[#6B5D63]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
