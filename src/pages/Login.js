import { useState } from 'react'
import { supabase } from '../lib/supabase'
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')
  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError('Correo o contraseña incorrectos.')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
        else setError('✅ Cuenta creada. Ya puedes iniciar sesión.')
      }
    } catch (e) { setError('Error de conexión.') }
    setLoading(false)
  }
  const s = {
    page: { minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' },
    card: { background: '#fff', borderRadius: 16, padding: 48, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
    label: { display: 'block', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'Georgia, serif', boxSizing: 'border-box', marginBottom: 16, outline: 'none' },
    btn: { width: '100%', background: '#1a1a2e', color: '#d4af37', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' },
    error: { fontSize: 13, color: error?.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: 16, textAlign: 'center' },
  }
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>⚖️</span>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', letterSpacing: 1 }}>GESTOR DE CAUSAS</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Sistema de Gestión Legal</div>
        </div>
        {error && <div style={s.error}>{error}</div>}
        <label style={s.label}>Correo electrónico</label>
        <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="abogado@oficina.cl" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <label style={s.label}>Contraseña</label>
        <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <button style={s.btn} onClick={handleSubmit} disabled={loading}>{loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6b7280' }}>
          {mode === 'login'
            ? <span>¿Primera vez? <span style={{ color: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setMode('register')}>Crear cuenta</span></span>
            : <span>¿Ya tienes cuenta? <span style={{ color: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setMode('login')}>Ingresar</span></span>
          }
        </div>
      </div>
    </div>
  )
}
