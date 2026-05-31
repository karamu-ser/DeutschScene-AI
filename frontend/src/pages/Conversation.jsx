import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTopics, practiceConversation } from '../api/client';
import { useRecognition, useSpeech } from '../hooks/useSpeech';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const BASE_TOPICS = [
  'Begrüßungen',
  'Vorstellung',
  'Familie',
  'Schule',
  'Arbeit',
  'Reisen',
  'Restaurant',
  'Arzt',
  'Alltag'
];

export default function Conversation() {
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('Begrüßungen');
  const [customTopics, setCustomTopics] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const { speak, stop } = useSpeech();
  const { isListening, transcript, error: micError, startListening, stopListening } = useRecognition();

  useEffect(() => {
    getTopics()
      .then(res => {
        const topics = (res.data || [])
          .map(item => item.topic)
          .filter(Boolean)
          .filter(item => !BASE_TOPICS.includes(item));
        setCustomTopics([...new Set(topics)]);
      })
      .catch(() => setCustomTopics([]));
  }, []);

  const topics = useMemo(() => [...BASE_TOPICS, ...customTopics], [customTopics]);

  const history = messages.slice(-8).map(message => ({
    role: message.role,
    text: message.role === 'assistant' ? message.reply_de : message.text
  }));

  const sendText = async (text) => {
    const userText = String(text || '').trim();
    if (!userText || loading) return;

    setDraft('');
    setApiError('');
    const userMessage = { id: crypto.randomUUID(), role: 'user', text: userText };
    setMessages(current => [...current, userMessage]);
    setLoading(true);

    try {
      const res = await practiceConversation({
        level,
        topic,
        userText,
        history
      });
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        ...res.data
      };
      setMessages(current => [...current, assistantMessage]);
      if (assistantMessage.reply_de) speak(assistantMessage.reply_de, level === 'A1' || level === 'A2' ? 0.72 : 0.82);
    } catch (err) {
      console.error(err);
      setApiError(err.response?.data?.error || 'Erreur pendant la conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleMic = () => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening((spoken) => {
      setDraft(spoken);
      sendText(spoken);
    });
  };

  const resetConversation = () => {
    stop();
    setMessages([]);
    setDraft('');
    setApiError('');
  };

  return (
    <div className="page conversation-page">
      <div className="page-header">
        <h2>Parler avec l'IA</h2>
        <p>Pratique une conversation en allemand adaptée à ton niveau, avec correction et vocabulaire utile.</p>
      </div>

      <div className="conversation-toolbar card">
        <label>
          <span>Niveau</span>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Thème</span>
          <select value={topic} onChange={e => setTopic(e.target.value)}>
            {topics.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <button className="btn btn-ghost" type="button" onClick={resetConversation}>Nouvelle conversation</button>
      </div>

      <div className="conversation-shell">
        <section className="conversation-thread card">
          {messages.length === 0 && (
            <div className="conversation-empty">
              <div>💬</div>
              <p>Choisis un niveau et un thème, puis parle en allemand. L'IA répondra simplement si tu es débutant.</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(message => (
              <motion.article
                key={message.id}
                className={`conversation-message ${message.role}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {message.role === 'user' ? (
                  <>
                    <div className="message-label">Du</div>
                    <p>{message.text}</p>
                  </>
                ) : (
                  <>
                    <div className="message-label">KI</div>
                    <p className="reply-de">{message.reply_de}</p>
                    <div className="translation-grid">
                      <div><strong>FR</strong><span>{message.translation_fr}</span></div>
                      <div><strong>AR</strong><span dir="rtl">{message.translation_ar}</span></div>
                    </div>
                    <div className="correction-box">{message.correction}</div>
                    {message.useful_words?.length > 0 && (
                      <div className="word-chips">
                        {message.useful_words.map((word, index) => (
                          <span key={`${word.de}-${index}`}>{word.de} · {word.fr}{word.ar ? ` · ${word.ar}` : ''}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.article>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="loading conversation-loading"><div className="spinner" /><span>Gemini prépare une réponse...</span></div>
          )}
        </section>

        <aside className="conversation-controls card">
          <div className="mic-listener conversation-mic">
            <span className="mic-ring" />
            <button
              className={`btn-icon${isListening ? ' active' : ''}`}
              type="button"
              onClick={handleMic}
              disabled={loading}
            >
              {loading ? (
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
          <p>{isListening ? 'Ich höre zu...' : 'Clique et parle en allemand'}</p>
          {transcript && <div className="transcript-box">"{transcript}"</div>}
          {micError && <div className="error-message">{micError}</div>}
          {apiError && <div className="error-message">{apiError}</div>}

          <form onSubmit={e => { e.preventDefault(); sendText(draft); }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Ou écris une phrase en allemand..."
              rows={4}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !draft.trim()}>
              Envoyer
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
