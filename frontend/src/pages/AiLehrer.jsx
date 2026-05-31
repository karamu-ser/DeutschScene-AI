import { useEffect, useState } from 'react';
import { aiLehrerRespond, getLessons } from '../api/client';
import { SpeakButton } from './Summary';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AiLehrer() {
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [level, setLevel] = useState('A1');
  const [expected, setExpected] = useState('Ich komme aus Marokko.');
  const [answer, setAnswer] = useState('Ich aus Marokko komme.');
  const [useMock, setUseMock] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLessons()
      .then(res => {
        const items = res.data || [];
        setLessons(items);
        if (items[0]?.id) {
          setLessonId(String(items[0].id));
          setLevel(items[0].level || 'A1');
        }
      })
      .catch(() => setLessons([]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!lessonId || !answer.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await aiLehrerRespond({
        lesson_id: lessonId,
        level,
        expected_answer: expected,
        user_answer: answer,
        mock: useMock
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'AI Lehrer indisponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>AI Lehrer</h2>
        <p>Un professeur IA qui corrige avec le vocabulaire, les exemples et les règles de ta leçon PDF.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)', gap: 18 }}>
        <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label>
            <span style={labelStyle}>Leçon</span>
            <select value={lessonId} onChange={e => setLessonId(e.target.value)} style={inputStyle}>
              {lessons.length === 0 && <option value="">Aucune leçon</option>}
              {lessons.map(lesson => (
                <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>
              ))}
            </select>
          </label>

          <label>
            <span style={labelStyle}>Niveau</span>
            <select value={level} onChange={e => setLevel(e.target.value)} style={inputStyle}>
              {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            <span style={labelStyle}>Réponse attendue</span>
            <input value={expected} onChange={e => setExpected(e.target.value)} style={inputStyle} />
          </label>

          <label>
            <span style={labelStyle}>Réponse utilisateur</span>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} style={inputStyle} />
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={useMock} onChange={e => setUseMock(e.target.checked)} />
            Mock mode sans Gemini
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading || !lessonId}>
            {loading ? 'Correction...' : 'Corriger avec AI Lehrer'}
          </button>
          {error && <div className="error-message">{error}</div>}
        </form>

        <section className="card">
          {!result && (
            <div style={{ color: 'var(--text-muted)' }}>
              Envoie une réponse pour recevoir une correction, une règle liée et un mini exercice.
            </div>
          )}

          {result && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={eyebrowStyle}>Feedback</div>
                <p style={{ fontSize: 18 }}>{result.feedback_fr}</p>
                {result.feedback_ar && <p dir="rtl" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{result.feedback_ar}</p>}
              </div>

              <div style={panelStyle}>
                <div style={eyebrowStyle}>Phrase correcte</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ flex: 1 }}>{result.correct_answer}</strong>
                  <SpeakButton text={result.correct_answer} />
                </div>
              </div>

              {result.mistake && (
                <div style={panelStyle}>
                  <div style={eyebrowStyle}>Mistake Memory</div>
                  <div>Type : <strong>{result.mistake.mistake_type}</strong></div>
                  <div style={{ color: 'var(--text-muted)' }}>{result.mistake.related_rule}</div>
                </div>
              )}

              {result.next_exercise && (
                <div style={panelStyle}>
                  <div style={eyebrowStyle}>Mini exercice</div>
                  <p>{result.next_exercise.prompt_fr}</p>
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>Voir la réponse</summary>
                    <div style={{ marginTop: 8 }}>{result.next_exercise.answer}</div>
                  </details>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
                    from_pdf: {String(result.next_exercise.from_pdf)} · based_on_pdf: {String(result.next_exercise.based_on_pdf)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 };
const inputStyle = {
  width: '100%',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '11px 12px',
  fontFamily: 'var(--font-body)'
};
const eyebrowStyle = { color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 };
const panelStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 };
