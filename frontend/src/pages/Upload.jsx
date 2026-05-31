import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { uploadDocument } from '../api/client';
import { useSpeech } from '../hooks/useSpeech';

const UPLOAD_STEPS = [
  { label: 'Upload', threshold: 5 },
  { label: 'Analyse Gemini', threshold: 30 },
  { label: 'Extraction', threshold: 62 },
  { label: 'Flashcards créées', threshold: 92 },
];

export default function Upload() {
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [activeTab, setActiveTab] = useState('vocabulary');
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type)) { setError('Fichier non supporté. Utilise PDF, JPG, PNG ou WebP.'); return; }
    setUploading(true); setError(null); setResult(null); setProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await uploadDocument(formData, setProgress);
      setResult(res.data);
      setActiveTab('vocabulary');
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError("L'analyse prend trop de temps. Réessaie avec un fichier plus petit ou relance l'import.");
      } else if (!err.response) {
        setError("Impossible de contacter le backend. Vérifie que l'API tourne sur le port 3001.");
      } else {
        setError(err.response?.data?.error || 'Erreur lors de l\'analyse.');
      }
    } finally { setUploading(false); }
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const TABS = [
    { id:'vocabulary',   label:'📚 Vocabulaire',  count: result?.vocabulary?.length   || 0 },
    { id:'grammar',      label:'📐 Grammaire',    count: result?.grammar?.length       || 0 },
    { id:'dialogues',    label:'💬 Dialogues',    count: result?.dialogues?.length     || 0 },
    { id:'expressions',  label:'🗣️ Expressions', count: result?.expressions?.length   || 0 },
    { id:'exercises',    label:'✏️ Exercices',    count: result?.exercises?.length     || 0 },
  ];

  const activeStep = uploading
    ? UPLOAD_STEPS.findLastIndex(step => (progress || 60) >= step.threshold)
    : -1;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Importer une leçon</h2>
        <p>L'IA extrait la structure complète : vocabulaire, grammaire, dialogues, exercices.</p>
      </div>

      <motion.div className={`upload-zone${dragOver?' drag-over':''}`}
        animate={dragOver ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.18 }}
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={onDrop}
        onClick={()=>!uploading&&inputRef.current.click()}>
        <motion.svg animate={uploading ? { y: [0, -5, 0] } : { y: 0 }} transition={{ duration: 1.2, repeat: uploading ? Infinity : 0, ease: 'easeInOut' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </motion.svg>
        {uploading ? (
          <><h3>Analyse en cours...</h3><p>Gemini analyse la structure pédagogique complète</p>
          <div className="progress-bar" style={{width:'100%',maxWidth:300,margin:'16px auto 0'}}>
            <motion.div className="progress-bar-fill" initial={false} animate={{ width:`${progress||60}%` }} transition={{ duration: 0.35, ease: 'easeOut' }}/>
          </div>
          <div className="upload-steps">
            {UPLOAD_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                className={`upload-step${i <= activeStep ? ' done' : ''}${i === activeStep ? ' active' : ''}`}
                initial={{ opacity: 0.55 }}
                animate={{ opacity: i <= activeStep ? 1 : 0.55, y: i === activeStep ? -1 : 0 }}
              >
                <span>{i < activeStep ? '✓' : i === activeStep ? <i /> : i + 1}</span>
                {step.label}
              </motion.div>
            ))}
          </div></>
        ) : (
          <><h3>Glisse ton fichier ici</h3><p>PDF, JPG, PNG, WebP — max 10 MB</p></>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
      </motion.div>

      {error && (
        <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'var(--radius)',padding:'16px 20px',marginTop:20,color:'var(--red)'}}>
          ⚠️ {error}
        </div>
      )}

      <AnimatePresence>
      {result && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{marginTop:24}}>
          {/* Lesson header */}
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

          {/* Stats row */}
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            {[
              {label:'Mots nouveaux', value:result.new_words||0, color:'var(--accent)'},
              {label:'Grammaire',     value:result.grammar?.length||0, color:'var(--blue)'},
              {label:'Dialogues',     value:result.dialogues?.length||0, color:'var(--purple)'},
              {label:'Expressions',   value:result.expressions?.length||0, color:'var(--green)'},
              {label:'Exercices',     value:result.exercises?.length||0, color:'var(--red)'},
            ].map(s=>(
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} style={{flex:'1 1 100px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:28,color:s.color}}>{s.value}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
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
        </motion.div>
      )}
      </AnimatePresence>

      {!result && !uploading && (
        <div className="card" style={{marginTop:24}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:18,marginBottom:16}}>Ce que l'IA extrait automatiquement</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              {icon:'📚',t:'Vocabulaire complet',d:'Tous les mots avec article, pluriel, traductions FR/AR, exemples'},
              {icon:'📐',t:'Règles de grammaire',d:'Tableaux de conjugaison, déclinaisons, explications'},
              {icon:'💬',t:'Dialogues',d:'Conversations avec traduction ligne par ligne'},
              {icon:'🗣️',t:'Expressions',d:'Phrases utiles et formules courantes'},
              {icon:'✏️',t:'Exercices',d:'Questions et réponses extraites du cours'},
              {icon:'🎯',t:'Structure pédagogique',d:'Titre, niveau, unité, objectifs de la leçon'},
            ].map(({icon,t,d})=>(
              <div key={t} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:22}}>{icon}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{t}</div>
                  <div style={{color:'var(--text-muted)',fontSize:12}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function VocabTab({ words }) {
  const { speak } = useSpeech();

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:12}}>
      {words.map((w,i)=>(
        <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <div>
              {w.article && <span className={`card-article article-${w.article}`} style={{fontSize:10,padding:'1px 6px',marginBottom:3,display:'inline-block'}}>{w.article}</span>}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:18}}>{(w.word||'').replace(/^(der|die|das)\s+/i,'')}</div>
                {w.word && <SpeakButton text={w.word} onSpeak={speak} label={`Écouter ${w.word}`} />}
              </div>
            </div>
            <span className={`tag tag-${w.type==='noun'?'noun':w.type==='verb'?'verb':'adj'}`}>{w.type||''}</span>
          </div>
          {w.translation_fr && <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:2}}>🇫🇷 {w.translation_fr}</div>}
          {w.translation_ar && <div style={{fontSize:13,color:'var(--text-muted)',direction:'rtl',textAlign:'right'}}>🇲🇦 {w.translation_ar}</div>}
          {w.plural && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Pl: {w.plural}</div>}
          {w.example_de && (
            <div style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,fontStyle:'italic',color:'var(--text-muted)',marginTop:6,borderTop:'1px solid var(--border)',paddingTop:6}}>
              <span style={{flex:1}}>„{w.example_de}"</span>
              <SpeakButton text={w.example_de} onSpeak={speak} label="Écouter l'exemple" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function GrammarTab({ rules }) {
  const { speak } = useSpeech();

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {rules.map((r,i)=>(
        <div key={i} className="card">
          <div style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--blue)',marginBottom:12}}>{r.rule_title}</div>
          {r.explanation_fr && <div style={{marginBottom:8,fontSize:14,lineHeight:1.6}}>🇫🇷 {r.explanation_fr}</div>}
          {r.explanation_ar && <div style={{marginBottom:12,fontSize:14,direction:'rtl',textAlign:'right',color:'var(--text-muted)',lineHeight:1.8}}>🇲🇦 {r.explanation_ar}</div>}
          {(r.examples||[]).length>0 && (
            <div style={{background:'var(--surface)',borderRadius:'var(--radius)',padding:'12px 16px',marginBottom:12}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'0.8px',color:'var(--text-muted)',marginBottom:8}}>Exemples</div>
              {r.examples.map((ex,j)=>(
                <div key={j} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'6px 0',borderBottom:j<r.examples.length-1?'1px solid var(--border)':'none',fontSize:14}}>
                  <span style={{display:'flex',alignItems:'center',gap:8,fontWeight:500}}>
                    {ex.de}
                    {ex.de && <SpeakButton text={ex.de} onSpeak={speak} label="Écouter l'exemple" />}
                  </span>
                  <span style={{color:'var(--text-muted)'}}>{ex.fr}</span>
                </div>
              ))}
            </div>
          )}
          {(r.table||[]).length>0 && r.table[0]?.header && (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr>{r.table[0].header.map((h,j)=><th key={j} style={{padding:'8px 12px',background:'var(--muted)',textAlign:'left',fontWeight:600,borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead>
                <tbody>{(r.table[0].rows||[]).map((row,j)=>(
                  <tr key={j}>{(Array.isArray(row)?row:[row]).map((cell,k)=>(
                    <td key={k} style={{padding:'8px 12px',borderBottom:'1px solid var(--border)'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                        {cell}
                        {k > 0 && cell && <SpeakButton text={cell} onSpeak={speak} label={`Écouter ${cell}`} />}
                      </span>
                    </td>
                  ))}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SpeakButton({ text, onSpeak, label }) {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`sound-button${playing ? ' is-playing' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
        onSpeak(text);
        setTimeout(() => setPlaying(false), 1300);
      }}
      style={{
        width:26,
        height:26,
        display:'inline-flex',
        alignItems:'center',
        justifyContent:'center',
        flexShrink:0,
        border:'1px solid var(--border)',
        borderRadius:8,
        background:'var(--card)',
        color:'var(--accent)',
        cursor:'pointer',
        padding:0
      }}
    >
      🔊
      {playing && <span className="sound-wave compact"><i /><i /><i /></span>}
    </button>
  );
}

export function DialoguesTab({ dialogues }) {
  const { speak } = useSpeech();

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {dialogues.map((d,i)=>(
        <div key={i} className="card">
          {d.title && <div style={{fontFamily:'var(--font-display)',fontSize:18,marginBottom:16,color:'var(--purple)'}}>💬 {d.title}</div>}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {(d.lines||[]).map((line,j)=>(
              <div key={j} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:j%2===0?'var(--accent-dim)':'var(--muted)',border:`1px solid ${j%2===0?'var(--accent)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:j%2===0?'var(--accent)':'var(--text-muted)',flexShrink:0}}>
                  {line.speaker||(j%2===0?'A':'B')}
                </div>
                <div style={{flex:1,background:'var(--surface)',borderRadius:'var(--radius)',padding:'10px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:500,marginBottom:line.translation_fr?4:0}}>
                    <span style={{flex:1}}>{line.text}</span>
                    {line.text && <SpeakButton text={line.text} onSpeak={speak} label="Écouter la réplique" />}
                  </div>
                  {line.translation_fr && <div style={{fontSize:12,color:'var(--text-muted)'}}>🇫🇷 {line.translation_fr}</div>}
                  {line.translation_ar && <div style={{fontSize:12,color:'var(--text-muted)',direction:'rtl',textAlign:'right'}}>🇲🇦 {line.translation_ar}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExpressionsTab({ expressions }) {
  const { speak } = useSpeech();

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
      {expressions.map((e,i)=>(
        <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <div style={{flex:1,fontFamily:'var(--font-display)',fontSize:18,color:'var(--green)'}}>{e.expression}</div>
            {e.expression && <SpeakButton text={e.expression} onSpeak={speak} label={`Écouter ${e.expression}`} />}
          </div>
          {e.translation_fr && <div style={{fontSize:13,marginBottom:4}}>🇫🇷 {e.translation_fr}</div>}
          {e.translation_ar && <div style={{fontSize:13,direction:'rtl',textAlign:'right',color:'var(--text-muted)'}}>🇲🇦 {e.translation_ar}</div>}
          {e.context && <div style={{marginTop:8,fontSize:11,background:'var(--muted)',borderRadius:8,padding:'3px 8px',display:'inline-block',color:'var(--text-muted)'}}>{e.context}</div>}
        </div>
      ))}
    </div>
  );
}

export function ExercisesTab({ exercises }) {
  const [revealed, setRevealed] = useState({});
  const [answers,  setAnswers]  = useState({});
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {exercises.map((ex,i)=>(
        <div key={i} className="card">
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
            <span style={{background:'var(--accent-dim)',color:'var(--accent)',padding:'2px 10px',borderRadius:12,fontSize:12,fontWeight:600}}>{(ex.type||'').replace('_',' ')}</span>
            <div style={{fontWeight:600}}>{ex.instruction_fr||ex.instruction_de}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(ex.questions||[]).map((q,j)=>{
              const key=`${i}-${j}`;
              return (
                <div key={j} style={{background:'var(--surface)',borderRadius:'var(--radius)',padding:'12px 16px'}}>
                  <div style={{marginBottom:8,fontWeight:500}}>{j+1}. {q.question}</div>
                  {(q.options||[]).length>0 && (
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                      {q.options.map((opt,k)=>(
                        <button key={k} onClick={()=>setAnswers(a=>({...a,[key]:opt}))}
                          style={{padding:'4px 14px',borderRadius:20,border:`1px solid ${answers[key]===opt?'var(--accent)':'var(--border)'}`,background:answers[key]===opt?'var(--accent-dim)':'transparent',color:answers[key]===opt?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-body)',transition:'all 0.15s'}}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {revealed[key] && q.answer && (
                    <div style={{color:'var(--green)',fontSize:13,fontWeight:600,marginBottom:4}}>✓ {q.answer}</div>
                  )}
                  <button onClick={()=>setRevealed(r=>({...r,[key]:!r[key]}))}
                    style={{fontSize:12,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
                    {revealed[key]?'Cacher la réponse':'Voir la réponse'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
