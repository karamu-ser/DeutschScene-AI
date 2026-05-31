import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 180000,
});

export const uploadDocument = (formData, onProgress) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total))
  });

export const getLessons = () => api.get('/upload/lessons');
export const getLessonById = (id) => api.get(`/upload/lessons/${id}`);
export const deleteLesson = (id) => api.delete(`/upload/lessons/${id}`);
export const getSummary = () => api.get('/upload/summary');
export const getBasics = () => api.get('/upload/basics');
export const updateBasics = () => api.post('/upload/basics/update');
export const getDialogueFilm = (params) => api.get('/upload/dialogue-film', { params });

export const getWords = (params) => api.get('/words', { params });
export const getTopics = () => api.get('/words/topics');
export const deleteWord = (id) => api.delete(`/words/${id}`);
export const updateWord = (id, data) => api.put(`/words/${id}`, data);

export const generateQuiz = (params) => api.get('/quiz/generate', { params });
export const submitAnswer = (data) => api.post('/quiz/answer', data);
export const getQuizStats = () => api.get('/quiz/stats');

export const checkPronunciation = (data) => api.post('/pronunciation/check', data);
export const rateDifficulty = (data) => api.post('/pronunciation/rate', data);
export const getPronunciationHistory = () => api.get('/pronunciation/history');
export const practiceConversation = (data) => api.post('/conversation/practice', data);

export const speakHighQuality = (data) =>
  api.post('/tts/speak', data, { responseType: 'blob', timeout: 60000 });

export const getDashboard = () => api.get('/progress/dashboard');
export const getReviewWords = () => api.get('/progress/review');

export default api;
