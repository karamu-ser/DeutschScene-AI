const express = require('express');
const { listMistakes, recordMistake } = require('../services/mistakes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(listMistakes(req.userId, {
    lessonId: req.query.lesson_id,
    limit: req.query.limit
  }));
});

router.post('/', (req, res) => {
  try {
    const mistake = recordMistake({
      userId: req.userId,
      lessonId: req.body.lesson_id,
      mistakeType: req.body.mistake_type,
      expected: req.body.expected,
      userAnswer: req.body.user_answer,
      relatedRule: req.body.related_rule
    });
    res.status(201).json(mistake);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
