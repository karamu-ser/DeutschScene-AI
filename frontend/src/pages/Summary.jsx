import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSummary } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';

export function SpeakButton({ text, label = 'Écouter' }) {
  const { speak } = useSpeech();
  if (!text) return null;

  return (
    <button
      type="button"
      aria-label={`${label} ${text}`}
      title={`${label} ${text}`}
      onClick={() => speak(text)}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        color: 'var(--accent)',
        cursor: 'pointer',
        padding: 0
      }}
    >
      🔊
    </button>
  );
}

export function Section({ title, children, action }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', margin: 0 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WordCard({ word }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.2 }}>{word.de}</div>
          {word.fr && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{word.fr}</div>}
        </div>
        <SpeakButton text={word.de} label="Écouter le mot" />
      </div>
      {word.ar && <div style={{ color: 'var(--text-muted)', fontSize: 13, direction: 'rtl', textAlign: 'right', marginTop: 4 }}>{word.ar}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {word.group && <span style={{ background: 'var(--muted)', borderRadius: 12, padding: '1px 7px', fontSize: 11, color: 'var(--text-muted)' }}>{word.group}</span>}
        {word.memory && <span style={{ color: 'var(--accent)', fontSize: 12 }}>{word.memory}</span>}
      </div>
      {word.example_de && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{word.example_de}</span>
            <SpeakButton text={word.example_de} label="Écouter l'exemple" />
          </div>
          {word.example_fr && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{word.example_fr}</div>}
        </div>
      )}
    </div>
  );
}

export function GrammarCard({ rule }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--blue)', marginBottom: 8 }}>{rule.title || rule.name}</div>
      {(rule.simple || rule.explanation) && <p style={{ marginBottom: 8 }}>{rule.simple || rule.explanation}</p>}
      {(rule.child_explanation || rule.like_child) && (
        <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 10, fontSize: 13, marginBottom: 10 }}>
          {rule.child_explanation || rule.like_child}
        </div>
      )}
      {rule.pattern && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>{rule.pattern}</div>}
      {(rule.steps || []).length > 0 && (
        <ol style={{ margin: '0 0 10px 18px', padding: 0, color: 'var(--text-muted)', fontSize: 13 }}>
          {rule.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      )}
      {(rule.subrules || []).length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
          {rule.subrules.map((subrule, index) => (
            <div key={`${subrule.name}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10 }}>
              <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{subrule.name}</div>
              {(subrule.meaning || subrule.when_to_use) && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '3px 0 8px' }}>
                  {[subrule.meaning, subrule.when_to_use].filter(Boolean).join(' · ')}
                </div>
              )}
              {(subrule.examples || []).map((example, exampleIndex) => (
                <div key={exampleIndex} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: exampleIndex ? 6 : 0 }}>
                  <span style={{ flex: 1, fontWeight: 500 }}>{example.de}</span>
                  <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 12 }}>{example.fr}</span>
                  <SpeakButton text={example.de} label="Écouter l'exemple" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {(rule.examples || []).map((example, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: index ? '1px solid var(--border)' : 'none', paddingTop: index ? 8 : 0, marginTop: index ? 8 : 0 }}>
          <span style={{ flex: 1, fontWeight: 500 }}>{example.de}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{example.fr}</span>
          <SpeakButton text={example.de} label="Écouter l'exemple" />
        </div>
      ))}
      {(rule.common_mistakes || []).length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, color: 'var(--red)', fontSize: 13 }}>
          {rule.common_mistakes.map((mistake, index) => <div key={index}>{mistake}</div>)}
        </div>
      )}
    </div>
  );
}

export function PhraseRow({ phrase }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(160px, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 600 }}>{phrase.de}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        {phrase.fr}
        {phrase.use && <span style={{ display: 'block', color: 'var(--accent)', marginTop: 2 }}>{phrase.use}</span>}
      </div>
      <SpeakButton text={phrase.de} label="Écouter la phrase" />
    </div>
  );
}

function UnifiedSummary({ summary }) {
  return (
    <div className="card">
      {summary.overview && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, color: 'var(--text-muted)' }}>
          {summary.overview}
        </div>
      )}

      {(summary.must_remember || []).length > 0 && (
        <Section title="À retenir en premier">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {summary.must_remember.map((item, index) => (
              <div key={index} style={{ background: 'var(--accent-dim)', border: '1px solid rgba(232,197,71,0.25)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                {item}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(summary.source_coverage || []).length > 0 && (
        <Section title="Leçons couvertes">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {summary.source_coverage.map((item, index) => (
              <div key={index} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 700 }}>{item.lesson_title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{item.covered_in}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(summary.vocabulary || []).length > 0 && (
        <Section title="Vocabulaire essentiel">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {summary.vocabulary.map((word, index) => <WordCard key={`${word.de}-${index}`} word={word} />)}
          </div>
        </Section>
      )}

      {(summary.grammar || []).length > 0 && (
        <Section title="Grammaire claire">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {summary.grammar.map((rule, index) => <GrammarCard key={`${rule.title}-${index}`} rule={rule} />)}
          </div>
        </Section>
      )}

      {(summary.phrases || []).length > 0 && (
        <Section title="Phrases prêtes à utiliser">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 14px' }}>
            {summary.phrases.map((phrase, index) => <PhraseRow key={`${phrase.de}-${index}`} phrase={phrase} />)}
          </div>
        </Section>
      )}

      {(summary.dialogues || []).length > 0 && (
        <Section title="Dialogues modèles">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {summary.dialogues.map((dialogue, index) => (
              <div key={`${dialogue.title}-${index}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ color: 'var(--purple)', fontWeight: 700 }}>{dialogue.title || 'Dialogue'}</div>
                  {dialogue.goal && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{dialogue.goal}</div>}
                </div>
                {(dialogue.lines || []).map((line, lineIndex) => (
                  <div key={lineIndex} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: lineIndex ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, width: 24 }}>{line.speaker || ''}</span>
                    <span style={{ flex: 1 }}>{line.de}</span>
                    <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 13 }}>{line.fr}</span>
                    <SpeakButton text={line.de} label="Écouter la réplique" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(summary.practice || []).length > 0 && (
        <Section title="Mini test">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {summary.practice.slice(0, 12).map((item, index) => (
              <details key={index} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{item.question}</summary>
                <div style={{ color: 'var(--green)', marginTop: 8 }}>{item.answer}</div>
              </details>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export default function Summary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSummary()
      .then(res => setSummary(res.data))
      .catch(err => {
        console.error(err);
        setError("Erreur lors du chargement du résumé.");
      })
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => ({
    words: summary?.vocabulary?.length || 0,
    rules: summary?.grammar?.length || 0,
    phrases: summary?.phrases?.length || 0,
    practice: summary?.practice?.length || 0,
    sourceLessons: summary?.source_lessons || 0
  }), [summary]);

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Résumé IA en préparation...</span></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Résumé intelligent</h2>
        <p>Une seule grande leçon claire, fusionnée et facile à retenir.</p>
      </div>

      {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20, color: 'var(--red)' }}>⚠️ {error}</div>}

      {!error && !totals.sourceLessons ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <h3>Aucune leçon importée</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Importe une leçon, ou utilise la page Bases IA pour apprendre sans fichier.</p>
          <Link to="/bases" className="btn btn-primary">Voir les bases IA</Link>
        </div>
      ) : (
        <>
          <div className="card" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
                  {summary?.title || 'Résumé intelligent A1/A2'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {summary?.cached ? 'Résumé chargé depuis le cache.' : 'Résumé régénéré après changement des leçons.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--accent)', color: 'var(--black)', borderRadius: 12, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{totals.sourceLessons} sources</span>
                <span style={{ background: 'var(--surface)', borderRadius: 12, padding: '4px 10px', fontSize: 12 }}>{totals.words} mots</span>
                <span style={{ background: 'var(--surface)', borderRadius: 12, padding: '4px 10px', fontSize: 12 }}>{totals.rules} règles</span>
                <span style={{ background: 'var(--surface)', borderRadius: 12, padding: '4px 10px', fontSize: 12 }}>{totals.phrases} phrases</span>
              </div>
            </div>
          </div>

          {(summary?.memory_plan || []).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              {summary.memory_plan.map((step, index) => (
                <div key={index} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
                  <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: 22, marginBottom: 6 }}>{index + 1}</div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          )}

          <UnifiedSummary summary={summary} />
        </>
      )}
    </div>
  );
}
