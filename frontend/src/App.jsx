import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard    from './pages/Dashboard';
import Upload       from './pages/Upload';
import Lessons      from './pages/Lessons';
import Flashcards   from './pages/Flashcards';
import DialogueFilm from './pages/DialogueFilm';
import Quiz         from './pages/Quiz';
import Pronunciation from './pages/Pronunciation';
import Conversation from './pages/Conversation';
import Vocabulary   from './pages/Vocabulary';
import Summary      from './pages/Summary';
import Basics       from './pages/Basics';
import Auth         from './pages/Auth';
import { useAuth } from './context/AuthContext';
import './index.css';

const NAV = [
  { to:'/',             label:'Dashboard',    icon:'dashboard' },
  { to:'/upload',       label:'Importer',     icon:'upload'    },
  { to:'/lessons',      label:'Mes Leçons',   icon:'lessons'   },
  { to:'/resume',       label:'Résumé',       icon:'summary'   },
  { to:'/bases',        label:'Bases IA',     icon:'spark'     },
  { to:'/flashcards',   label:'Flashcards',   icon:'cards'     },
  { to:'/dialogue-film', label:'Dialogue Film',icon:'film'      },
  { to:'/quiz',         label:'Quiz',         icon:'quiz'      },
  { to:'/conversation',  label:'Parler IA',   icon:'chat'      },
  { to:'/pronunciation',label:'Prononciation',icon:'mic'       },
  { to:'/vocabulary',   label:'Vocabulaire',  icon:'book'      },
];

const ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  upload:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  lessons:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="16" y2="6"/><line x1="12" y1="10" x2="16" y2="10"/><line x1="12" y1="14" x2="16" y2="14"/></svg>,
  summary:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/><path d="M9 3h6v4H9z"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>,
  spark:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/><path d="M5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7L5 14z"/></svg>,
  cards:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  film:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16"/><path d="M17 4v16"/><path d="M2 9h5"/><path d="M17 9h5"/><path d="M2 15h5"/><path d="M17 15h5"/></svg>,
  quiz:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  chat:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>,
  mic:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
  book:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
};

function ProtectedLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="auth-container"><div className="auth-card">Chargement...</div></div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>🇩🇪 Deutsch</h1>
          <p>Lernen Platform</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to==='/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
              {ICONS[icon]}<span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{padding:'16px 24px', borderTop:'1px solid var(--border)'}}>
          <p style={{fontSize:11, color:'var(--text-muted)', lineHeight:1.4}}>
            {user.name || user.email}<br/><span style={{color:'var(--accent)'}}>A1/A2 Level</span>
          </p>
          <button type="button" className="link-button" onClick={logout}>Déconnexion</button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/"              element={<Dashboard/>}    />
          <Route path="/upload"        element={<Upload/>}       />
          <Route path="/lessons"       element={<Lessons/>}      />
          <Route path="/resume"        element={<Summary/>}      />
          <Route path="/bases"         element={<Basics/>}       />
          <Route path="/flashcards"    element={<Flashcards/>}   />
          <Route path="/dialogue-film"  element={<DialogueFilm/>} />
          <Route path="/quiz"          element={<Quiz/>}         />
          <Route path="/conversation"   element={<Conversation/>} />
          <Route path="/pronunciation" element={<Pronunciation/>}/>
          <Route path="/vocabulary"    element={<Vocabulary/>}   />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={!loading && user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
