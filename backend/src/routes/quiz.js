const express = require('express');
const { query, run } = require('../services/db');

const router = express.Router();

// Generate quiz questions
router.get('/generate', (req, res) => {
  const { type = 'de_to_fr', count = 10, topic } = req.query;
  let sql = 'SELECT * FROM words WHERE user_id = ?';
  const params = [req.userId];
  if (topic) { sql += ' AND topic = ?'; params.push(topic); }
  sql += ' ORDER BY RANDOM() LIMIT ?';
  params.push(parseInt(count) * 2); // get more for options

  const allWords = query(sql, params);
  if (allWords.length < 2) {
    return res.status(422).json({ error: 'Pas assez de mots. Importe d\'abord des documents.' });
  }

  const questionWords = allWords.slice(0, parseInt(count));
  const questions = questionWords.map(word => {
    // Get 3 wrong options from remaining words
    const others = allWords.filter(w => w.id !== word.id);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);

    let question, correct_answer, options;

    switch (type) {
      case 'de_to_fr':
        question = word.word;
        correct_answer = word.translation_fr;
        options = shuffle([word.translation_fr, ...shuffled.map(w => w.translation_fr)]);
        break;
      case 'fr_to_de':
        question = word.translation_fr;
        correct_answer = word.word;
        options = shuffle([word.word, ...shuffled.map(w => w.word)]);
        break;
      case 'article':
        if (!word.article) return null;
        question = word.word.replace(/^(der|die|das)\s+/i, '');
        correct_answer = word.article;
        options = shuffle(['der', 'die', 'das']);
        break;
      case 'listen':
        question = word.word; // frontend will use TTS
        correct_answer = word.word;
        options = shuffle([word.word, ...shuffled.map(w => w.word)]);
        break;
      default:
        question = word.word;
        correct_answer = word.translation_fr;
        options = shuffle([word.translation_fr, ...shuffled.map(w => w.translation_fr)]);
    }

    return {
      word_id: word.id,
      word: word.word,
      type,
      question,
      correct_answer,
      options: options.filter(Boolean),
      translation_fr: word.translation_fr,
      translation_ar: word.translation_ar,
      example_de: word.example_de,
    };
  }).filter(Boolean);

  res.json(questions);
});

// Submit quiz answer
router.post('/answer', (req, res) => {
  const { word_id, quiz_type, user_answer, correct_answer } = req.body;
  const [word] = query('SELECT id FROM words WHERE id = ? AND user_id = ?', [word_id, req.userId]);
  if (!word) return res.status(404).json({ error: 'Mot non trouvé.' });

  const correct = user_answer?.toLowerCase().trim() === correct_answer?.toLowerCase().trim() ? 1 : 0;

  run(
    `INSERT INTO quiz_sessions (user_id, quiz_type, word_id, user_answer, correct) VALUES (?, ?, ?, ?, ?)`,
    [req.userId, quiz_type, word_id, user_answer, correct]
  );

  // Update spaced repetition
  if (correct) {
    run(
      `UPDATE review_schedule
       SET last_score = 100, review_count = review_count + 1
       WHERE word_id IN (SELECT id FROM words WHERE id = ? AND user_id = ?)`,
      [word_id, req.userId]
    );
  } else {
    run(`UPDATE review_schedule SET last_score = 0, difficulty = 'hard',
         next_review = datetime('now', '+1 hour')
         WHERE word_id IN (SELECT id FROM words WHERE id = ? AND user_id = ?)`, [word_id, req.userId]);
  }

  res.json({ correct: !!correct });
});

// Get quiz stats
router.get('/stats', (req, res) => {
  const stats = query(`
    SELECT
      COUNT(*) as total,
      SUM(correct) as correct_count,
      ROUND(AVG(correct) * 100) as accuracy,
      quiz_type
    FROM quiz_sessions
    WHERE user_id = ?
    GROUP BY quiz_type
  `, [req.userId]);
  res.json(stats);
});

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

module.exports = router;
