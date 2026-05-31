import { useEffect, useState } from 'react';
import { generateStory, getGeneratedContent, getLessons } from '../api/client';
import { SpeakButton } from './Summary';

export default function StoryMode() {
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [story, setStory] = useState(null);
  const [savedStories, setSavedStories] = useState([]);
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
    getGeneratedContent({ type: 'story', limit: 6 })
      .then(res => setSavedStories(res.data || []))
      .catch(() => setSavedStories([]));
  }, []);

  const createStory = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError('');
    try {
      const res = await generateStory({ lesson_id: lessonId });
      setStory(res.data);
      setSavedStories(current => [{ content: res.data, id: res.data.generated_content_id }, ...current]);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de générer l’histoire.');
    } finally {
      setLoading(false);
    }
  };

  const activeStory = story || savedStories[0]?.content;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Geschichten</h2>
        <p>Crée une petite histoire à partir du vocabulaire et des structures de la leçon.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <select value={lessonId} onChange={e => setLessonId(e.target.value)} style={inputStyle}>
          {lessons.length === 0 && <option value="">Aucune leçon</option>}
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>)}
        </select>
        <button className="btn btn-primary" type="button" onClick={createStory} disabled={loading || !lessonId}>
          {loading ? 'Génération...' : 'Générer story'}
        </button>
        {activeStory?.suggested_enrichment && (
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            from_pdf: {String(activeStory.suggested_enrichment.from_pdf)} · based_on_pdf: {String(activeStory.suggested_enrichment.based_on_pdf)}
          </span>
        )}
      </div>

      {error && <div className="error-message" style={{ marginBottom: 18 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 18 }}>
        <section className="card">
          {!activeStory && <div style={{ color: 'var(--text-muted)' }}>Aucune histoire générée pour le moment.</div>}
          {activeStory && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={{ color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {activeStory.level}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{activeStory.story_title}</h3>
              </div>

              {(activeStory.paragraphs || []).map((paragraph, index) => (
                <article key={index} style={panelStyle}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <p style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{paragraph.de}</p>
                    <SpeakButton text={paragraph.audio_text || paragraph.de} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>{paragraph.fr}</p>
                  {paragraph.ar && <p dir="rtl" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{paragraph.ar}</p>}
                </article>
              ))}

              {(activeStory.comprehension_questions || []).length > 0 && (
                <div style={panelStyle}>
                  <strong>Questions de compréhension</strong>
                  {(activeStory.comprehension_questions || []).map((question, index) => (
                    <details key={index} style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer' }}>{question.question_de || question.question_fr}</summary>
                      <div style={{ color: 'var(--green)', marginTop: 6 }}>{question.answer}</div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Histoires sauvegardées</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {savedStories.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Vide</div>}
            {savedStories.map(item => (
              <button
                key={item.id}
                className="btn btn-ghost"
                type="button"
                onClick={() => setStory(item.content)}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                {item.content?.story_title || item.title || 'Story'}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
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
