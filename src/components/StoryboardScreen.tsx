import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Loader2,
  Pencil,
  RefreshCw,
  Volume2,
  X,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type {
  DialogueLine,
  ExpressionItem,
  GeneratedAudioClip,
  StoryScene,
} from '../types';

interface StoryboardScreenProps {
  scenes: StoryScene[];
  expressions: ExpressionItem[];
  audioClips: Record<string, GeneratedAudioClip>;
  onAuditionLine: (line: DialogueLine) => Promise<void>;
  auditioningLineId: string | null;
  onChangeScenes: (next: StoryScene[]) => void;
  onRegenerateScene: (sceneIndex: number) => Promise<void>;
  regeneratingIndex: number | null;
  errorMsg: string | null;
  onBack: () => void;
  onNext: () => void;
}

function buildExpressionRegex(expressions: ExpressionItem[]): RegExp | null {
  const phrases = expressions
    .map((e) => e.phrase.trim())
    .filter(Boolean)
    // Match inflections on verbs like cross -> crosses/crossed/crossing
    .map((p) => {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Allow optional s/es/ed/ing on the first word if multi-word
      const parts = escaped.split(/\s+/);
      if (parts.length > 0) {
        parts[0] = `${parts[0]}(?:s|es|ed|ing)?`;
      }
      return parts.join('\\s+');
    });

  if (phrases.length === 0) return null;
  return new RegExp(`(${phrases.join('|')})`, 'gi');
}

function findMatchingExpression(
  fragment: string,
  expressions: ExpressionItem[]
): ExpressionItem | undefined {
  const norm = fragment.toLowerCase().replace(/\s+/g, ' ').trim();
  return expressions.find((e) => {
    const base = e.phrase.toLowerCase().trim();
    if (norm === base) return true;
    const baseWords = base.split(/\s+/);
    const normWords = norm.split(/\s+/);
    if (baseWords.length !== normWords.length) return false;
    return baseWords.every((bw, i) =>
      i === 0 ? normWords[i].startsWith(bw) : normWords[i] === bw
    );
  });
}

export function StoryboardScreen({
  scenes,
  expressions,
  audioClips,
  onAuditionLine,
  auditioningLineId,
  onChangeScenes,
  onRegenerateScene,
  regeneratingIndex,
  errorMsg,
  onBack,
  onNext,
}: StoryboardScreenProps) {
  const [selectedExpr, setSelectedExpr] = useState<ExpressionItem | null>(
    expressions[0] ?? null
  );
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  const totalWords = useMemo(() => {
    return scenes.reduce((acc, scene) => {
      const w = scene.lines.reduce(
        (la, line) => la + line.text.trim().split(/\s+/).filter(Boolean).length,
        0
      );
      return acc + w;
    }, 0);
  }, [scenes]);

  const wordCountOk = totalWords >= 60 && totalWords <= 70;
  const regex = useMemo(() => buildExpressionRegex(expressions), [expressions]);

  const coveredExpressionIds = useMemo(() => {
    const found = new Set<string>();
    scenes.forEach((s) => {
      s.lines.forEach((l) => {
        l.usedExpressionIds.forEach((id) => found.add(id));
        if (regex) {
          const matches = l.text.match(regex) ?? [];
          matches.forEach((m) => {
            const matched = findMatchingExpression(m, expressions);
            if (matched) found.add(matched.id);
          });
        }
      });
    });
    return found;
  }, [scenes, expressions, regex]);

  const updateSceneDescription = (sceneId: string, description: string) => {
    onChangeScenes(
      scenes.map((s) => (s.id === sceneId ? { ...s, description } : s))
    );
  };

  const updateLine = (
    sceneId: string,
    lineId: string,
    patch: Partial<DialogueLine>
  ) => {
    onChangeScenes(
      scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              lines: s.lines.map((l) =>
                l.id === lineId ? { ...l, ...patch } : l
              ),
            }
          : s
      )
    );
  };

  const renderHighlightedDialogue = (text: string) => {
    if (!regex) return text;
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      const match = findMatchingExpression(part, expressions);
      if (!match) return <Fragment key={idx}>{part}</Fragment>;

      const isSelected = selectedExpr?.id === match.id;
      return (
        <button
          key={idx}
          type="button"
          onClick={() => setSelectedExpr(match)}
          className={`mx-0.5 inline rounded-md px-1.5 py-0.5 font-bold underline decoration-2 underline-offset-2 transition-colors ${
            isSelected
              ? 'bg-[#FEF08A] text-[#713F12] decoration-[#CA8A04]'
              : 'bg-[#FFF1F2] text-[#BE123C] decoration-[#FB7185] hover:bg-[#FFE4E6]'
          }`}
        >
          {part}
        </button>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#CA8A04]">
            Step 03 · 4-Scene Script & Study Notes
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F1A1C] sm:text-3xl">
            Storyboard & Highlighted Expressions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5E5056]">
            Tap any highlighted English expression in the dialogue to inspect its
            Korean meaning and source movie. Edit lines inline or regenerate a
            single scene.
          </p>
        </div>

        {/* Clean Unboxed Telemetry Strip */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5E5056]">
          <span
            className={`font-mono font-semibold tabular-nums ${
              wordCountOk ? 'text-[#047857]' : 'text-[#B45309]'
            }`}
          >
            {totalWords} / 60–70 words
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {coveredExpressionIds.size}/{expressions.length} expressions used
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">30s total</span>
        </div>
      </div>

      {!wordCountOk && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-[#F59E0B] bg-[#FEFCE8] px-4 py-3 text-xs text-[#854D0E]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#CA8A04]" />
          <span>
            Current dialogue has{' '}
            <strong className="font-mono tabular-nums">{totalWords}</strong> words.
            Keep total spoken dialogue between <strong>60 and 70 words</strong> so
            all four scenes fit naturally inside 30 seconds.
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-[#FDA4AF] bg-[#FFF1F2] px-4 py-3 text-sm text-[#9F1239]"
        >
          {errorMsg}
        </div>
      )}

      {/* Selected Expression Inspector Card */}
      {selectedExpr && (
        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-[#DDD6FE] bg-[#F5F3FF] px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#6D28D9]" />
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-extrabold text-[#3B0764]">
                  “{selectedExpr.phrase}”
                </span>
                <span className="text-sm font-bold text-[#6D28D9]">
                  {selectedExpr.korean}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#5B21B6]">
                Source movie: <strong>{selectedExpr.movie}</strong> · Tap any
                highlighted phrase below to switch study card.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedExpr(null)}
            aria-label="Close expression study note"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center self-end rounded-xl text-[#5B21B6] hover:bg-[#EDE9FE] sm:self-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4-Scene Storyboard Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {scenes.map((scene, idx) => {
          const isEditing = editingSceneId === scene.id;
          const isRegenerating = regeneratingIndex === idx;

          return (
            <article
              key={scene.id}
              className="flex flex-col justify-between rounded-3xl border border-[#EDE3D8] bg-white p-5"
            >
              <div className="space-y-4">
                {/* Scene Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#F3ECE2] pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#6B5D63]">
                      <span className="font-bold text-[#E11D48]">
                        Scene {scene.sceneNumber} · {scene.phase}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {scene.startTime}–{scene.endTime}s
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7D6E74]">
                      {scene.cameraDirection}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingSceneId(isEditing ? null : scene.id)
                      }
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E6DCD0] bg-[#FFFDF8] px-3 text-xs font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC]"
                    >
                      {isEditing ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#059669]" />
                          Done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() => void onRegenerateScene(idx)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-3 text-xs font-semibold text-[#5B21B6] transition-colors hover:bg-[#EDE9FE] disabled:opacity-60"
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {isRegenerating ? 'Rewriting...' : 'Regenerate'}
                    </button>
                  </div>
                </div>

                {/* Scene Visual Thumbnail + Action Description */}
                <div className="flex gap-3.5">
                  <div className="h-28 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#FAF4EC]">
                    {scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        alt={`Scene ${scene.sceneNumber} ${scene.phase}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#8C7C83]">
                        9:16
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={scene.description}
                        onChange={(e) =>
                          updateSceneDescription(scene.id, e.target.value)
                        }
                        aria-label={`Scene ${scene.sceneNumber} description`}
                        className="w-full rounded-xl border border-[#D8CBBF] bg-[#FFFDF8] p-2.5 text-xs leading-relaxed text-[#1F1A1C]"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-[#3F3539]">
                        {scene.description}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-[#8C7C83]">
                      Audio cue: {scene.sfxCue}
                    </p>
                  </div>
                </div>

                {/* Dialogue & Subtitles */}
                <div className="space-y-2.5 pt-1">
                  {scene.lines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-2xl bg-[#FAF6F0] px-3.5 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#1F1A1C]">
                          {line.speaker}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[#7D6E74] tabular-nums">
                            {line.startTime.toFixed(1)}s – {line.endTime.toFixed(1)}s
                          </span>
                          <button
                            type="button"
                            disabled={auditioningLineId === line.id}
                            onClick={() => void onAuditionLine(line)}
                            aria-label={`Hear ${line.speaker} voice`}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#DDD6FE] bg-white px-2 text-[11px] font-semibold text-[#5B21B6] transition-colors hover:bg-[#F5F3FF] disabled:opacity-60"
                          >
                            {auditioningLineId === line.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                            {audioClips[line.id] ? 'Voice' : 'Speak'}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <input
                            type="text"
                            value={line.speaker}
                            onChange={(e) =>
                              updateLine(scene.id, line.id, {
                                speaker: e.target.value,
                              })
                            }
                            aria-label="Speaker"
                            className="min-h-[38px] w-full rounded-lg border border-[#D8CBBF] bg-white px-2.5 text-xs font-semibold"
                          />
                          <input
                            type="text"
                            value={line.text}
                            onChange={(e) =>
                              updateLine(scene.id, line.id, {
                                text: e.target.value,
                              })
                            }
                            aria-label="English subtitle dialogue"
                            className="min-h-[40px] w-full rounded-lg border border-[#D8CBBF] bg-white px-2.5 text-sm font-semibold"
                          />
                          <input
                            type="text"
                            value={line.korean}
                            onChange={(e) =>
                              updateLine(scene.id, line.id, {
                                korean: e.target.value,
                              })
                            }
                            aria-label="Korean translation"
                            className="min-h-[38px] w-full rounded-lg border border-[#D8CBBF] bg-white px-2.5 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold leading-snug text-[#1F1A1C]">
                            {renderHighlightedDialogue(line.text)}
                          </p>
                          <p className="mt-1 text-xs text-[#6B5D63]">
                            {line.korean}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#E6DCD0] bg-white px-5 py-3 text-sm font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scene Setup
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#E11D48] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#BE123C] whitespace-nowrap shrink-0"
        >
          Generate Voice & 30s Clip
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
