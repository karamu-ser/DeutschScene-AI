const { query } = require('./db');

function parseJSON(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function getLessonContent(userId, lessonId) {
  const params = [userId];
  let lessonSql = 'SELECT * FROM lessons WHERE user_id = ?';
  if (lessonId) {
    lessonSql += ' AND id = ?';
    params.push(lessonId);
  }
  lessonSql += ' ORDER BY created_at DESC, id DESC LIMIT 1';

  const [lesson] = query(lessonSql, params);
  if (!lesson) return null;

  const vocabulary = query(
    `SELECT id, word, article, plural, type, translation_fr, translation_ar,
            example_de, example_fr, level, topic
     FROM words
     WHERE user_id = ? AND lesson_id = ?
     ORDER BY id ASC`,
    [userId, lesson.id]
  );
  const grammar = query(
    `SELECT id, rule_title, explanation_fr, explanation_ar, examples_json, table_json
     FROM grammar_rules
     WHERE lesson_id = ?
     ORDER BY id ASC`,
    [lesson.id]
  ).map(rule => ({
    ...rule,
    examples: parseJSON(rule.examples_json, []),
    table: parseJSON(rule.table_json, [])
  }));
  const dialogues = query(
    `SELECT id, title, lines_json
     FROM dialogues
     WHERE lesson_id = ?
     ORDER BY id ASC`,
    [lesson.id]
  ).map(dialogue => ({
    ...dialogue,
    lines: parseJSON(dialogue.lines_json, [])
  }));
  const expressions = query(
    `SELECT id, expression, translation_fr, translation_ar, context
     FROM expressions
     WHERE lesson_id = ?
     ORDER BY id ASC`,
    [lesson.id]
  );
  const exercises = query(
    `SELECT id, type, instruction_de, instruction_fr, questions_json
     FROM exercises
     WHERE lesson_id = ?
     ORDER BY id ASC`,
    [lesson.id]
  ).map(exercise => ({
    ...exercise,
    questions: parseJSON(exercise.questions_json, [])
  }));

  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      level: lesson.level || 'A1',
      unit: lesson.unit,
      topic: lesson.topic,
      objectives: parseJSON(lesson.objectives_json, [])
    },
    vocabulary,
    grammar,
    dialogues,
    expressions,
    exercises
  };
}

module.exports = { getLessonContent, parseJSON };
