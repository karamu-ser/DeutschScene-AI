const express = require('express');
const { generateEnhancedDialogue, generateEnhancedLesson, generatePremiumContent } = require('../services/gemini');
const { getLessonContent } = require('../services/lessonContent');
const { listGeneratedContent, saveGeneratedContent } = require('../services/generatedContent');

const router = express.Router();

router.post('/lessons/:id/enhance', async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const force = req.body?.force === true || req.query.force === '1';
    const lessonContent = getLessonContent(req.userId, lessonId);
    if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

    if (!force) {
      const [cached] = listGeneratedContent(req.userId, {
        lessonId,
        type: 'enhanced_lesson',
        limit: 1
      });
      if (cached) return res.json({ ...cached, cached: true });
    }

    const content = await generateEnhancedLesson({
      lessonContent,
      level: req.body?.level || lessonContent.lesson.level || 'A1'
    });

    const saved = saveGeneratedContent({
      userId: req.userId,
      lessonId,
      type: 'enhanced_lesson',
      title: content.title || lessonContent.lesson.title || 'Leçon améliorée',
      content,
      fromPdf: false,
      basedOnPdf: true,
      generatedBy: 'ai'
    });

    res.json({ ...saved, cached: false });
  } catch (err) {
    console.error('Enhanced lesson error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Impossible de générer la leçon améliorée.',
      code: err.code,
      retryDelay: err.retryDelay
    });
  }
});

router.post('/dialogues/enhance', async (req, res) => {
  try {
    const lessonId = req.body?.lesson_id ? Number(req.body.lesson_id) : null;
    const lessonContent = lessonId ? getLessonContent(req.userId, lessonId) : null;
    if (lessonId && !lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

    const dialogue = req.body?.dialogue;
    if (!dialogue || !Array.isArray(dialogue.lines)) {
      return res.status(400).json({ error: 'Dialogue invalide.' });
    }

    const content = await generateEnhancedDialogue({
      dialogue,
      lessonContent,
      level: req.body?.level || lessonContent?.lesson?.level || 'A1'
    });

    const saved = saveGeneratedContent({
      userId: req.userId,
      lessonId,
      type: 'enhanced_dialogue',
      title: content.title || dialogue.title || 'Dialogue amélioré',
      content,
      fromPdf: false,
      basedOnPdf: true,
      generatedBy: 'ai'
    });

    res.json(saved);
  } catch (err) {
    console.error('Enhanced dialogue error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Impossible de générer le dialogue amélioré.',
      code: err.code,
      retryDelay: err.retryDelay
    });
  }
});

router.post('/premium/enhance', async (req, res) => {
  try {
    const content = req.body?.content;
    if (!content) return res.status(400).json({ error: 'content requis.' });

    const lessonId = req.body?.lesson_id ? Number(req.body.lesson_id) : null;
    const lessonContent = lessonId ? getLessonContent(req.userId, lessonId) : null;
    if (lessonId && !lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

    const enhanced = await generatePremiumContent({
      content,
      level: req.body?.level || lessonContent?.lesson?.level || 'A1',
      context: req.body?.context || (lessonContent ? { lesson: lessonContent.lesson } : null)
    });

    const saved = saveGeneratedContent({
      userId: req.userId,
      lessonId,
      type: 'premium_content',
      title: enhanced.title || 'Contenu premium',
      content: enhanced,
      fromPdf: false,
      basedOnPdf: true,
      generatedBy: 'ai'
    });

    res.json(saved);
  } catch (err) {
    console.error('Premium content error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Impossible de générer la version premium.',
      code: err.code,
      retryDelay: err.retryDelay
    });
  }
});

router.get('/', (req, res) => {
  res.json(listGeneratedContent(req.userId, {
    lessonId: req.query.lesson_id,
    type: req.query.type,
    limit: req.query.limit
  }));
});

module.exports = router;
