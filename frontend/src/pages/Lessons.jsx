import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { VocabTab, GrammarTab, DialoguesTab, ExpressionsTab, ExercisesTab } from './Upload';
import { getLessons, getLessonById, deleteLesson } from '../api/client';

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [lessonData, setLessonData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('vocabulary');
  const [error, setError] = useState(null);

  const fetchLessons = async () => {
    try {
      const res = await getLessons();
      setLessons(res.data);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des leçons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const handleSelectLesson = async (id) => {
    setSelectedLessonId(id);
    setLoadingDetails(true);
    setLessonData(null);

    try {
      const { data } = await getLessonById(id);
      setLessonData({
        lesson: data.lesson,
        vocabulary: data.words,
        grammar: data.grammar,
        dialogues: data.dialogues,
        expressions: data.expressions,
        exercises: data.exercises
      });
      setActiveTab('vocabulary');
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des détails de la leçon.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Évite de cliquer sur la leçon en même temps
    if (!window.confirm('Voulez-vous vraiment supprimer cette leçon et tout son contenu ?')) return;
    try {
      await deleteLesson(id);
      setLessons(lessons.filter(l => l.id !== id));
      if (selectedLessonId === id) setSelectedLessonId(null);
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /><span>Chargement...</span></div></div>;

  if (selectedLessonId && lessonData) {
    const result = lessonData;
    const TABS = [
      { id:'vocabulary',   label:'📚 Vocabulaire',  count: result?.vocabulary?.length   || 0 },
      { id:'grammar',      label:'📐 Grammaire',    count: result?.grammar?.length       || 0 },
      { id:'dialogues',    label:'💬 Dialogues',    count: result?.dialogues?.length     || 0 },
      { id:'expressions',  label:'🗣️ Expressions', count: result?.expressions?.length   || 0 },
      { id:'exercises',    label:'✏️ Exercices',    count: result?.exercises?.length     || 0 },
    ];

    return (
      <div className="page">
         <button className="btn btn-ghost" onClick={() => setSelectedLessonId(null)} style={{marginBottom: 16}}>
           ← Retour aux leçons
         </button>

         <div className="card" style={{marginBottom:20,background:'var(--accent-dim)',borderColor:'var(--accent)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:24,marginBottom:6}}>
                  {result.lesson?.title || 'Leçon analysée'}
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {result.lesson?.level && <span style={{background:'var(--accent)',color:'var(--black)',padding:'2px 10px',borderRadius:12,fontSize:12,fontWeight:700}}>{result.lesson.level}</span>}
                  {result.lesson?.unit  && <span style={{background:'var(--surface)',padding:'2px 10px',borderRadius:12,fontSize:12}}>Unité {result.lesson.unit}</span>}
                  {result.lesson?.topic && <span style={{background:'var(--surface)',padding:'2px 10px',borderRadius:12,fontSize:12}}>{result.lesson.topic}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <Link to="/flashcards" className="btn btn-primary btn-sm">🃏 Flashcards</Link>
                <Link to="/quiz" className="btn btn-ghost btn-sm">🧠 Quiz</Link>
              </div>
            </div>
            {result.lesson?.objectives?.length > 0 && (
              <div style={{marginTop:12,fontSize:13,color:'var(--text-muted)'}}>
                <strong>Objectifs :</strong> {result.lesson.objectives.join(' • ')}
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            {[
              {label:'Mots',          value:result.vocabulary?.length||0, color:'var(--accent)'},
              {label:'Grammaire',     value:result.grammar?.length||0, color:'var(--blue)'},
              {label:'Dialogues',     value:result.dialogues?.length||0, color:'var(--purple)'},
              {label:'Expressions',   value:result.expressions?.length||0, color:'var(--green)'},
              {label:'Exercices',     value:result.exercises?.length||0, color:'var(--red)'},
            ].map(s=>(
              <div key={s.label} style={{flex:'1 1 100px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:28,color:s.color}}>{s.value}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--border)',overflowX:'auto'}}>
            {TABS.filter(t=>t.count>0).map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:'10px 18px',background:'transparent',border:'none',borderBottom:activeTab===t.id?'2px solid var(--accent)':'2px solid transparent',color:activeTab===t.id?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'var(--font-body)',whiteSpace:'nowrap',transition:'all 0.15s'}}>
                {t.label} <span style={{background:'var(--muted)',borderRadius:10,padding:'1px 6px',fontSize:11,marginLeft:4}}>{t.count}</span>
              </button>
            ))}
          </div>

          {activeTab==='vocabulary'  && <VocabTab    words={result.vocabulary||[]}/>}
          {activeTab==='grammar'     && <GrammarTab  rules={result.grammar||[]}/>}
          {activeTab==='dialogues'   && <DialoguesTab dialogues={result.dialogues||[]}/>}
          {activeTab==='expressions' && <ExpressionsTab expressions={result.expressions||[]}/>}
          {activeTab==='exercises'   && <ExercisesTab exercises={result.exercises||[]}/>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Mes Leçons</h2>
        <p>Retrouve toutes les leçons que tu as importées.</p>
      </div>

      {error && <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'var(--radius)',padding:'16px 20px',marginBottom:20,color:'var(--red)'}}>⚠️ {error}</div>}

      {lessons.length === 0 && !error ? (
        <div className="card" style={{textAlign: 'center', padding: 40}}>
          <div style={{fontSize: 48, marginBottom: 16}}>📚</div>
          <h3>Aucune leçon trouvée</h3>
          <p style={{color: 'var(--text-muted)', marginBottom: 24}}>Importe ton premier document pour commencer à apprendre.</p>
          <Link to="/upload" className="btn btn-primary">Importer une leçon</Link>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16}}>
          {lessons.map(lesson => (
            <div key={lesson.id} className="card" onClick={() => handleSelectLesson(lesson.id)} style={{cursor: 'pointer', position: 'relative'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12}}>
                <h3 style={{margin: 0, fontFamily: 'var(--font-display)', fontSize: 18}}>{lesson.title}</h3>
                <span style={{background:'var(--accent)',color:'var(--black)',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>{lesson.level}</span>
              </div>
              <div style={{display:'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16}}>
                {lesson.unit && <span style={{background:'var(--surface)',padding:'2px 8px',borderRadius:12,fontSize:11}}>Unité {lesson.unit}</span>}
                {lesson.topic && <span style={{background:'var(--surface)',padding:'2px 8px',borderRadius:12,fontSize:11}}>{lesson.topic}</span>}
              </div>
              <div style={{display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12}}>
                <span>📚 {lesson.word_count || 0} mots</span>
                <span>📐 {lesson.grammar_count || 0} règles</span>
                <span>💬 {lesson.dialogue_count || 0} dialogues</span>
                <span>🗣️ {lesson.expression_count || 0} expressions</span>
                <span>✏️ {lesson.exercise_count || 0} exercices</span>
              </div>
              <button onClick={(e) => handleDelete(e, lesson.id)} style={{position: 'absolute', top: 12, right: 12, background: 'var(--red)', border: 'none', color: 'white', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
