import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import JoaShield from '../components/JoaShield'

// Mapa de usuarios → emails internos de Supabase
const USUARIOS = {
  'joaquin':   'jobregonabogado@gmail.com',
  'asistente': 'asistente@lexoffice.internal',
  // Agrega más usuarios aquí si necesitas
}

// ✅ Rediseño con la identidad JOA (escudo verde bosque + filete dorado) —
// implementado a partir del handoff de diseño aprobado por Joaquín
// (design_handoff_login_joa/README.md). Misma lógica de login de siempre,
// solo cambió el diseño visual.
const C = {
  green: '#1E3A2F', greenDeep: '#16301F', greenDeeper: '#0E2416',
  gold: '#A8925F', goldSoft: '#CBB886', goldInk: '#8A7D55',
  bone: '#FAF7F0', boneBright: '#FDFCF8',
  field: '#FFFDF7', fieldBorder: '#DDD7C6', rule: '#E2DDCD',
  text2: '#6F7B6F', text3: '#5C6A5C', mute: '#A6A397', danger: '#8C2F26',
}
const SANS = "'Inter Tight', Helvetica, Arial, sans-serif"
const SERIF = "'EB Garamond', serif"

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter+Tight:wght@400;500;600&display=swap');
  .lg-input { transition: border-color .16s, box-shadow .16s; }
  .lg-btn { transition: background .16s; }
  .lg-eye { transition: color .15s ease; }
  .lg-eye:hover { color: ${C.green} !important; }
`

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const usuarioRef = useRef(null)
  useEffect(() => { usuarioRef.current?.focus() }, [])

  const handleSubmit = async (e) => {
    e?.preventDefault()
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
    } catch {
      setError('Error de conexión.')
    }
    setLoading(false)
  }

  const field = (name) => ({
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 15px',
    fontSize: 15,
    fontFamily: SANS,
    color: C.green,
    background: C.field,
    border: '1px solid ' + (error ? C.danger : focused === name ? C.gold : C.fieldBorder),
    borderRadius: 2,
    outline: 'none',
    boxShadow: focused === name ? '0 0 0 3px rgba(168,146,95,.16)' : 'none',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: C.bone, fontFamily: SANS, color: C.green }}>
      <style>{CSS}</style>

      {/* Panel de marca */}
      <div style={{
        flex: isMobile ? '0 0 auto' : '1 1 46%', background: C.green,
        padding: isMobile ? '40px 28px' : '64px 60px', display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
        gap: isMobile ? 28 : 0,
      }}>
        {!isMobile && (
          <>
            <div style={{ position: 'absolute', top: -140, right: -140, width: 420, height: 420, border: '1px solid rgba(168,146,95,.16)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -190, left: -120, width: 380, height: 380, border: '1px solid rgba(168,146,95,.1)', borderRadius: '50%' }} />
          </>
        )}

        <div style={{ position: 'relative', display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'stretch', gap: isMobile ? 20 : 44 }}>
          <JoaShield height={isMobile ? 64 : 118} compact={isMobile} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 18, maxWidth: 420 }}>
            <h1 style={{ margin: 0, display: 'flex', flexDirection: 'column', fontFamily: SERIF, fontWeight: 400, lineHeight: 1, letterSpacing: '-.005em', color: C.bone }}>
              {!isMobile && <span style={{ fontSize: 15, letterSpacing: '.32em', textTransform: 'uppercase', color: C.gold, paddingBottom: 16 }}>Gestor de</span>}
              <span style={{ fontSize: isMobile ? 40 : 76, fontWeight: 500 }}>Causas</span>
              <span style={{ fontSize: isMobile ? 40 : 76, fontStyle: 'italic', color: C.goldSoft, paddingTop: 4 }}>Penales</span>
            </h1>
            {!isMobile && (
              <>
                <div style={{ width: 56, height: 1, background: C.gold }} />
                <p style={{ margin: 0, fontFamily: SERIF, fontStyle: 'italic', fontSize: 21, lineHeight: 1.45, color: 'rgba(244,241,232,.9)' }}>
                  "El orden es la primera defensa."
                </p>
              </>
            )}
          </div>
        </div>

        {!isMobile && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(244,241,232,.4)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold, flexShrink: 0 }} />
            Uso exclusivo del estudio · Obregón y Asociados
          </div>
        )}
      </div>

      {/* Panel del formulario */}
      <div style={{ flex: isMobile ? '1 1 auto' : '1 1 54%', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? '36px 24px' : '64px 48px' }}>
        <div style={{ width: '100%', maxWidth: 392, display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontWeight: 500, fontSize: 36, lineHeight: 1.1 }}>Bienvenidos</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.text2 }}>Usuario</span>
              <input
                ref={usuarioRef}
                className="lg-input"
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                autoComplete="username"
                required
                onFocus={() => setFocused('usuario')}
                onBlur={() => setFocused(null)}
                style={field('usuario')}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.text2 }}>Contraseña</span>
              <span style={{ position: 'relative', display: 'flex' }}>
                <input
                  className="lg-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  onFocus={() => setFocused('clave')}
                  onBlur={() => setFocused(null)}
                  style={{ ...field('clave'), padding: '13px 46px 13px 15px' }}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: 4, top: 4, bottom: 4, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.goldInk }}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </span>
            </label>

            {error && <div style={{ fontSize: 12.5, color: C.danger }}>{error}</div>}

            <button
              type="submit"
              className="lg-btn"
              disabled={loading}
              style={{ marginTop: 4, padding: 15, background: C.greenDeep, color: C.boneBright, border: 0, borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: SANS, fontSize: 12.5, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.greenDeeper }}
              onMouseLeave={e => { e.currentTarget.style.background = C.greenDeep }}
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
