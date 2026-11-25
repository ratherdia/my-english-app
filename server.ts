import { GoogleGenAI, Type } from '@google/genai';
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(apiVersion?: 'v1' | 'v1beta'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const isTransient =
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('timeout') ||
        msg.includes('econnreset');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

function getFriendlyApiError(err: unknown): { status: number; message: string; code: string; detail: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  console.error('[Aycaramba API Error]', raw);

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message: 'Please check your Gemini API key in Settings > Secrets.',
      detail: raw,
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('billing') || lower.includes('paid')) {
    return {
      status: 402,
      code: 'PAID_TIER_REQUIRED',
      message:
        'This model requires a billing-enabled (paid) Gemini API key or quota has been reached. Check Settings > Secrets or use the Animated Storyboard Slideshow mode.',
      detail: raw,
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_UNAVAILABLE',
      message: `The requested generation model is currently unavailable for this project. (${raw})`,
      detail: raw,
    };
  }
  return {
    status: 500,
    code: 'GENERATION_FAILED',
    message: raw || 'An unexpected Gemini API error occurred.',
    detail: raw,
  };
}

function selectVoiceForSpeaker(speaker: string, voiceRole?: string): {
  voiceName: 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
  baseStyle: string;
} {
  const lower = speaker.toLowerCase();
  if (voiceRole === 'emotional-female' || lower.includes('strawberry')) {
    return {
      voiceName: 'Kore',
      baseStyle:
        'Young American woman, standard US English accent, expressive animated movie-drama voice actress, warm and emotional',
    };
  }
  if (voiceRole === 'confident-female' || lower.includes('blueberry')) {
    return {
      voiceName: 'Zephyr',
      baseStyle:
        'Confident, glamorous American woman, crisp standard US English accent, poised theatrical delivery',
    };
  }
  if (voiceRole === 'nervous-male' || lower.includes('banana')) {
    return {
      voiceName: 'Puck',
      baseStyle:
        'Young American man, standard US English accent, smooth at first then flustered, anxious, and comedic',
    };
  }
  return {
    voiceName: 'Charon',
    baseStyle: 'Natural standard American English animation voice actor',
  };
}

function countWordsInScenes(scenes: Array<{ lines: Array<{ text: string }> }>): number {
  return scenes.reduce((acc, scene) => {
    const sceneWords = scene.lines.reduce((lineAcc, line) => {
      const words = line.text.trim().split(/\s+/).filter(Boolean);
      return lineAcc + words.length;
    }, 0);
    return acc + sceneWords;
  }, 0);
}

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 1. Generate complete 4-scene storyboard via gemini-4-hydrogen
app.post('/api/storyboard/generate', async (req, res) => {
  try {
    const { expressions, storyConfig, existingImages } = req.body as {
      expressions: Array<{ id: string; phrase: string; korean: string; movie: string }>;
      storyConfig: {
        title: string;
        genre: string;
        location: string;
        premise: string;
        animationStyle: string;
        characters: Array<{ name: string; appearance: string; personality: string }>;
      };
      existingImages?: string[];
    };

    if (!Array.isArray(expressions) || expressions.length < 5) {
      return res.status(400).json({
        error: 'At least 5 English expressions are required before generating a storyboard.',
      });
    }

    const ai = getAiClient();

    const prompt = `Create a 4-scene, 30-second vertical short-form animated drama script for Korean university students learning everyday English from movies.

Title: ${storyConfig.title}
Genre: ${storyConfig.genre}
Location: ${storyConfig.location}
Animation Style: ${storyConfig.animationStyle}
Story Premise: ${storyConfig.premise}

Characters (keep exact names and consistent appearances):
${storyConfig.characters.map((c) => `- ${c.name}: ${c.appearance} Personality: ${c.personality}`).join('\n')}

REQUIRED ENGLISH EXPRESSIONS (every single one must appear in the dialogue; only necessary grammatical inflections like verb tense/plural are allowed):
${expressions.map((e, i) => `${i + 1}. id="${e.id}" | "${e.phrase}" (${e.korean}) — from ${e.movie}`).join('\n')}

CRITICAL CONSTRAINTS:
1. Exactly 4 scenes with exact timestamps:
   - Scene 1 (Hook): 0 to 7 seconds
   - Scene 2 (Problem): 7 to 15 seconds
   - Scene 3 (Turn): 15 to 23 seconds
   - Scene 4 (Close): 23 to 30 seconds
2. Total spoken English dialogue across ALL 4 scenes combined MUST be strictly between 60 and 70 words (aim for 63–66 words). Count carefully!
3. Keep the story family-friendly, emotionally expressive, dramatic, and end Scene 4 with a funny twist.
4. Each line's startTime and endTime must fit inside its scene's time range sequentially without overlapping.
5. Provide natural Korean translation for each dialogue line and list which expression IDs (e.g. ["exp-1"]) appear in that line.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      config: {
        systemInstruction:
          'You are a cinematic animation director and ESL curriculum writer. Follow the 60-70 total dialogue word count strictly and include every required expression.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  phase: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  cameraDirection: { type: Type.STRING },
                  sfxCue: { type: Type.STRING },
                  musicMood: { type: Type.STRING },
                  lines: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        speaker: { type: Type.STRING },
                        text: { type: Type.STRING },
                        korean: { type: Type.STRING },
                        emotion: { type: Type.STRING },
                        startTime: { type: Type.NUMBER },
                        endTime: { type: Type.NUMBER },
                        usedExpressionIds: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                      required: [
                        'speaker',
                        'text',
                        'korean',
                        'emotion',
                        'startTime',
                        'endTime',
                        'usedExpressionIds',
                      ],
                    },
                  },
                },
                required: [
                  'sceneNumber',
                  'phase',
                  'startTime',
                  'endTime',
                  'description',
                  'cameraDirection',
                  'sfxCue',
                  'musicMood',
                  'lines',
                ],
              },
            },
          },
          required: ['scenes'],
        },
      },
    }));

    const parsed = JSON.parse((response.text ?? '{"scenes":[]}').trim()) as {
      scenes: Array<{
        sceneNumber: number;
        phase: 'Hook' | 'Problem' | 'Turn' | 'Close';
        startTime: number;
        endTime: number;
        description: string;
        cameraDirection: string;
        sfxCue: string;
        musicMood: 'suspense' | 'tension' | 'climax' | 'comedy';
        lines: Array<{
          speaker: string;
          text: string;
          korean: string;
          emotion: string;
          startTime: number;
          endTime: number;
          usedExpressionIds: string[];
        }>;
      }>;
    };

    const windows: Array<{ start: number; end: number; phase: 'Hook' | 'Problem' | 'Turn' | 'Close'; motion: string; mood: 'suspense' | 'tension' | 'climax' | 'comedy' }> = [
      { start: 0, end: 7, phase: 'Hook', motion: 'zoom-in-shock', mood: 'suspense' },
      { start: 7, end: 15, phase: 'Problem', motion: 'alternating-closeup', mood: 'tension' },
      { start: 15, end: 23, phase: 'Turn', motion: 'slow-mo-drop', mood: 'climax' },
      { start: 23, end: 30, phase: 'Close', motion: 'freeze-finale', mood: 'comedy' },
    ];

    const normalized = parsed.scenes.slice(0, 4).map((scene, idx) => {
      const w = windows[idx];
      return {
        id: `scene-${idx + 1}`,
        sceneNumber: (idx + 1) as 1 | 2 | 3 | 4,
        phase: w.phase,
        startTime: w.start,
        endTime: w.end,
        description: scene.description,
        cameraDirection: scene.cameraDirection,
        sfxCue: scene.sfxCue,
        musicMood: w.mood,
        motionPreset: w.motion,
        imageUrl: existingImages?.[idx] ?? '',
        lines: scene.lines.map((line, lIdx) => ({
          id: `line-${idx + 1}-${lIdx + 1}-${Date.now()}`,
          speaker: line.speaker,
          text: line.text,
          korean: line.korean,
          emotion: line.emotion,
          startTime: Math.max(w.start, Math.min(w.end - 0.5, Number(line.startTime))),
          endTime: Math.max(w.start + 0.5, Math.min(w.end, Number(line.endTime))),
          usedExpressionIds: Array.isArray(line.usedExpressionIds) ? line.usedExpressionIds : [],
        })),
      };
    });

    res.json({
      scenes: normalized,
      wordCount: countWordsInScenes(normalized),
    });
  } catch (err) {
    const info = getFriendlyApiError(err);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// 2. Regenerate a single scene while keeping required expressions & word budget
app.post('/api/storyboard/regenerate-scene', async (req, res) => {
  try {
    const { sceneIndex, scenes, expressions, storyConfig } = req.body as {
      sceneIndex: number;
      scenes: Array<{
        sceneNumber: number;
        phase: string;
        startTime: number;
        endTime: number;
        description: string;
        lines: Array<{ speaker: string; text: string; korean: string; usedExpressionIds: string[] }>;
      }>;
      expressions: Array<{ id: string; phrase: string; korean: string; movie: string }>;
      storyConfig: {
        title: string;
        location: string;
        animationStyle: string;
        characters: Array<{ name: string; personality: string }>;
      };
    };

    const targetScene = scenes[sceneIndex];
    if (!targetScene) {
      return res.status(400).json({ error: 'Invalid scene index.' });
    }

    const otherScenesWords = scenes
      .filter((_, i) => i !== sceneIndex)
      .reduce(
        (acc, s) =>
          acc +
          s.lines.reduce((la, l) => la + l.text.trim().split(/\s+/).filter(Boolean).length, 0),
        0
      );

    const targetMinWords = Math.max(8, 60 - otherScenesWords);
    const targetMaxWords = Math.max(targetMinWords + 4, 70 - otherScenesWords);

    const requiredIds = new Set<string>();
    targetScene.lines.forEach((l) => l.usedExpressionIds?.forEach((id) => requiredIds.add(id)));
    const requiredForScene = expressions.filter((e) => requiredIds.has(e.id));

    const ai = getAiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Rewrite Scene ${targetScene.sceneNumber} (${targetScene.phase}, ${targetScene.startTime}s-${targetScene.endTime}s) of "${storyConfig.title}" set at ${storyConfig.location}.
Characters: ${storyConfig.characters.map((c) => `${c.name} (${c.personality})`).join(', ')}.

Other scenes context:
${scenes
  .map((s, idx) =>
    idx === sceneIndex
      ? `[REGENERATE THIS SCENE ${s.sceneNumber}: ${s.phase}]`
      : `Scene ${s.sceneNumber} (${s.phase}): ${s.lines.map((l) => `${l.speaker}: "${l.text}"`).join(' ')}`
  )
  .join('\n')}

REQUIRED expressions that MUST appear in this regenerated scene (allowing only grammatical inflections):
${
  requiredForScene.length > 0
    ? requiredForScene.map((e) => `- id="${e.id}": "${e.phrase}" (${e.korean})`).join('\n')
    : 'No specific expression locked to this scene, keep dialogue natural and dramatic.'
}

WORD BUDGET: Spoken English words in THIS scene MUST be between ${targetMinWords} and ${targetMaxWords} words so total script stays 60-70 words.
Timestamps of lines must fall within ${targetScene.startTime}s to ${targetScene.endTime}s.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            cameraDirection: { type: Type.STRING },
            sfxCue: { type: Type.STRING },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                  korean: { type: Type.STRING },
                  emotion: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  usedExpressionIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'speaker',
                  'text',
                  'korean',
                  'emotion',
                  'startTime',
                  'endTime',
                  'usedExpressionIds',
                ],
              },
            },
          },
          required: ['description', 'cameraDirection', 'sfxCue', 'lines'],
        },
      },
    }));

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      description: string;
      cameraDirection: string;
      sfxCue: string;
      lines: Array<{
        speaker: string;
        text: string;
        korean: string;
        emotion: string;
        startTime: number;
        endTime: number;
        usedExpressionIds: string[];
      }>;
    };

    res.json({
      description: parsed.description,
      cameraDirection: parsed.cameraDirection,
      sfxCue: parsed.sfxCue,
      lines: (parsed.lines ?? []).map((l, idx) => ({
        id: `line-${sceneIndex + 1}-${idx + 1}-${Date.now()}`,
        speaker: l.speaker,
        text: l.text,
        korean: l.korean,
        emotion: l.emotion,
        startTime: Math.max(targetScene.startTime, Math.min(targetScene.endTime - 0.5, l.startTime)),
        endTime: Math.max(targetScene.startTime + 0.5, Math.min(targetScene.endTime, l.endTime)),
        usedExpressionIds: Array.isArray(l.usedExpressionIds) ? l.usedExpressionIds : [],
      })),
    });
  } catch (err) {
    const info = getFriendlyApiError(err);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// 3. Generate American English character voiceover WAV clips via gemini-3.8-flash-lite-tts
app.post('/api/tts/generate', async (req, res) => {
  try {
    const { lines, characters } = req.body as {
      lines: Array<{ id: string; speaker: string; text: string; emotion?: string }>;
      characters?: Array<{ name: string; voiceRole?: string }>;
    };

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'No dialogue lines provided for voice synthesis.' });
    }

    const ai = getAiClient('v1beta');
    const roleMap = new Map<string, string>();
    (characters ?? []).forEach((c) => {
      if (c.voiceRole) roleMap.set(c.name.toLowerCase(), c.voiceRole);
    });

    const results: Array<{ lineId: string; speaker: string; audioDataUrl: string }> = [];
    let lastError: unknown = null;

    const synthesizeOne = async (line: {
      id: string;
      speaker: string;
      text: string;
      emotion?: string;
    }) => {
      const role = roleMap.get(line.speaker.toLowerCase());
      const { voiceName, baseStyle } = selectVoiceForSpeaker(line.speaker, role);
      const styleInstruction = line.emotion
        ? `${baseStyle}. Delivery emotion: ${line.emotion}. Natural American English accent.`
        : `${baseStyle}. Natural American English accent.`;

      const modelsToTry = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
      for (const modelName of modelsToTry) {
        try {
          const interaction = await withRetry(
            () =>
              ai.interactions.create(
                {
                  model: modelName,
                  input: [
                    {
                      type: 'text',
                      text: line.text,
                      annotations: [
                        {
                          type: 'speech_metadata',
                          style: styleInstruction,
                        },
                      ],
                    },
                  ],
                  response_format: { type: 'audio' },
                  generation_config: {
                    speech_config: [
                      {
                        language: 'en-US',
                        voice: voiceName,
                      },
                    ],
                  },
                } as Parameters<typeof ai.interactions.create>[0],
                { timeout: 15000 }
              ),
            2
          );

          const outputAudio = (
            interaction as unknown as {
              output_audio?: { data?: string; mime_type?: string };
            }
          ).output_audio;

          const base64Audio = outputAudio?.data;
          const mimeType = outputAudio?.mime_type || 'audio/wav';
          if (base64Audio) {
            return {
              lineId: line.id,
              speaker: line.speaker,
              audioDataUrl: `data:${mimeType};base64,${base64Audio}`,
            };
          }
        } catch (err) {
          lastError = err;
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          if (msg.includes('429') || msg.includes('resource_exhausted')) {
            break;
          }
        }
      }
      return null;
    };

    for (const line of lines) {
      const clip = await synthesizeOne(line);
      if (clip) {
        results.push(clip);
      } else if (results.length === 0 && lastError) {
        // If even the first line hits quota/error, stop early rather than spamming
        break;
      }
    }

    if (results.length === 0 && lastError) {
      throw lastError;
    }

    res.json({
      clips: results,
      partialError:
        results.length < lines.length && lastError
          ? getFriendlyApiError(lastError).message
          : null,
    });
  } catch (err) {
    const info = getFriendlyApiError(err);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// 4. Generate 3-question English vocabulary quiz via gemini-4-hydrogen
app.post('/api/quiz/generate', async (req, res) => {
  try {
    const { expressions, scenes } = req.body as {
      expressions: Array<{ id: string; phrase: string; korean: string; movie: string }>;
      scenes: Array<{ sceneNumber: number; lines: Array<{ speaker: string; text: string }> }>;
    };

    const ai = getAiClient();
    const scriptText = scenes
      .map((s) => `Scene ${s.sceneNumber}: ${s.lines.map((l) => `${l.speaker}: "${l.text}"`).join(' ')}`)
      .join('\n');

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
      contents: `Generate exactly 3 engaging multiple-choice English vocabulary quiz questions for Korean university students based on the expressions used in this 30-second animated clip.

Expressions:
${expressions.map((e) => `- id="${e.id}": "${e.phrase}" (${e.korean}) from ${e.movie}`).join('\n')}

Script:
${scriptText}

Each question must test real-world nuance or contextual meaning of one of the expressions in the script, have 4 options, and include concise explanations in both English and Korean.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  expressionId: { type: Type.STRING },
                  expressionPhrase: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanationEn: { type: Type.STRING },
                  explanationKo: { type: Type.STRING },
                },
                required: [
                  'expressionId',
                  'expressionPhrase',
                  'question',
                  'options',
                  'correctIndex',
                  'explanationEn',
                  'explanationKo',
                ],
              },
            },
          },
          required: ['questions'],
        },
      },
    }));

    const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim()) as {
      questions: Array<{
        expressionId: string;
        expressionPhrase: string;
        question: string;
        options: string[];
        correctIndex: number;
        explanationEn: string;
        explanationKo: string;
      }>;
    };

    res.json({
      questions: parsed.questions.slice(0, 3).map((q, idx) => ({
        id: `quiz-${Date.now()}-${idx}`,
        ...q,
      })),
    });
  } catch (err) {
    const info = getFriendlyApiError(err);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// 5. Optional direct AI video clip generation (Veo / gemini-omni-1.2-flash)
// Honestly reports unavailability if paid tier API key is not configured or fails.
app.post('/api/video/generate-clip', async (req, res) => {
  try {
    const { prompt, durationSeconds } = req.body as {
      prompt: string;
      durationSeconds?: number;
    };
    const ai = getAiClient();
    const clampedSec = Math.max(3, Math.min(10, Math.round(durationSeconds ?? 7)));

    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input: prompt,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: '9:16',
          duration: `${clampedSec}s`,
          resolution: '720p',
        },
      } as Parameters<typeof ai.interactions.create>[0],
      { timeout: 300000 }
    );

    const videoPart = (interaction as unknown as { output_video?: { data?: string; mime_type?: string } }).output_video;
    if (!videoPart?.data) {
      return res.status(502).json({
        available: false,
        code: 'NO_VIDEO_OUTPUT',
        error:
          'Direct video model did not return video bytes. Switching to Animated Storyboard Slideshow mode.',
      });
    }

    const mime = videoPart.mime_type ?? 'video/mp4';
    res.json({
      available: true,
      videoDataUrl: `data:${mime};base64,${videoPart.data}`,
    });
  } catch (err) {
    const info = getFriendlyApiError(err);
    res.status(info.status).json({
      available: false,
      code: info.code,
      error: info.message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aycaramba Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
