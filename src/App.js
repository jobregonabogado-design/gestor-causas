import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #F8F9FC; color: #1E293B; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #F8F9FC; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .nav-link { font-family:'Inter',sans-serif; font-size:13px; font-weight:500; padding:8px 18px; border-radius:10px; border:none; cursor:pointer; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); background:transparent; color:#64748b; }
  .nav-link:hover { background:#F1F5F9; color:#1E293B; }
  .nav-link.active { background:#1E293B; color:#fff; font-weight:600; box-shadow:0 8px 20px rgba(30,41,59,0.22); }
  .page-in { animation:pageIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .salir-btn { background:transparent; border:1.5px solid #E2E8F0; color:#64748b; border-radius:10px; padding:6px 16px; font-size:12px; font-family:'Inter',sans-serif; cursor:pointer; transition:all 0.25s; font-weight:500; }
  .salir-btn:hover { border-color:#1E293B; color:#1E293B; background:#F8F9FC; }
  @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
  @media (max-width: 640px) {
    .nav-email { display: none !important; }
    .nav-badge { display: none !important; }
    .nav-nombre { display: none !important; }
  }
`

const f = { fontFamily:"'Inter',sans-serif" }

function PanelActividad({ onClose }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoy')
  const [solicitudes, setSolicitudes] = useState([])
  const [usuarioExpandido, setUsuarioExpandido] = useState(null)

  useEffect(() => {
    cargarActividad()
    cargarSolicitudes()
  }, [filtro])

  const cargarActividad = async () => {
    setLoading(true)
    let desde = new Date()
    if (filtro === 'hoy') desde.setHours(0,0,0,0)
    else if (filtro === 'semana') desde.setDate(desde.getDate() - 7)
    else if (filtro === 'mes') desde.setDate(desde.getDate() - 30)
    const { data } = await supabase.from('actividad_usuario').select('*').gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(100)
    setActividad(data || [])
    setLoading(false)
  }

  const cargarSolicitudes = async () => {
    const { data } = await supabase.from('solicitudes_eliminacion').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false })
    setSolicitudes(data || [])
  }

  const responderSolicitud = async (id, estado, tabla, registroId) => {
    await supabase.from('solicitudes_eliminacion').update({ estado }).eq('id', id)
    if (estado === 'aprobada' && tabla && registroId) await supabase.from(tabla).delete().eq('id', registroId)
    cargarSolicitudes()
  }

  const stats = actividad.reduce((acc, a) => {
    if (!acc[a.email]) acc[a.email] = { ingresos: 0, acciones: 0, ultimoIngreso: null, ultimaSalida: null }
    if (a.tipo === 'ingreso') { acc[a.email].ingresos++; if (!acc[a.email].ultimoIngreso) acc[a.email].ultimoIngreso = a.created_at }
    if (a.tipo === 'salida') { if (!acc[a.email].ultimaSalida) acc[a.email].ultimaSalida = a.created_at }
    if (a.tipo === 'accion') acc[a.email].acciones++
    return acc
  }, {})

  const tipoColor = (tipo) => tipo === 'ingreso' ? '#059669' : tipo === 'salida' ? '#dc2626' : '#1E293B'
  const tipoIcon = (tipo) => tipo === 'ingreso' ? '🟢' : tipo === 'salida' ? '🔴' : '📝'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.35)', backdropFilter:'blur(2px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:520, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-16px 0 48px rgba(15,23,42,0.12)', animation:'slideIn 0.3s ease', fontFamily:"'Inter',sans-serif" }}>
        <div style={{ background:'#1E293B', padding:'24px 24px 20px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>👁 Panel de Control</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>Solo visible para el titular</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:13 }}>✕ Cerrar</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {['hoy','semana','mes'].map(opcion => (
              <button key={opcion} onClick={() => setFiltro(opcion)} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:600, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:0.5, background: filtro===opcion ? '#fff' : 'rgba(255,255,255,0.1)', color: filtro===opcion ? '#1E293B' : '#94a3b8', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }}>
                {opcion === 'hoy' ? 'Hoy' : opcion === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding:20 }}>
          {solicitudes.length > 0 && (
            <div style={{ background:'#fff', border:'1.5px solid #fecaca', borderRadius:16, padding:16, marginBottom:20, boxShadow:'0 8px 24px rgba(220,38,38,0.06)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#dc2626', marginBottom:12 }}>🚨 {solicitudes.length} solicitud{solicitudes.length>1?'es':''} de eliminación pendiente{solicitudes.length>1?'s':''}</div>
              {solicitudes.map(s => (
                <div key={s.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1E293B', marginBottom:4 }}>{s.descripcion}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>Solicitado por: {s.solicitante_email} · {new Date(s.created_at).toLocaleString('es-CL')}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => responderSolicitud(s.id, 'aprobada', s.tabla, s.registro_id)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'5px 14px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600 }}>✓ Aprobar eliminación</button>
                    <button onClick={() => responderSolicitud(s.id, 'rechazada', null, null)} style={{ background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:8, padding:'5px 14px', fontSize:11, color:'#059669', cursor:'pointer', fontWeight:600 }}>✕ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {Object.entries(stats).map(([email, s]) => {
            const actividadUsuario = actividad.filter(a => a.email === email)
            const salidas = actividadUsuario.filter(a => a.tipo === 'salida').length
            const acciones = actividadUsuario.filter(a => a.tipo === 'accion').length
            const ingresos = actividadUsuario.filter(a => a.tipo === 'ingreso').length
            return (
              <div key={email} style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, marginBottom:12, overflow:'hidden', boxShadow:'0 4px 16px rgba(15,23,42,0.04)' }}>
                <div onClick={() => setUsuarioExpandido(prev => prev === email ? null : email)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background: usuarioExpandido===email ? '#F8F9FC' : '#fff', transition:'background 0.2s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#1E293B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700 }}>{email[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>{email}</div>
                      {s.ultimoIngreso && <div style={{ fontSize:11, color:'#94a3b8' }}>Último ingreso: {new Date(s.ultimoIngreso).toLocaleString('es-CL')}</div>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#059669', background:'#f0fdf4', padding:'2px 8px', borderRadius:20 }}>🟢 {ingresos}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1E293B', background:'#F1F5F9', padding:'2px 8px', borderRadius:20 }}>📝 {acciones}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', padding:'2px 8px', borderRadius:20 }}>🔴 {salidas}</span>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{usuarioExpandido===email ? '▲' : '▼'}</span>
                  </div>
                </div>
                {usuarioExpandido === email && (
                  <div style={{ borderTop:'1px solid #E2E8F0', padding:'12px 16px' }}>
                    {actividadUsuario.length === 0 ? (
                      <div style={{ fontSize:12, color:'#cbd5e1', textAlign:'center', padding:12 }}>Sin actividad en este período</div>
                    ) : actividadUsuario.map(a => (
                      <div key={a.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid #F1F5F9', alignItems:'center' }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{tipoIcon(a.tipo)}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{a.descripcion}</div>
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{new Date(a.created_at).toLocaleString('es-CL')}</div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color: tipoColor(a.tipo), textTransform:'uppercase', padding:'2px 6px', borderRadius:6, background: a.tipo==='ingreso'?'#f0fdf4':a.tipo==='salida'?'#fef2f2':'#F1F5F9', flexShrink:0 }}>{a.tipo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:600, marginBottom:10 }}>Registro de actividad</div>
          {loading ? (
            <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>Cargando...</div>
          ) : actividad.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'#cbd5e1', fontSize:13 }}>Sin actividad en este período</div>
          ) : actividad.map(a => (
            <div key={a.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderBottom:'1px solid #F1F5F9', alignItems:'flex-start' }}>
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{tipoIcon(a.tipo)}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{a.descripcion}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{a.email} · {new Date(a.created_at).toLocaleString('es-CL')}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: tipoColor(a.tipo), textTransform:'uppercase', flexShrink:0 }}>{a.tipo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotifToast({ notif, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [])
  const esIngreso = notif.tipo === 'ingreso'
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border: `1.5px solid ${esIngreso?'#a7f3d0':'#fecaca'}`, borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:380, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', animation:'slideIn 0.3s ease', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:22 }}>{esIngreso ? '🟢' : '🔴'}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: esIngreso?'#065f46':'#991b1b' }}>{esIngreso ? 'Asistente conectado' : 'Asistente desconectado'}</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{notif.email}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{new Date().toLocaleTimeString('es-CL')}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:2 }}>✕</button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState('causas')
  const [userRol, setUserRol] = useState(null)
  const [showPanel, setShowPanel] = useState(false)
  const [notif, setNotif] = useState(null)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  // ✅ Estado para causa seleccionada desde el calendario
  const [causaDesdeCalendario, setCausaDesdeCalendario] = useState(null)

  const cargarRol = useCallback(async (userId) => {
    const { data } = await supabase.from('user_roles').select('*').eq('user_id', userId).single()
    setUserRol(data)
    return data
  }, [])

  const registrarActividad = useCallback(async (tipo, descripcion, metadata = {}) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('actividad_usuario').insert({ user_id: user.id, email: user.email, tipo, descripcion, metadata })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const rol = await cargarRol(session.user.id)
        if (rol) await registrarActividad('ingreso', `Ingresó a LexOffice`, { pagina: 'inicio' })
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) {
        const rol = await cargarRol(s.user.id)
        if (rol && _e === 'SIGNED_IN') await registrarActividad('ingreso', `Ingresó a LexOffice`)
      }
    })
    const handleUnload = () => { navigator.sendBeacon && supabase.from('actividad_usuario').insert({ tipo: 'salida', descripcion: 'Cerró la aplicación' }) }
    window.addEventListener('beforeunload', handleUnload)
    return () => { subscription.unsubscribe(); window.removeEventListener('beforeunload', handleUnload) }
  }, [])

  useEffect(() => {
    if (!userRol || userRol.rol !== 'titular') return
    const cargarSolicitudes = async () => {
      const { count } = await supabase.from('solicitudes_eliminacion').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
      setSolicitudesPendientes(count || 0)
    }
    cargarSolicitudes()
    const channel = supabase.channel('actividad-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad_usuario' }, (payload) => {
        const nueva = payload.new
        if (nueva.email !== session?.user?.email && (nueva.tipo === 'ingreso' || nueva.tipo === 'salida')) setNotif({ tipo: nueva.tipo, email: nueva.email })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitudes_eliminacion' }, () => {
        cargarSolicitudes()
        setSolicitudesPendientes(prev => prev + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userRol, session])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#F8F9FC', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:'#1E293B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 12px 32px rgba(30,41,59,0.18)' }}>⚖</div>
        <div style={{ fontFamily:'Inter,sans-serif', color:'#94a3b8', fontSize:13, letterSpacing:1.5, textTransform:'uppercase', fontWeight:500 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  const esTitular = userRol?.rol === 'titular'
  const handleSignOut = async () => { await registrarActividad('salida', 'Cerró sesión'); await supabase.auth.signOut() }

  // ✅ Handler: desde calendario → abrir causa en Dashboard
  const handleVerCausa = (causa) => {
    setCausaDesdeCalendario(causa)
    setPagina('causas')
  }

  return (
    <div style={{ background:'#F8F9FC', minHeight:'100vh' }}>
      <style>{css}</style>
      {notif && <NotifToast notif={notif} onClose={() => setNotif(null)} />}
      {showPanel && <PanelActividad onClose={() => { setShowPanel(false); setSolicitudesPendientes(0) }} />}

      <nav style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, background:'#1E293B', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 6px 16px rgba(30,41,59,0.2)' }}>⚖</div>
          <div>
            <div style={{ fontFamily:'Inter,sans-serif', fontSize:15, fontWeight:800, color:'#1E293B', letterSpacing:'-0.5px' }}>LexOffice</div>
            <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:2, textTransform:'uppercase', fontWeight:500, marginTop:-1 }}>Gestión Penal</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, background:'#F8F9FC', padding:'4px', borderRadius:12, border:'1px solid #E2E8F0' }}>
          {[{id:'causas',label:'Causas'},{id:'calendario',label:'Calendario'}].map(item => (
            <button key={item.id} className={`nav-link${pagina===item.id?' active':''}`} onClick={() => setPagina(item.id)}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, padding:'4px 12px', borderRadius:20, background: esTitular ? '#1E293B' : '#F1F5F9', color: esTitular ? '#fff' : '#64748b', border: esTitular ? 'none' : '1px solid #E2E8F0', fontFamily:"'Inter',sans-serif" }}>
            {esTitular ? '⚖ Titular' : '👤 Asistente'}
          </span>
          {esTitular && (
            <button onClick={() => setShowPanel(true)} style={{ position:'relative', background: solicitudesPendientes > 0 ? '#fef2f2' : '#fff', border: `1.5px solid ${solicitudesPendientes > 0 ? '#fecaca' : '#E2E8F0'}`, borderRadius:10, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:600, color: solicitudesPendientes > 0 ? '#dc2626' : '#64748b', display:'flex', alignItems:'center', gap:6, fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }}>
              👁 Control
              {solicitudesPendientes > 0 && (
                <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse 1.5s infinite' }}>{solicitudesPendientes}</span>
              )}
            </button>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:29, height:29, borderRadius:'50%', background: esTitular ? '#1E293B' : '#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>{session.user.email?.[0]?.toUpperCase()}</div>
            <span className='nav-nombre' style={{ fontSize:12, color:'#64748b', fontFamily:'Inter,sans-serif' }}>{userRol?.nombre || session.user.email}</span>
          </div>
          <button className="salir-btn" onClick={handleSignOut}>Salir</button>
        </div>
      </nav>

      <div className="page-in" key={pagina}>
        {/* ✅ Dashboard recibe causaDesdeCalendario para abrirla directo */}
        {pagina === 'causas' && (
          <Dashboard
            session={session}
            userRol={userRol}
            registrarActividad={registrarActividad}
            causaInicial={causaDesdeCalendario}
            onCausaInicialUsada={() => setCausaDesdeCalendario(null)}
          />
        )}
        {/* ✅ Calendario recibe onVerCausa para navegar */}
        {pagina === 'calendario' && (
          <Calendario onVerCausa={handleVerCausa} />
        )}
      </div>
    </div>
  )
}
