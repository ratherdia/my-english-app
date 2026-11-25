import type {
  CharacterProfile,
  ExpressionItem,
  GeneratedAudioClip,
  QuizQuestion,
  StoryConfig,
  StoryScene,
} from '../types';

export const DEFAULT_EXPRESSIONS: ExpressionItem[] = [
  {
    id: 'exp-1',
    phrase: 'Cross the line',
    korean: '선을 넘다',
    movie: 'Inside Out 2',
  },
  {
    id: 'exp-2',
    phrase: 'Hear me out',
    korean: '내 말을 끝까지 들어 봐',
    movie: 'Minari',
  },
  {
    id: 'exp-3',
    phrase: 'Make a big deal out of it',
    korean: '크게 문제 삼다',
    movie: 'Inside Out 2',
  },
  {
    id: 'exp-4',
    phrase: 'The thing is',
    korean: '실은 말이야',
    movie: 'Notting Hill',
  },
  {
    id: 'exp-5',
    phrase: 'Keep it together',
    korean: '평정을 유지하다',
    movie: 'Inside Out 2',
  },
  {
    id: 'exp-6',
    phrase: "I'd love to",
    korean: '정말 좋지',
    movie: 'Notting Hill',
  },
];

export const DEFAULT_CHARACTERS: CharacterProfile[] = [
  {
    id: 'char-strawberry',
    name: 'Strawberry',
    fruitType: 'Red Strawberry',
    colorHex: '#E11D48',
    appearance:
      'Anthropomorphic red strawberry head with green leaves, large expressive eyes, elegant red dress, white handbag, carrying a pink gift box.',
    personality: 'Emotional, innocent, and deeply expressive.',
    voiceRole: 'emotional-female',
    voiceLabel: 'Emotional American Female',
  },
  {
    id: 'char-banana',
    name: 'Banana',
    fruitType: 'Yellow Banana',
    colorHex: '#CA8A04',
    appearance:
      'Anthropomorphic yellow banana head wearing a black tuxedo, crisp white shirt, black bow tie, and shiny gold watch.',
    personality: 'Confident at first, visibly nervous and sweating when confronted.',
    voiceRole: 'nervous-male',
    voiceLabel: 'Confident to Nervous American Male',
  },
  {
    id: 'char-blueberry',
    name: 'Blueberry',
    fruitType: 'Dark-Blue Blueberry',
    colorHex: '#6D28D9',
    appearance:
      'Anthropomorphic round dark-blue blueberry head wearing an elegant purple evening dress and sparkling diamond engagement ring.',
    personality: 'Confident, poised, and glamorous.',
    voiceRole: 'confident-female',
    voiceLabel: 'Confident American Female',
  },
];

export const DEFAULT_STORY_CONFIG: StoryConfig = {
  title: 'The Berry Betrayal',
  genre: 'Romantic drama, betrayal, and comedy',
  location:
    'A luxurious restaurant with warm lighting, candles, elegant furniture, and expensive food.',
  premise:
    'Strawberry discovers her boyfriend Banana secretly dating Blueberry. Banana tries to explain, but Blueberry reveals that they are getting married next week. Both women realize Banana lied to them, leave together, and stick Banana with the entire restaurant bill.',
  animationStyle: '3D Animation',
  characters: DEFAULT_CHARACTERS,
};

export const DEFAULT_SCENES: StoryScene[] = [
  {
    id: 'scene-1',
    sceneNumber: 1,
    phase: 'Hook',
    startTime: 0,
    endTime: 7,
    description:
      'Strawberry enters the candlelit restaurant holding a pink gift box and spots Banana holding hands with Blueberry.',
    cameraDirection: 'Smooth entrance tracking shot into a sudden dramatic zoom on Strawberry’s shocked face.',
    sfxCue: 'Dramatic suspense sting & gasp',
    musicMood: 'suspense',
    motionPreset: 'zoom-in-shock',
    imageUrl: '/src/assets/images/scene_1_hook_1795580512190.jpg',
    lines: [
      {
        id: 'line-1-1',
        speaker: 'Strawberry',
        text: 'What?! That really crosses the line!',
        korean: '뭐라고?! 그건 정말 선을 넘었어!',
        emotion: 'Shocked and heartbroken',
        startTime: 0.7,
        endTime: 4.1,
        usedExpressionIds: ['exp-1'],
      },
      {
        id: 'line-1-2',
        speaker: 'Banana',
        text: 'Wait! Hear me out.',
        korean: '잠깐! 내 말을 끝까지 들어 봐.',
        emotion: 'Startled and defensive',
        startTime: 4.4,
        endTime: 6.7,
        usedExpressionIds: ['exp-2'],
      },
    ],
  },
  {
    id: 'scene-2',
    sceneNumber: 2,
    phase: 'Problem',
    startTime: 7,
    endTime: 15,
    description:
      'Banana quickly releases Blueberry’s hand and sweats nervously as Strawberry confronts him in fury.',
    cameraDirection: 'Alternating close-up reaction shots with exaggerated facial expressions.',
    sfxCue: 'Nervous gulp & tense pizzicato beat',
    musicMood: 'tension',
    motionPreset: 'alternating-closeup',
    imageUrl: '/src/assets/images/scene_2_consistent_1795581425741.jpg',
    lines: [
      {
        id: 'line-2-1',
        speaker: 'Banana',
        text: "Don't make a big deal out of it. She's just a friend.",
        korean: '크게 문제 삼지 마. 그냥 친구일 뿐이야.',
        emotion: 'Sweating and anxiously bluffing',
        startTime: 7.4,
        endTime: 11.7,
        usedExpressionIds: ['exp-3'],
      },
      {
        id: 'line-2-2',
        speaker: 'Strawberry',
        text: "A friend? You're holding her hand!",
        korean: '친구라고? 손을 잡고 있었잖아!',
        emotion: 'Furious and emotional',
        startTime: 12.0,
        endTime: 14.7,
        usedExpressionIds: [],
      },
    ],
  },
  {
    id: 'scene-3',
    sceneNumber: 3,
    phase: 'Turn',
    startTime: 15,
    endTime: 23,
    description:
      'Blueberry flashes her diamond engagement ring. Strawberry drops her pink gift box in slow motion while Banana panics.',
    cameraDirection: 'Glittering ring close-up into a slow-motion shot of the falling pink gift box.',
    sfxCue: 'Sparkle chime & slow-motion bass drop',
    musicMood: 'climax',
    motionPreset: 'slow-mo-drop',
    imageUrl: '/src/assets/images/scene_3_consistent_1795581427232.jpg',
    lines: [
      {
        id: 'line-3-1',
        speaker: 'Blueberry',
        text: "The thing is, we're getting married next week.",
        korean: '실은 말이야, 우리 다음 주에 결혼해.',
        emotion: 'Confident and glamorous',
        startTime: 15.4,
        endTime: 18.7,
        usedExpressionIds: ['exp-4'],
      },
      {
        id: 'line-3-2',
        speaker: 'Strawberry',
        text: "I can't believe this.",
        korean: '이건 믿을 수가 없어.',
        emotion: 'Utter disbelief',
        startTime: 19.0,
        endTime: 20.8,
        usedExpressionIds: [],
      },
      {
        id: 'line-3-3',
        speaker: 'Banana',
        text: 'Please, keep it together!',
        korean: '제발, 평정을 유지해 줘!',
        emotion: 'Frantic and sweating profusely',
        startTime: 21.0,
        endTime: 22.8,
        usedExpressionIds: ['exp-5'],
      },
    ],
  },
  {
    id: 'scene-4',
    sceneNumber: 4,
    phase: 'Close',
    startTime: 23,
    endTime: 30,
    description:
      'Blueberry takes off her ring and exits happily with Strawberry. A waiter hands Banana an endless bill.',
    cameraDirection: 'Comedic snap-zoom and freeze-frame on Banana’s devastated face.',
    sfxCue: 'Receipt flutter & comedic trombone sting',
    musicMood: 'comedy',
    motionPreset: 'freeze-finale',
    imageUrl: '/src/assets/images/scene_4_consistent_1795581427293.jpg',
    lines: [
      {
        id: 'line-4-1',
        speaker: 'Blueberry',
        text: 'You lied to both of us?',
        korean: '우리 둘 다한테 거짓말한 거야?',
        emotion: 'Sharp realization',
        startTime: 23.0,
        endTime: 24.9,
        usedExpressionIds: [],
      },
      {
        id: 'line-4-2',
        speaker: 'Banana',
        text: "I'm sorry.",
        korean: '미안해.',
        emotion: 'Defeated whisper',
        startTime: 25.0,
        endTime: 25.8,
        usedExpressionIds: [],
      },
      {
        id: 'line-4-3',
        speaker: 'Strawberry',
        text: "Let's go shopping.",
        korean: '우리 쇼핑하러 가자.',
        emotion: 'Cheerful and relieved',
        startTime: 25.9,
        endTime: 27.0,
        usedExpressionIds: [],
      },
      {
        id: 'line-4-4',
        speaker: 'Blueberry',
        text: "I'd love to.",
        korean: '정말 좋지.',
        emotion: 'Bright and warm',
        startTime: 27.1,
        endTime: 28.0,
        usedExpressionIds: ['exp-6'],
      },
      {
        id: 'line-4-5',
        speaker: 'Banana',
        text: "Wait! Who's paying the bill?",
        korean: '잠깐! 계산은 누가 내는 거야?',
        emotion: 'Devastated comedic panic',
        startTime: 28.1,
        endTime: 29.7,
        usedExpressionIds: [],
      },
    ],
  },
];

export const DEFAULT_QUIZ: QuizQuestion[] = [
  {
    id: 'quiz-1',
    expressionId: 'exp-1',
    expressionPhrase: 'Cross the line',
    question:
      'When Strawberry catches Banana holding Blueberry’s hand, she says "That really crosses the line!" What does "cross the line" mean?',
    options: [
      'To go beyond acceptable behavior or boundaries',
      'To wait patiently in a restaurant queue',
      'To split a restaurant bill evenly',
      'To arrive late for a dinner date',
    ],
    correctIndex: 0,
    explanationEn:
      '"Cross the line" means to behave in a way that goes too far and breaks trust or social boundaries.',
    explanationKo:
      '"cross the line"은 상대방의 신뢰나 허용 한계를 넘어서는 행동("선을 넘다")을 뜻합니다.',
  },
  {
    id: 'quiz-2',
    expressionId: 'exp-3',
    expressionPhrase: 'Make a big deal out of it',
    question:
      'Banana begs Strawberry, "Don\'t make a big deal out of it." Which phrase best matches his intention?',
    options: [
      'Do not treat this situation as a major problem',
      'Order the most expensive dish on the menu',
      'Invite everyone in the restaurant to celebrate',
      'Write a detailed review after dinner',
    ],
    correctIndex: 0,
    explanationEn:
      '"Make a big deal out of something" means to exaggerate its importance or get overly upset about it.',
    explanationKo:
      '"make a big deal out of it"은 사소한 일처럼 넘기지 않고 "크게 문제 삼다, 대수롭게 여기다"라는 뜻입니다.',
  },
  {
    id: 'quiz-3',
    expressionId: 'exp-5',
    expressionPhrase: 'Keep it together',
    question:
      'In Scene 3, Banana panics and says "Please, keep it together!" What is he asking Strawberry to do?',
    options: [
      'Stay calm and not lose emotional control',
      'Wrap the pink gift box tightly again',
      'Share the diamond ring with Blueberry',
      'Pay the bill together before leaving',
    ],
    correctIndex: 0,
    explanationEn:
      '"Keep it together" means to stay composed and control your emotions during a shocking or stressful moment.',
    explanationKo:
      '"keep it together"는 충격적이거나 당황스러운 순간에도 무너지지 않고 "평정을 유지하다, 침착함을 지키다"라는 표현입니다.',
  },
];
