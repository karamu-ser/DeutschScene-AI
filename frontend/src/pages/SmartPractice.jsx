import { useEffect, useMemo, useState } from 'react';
import { getLessons, getMistakes, getReviewWords } from '../api/client';

const LABELS = {
  word_order: 'Satzstellung',
  article: 'Der / die / das',
  vocabulary: 'Wortschatz',
  pronunciation: 'Aussprache',
  conjugation: 'Konjugation',
  wrong_w_question: 'W-Fragen',
  spelling: 'Rechtschreibung',
  wrong_preposition: 'Präpositionen',
  wrong_case: 'Kasus'
};

export default function SmartPractice() {
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [mistakes, setMistakes] = useState([]);
  const [reviewWords, setReviewWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([getLessons(), getMistakes(), getReviewWords()])
      .then(([lessonsRes, mistakesRes, reviewRes]) => {
        const lessonItems = lessonsRes.value?.data || [];
        setLessons(lessonItems);
        if (lessonItems[0]?.id) setLessonId(String(lessonItems[0].id));
        setMistakes(mistakesRes.value?.data || []);
        setReviewWords(reviewRes.value?.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const session = useMemo(() => buildSmartSession({ mistakes, reviewWords, lessonId }), [mistakes, reviewWords, lessonId]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Intelligentes Üben</h2>
        <p>Une session courte choisie automatiquement selon tes erreurs fréquentes et tes mots difficiles.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <select value={lessonId} onChange={e => setLessonId(e.target.value)} style={inputStyle}>
          {lessons.length === 0 && <option value="">Toutes les leçons</option>}
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)' }}>{session.estimated_time_minutes} minutes · {session.exercises.length} exercices</span>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Préparation de la session...</span></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 18 }}>
          <aside className="card">
            <div style={{ color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Focus</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 12 }}>{session.session_title}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {session.focus.map(item => (
                <span key={item} style={{ background: 'var(--accent-dim)', border: '1px solid rgba(232,197,71,0.25)', borderRadius: 999, padding: '4px 9px', fontSize: 12 }}>
                  {LABELS[item] || item}
                </span>
              ))}
            </div>
          </aside>

          <section className="card" style={{ display: 'grid', gap: 12 }}>
            {session.exercises.map((exercise, index) => (
              <details key={exercise.id} style={panelStyle} open={index === 0}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                  {index + 1}. {exercise.title}
                </summary>
                <p style={{ marginTop: 10 }}>{exercise.prompt}</p>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                  from_pdf: {String(exercise.from_pdf)} · based_on_pdf: {String(exercise.based_on_pdf)}
                </div>
                <div style={{ color: 'var(--green)', marginTop: 10 }}>Réponse : {exercise.answer}</div>
              </details>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

function buildSmartSession({ mistakes, reviewWords, lessonId }) {
  const filteredMistakes = lessonId
    ? mistakes.filter(item => !item.lesson_id || String(item.lesson_id) === String(lessonId))
    : mistakes;
  const counts = new Map();
  for (const mistake of filteredMistakes) {
    counts.set(mistake.mistake_type, (counts.get(mistake.mistake_type) || 0) + Number(mistake.count || 1));
  }

  const focus = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type);
  if (focus.length === 0) focus.push(reviewWords.length ? 'vocabulary' : 'word_order');

  const exercises = [
    ...filteredMistakes.slice(0, 6).map((mistake, index) => exerciseFromMistake(mistake, index)),
    ...reviewWords.slice(0, 4).map((word, index) => ({
      id: `review-${word.id || index}`,
      type: 'vocabulary',
      title: 'Mot difficile',
      prompt: `Donne la traduction et une phrase avec : ${word.word}`,
      answer: word.translation_fr || word.translation_ar || word.example_de || word.word,
      from_pdf: true,
      based_on_pdf: true
    }))
  ].slice(0, 8);

  if (exercises.length === 0) {
    exercises.push({
      id: 'starter-word-order',
      type: 'word_order',
      title: 'Ordre des mots',
      prompt: 'Remets les mots dans le bon ordre : komme / aus / Marokko / Ich',
      answer: 'Ich komme aus Marokko.',
      from_pdf: false,
      based_on_pdf: true
    });
  }

  return {
    session_title: `Intelligentes Üben - ${LABELS[focus[0]] || focus[0]}`,
    focus,
    exercises,
    estimated_time_minutes: Math.max(5, Math.min(12, exercises.length * 2))
  };
}

function exerciseFromMistake(mistake, index) {
  if (mistake.mistake_type === 'word_order') {
    const words = String(mistake.expected || '').replace(/[.!?]/g, '').split(/\s+/).filter(Boolean);
    return {
      id: `mistake-${mistake.id || index}`,
      type: 'word_order',
      title: 'Corriger l’ordre des mots',
      prompt: `Remets les mots dans le bon ordre : ${shuffle(words).join(' / ')}`,
      answer: mistake.expected,
      from_pdf: false,
      based_on_pdf: true
    };
  }

  return {
    id: `mistake-${mistake.id || index}`,
    type: mistake.mistake_type,
    title: LABELS[mistake.mistake_type] || 'Erreur fréquente',
    prompt: `Corrige : ${mistake.user_answer}`,
    answer: mistake.expected,
    from_pdf: false,
    based_on_pdf: true
  };
}

function shuffle(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

const inputStyle = {
  minWidth: 240,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)'
};
const panelStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 };
