const express = require('express');
const { getLessonContent } = require('../services/lessonContent');
const { saveGeneratedContent } = require('../services/generatedContent');

const router = express.Router();

router.post('/generate', (req, res) => {
  const lessonContent = getLessonContent(req.userId, req.body.lesson_id);
  if (!lessonContent) return res.status(404).json({ error: 'Leçon non trouvée.' });

  const exam = generateLocalExam(lessonContent, {
    count: req.body.count,
    level: req.body.level
  });
  const saved = saveGeneratedContent({
    userId: req.userId,
    lessonId: lessonContent.lesson.id,
    type: 'exam',
    title: exam.exam_title,
    content: exam,
    fromPdf: false,
    basedOnPdf: true,
    generatedBy: 'local'
  });

  res.json({ ...exam, generated_content_id: saved.id });
});

function generateLocalExam(lessonContent, { count = 10, level } = {}) {
  const questions = [
    ...vocabularyQuestions(lessonContent),
    ...translationQuestions(lessonContent),
    ...grammarQuestions(lessonContent),
    ...wordOrderQuestions(lessonContent),
    ...sentenceCorrectionQuestions(lessonContent)
  ].slice(0, Number(count) || 10);

  return {
    exam_title: `Mini Exam - ${lessonContent.lesson.title || 'Lektion'}`,
    level: level || lessonContent.lesson.level || 'A1',
    based_on_lesson_id: lessonContent.lesson.id,
    questions,
    score: 0,
    feedback: {
      strengths: [],
      weaknesses: [],
      revision_plan: [
        'Révise les mots incorrects avec les flashcards.',
        'Répète les phrases modèles à voix haute.',
        'Refais les exercices liés aux erreurs enregistrées.'
      ]
    },
    from_pdf: false,
    based_on_pdf: true
  };
}

function vocabularyQuestions({ vocabulary }) {
  return vocabulary.slice(0, 4).map((word, index) => ({
    id: `vocab-${index + 1}`,
    type: 'vocabulary',
    prompt_fr: `Que signifie "${word.word}" ?`,
    prompt_de: word.word,
    expected_answer: word.translation_fr || word.translation_ar || '',
    options: buildOptions(word.translation_fr, vocabulary.map(item => item.translation_fr)),
    source: word.topic || 'PDF vocabulary',
    from_pdf: true,
    based_on_pdf: true
  }));
}

function translationQuestions({ vocabulary, expressions, dialogues }) {
  const phraseSources = [
    ...expressions.map(item => ({
      de: item.expression,
      fr: item.translation_fr,
      source: item.context || 'PDF expression'
    })),
    ...dialogues.flatMap(dialogue => (dialogue.lines || []).map(line => ({
      de: line.text || line.de,
      fr: line.translation_fr || line.fr,
      source: dialogue.title
    }))),
    ...vocabulary.filter(item => item.example_de).map(item => ({
      de: item.example_de,
      fr: item.example_fr,
      source: item.word
    }))
  ].filter(item => item.de);

  return phraseSources.slice(0, 3).map((item, index) => ({
    id: `translation-${index + 1}`,
    type: 'translation',
    prompt_fr: `Traduis en français : ${item.de}`,
    prompt_de: item.de,
    expected_answer: item.fr || '',
    source: item.source,
    from_pdf: true,
    based_on_pdf: true
  }));
}

function grammarQuestions({ grammar }) {
  return grammar.slice(0, 2).map((rule, index) => ({
    id: `grammar-${index + 1}`,
    type: 'grammar',
    prompt_fr: `Explique simplement cette règle : ${rule.rule_title}`,
    prompt_de: null,
    expected_answer: rule.explanation_fr || rule.rule_title,
    source: rule.rule_title,
    from_pdf: true,
    based_on_pdf: true
  }));
}

function wordOrderQuestions(lessonContent) {
  const sentences = lessonContent.dialogues
    .flatMap(dialogue => dialogue.lines || [])
    .map(line => line.text || line.de)
    .concat(lessonContent.vocabulary.map(word => word.example_de))
    .filter(sentence => sentence && sentence.split(/\s+/).length >= 3);

  return sentences.slice(0, 2).map((sentence, index) => {
    const words = sentence.replace(/[.!?]/g, '').split(/\s+/).filter(Boolean);
    return {
      id: `word-order-${index + 1}`,
      type: 'word_order',
      prompt_fr: `Remets les mots dans le bon ordre : ${shuffle(words).join(' / ')}`,
      prompt_de: null,
      expected_answer: sentence,
      source: 'PDF example',
      from_pdf: false,
      based_on_pdf: true
    };
  });
}

function sentenceCorrectionQuestions(lessonContent) {
  const rule = lessonContent.grammar.find(item => /verb|position|ordre/i.test(item.rule_title || item.explanation_fr || ''));
  const sentence = lessonContent.vocabulary.find(item => item.example_de)?.example_de;
  if (!sentence) return [];
  const words = sentence.replace(/[.!?]/g, '').split(/\s+/).filter(Boolean);
  if (words.length < 3) return [];
  return [{
    id: 'correction-1',
    type: 'correction',
    prompt_fr: `Corrige la phrase : ${shuffle(words).join(' ')}`,
    prompt_de: null,
    expected_answer: sentence,
    related_rule: rule?.rule_title || null,
    source: 'PDF example',
    from_pdf: false,
    based_on_pdf: true
  }];
}

function buildOptions(correct, allOptions) {
  if (!correct) return [];
  const options = [correct, ...shuffle(allOptions.filter(Boolean).filter(option => option !== correct)).slice(0, 3)];
  return shuffle([...new Set(options)]);
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

module.exports = router;
