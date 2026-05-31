import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { checkPronunciation, getDialogueFilm, speakHighQuality } from '../api/client';
import { useRecognition, useSpeech } from '../hooks/useSpeech';

const CHARACTER_COLORS = {
  A: 'var(--accent)',
  B: 'var(--purple)'
};

export default function DialogueFilm() {
  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [scores, setScores] = useState({});
  const [checking, setChecking] = useState(false);
  const [activeRepeat, setActiveRepeat] = useState(null);
  const [repeatPreparing, setRepeatPreparing] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.58);
  const [audioMode, setAudioMode] = useState('browser');
  const [ttsWarning, setTtsWarning] = useState(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const browserSpeechRunRef = useRef(0);
  const { speak, stop } = useSpeech();
  const { isListening, transcript, error: micError, startListening, stopListening } = useRecognition();

  const loadScene = (params) => {
    setLoading(true);
    setError(null);
    setPlaying(false);
    setIndex(0);
    setScores({});
    return getDialogueFilm(params)
      .then(res => setScene(res.data))
      .catch(err => setError(err.response?.data?.error || 'Erreur lors du chargement du Dialogue Film.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadScene();
    return () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const lines = scene?.lines || [];
  const currentLine = lines[index];
  const currentCharacter = scene?.characters?.find(c => c.id === currentLine?.speaker);
  const finished = lines.length > 0 && index >= lines.length - 1 && !playing;
  const averageScore = useMemo(() => {
    const values = Object.values(scores).map(item => item.score).filter(Number.isFinite);
    if (!values.length) return null;
    return Math.round(values.reduce((sum, score) => sum + score, 0) / values.length);
  }, [scores]);

  useEffect(() => {
    if (!playing || !currentLine) return undefined;
    let cancelled = false;
    let fallbackTimer;

    const goNext = () => {
      if (cancelled) return;
      setIndex(i => {
        if (i + 1 >= lines.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    };

    playLine(currentLine, { waitForEnd: true })
      .then(() => {
        fallbackTimer = setTimeout(goNext, 450);
      })
      .catch(() => {
        fallbackTimer = setTimeout(goNext, Math.max(1600, currentLine.de.length * 90));
      });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [playing, index, currentLine, lines.length]);

  const splitForSpeech = (text) => {
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return [];

    const chunks = [];
    const parts = cleanText
      .split(/(?<=[.!?;:])\s+/)
      .map(part => part.trim())
      .filter(Boolean);

    for (const part of parts.length ? parts : [cleanText]) {
      if (part.length <= 110) {
        chunks.push(part);
        continue;
      }

      const words = part.split(' ');
      let chunk = '';
      for (const word of words) {
        const next = chunk ? `${chunk} ${word}` : word;
        if (next.length > 90 && chunk) {
          chunks.push(chunk);
          chunk = word;
        } else {
          chunk = next;
        }
      }
      if (chunk) chunks.push(chunk);
    }

    return chunks;
  };

  const speakBrowserChunk = (chunk, runId, isFirstChunk) => new Promise(resolve => {
    if (!chunk || browserSpeechRunRef.current !== runId) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, Math.max(8000, chunk.length * 260));
    speak(chunk, Math.max(0.35, speechRate), {
      cancel: isFirstChunk,
      onend: () => {
        clearTimeout(timeout);
        resolve();
      },
      onerror: () => {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const playWithBrowserVoice = async (text, waitForEnd) => {
    audioRef.current?.pause();
    const runId = browserSpeechRunRef.current + 1;
    browserSpeechRunRef.current = runId;
    const chunks = splitForSpeech(text);

    const browserSpeechDone = (async () => {
      for (let i = 0; i < chunks.length; i += 1) {
        if (browserSpeechRunRef.current !== runId) break;
        await speakBrowserChunk(chunks[i], runId, i === 0);
        if (browserSpeechRunRef.current === runId && i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 120));
        }
      }
      if (browserSpeechRunRef.current === runId) setSpeaking(false);
    })();

    if (waitForEnd) await browserSpeechDone;
  };

  const playLine = async (lineOrText, options = {}) => {
    const line = typeof lineOrText === 'string' ? { de: lineOrText, speaker: currentLine?.speaker || 'A' } : lineOrText;
    const text = line?.de;
    if (!text) return;
    const waitForEnd = Boolean(options.waitForEnd);
    setSpeaking(true);
    browserSpeechRunRef.current += 1;
    stop();
    if (audioMode === 'ai') {
      try {
        const res = await speakHighQuality({
          text,
          speaker: line.speaker,
          speed: Math.min(1, Math.max(0.5, speechRate + 0.25))
        });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const url = URL.createObjectURL(res.data);
        audioUrlRef.current = url;
        const audio = audioRef.current || new Audio();
        audioRef.current = audio;
        audio.pause();
        audio.src = url;
        audio.load();
        const ended = new Promise((resolve, reject) => {
          audio.onended = () => {
            setSpeaking(false);
            resolve();
          };
          audio.onerror = () => {
            setSpeaking(false);
            setTtsWarning('Audio Gemini généré mais non lisible par ce navigateur.');
            reject(new Error('audio playback failed'));
          };
        });
        await audio.play();
        setTtsWarning(null);
        if (waitForEnd) await ended;
        return;
      } catch (err) {
        const status = err.response?.status;
        const rawData = err.response?.data;
        const apiMessage = rawData instanceof Blob
          ? await rawData.text().then(text => {
              try {
                return JSON.parse(text).error || text;
              } catch {
                return text;
              }
            })
          : rawData?.error || err.message;
        setTtsWarning(status
          ? `Gemini TTS indisponible (${status}) : ${apiMessage} Voix du navigateur utilisée.`
          : `Lecture Gemini bloquée : ${apiMessage}`
        );
        await playWithBrowserVoice(text, waitForEnd);
        return;
      }
    }

    await playWithBrowserVoice(text, waitForEnd);
  };

  const replay = () => {
    setIndex(0);
    setPlaying(true);
  };

  const repeatLine = async (lineIndex) => {
    if (isListening) {
      stopListening();
      setActiveRepeat(null);
      return;
    }
    const line = lines[lineIndex];
    if (!line) return;

    setPlaying(false);
    setIndex(lineIndex);
    setActiveRepeat(lineIndex);
    setRepeatPreparing(true);

    try {
      await playLine(line, { waitForEnd: true });
    } catch {
      // Keep the repeat flow usable even if playback fails.
    }

    setRepeatPreparing(false);
    const started = startListening(async (spoken) => {
      if (!spoken) return;
      setChecking(true);
      try {
        const res = await checkPronunciation({ expected: line.de, spoken, context: 'film' });
        setScores(prev => ({ ...prev, [lineIndex]: { ...res.data, spoken } }));
      } catch {
        setScores(prev => ({ ...prev, [lineIndex]: { score: 0, spoken, feedback_fr: 'Erreur lors de la correction.' } }));
      } finally {
        setChecking(false);
        setActiveRepeat(null);
      }
    }, {
      onEnd: (heardResult) => {
        if (!heardResult) setActiveRepeat(null);
      },
      onError: () => {
        setRepeatPreparing(false);
        setActiveRepeat(null);
      }
    });

    if (!started) {
      setRepeatPreparing(false);
      setActiveRepeat(null);
    }
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  if (error) {
    return (
      <div className="page">
        <div className="empty">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Dialogue Film Animation</h2>
          <p>Importe une leçon avec des phrases, expressions ou dialogues pour créer une scène animée.</p>
        </div>
        <div className="empty">
          <p>Aucun contenu de dialogue trouvé.<br /><Link to="/upload" style={{ color: 'var(--accent)' }}>Importer un PDF</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dialogue Film Animation</h2>
        <p>{scene.title || 'Mini scène éducative'}{scene.lesson?.title ? ` · ${scene.lesson.title}` : ''}</p>
      </div>

      <div className="film-toolbar">
        <div>
          <span className={`film-source ${scene.ai_generated ? 'ai' : 'pdf'}`}>
            {scene.ai_generated ? 'Dialogue créé par IA depuis le PDF' : 'Dialogue extrait du PDF'}
          </span>
          {scene.ai_error && <span className="film-source warning">Enrichissement IA indisponible</span>}
        </div>
        <div className="film-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => loadScene({ mode: 'raw', refresh: 1 })}>
            Version PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => loadScene({ mode: 'smart', refresh: 1 })}>
            Créer avec IA depuis PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Lire la scène'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={replay}>Rejouer</button>
        </div>
      </div>

      <div className="film-voice-panel">
        <label>
          Audio
          <select value={audioMode} onChange={e => setAudioMode(e.target.value)}>
            <option value="browser">Navigateur</option>
            <option value="ai">Gemini naturel</option>
          </select>
        </label>
        <label>
          Vitesse
          <input type="range" min="0.4" max="0.85" step="0.05" value={speechRate} onChange={e => setSpeechRate(Number(e.target.value))} />
        </label>
        <span>Gemini TTS est limité à environ 10 phrases par jour. Navigateur évite le quota.</span>
      </div>
      {ttsWarning && <div className="film-audio-warning">{ttsWarning}</div>}

      <div className="film-stage">
        <FilmCharacter id="A" active={currentLine?.speaker === 'A'} speaking={speaking && currentLine?.speaker === 'A'} character={scene.characters?.find(c => c.id === 'A')} />
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className={`film-bubble ${currentLine.speaker === 'B' ? 'right' : 'left'}`}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.24 }}
          >
            <div className="film-speaker">{currentCharacter?.name || `Personnage ${currentLine.speaker}`}</div>
            <div className="film-de">{currentLine.de}</div>
            {currentLine.fr && <div className="film-fr">{currentLine.fr}</div>}
            {currentLine.ar && <div className="film-ar">{currentLine.ar}</div>}
            <div className="film-line-actions">
              <button className={`btn btn-primary btn-sm sound-button${speaking ? ' is-playing' : ''}`} onClick={() => playLine(currentLine)}>
                🔊 Écouter
                {speaking && <span className="sound-wave"><i /><i /><i /></span>}
              </button>
              <button className={`btn btn-ghost btn-sm${isListening && activeRepeat === index ? ' active' : ''}`} onClick={() => repeatLine(index)} disabled={checking || repeatPreparing}>
                {(checking || repeatPreparing) && activeRepeat === index ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Répéter'}
              </button>
            </div>
            {repeatPreparing && activeRepeat === index && <div className="film-listening">Écoute d'abord, puis répète...</div>}
            {isListening && activeRepeat === index && <div className="film-listening">Je t'écoute...</div>}
            {micError && activeRepeat === index && <div className="film-score bad">{micError}</div>}
            {scores[index] && (
              <div className={`film-score ${scores[index].score >= 75 ? 'good' : 'bad'}`}>
                Score prononciation : {scores[index].score}/100
                {scores[index].feedback_fr && <span>{scores[index].feedback_fr}</span>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <FilmCharacter id="B" active={currentLine?.speaker === 'B'} speaking={speaking && currentLine?.speaker === 'B'} character={scene.characters?.find(c => c.id === 'B')} />
      </div>

      <div className="film-progress">
        <span>{index + 1} / {lines.length}</span>
        <div className="progress-bar">
          <motion.div className="progress-bar-fill" animate={{ width: `${((index + 1) / lines.length) * 100}%` }} transition={{ duration: 0.25 }} />
        </div>
        <span>{averageScore === null ? 'Score: --' : `Score: ${averageScore}/100`}</span>
      </div>

      <div className="film-script">
        {lines.map((line, i) => (
          <motion.button
            key={`${line.speaker}-${line.de}-${i}`}
            className={`film-script-line${i === index ? ' active' : ''}${scores[i] ? ' scored' : ''}`}
            onClick={() => { setPlaying(false); setIndex(i); }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            <span>{line.speaker}</span>
            <strong>{line.de}</strong>
            {scores[i] && <em>{scores[i].score}/100</em>}
          </motion.button>
        ))}
      </div>

      {finished && averageScore !== null && (
        <motion.div className="card film-final-score" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div>Score final</div>
          <strong>{averageScore}/100</strong>
          <button className="btn btn-primary btn-sm" onClick={replay}>Rejouer la scène</button>
        </motion.div>
      )}
    </div>
  );
}

function FilmCharacter({ id, active, speaking, character }) {
  const color = CHARACTER_COLORS[id] || 'var(--accent)';
  return (
    <motion.div
      className={`film-character ${active ? 'active' : ''}`}
      animate={active ? { y: [0, -5, 0] } : { y: 0 }}
      transition={{ duration: 0.8, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
      style={{ '--character-color': color }}
    >
      <div className="film-avatar">
        <div className="film-head">
          <span className={`film-mouth ${speaking ? 'talking' : ''}`} />
        </div>
        <div className="film-body" />
      </div>
      <div className="film-name">{character?.name || `Personnage ${id}`}</div>
      <div className="film-role">{character?.role || 'Dialogue'}</div>
    </motion.div>
  );
}
