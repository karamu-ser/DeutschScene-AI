import { useState, useEffect } from 'react';
import { getWords, getTopics, deleteWord } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';
import { Link } from 'react-router-dom';
import { downloadVocabularyPdf } from '../utils/pdfExport';

export default function Vocabulary() {
  const [words, setWords] = useState([]);
  const [topics, setTopics] = useState([]);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const { speak } = useSpeech();

  useEffect(() => {
    Promise.all([
      getWords(),
      getTopics()
    ]).then(([w, t]) => {
      setWords(w.data);
      setTopics(t.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = words.filter(w => {
    const matchSearch = !search ||
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      (w.translation_fr || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.translation_ar || '').includes(search);
    const matchTopic = !topicFilter || w.topic === topicFilter;
    return matchSearch && matchTopic;
  });

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce mot ?')) return;
    await deleteWord(id);
    setWords(w => w.filter(x => x.id !== id));
  };

  const handleDownloadPdf = () => {
    downloadVocabularyPdf(filtered, 'deutschscene-vocabulary.pdf');
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Vocabulaire</h2>
        <p>{words.length} mots dans ta collection.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Chercher un mot..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Tous les thèmes</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || topicFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTopicFilter(''); }}>
            ✕ Réinitialiser
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf} disabled={filtered.length === 0}>
          Télécharger PDF
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <p>Aucun mot trouvé.<br />
            {!words.length ? <Link to="/upload" style={{ color: 'var(--accent)' }}>Importe un document.</Link> : 'Essaie une autre recherche.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="word-table">
            <thead>
              <tr>
                <th>Mot</th>
                <th>Type</th>
                <th>Français</th>
                <th>Arabe</th>
                <th>Exemple</th>
                <th>Thème</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(word => (
                <tr key={word.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={() => speak(word.word)}
                        title="Écouter"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                      </button>
                      <div>
                        {word.article && (
                          <span className={`card-article article-${word.article}`} style={{ fontSize: 10, padding: '1px 6px', marginBottom: 2, display: 'inline-block' }}>
                            {word.article}
                          </span>
                        )}
                        <div style={{ fontWeight: 600 }}>{word.word.replace(/^(der|die|das)\s+/i, '')}</div>
                        {word.plural && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pl: {word.plural}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`tag tag-${word.type === 'noun' ? 'noun' : word.type === 'verb' ? 'verb' : 'adj'}`}>
                      {word.type || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{word.translation_fr || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', direction: 'rtl', fontSize: 13 }}>{word.translation_ar || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {word.example_de && (
                      <span title={word.example_de}>„{word.example_de}"</span>
                    )}
                  </td>
                  <td>
                    {word.topic && (
                      <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                        {word.topic}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(word.id)}
                      title="Supprimer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
