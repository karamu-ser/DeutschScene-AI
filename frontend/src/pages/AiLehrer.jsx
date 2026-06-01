import { useEffect, useState } from 'react';
import { aiLehrerQuestion, aiLehrerRespond, getLessons } from '../api/client';
import { isDemoMode } from '../api/demoData';
import { useRecognition, useSpeech } from '../hooks/useSpeech';
import { SpeakButton } from './Summary';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PHASES = {
  QUESTION: 'question',
  ANSWERING: 'answering',
  FEEDBACK: 'feedback',
  PRACTICE: 'practice',
  COMPLETED: 'completed'
};

export default function AiLehrer() {
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState('');
  const [level, setLevel] = useState('A1');
  const [phase, setPhase] = useState(PHASES.QUESTION);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [error, setError] = useState('');
  const { speak, stop } = useSpeech();
  const { isListening, transcript, error: micError, startListening, stopListening } = useRecognition();

  useEffect(() => {
    getLessons()
      .then(res => {
        const items = res.data || [];
        setLessons(items);
        if (items[0]?.id) {
          setLessonId(String(items[0].id));
          setLevel(items[0].level || 'A1');
        }
      })
      .catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    if (lessonId) loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, level]);

  const loadQuestion = async () => {
    if (!lessonId) return;
    stop();
    setLoadingQuestion(true);
    setError('');
    setAnswer('');
    setResult(null);
    setPracticeAnswer('');
    setPhase(PHASES.QUESTION);

    try {
      const res = await aiLehrerQuestion({ lesson_id: lessonId, level });
      setQuestion(res.data);
      setPhase(PHASES.ANSWERING);
      if (res.data?.question_de) speak(res.data.question_de, level === 'A1' || level === 'A2' ? 0.72 : 0.82);
    } catch (err) {
      setError(err.response?.data?.error || 'AI Lehrer kann keine Frage erstellen.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  const submitAnswer = async (event) => {
    event.preventDefault();
    if (!lessonId || !question || !answer.trim()) return;
    stop();
    setLoadingAnswer(true);
    setError('');

    try {
      const res = await aiLehrerRespond({
        lesson_id: lessonId,
        level,
        question,
        question_id: question.question_id,
        expected_answer: question.expected_answer,
        user_answer: answer
      });
      setResult(res.data);
      setPhase(res.data?.practice_session?.exercises?.length ? PHASES.FEEDBACK : PHASES.COMPLETED);
      if (res.data?.correct_answer) speak(res.data.correct_answer, level === 'A1' || level === 'A2' ? 0.72 : 0.82);
    } catch (err) {
      setError(err.response?.data?.error || 'AI Lehrer indisponible.');
    } finally {
      setLoadingAnswer(false);
    }
  };

  const simulateDemoAnswer = () => {
    if (loadingAnswer) return;
    setError('');
    setAnswer('Ich aus Marokko komme.');
  };

  const handleMic = () => {
    if (isDemoMode()) {
      simulateDemoAnswer();
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }
    stop();
    setError('');
    startListening(
      (spoken) => setAnswer(spoken),
      {
        onEnd: (heardResult) => {
          if (!heardResult) setError('Aucune phrase détectée. Réessaie en parlant plus clairement.');
        },
        onError: () => setError('Microphone indisponible. Vérifie les permissions du navigateur.')
      }
    );
  };

  const startPractice = () => {
    setPracticeAnswer('');
    setPhase(PHASES.PRACTICE);
  };

  const completePractice = () => {
    setPhase(PHASES.COMPLETED);
  };

  const practiceExercise = result?.practice_session?.exercises?.[0];

  return (
    <div className="page">
      <div className="page-header">
        <h2>AI Lehrer</h2>
        <p>Ein echter KI-Lehrer: Er stellt zuerst eine Frage, hört deine Antwort und erstellt danach gezielte Übungen.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)', gap: 18 }}>
        <section className="card" style={{ display: 'grid', gap: 14 }}>
          <label>
            <span style={labelStyle}>Lektion</span>
            <select value={lessonId} onChange={e => setLessonId(e.target.value)} style={inputStyle}>
              {lessons.length === 0 && <option value="">Keine Lektion</option>}
              {lessons.map(lesson => (
                <option key={lesson.id} value={lesson.id}>{lesson.title || `Lektion ${lesson.id}`}</option>
              ))}
            </select>
          </label>

          <label>
            <span style={labelStyle}>Niveau</span>
            <select value={level} onChange={e => setLevel(e.target.value)} style={inputStyle}>
              {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <button className="btn btn-ghost" type="button" onClick={loadQuestion} disabled={loadingQuestion || !lessonId}>
            {loadingQuestion ? 'Frage wird erstellt...' : 'Neue Frage'}
          </button>

          <div style={phaseBoxStyle}>
            <div style={eyebrowStyle}>Phase</div>
            <strong>{phase}</strong>
          </div>

          {error && <div className="error-message">{error}</div>}
          {micError && <div className="error-message">{micError}</div>}
        </section>

        <section className="card">
          {loadingQuestion && (
            <div className="loading"><div className="spinner" /><span>AI Lehrer bereitet eine Frage vor...</span></div>
          )}

          {!loadingQuestion && question && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={panelStyle}>
                <div style={eyebrowStyle}>AI Frage</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <p style={{ flex: 1, fontSize: 20, fontWeight: 700 }}>{question.question_de}</p>
                  <SpeakButton text={question.question_de} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                  {question.skill} · {question.source} · from_pdf: {String(question.from_pdf)}
                </div>
              </div>

              {(phase === PHASES.ANSWERING || phase === PHASES.QUESTION) && (
                <form onSubmit={submitAnswer} style={{ display: 'grid', gap: 12 }}>
                  <label>
                    <span style={labelStyle}>Deine Antwort</span>
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={4}
                      style={inputStyle}
                      placeholder="Schreibe deine Antwort auf Deutsch..."
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" type="submit" disabled={loadingAnswer || !answer.trim()}>
                      {loadingAnswer ? 'AI Lehrer prüft...' : 'Antwort senden'}
                    </button>
                    <button className={`btn btn-ghost${isListening ? ' active' : ''}`} type="button" onClick={handleMic} disabled={loadingAnswer}>
                      {isDemoMode() ? 'Demo Mikrofon' : isListening ? 'Stopp' : 'Mikrofon'}
                    </button>
                    {isDemoMode() && (
                      <button className="btn btn-ghost" type="button" onClick={simulateDemoAnswer} disabled={loadingAnswer}>
                        Antwort simulieren
                      </button>
                    )}
                  </div>
                  {transcript && <div style={transcriptStyle}>{transcript}</div>}
                </form>
              )}

              {(phase === PHASES.FEEDBACK || phase === PHASES.PRACTICE || phase === PHASES.COMPLETED) && result && (
                <FeedbackPanel
                  result={result}
                  practiceExercise={practiceExercise}
                  phase={phase}
                  practiceAnswer={practiceAnswer}
                  setPracticeAnswer={setPracticeAnswer}
                  startPractice={startPractice}
                  completePractice={completePractice}
                  loadQuestion={loadQuestion}
                />
              )}
            </div>
          )}

          {!loadingQuestion && !question && (
            <div style={{ color: 'var(--text-muted)' }}>
              Wähle eine Lektion. AI Lehrer stellt dann zuerst eine Frage aus deiner PDF-Lektion.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FeedbackPanel({
  result,
  practiceExercise,
  phase,
  practiceAnswer,
  setPracticeAnswer,
  startPractice,
  completePractice,
  loadQuestion
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={panelStyle}>
        <div style={eyebrowStyle}>Feedback</div>
        <div style={{ color: result.is_correct ? 'var(--green)' : 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
          Score: {result.score}/100
        </div>
        <p>{result.feedback_fr}</p>
        {result.feedback_ar && <p dir="rtl" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{result.feedback_ar}</p>}
      </div>

      <div style={panelStyle}>
        <div style={eyebrowStyle}>Richtige Antwort</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ flex: 1 }}>{result.correct_answer}</strong>
          <SpeakButton text={result.correct_answer} />
        </div>
      </div>

      {result.mistake?.mistake_type && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>Mistake Memory</div>
          <div>Typ: <strong>{result.mistake.mistake_type}</strong></div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>{result.mistake.related_rule}</div>
        </div>
      )}

      {practiceExercise && phase === PHASES.FEEDBACK && (
        <button className="btn btn-primary" type="button" onClick={startPractice}>
          Practice Session starten
        </button>
      )}

      {practiceExercise && phase === PHASES.PRACTICE && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>Practice Session</div>
          <p style={{ fontWeight: 700 }}>{practiceExercise.prompt_de || practiceExercise.prompt_fr}</p>
          {practiceExercise.prompt_fr && <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>{practiceExercise.prompt_fr}</p>}
          <textarea
            value={practiceAnswer}
            onChange={e => setPracticeAnswer(e.target.value)}
            rows={3}
            style={{ ...inputStyle, marginTop: 12 }}
            placeholder="Deine Übung..."
          />
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>Antwort anzeigen</summary>
            <div style={{ marginTop: 8 }}>{practiceExercise.answer}</div>
          </details>
          <button className="btn btn-primary" type="button" onClick={completePractice} style={{ marginTop: 12 }}>
            Practice fertig
          </button>
        </div>
      )}

      {phase === PHASES.COMPLETED && (
        <button className="btn btn-primary" type="button" onClick={loadQuestion}>
          Nächste Frage
        </button>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 };
const inputStyle = {
  width: '100%',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '11px 12px',
  fontFamily: 'var(--font-body)'
};
const eyebrowStyle = { color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 };
const panelStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 };
const phaseBoxStyle = { ...panelStyle, padding: 12 };
const transcriptStyle = { color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10 };
