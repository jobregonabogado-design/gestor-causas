import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Mapa de usuarios → emails internos de Supabase
const USUARIOS = {
  'joaquin':   'jobregonabogado@gmail.com',
  'asistente': 'asistente@lexoffice.internal',
  // Agrega más usuarios aquí si necesitas
}

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      // Buscar email por nombre de usuario
      const emailMapeado = USUARIOS[usuario.toLowerCase().trim()]
      const emailFinal = emailMapeado || usuario // si no está en el mapa, usar como email directo

      if (!emailFinal) {
        setError('Usuario no reconocido.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email: emailFinal, password })
      if (error) setError('Usuario o contraseña incorrectos.')
    } catch (e) {
      setError('Error de conexión.')
    }
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' },
    card: { background: '#fff', borderRadius: 16, padding: 48, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
    label: { display: 'block', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'Georgia, serif', boxSizing: 'border-box', marginBottom: 16, outline: 'none' },
    btn: { width: '100%', background: '#1a1a2e', color: '#d4af37', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif' },
    error: { fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' },
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
        <label style={s.label}>Usuario</label>
        <input
          style={s.input}
          type="text"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
          placeholder="Tu nombre de usuario"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="username"
        />
        <label style={s.label}>Contraseña</label>
        <input
          style={s.input}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="current-password"
        />
        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#cbd5e1' }}>
          Acceso restringido · LexOffice
        </div>
      </div>
    </div>
  )
}
