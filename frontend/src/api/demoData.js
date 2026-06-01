export const DEMO_MODE_KEY = 'demoMode';

export function isDemoMode() {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function demoResponse(data) {
  return Promise.resolve({ data });
}

export const demoLesson = {
  id: 1,
  title: 'Vorstellung A1',
  level: 'A1',
  unit: 'Demo',
  topic: 'Vorstellung',
  objectives: ['sich vorstellen', 'Herkunft sagen', 'einfache Fragen beantworten']
};

export const demoWords = [
  { id: 1, word: 'kommen', type: 'Verb', translation_fr: 'venir', translation_ar: 'يأتي', example_de: 'Ich komme aus Marokko.', example_fr: 'Je viens du Maroc.', level: 'A1', topic: 'Vorstellung', difficulty: 'hard', review_count: 0 },
  { id: 2, word: 'heißen', type: 'Verb', translation_fr: "s'appeler", translation_ar: 'يسمى', example_de: 'Ich heiße Abdou.', example_fr: "Je m'appelle Abdou.", level: 'A1', topic: 'Vorstellung', difficulty: 'medium', review_count: 1 },
  { id: 3, word: 'wohnen', type: 'Verb', translation_fr: 'habiter', translation_ar: 'يسكن', example_de: 'Ich wohne in Casablanca.', example_fr: "J'habite à Casablanca.", level: 'A1', topic: 'Alltag', difficulty: 'new', review_count: 0 },
  { id: 4, word: 'die Familie', article: 'die', type: 'Nomen', translation_fr: 'la famille', translation_ar: 'العائلة', example_de: 'Meine Familie ist groß.', example_fr: 'Ma famille est grande.', level: 'A1', topic: 'Familie', difficulty: 'easy', review_count: 2 },
  { id: 5, word: 'arbeiten', type: 'Verb', translation_fr: 'travailler', translation_ar: 'يعمل', example_de: 'Ich arbeite heute.', example_fr: "Je travaille aujourd'hui.", level: 'A2', topic: 'Arbeit', difficulty: 'medium', review_count: 1 }
];

export const demoGrammar = [
  {
    id: 1,
    rule_title: 'Verbposition',
    title: 'Verbposition',
    explanation_fr: 'Dans une phrase principale allemande, le verbe conjugué est souvent en deuxième position.',
    explanation_ar: 'في الجملة الألمانية الرئيسية يأتي الفعل غالبا في المرتبة الثانية.',
    examples: ['Ich komme aus Marokko.', 'Heute lerne ich Deutsch.']
  },
  {
    id: 2,
    rule_title: 'W-Fragen',
    title: 'W-Fragen',
    explanation_fr: 'Les questions avec W commencent par wo, wer, wie, was, warum.',
    explanation_ar: 'أسئلة W تبدأ بكلمات مثل wo و wer و wie.',
    examples: ['Woher kommst du?', 'Wie heißt du?']
  }
];

export const demoDialogues = [
  {
    id: 1,
    title: 'Sich vorstellen',
    goal: 'dire son nom et son origine',
    lines: [
      { speaker: 'A', de: 'Hallo! Wie heißt du?', fr: 'Salut ! Comment tu t’appelles ?' },
      { speaker: 'B', de: 'Ich heiße Abdou.', fr: 'Je m’appelle Abdou.' },
      { speaker: 'A', de: 'Woher kommst du?', fr: 'D’où viens-tu ?' },
      { speaker: 'B', de: 'Ich komme aus Marokko.', fr: 'Je viens du Maroc.' }
    ]
  }
];

export const demoExpressions = [
  { id: 1, expression: 'Guten Morgen!', translation_fr: 'Bonjour !', translation_ar: 'صباح الخير', context: 'Begrüßung' },
  { id: 2, expression: 'Freut mich.', translation_fr: 'Enchanté.', translation_ar: 'تشرفت', context: 'Vorstellung' }
];

export const demoExercises = [
  {
    id: 1,
    type: 'word_order',
    instruction_de: 'Bringe die Wörter in die richtige Reihenfolge.',
    instruction_fr: 'Remets les mots dans le bon ordre.',
    questions: [{ question: 'komme / aus / Marokko / Ich', answer: 'Ich komme aus Marokko.' }]
  }
];

export const demoLessonDetails = {
  lesson: demoLesson,
  words: demoWords,
  vocabulary: demoWords,
  grammar: demoGrammar,
  dialogues: demoDialogues,
  expressions: demoExpressions,
  exercises: demoExercises
};

export const demoDashboard = {
  totalWords: demoWords.length,
  todayReview: 3,
  quizAccuracy: 82,
  hardWords: 2,
  hardWordsList: demoWords.filter(word => word.difficulty === 'hard' || word.difficulty === 'medium').slice(0, 3),
  recentWords: demoWords.slice(0, 4),
  topicsList: [
    { topic: 'Vorstellung', count: 2 },
    { topic: 'Alltag', count: 1 },
    { topic: 'Familie', count: 1 },
    { topic: 'Arbeit', count: 1 }
  ]
};

export const demoSummary = {
  title: 'Demo Summary A1',
  source_lessons: 1,
  overview: 'Cette leçon démo montre comment DeutschScene AI transforme un PDF en pratique interactive.',
  must_remember: ['Ich komme aus ...', 'Le verbe conjugué reste en deuxième position.', 'Woher kommst du?'],
  source_coverage: [{ lesson_title: demoLesson.title, covered_in: 'vocabulaire, grammaire, dialogue, quiz' }],
  vocabulary: demoWords.map(word => ({ de: word.word, fr: word.translation_fr, ar: word.translation_ar, example: word.example_de })),
  grammar: demoGrammar.map(rule => ({ title: rule.rule_title, explanation_fr: rule.explanation_fr, examples: rule.examples })),
  phrases: [
    { de: 'Ich komme aus Marokko.', fr: 'Je viens du Maroc.', use: 'Dire son origine' },
    { de: 'Ich heiße Abdou.', fr: 'Je m’appelle Abdou.', use: 'Se présenter' }
  ],
  dialogues: demoDialogues,
  practice: demoExercises[0].questions,
  memory_plan: ['Lire la question', 'Répondre à voix haute', 'Corriger la position du verbe']
};

export const demoBasics = {
  title: 'Bases allemand A1-C2',
  updated_note: 'Mode démo sans backend ni clé API.',
  learning_order: ['Prononciation', 'Verbes fréquents', 'Ordre des mots', 'Questions simples'],
  sections: [
    {
      title: 'Se présenter',
      why: 'C’est la base pour commencer une conversation.',
      rules: demoGrammar.map(rule => ({ title: rule.rule_title, explanation_fr: rule.explanation_fr, examples: rule.examples })),
      words: demoSummary.vocabulary.slice(0, 3),
      phrases: demoSummary.phrases
    }
  ],
  daily_plan: [
    { day: 'Jour 1', task: 'Apprendre 5 mots', goal: 'Comprendre une mini présentation' },
    { day: 'Jour 2', task: 'Répondre à 3 questions', goal: 'Parler plus naturellement' }
  ],
  practice: demoExercises[0].questions
};

export const demoMistakes = [
  {
    id: 1,
    lesson_id: 1,
    mistake_type: 'word_order',
    expected: 'Ich komme aus Marokko.',
    user_answer: 'Ich aus Marokko komme.',
    related_rule: 'Verbposition',
    count: 3
  }
];

export function demoQuiz(type = 'de_to_fr') {
  return demoWords.slice(0, 4).map(word => ({
    word_id: word.id,
    type,
    prompt: type === 'fr_to_de' ? word.translation_fr : word.word,
    question: type === 'article' ? word.word.replace(/^(der|die|das)\s+/i, '') : type === 'listen' ? 'Écris ce que tu entends' : word.word,
    correct_answer: type === 'fr_to_de' || type === 'listen'
      ? word.word.replace(/^(der|die|das)\s+/i, '')
      : type === 'article'
        ? word.article || 'die'
        : word.translation_fr,
    options: type === 'article'
      ? ['der', 'die', 'das']
      : [word.translation_fr, 'bonjour', 'travailler', 'famille'].filter(Boolean).slice(0, 4),
    audio_text: word.word
  }));
}

export function demoAiQuestion() {
  return {
    question_id: 'demo-ai-lehrer-1',
    question_de: 'Antworte auf Deutsch mit einem einfachen Satz: Woher kommst du?',
    expected_answer: 'Ich komme aus Marokko.',
    skill: 'word_order',
    related_rule: 'Verbposition',
    source: demoLesson.title,
    from_pdf: true
  };
}

export function demoAiResponse(userAnswer = '') {
  const correct = userAnswer.trim().toLowerCase() === 'ich komme aus marokko.';
  return {
    is_correct: correct,
    score: correct ? 100 : 70,
    feedback_fr: correct
      ? 'Très bien. Ta phrase est correcte.'
      : 'Presque. En allemand, le verbe conjugué vient en deuxième position : Ich komme aus Marokko.',
    feedback_ar: correct ? 'جيد جدا. الجملة صحيحة.' : 'قريب من الصحيح. الفعل يأتي في المرتبة الثانية.',
    correct_answer: 'Ich komme aus Marokko.',
    mistake: correct ? {} : demoMistakes[0],
    practice_session: {
      title: 'Practice Session',
      focus: 'word_order',
      related_rule: 'Verbposition',
      exercises: correct ? [] : [{
        id: 'practice-1',
        type: 'word_order',
        prompt_fr: 'Remets les mots dans le bon ordre : komme / aus / Marokko / Ich',
        prompt_de: 'Bringe die Wörter in die richtige Reihenfolge.',
        answer: 'Ich komme aus Marokko.',
        from_pdf: false,
        based_on_pdf: true
      }],
      from_pdf: false,
      based_on_pdf: true
    }
  };
}
