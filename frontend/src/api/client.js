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
