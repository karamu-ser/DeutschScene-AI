import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWords, checkPronunciation } from '../api/client';
import { isDemoMode } from '../api/demoData';
import { useSpeech, useRecognition } from '../hooks/useSpeech';
import { Link } from 'react-router-dom';

export default function Pronunciation() {
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { speak } = useSpeech();
  const { isListening, transcript, error: micError, startListening, stopListening } = useRecognition();

  useEffect(() => {
    getWords()
      .then(r => setWords(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const current = words[index];

  const simulateDemoPronunciation = () => {
    if (!current || checking) return;
    setResult(null);
    setChecking(true);
    setTimeout(async () => {
      const spoken = current.word.replace(/^(der|die|das)\s+/i, '');
      try {
        const res = await checkPronunciation({
          word_id: current.id,
          expected: current.word,
          spoken,
          context: 'demo'
        });
        setResult({ ...res.data, spoken });
      } catch (e) {
        setResult({ score: 86, feedback_fr: 'Demo pronunciation result.', spoken });
      } finally {
        setChecking(false);
      }
    }, 500);
  };

  const handleMic = () => {
    if (isDemoMode()) {
      simulateDemoPronunciation();
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }
    setResult(null);
    startListening(async (spoken) => {
      if (!current || !spoken) return;
      setChecking(true);
      try {
        const res = await checkPronunciation({
          word_id: current.id,
          expected: current.word,
          spoken,
          context: 'normal'
        });
        setResult({ ...res.data, spoken });
      } catch (e) {
        console.error(e);
        setResult({ score: 0, feedback_fr: 'Erreur lors de la vérification.', spoken });
      } finally {
        setChecking(false);
      }
    });
  };

  const next = () => {
    setResult(null);
    if (index + 1 < words.length) setIndex(i => i + 1);
  };

  const prev = () => {
    setResult(null);
    if (index > 0) setIndex(i => i - 1);
  };

  const playAudio = (text, rate = 0.8) => {
    setSpeaking(true);
    speak(text, rate);
    setTimeout(() => setSpeaking(false), rate < 0.8 ? 1800 : 1300);
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  if (words.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          <p>Aucun mot trouvé.<br /><Link to="/upload" style={{ color: 'var(--accent)' }}>Importe un document d'abord.</Link></p>
        </div>
      </div>
    );
  }

  const scoreClass = result
    ? result.score >= 80 ? 'score-high' : result.score >= 50 ? 'score-mid' : 'score-low'
    : '';

  return (
    <div className="page">
      <div className="page-header">
        <h2>Prononciation</h2>
        <p>Écoute le mot en allemand, puis répète-le à voix haute. L'IA évalue ta prononciation.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{index + 1} / {words.length}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={prev} disabled={index === 0}>←</button>
          <button className="btn btn-ghost btn-sm" onClick={next} disabled={index + 1 >= words.length}>→</button>
        </div>
      </div>

      {/* Main word card */}
      <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: 40, marginBottom: 20 }}>
        {current.article && (
          <span className={`card-article article-${current.article}`} style={{ marginBottom: 12, display: 'inline-block' }}>
            {current.article}
          </span>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, marginBottom: 12 }}>
          {current.word.replace(/^(der|die|das)\s+/i, '')}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 18, marginBottom: 6 }}>
          🇫🇷 {current.translation_fr}
        </div>
        {current.translation_ar && (
          <div style={{ color: 'var(--text-muted)', fontSize: 16, direction: 'rtl', marginBottom: 16 }}>
            🇲🇦 {current.translation_ar}
          </div>
        )}
        {current.example_de && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 20px', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 24 }}>
            „{current.example_de}"
          </div>
        )}

        {/* Listen buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
          <button className={`btn btn-primary sound-button${speaking ? ' is-playing' : ''}`} onClick={() => playAudio(current.word)}>
            <span>🔊</span>
            Écouter
            {speaking && <span className="sound-wave"><i /><i /><i /></span>}
          </button>
          <button className="btn btn-ghost" onClick={() => playAudio(current.word, 0.5)}>
            🐢 Lentement
          </button>
          {current.example_de && (
            <button className="btn btn-ghost" onClick={() => playAudio(current.example_de)}>
              💬 Phrase
            </button>
          )}
        </div>

        {/* Mic button */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            {isDemoMode() ? 'Demo Mode: clique pour simuler le micro' : isListening ? 'Ich höre zu...' : 'Clique pour répéter le mot'}
          </div>
          <div className={`mic-listener${isListening ? ' is-listening' : ''}`}>
            <span className="mic-ring" />
            <button
              className={`btn-icon${isListening ? ' active' : ''}`}
              style={{ width: 64, height: 64 }}
              onClick={handleMic}
              disabled={checking}
            >
              {checking ? (
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </svg>
              )}
            </button>
          </div>
          {isDemoMode() && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" type="button" onClick={simulateDemoPronunciation} disabled={checking}>
                {checking ? 'Simulation...' : 'Simuler la prononciation'}
              </button>
            </div>
          )}
        </div>

        {micError && (
          <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>⚠️ {micError}</div>
        )}
      </motion.div>

      {/* Result */}
      <AnimatePresence>
      {result && (
        <motion.div className="card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 20 }}>Résultat</div>

          <motion.div className={`score-circle ${scoreClass}`} initial={{ scale: 0.88 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }} style={{ margin: '0 auto 20px' }}>
            <div className="number">{result.score}</div>
            <div className="pct">/ 100</div>
          </motion.div>

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 20px', marginBottom: 16, fontSize: 14 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tu as dit : </span>
            <span style={{ fontStyle: 'italic', color: 'var(--text)' }}>"{result.spoken}"</span>
          </div>

          {result.feedback_fr && (
            <div style={{ marginBottom: 8, padding: '12px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 14 }}>
              🇫🇷 {result.feedback_fr}
            </div>
          )}
          {result.feedback_ar && (
            <div style={{ padding: '12px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 14, direction: 'rtl' }}>
              🇲🇦 {result.feedback_ar}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ℹ️ La notation est approximative — basée sur la transcription vocale du navigateur.
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setResult(null)}>Réessayer</button>
            <button className="btn btn-primary" onClick={next} disabled={index + 1 >= words.length}>
              Mot suivant →
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
