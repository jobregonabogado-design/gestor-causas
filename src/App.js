import { useState, useEffect, useCallback } from 'react'
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
  @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
`

const f = { fontFamily:"'Inter',sans-serif" }

// ─── PANEL DE ACTIVIDAD (solo titular) ───────────────────────────────────────
function PanelActividad({ onClose }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoy')
  const [solicitudes, setSolicitudes] = useState([])

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

    const { data } = await supabase
      .from('actividad_usuario')
      .select('*')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)
    setActividad(data || [])
    setLoading(false)
  }

  const cargarSolicitudes = async () => {
    const { data } = await supabase
      .from('solicitudes_eliminacion')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
  }

  const responderSolicitud = async (id, estado, tabla, registroId) => {
    await supabase.from('solicitudes_eliminacion').update({ estado }).eq('id', id)
    if (estado === 'aprobada' && tabla && registroId) {
      await supabase.from(tabla).delete().eq('id', registroId)
    }
    cargarSolicitudes()
  }

  // Agrupar por usuario y calcular stats
  const stats = actividad.reduce((acc, a) => {
    if (!acc[a.email]) acc[a.email] = { ingresos: 0, acciones: 0, ultimoIngreso: null, ultimaSalida: null, tiempoTotal: 0 }
    if (a.tipo === 'ingreso') { acc[a.email].ingresos++; if (!acc[a.email].ultimoIngreso) acc[a.email].ultimoIngreso = a.created_at }
    if (a.tipo === 'salida') { if (!acc[a.email].ultimaSalida) acc[a.email].ultimaSalida = a.created_at }
    if (a.tipo === 'accion') acc[a.email].acciones++
    return acc
  }, {})

  const tipoColor = (tipo) => tipo === 'ingreso' ? '#059669' : tipo === 'salida' ? '#dc2626' : '#2563eb'
  const tipoIcon = (tipo) => tipo === 'ingreso' ? '🟢' : tipo === 'salida' ? '🔴' : '📝'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.4)', backdropFilter:'blur(4px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:520, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-8px 0 40px rgba(0,0,0,0.15)', animation:'slideIn 0.3s ease'}}>
        
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1e293b,#0f172a)', padding:'24px 24px 20px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>👁 Panel de Control</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>Solo visible para el titular</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:13 }}>✕ Cerrar</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {['hoy','semana','mes'].map(opcion => (
              <button key={opcion} onClick={() => setFiltro(opcion)} style={{ padding:'5px 14px', borderRadius:20, fontSize:11, fontWeight:600, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:0.5, background: filtro===opcion ? '#2563eb' : 'rgba(255,255,255,0.1)', color: filtro===opcion ? '#fff' : '#94a3b8'}}>
                {{opcion === 'hoy' ? 'Hoy' : {opcion === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:20 }}>

          {/* Solicitudes pendientes */}
          {solicitudes.length > 0 && (
            <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:12, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#dc2626', marginBottom:12 }}>🚨 {solicitudes.length} solicitud{solicitudes.length>1?'es':''} de eliminación pendiente{solicitudes.length>1?'s':''}</div>
              {solicitudes.map(s => (
                <div key={s.id} style={{ background:'#fff', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:4 }}>{s.descripcion}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>Solicitado por: {s.solicitante_email} · {new Date(s.created_at).toLocaleString('es-CL')}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => responderSolicitud(s.id, 'aprobada', s.tabla, s.registro_id)}
                      style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'5px 14px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600 }}>
                      ✓ Aprobar eliminación
                    </button>
                    <button onClick={() => responderSolicitud(s.id, 'rechazada', null, null)}
                      style={{ background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:6, padding:'5px 14px', fontSize:11, color:'#059669', cursor:'pointer', fontWeight:600 }}>
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats por usuario */}
          {Object.entries(stats).map(([email, s]) => (
            <div key={email} style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700 }}>
                  {email[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{email}</div>
                  {s.ultimoIngreso && <div style={{ fontSize:11, color:'#94a3b8' }}>Último ingreso: {new Date(s.ultimoIngreso).toLocaleString('es-CL')}</div>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'Ingresos', val:s.ingresos, color:'#059669', bg:'#f0fdf4' },
                  { label:'Acciones', val:s.acciones, color:'#2563eb', bg:'#eff6ff' },
                  { label:'Salidas', val: actividad.filter(a=>a.email===email&&a.tipo==='salida').length, color:'#dc2626', bg:'#fef2f2' },
                ].map(st => (
                  <div key={st.label} style={{ background:st.bg, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:st.color }}>{st.val}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, marginTop:2 }}>{st.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Log de actividad */}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:600, marginBottom:10 }}>Registro de actividad</div>
          {loading ? (
            <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>Cargando...</div>
          ) : actividad.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'#cbd5e1', fontSize:13 }}>Sin actividad en este período</div>
          ) : actividad.map(a => (
            <div key={a.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderBottom:'1px solid #f1f5f9', alignItems:'flex-start' }}>
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{tipoIcon(a.tipo)}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:500, color:'#0f172a' }}>{a.descripcion}</div>
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

// ─── NOTIFICACIONES EN TIEMPO REAL ──────────────────────────────────────────
function NotifToast({ notif, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [])

  const esIngreso = notif.tipo === 'ingreso'
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:2000,
      background: esIngreso ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)',
      border: `1.5px solid ${esIngreso?'#a7f3d0':'#fecaca'}`,
      borderRadius:12, padding:'14px 18px', minWidth:300, maxWidth:380,
      boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
      animation:'slideIn 0.3s ease', ...f
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:22 }}>{esIngreso ? '🟢' : '🔴'}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: esIngreso?'#065f46':'#991b1b' }}>
              {esIngreso ? 'Asistente conectado' : 'Asistente desconectado'}
            </div>
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

  // Cargar rol del usuario
  const cargarRol = useCallback(async (userId) => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single()
    setUserRol(data)
    return data
  }, [])

  // Registrar actividad
  const registrarActividad = useCallback(async (tipo, descripcion, metadata = {}) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('actividad_usuario').insert({
      user_id: user.id,
      email: user.email,
      tipo,
      descripcion,
      metadata,
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const rol = await cargarRol(session.user.id)
        if (rol) {
          await registrarActividad('ingreso', `Ingresó a LexOffice`, { pagina: 'inicio' })
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) {
        const rol = await cargarRol(s.user.id)
        if (rol && _e === 'SIGNED_IN') {
          await registrarActividad('ingreso', `Ingresó a LexOffice`)
        }
      }
    })

    // Registrar salida al cerrar ventana
    const handleUnload = () => {
      const user = supabase.auth.getUser()
      navigator.sendBeacon && supabase.from('actividad_usuario').insert({
        tipo: 'salida',
        descripcion: 'Cerró la aplicación',
      })
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  // Escuchar actividad en tiempo real (solo titular)
  useEffect(() => {
    if (!userRol || userRol.rol !== 'titular') return

    // Cargar solicitudes pendientes
    const cargarSolicitudes = async () => {
      const { count } = await supabase
        .from('solicitudes_eliminacion')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
      setSolicitudesPendientes(count || 0)
    }
    cargarSolicitudes()

    // Suscribirse a nueva actividad en tiempo real
    const channel = supabase
      .channel('actividad-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'actividad_usuario',
      }, (payload) => {
        const nueva = payload.new
        // Solo notificar si es otro usuario
        if (nueva.email !== session?.user?.email && (nueva.tipo === 'ingreso' || nueva.tipo === 'salida')) {
          setNotif({ tipo: nueva.tipo, email: nueva.email })
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'solicitudes_eliminacion',
      }, () => {
        cargarSolicitudes()
        setSolicitudesPendientes(prev => prev + 1)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userRol, session])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 8px 24px rgba(37,99,235,0.3)' }}>⚖</div>
        <div style={{ fontFamily:'Inter,sans-serif', color:'#94a3b8', fontSize:13, letterSpacing:1.5, textTransform:'uppercase', fontWeight:500 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  const esTitular = userRol?.rol === 'titular'

  const handleSignOut = async () => {
    await registrarActividad('salida', 'Cerró sesión')
    await supabase.auth.signOut()
  }

  return (
    <div style={{ background:'#f8fafc', minHeight:'100vh' }}>
      <style>{css}</style>

      {/* Toast de notificación */}
      {notif && <NotifToast notif={notif} onClose={() => setNotif(null)} />}

      {/* Panel de actividad */}
      {showPanel && <PanelActividad onClose={() => { setShowPanel(false); setSolicitudesPendientes(0) }} />}

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
          {/* Badge rol */}
          <span style={{
            fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5,
            padding:'3px 10px', borderRadius:20,
            background: esTitular ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#f1f5f9',
            color: esTitular ? '#fff' : '#64748b',
            border: esTitular ? 'none' : '1px solid #e2e8f0',
            ...f
          }}>
            {esTitular ? '⚖ Titular' : '👤 Asistente'}
          </span>

          {/* Botón panel titular */}
          {esTitular && (
            <button onClick={() => setShowPanel(true)} style={{
              position:'relative', background: solicitudesPendientes > 0 ? '#fef2f2' : '#f8fafc',
              border: `1.5px solid ${solicitudesPendientes > 0 ? '#fecaca' : '#e2e8f0'}`,
              borderRadius:8, padding:'5px 12px', fontSize:12, cursor:'pointer', fontWeight:600,
              color: solicitudesPendientes > 0 ? '#dc2626' : '#64748b',
              display:'flex', alignItems:'center', gap:6, ...f
            }}>
              👁 Control
              {solicitudesPendientes > 0 && (
                <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse 1.5s infinite' }}>
                  {solicitudesPendientes}
                </span>
              )}
            </button>
          )}

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background: esTitular ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>
              {session.user.email?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize:12, color:'#64748b', fontFamily:'Inter,sans-serif' }}>{userRol?.nombre || session.user.email}</span>
          </div>
          <button className="salir-btn" onClick={handleSignOut}>Salir</button>
        </div>
      </nav>

      <div className="page-in" key={pagina}>
        {pagina === 'causas' && <Dashboard session={session} userRol={userRol} registrarActividad={registrarActividad} />}
        {pagina === 'calendario' && <Calendario />}
      </div>
    </div>
  )
}
