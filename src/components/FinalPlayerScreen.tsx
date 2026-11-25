import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
  AnimationStyle,
  ExpressionItem,
  GeneratedAudioClip,
  QuizQuestion,
  StoryScene,
} from '../types';
import {
  CREDIT_TEXT,
  detectVideoExportSupport,
  recordFull30sVideo,
} from '../utils/videoCanvasRenderer';
import { VerticalVideoPlayer } from './VerticalVideoPlayer';

interface FinalPlayerScreenProps {
  title: string;
  scenes: StoryScene[];
  expressions: ExpressionItem[];
  audioClips: Record<string, GeneratedAudioClip>;
  animationStyle: AnimationStyle;
  quiz: QuizQuestion[];
  onGenerateFreshQuiz: () => Promise<void>;
  isGeneratingQuiz: boolean;
  quizError: string | null;
  showKorean: boolean;
  onToggleKorean: () => void;
  onEnsureVoices: () => Promise<Record<string, GeneratedAudioClip>>;
  isSynthesizingVoices: boolean;
  onBackToGenerator: () => void;
}

export function FinalPlayerScreen({
  title,
  scenes,
  expressions,
  audioClips,
  animationStyle,
  quiz,
  onGenerateFreshQuiz,
  isGeneratingQuiz,
  quizError,
  showKorean,
  onToggleKorean,
  onEnsureVoices,
  isSynthesizingVoices,
  onBackToGenerator,
}: FinalPlayerScreenProps) {
  const [seekRequestSec, setSeekRequestSec] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Quiz interactive state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const exportSupport = useMemo(() => detectVideoExportSupport(), []);
  const playerAnchorRef = useRef<HTMLDivElement | null>(null);

  // Collect expressions used in the video + first timestamp they appear
  const expressionsInVideo = useMemo(() => {
    const allLines = scenes.flatMap((s) => s.lines);
    return expressions.map((expr) => {
      const matchingLine = allLines.find(
        (l) =>
          l.usedExpressionIds.includes(expr.id) ||
          l.text.toLowerCase().includes(expr.phrase.toLowerCase())
      );
      return {
        ...expr,
        timestampSec: matchingLine?.startTime ?? null,
        spokenLine: matchingLine?.text ?? null,
      };
    });
  }, [expressions, scenes]);

  const handleExportVideo = async () => {
    if (!exportSupport.supported) {
      setExportError(
        'Video export requires the browser MediaRecorder API, which is not available in this browser.'
      );
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);
    setExportStatusMsg(
      `Rendering 30-second 9:16 ${exportSupport.extension.toUpperCase()} with voiceover, music, subtitles, and credits...`
    );

    try {
      // Load images cleanly before recording
      const loadedImages: Record<string, HTMLImageElement> = {};
      await Promise.all(
        scenes.map(
          (scene) =>
            new Promise<void>((resolve) => {
              if (!scene.imageUrl) {
                resolve();
                return;
              }
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.referrerPolicy = 'no-referrer';
              img.onload = () => {
                loadedImages[scene.id] = img;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = scene.imageUrl;
            })
        )
      );

      const ensuredClips = await onEnsureVoices();

      const blob = await recordFull30sVideo({
        scenes,
        images: loadedImages,
        audioClips: ensuredClips,
        animationStyle,
        showKorean,
        mimeType: exportSupport.mimeType,
        onProgress: (pct) => setExportProgress(pct),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      a.href = url;
      a.download = `${safeTitle || 'aycaramba-clip'}-30s.${exportSupport.extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportStatusMsg(
        `Exported ${exportSupport.extension.toUpperCase()} (${(blob.size / (1024 * 1024)).toFixed(1)} MB).`
      );
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to export 30-second video.'
      );
      setExportStatusMsg(null);
    } finally {
      setIsExporting(false);
    }
  };

  const jumpToTimestamp = (sec: number) => {
    setSeekRequestSec(sec);
    playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = quiz.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correctIndex ? acc + 1 : acc;
  }, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">
            Step 05 · Screening Room & Vocabulary Quiz
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F1A1C] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#5E5056]">
            {CREDIT_TEXT} · 30-second vertical animated clip
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToGenerator}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD0] bg-white px-4 py-2 text-xs font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Voices & Clips
        </button>
      </div>

      {/* Main 2-Column Screening + Study Split */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* Left: 9:16 Vertical Video Player & Download */}
        <div ref={playerAnchorRef} className="space-y-4 lg:col-span-5">
          <VerticalVideoPlayer
            scenes={scenes}
            expressions={expressions}
            audioClips={audioClips}
            animationStyle={animationStyle}
            seekRequestSec={seekRequestSec}
            onSeekHandled={() => setSeekRequestSec(null)}
            showKorean={showKorean}
            onToggleKorean={onToggleKorean}
            onEnsureVoices={onEnsureVoices}
            isSynthesizingVoices={isSynthesizingVoices}
          />

          {/* Video Download Card */}
          <div className="rounded-3xl border border-[#EDE3D8] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#1F1A1C]">
                Export 30-Second Vertical Video
              </h2>
              <span className="font-mono text-xs text-[#6B5D63] tabular-nums">
                720×1280 · 9:16
              </span>
            </div>

            {!exportSupport.supported ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-[#F59E0B] bg-[#FEFCE8] p-3 text-xs text-[#854D0E]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#CA8A04]" />
                <span>
                  MP4/WebM export is unavailable because this browser does not
                  support MediaRecorder canvas capture.
                </span>
              </div>
            ) : (
              <>
                {!exportSupport.isMp4 && (
                  <p className="text-xs text-[#854D0E]">
                    Direct MP4 encoding is not supported in this browser; WebM
                    video export is available below (open in Chrome/Safari for
                    native MP4 export).
                  </p>
                )}

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportVideo}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1F1A1C] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#362E31] disabled:opacity-65"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="font-mono tabular-nums">
                        Rendering Video ({exportProgress}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download 30s {exportSupport.extension.toUpperCase()} Video
                    </>
                  )}
                </button>

                {isExporting && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFE6DC]">
                    <div
                      className="h-full bg-[#E11D48] transition-all"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                )}
              </>
            )}

            {exportStatusMsg && !isExporting && (
              <p className="text-xs font-medium text-[#047857]">
                {exportStatusMsg}
              </p>
            )}
            {exportError && (
              <p className="text-xs font-medium text-[#BE123C]">{exportError}</p>
            )}
          </div>
        </div>

        {/* Right: Expressions Used + 3-Question Vocabulary Quiz */}
        <div className="space-y-6 lg:col-span-7">
          {/* Expressions Featured in Video */}
          <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[#1F1A1C]">
                Expressions Featured in This Clip
              </h2>
              <span className="font-mono text-xs text-[#6B5D63] tabular-nums">
                {expressionsInVideo.length} expressions
              </span>
            </div>

            <div className="divide-y divide-[#F3ECE2]">
              {expressionsInVideo.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-bold text-[#1F1A1C]">
                        {item.phrase}
                      </span>
                      <span className="text-xs font-semibold text-[#6D28D9]">
                        {item.korean}
                      </span>
                      <span className="text-xs text-[#8C7C83]">
                        · {item.movie}
                      </span>
                    </div>
                    {item.spokenLine && (
                      <p className="mt-0.5 truncate text-xs text-[#5E5056]">
                        “{item.spokenLine}”
                      </p>
                    )}
                  </div>

                  {item.timestampSec !== null && (
                    <button
                      type="button"
                      onClick={() => jumpToTimestamp(item.timestampSec!)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-xl bg-[#FFF1F2] px-3 text-xs font-semibold text-[#BE123C] transition-colors hover:bg-[#FFE4E6] sm:self-center whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span className="font-mono tabular-nums">
                        00:{String(Math.floor(item.timestampSec)).padStart(2, '0')}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 3-Question English Vocabulary Quiz */}
          <section className="rounded-3xl border border-[#EDE3D8] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3ECE2] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1F1A1C]">
                  3-Question English Vocabulary Quiz
                </h2>
                <p className="mt-0.5 text-xs text-[#6B5D63]">
                  Test your understanding of the movie expressions from the story.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-[#5E5056] tabular-nums">
                  Score: {correctCount}/{quiz.length}
                </span>
                <button
                  type="button"
                  disabled={isGeneratingQuiz}
                  onClick={() => {
                    setSelectedAnswers({});
                    void onGenerateFreshQuiz();
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-3 text-xs font-semibold text-[#5B21B6] transition-colors hover:bg-[#EDE9FE] disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {isGeneratingQuiz ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  New Quiz
                </button>
              </div>
            </div>

            {quizError && (
              <div
                role="alert"
                className="rounded-2xl border border-[#FDA4AF] bg-[#FFF1F2] px-4 py-3 text-xs text-[#9F1239]"
              >
                {quizError}
              </div>
            )}

            <div className="space-y-5">
              {quiz.map((q, qIdx) => {
                const chosen = selectedAnswers[q.id];
                const hasAnswered = chosen !== undefined;
                const isCorrect = chosen === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-[#EFE6DC] bg-[#FFFDF8] p-4 space-y-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-[#E11D48]">
                        Question {qIdx + 1} · {q.expressionPhrase}
                      </span>
                      {hasAnswered && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            isCorrect ? 'text-[#047857]' : 'text-[#BE123C]'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Try reviewing
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold leading-snug text-[#1F1A1C]">
                      {q.question}
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isPicked = chosen === optIdx;
                        const isRightOption = q.correctIndex === optIdx;

                        let btnClass =
                          'border-[#E6DCD0] bg-white text-[#2D2428] hover:bg-[#FAF4EC]';
                        if (hasAnswered) {
                          if (isRightOption) {
                            btnClass =
                              'border-[#10B981] bg-[#ECFDF5] text-[#065F46] font-semibold';
                          } else if (isPicked) {
                            btnClass =
                              'border-[#FB7185] bg-[#FFF1F2] text-[#9F1239]';
                          } else {
                            btnClass =
                              'border-[#EFE6DC] bg-white/70 text-[#8C7C83]';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() =>
                              setSelectedAnswers((prev) => ({
                                ...prev,
                                [q.id]: optIdx,
                              }))
                            }
                            className={`min-h-[44px] w-full rounded-xl border px-3.5 py-2.5 text-left text-xs transition-colors ${btnClass}`}
                          >
                            <span className="mr-2 font-mono font-bold">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {hasAnswered && (
                      <div className="rounded-xl bg-[#F5F3FF] px-3.5 py-2.5 text-xs leading-relaxed text-[#4C1D95]">
                        <p className="font-semibold">{q.explanationEn}</p>
                        <p className="mt-1 text-[#6D28D9]">{q.explanationKo}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {answeredCount === quiz.length && quiz.length > 0 && (
              <div className="rounded-2xl bg-[#FEFCE8] px-4 py-3 text-center text-xs font-semibold text-[#854D0E]">
                Quiz complete: {correctCount} out of {quiz.length} expressions
                mastered.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
