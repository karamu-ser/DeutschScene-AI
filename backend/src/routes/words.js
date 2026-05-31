const express = require('express');
const { query, run } = require('../services/db');

const router = express.Router();

// Get all words with review info
router.get('/', (req, res) => {
  const { topic, level, search } = req.query;
  let sql = `
    SELECT w.*, rs.difficulty, rs.next_review, rs.review_count, rs.last_score
    FROM words w
    LEFT JOIN review_schedule rs ON rs.word_id = w.id
    WHERE w.user_id = ?
  `;
  const params = [req.userId];

  if (topic) { sql += ' AND w.topic = ?'; params.push(topic); }
  if (level) { sql += ' AND w.level = ?'; params.push(level); }
  if (search) { sql += ' AND (w.word LIKE ? OR w.translation_fr LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY w.created_at DESC';
  const words = query(sql, params);
  res.json(words);
});

// Get topics
router.get('/topics', (req, res) => {
  const topics = query(
    'SELECT DISTINCT topic FROM words WHERE user_id = ? AND topic IS NOT NULL ORDER BY topic',
    [req.userId]
  );
  res.json(topics.map(t => t.topic));
});

// Get single word
router.get('/:id', (req, res) => {
  const words = query('SELECT * FROM words WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!words.length) return res.status(404).json({ error: 'Mot non trouvé.' });
  res.json(words[0]);
});

// Update word
router.put('/:id', (req, res) => {
  const { word, article, plural, translation_fr, translation_ar, example_de, example_fr } = req.body;
  run(
    `UPDATE words SET word=?, article=?, plural=?, translation_fr=?, translation_ar=?, example_de=?, example_fr=? WHERE id=? AND user_id=?`,
    [word, article, plural, translation_fr, translation_ar, example_de, example_fr, req.params.id, req.userId]
  );
  res.json({ success: true });
});

// Delete word
router.delete('/:id', (req, res) => {
  run('DELETE FROM review_schedule WHERE word_id IN (SELECT id FROM words WHERE id = ? AND user_id = ?)', [req.params.id, req.userId]);
  run('DELETE FROM words WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ success: true });
});

module.exports = router;
