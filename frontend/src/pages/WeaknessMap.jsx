import { useEffect, useMemo, useState } from 'react';
import { getDashboard, getMistakes, getQuizStats } from '../api/client';

const CATEGORIES = [
  ['article', 'Der / die / das'],
  ['conjugation', 'Konjugation'],
  ['wrong_w_question', 'W-Fragen'],
  ['word_order', 'Satzstellung'],
  ['pronunciation', 'Aussprache'],
  ['vocabulary', 'Wortschatz'],
  ['spelling', 'Rechtschreibung'],
  ['wrong_preposition', 'Präpositionen'],
  ['wrong_case', 'Kasus'],
  ['grammar', 'Grammatik']
];

export default function WeaknessMap() {
  const [mistakes, setMistakes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [quizStats, setQuizStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([getMistakes(), getDashboard(), getQuizStats()])
      .then(([mistakeRes, dashboardRes, quizRes]) => {
        setMistakes(mistakeRes.value?.data || []);
        setDashboard(dashboardRes.value?.data || null);
        setQuizStats(quizRes.value?.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const weaknesses = useMemo(() => buildWeaknesses(mistakes, dashboard, quizStats), [mistakes, dashboard, quizStats]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Schwächenkarte</h2>
        <p>Carte des points faibles basée sur les erreurs, quiz, prononciation et mots difficiles.</p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Calcul des faiblesses...</span></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card red"><div className="label">Erreurs</div><div className="value">{mistakes.length}</div></div>
            <div className="stat-card yellow"><div className="label">Mots difficiles</div><div className="value">{dashboard?.hardWords || 0}</div></div>
            <div className="stat-card blue"><div className="label">Quiz</div><div className="value">{dashboard?.quizAccuracy || 0}%</div></div>
            <div className="stat-card green"><div className="label">Prononciation</div><div className="value">{dashboard?.avgPronunciationScore || 0}%</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {weaknesses.map(item => (
              <article key={item.category} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <strong>{item.label}</strong>
                  <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{item.status}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${item.score}%`, background: statusColor(item.status) }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                  <span>Score</span>
                  <span>{item.score}/100</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function buildWeaknesses(mistakes, dashboard, quizStats) {
  const counts = new Map();
  for (const mistake of mistakes) {
    counts.set(mistake.mistake_type, (counts.get(mistake.mistake_type) || 0) + Number(mistake.count || 1));
  }
  const quizPenalty = Math.max(0, 100 - Number(dashboard?.quizAccuracy || averageQuiz(quizStats) || 0)) * 0.25;
  const pronunciationPenalty = Math.max(0, 100 - Number(dashboard?.avgPronunciationScore || 0)) * 0.2;
  const hardWordPenalty = Math.min(20, Number(dashboard?.hardWords || 0) * 3);

  return CATEGORIES.map(([category, label]) => {
    const mistakePenalty = Math.min(70, (counts.get(category) || 0) * 8);
    const extraPenalty = category === 'pronunciation'
      ? pronunciationPenalty
      : category === 'vocabulary'
        ? hardWordPenalty + quizPenalty
        : quizPenalty;
    const score = Math.max(5, Math.round(100 - mistakePenalty - extraPenalty));
    return { category, label, score, status: score < 50 ? 'schwach' : score < 80 ? 'mittel' : 'stark' };
  }).sort((a, b) => a.score - b.score);
}

function averageQuiz(stats) {
  if (!stats?.length) return 0;
  return Math.round(stats.reduce((sum, item) => sum + Number(item.accuracy || 0), 0) / stats.length);
}

function statusColor(status) {
  if (status === 'schwach') return 'var(--red)';
  if (status === 'mittel') return 'var(--accent)';
  return 'var(--green)';
}
