import { useEffect, useState } from 'react';
import { getBasics, updateBasics } from '../api/client';
import { GrammarCard, PhraseRow, Section, SpeakButton, WordCard } from './Summary';

function BasicsSection({ item }) {
  return (
    <article className="card" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>{item.title}</h2>
          {item.why && <p style={{ color: 'var(--text-muted)', maxWidth: 720 }}>{item.why}</p>}
        </div>
      </div>

      {(item.rules || []).length > 0 && (
        <Section title="Règles simples">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {item.rules.map((rule, index) => <GrammarCard key={`${rule.name}-${index}`} rule={rule} />)}
          </div>
        </Section>
      )}

      {(item.words || []).length > 0 && (
        <Section title="Mots de base">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {item.words.map((word, index) => <WordCard key={`${word.de}-${index}`} word={word} />)}
          </div>
        </Section>
      )}

      {(item.phrases || []).length > 0 && (
        <Section title="Phrases utiles">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 14px' }}>
            {item.phrases.map((phrase, index) => <PhraseRow key={`${phrase.de}-${index}`} phrase={phrase} />)}
          </div>
        </Section>
      )}
    </article>
  );
}

export default function Basics() {
  const [basics, setBasics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const loadBasics = () => {
    setLoading(true);
    getBasics()
      .then(res => setBasics(res.data))
      .catch(err => {
        console.error(err);
        setError("Erreur lors du chargement des bases.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBasics();
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const { data } = await updateBasics();
      setBasics(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Erreur lors de la mise à jour IA.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2>Bases IA</h2>
          <p>Une base complète pour apprendre l'allemand, même sans fichier importé.</p>
        </div>
        <button className="btn btn-primary" onClick={handleUpdate} disabled={updating}>
          {updating ? 'Update en cours...' : 'Update'}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20, color: 'var(--red)' }}>⚠️ {error}</div>}

      {basics?.needs_update ? (
        <div className="card" style={{ textAlign: 'center', padding: 42 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <h3>Les bases IA ne sont pas encore générées</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Clique sur Update pour créer une page complète avec l'IA. Elle ne changera plus tant que tu ne recliques pas.</p>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={updating}>
            {updating ? 'Génération...' : 'Update maintenant'}
          </button>
        </div>
      ) : (
        <>
          <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>{basics?.title || 'Bases allemand A1/A2'}</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {basics?.updated_note || 'Contenu généré par IA et conservé jusqu’au prochain Update.'}
                </div>
              </div>
              {basics?.updated_at && (
                <span style={{ background: 'var(--surface)', borderRadius: 12, padding: '4px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Dernier update: {basics.updated_at}
                </span>
              )}
            </div>
          </div>

          {(basics?.learning_order || []).length > 0 && (
            <Section title="Ordre d'apprentissage">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {basics.learning_order.map((step, index) => (
                  <div key={index} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
                    <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 22, marginBottom: 6 }}>{index + 1}</div>
                    <div>{step}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(basics?.sections || []).map((item, index) => <BasicsSection key={`${item.title}-${index}`} item={item} />)}

          {(basics?.daily_plan || []).length > 0 && (
            <Section title="Plan quotidien">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {basics.daily_plan.map((day, index) => (
                  <div key={index} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{day.day}</div>
                    <div>{day.task}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{day.goal}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(basics?.practice || []).length > 0 && (
            <Section title="Questions rapides">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {basics.practice.map((item, index) => (
                  <details key={index} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{item.question}</summary>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--green)', marginTop: 8 }}>
                      <span style={{ flex: 1 }}>{item.answer}</span>
                      <SpeakButton text={item.answer} label="Écouter la réponse" />
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
