const express = require('express');
const { getLessonContent } = require('../services/lessonContent');
const { saveGeneratedContent } = require('../services/generatedContent');
const { generateStoryFromLesson } = require('../services/gemini');

const router = express.Router();

router.post('/generate', async (req, res) => {
  const lessonContent = getLessonContent(req.userId, req.body.lesson_id);
  if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

  try {
    const story = await generateStoryFromLesson({
      lessonContent,
      level: req.body.level || lessonContent.lesson.level
    });
    const normalized = normalizeStory(story, lessonContent.lesson);
    const saved = saveGeneratedContent({
      userId: req.userId,
      lessonId: lessonContent.lesson.id,
      type: 'story',
      title: normalized.story_title,
      content: normalized,
      fromPdf: false,
      basedOnPdf: true,
      generatedBy: 'gemini'
    });
    res.json({ ...normalized, generated_content_id: saved.id });
  } catch (err) {
    console.error('Story generation error:', err);
    res.status(503).json({
      error: 'Story Mode Gemini indisponible pour le moment.',
      details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

function normalizeStory(story, lesson) {
  return {
    story_title: story.story_title || `Story - ${lesson.title || 'Lektion'}`,
    level: story.level || lesson.level || 'A1',
    based_on_lesson_id: String(story.based_on_lesson_id || lesson.id),
    suggested_enrichment: {
      ...(story.suggested_enrichment || {}),
      from_pdf: false,
      based_on_pdf: true
    },
    paragraphs: Array.isArray(story.paragraphs) ? story.paragraphs.map(paragraph => ({
      de: paragraph.de || '',
      fr: paragraph.fr || '',
      ar: paragraph.ar || '',
      audio_text: paragraph.audio_text || paragraph.de || ''
    })).filter(paragraph => paragraph.de) : [],
    comprehension_questions: Array.isArray(story.comprehension_questions)
      ? story.comprehension_questions
      : [],
    from_pdf: false,
    based_on_pdf: true
  };
}

module.exports = router;
