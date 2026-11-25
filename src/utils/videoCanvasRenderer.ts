import type {
  AnimationStyle,
  DialogueLine,
  GeneratedAudioClip,
  StoryScene,
} from '../types';
import {
  decodeAudioClips,
  scheduleDialogueAudio,
  scheduleOriginalScore,
} from './audioEngine';

export const TOTAL_VIDEO_DURATION = 30;
export const CREDIT_TEXT = 'Made with Google AI Studio · Script by [원태연]';

export function wrapSubtitleTwoLines(text: string, maxCharsPerLine = 32): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const full = words.join(' ');
  if (full.length <= maxCharsPerLine) return [full];

  // Split near midpoint on a word boundary so max 2 balanced lines
  const mid = Math.ceil(full.length / 2);
  let bestSplit = -1;
  let bestDist = Infinity;
  let running = 0;

  for (let i = 0; i < words.length - 1; i++) {
    running += words[i].length + (i > 0 ? 1 : 0);
    const dist = Math.abs(running - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestSplit = i + 1;
    }
  }

  if (bestSplit <= 0) return [full];
  const line1 = words.slice(0, bestSplit).join(' ');
  const line2 = words.slice(bestSplit).join(' ');
  return [line1, line2];
}

export function getActiveSceneAndLine(
  scenes: StoryScene[],
  timeSec: number
): { scene: StoryScene; line: DialogueLine | null } {
  const clamped = Math.max(0, Math.min(TOTAL_VIDEO_DURATION, timeSec));
  const scene =
    scenes.find((s) => clamped >= s.startTime && clamped < s.endTime) ??
    scenes[scenes.length - 1];

  const line =
    scene.lines.find((l) => clamped >= l.startTime && clamped <= l.endTime) ?? null;

  return { scene, line };
}

function getCameraTransform(
  scene: StoryScene,
  timeSec: number
): { scale: number; offsetX: number; offsetY: number; isFreeze: boolean } {
  const dur = Math.max(1, scene.endTime - scene.startTime);
  const progress = Math.max(0, Math.min(1, (timeSec - scene.startTime) / dur));

  switch (scene.motionPreset) {
    case 'zoom-in-shock': {
      // Gentle entrance, then sudden dramatic shock zoom at 10% progress
      if (progress < 0.12) {
        return {
          scale: 1.0 + progress * 0.4,
          offsetX: 0,
          offsetY: 0,
          isFreeze: false,
        };
      }
      const shock = Math.min(1, (progress - 0.12) / 0.25);
      const jolt = progress > 0.12 && progress < 0.24 ? Math.sin(timeSec * 45) * 6 : 0;
      return {
        scale: 1.05 + shock * 0.16,
        offsetX: -18 * shock + jolt,
        offsetY: -12 * shock,
        isFreeze: false,
      };
    }
    case 'alternating-closeup': {
      // Pan gently left/right between Banana and Strawberry
      const wave = Math.sin(progress * Math.PI * 2);
      return {
        scale: 1.12 + Math.abs(wave) * 0.05,
        offsetX: wave * 34,
        offsetY: -10,
        isFreeze: false,
      };
    }
    case 'slow-mo-drop': {
      // Zoom toward center, then slow-mo downward tilt during falling gift box
      const slowPan = progress > 0.48 ? (progress - 0.48) * 38 : 0;
      return {
        scale: 1.06 + progress * 0.12,
        offsetX: 10 - progress * 16,
        offsetY: slowPan,
        isFreeze: false,
      };
    }
    case 'freeze-finale': {
      // Normal pan, then snap-zoom & freeze on Banana's devastated face on the left from 28.4s onward
      const freezeStart = 28.4;
      if (timeSec >= freezeStart) {
        return {
          scale: 1.28,
          offsetX: 96,
          offsetY: 18,
          isFreeze: true,
        };
      }
      return {
        scale: 1.03 + progress * 0.1,
        offsetX: progress * 30,
        offsetY: progress * 8,
        isFreeze: false,
      };
    }
  }
}

function getStyleFilter(style: AnimationStyle): string {
  switch (style) {
    case '2D Animation':
      return 'saturate(1.22) contrast(1.12)';
    case 'Clay':
      return 'saturate(1.08) contrast(1.06) sepia(0.08)';
    case 'Watercolor':
      return 'saturate(0.92) brightness(1.05) contrast(0.95)';
    case 'Realistic':
      return 'contrast(1.08) saturate(0.96)';
    case '3D Animation':
    default:
      return 'saturate(1.06) contrast(1.03)';
  }
}

export function renderFrameToCanvas(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timeSec: number;
  scenes: StoryScene[];
  images: Record<string, HTMLImageElement>;
  animationStyle: AnimationStyle;
  showKorean: boolean;
}) {
  const { ctx, width, height, timeSec, scenes, images, animationStyle, showKorean } =
    params;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#181014';
  ctx.fillRect(0, 0, width, height);

  const { scene, line } = getActiveSceneAndLine(scenes, timeSec);
  const img = images[scene.id];
  const { scale, offsetX, offsetY, isFreeze } = getCameraTransform(scene, timeSec);

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.filter = getStyleFilter(animationStyle);

    // Cover-fit 9:16 canvas with camera transform
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = width / height;
    let drawW = width;
    let drawH = height;
    if (imgRatio > canvasRatio) {
      drawH = height;
      drawW = height * imgRatio;
    } else {
      drawW = width;
      drawH = width / imgRatio;
    }

    ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  // Smooth fade-in from previous scene for the first 0.25s of scenes 2-4
  const sceneElapsed = timeSec - scene.startTime;
  if (scene.sceneNumber > 1 && sceneElapsed < 0.25) {
    const prevScene = scenes[scene.sceneNumber - 2];
    const prevImg = prevScene ? images[prevScene.id] : undefined;
    if (prevImg && prevImg.complete && prevImg.naturalWidth > 0) {
      const alpha = 1 - sceneElapsed / 0.25;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(prevImg, 0, 0, width, height);
      ctx.restore();
    }
  }

  // Scene 3 diamond sparkle glint aligned with Blueberry's raised ring finger
  if (scene.sceneNumber === 3 && timeSec >= 15.2 && timeSec <= 18.2) {
    const glintAlpha = Math.sin(((timeSec - 15.2) / 3.0) * Math.PI) * 0.6;
    const gx = width * 0.725;
    const gy = height * 0.485;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, 85);
    grad.addColorStop(0, `rgba(255, 255, 255, ${glintAlpha})`);
    grad.addColorStop(0.4, `rgba(253, 224, 71, ${glintAlpha * 0.45})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Freeze-frame comic vignette at ending
  if (isFreeze) {
    const vig = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.28,
      width / 2,
      height / 2,
      width * 0.8
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(15, 8, 12, 0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // Measured contrast scrim at bottom for subtitle legibility
  const scrim = ctx.createLinearGradient(0, height * 0.62, 0, height);
  scrim.addColorStop(0, 'rgba(15, 10, 14, 0)');
  scrim.addColorStop(0.55, 'rgba(15, 10, 14, 0.45)');
  scrim.addColorStop(1, 'rgba(15, 10, 14, 0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, height * 0.62, width, height * 0.38);

  // Subtitles (Bold white English with thick dark outline, max 2 lines)
  if (line) {
    const wrapped = wrapSubtitleTwoLines(line.text, 30).slice(0, 2);
    const baseSubY = showKorean ? height - 178 : height - 134;

    // Speaker label clearly attributing who is speaking
    ctx.save();
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const speakerColor =
      line.speaker.toLowerCase().includes('strawberry')
        ? '#FDA4AF'
        : line.speaker.toLowerCase().includes('banana')
          ? '#FDE047'
          : '#C4B5FD';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#140F12';
    const speakerTag = `${line.speaker.toUpperCase()} SPEAKING`;
    ctx.strokeText(speakerTag, width / 2, baseSubY - 48);
    ctx.fillStyle = speakerColor;
    ctx.fillText(speakerTag, width / 2, baseSubY - 48);

    // Bold white English subtitle lines with dark outline
    ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#140F12';
    ctx.fillStyle = '#FFFFFF';

    wrapped.forEach((textLine, idx) => {
      const y = baseSubY + idx * 42;
      ctx.strokeText(textLine, width / 2, y);
      ctx.fillText(textLine, width / 2, y);
    });

    if (showKorean && line.korean) {
      ctx.font = '600 23px "Noto Sans KR", "DM Sans", sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(20, 15, 18, 0.92)';
      ctx.fillStyle = '#FEF3C7';
      const koY = baseSubY + wrapped.length * 42 + 12;
      ctx.strokeText(line.korean, width / 2, koY);
      ctx.fillText(line.korean, width / 2, koY);
    }
    ctx.restore();
  }

  // Required end credit displayed cleanly at end of video (28.3s - 30.0s)
  if (timeSec >= 28.3) {
    const fadeIn = Math.min(1, (timeSec - 28.3) / 0.45);
    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = 'rgba(18, 12, 16, 0.78)';
    ctx.fillRect(48, height - 86, width - 96, 46);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(48, height - 86, width - 96, 46);

    ctx.font = '600 20px "Plus Jakarta Sans", "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#FFFDF8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CREDIT_TEXT, width / 2, height - 63);
    ctx.restore();
  }
}

export interface VideoExportSupport {
  supported: boolean;
  isMp4: boolean;
  mimeType: string;
  extension: 'mp4' | 'webm';
}

export function detectVideoExportSupport(): VideoExportSupport {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { supported: false, isMp4: false, mimeType: '', extension: 'mp4' };
  }

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  for (const mime of mp4Candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { supported: true, isMp4: true, mimeType: mime, extension: 'mp4' };
    }
  }

  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const mime of webmCandidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { supported: true, isMp4: false, mimeType: mime, extension: 'webm' };
    }
  }

  return { supported: false, isMp4: false, mimeType: '', extension: 'mp4' };
}

export async function recordFull30sVideo(params: {
  scenes: StoryScene[];
  images: Record<string, HTMLImageElement>;
  audioClips: Record<string, GeneratedAudioClip>;
  animationStyle: AnimationStyle;
  showKorean: boolean;
  mimeType: string;
  onProgress: (pct: number) => void;
}): Promise<Blob> {
  const { scenes, images, audioClips, animationStyle, showKorean, mimeType, onProgress } =
    params;

  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for video export.');
  }

  const audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const dest = audioCtx.createMediaStreamDestination();
  const decoded = await decodeAudioClips(audioCtx, audioClips);

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 3_200_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    let rafId = 0;
    let stopScore: (() => void) | null = null;
    let stopVoice: (() => void) | null = null;

    recorder.onerror = (ev) => {
      cancelAnimationFrame(rafId);
      stopScore?.();
      stopVoice?.();
      audioCtx.close().catch(() => {});
      reject(new Error(`Recording error: ${String(ev)}`));
    };

    recorder.onstop = () => {
      cancelAnimationFrame(rafId);
      stopScore?.();
      stopVoice?.();
      audioCtx.close().catch(() => {});
      resolve(new Blob(chunks, { type: mimeType }));
    };

    const startAudioTime = audioCtx.currentTime + 0.05;
    stopScore = scheduleOriginalScore(audioCtx, dest, startAudioTime, 0);
    stopVoice = scheduleDialogueAudio(audioCtx, dest, scenes, decoded, startAudioTime, 0);

    recorder.start(250);
    const startPerf = performance.now();

    const tick = () => {
      const elapsedSec = (performance.now() - startPerf) / 1000;
      const clamped = Math.min(TOTAL_VIDEO_DURATION, elapsedSec);

      renderFrameToCanvas({
        ctx,
        width: canvas.width,
        height: canvas.height,
        timeSec: clamped,
        scenes,
        images,
        animationStyle,
        showKorean,
      });

      onProgress(Math.min(100, Math.round((clamped / TOTAL_VIDEO_DURATION) * 100)));

      if (elapsedSec >= TOTAL_VIDEO_DURATION) {
        recorder.stop();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}
