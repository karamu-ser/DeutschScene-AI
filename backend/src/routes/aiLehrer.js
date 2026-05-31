const express = require('express');
const { getLessonContent } = require('../services/lessonContent');
const { saveGeneratedContent } = require('../services/generatedContent');
const { inferMistakeType, recordMistake } = require('../services/mistakes');
const { generateAiLehrerReply } = require('../services/gemini');

const router = express.Router();

router.post('/mock', (req, res) => {
  const lessonContent = getLessonContent(req.userId, req.body.lesson_id);
  if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

  const response = buildMockAiLehrerResponse({
    lessonContent,
    userAnswer: req.body.user_answer,
    expectedAnswer: req.body.expected_answer,
    level: req.body.level
  });

  persistAiLehrerResult(req.userId, lessonContent.lesson.id, response);
  res.json(response);
});

router.post('/respond', async (req, res) => {
  const lessonContent = getLessonContent(req.userId, req.body.lesson_id);
  if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

  const userAnswer = String(req.body.user_answer || '').trim();
  if (!userAnswer) return res.status(400).json({ error: 'user_answer requis.' });

  if (req.body.mock === true || req.body.demo === true) {
    const response = buildMockAiLehrerResponse({
      lessonContent,
      userAnswer,
      expectedAnswer: req.body.expected_answer,
      level: req.body.level
    });
    persistAiLehrerResult(req.userId, lessonContent.lesson.id, response);
    return res.json(response);
  }

  try {
    const response = await generateAiLehrerReply({
      lessonContent,
      userAnswer,
      expectedAnswer: req.body.expected_answer,
      history: req.body.history,
      level: req.body.level || lessonContent.lesson.level
    });
    const normalized = normalizeAiLehrerResponse(response, userAnswer, req.body.expected_answer, lessonContent);
    persistAiLehrerResult(req.userId, lessonContent.lesson.id, normalized);
    res.json(normalized);
  } catch (err) {
    console.error('AI Lehrer error:', err);
    res.status(503).json({
      error: 'AI Lehrer Gemini indisponible. Utilise /api/ai-lehrer/mock ou { "mock": true } pour le mode demo.',
      details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

function persistAiLehrerResult(userId, lessonId, response) {
  if (response.mistake?.expected && response.mistake?.user_answer) {
    recordMistake({
      userId,
      lessonId,
      mistakeType: response.mistake.mistake_type,
      expected: response.mistake.expected,
      userAnswer: response.mistake.user_answer,
      relatedRule: response.mistake.related_rule
    });
  }
  saveGeneratedContent({
    userId,
    lessonId,
    type: 'ai_lehrer_reply',
    title: 'AI Lehrer feedback',
    content: response,
    fromPdf: false,
    basedOnPdf: true,
    generatedBy: response.mode === 'gemini' ? 'gemini' : 'mock'
  });
}

function normalizeAiLehrerResponse(response, userAnswer, expectedAnswer, lessonContent) {
  const mock = buildMockAiLehrerResponse({ lessonContent, userAnswer, expectedAnswer });
  return {
    ...mock,
    ...response,
    mode: response.mode || 'gemini',
    mistake: {
      ...mock.mistake,
      ...(response.mistake || {}),
      user_answer: response.mistake?.user_answer || userAnswer
    },
    next_exercise: {
      ...mock.next_exercise,
      ...(response.next_exercise || {}),
      from_pdf: false,
      based_on_pdf: true
    }
  };
}

function buildMockAiLehrerResponse({ lessonContent, userAnswer, expectedAnswer, level }) {
  const expected = String(expectedAnswer || findExpectedSentence(lessonContent) || '').trim();
  const answer = String(userAnswer || '').trim();
  const relatedRule = findRelatedRule(lessonContent, expected);
  const mistakeType = inferMistakeType({
    expected,
    userAnswer: answer,
    relatedRule,
    fallback: 'word_order'
  });
  const words = expected
    .replace(/[.!?]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  return {
    mode: 'mock',
    level: level || lessonContent.lesson.level || 'A1',
    feedback_fr: expected && answer.toLowerCase() !== expected.toLowerCase()
      ? `Presque correct. ${relatedRule || 'Regarde bien l’ordre et la forme des mots.'} La phrase correcte est : ${expected}`
      : `Très bien. La phrase est correcte : ${expected || answer}`,
    feedback_ar: expected && answer.toLowerCase() !== expected.toLowerCase()
      ? `قريب من الصحيح. الجملة الصحيحة هي: ${expected}`
      : `جيد جدا. الجملة صحيحة.`,
    correct_answer: expected || answer,
    repeat_prompt: `Répète cette phrase : ${expected || answer}`,
    mistake: expected && answer.toLowerCase() !== expected.toLowerCase()
      ? {
        mistake_type: mistakeType,
        expected,
        user_answer: answer,
        related_rule: relatedRule
      }
      : null,
    next_exercise: {
      type: mistakeType === 'article' ? 'article' : 'word_order',
      prompt_fr: words.length
        ? `Remets les mots dans le bon ordre : ${shuffle(words).join(' / ')}`
        : 'Réécris la phrase correctement.',
      prompt_de: null,
      answer: expected || answer,
      from_pdf: false,
      based_on_pdf: true
    }
  };
}

function findExpectedSentence(lessonContent) {
  const expression = lessonContent.expressions.find(item => item.expression);
  if (expression) return expression.expression;

  const dialogueLine = lessonContent.dialogues
    .flatMap(dialogue => dialogue.lines || [])
    .find(line => line.text || line.de);
  if (dialogueLine) return dialogueLine.text || dialogueLine.de;

  const example = lessonContent.vocabulary.find(word => word.example_de);
  return example?.example_de || lessonContent.vocabulary[0]?.word || '';
}

function findRelatedRule(lessonContent, expected) {
  const expectedLower = String(expected || '').toLowerCase();
  const matchingRule = lessonContent.grammar.find(rule => {
    const title = String(rule.rule_title || '').toLowerCase();
    const examples = JSON.stringify(rule.examples || []).toLowerCase();
    return examples.includes(expectedLower) || title.includes('verb') || title.includes('position');
  });
  return matchingRule?.rule_title || matchingRule?.explanation_fr || 'Le verbe conjugué vient souvent en deuxième position dans une phrase principale allemande.';
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

module.exports = router;
