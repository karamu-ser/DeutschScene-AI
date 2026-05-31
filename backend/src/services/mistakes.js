const { query, run } = require('./db');

const MISTAKE_TYPES = new Set([
  'word_order',
  'conjugation',
  'article',
  'plural',
  'vocabulary',
  'pronunciation',
  'spelling',
  'wrong_preposition',
  'wrong_case',
  'missing_verb',
  'wrong_w_question'
]);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferMistakeType({ expected = '', userAnswer = '', relatedRule = '', fallback = 'vocabulary' }) {
  const expectedNorm = normalize(expected);
  const answerNorm = normalize(userAnswer);
  const ruleNorm = normalize(relatedRule);

  if (ruleNorm.includes('verb') || ruleNorm.includes('position') || ruleNorm.includes('ordre')) {
    return 'word_order';
  }
  if (/^(der|die|das)\b/.test(expectedNorm) || ['der', 'die', 'das'].includes(expectedNorm)) {
    return 'article';
  }
  if (expectedNorm.split(' ').sort().join(' ') === answerNorm.split(' ').sort().join(' ') && expectedNorm !== answerNorm) {
    return 'word_order';
  }
  if (!answerNorm) return 'missing_verb';
  return MISTAKE_TYPES.has(fallback) ? fallback : 'vocabulary';
}

function recordMistake({
  userId,
  lessonId = null,
  mistakeType,
  expected,
  userAnswer,
  relatedRule = null
}) {
  if (!userId) throw new Error('userId is required');
  if (!expected || !userAnswer) throw new Error('expected and userAnswer are required');

  const type = MISTAKE_TYPES.has(mistakeType)
    ? mistakeType
    : inferMistakeType({ expected, userAnswer, relatedRule, fallback: mistakeType });

  const existing = query(
    `SELECT *
     FROM mistakes
     WHERE user_id = ?
       AND COALESCE(lesson_id, 0) = COALESCE(?, 0)
       AND mistake_type = ?
       AND lower(expected) = lower(?)
       AND lower(user_answer) = lower(?)
     LIMIT 1`,
    [userId, lessonId || null, type, expected, userAnswer]
  )[0];

  if (existing) {
    run(
      `UPDATE mistakes
       SET count = count + 1, related_rule = COALESCE(?, related_rule), last_seen = datetime('now')
       WHERE id = ?`,
      [relatedRule, existing.id]
    );
    return query('SELECT * FROM mistakes WHERE id = ?', [existing.id])[0];
  }

  const result = run(
    `INSERT INTO mistakes
       (user_id, lesson_id, mistake_type, expected, user_answer, related_rule)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, lessonId || null, type, expected, userAnswer, relatedRule]
  );
  return query('SELECT * FROM mistakes WHERE id = ?', [result.lastInsertRowid])[0];
}

function listMistakes(userId, { lessonId, limit = 100 } = {}) {
  const params = [userId];
  let sql = 'SELECT * FROM mistakes WHERE user_id = ?';
  if (lessonId) {
    sql += ' AND lesson_id = ?';
    params.push(lessonId);
  }
  sql += ' ORDER BY count DESC, last_seen DESC LIMIT ?';
  params.push(Number(limit) || 100);
  return query(sql, params);
}

module.exports = {
  MISTAKE_TYPES,
  inferMistakeType,
  recordMistake,
  listMistakes
};
