const express = require('express');
const { query } = require('../services/db');
const { generateConversationReply } = require('../services/gemini');

const router = express.Router();

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

router.post('/practice', async (req, res) => {
  const level = LEVELS.has(req.body.level) ? req.body.level : 'A1';
  const topic = String(req.body.topic || 'Alltag').slice(0, 80);
  const userText = String(req.body.userText || '').trim();
  const history = Array.isArray(req.body.history) ? req.body.history : [];

  if (!userText) {
    return res.status(400).json({ error: 'userText requis.' });
  }

  try {
    const topicVocabulary = query(
      `SELECT word, translation_fr, translation_ar, example_de
       FROM words
       WHERE user_id = ? AND lower(topic) = lower(?)
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.userId, topic]
    );

    const result = await generateConversationReply({
      level,
      topic,
      userText,
      history,
      topicVocabulary
    });

    res.json(normalizeConversationResult(result));
  } catch (err) {
    console.error('Conversation practice error:', err);
    res.status(500).json({
      error: 'Impossible de générer une réponse de conversation pour le moment.'
    });
  }
});

function normalizeConversationResult(result) {
  return {
    reply_de: result.reply_de || '',
    translation_fr: result.translation_fr || '',
    translation_ar: result.translation_ar || '',
    correction: result.correction || 'Aucune erreur importante.',
    useful_words: Array.isArray(result.useful_words)
      ? result.useful_words.slice(0, 8).map(word => ({
        de: word.de || '',
        fr: word.fr || '',
        ar: word.ar || ''
      })).filter(word => word.de)
      : []
  };
}

module.exports = router;
