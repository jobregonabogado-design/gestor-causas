import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Mapa de usuarios → emails internos de Supabase
const USUARIOS = {
  'joaquin':   'jobregonabogado@gmail.com',
  'asistente': 'asistente@lexoffice.internal',
  // Agrega más usuarios aquí si necesitas
}

// ✅ Solo se rediseñó la parte VISUAL de esta pantalla (mismo texto, mismos
// campos, mismo logo, misma lógica de login) — pidió Joaquín explícitamente
// que se mantuviera el contenido igual y solo se mejorara el diseño.
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  .lg-page { font-family: 'Manrope', Georgia, serif; }
  .lg-input {
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .lg-input:focus {
    border-color: #d4af37 !important;
    box-shadow: 0 0 0 4px rgba(212,175,55,0.14);
    background: #fff !important;
  }
  .lg-btn {
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .lg-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(26,26,46,0.35);
    background: #23233f !important;
  }
  .lg-btn:active:not(:disabled) { transform: translateY(0); }
  .lg-eye {
    transition: color 0.15s ease;
  }
  .lg-eye:hover { color: #1a1a2e !important; }
  .lg-card {
    animation: lg-rise 0.5s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes lg-rise {
    from { opacity: 0; transform: translateY(14px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes lg-glow {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 0.9; }
  }
  .lg-splash-icon { animation: lg-splash-icon-in 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .lg-splash-title { animation: lg-splash-title-in 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
  @keyframes lg-splash-icon-in {
    from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
    to { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes lg-splash-title-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 780)
  // ✅ Animación de entrada: primero aparece "GESTOR DE CAUSAS" solo, y recién
  // después se abre la tarjeta de inicio de sesión — pidió Joaquín este
  // pequeño efecto en vez de que todo aparezca de golpe.
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 780)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 950)
    return () => clearTimeout(t)
  }, [])

  const usuarioRef = useRef(null)
  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => usuarioRef.current?.focus(), 350)
      return () => clearTimeout(t)
    }
  }, [revealed])

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      // Buscar email por nombre de usuario
      const emailMapeado = USUARIOS[usuario.toLowerCase().trim()]
      const emailFinal = emailMapeado || usuario // si no está en el mapa, usar como email directo

      if (!emailFinal) {
        setError('USUARIO NO RECONOCIDO.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email: emailFinal, password })
      if (error) setError('USUARIO O CONTRASEÑA INCORRECTOS.')
    } catch (e) {
      setError('ERROR DE CONEXIÓN.')
    }
    setLoading(false)
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: 'radial-gradient(1100px circle at 15% 15%, #23233f 0%, #14142a 45%, #0d0d1c 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '24px 16px' : 24,
    },
    shell: {
      display: 'flex', width: '100%', maxWidth: isMobile ? 400 : 840,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
      opacity: revealed ? 1 : 0,
      transform: revealed ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(10px)',
      transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)',
    },
    splash: {
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: revealed ? 0 : 1,
      transform: revealed ? 'scale(1.06)' : 'scale(1)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
      pointerEvents: revealed ? 'none' : 'auto',
    },
    brandPanel: {
      flex: '0 0 46%',
      background: 'linear-gradient(155deg, #1a1a2e 0%, #12122a 100%)',
      padding: '48px 40px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden',
    },
    card: {
      background: '#fff', padding: isMobile ? '40px 30px' : '52px 46px',
      width: isMobile ? '100%' : '54%',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 7 },
    input: {
      width: '100%', padding: '13px 15px', border: '1.5px solid #e5e7eb', borderRadius: 10,
      fontSize: 13.5, fontFamily: "'Manrope', Georgia, serif", boxSizing: 'border-box',
      marginBottom: 18, outline: 'none', background: '#f8fafc', color: '#1a1a2e',
      textTransform: 'uppercase', letterSpacing: 0.4,
    },
    btn: {
      width: '100%', background: '#1a1a2e', color: '#d4af37', border: 'none', borderRadius: 10,
      padding: '14px', fontSize: 14.5, fontWeight: 700, letterSpacing: 0.6, cursor: 'pointer',
      fontFamily: "'Manrope', Georgia, serif", marginTop: 4, textTransform: 'uppercase',
    },
    error: {
      fontSize: 12.5, color: '#b91c1c', marginBottom: 16, textAlign: 'center',
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px',
      textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600,
    },
  }

  return (
    <div className="lg-page" style={s.page}>
      <style>{CSS}</style>

      <div style={s.splash}>
        <div className="lg-splash-icon" style={{
          width: 64, height: 64, borderRadius: 16, background: 'rgba(212,175,55,0.12)',
          border: '1px solid rgba(212,175,55,0.35)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 32, marginBottom: 18,
        }}>⚖️</div>
        <div className="lg-splash-title" style={{
          fontSize: isMobile ? 20 : 24, fontWeight: 800, color: '#fff', letterSpacing: 1,
          textTransform: 'uppercase', textAlign: 'center',
        }}>GESTOR DE CAUSAS</div>
      </div>

      <div style={s.shell}>
        {!isMobile && (
          <div style={s.brandPanel}>
            {/* Halo dorado decorativo, puramente visual */}
            <div style={{
              position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0) 70%)',
              animation: 'lg-glow 5s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', bottom: -100, left: -60, width: 240, height: 240, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0) 70%)',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.35)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28, marginBottom: 28,
              }}>⚖️</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: 0.5, lineHeight: 1.25, textTransform: 'uppercase' }}>
                GESTOR DE<br />CAUSAS
              </div>
              <div style={{ fontSize: 13, color: '#a5adc4', marginTop: 10, lineHeight: 1.6, maxWidth: 240, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                SISTEMA DE GESTIÓN LEGAL
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: '#6b7280', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              ACCESO RESTRINGIDO · LEXOFFICE
            </div>
          </div>
        )}

        <div className="lg-card" style={s.card}>
          {isMobile && (
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, background: '#1a1a2e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                margin: '0 auto 14px',
              }}>⚖️</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a2e', letterSpacing: 0.5, textTransform: 'uppercase' }}>GESTOR DE CAUSAS</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>SISTEMA DE GESTIÓN LEGAL</div>
            </div>
          )}
          {!isMobile && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 0.4 }}>BIENVENIDO</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>INGRESA TUS CREDENCIALES PARA CONTINUAR</div>
            </div>
          )}

          {error && <div style={s.error}>{error}</div>}

          <label style={s.label}>Usuario</label>
          <input
            ref={usuarioRef}
            className="lg-input"
            style={s.input}
            type="text"
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            placeholder="TU NOMBRE DE USUARIO"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="username"
          />

          <label style={s.label}>Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              className="lg-input"
              style={{ ...s.input, paddingRight: 44 }}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="lg-eye"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              style={{
                position: 'absolute', right: 12, top: 13, background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 16, color: '#94a3b8', lineHeight: 1, padding: 4,
              }}
              aria-label={showPassword ? 'OCULTAR CONTRASEÑA' : 'MOSTRAR CONTRASEÑA'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          <button className="lg-btn" style={s.btn} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          {isMobile && (
            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              ACCESO RESTRINGIDO · LEXOFFICE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
