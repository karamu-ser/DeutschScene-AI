import { useEffect, useState } from 'react';
import { generateExam, getLessons } from '../api/client';

export default function ExamMode() {
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLessons()
      .then(res => {
        const items = res.data || [];
        setLessons(items);
        if (items[0]?.id) setLessonId(String(items[0].id));
      })
      .catch(() => setLessons([]));
  }, []);

  const startExam = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError('');
    setSubmitted(false);
    setAnswers({});
    try {
      const res = await generateExam({ lesson_id: lessonId, count: 10 });
      setExam(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de générer l’examen.');
    } finally {
      setLoading(false);
    }
  };

  const score = exam ? exam.questions.reduce((total, question) => {
    const userAnswer = normalize(answers[question.id]);
    const expected = normalize(question.expected_answer);
    return total + (userAnswer && expected && userAnswer === expected ? 1 : 0);
  }, 0) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Prüfung</h2>
        <p>Génère un mini examen local à partir d’une leçon sauvegardée.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <select value={lessonId} onChange={e => setLessonId(e.target.value)} style={inputStyle}>
          {lessons.length === 0 && <option value="">Aucune leçon</option>}
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>)}
        </select>
        <button className="btn btn-primary" type="button" onClick={startExam} disabled={loading || !lessonId}>
          {loading ? 'Génération...' : 'Générer examen'}
        </button>
        {exam && <span style={{ color: 'var(--text-muted)' }}>{exam.questions.length} questions · {exam.level}</span>}
      </div>
      {error && <div className="error-message" style={{ marginBottom: 18 }}>{error}</div>}

      {exam && (
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{exam.exam_title}</h3>
            {submitted && <strong style={{ color: 'var(--accent)' }}>Score : {score}/{exam.questions.length}</strong>}
          </div>

          {exam.questions.map((question, index) => (
            <article key={question.id} style={panelStyle}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
                {index + 1}. {question.type}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>{question.prompt_fr}</div>
              {question.options?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {question.options.map(option => (
                    <button
                      key={option}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setAnswers(current => ({ ...current, [question.id]: option }))}
                      style={{ borderColor: answers[question.id] === option ? 'var(--accent)' : undefined }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  value={answers[question.id] || ''}
                  onChange={e => setAnswers(current => ({ ...current, [question.id]: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ta réponse..."
                />
              )}
              {submitted && (
                <div style={{ marginTop: 10, color: normalize(answers[question.id]) === normalize(question.expected_answer) ? 'var(--green)' : 'var(--red)' }}>
                  Réponse attendue : {question.expected_answer}
                </div>
              )}
            </article>
          ))}

          <button className="btn btn-primary" type="button" onClick={() => setSubmitted(true)}>
            Corriger l’examen
          </button>

          {submitted && (
            <div style={panelStyle}>
              <strong>Plan de révision</strong>
              {(exam.feedback?.revision_plan || []).map((item, index) => (
                <div key={index} style={{ color: 'var(--text-muted)', marginTop: 6 }}>{item}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

const inputStyle = {
  minWidth: 220,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)'
};
const panelStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 };
