const express = require('express');
const { listGeneratedContent } = require('../services/generatedContent');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(listGeneratedContent(req.userId, {
    lessonId: req.query.lesson_id,
    type: req.query.type,
    limit: req.query.limit
  }));
});

module.exports = router;
