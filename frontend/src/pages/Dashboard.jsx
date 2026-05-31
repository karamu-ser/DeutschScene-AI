import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getDashboard, rateDifficulty } from '../api/client';

const MotionLink = motion(Link);

function AnimatedNumber({ value, suffix = '' }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, latest => `${Math.round(latest)}${suffix}`);

  useEffect(() => {
    const controls = animate(motionValue, Number(value) || 0, { duration: 0.8, ease: 'easeOut' });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span>{rounded}</motion.span>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard()
      .finally(() => setLoading(false));
  }, []);

  const loadDashboard = () => {
    return getDashboard()
      .then(r => setData(r.data))
      .catch(console.error);
  };

  const markEasy = async (wordId) => {
    await rateDifficulty({ word_id: wordId, difficulty: 'easy' });
    setData(current => {
      const nextList = (current?.hardWordsList || []).filter(word => word.id !== wordId);
      return {
        ...current,
        hardWords: Math.max(0, Number(current?.hardWords || 0) - 1),
        hardWordsList: nextList
      };
    });
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>;

  const d = data || {};

  return (
    <div className="page">
      <div className="page-header">
        <h2>Guten Morgen! 👋</h2>
        <p>Voici ton résumé d'apprentissage aujourd'hui.</p>
      </div>

      <div className="stat-grid">
        <motion.div className="stat-card yellow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
          <div className="label">Mots appris</div>
          <div className="value"><AnimatedNumber value={d.totalWords || 0} /></div>
          <div className="sub">total dans la base</div>
        </motion.div>
        <motion.div className="stat-card blue" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} whileHover={{ y: -3 }}>
          <div className="label">À réviser</div>
          <div className="value"><AnimatedNumber value={d.todayReview || 0} /></div>
          <div className="sub">aujourd'hui</div>
        </motion.div>
        <motion.div className="stat-card green" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} whileHover={{ y: -3 }}>
          <div className="label">Score quiz</div>
          <div className="value"><AnimatedNumber value={d.quizAccuracy || 0} suffix="%" /></div>
          <div className="sub">précision moyenne</div>
        </motion.div>
        <motion.div className="stat-card red" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} whileHover={{ y: -3 }}>
          <div className="label">Difficiles</div>
          <div className="value"><AnimatedNumber value={d.hardWords || 0} /></div>
          <div className="sub">mots à retravailler</div>
        </motion.div>
      </div>

      {(d.hardWordsList || []).length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Mots difficiles</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tu peux les envoyer en facile si ce n'est plus un problème.</div>
            </div>
            <Link to="/flashcards" className="btn btn-ghost btn-sm">Pratiquer</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {d.hardWordsList.map(word => (
              <div key={word.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{word.word}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{word.translation_fr || word.translation_ar || 'Sans traduction'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(248,113,113,0.12)', padding: '2px 7px', borderRadius: 8 }}>hard</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => markEasy(word.id)}>Marquer facile</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <MotionLink to="/flashcards" className="card" whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} style={{ textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🃏</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Flashcards</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Révise tes mots avec des cartes interactives</div>
        </MotionLink>
        <MotionLink to="/quiz" className="card" whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} style={{ textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Quiz</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Teste tes connaissances avec des exercices variés</div>
        </MotionLink>
        <MotionLink to="/pronunciation" className="card" whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} style={{ textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎙️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Prononciation</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Entraîne ta prononciation allemande</div>
        </MotionLink>
        <MotionLink to="/upload" className="card" whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} style={{ textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>Importer</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Ajoute un nouveau document PDF ou image</div>
        </MotionLink>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent words */}
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16 }}>Derniers mots ajoutés</div>
          {(d.recentWords || []).length === 0 ? (
            <div className="empty" style={{ padding: '20px 0' }}>
              <p>Aucun mot encore. <Link to="/upload" style={{ color: 'var(--accent)' }}>Importe un document</Link></p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.recentWords.map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{w.word}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 8 }}>{w.level}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{w.translation_fr}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topics */}
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16 }}>Thèmes étudiés</div>
          {(d.topicsList || []).length === 0 ? (
            <div className="empty" style={{ padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)' }}>Aucun thème encore.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {d.topicsList.map((t, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 13 }}>
                  {t.topic} <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
