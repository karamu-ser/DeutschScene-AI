const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const totalWords = query('SELECT COUNT(*) as count FROM words WHERE user_id = ?', [req.userId])[0]?.count || 0;
  const topics = query('SELECT COUNT(DISTINCT topic) as count FROM words WHERE user_id = ?', [req.userId])[0]?.count || 0;
  const todayReview = query(
    `SELECT COUNT(*) as count
     FROM review_schedule rs
     JOIN words w ON w.id = rs.word_id
     WHERE w.user_id = ? AND rs.next_review <= datetime('now')`,
    [req.userId]
  )[0]?.count || 0;
  const hardWords = query(
    `SELECT COUNT(*) as count
     FROM review_schedule rs
     JOIN words w ON w.id = rs.word_id
     WHERE w.user_id = ? AND rs.difficulty = 'hard'`,
    [req.userId]
  )[0]?.count || 0;
  const hardWordsList = query(
    `SELECT w.id, w.word, w.translation_fr, w.translation_ar, w.level, w.topic, rs.review_count
     FROM review_schedule rs
     JOIN words w ON w.id = rs.word_id
     WHERE w.user_id = ? AND rs.difficulty = 'hard'
     ORDER BY rs.next_review ASC, rs.review_count DESC
     LIMIT 8`
  , [req.userId]);
  const avgScore = query(
    `SELECT ROUND(AVG(score)) as avg FROM pronunciation_sessions WHERE user_id = ?`,
    [req.userId]
  )[0]?.avg || 0;
  const quizAccuracy = query(
    `SELECT ROUND(AVG(correct) * 100) as avg FROM quiz_sessions WHERE user_id = ?`,
    [req.userId]
  )[0]?.avg || 0;
  const topicsList = query(
    `SELECT topic, COUNT(*) as count FROM words WHERE user_id = ? AND topic IS NOT NULL GROUP BY topic ORDER BY count DESC LIMIT 6`,
    [req.userId]
  );
  const recentWords = query(
    `SELECT word, translation_fr, level, created_at FROM words WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
    [req.userId]
  );
  const weeklyProgress = query(`
    SELECT
      date(created_at) as day,
      COUNT(*) as words_added
    FROM words
    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `, [req.userId]);

  res.json({
    totalWords,
    topics,
    todayReview,
    hardWords,
    hardWordsList,
    avgPronunciationScore: avgScore,
    quizAccuracy,
    topicsList,
    recentWords,
    weeklyProgress
  });
});

// Today's review words
router.get('/review', (req, res) => {
  const words = query(`
    SELECT w.*, rs.difficulty, rs.review_count
    FROM words w
    JOIN review_schedule rs ON rs.word_id = w.id
    WHERE w.user_id = ? AND rs.next_review <= datetime('now')
    ORDER BY rs.difficulty DESC, rs.next_review ASC
    LIMIT 20
  `, [req.userId]);
  res.json(words);
});

module.exports = router;
