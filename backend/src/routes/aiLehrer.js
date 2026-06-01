const express = require('express');
const { getLessonContent } = require('../services/lessonContent');
const { saveGeneratedContent } = require('../services/generatedContent');
const { inferMistakeType, recordMistake } = require('../services/mistakes');
const { generateAiLehrerReply } = require('../services/gemini');

const router = express.Router();

router.post('/question', async (req, res) => {
  const lessonContent = getLessonContent(req.userId, req.body.lesson_id);
  if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

  const level = req.body.level || lessonContent.lesson.level || 'A1';
  const question = buildAiLehrerQuestion({ lessonContent, level });

  saveGeneratedContent({
    userId: req.userId,
    lessonId: lessonContent.lesson.id,
    type: 'ai_lehrer_question',
    title: 'AI Lehrer question',
    content: question,
    fromPdf: question.from_pdf,
    basedOnPdf: true,
    generatedBy: 'mock'
  });

  res.json(question);
});

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
      expectedAnswer: req.body.expected_answer || req.body.question?.expected_answer,
      question: req.body.question,
      level: req.body.level
    });
    persistAiLehrerResult(req.userId, lessonContent.lesson.id, response);
    return res.json(response);
  }

  try {
    const response = await generateAiLehrerReply({
      lessonContent,
      userAnswer,
      expectedAnswer: req.body.expected_answer || req.body.question?.expected_answer,
      question: req.body.question,
      history: req.body.history,
      level: req.body.level || lessonContent.lesson.level
    });
    const normalized = normalizeAiLehrerResponse(
      response,
      userAnswer,
      req.body.expected_answer || req.body.question?.expected_answer,
      lessonContent,
      req.body.question
    );
    persistAiLehrerResult(req.userId, lessonContent.lesson.id, normalized);
    res.json(normalized);
  } catch (err) {
    console.error('AI Lehrer error:', err);
    const fallback = buildMockAiLehrerResponse({
      lessonContent,
      userAnswer,
      expectedAnswer: req.body.expected_answer || req.body.question?.expected_answer,
      question: req.body.question,
      level: req.body.level || lessonContent.lesson.level
    });
    fallback.mode = 'mock_fallback';
    fallback.warning = 'Gemini indisponible, correction locale utilisée.';
    persistAiLehrerResult(req.userId, lessonContent.lesson.id, fallback);
    res.json(fallback);
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

function normalizeAiLehrerResponse(response, userAnswer, expectedAnswer, lessonContent, question) {
  const mock = buildMockAiLehrerResponse({ lessonContent, userAnswer, expectedAnswer, question });
  const isCorrect = typeof response.is_correct === 'boolean' ? response.is_correct : mock.is_correct;
  return {
    ...mock,
    ...response,
    mode: response.mode || 'gemini',
    is_correct: isCorrect,
    score: Number.isFinite(Number(response.score)) ? Number(response.score) : mock.score,
    mistake: isCorrect
      ? {}
      : {
        ...mock.mistake,
        ...(response.mistake || {}),
        user_answer: response.mistake?.user_answer || userAnswer
      },
    practice_session: isCorrect
      ? {
        ...mock.practice_session,
        exercises: [],
        from_pdf: false,
        based_on_pdf: true
      }
      : {
        ...mock.practice_session,
        ...(response.practice_session || response.next_exercise || {}),
        from_pdf: false,
        based_on_pdf: true
      },
    next_exercise: undefined
  };
}

function buildAiLehrerQuestion({ lessonContent, level }) {
  const expected = findExpectedSentence(lessonContent);
  const relatedRule = findRelatedRule(lessonContent, expected);
  const skill = inferMistakeType({
    expected,
    userAnswer: '',
    relatedRule,
    fallback: 'word_order'
  });
  const topic = lessonContent.lesson.topic || lessonContent.lesson.title || 'die Lektion';
  const questionDe = buildQuestionText({ level, expected, topic, skill });

  return {
    question_id: `ai-lehrer-${lessonContent.lesson.id}-${Date.now()}`,
    question_de: questionDe,
    expected_answer: expected,
    skill,
    related_rule: relatedRule,
    source: lessonContent.lesson.title || 'PDF lesson',
    from_pdf: true
  };
}

function buildMockAiLehrerResponse({ lessonContent, userAnswer, expectedAnswer, question, level }) {
  const expected = String(expectedAnswer || findExpectedSentence(lessonContent) || '').trim();
  const answer = String(userAnswer || '').trim();
  const relatedRule = question?.related_rule || findRelatedRule(lessonContent, expected);
  const mistakeType = inferMistakeType({
    expected,
    userAnswer: answer,
    relatedRule,
    fallback: question?.skill || 'word_order'
  });
  const isCorrect = answersMatch(answer, expected);
  const score = isCorrect ? 100 : scoreAnswer(answer, expected);
  const mistake = !isCorrect
    ? {
      mistake_type: mistakeType,
      expected,
      user_answer: answer,
      related_rule: relatedRule
    }
    : {};
  const practiceSession = isCorrect
    ? {
      title: 'Practice Session',
      focus: mistakeType,
      related_rule: relatedRule,
      exercises: [],
      from_pdf: false,
      based_on_pdf: true
    }
    : buildPracticeSession({
      mistakeType,
      expected,
      userAnswer: answer,
      relatedRule
    });

  return {
    mode: 'mock',
    level: level || lessonContent.lesson.level || 'A1',
    is_correct: isCorrect,
    score,
    feedback_fr: !isCorrect
      ? `Presque. ${relatedRule || 'Regarde la forme correcte.'} La bonne réponse est : ${expected}`
      : `Très bien. Ta réponse est correcte : ${expected || answer}`,
    feedback_ar: !isCorrect
      ? `قريب من الصحيح. الجواب الصحيح هو: ${expected}`
      : `جيد جدا. جوابك صحيح.`,
    correct_answer: expected || answer,
    mistake,
    practice_session: practiceSession
  };
}

function buildQuestionText({ level, expected, topic, skill }) {
  if (skill === 'article') return 'Welcher Artikel passt? Antworte mit der ganzen Wortgruppe.';
  if (skill === 'conjugation') return 'Bilde einen kurzen Satz mit dem richtigen Verb.';
  if (level === 'A1' || level === 'A2') {
    return `Antworte auf Deutsch mit einem einfachen Satz: ${simplePromptFromExpected(expected, topic)}`;
  }
  if (level === 'B1' || level === 'B2') {
    return `Antworte auf Deutsch in zwei Sätzen zum Thema "${topic}". Nutze die Struktur aus der Lektion.`;
  }
  return `Formuliere eine präzise Antwort auf Deutsch zum Thema "${topic}" und verwende eine passende Struktur aus der Lektion.`;
}

function simplePromptFromExpected(expected, topic) {
  const lower = String(expected || '').toLowerCase();
  if (lower.includes('komme') || lower.includes('aus')) return 'Woher kommst du?';
  if (lower.includes('heiße') || lower.includes('ich bin')) return 'Wie heißt du?';
  if (lower.includes('wohne')) return 'Wo wohnst du?';
  if (lower.includes('familie')) return 'Erzähl etwas über deine Familie.';
  return `Was sagst du zu "${topic}"?`;
}

function buildPracticeSession({ mistakeType, expected, userAnswer, relatedRule }) {
  const words = expected
    .replace(/[.!?]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const exercise = mistakeType === 'word_order' && words.length > 1
    ? {
      type: 'word_order',
      prompt_fr: `Remets les mots dans le bon ordre : ${shuffle(words).join(' / ')}`,
      prompt_de: 'Bringe die Wörter in die richtige Reihenfolge.',
      answer: expected
    }
    : {
      type: mistakeType === 'article' ? 'article' : 'rewrite',
      prompt_fr: `Corrige cette phrase : ${userAnswer || expected}`,
      prompt_de: 'Schreibe den Satz richtig.',
      answer: expected
    };

  return {
    title: 'Practice Session',
    focus: mistakeType,
    related_rule: relatedRule,
    exercises: [
      {
        id: 'practice-1',
        ...exercise,
        from_pdf: false,
        based_on_pdf: true
      }
    ],
    from_pdf: false,
    based_on_pdf: true
  };
}

function scoreAnswer(answer, expected) {
  const expectedTokens = normalizeForCompare(expected).split(' ').filter(Boolean);
  const answerTokens = normalizeForCompare(answer).split(' ').filter(Boolean);
  if (!expectedTokens.length || !answerTokens.length) return 0;
  const answerSet = new Set(answerTokens);
  const overlap = expectedTokens.filter(token => answerSet.has(token)).length;
  return Math.round((overlap / expectedTokens.length) * 70);
}

function answersMatch(answer, expected) {
  return normalizeForCompare(answer) === normalizeForCompare(expected);
}

function normalizeForCompare(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
