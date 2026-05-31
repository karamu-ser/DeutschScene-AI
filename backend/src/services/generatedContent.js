const { query, run } = require('./db');

function saveGeneratedContent({
  userId,
  lessonId = null,
  type,
  title = null,
  content,
  fromPdf = false,
  basedOnPdf = true,
  generatedBy = 'local'
}) {
  if (!userId) throw new Error('userId is required');
  if (!type) throw new Error('type is required');
  if (!content || typeof content !== 'object') throw new Error('content object is required');

  const result = run(
    `INSERT INTO generated_content
       (user_id, lesson_id, type, title, content_json, from_pdf, based_on_pdf, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      lessonId || null,
      type,
      title,
      JSON.stringify(content),
      fromPdf ? 1 : 0,
      basedOnPdf ? 1 : 0,
      generatedBy
    ]
  );

  return {
    id: Number(result.lastInsertRowid),
    type,
    title,
    content,
    from_pdf: !!fromPdf,
    based_on_pdf: !!basedOnPdf,
    generated_by: generatedBy
  };
}

function listGeneratedContent(userId, { lessonId, type, limit = 20 } = {}) {
  const params = [userId];
  let sql = `SELECT * FROM generated_content WHERE user_id = ?`;
  if (lessonId) {
    sql += ' AND lesson_id = ?';
    params.push(lessonId);
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(Number(limit) || 20);

  return query(sql, params).map(row => ({
    ...row,
    content: JSON.parse(row.content_json || '{}'),
    from_pdf: !!row.from_pdf,
    based_on_pdf: !!row.based_on_pdf
  }));
}

module.exports = { saveGeneratedContent, listGeneratedContent };
