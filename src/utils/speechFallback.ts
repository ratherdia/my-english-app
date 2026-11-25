import type { DialogueLine } from '../types';

let cachedVoices: SpeechSynthesisVoice[] = [];

const BLOCKED_NOVELTY_VOICES = [
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'eddy',
  'flo',
  'fred',
  'good news',
  'grandma',
  'grandpa',
  'jester',
  'junior',
  'kathy',
  'organ',
  'ralph',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
  'espeak',
];

const FEMALE_KEYWORDS = [
  'ava',
  'allison',
  'samantha',
  'aria',
  'jenny',
  'michelle',
  'zira',
  'susan',
  'victoria',
  'nicky',
  'google us english',
  'female',
];

const MALE_KEYWORDS = [
  'aaron',
  'alex',
  'andrew',
  'christopher',
  'eric',
  'ryan',
  'david',
  'mark',
  'guy',
  'steven',
  'tom',
  'nathan',
  'evan',
  'male',
];

function isBlockedVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  return BLOCKED_NOVELTY_VOICES.some((banned) => n.includes(banned));
}

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices.filter((v) => !isBlockedVoice(v));
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoices();
  });
}

function findVoice(
  list: SpeechSynthesisVoice[],
  keywords: string[]
): SpeechSynthesisVoice | null {
  for (const kw of keywords) {
    const match = list.find((v) => v.name.toLowerCase().includes(kw));
    if (match) return match;
  }
  return null;
}

function pickVoiceForSpeaker(
  speaker: string,
  emotion: string,
  slotDurationSec: number,
  wordCount: number
): {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
  volume: number;
} {
  const voices = refreshVoices();
  const enUs = voices.filter((v) =>
    v.lang.toLowerCase().replace('_', '-').startsWith('en-us')
  );
  const enAll = voices.filter((v) =>
    v.lang.toLowerCase().replace('_', '-').startsWith('en')
  );
  const americanPool = enUs.length > 0 ? enUs : enAll;

  // Estimate natural speech duration (including ~0.22s TTS onset) so lines fit cleanly inside their slot
  const approxNaturalSec = Math.max(0.75, wordCount / 2.7 + 0.22);
  const fitRate =
    slotDurationSec > 0 && approxNaturalSec > slotDurationSec * 0.92
      ? Math.min(1.16, approxNaturalSec / (slotDurationSec * 0.9))
      : 1.0;

  const strawberryVoice =
    findVoice(americanPool, [
      'ava',
      'allison',
      'samantha',
      'aria',
      'jenny',
      'google us english',
      ...FEMALE_KEYWORDS,
    ]) ??
    americanPool[0] ??
    null;

  const lower = speaker.toLowerCase();
  const emo = emotion.toLowerCase();

  if (lower.includes('strawberry')) {
    const isIntense =
      emo.includes('shock') ||
      emo.includes('furious') ||
      emo.includes('heartbroken') ||
      emo.includes('disbelief');
    return {
      voice: strawberryVoice,
      pitch: isIntense ? 1.07 : 1.03,
      rate: Math.max(isIntense ? 1.02 : 1.0, fitRate),
      volume: 1.0,
    };
  }

  if (lower.includes('blueberry')) {
    // Prefer a distinct American (en-US) female voice; only vary pitch if browser has a single US female voice
    const nonStrawberryUs = americanPool.filter(
      (v) =>
        v !== strawberryVoice &&
        !MALE_KEYWORDS.some((mk) => v.name.toLowerCase().includes(mk))
    );
    const blueberryPreferred = [
      'victoria',
      'susan',
      'michelle',
      'zira',
      'nicky',
      'allison',
      'ava',
      'samantha',
      'google us english',
      ...FEMALE_KEYWORDS,
    ];
    const secondUsFemale = findVoice(nonStrawberryUs, blueberryPreferred);
    const blueberryVoice = secondUsFemale ?? strawberryVoice;

    return {
      voice: blueberryVoice,
      pitch: secondUsFemale ? 0.98 : 0.94,
      rate: Math.max(0.96, fitRate),
      volume: 1.0,
    };
  }

  if (lower.includes('banana')) {
    const usMale = findVoice(americanPool, MALE_KEYWORDS);
    const basePitch = usMale ? 0.96 : 0.88;
    // Confident at first -> increasingly nervous/panicked -> defeated whisper
    if (emo.includes('defeated') || emo.includes('whisper')) {
      return {
        voice: usMale ?? americanPool[0] ?? null,
        pitch: Math.max(0.82, basePitch - 0.04),
        rate: Math.max(0.94, fitRate),
        volume: 0.88,
      };
    }
    if (
      emo.includes('frantic') ||
      emo.includes('panic') ||
      emo.includes('profusely')
    ) {
      return {
        voice: usMale ?? americanPool[0] ?? null,
        pitch: Math.min(1.08, basePitch + 0.08),
        rate: Math.max(1.08, fitRate),
        volume: 1.0,
      };
    }
    if (emo.includes('anxious') || emo.includes('sweat') || emo.includes('bluff')) {
      return {
        voice: usMale ?? americanPool[0] ?? null,
        pitch: Math.min(1.04, basePitch + 0.04),
        rate: Math.max(1.04, fitRate),
        volume: 1.0,
      };
    }
    return {
      voice: usMale ?? americanPool[0] ?? null,
      pitch: basePitch,
      rate: Math.max(1.0, fitRate),
      volume: 1.0,
    };
  }

  return { voice: americanPool[0] ?? null, pitch: 1.0, rate: fitRate, volume: 1.0 };
}

export function unlockWebSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    refreshVoices();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    // Ignore
  }
}

export function stopWebSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore
  }
}

export function speakDialogueLineWebSpeech(
  line: DialogueLine,
  isMuted = false
): void {
  if (isMuted) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    const synth = window.speechSynthesis;
    const wasSpeaking = synth.speaking || synth.pending;
    if (wasSpeaking) {
      synth.cancel();
    }

    const words = line.text.trim().split(/\s+/).filter(Boolean).length;
    const slotDurationSec = Math.max(0.8, line.endTime - line.startTime);
    const { voice, pitch, rate, volume } = pickVoiceForSpeaker(
      line.speaker,
      line.emotion || '',
      slotDurationSec,
      words
    );

    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = voice?.lang || 'en-US';
    if (voice) utterance.voice = voice;
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    if (wasSpeaking) {
      setTimeout(() => {
        try {
          synth.speak(utterance);
        } catch {
          // Ignore
        }
      }, 45);
    } else {
      synth.speak(utterance);
    }
  } catch {
    // Ignore
  }
}
