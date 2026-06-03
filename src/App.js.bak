import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'

const css = `
  .nav-item { transition: all 0.15s; cursor: pointer; }
  .nav-item:hover { background: rgba(99,102,241,0.15) !important; color: #818cf8 !important; }
`

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState('causas')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366f1', fontSize: 16, fontFamily: 'Inter, sans-serif' }}>Cargando...</div>
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: '#080810', minHeight: '100vh' }}>
      <style>{css}</style>
      {/* BARRA DE NAVEGACIÓN */}
      <div style={{ background: 'rgba(13,13,24,0.98)', borderBottom: '1px solid #111827', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>⚖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>LexOffice</div>
            <div style={{ fontSize: 9, color: '#334155', letterSpacing: 1.5, textTransform: 'uppercase' }}>Gestión Penal</div>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'causas', label: '📋 Causas' },
            { id: 'calendario', label: '📅 Calendario' },
          ].map(item => (
            <button key={item.id} className="nav-item" onClick={() => setPagina(item.id)}
              style={{ background: pagina === item.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: pagina === item.id ? '#818cf8' : '#475569', border: pagina === item.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: pagina === item.id ? 600 : 400, fontFamily: 'Inter, sans-serif' }}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#334155' }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#475569', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Salir</button>
        </div>
      </div>

      {/* CONTENIDO */}
      {pagina === 'causas' && <Dashboard session={session} />}
      {pagina === 'calendario' && <Calendario />}
    </div>
  )
}
