const express = require('express');
const { query, run } = require('../services/db');
const { checkPronunciation } = require('../services/gemini');

const router = express.Router();

// Check pronunciation
router.post('/check', async (req, res) => {
  const { word_id, expected, spoken, context } = req.body;
  if (!expected || !spoken) return res.status(400).json({ error: 'expected et spoken requis.' });
  const useGemini = context === 'film';

  try {
    const result = useGemini
      ? await checkPronunciation(expected, spoken)
      : checkPronunciationLocally(expected, spoken);

    if (word_id) {
      run(
        `INSERT INTO pronunciation_sessions (user_id, word_id, spoken_text, score, feedback_fr)
         SELECT ?, id, ?, ?, ? FROM words WHERE id = ? AND user_id = ?`,
        [req.userId, spoken, result.score, result.feedback_fr, word_id, req.userId]
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Pronunciation check error:', err);
    res.json(checkPronunciationLocally(expected, spoken));
  }
});

// Rate word difficulty (spaced repetition)
router.post('/rate', (req, res) => {
  const { word_id, difficulty } = req.body;
  let next_review;

  switch (difficulty) {
    case 'easy':   next_review = "datetime('now', '+7 days')"; break;
    case 'medium': next_review = "datetime('now', '+2 days')"; break;
    case 'hard':   next_review = "datetime('now', '+1 hour')"; break;
    default:       next_review = "datetime('now', '+1 day')";
  }

  run(
    `UPDATE review_schedule
     SET difficulty = ?, next_review = ${next_review}, review_count = review_count + 1
     WHERE word_id IN (SELECT id FROM words WHERE id = ? AND user_id = ?)`,
    [difficulty, word_id, req.userId]
  );

  res.json({ success: true });
});

// Get pronunciation history
router.get('/history', (req, res) => {
  const sessions = query(`
    SELECT ps.*, w.word
    FROM pronunciation_sessions ps
    JOIN words w ON w.id = ps.word_id
    WHERE ps.user_id = ?
    ORDER BY ps.created_at DESC
    LIMIT 20
  `, [req.userId]);
  res.json(sessions);
});

function computeSimilarity(a, b) {
  const aWords = normalizeSpeechText(a).split(' ').filter(Boolean);
  const bWords = normalizeSpeechText(b).split(' ').filter(Boolean);
  let matches = 0;
  aWords.forEach(w => { if (bWords.includes(w)) matches++; });
  return Math.round((matches / Math.max(aWords.length, bWords.length)) * 100);
}

function normalizeSpeechText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkPronunciationLocally(expected, spoken) {
  const score = normalizeSpeechText(expected) === normalizeSpeechText(spoken)
    ? 100
    : computeSimilarity(expected, spoken);
  return {
    score,
    correct_words: score >= 80 ? [expected] : [],
    wrong_words: score < 80 ? [expected] : [],
    feedback_fr: getFeedback(score),
    feedback_ar: getFeedbackAr(score)
  };
}

function getFeedback(score) {
  if (score === 100) return 'Parfait ! Excellente prononciation.';
  if (score >= 80) return 'Très bien ! Quelques petites améliorations possibles.';
  if (score >= 60) return 'Bien ! Continue à t\'entraîner, tu progresses.';
  if (score >= 40) return 'Pas mal. Écoute à nouveau et répète lentement.';
  return 'Continue à pratiquer. Écoute bien chaque syllabe.';
}

function getFeedbackAr(score) {
  if (score === 100) return 'ممتاز! نطق رائع.';
  if (score >= 80) return 'جيد جداً! يمكنك التحسين قليلاً.';
  if (score >= 60) return 'جيد! استمر في التدريب.';
  return 'استمر في الممارسة. استمع جيداً لكل مقطع.';
}

module.exports = router;
