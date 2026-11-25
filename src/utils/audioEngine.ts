import type { GeneratedAudioClip, StoryScene } from '../types';

export async function decodeAudioClips(
  ctx: AudioContext,
  clips: Record<string, GeneratedAudioClip>
): Promise<Record<string, AudioBuffer>> {
  const decoded: Record<string, AudioBuffer> = {};
  const entries = Object.entries(clips);

  await Promise.all(
    entries.map(async ([lineId, clip]) => {
      try {
        const res = await fetch(clip.audioDataUrl);
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        decoded[lineId] = audioBuf;
      } catch {
        // Skip corrupt audio buffer gracefully
      }
    })
  );

  return decoded;
}

export function scheduleOriginalScore(
  ctx: AudioContext,
  destination: AudioNode,
  startAt: number,
  offsetSec: number
): () => void {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(destination);

  const activeNodes: Array<{ stop: () => void }> = [];

  const scheduleTone = (
    timeSec: number,
    freq: number,
    durationSec: number,
    type: OscillatorType,
    peakGain: number,
    endFreq?: number
  ) => {
    if (timeSec + durationSec < offsetSec || timeSec > 30) return;
    const relStart = Math.max(0, timeSec - offsetSec);
    const when = startAt + relStart;
    const trimmedDur =
      timeSec < offsetSec ? durationSec - (offsetSec - timeSec) : durationSec;
    if (trimmedDur <= 0.03) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, endFreq),
        when + trimmedDur
      );
    }

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peakGain, when + Math.min(0.05, trimmedDur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + trimmedDur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(when);
    osc.stop(when + trimmedDur + 0.02);
    activeNodes.push(osc);
  };

  // Scene 1 (0-7s): Romantic candlelit chords -> sudden dramatic sting
  const s1Chords = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [146.83, 174.61, 220.0, 261.63], // Dm7
  ];
  s1Chords.forEach((chord, idx) => {
    chord.forEach((f) => scheduleTone(idx * 1.4, f, 1.35, 'triangle', 0.14));
  });
  // Shock sting at 0.7s and 3.4s
  scheduleTone(0.7, 98.0, 0.9, 'sawtooth', 0.28, 65.41);
  scheduleTone(0.7, 466.16, 0.55, 'sine', 0.16, 440);
  scheduleTone(3.6, 110.0, 1.8, 'triangle', 0.22);
  scheduleTone(4.4, 164.81, 2.2, 'sine', 0.15);

  // Scene 2 (7-15s): Nervous pizzicato tension pulse
  const tensionBass = [130.81, 138.59, 146.83, 138.59];
  for (let t = 7.0; t < 15.0; t += 0.5) {
    const step = Math.floor((t - 7.0) * 2);
    const note = tensionBass[step % tensionBass.length];
    scheduleTone(t, note, 0.22, 'triangle', 0.24);
    if (step % 2 === 1) {
      scheduleTone(t, note * 2, 0.14, 'sine', 0.12);
    }
  }

  // Scene 3 (15-23s): Diamond sparkle chime + slow-motion falling drop
  const sparkle = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  sparkle.forEach((f, idx) => {
    scheduleTone(15.2 + idx * 0.12, f, 0.9, 'sine', 0.16);
  });
  // Dramatic chord swell & slow-motion descent at 18.8s
  scheduleTone(18.8, 392.0, 3.6, 'sawtooth', 0.16, 130.81);
  scheduleTone(18.8, 196.0, 3.8, 'triangle', 0.22, 82.41);

  // Scene 4 (23-30s): Upbeat playful walk-out -> comedic freeze trombone sting
  const walkout = [261.63, 329.63, 392.0, 440.0, 523.25, 392.0];
  walkout.forEach((f, idx) => {
    scheduleTone(25.2 + idx * 0.42, f, 0.35, 'triangle', 0.2);
  });
  // Comedic "wah-wah-waaah" at 28.1s
  scheduleTone(28.0, 233.08, 0.32, 'sawtooth', 0.24, 220.0);
  scheduleTone(28.35, 220.0, 0.32, 'sawtooth', 0.24, 207.65);
  scheduleTone(28.7, 196.0, 1.1, 'sawtooth', 0.26, 146.83);

  return () => {
    activeNodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        // Ignore already stopped
      }
    });
    try {
      masterGain.disconnect();
    } catch {
      // Ignore disconnect error
    }
  };
}

export function scheduleDialogueAudio(
  ctx: AudioContext,
  destination: AudioNode,
  scenes: StoryScene[],
  decodedBuffers: Record<string, AudioBuffer>,
  startAt: number,
  offsetSec: number
): () => void {
  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 1.05;
  voiceGain.connect(destination);

  const sources: AudioBufferSourceNode[] = [];
  const allLines = scenes.flatMap((s) => s.lines);

  allLines.forEach((line, idx) => {
    const buffer = decodedBuffers[line.id];
    if (!buffer) return;

    const nextLine = allLines[idx + 1];
    const maxSlot = nextLine
      ? Math.max(0.8, nextLine.startTime - line.startTime - 0.08)
      : Math.max(0.8, 29.4 - line.startTime);

    const rate =
      buffer.duration > maxSlot
        ? Math.min(1.22, buffer.duration / maxSlot)
        : 1.0;

    const effectiveDur = buffer.duration / rate;
    if (line.startTime + effectiveDur <= offsetSec || line.startTime >= 30) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.connect(voiceGain);

    if (line.startTime < offsetSec) {
      const skip = (offsetSec - line.startTime) * rate;
      src.start(startAt, skip);
    } else {
      src.start(startAt + (line.startTime - offsetSec));
    }
    sources.push(src);
  });

  return () => {
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // Ignore stopped
      }
    });
    try {
      voiceGain.disconnect();
    } catch {
      // Ignore disconnect
    }
  };
}
