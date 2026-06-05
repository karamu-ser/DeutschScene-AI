import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getDashboard, getLessons, getMistakes, getReviewWords } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';

const LABELS = {
  word_order: 'ordre des mots',
  article: 'articles',
  vocabulary: 'vocabulaire',
  pronunciation: 'prononciation',
  conjugation: 'conjugaison',
  wrong_w_question: 'questions',
  spelling: 'orthographe',
  wrong_preposition: 'prépositions',
  wrong_case: 'cas'
};

export default function Today() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({});
  const [lessons, setLessons] = useState([]);
  const [reviewWords, setReviewWords] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [revealed, setRevealed] = useState(false);
  const { speak } = useSpeech();

  useEffect(() => {
    Promise.allSettled([getDashboard(), getLessons(), getReviewWords(), getMistakes()])
      .then(([dashboardRes, lessonsRes, reviewRes, mistakesRes]) => {
        const lessonItems = lessonsRes.value?.data || [];
        setDashboard(dashboardRes.value?.data || {});
        setLessons(lessonItems);
        setReviewWords(reviewRes.value?.data || []);
        setMistakes(mistakesRes.value?.data || []);
        if (lessonItems[0]?.id) setLessonId(String(lessonItems[0].id));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedLesson = lessons.find(lesson => String(lesson.id) === String(lessonId)) || lessons[0];
  const selectedTopic = selectedLesson?.topic || dashboard.topicsList?.[0]?.topic || 'Vorstellung';

  const plan = useMemo(() => buildTodayPlan({
    lesson: selectedLesson,
    dashboard,
    reviewWords,
    mistakes
  }), [selectedLesson, dashboard, reviewWords, mistakes]);

  const focusWord = plan.focusWords[0];
  const conversationUrl = `/conversation?topic=${encodeURIComponent(selectedTopic)}&level=${encodeURIComponent(selectedLesson?.level || 'A1')}`;

  if (loading) {
    return <div className="page"><div className="loading"><div className="spinner" /><span>Préparation du parcours...</span></div></div>;
  }

  return (
    <div className="page today-page">
      <div className="page-header today-hero">
        <div>
          <span className="today-kicker">Rosetta + HelloTalk + tes PDFs</span>
          <h2>Aujourd'hui</h2>
          <p>Une session courte qui part de tes leçons, répète les mots faibles, puis t'envoie parler en allemand.</p>
        </div>
        <div className="today-lesson-picker">
          <span>Leçon</span>
          <select value={lessonId} onChange={e => { setLessonId(e.target.value); setRevealed(false); }}>
            {lessons.length === 0 && <option value="">Aucune leçon</option>}
            {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>)}
          </select>
        </div>
      </div>

      <section className="today-grid">
        {plan.steps.map((step, index) => (
          <motion.article
            key={step.title}
            className="today-step card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <div className="today-step-icon">{step.icon}</div>
            <div>
              <span className="today-step-time">{step.time}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <Link className="btn btn-ghost btn-sm" to={step.to}>{step.action}</Link>
            </div>
          </motion.article>
        ))}
      </section>

      <div className="today-main">
        <section className="card today-immersion">
          <div className="today-section-title">
            <span>Immersion guidée</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => focusWord?.example_de && speak(focusWord.example_de, 0.75)} disabled={!focusWord?.example_de}>
              Écouter
            </button>
          </div>

          {focusWord ? (
            <>
              <div className="today-word">
                <span>{focusWord.article || focusWord.type || selectedLesson?.level || 'A1'}</span>
                <strong>{cleanWord(focusWord.word)}</strong>
              </div>
              <p className="today-example">{focusWord.example_de || `Ich benutze "${cleanWord(focusWord.word)}" in einem einfachen Satz.`}</p>
              <div className="today-reveal">
                {revealed ? (
                  <span>{focusWord.translation_fr || focusWord.translation_ar || 'Traduction indisponible'}</span>
                ) : (
                  <span>Lis, écoute, répète, puis révèle le sens.</span>
                )}
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setRevealed(value => !value)}>
                  {revealed ? 'Masquer' : 'Révéler'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty" style={{ padding: '24px 0' }}>
              <p>Importe une leçon pour générer une immersion personnalisée.</p>
              <Link to="/upload" className="btn btn-primary">Importer</Link>
            </div>
          )}
        </section>

        <aside className="card today-coach">
          <div className="today-section-title">
            <span>Conversation ciblée</span>
            <span className="today-pill">{selectedLesson?.level || 'A1'} · {selectedTopic}</span>
          </div>
          <p>Parle comme dans HelloTalk, mais la conversation reste liée au vocabulaire de ton cours.</p>
          <div className="today-prompt">
            <strong>Mission</strong>
            <span>{plan.conversationMission}</span>
          </div>
          <Link className="btn btn-primary" to={conversationUrl}>Démarrer la conversation</Link>
        </aside>
      </div>

      <section className="card today-focus">
        <div className="today-section-title">
          <span>Boucle intelligente</span>
          <Link className="btn btn-ghost btn-sm" to="/smart-practice">Session complète</Link>
        </div>
        <div className="today-focus-list">
          {plan.focusItems.map(item => (
            <div key={item.label} className="today-focus-item">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildTodayPlan({ lesson, dashboard, reviewWords, mistakes }) {
  const focusWords = [
    ...reviewWords,
    ...(dashboard.hardWordsList || []),
    ...(dashboard.recentWords || [])
  ].filter((word, index, all) => word?.word && all.findIndex(item => item.word === word.word) === index).slice(0, 5);

  const mainMistake = mistakes[0]?.mistake_type || (focusWords.length ? 'vocabulary' : 'word_order');
  const topic = lesson?.topic || dashboard.topicsList?.[0]?.topic || 'Vorstellung';

  return {
    focusWords,
    conversationMission: `Utilise au moins deux mots du thème "${topic}" et réponds avec une phrase complète.`,
    steps: [
      {
        icon: '1',
        time: '3 min',
        title: 'Immersion',
        text: 'Écoute une phrase, associe le mot au contexte, puis révèle le sens.',
        action: 'Voir le vocabulaire',
        to: '/vocabulary'
      },
      {
        icon: '2',
        time: '4 min',
        title: 'Répétition',
        text: 'Revois les mots faibles avant qu’ils deviennent faciles à oublier.',
        action: 'Flashcards',
        to: '/flashcards'
      },
      {
        icon: '3',
        time: '4 min',
        title: 'Prononciation',
        text: 'Dis les mots à voix haute et laisse l’IA noter ce qui bloque.',
        action: 'Prononcer',
        to: '/pronunciation'
      },
      {
        icon: '4',
        time: '5 min',
        title: 'Conversation',
        text: 'Passe en discussion corrigée avec le thème de la leçon.',
        action: 'Parler',
        to: `/conversation?topic=${encodeURIComponent(topic)}&level=${encodeURIComponent(lesson?.level || 'A1')}`
      }
    ],
    focusItems: [
      { value: dashboard.todayReview || focusWords.length || 0, label: 'mots à revoir' },
      { value: dashboard.hardWords || 0, label: 'mots difficiles' },
      { value: LABELS[mainMistake] || mainMistake, label: 'priorité correction' },
      { value: lesson?.title || 'PDF à importer', label: 'source du jour' }
    ]
  };
}

function cleanWord(value = '') {
  return String(value).replace(/^(der|die|das)\s+/i, '');
}
