export type StudioStep = 'expressions' | 'scene' | 'storyboard' | 'generate' | 'watch';

export type AnimationStyle =
  | '3D Animation'
  | '2D Animation'
  | 'Clay'
  | 'Watercolor'
  | 'Realistic';

export type VoiceRole = 'emotional-female' | 'nervous-male' | 'confident-female';

export interface ExpressionItem {
  id: string;
  phrase: string;
  korean: string;
  movie: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  fruitType: string;
  colorHex: string;
  appearance: string;
  personality: string;
  voiceRole: VoiceRole;
  voiceLabel: string;
}

export interface StoryConfig {
  title: string;
  genre: string;
  location: string;
  premise: string;
  animationStyle: AnimationStyle;
  characters: CharacterProfile[];
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  korean: string;
  emotion: string;
  startTime: number;
  endTime: number;
  usedExpressionIds: string[];
}

export type CameraMotionType =
  | 'zoom-in-shock'
  | 'alternating-closeup'
  | 'slow-mo-drop'
  | 'freeze-finale';

export interface StoryScene {
  id: string;
  sceneNumber: 1 | 2 | 3 | 4;
  phase: 'Hook' | 'Problem' | 'Turn' | 'Close';
  startTime: number;
  endTime: number;
  description: string;
  cameraDirection: string;
  sfxCue: string;
  musicMood: 'suspense' | 'tension' | 'climax' | 'comedy';
  motionPreset: CameraMotionType;
  imageUrl: string;
  videoUrl?: string;
  lines: DialogueLine[];
}

export interface GeneratedAudioClip {
  lineId: string;
  speaker: string;
  audioDataUrl: string;
  durationSec: number;
}

export interface QuizQuestion {
  id: string;
  expressionId: string;
  expressionPhrase: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanationEn: string;
  explanationKo: string;
}

export interface GenerationNotice {
  level: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
}
