import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { font-family: 'Inter', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
  .nav-item { transition: all 0.15s; cursor: pointer; }
  .nav-item:hover { background: #f3f4f6 !important; color: #111111 !important; }
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
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#111111', fontSize: 15, fontWeight: 500 }}>Cargando...</div>
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <style>{css}</style>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#111111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111111', letterSpacing: '-0.3px' }}>LexOffice</div>
            <div style={{ fontSize: 9, color: '#9ca3af', letterSpacing: 1.5, textTransform: 'uppercase' }}>Gestión Penal</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'causas', label: '📋 Causas' },
            { id: 'calendario', label: '📅 Calendario' },
          ].map(item => (
            <button key={item.id} className="nav-item" onClick={() => setPagina(item.id)}
              style={{ background: pagina === item.id ? '#111111' : 'transparent', color: pagina === item.id ? '#ffffff' : '#6b7280', border: '1px solid transparent', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: pagina === item.id ? 600 : 400, cursor: 'pointer' }}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ background: '#111111', border: 'none', color: '#ffffff', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Salir</button>
        </div>
      </div>
      {pagina === 'causas' && <Dashboard session={session} />}
      {pagina === 'calendario' && <Calendario />}
    </div>
  )
}
// deploy Wed Jun  3 18:13:53 -04 2026
