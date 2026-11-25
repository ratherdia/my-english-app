import {
  AlertTriangle,
  ArrowRight,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_EXPRESSIONS } from '../data/defaultStory';
import type { ExpressionItem } from '../types';

interface ExpressionsScreenProps {
  expressions: ExpressionItem[];
  onChange: (next: ExpressionItem[]) => void;
  onNext: () => void;
}

export function ExpressionsScreen({
  expressions,
  onChange,
  onNext,
}: ExpressionsScreenProps) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newKorean, setNewKorean] = useState('');
  const [newMovie, setNewMovie] = useState('');
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExpressionItem | null>(null);

  const distinctMovies = useMemo(() => {
    return new Set(
      expressions
        .map((e) => e.movie.trim().toLowerCase())
        .filter((m) => m.length > 0)
    );
  }, [expressions]);

  const hasEnoughExpressions = expressions.length >= 5;
  const hasEnoughMovies = distinctMovies.size >= 2;
  const meetsRequirements = hasEnoughExpressions && hasEnoughMovies;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhrase.trim() || !newKorean.trim() || !newMovie.trim()) {
      setFormError('Please enter the English expression, Korean meaning, and source movie.');
      return;
    }
    setFormError('');
    onChange([
      ...expressions,
      {
        id: `exp-${Date.now()}`,
        phrase: newPhrase.trim(),
        korean: newKorean.trim(),
        movie: newMovie.trim(),
      },
    ]);
    setNewPhrase('');
    setNewKorean('');
    setNewMovie('');
  };

  const handleDelete = (id: string) => {
    onChange(expressions.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  const startEdit = (item: ExpressionItem) => {
    setEditingId(item.id);
    setEditDraft({ ...item });
  };

  const saveEdit = () => {
    if (!editDraft) return;
    if (!editDraft.phrase.trim() || !editDraft.korean.trim() || !editDraft.movie.trim()) {
      return;
    }
    onChange(
      expressions.map((item) =>
        item.id === editDraft.id
          ? {
              ...editDraft,
              phrase: editDraft.phrase.trim(),
              korean: editDraft.korean.trim(),
              movie: editDraft.movie.trim(),
            }
          : item
      )
    );
    setEditingId(null);
    setEditDraft(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#E11D48]">Step 01 · Movie Vocabulary</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1F1A1C] sm:text-3xl">
            Collect Your Movie Expressions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5E5056]">
            Add at least five everyday English expressions from at least two different movies.
            Every phrase here is woven into your 30-second animated drama.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_EXPRESSIONS)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD0] bg-white px-4 py-2 text-xs font-semibold text-[#4B3F44] transition-colors hover:bg-[#FAF4EC] whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Default 6
        </button>
      </div>

      {/* Warning Banner when fewer than 5 expressions or fewer than 2 source movies */}
      {!meetsRequirements && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[#F59E0B] bg-[#FEFCE8] px-4 py-3.5 text-sm text-[#854D0E]"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#CA8A04]" />
          <div>
            <p className="font-bold">Minimum Expression Requirement Not Met</p>
            <p className="mt-0.5 text-xs leading-relaxed">
              Provide at least <strong>5 English expressions</strong> (currently{' '}
              <span className="font-mono tabular-nums">{expressions.length}</span>) from at least{' '}
              <strong>2 source movies</strong> (currently{' '}
              <span className="font-mono tabular-nums">{distinctMovies.size}</span>).
            </p>
          </div>
        </div>
      )}

      {/* Clean unboxed summary telemetry */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#EDE3D8] pb-3 text-xs text-[#5E5056]">
        <span className="font-mono tabular-nums">
          {expressions.length} expressions
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          {distinctMovies.size} source movies
        </span>
        <span aria-hidden="true">·</span>
        <span className={meetsRequirements ? 'font-semibold text-[#047857]' : 'font-semibold text-[#B45309]'}>
          {meetsRequirements ? 'Ready for story studio' : 'Add more items to continue'}
        </span>
      </div>

      {/* Add Expression Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-3xl border border-[#EDE3D8] bg-white p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
              English Expression
            </label>
            <input
              type="text"
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              placeholder="e.g. Break a leg"
              className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] placeholder:text-[#9D8E95] focus:border-[#E11D48] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
              Korean Meaning (한국어 뜻)
            </label>
            <input
              type="text"
              value={newKorean}
              onChange={(e) => setNewKorean(e.target.value)}
              placeholder="e.g. 행운을 빌어"
              className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] placeholder:text-[#9D8E95] focus:border-[#E11D48] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4B3F44]">
              Source Movie
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMovie}
                onChange={(e) => setNewMovie(e.target.value)}
                placeholder="e.g. La La Land"
                className="min-h-[44px] w-full rounded-xl border border-[#E2D6C8] bg-[#FFFDF8] px-3.5 text-sm text-[#1F1A1C] placeholder:text-[#9D8E95] focus:border-[#E11D48] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E11D48] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#BE123C] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {formError && (
          <p className="mt-2 text-xs font-medium text-[#BE123C]">{formError}</p>
        )}
      </form>

      {/* Expression List */}
      <div className="divide-y divide-[#EFE6DC] overflow-hidden rounded-3xl border border-[#EDE3D8] bg-white">
        {expressions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[#6B5D63]">
            No expressions yet. Add at least 5 expressions from 2 movies above.
          </div>
        ) : (
          expressions.map((item, idx) => {
            const isEditing = editingId === item.id && editDraft;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                {isEditing ? (
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      value={editDraft.phrase}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, phrase: e.target.value })
                      }
                      aria-label="Edit English expression"
                      className="min-h-[44px] rounded-xl border border-[#D8CBBF] px-3 text-sm font-semibold"
                    />
                    <input
                      type="text"
                      value={editDraft.korean}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, korean: e.target.value })
                      }
                      aria-label="Edit Korean meaning"
                      className="min-h-[44px] rounded-xl border border-[#D8CBBF] px-3 text-sm"
                    />
                    <input
                      type="text"
                      value={editDraft.movie}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, movie: e.target.value })
                      }
                      aria-label="Edit source movie"
                      className="min-h-[44px] rounded-xl border border-[#D8CBBF] px-3 text-sm"
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-xs text-[#8C7C83] tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-base font-bold text-[#1F1A1C]">
                        {item.phrase}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 pl-6 text-xs text-[#5E5056]">
                      <span className="font-medium text-[#6D28D9]">{item.korean}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.movie}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        aria-label="Save expression"
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#059669] px-3 text-white hover:bg-[#047857]"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                        aria-label="Cancel edit"
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E2D6C8] bg-white px-3 text-[#4B3F44] hover:bg-[#FAF4EC]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={`Edit ${item.phrase}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-transparent text-[#5E5056] transition-colors hover:border-[#E6DCD0] hover:bg-[#FAF4EC]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Delete ${item.phrase}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-transparent text-[#BE123C] transition-colors hover:border-[#FECDD3] hover:bg-[#FFF1F2]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Continue CTA */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#1F1A1C] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#362E31] whitespace-nowrap shrink-0"
        >
          Configure Scene & Cast
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
