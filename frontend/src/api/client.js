import axios from 'axios';
import {
  demoAiQuestion,
  demoAiResponse,
  demoBasics,
  demoDashboard,
  demoDialogues,
  demoExercises,
  demoExpressions,
  demoGrammar,
  demoLesson,
  demoLessonDetails,
  demoMistakes,
  demoQuiz,
  demoResponse,
  demoSummary,
  demoWords,
  isDemoMode
} from './demoData';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 180000,
});

const UPLOAD_TIMEOUT_MS = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS || 0);

export const uploadDocument = (formData, onProgress) => {
  if (isDemoMode()) {
    onProgress?.(100);
    return demoResponse(demoLessonDetails);
  }
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total))
  });
};

export const getLessons = () => isDemoMode() ? demoResponse([demoLesson]) : api.get('/upload/lessons');
export const getLessonById = (id) => isDemoMode() ? demoResponse(demoLessonDetails) : api.get(`/upload/lessons/${id}`);
export const deleteLesson = (id) => isDemoMode() ? demoResponse({ ok: true }) : api.delete(`/upload/lessons/${id}`);
export const getSummary = () => isDemoMode() ? demoResponse(demoSummary) : api.get('/upload/summary');
export const getBasics = () => isDemoMode() ? demoResponse(demoBasics) : api.get('/upload/basics');
export const updateBasics = () => isDemoMode() ? demoResponse(demoBasics) : api.post('/upload/basics/update');
export const getDialogueFilm = (params) => isDemoMode()
  ? demoResponse({
    title: 'Demo Dialogfilm',
    lesson: demoLesson,
    ai_generated: false,
    characters: [{ id: 'A', name: 'Lena' }, { id: 'B', name: 'Samir' }],
    lines: demoDialogues[0].lines.map((line, index) => ({ id: index + 1, de: line.de, fr: line.fr, ar: '', speaker: line.speaker }))
  })
  : api.get('/upload/dialogue-film', { params });

export const getWords = (params) => isDemoMode() ? demoResponse(demoWords) : api.get('/words', { params });
export const getTopics = () => isDemoMode() ? demoResponse(['Vorstellung', 'Alltag', 'Familie', 'Arbeit']) : api.get('/words/topics');
export const deleteWord = (id) => isDemoMode() ? demoResponse({ ok: true }) : api.delete(`/words/${id}`);
export const updateWord = (id, data) => isDemoMode() ? demoResponse({ ...data, id }) : api.put(`/words/${id}`, data);

export const generateQuiz = (params) => isDemoMode() ? demoResponse(demoQuiz(params?.type)) : api.get('/quiz/generate', { params });
export const submitAnswer = (data) => isDemoMode() ? demoResponse({ correct: data.correct_answer === data.user_answer }) : api.post('/quiz/answer', data);
export const getQuizStats = () => isDemoMode() ? demoResponse([{ type: 'de_to_fr', accuracy: 82 }]) : api.get('/quiz/stats');

export const checkPronunciation = (data) => isDemoMode()
  ? demoResponse({ score: 86, feedback_fr: 'Bonne prononciation en mode démo.', expected: data.expected, spoken: data.spoken })
  : api.post('/pronunciation/check', data);
export const rateDifficulty = (data) => isDemoMode() ? demoResponse({ ok: true }) : api.post('/pronunciation/rate', data);
export const getPronunciationHistory = () => isDemoMode() ? demoResponse([]) : api.get('/pronunciation/history');
export const practiceConversation = (data) => isDemoMode()
  ? demoResponse({
    reply_de: data.level === 'A1' || data.level === 'A2' ? 'Sehr gut. Ich komme auch aus einer Stadt.' : 'Das klingt gut. Erzähl mir bitte mehr darüber.',
    translation_fr: 'Très bien. Je viens aussi d’une ville.',
    translation_ar: 'جيد جدا. أنا أيضا من مدينة.',
    correction: 'Demo correction: garde des phrases simples et place le verbe en deuxième position.',
    useful_words: [{ de: 'kommen', fr: 'venir', ar: 'يأتي' }, { de: 'die Stadt', fr: 'la ville', ar: 'المدينة' }]
  })
  : api.post('/conversation/practice', data);

export const speakHighQuality = (data) => isDemoMode()
  ? Promise.reject(new Error('AI TTS is disabled in demo mode.'))
  : api.post('/tts/speak', data, { responseType: 'blob', timeout: 60000 });

export const getDashboard = () => isDemoMode() ? demoResponse(demoDashboard) : api.get('/progress/dashboard');
export const getReviewWords = () => isDemoMode() ? demoResponse(demoWords.slice(0, 4)) : api.get('/progress/review');

export const getMistakes = (params) => isDemoMode() ? demoResponse(demoMistakes) : api.get('/mistakes', { params });
export const recordMistake = (data) => isDemoMode() ? demoResponse({ ...data, id: 99 }) : api.post('/mistakes', data);
export const getGeneratedContent = (params) => isDemoMode() ? demoResponse([]) : api.get('/generated-content', { params });
export const enhanceLesson = (lessonId, data = {}) => isDemoMode()
  ? demoResponse({
    type: 'enhanced_lesson',
    cached: false,
    content: {
      title: 'DeutschScene - Vorstellung',
      level: 'A1',
      objective_fr: 'Tu sauras te présenter simplement et demander le nom et l’origine de quelqu’un.',
      progression: [
        { step: 'Écouter', goal_fr: 'Comprendre une mini-scène', estimated_minutes: 3 },
        { step: 'Répéter', goal_fr: 'Réutiliser deux phrases', estimated_minutes: 4 }
      ],
      opening_scene: {
        title: 'DeutschScene - Im Kurs',
        context_fr: 'Deux apprenants se rencontrent au début d’un cours.',
        dialogue: [
          { speaker: 'A', de: 'Hallo, ich heiße Lena.', fr: 'Salut, je m’appelle Lena.', audio_text: 'Hallo, ich heiße Lena.' },
          { speaker: 'B', de: 'Ich heiße Samir.', fr: 'Je m’appelle Samir.', audio_text: 'Ich heiße Samir.' }
        ],
        comprehension_questions: [
          { question_fr: 'Comment s’appelle A ?', answer_fr: 'Elle s’appelle Lena.', evidence_de: 'Ich heiße Lena.' }
        ]
      },
      vocabulary: demoWords.slice(0, 4).map(word => ({
        de: word.word,
        article: word.article || null,
        fr: word.translation_fr,
        example_de: word.example_de,
        usage_note_fr: 'À utiliser dans une phrase courte.'
      })),
      grammar_in_context: [{
        title: 'Le verbe en deuxième position',
        explanation_fr: 'Dans une phrase simple, le verbe conjugué vient souvent en deuxième position.',
        examples: [{ de: 'Ich komme aus Marokko.', fr: 'Je viens du Maroc.' }],
        common_mistakes: [{ wrong: 'Ich aus Marokko komme.', correct: 'Ich komme aus Marokko.', why_fr: 'Le verbe kommt en position 2.' }]
      }],
      guided_dialogues: [{
        title: 'Mini-dialogue',
        goal_fr: 'Dire son nom',
        lines: [{ speaker: 'A', de: 'Wie heißt du?', fr: 'Comment tu t’appelles ?' }, { speaker: 'B', de: 'Ich heiße Samir.', fr: 'Je m’appelle Samir.' }],
        reuse_focus: ['heißen', 'W-Frage']
      }],
      interactive_exercises: [
        { type: 'word_order', instruction_fr: 'Remets dans l’ordre.', prompt: 'komme / aus / Marokko / Ich', answer: 'Ich komme aus Marokko.', hint_fr: 'Le verbe vient en deuxième position.' }
      ],
      final_challenge: {
        mission_fr: 'Présente-toi en deux phrases.',
        requirements: ['nom', 'origine'],
        model_answer_de: 'Ich heiße Samir. Ich komme aus Marokko.',
        model_answer_fr: 'Je m’appelle Samir. Je viens du Maroc.'
      },
      feedback: {
        answers: [{ exercise_prompt: 'komme / aus / Marokko / Ich', answer: 'Ich komme aus Marokko.' }],
        encouragement_fr: 'Très bien, tu as déjà une base utile pour parler.',
        next_steps: ['Répète les phrases à voix haute.', 'Essaie la conversation AI.']
      }
    }
  })
  : api.post(`/generated-content/lessons/${lessonId}/enhance`, data, { timeout: 180000 });
export const enhanceDialogue = (data = {}) => isDemoMode()
  ? demoResponse({
    type: 'enhanced_dialogue',
    content: {
      title: 'Natürliches Kennenlernen',
      level: data.level || 'A1',
      context_fr: 'Deux apprenants se rencontrent au cours. Le ton est chaleureux et un peu curieux.',
      improved_dialogue: [
        { speaker: 'A', de: 'Hallo! Ich bin Lena. Und du?', fr: 'Salut ! Je suis Lena. Et toi ?', tone: 'amical', target: 'se présenter' },
        { speaker: 'B', de: 'Hi, ich heiße Samir.', fr: 'Salut, je m’appelle Samir.', tone: 'calme', target: 'heißen' },
        { speaker: 'A', de: 'Schön, dich kennenzulernen.', fr: 'Ravie de faire ta connaissance.', tone: 'chaleureux', target: 'expression utile' },
        { speaker: 'B', de: 'Danke, mich auch.', fr: 'Merci, moi aussi.', tone: 'poli', target: 'réponse courte naturelle' },
        { speaker: 'A', de: 'Woher kommst du denn?', fr: 'Tu viens d’où ?', tone: 'curieux', target: 'W-Frage' },
        { speaker: 'B', de: 'Ich komme aus Marokko.', fr: 'Je viens du Maroc.', tone: 'informatif', target: 'venir de' }
      ],
      changes_explained: [
        'Le dialogue commence plus naturellement avec une relance courte.',
        'Une expression sociale utile a été ajoutée.',
        'La question avec "denn" rend l’échange plus vivant.'
      ],
      useful_language: [
        { de: 'Und du?', fr: 'Et toi ?', why_fr: 'Très fréquent pour relancer une conversation.' },
        { de: 'Schön, dich kennenzulernen.', fr: 'Ravi de faire ta connaissance.', why_fr: 'Formule sociale très utile.' }
      ],
      oral_challenge: {
        instruction_fr: 'Présente-toi puis demande à l’autre personne d’où elle vient.',
        model_answer_de: 'Hallo, ich heiße Samir. Und du? Woher kommst du?'
      }
    }
  })
  : api.post('/generated-content/dialogues/enhance', data, { timeout: 180000 });
export const enhancePremiumContent = (data = {}) => isDemoMode()
  ? demoResponse({
    type: 'premium_content',
    content: {
      title: 'Premium Deutsch - Vorstellung',
      level: data.level || 'A1',
      premium_version: {
        overview_fr: 'Une version plus vivante pour apprendre à se présenter avec confiance.',
        content_sections: [
          {
            title: 'Se présenter naturellement',
            explanation_fr: 'On utilise des phrases courtes et utiles dans une vraie première rencontre.',
            examples: [
              { de: 'Hallo, ich heiße Samir.', fr: 'Salut, je m’appelle Samir.', note_fr: 'Simple, naturel et parfait pour A1.' },
              { de: 'Ich komme aus Marokko.', fr: 'Je viens du Maroc.', note_fr: 'Structure utile pour parler de son origine.' }
            ],
            practice: [
              { type: 'production', prompt: 'Présente-toi en deux phrases.', answer: 'Ich heiße ... Ich komme aus ...' }
            ]
          }
        ],
        authenticity_upgrades: [
          { de: 'Und du?', fr: 'Et toi ?', usage_fr: 'Pour relancer une conversation simplement.' }
        ],
        culture_notes: [
          { title: 'Tutoiement', fr: 'Dans un cours ou entre apprenants, "du" est naturel.', example_de: 'Wie heißt du?' }
        ],
        emotional_hook: {
          context_fr: 'Tu arrives dans ton premier cours d’allemand et tu veux oser parler.',
          learner_mission_fr: 'Dire ton nom, ton origine et poser une question à quelqu’un.'
        },
        next_step_fr: 'Répète les deux phrases à voix haute, puis essaie la conversation AI.'
      }
    }
  })
  : api.post('/generated-content/premium/enhance', data, { timeout: 180000 });
export const aiLehrerMock = (data) => isDemoMode() ? demoResponse(demoAiResponse(data.user_answer)) : api.post('/ai-lehrer/mock', data);
export const aiLehrerQuestion = (data) => isDemoMode() ? demoResponse(demoAiQuestion()) : api.post('/ai-lehrer/question', data);
export const aiLehrerRespond = (data) => isDemoMode() ? demoResponse(demoAiResponse(data.user_answer)) : api.post('/ai-lehrer/respond', data);
export const generateExam = (data) => isDemoMode()
  ? demoResponse({
    exam_title: 'Demo Prüfung',
    level: 'A1',
    questions: demoQuiz('de_to_fr').map((item, index) => ({ id: `q-${index}`, type: item.type, prompt_fr: item.question, expected_answer: item.correct_answer, options: item.options })),
    feedback: { revision_plan: ['Réviser Verbposition', 'Répéter les phrases de présentation'] }
  })
  : api.post('/exam/generate', data);
export const generateStory = (data) => isDemoMode()
  ? demoResponse({
    generated_content_id: 'demo-story',
    story_title: 'Ein neuer Deutschkurs',
    level: 'A1',
    paragraphs: [
      { de: 'Ich heiße Abdou. Ich komme aus Marokko.', fr: 'Je m’appelle Abdou. Je viens du Maroc.', ar: 'اسمي عبدو. أنا من المغرب.', audio_text: 'Ich heiße Abdou. Ich komme aus Marokko.' }
    ],
    comprehension_questions: [{ question_de: 'Woher kommt Abdou?', answer: 'Aus Marokko.' }],
    suggested_enrichment: { from_pdf: true, based_on_pdf: true }
  })
  : api.post('/story/generate', data);

export default api;
