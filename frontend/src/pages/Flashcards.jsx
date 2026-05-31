import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getReviewWords, getWords, rateDifficulty } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';
import { Link } from 'react-router-dom';

const SESSION_LIMIT = 18;

function cleanGermanWord(word = '') {
  return String(word).replace(/^(der|die|das)\s+/i, '').trim();
}

function normalizeAnswer(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(expected, given) {
  const a = normalizeAnswer(expected);
  const b = normalizeAnswer(given);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 82;

  const aParts = a.split(' ');
  const bParts = b.split(' ');
  const matches = aParts.filter(part => bParts.includes(part)).length;
  const wordScore = Math.round((matches / Math.max(aParts.length, bParts.length)) * 72);
  const prefixBonus = a[0] === b[0] ? 8 : 0;
  return Math.min(100, wordScore + prefixBonus);
}

function smartWeight(word) {
  const difficulty = word.difficulty || 'new';
  const reviewCount = Number(word.review_count || 0);
  const ageBoost = reviewCount === 0 ? 5 : 0;
  const difficultyBoost = difficulty === 'hard' ? 8 : difficulty === 'medium' ? 5 : difficulty === 'easy' ? 1 : 6;
  return difficultyBoost + ageBoost + Math.max(0, 4 - reviewCount);
}

function buildSmartQueue(words) {
  return words
    .slice()
    .sort((a, b) => smartWeight(b) - smartWeight(a) || String(a.word).localeCompare(String(b.word)))
    .slice(0, SESSION_LIMIT);
}

function cardPrompt(word) {
  return word?.translation_fr || word?.translation_ar || word?.example_fr || '';
}

export default function Flashcards() {
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [stats, setStats] = useState({ good: 0, ok: 0, hard: 0 });
  const { speak } = useSpeech();

  useEffect(() => {
    loadSmartSession();
  }, []);

  const loadSmartSession = async () => {
    setLoading(true);
    setIndex(0);
    setAnswer('');
    setRevealed(false);
    setDone(false);
    setFeedback(null);
    setStats({ good: 0, ok: 0, hard: 0 });
    try {
      const due = await getReviewWords();
      const source = due.data?.length ? due.data : (await getWords()).data;
      const nextQueue = buildSmartQueue(source || []);
      setQueue(nextQueue);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const current = queue[index];
  const expected = cleanGermanWord(current?.word);
  const answerScore = useMemo(() => similarity(expected, answer), [expected, answer]);
  const progress = queue.length ? Math.round(((index + (revealed ? 1 : 0)) / queue.length) * 100) : 0;

  const submitAnswer = (e) => {
    e?.preventDefault();
    if (!current || !answer.trim()) return;
    setRevealed(true);
    setFeedback(answerScore >= 88 ? 'correct' : answerScore >= 55 ? 'steady' : 'wrong');
  };

  const revealAnswer = () => {
    if (!current) return;
    setRevealed(true);
    setFeedback(answer.trim()
      ? answerScore >= 88 ? 'correct' : answerScore >= 55 ? 'steady' : 'wrong'
      : 'wrong'
    );
  };

  const finishCard = async (difficulty) => {
    if (!current) return;
    setStats(prev => ({
      ...prev,
      [difficulty === 'easy' ? 'good' : difficulty === 'medium' ? 'ok' : 'hard']: prev[difficulty === 'easy' ? 'good' : difficulty === 'medium' ? 'ok' : 'hard'] + 1
    }));
    await rateDifficulty({ word_id: current.id, difficulty });

    const shouldRepeatSoon = difficulty === 'hard' && queue.length < SESSION_LIMIT + 6;
    if (shouldRepeatSoon) {
      setQueue(prev => [...prev, { ...current, retry: true }]);
    }

    setAnswer('');
    setRevealed(false);
    setFeedback(null);
    if (index + 1 >= queue.length && !shouldRepeatSoon) setDone(true);
    else setIndex(i => i + 1);
  };

  const skip = () => {
    setAnswer('');
    setRevealed(false);
    setFeedback(null);
    if (index + 1 >= queue.length) setDone(true);
    else setIndex(i => i + 1);
  };

  const playAudio = (text, rate = 0.8) => {
    setSpeaking(true);
    speak(text, rate);
    setTimeout(() => setSpeaking(false), rate < 0.8 ? 1800 : 1300);
  };

  const articleClass = current?.article ? `article-${current.article}` : '';

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Flashcards</h2>
        <p>Rappel actif, score immédiat, répétition rapide des mots faibles.</p>
      </div>

      {!queue.length ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <p>Aucun mot trouvé.<br /><Link to="/upload" style={{ color: 'var(--accent)' }}>Importe un document d'abord.</Link></p>
        </div>
      ) : done ? (
        <motion.div className="card smart-finish" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
          <div className="smart-finish-title">Session terminée</div>
          <div className="smart-score-grid">
            <span><strong>{stats.good}</strong> solides</span>
            <span><strong>{stats.ok}</strong> à revoir</span>
            <span><strong>{stats.hard}</strong> difficiles</span>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={loadSmartSession}>Nouvelle session</button>
            <Link to="/quiz" className="btn btn-ghost">Quiz</Link>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="smart-session-bar">
            <span>{index + 1} / {queue.length}</span>
            <div className="progress-bar">
              <motion.div className="progress-bar-fill" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.25 }} />
            </div>
            <span>{progress}%</span>
          </div>

          <motion.div
            className="smart-card"
            animate={feedback === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : feedback === 'correct' ? { y: [0, -4, 0], scale: [1, 1.01, 1] } : {}}
            transition={{ duration: 0.35 }}
          >
            <div className="smart-card-top">
              <span className="card-level">{current.level || 'A1'}</span>
              <span>{current.topic || current.difficulty || 'révision'}</span>
            </div>

            <div className="smart-prompt">{cardPrompt(current)}</div>
            {current.translation_ar && <div className="smart-prompt-ar">{current.translation_ar}</div>}

            <form onSubmit={submitAnswer} className="smart-answer">
              <input
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Écris le mot allemand"
                autoFocus
                disabled={revealed}
              />
              <button className="btn btn-primary" type="submit" disabled={!answer.trim() || revealed}>Vérifier</button>
            </form>

            <AnimatePresence>
              {revealed && (
                <motion.div className="smart-reveal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div>
                    {current.article && <span className={`card-article ${articleClass}`}>{current.article}</span>}
                    <strong>{expected}</strong>
                    {current.plural && <small>Pl: {current.plural}</small>}
                  </div>
                  <div className={`smart-result ${feedback}`}>
                    {answer.trim() ? `${answerScore}/100` : 'Révélé'}
                  </div>
                  {current.example_de && (
                    <p>„{current.example_de}”<br /><span>{current.example_fr}</span></p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="smart-actions">
              <button type="button" className={`btn-icon sound-button${speaking ? ' is-playing' : ''}`} title="Écouter" onClick={() => playAudio(current.word)}>
                <span>🔊</span>
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={revealAnswer}>Révéler</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>Passer</button>
            </div>
          </motion.div>

          <AnimatePresence>
            {revealed && (
              <motion.div className="difficulty-btns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="diff-btn diff-easy" onClick={() => finishCard('easy')}>Je connais</motion.button>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="diff-btn diff-medium" onClick={() => finishCard('medium')}>Presque</motion.button>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="diff-btn diff-hard" onClick={() => finishCard('hard')}>À refaire</motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
