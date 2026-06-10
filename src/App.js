import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .nav-link { font-family:'Inter',sans-serif; font-size:13px; font-weight:500; padding:7px 16px; border-radius:8px; border:none; cursor:pointer; transition:all 0.2s cubic-bezier(0.4,0,0.2,1); background:transparent; color:#64748b; }
  .nav-link:hover { background:#f0f4ff; color:#2563eb; }
  .nav-link.active { background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; font-weight:600; box-shadow:0 4px 12px rgba(37,99,235,0.3); }
  .page-in { animation:pageIn 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .salir-btn { background:transparent; border:1.5px solid #e2e8f0; color:#64748b; border-radius:7px; padding:5px 14px; font-size:12px; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.2s; font-weight:500; }
  .salir-btn:hover { border-color:#2563eb; color:#2563eb; }
`

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState('causas')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 8px 24px rgba(37,99,235,0.3)' }}>⚖</div>
        <div style={{ fontFamily:'Inter,sans-serif', color:'#94a3b8', fontSize:13, letterSpacing:1.5, textTransform:'uppercase', fontWeight:500 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
      <style>{css}</style>
      <nav style={{ background:'rgba(255,255,255,0.9)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid rgba(226,232,240,0.8)', padding:'0 32px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 4px 10px rgba(37,99,235,0.25)' }}>⚖</div>
          <div>
            <div style={{ fontFamily:'Inter,sans-serif', fontSize:15, fontWeight:800, color:'#0f172a', letterSpacing:'-0.5px' }}>LexOffice</div>
            <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:2, textTransform:'uppercase', fontWeight:500, marginTop:-1 }}>Gestión Penal</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, background:'#f8fafc', padding:'4px', borderRadius:10, border:'1px solid #e2e8f0' }}>
          {[{id:'causas',label:'Causas'},{id:'calendario',label:'Calendario'}].map(item => (
            <button key={item.id} className={`nav-link${pagina===item.id?' active':''}`} onClick={() => setPagina(item.id)}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>
              {session.user.email?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize:12, color:'#64748b', fontFamily:'Inter,sans-serif' }}>{session.user.email}</span>
          </div>
          <button className="salir-btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </nav>
      <div className="page-in" key={pagina}>
        {pagina === 'causas' && <Dashboard session={session} />}
        {pagina === 'calendario' && <Calendario />}
      </div>
    </div>
  )
}
