import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { generateQuiz, submitAnswer } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';
import { Link } from 'react-router-dom';

const QUIZ_TYPES = [
  { id: 'de_to_fr', label: '🇩🇪 → 🇫🇷', desc: 'Allemand vers Français' },
  { id: 'fr_to_de', label: '🇫🇷 → 🇩🇪', desc: 'Français vers Allemand' },
  { id: 'article', label: 'der/die/das', desc: 'Choisir le bon article' },
  { id: 'listen', label: '🎧 Écouter', desc: 'Écrire ce que tu entends' },
];

export default function Quiz() {
  const [quizType, setQuizType] = useState('de_to_fr');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('setup'); // setup | quiz | results
  const [results, setResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const { speak } = useSpeech();

  const startQuiz = async () => {
    setLoading(true);
    try {
      const res = await generateQuiz({ type: quizType, count: 10 });
      if (res.data.length === 0) {
        alert('Pas assez de mots. Importe d\'abord des documents.');
        return;
      }
      setQuestions(res.data);
      setIndex(0);
      setScore(0);
      setSelected(null);
      setFeedback(null);
      setResults([]);
      setPhase('quiz');
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur lors de la génération du quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (option) => {
    if (selected !== null) return;
    const q = questions[index];
    setSelected(option);

    const correct = option === q.correct_answer;
    if (correct) setScore(s => s + 1);
    setFeedback(correct ? 'correct' : 'wrong');

    setResults(r => [...r, { question: q, userAnswer: option, correct }]);

    await submitAnswer({
      word_id: q.word_id,
      quiz_type: q.type,
      user_answer: option,
      correct_answer: q.correct_answer
    });

    setTimeout(() => {
      if (index + 1 >= questions.length) {
        setPhase('results');
      } else {
        setIndex(i => i + 1);
        setSelected(null);
        setFeedback(null);
      }
    }, 1200);
  };

  const playAudio = (text) => {
    setSpeaking(true);
    speak(text);
    setTimeout(() => setSpeaking(false), 1300);
  };

  const q = questions[index];

  if (phase === 'setup') {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Quiz</h2>
          <p>Choisis le type de quiz et teste tes connaissances.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
          {QUIZ_TYPES.map(t => (
            <motion.div
              key={t.id}
              className="card"
              onClick={() => setQuizType(t.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              style={{
                cursor: 'pointer',
                borderColor: quizType === t.id ? 'var(--accent)' : 'var(--border)',
                background: quizType === t.id ? 'var(--accent-dim)' : 'var(--card)',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.label}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.desc}</div>
            </motion.div>
          ))}
        </div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="btn btn-primary" onClick={startQuiz} disabled={loading} style={{ fontSize: 16, padding: '14px 32px' }}>
          {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Génération...</> : '🚀 Commencer le quiz'}
        </motion.button>
      </div>
    );
  }

  if (phase === 'results') {
    const pct = Math.round((score / questions.length) * 100);
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪';
    return (
      <div className="page">
        <div className="page-header">
          <h2>Résultats du quiz</h2>
        </div>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: 48, marginBottom: 24 }}>
          <motion.div initial={{ scale: 0.75 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: 'var(--font-display)', fontSize: 52, color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--accent)' : 'var(--red)' }}>
            {pct}%
          </motion.div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            {score} bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''} sur {questions.length}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="btn btn-primary" onClick={() => setPhase('setup')}>Nouveau quiz</button>
            <Link to="/flashcards" className="btn btn-ghost">Flashcards →</Link>
          </div>
        </motion.div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16 }}>Détail des réponses</div>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>{r.question.question}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: r.correct ? 'var(--green)' : 'var(--red)' }}>
                  {r.correct ? '✓' : '✗'} {r.userAnswer}
                </div>
                {!r.correct && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>✓ {r.question.correct_answer}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Question {index + 1} / {questions.length}</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Score: {score}</span>
      </div>

      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <motion.div className="progress-bar-fill" initial={false} animate={{ width: `${((index + 1) / questions.length) * 100}%` }} transition={{ duration: 0.35, ease: 'easeOut' }} />
      </div>

      <motion.div
        className="quiz-question"
        key={q?.word_id || index}
        initial={{ opacity: 0, y: 10 }}
        animate={feedback === 'wrong' ? { opacity: 1, y: 0, x: [0, -7, 7, -4, 4, 0] } : feedback === 'correct' ? { opacity: 1, y: [0, -4, 0], scale: [1, 1.01, 1] } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
          {QUIZ_TYPES.find(t => t.id === quizType)?.desc}
        </div>

        {quizType === 'listen' ? (
          <div>
            <div style={{ marginBottom: 16, color: 'var(--text-muted)' }}>Écoute et écris le mot :</div>
            <button className={`btn btn-primary sound-button${speaking ? ' is-playing' : ''}`} onClick={() => playAudio(q.word)}>
              <span>🔊</span>
              Écouter
              {speaking && <span className="sound-wave"><i /><i /><i /></span>}
            </button>
          </div>
        ) : (
          <div className="word">{q?.question}</div>
        )}
      </motion.div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            className={`answer-feedback ${feedback}`}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {feedback === 'correct' ? '✓ Sehr gut!' : 'Versuch es noch einmal'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="quiz-options">
        {(q?.options || []).map(option => (
          <motion.button
            key={option}
            className={`quiz-option${selected === option ? (option === q.correct_answer ? ' correct' : ' wrong') : selected && option === q.correct_answer ? ' correct' : ''}`}
            onClick={() => handleAnswer(option)}
            disabled={selected !== null}
            whileHover={selected === null ? { y: -2 } : undefined}
            whileTap={selected === null ? { scale: 0.98 } : undefined}
            animate={selected === option && option !== q.correct_answer ? { x: [0, -6, 6, -3, 3, 0] } : {}}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
