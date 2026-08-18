import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'
import Escritos from './pages/Escritos'
import CodigosLeyes from './pages/CodigosLeyes'
import Contabilidad from './pages/Contabilidad'
import { diasHabilesDesde } from './pages/dashboard/diligencias'
import { diasEntreFechasCaut } from './pages/dashboard/cautelares'
import { hoyISO } from './pages/dashboard/utils'
import SolicitudVisitaSantiagoI from './components/SolicitudVisitaSantiagoI'
import JoaShield from './components/JoaShield'
import Notas from './pages/Notas'
import { useEstadoConexion } from './lib/offline'
import { generarYRespaldar } from './lib/backup'
import { sincronizarTodasLasCausas } from './pages/dashboard/resumen'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope','Inter', system-ui, sans-serif; background: #FAF7F0; color: #2F5D48; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #FAF7F0; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .nav-link { font-family:'Manrope','Inter',sans-serif; font-size:13px; font-weight:500; padding:8px 18px; border-radius:10px; border:none; cursor:pointer; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); background:transparent; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; }
  .nav-link:hover { background:#F1F5F9; color:#2F5D48; }
  .nav-link.active { background:#2F5D48; color:#fff; font-weight:600; box-shadow:0 8px 20px rgba(30,58,47,0.22); }
  .page-in { animation:pageIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .salir-btn { background:transparent; border:1.5px solid #E2E8F0; color:#64748b; border-radius:10px; padding:6px 16px; font-size:12px; font-family:'Manrope','Inter',sans-serif; cursor:pointer; transition:all 0.25s; font-weight:500; }
  .salir-btn:hover { border-color:#2F5D48; color:#2F5D48; background:#FAF7F0; }
  @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
  .alerta-btn { background:#fff; border:1.5px solid #E2E8F0; color:#64748b; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; font-family:'Manrope','Inter',sans-serif; text-transform:uppercase; letter-spacing:0.3px; }
  .alerta-btn:hover { border-color:#dc2626; color:#dc2626; background:#fef2f2; }
  .alerta-btn-active { background:#dc2626; border:1.5px solid #dc2626; color:#fff; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-family:'Manrope','Inter',sans-serif; text-transform:uppercase; letter-spacing:0.3px; animation:alertaPulse 1.4s infinite; }
  @keyframes alertaPulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.45)} 50%{box-shadow:0 0 0 7px rgba(220,38,38,0)} }
  @media (max-width: 640px) {
    .nav-email { display: none !important; }
    .nav-badge { display: none !important; }
    .nav-nombre { display: none !important; }
  }
  /* ✅ Responsive: en pantallas angostas (celular), la barra de arriba pasa a
     2 filas en vez de forzar scroll horizontal de toda la página. */
  .app-nav { flex-wrap: wrap; row-gap: 8px; }
  .app-navlinks { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .app-navlinks::-webkit-scrollbar { display: none; }
  @media (max-width: 760px) {
    .app-nav { padding: 10px 14px !important; height: auto !important; }
    .app-logo-sub { display: none !important; }
    .app-navlinks { order: 3; width: 100%; }
    .nav-link { padding: 7px 12px !important; font-size: 12px !important; white-space: nowrap; }
    .alerta-btn, .alerta-btn-active { padding: 6px 10px !important; font-size: 11px !important; white-space: nowrap; }
  }
`

const f = { fontFamily:"'Manrope','Inter',sans-serif" }

// ✅ NUEVO: prop `soloEmail` — cuando viene con un correo, el panel funciona
// en "modo propio": una sola persona viendo SU PROPIA actividad (pensado
// para el asistente, que no tiene acceso al Panel de Control del titular
// pero sí puede querer ver de un vistazo en qué causas avanzó en el día).
// En ese modo se salta la sección de solicitudes de eliminación pendientes
// (eso es solo del titular) y no tiene sentido agrupar por usuario, así que
// se muestra directo el detalle de acciones.
function PanelActividad({ onClose, onVerCausa, soloEmail }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoy')
  const [solicitudes, setSolicitudes] = useState([])
  const [usuarioExpandido, setUsuarioExpandido] = useState(null)

  useEffect(() => {
    cargarActividad()
    if (!soloEmail) cargarSolicitudes()
  }, [filtro])

  const cargarActividad = async () => {
    setLoading(true)
    let desde = new Date()
    if (filtro === 'hoy') desde.setHours(0,0,0,0)
    else if (filtro === 'semana') desde.setDate(desde.getDate() - 7)
    else if (filtro === 'mes') desde.setDate(desde.getDate() - 30)

    if (soloEmail) {
      const { data } = await supabase.from('actividad_usuario').select('*').eq('tipo', 'accion').eq('email', soloEmail).gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(150)
      setActividad(data || [])
      setLoading(false)
      return
    }

    // 🔎 Solo interesa qué se hizo (acción), no ingresos/salidas de sesión
    // ✅ FIX: antes se pedía un solo LIMIT 150 compartido entre TODOS los
    // usuarios juntos, ordenado por fecha — si una persona es mucho más
    // activa que otra (ej. Joaquín hace cientos de acciones seguidas), sus
    // acciones llenaban las 150 completas y la otra persona (ej. Adolfo)
    // desaparecía del todo del panel, aunque sí hubiera trabajado dentro
    // del rango de fechas elegido. Ahora se trae hasta 150 acciones POR
    // CADA usuario que tuvo actividad en el rango, para que nadie quede
    // tapado por otro más activo.
    const { data: emailsData } = await supabase.from('actividad_usuario').select('email').eq('tipo', 'accion').gte('created_at', desde.toISOString())
    const emails = [...new Set((emailsData || []).map(r => r.email))]
    const resultados = await Promise.all(emails.map(email =>
      supabase.from('actividad_usuario').select('*').eq('tipo', 'accion').eq('email', email).gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(150)
    ))
    const data = resultados.flatMap(r => r.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setActividad(data)
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

  // Extrae el RUC mencionado en la descripción de la acción, si lo hay
  const extraerRuc = (descripcion) => {
    const m = (descripcion || '').match(/RUC\s+([\w.\-]+)/i)
    return m ? m[1] : null
  }

  const stats = actividad.reduce((acc, a) => {
    if (!acc[a.email]) acc[a.email] = 0
    acc[a.email]++
    return acc
  }, {})

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.35)', backdropFilter:'blur(2px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:520, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-16px 0 48px rgba(15,23,42,0.12)', animation:'slideIn 0.3s ease', fontFamily:"'Manrope','Inter',sans-serif" }}>
        <div style={{ background:'#2F5D48', padding:'24px 24px 20px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>{soloEmail ? '📋 Mi actividad' : '👁 Panel de Control'}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>{soloEmail ? 'Lo que has trabajado en las causas' : 'Qué hizo el equipo — solo visible para el titular'}</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:10, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:13 }}>✕ Cerrar</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {['hoy','semana','mes'].map(opcion => (
              <button key={opcion} onClick={() => setFiltro(opcion)} style={{ padding:'6px 16px', borderRadius:20, fontSize:11, fontWeight:600, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:0.5, background: filtro===opcion ? '#fff' : 'rgba(255,255,255,0.1)', color: filtro===opcion ? '#2F5D48' : '#94a3b8', fontFamily:"'Manrope','Inter',sans-serif", transition:'all 0.2s' }}>
                {opcion === 'hoy' ? 'Hoy' : opcion === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding:20 }}>
          {!soloEmail && solicitudes.length > 0 && (
            <div style={{ background:'#fff', border:'1.5px solid #fecaca', borderRadius:16, padding:16, marginBottom:20, boxShadow:'0 8px 24px rgba(220,38,38,0.06)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#dc2626', marginBottom:12 }}>🚨 {solicitudes.length} solicitud{solicitudes.length>1?'es':''} de eliminación pendiente{solicitudes.length>1?'s':''}</div>
              {solicitudes.map(s => (
                <div key={s.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#2F5D48', marginBottom:4 }}>{s.descripcion}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>Solicitado por: {s.solicitante_email} · {new Date(s.created_at).toLocaleString('es-CL')}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => responderSolicitud(s.id, 'aprobada', s.tabla, s.registro_id)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'5px 14px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600 }}>✓ Aprobar eliminación</button>
                    <button onClick={() => responderSolicitud(s.id, 'rechazada', null, null)} style={{ background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:8, padding:'5px 14px', fontSize:11, color:'#059669', cursor:'pointer', fontWeight:600 }}>✕ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!soloEmail && Object.entries(stats).map(([email, cantidad]) => {
            const actividadUsuario = actividad.filter(a => a.email === email)
            return (
              <div key={email} style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, marginBottom:12, overflow:'hidden', boxShadow:'0 4px 16px rgba(15,23,42,0.04)' }}>
                <div onClick={() => setUsuarioExpandido(prev => prev === email ? null : email)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background: usuarioExpandido===email ? '#FAF7F0' : '#fff', transition:'background 0.2s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#2F5D48', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700 }}>{email[0]?.toUpperCase()}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#2F5D48' }}>{email}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#2F5D48', background:'#F1F5F9', padding:'2px 10px', borderRadius:20 }}>📝 {cantidad} acción{cantidad>1?'es':''}</span>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{usuarioExpandido===email ? '▲' : '▼'}</span>
                  </div>
                </div>
                {usuarioExpandido === email && (
                  <div style={{ borderTop:'1px solid #E2E8F0', padding:'12px 16px' }}>
                    {actividadUsuario.map(a => {
                      const ruc = extraerRuc(a.descripcion)
                      return (
                        <div key={a.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid #F1F5F9', alignItems:'center' }}>
                          <span style={{ fontSize:13, flexShrink:0 }}>📝</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#2F5D48' }}>{a.descripcion}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{new Date(a.created_at).toLocaleString('es-CL')}</div>
                          </div>
                          {ruc && onVerCausa && (
                            <button onClick={() => onVerCausa(ruc)} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#1e40af', cursor:'pointer', fontWeight:600, flexShrink:0, fontFamily:"'Manrope','Inter',sans-serif" }}>→ Ver causa</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:600, marginBottom:10 }}>{soloEmail ? 'Detalle' : 'Registro de acciones'}</div>
          {loading ? (
            <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>Cargando...</div>
          ) : actividad.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'#cbd5e1', fontSize:13 }}>{soloEmail ? 'Aún no hay acciones registradas en este período' : 'Sin acciones registradas en este período'}</div>
          ) : actividad.map(a => {
            const ruc = extraerRuc(a.descripcion)
            return (
              <div key={a.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderBottom:'1px solid #F1F5F9', alignItems:'center' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>📝</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#2F5D48' }}>{a.descripcion}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{soloEmail ? new Date(a.created_at).toLocaleString('es-CL') : `${a.email} · ${new Date(a.created_at).toLocaleString('es-CL')}`}</div>
                </div>
                {ruc && onVerCausa && (
                  <button onClick={() => onVerCausa(ruc)} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#1e40af', cursor:'pointer', fontWeight:600, flexShrink:0, fontFamily:"'Manrope','Inter',sans-serif" }}>→ Ver causa</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ✅ FIX: las tarjetas del Centro de Alertas (audiencias, Fiscalía sin
// responder, visitas) ocupaban mucho espacio — cada una repetía casi el
// mismo bloque de código, con título/subtítulo que se podían ir a una
// segunda línea con nombres largos, haciendo la tarjeta más alta todavía.
// Se junta en un solo componente compacto: una línea por tarjeta (con
// "..." si no cabe el texto), badge y botón más chicos, y sin duplicar el
// mismo layout 3 veces — pedido de Joaquín, "muy grande, mejor
// redistribuido".
function AlertaCard({ badge, color, bg, border, titulo, subtitulo, ruc, onVerCausa }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', background:bg, border:`1px solid ${border}`, borderRadius:9, padding:'7px 10px', marginBottom:5 }}>
      <span style={{ fontSize:9, fontWeight:800, color, flexShrink:0, whiteSpace:'nowrap', ...f }}>{badge}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#2F5D48', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{titulo}</div>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{subtitulo}</div>
      </div>
      {ruc && onVerCausa && (
        <button onClick={()=>onVerCausa(ruc)} style={{ background:'transparent', border:'none', padding:'2px 4px', fontSize:11, color, cursor:'pointer', fontWeight:700, flexShrink:0, ...f }}>Ver</button>
      )}
    </div>
  )
}

function PanelAlertas({ onClose, esTitular, audienciasProximas, diligenciasSinRespuesta, visitasPendientes, onVerCausa, session, registrarActividad }) {
  const hoyStr = hoyISO()

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.35)', backdropFilter:'blur(2px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:480, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-16px 0 48px rgba(15,23,42,0.12)', animation:'slideIn 0.3s ease', fontFamily:"'Manrope','Inter',sans-serif" }}>
        <div style={{ background:'#dc2626', padding:'16px 20px 14px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>🔔 Centro de Alertas</div>
              <div style={{ fontSize:10, color:'#fecaca', marginTop:1, textTransform:'uppercase', letterSpacing:1 }}>Lo que necesitas revisar</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:10, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:13 }}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ padding:'16px 20px' }}>
          {/* Audiencias próximas (hoy / mañana) */}
          {audienciasProximas.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:6, ...f }}>Audiencias próximas</div>
              {audienciasProximas.map(a => {
                const esHoy = a.fecha === hoyStr
                return (
                  <AlertaCard key={a.id}
                    badge={`${esHoy?'HOY':'MAÑANA'}${a.hora?' · '+a.hora:''}`}
                    color={esHoy?'#1e40af':'#64748b'} bg={esHoy?'#eff6ff':'#FAF7F0'} border={esHoy?'#bfdbfe':'#e2e8f0'}
                    titulo={`${a.tipo || 'Audiencia'}${a.imputado?' · '+a.imputado:''}`}
                    subtitulo={`${a.tribunal || '—'}${a.sala?' · Sala '+a.sala:''}`}
                    ruc={a.ruc} onVerCausa={onVerCausa}/>
                )
              })}
            </div>
          )}

          {/* ✅ NUEVO: solicitudes de audiencia/entrevista/declaración sin
              respuesta hace más de 5 días hábiles — antes solo se veía
              entrando a la pestaña Diligencias de cada causa puntual. */}
          {diligenciasSinRespuesta && diligenciasSinRespuesta.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:6, ...f }}>Fiscalía sin responder ({diligenciasSinRespuesta.length})</div>
              {diligenciasSinRespuesta.map(d => (
                <AlertaCard key={d.id}
                  badge={`${d.diasHabiles}d hábiles`} color="#991b1b" bg="#fef2f2" border="#fecaca"
                  titulo={`${d.tipo}${d.imputado ? ' · ' + d.imputado.split('|')[0] : ''}`}
                  subtitulo={`RUC ${d.ruc || '—'} · Folio ${d.folio || '—'}`}
                  ruc={d.ruc} onVerCausa={onVerCausa}/>
              ))}
            </div>
          )}

          {/* ✅ NUEVO: personas en Prisión Preventiva/Internación Provisoria
              (causa vigente) con 30+ días sin visita registrada, o sin
              ninguna visita nunca — pedido de Joaquín para saber de un
              vistazo a quién le urge más ir a ver. */}
          {visitasPendientes && visitasPendientes.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:6, ...f }}>Visitas a centros penales ({visitasPendientes.length})</div>
              {visitasPendientes.map(v => (
                <AlertaCard key={v.id}
                  badge={v.diasSinVisita===null?'Sin visitas':`${v.diasSinVisita}d sin visita`} color="#991b1b" bg="#fef2f2" border="#fecaca"
                  titulo={v.nombre||'—'}
                  subtitulo={`RUC ${v.ruc || '—'}${v.lugar_detencion?' · '+v.lugar_detencion:''}`}
                  ruc={v.ruc} onVerCausa={onVerCausa}/>
              ))}
            </div>
          )}

          {esTitular && <SolicitudVisitaSantiagoI session={session} registrarActividad={registrarActividad} />}

          {/* ✅ Se sacó "Advertencias del sistema" (plazo vencido/próximo) —
              pedido de Joaquín, esa misma información ya se ve en la lista de
              Causas (los filtros de arriba), quedaba duplicada acá. */}

          {/* ✅ "Pendientes" (notas/tareas personales) se sacó de acá — pedido
              de Joaquín: quería que quedaran separadas de las alertas
              reactivas, en su propia pestaña siempre visible. Ver
              src/pages/Notas.jsx. */}
        </div>
      </div>
    </div>
  )
}

function TareaToast({ tarea, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border:'1.5px solid #fecaca', borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:380, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', animation:'slideIn 0.3s ease', fontFamily:"'Manrope','Inter',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:22 }}>🔔</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#991b1b' }}>Nueva tarea encargada</div>
            <div style={{ fontSize:12, color:'#2F5D48', marginTop:2, fontWeight:500 }}>{tarea.texto}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Por {tarea.creado_por}</div>
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
  // ✅ NUEVO: vista propia de actividad para quien no es titular (ej. el
  // asistente) — mismo panel, pero acotado a su propio correo.
  const [showPanelPropio, setShowPanelPropio] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [showStatsCausas, setShowStatsCausas] = useState(false)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  // ✅ Estado para causa seleccionada desde el calendario
  const [causaDesdeCalendario, setCausaDesdeCalendario] = useState(null)

  // 📧 Conexión de Gmail: se vuelve acá desde /gmail-callback.html (ver ese
  // archivo) después de aceptar el permiso en Google — el canje del código
  // ya se hizo AHÍ MISMO (esa página es un archivo estático, siempre fresco,
  // sin depender de que este JS de React ni el Service Worker estén al día
  // en el celular). Acá solo queda mostrar el aviso y llevar a Joaquín
  // directo al Calendario con el panel de Gmail ya abierto.
  const [gmailMensaje, setGmailMensaje] = useState(null)
  const [abrirGmailAlEntrar, setAbrirGmailAlEntrar] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === '1') {
      window.history.replaceState({}, '', window.location.pathname)
      setGmailMensaje({ ok: true, texto: '✅ Gmail conectado.' })
      setPagina('calendario')
      setAbrirGmailAlEntrar(true)
    } else if (params.get('gmail_error') === '1') {
      window.history.replaceState({}, '', window.location.pathname)
      setGmailMensaje({ ok: false, texto: '❌ No se pudo conectar Gmail — intenta de nuevo.' })
    }
  }, [])
  // 📴 Estado de conexión / cambios pendientes de mandar (modo sin señal)
  const { online, pendientes } = useEstadoConexion()
  // 💾 Respaldo manual a Excel (+ OneDrive)
  const [generandoRespaldo, setGenerandoRespaldo] = useState(false)
  const [progresoRespaldo, setProgresoRespaldo] = useState('')
  const [mensajeRespaldo, setMensajeRespaldo] = useState(null)
  const handleGenerarRespaldo = async () => {
    setGenerandoRespaldo(true); setMensajeRespaldo(null)
    try {
      const { nombreArchivo, subidoOneDrive, errorOneDrive } = await generarYRespaldar({ onProgress: setProgresoRespaldo })
      setMensajeRespaldo({
        ok: true,
        texto: subidoOneDrive
          ? `✅ "${nombreArchivo}" descargado y subido a OneDrive (Respaldos).`
          : `✅ "${nombreArchivo}" descargado a tu computador. ⚠️ No se pudo subir a OneDrive: ${errorOneDrive}`
      })
    } catch (err) {
      setMensajeRespaldo({ ok: false, texto: `❌ No se pudo generar el respaldo: ${err.message}` })
    } finally {
      setGenerandoRespaldo(false); setProgresoRespaldo('')
    }
  }
  // 💾 "Sincronizar todo con OneDrive" — recorre TODAS las causas y deja al
  // día documentos + resumen de cada una, sin depender de haberlas abierto
  // antes. Tarda varios minutos (una por una) — se avisa el progreso.
  const [sincronizandoTodo, setSincronizandoTodo] = useState(false)
  const [progresoSincTodo, setProgresoSincTodo] = useState('')
  const [mensajeSincTodo, setMensajeSincTodo] = useState(null)
  const handleSincronizarTodo = async () => {
    if (!window.confirm('Esto va a recorrer TODAS las causas (documentos + resumen) y puede tardar varios minutos. ¿Empezar ahora?')) return
    setSincronizandoTodo(true); setMensajeSincTodo(null)
    try {
      const { hechas, total, fallidas } = await sincronizarTodasLasCausas({
        email: session?.user?.email,
        onProgress: ({ actual, total }) => setProgresoSincTodo(`${actual}/${total}...`),
      })
      setMensajeSincTodo({
        ok: fallidas.length === 0,
        texto: fallidas.length === 0
          ? `✅ Listo — ${hechas} de ${total} causas sincronizadas con OneDrive.`
          : `⚠️ ${hechas - fallidas.length} de ${total} causas sincronizadas. ${fallidas.length} fallaron (ej. ${fallidas[0].ruc}: ${fallidas[0].error}).`
      })
    } catch (err) {
      setMensajeSincTodo({ ok: false, texto: `❌ No se pudo sincronizar: ${err.message}` })
    } finally {
      setSincronizandoTodo(false); setProgresoSincTodo('')
    }
  }
  // 🔔 Estado del Centro de Alertas (advertencias + tareas del equipo)
  const [showAlerta, setShowAlerta] = useState(false)
  const [tareas, setTareas] = useState([])
  const [audienciasProximas, setAudienciasProximas] = useState([])
  // ✅ NUEVO: diligencias de Fiscalía tipo audiencia/entrevista/declaración
  // (donde la respuesta que se espera ES un agendamiento o su rechazo) que
  // llevan más de 5 días hábiles sin respuesta — antes este aviso solo
  // existía DENTRO de cada causa (pestaña Diligencias), así que si nadie
  // abría esa causa puntual, nadie se enteraba. La de Eladio Llempi Muñoz
  // (folio 140339880075) llevaba 161 días así sin que nada avisara.
  const [diligenciasSinRespuesta, setDiligenciasSinRespuesta] = useState([])
  const [notifTarea, setNotifTarea] = useState(null)

  // ✅ FIX: en el celular, cerrar la app (o cambiar a otra) NO la mata de
  // verdad — iOS solo la deja "pausada" en segundo plano, con TODO el
  // estado de React tal cual quedó (por eso al volver aparece justo donde
  // se dejó, ej. en Escritos). El problema es que si el menú del botón "J"
  // (arriba a la derecha) había quedado abierto en ese momento, al volver
  // sigue "abierto" de verdad — pero el toque para cerrarlo (el fondo
  // invisible que cubre toda la pantalla) a veces no alcanza a registrar
  // bien el primer toque justo al reactivarse la pestaña, así que quedaba
  // pegado y costaba sacarlo. Ahora, apenas la app vuelve a primer plano,
  // se cierran solos el menú y el panel de Alertas si habían quedado
  // abiertos — así nunca hay nada "pegado" esperando al volver.
  useEffect(() => {
    const cerrarMenusAlVolver = () => {
      if (document.visibilityState === 'visible') {
        setShowUserMenu(false)
        setShowAlerta(false)
      }
    }
    document.addEventListener('visibilitychange', cerrarMenusAlVolver)
    window.addEventListener('pageshow', cerrarMenusAlVolver)
    // ✅ FIX: "visibilitychange"/"pageshow" no siempre alcanzan a disparar en
    // Chrome de escritorio cuando la pestaña estuvo descartada por Chrome
    // para ahorrar memoria (o el navegador entero se cerró y volvió a abrir
    // con "restaurar pestañas") — pasó de verdad: el menú quedó pegado con
    // la app abierta en Calendario después de "cerrar sesión y volver". El
    // evento "focus" de la ventana es más básico y confiable como respaldo:
    // se dispara cada vez que se vuelve a esta pestaña/ventana, sin importar
    // el motivo exacto por el que había quedado en segundo plano.
    window.addEventListener('focus', cerrarMenusAlVolver)
    return () => {
      document.removeEventListener('visibilitychange', cerrarMenusAlVolver)
      window.removeEventListener('pageshow', cerrarMenusAlVolver)
      window.removeEventListener('focus', cerrarMenusAlVolver)
    }
  }, [])

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

  // 🔔 Cargar advertencias de plazo (mismo criterio que la lista de Causas)
  // ✅ Se sacó cargarAlertaData (plazo vencido/próximo) — esa cuenta ya se
  // ve en la lista de Causas, quedaba duplicada en el Centro de Alertas.

  const cargarTareas = useCallback(async () => {
    const { data } = await supabase.from('tareas').select('*').order('created_at', { ascending: false }).limit(100)
    setTareas(data || [])
  }, [])

  // 📅 Recordatorio de audiencias — hoy y mañana, para el Centro de Alertas
  const cargarAudienciasProximas = useCallback(async () => {
    const hoyStr = hoyISO()
    // "Mañana" en fecha LOCAL — se arma a mano en vez de con toISOString()
    // (que siempre da la fecha en UTC) por el mismo motivo que hoyISO().
    const mananaDate = new Date(); mananaDate.setDate(mananaDate.getDate() + 1)
    const mananaStr = `${mananaDate.getFullYear()}-${String(mananaDate.getMonth()+1).padStart(2,'0')}-${String(mananaDate.getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('audiencias').select('*').gte('fecha', hoyStr).lte('fecha', mananaStr).order('fecha', { ascending: true }).order('hora', { ascending: true })
    setAudienciasProximas(data || [])
  }, [])

  // ✅ Pedido de Joaquín — las audiencias de HOY se van "limpiando" del
  // Centro de Alertas, pero NO apenas pasa la hora de cada una (eso quedó
  // muy inmediato) — se quedan visibles TODAS hasta las 20:00 del mismo
  // día, y recién ahí se limpian todas juntas. Las de mañana nunca se
  // tocan, da igual qué hora sea hoy.
  const HORA_LIMPIEZA_AUDIENCIAS_HOY = '20:00'
  const audienciasProximasVigentes = useMemo(() => {
    const ahora = new Date()
    const hoyStr = hoyISO()
    const horaActual = `${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}`
    return audienciasProximas.filter(a => {
      if (a.fecha !== hoyStr) return true // de mañana, se deja igual
      return horaActual < HORA_LIMPIEZA_AUDIENCIAS_HOY
    })
  }, [audienciasProximas])

  // ✅ NUEVO: diligencias pendientes de causas vigentes, tipo audiencia/
  // entrevista/declaración (por palabra clave, para no depender de que el
  // texto coincida exacto con la lista oficial), con más de 5 días hábiles
  // sin respuesta — se avisa en el Centro de Alertas, sin tener que entrar
  // causa por causa a revisarlo.
  const cargarDiligenciasSinRespuesta = useCallback(async () => {
    const { data } = await supabase
      .from('diligencias_fiscalia')
      .select('id, causa_id, tipo, folio, fecha_solicitud, causas!inner(ruc, imputado, estado)')
      .eq('estado', 'pendiente')
      .eq('causas.estado', 'vigente')
    const conAviso = (data || [])
      .filter(d => /audiencia|entrevista|declaraci[oó]n/i.test(d.tipo || '') && diasHabilesDesde(d.fecha_solicitud) >= 5)
      .map(d => ({ ...d, diasHabiles: diasHabilesDesde(d.fecha_solicitud), ruc: d.causas?.ruc, imputado: d.causas?.imputado }))
      .sort((a, b) => b.diasHabiles - a.diasHabiles)
    setDiligenciasSinRespuesta(conAviso)
  }, [])

  // ✅ NUEVO: personas en Prisión Preventiva/Internación Provisoria en causas
  // vigentes — para ver de un vistazo a quién lleva más tiempo sin visita.
  // Pedido de Joaquín: a los que ya están condenados cumpliendo condena no
  // les urge la visita seguida, por eso esto se limita solo a Prisión
  // Preventiva/Internación Provisoria, no a cualquiera privado de libertad.
  // ✅ FIX: se encontró un caso real con "esta_detenido"=true pero SIN
  // ninguna cautelar registrada (dato mal cargado en una importación
  // antigua) — apareció en la alerta sin corresponder. En vez de confiar
  // en ese campo solo, ahora se cruza directo contra cautelares_causa
  // (inner join): si no hay una Prisión Preventiva/Internación Provisoria
  // realmente vigente respaldándolo, no puede aparecer en esta alerta,
  // sin importar lo que diga "esta_detenido" en ese momento.
  const [visitasPendientes, setVisitasPendientes] = useState([])
  const cargarVisitasPendientes = useCallback(async () => {
    const { data } = await supabase
      .from('imputados')
      .select('id, nombre, ultima_visita, lugar_detencion, causas!inner(ruc, estado), cautelares_causa!inner(tipo, fecha_termino)')
      .eq('causas.estado', 'vigente')
      .in('cautelares_causa.tipo', ['Prisión Preventiva', 'Internación Provisoria'])
      .is('cautelares_causa.fecha_termino', null)
    const conAviso = (data || [])
      .map(im => ({ ...im, ruc: im.causas?.ruc, diasSinVisita: im.ultima_visita ? diasEntreFechasCaut(im.ultima_visita, hoyISO()) : null }))
      // ✅ Solo se avisa de los que llevan 30+ días sin visita (o nunca
      // registrada) — igual que con Fiscalía, si se mostrara TODOS
      // (incluso a alguien visitado ayer) dejaría de servir como aviso.
      // Plazo confirmado por Joaquín en 30 días.
      .filter(im => im.diasSinVisita === null || im.diasSinVisita >= 30)
      // sin visita nunca registrada primero, después de más días a menos
      .sort((a, b) => (b.diasSinVisita ?? Infinity) - (a.diasSinVisita ?? Infinity))
    setVisitasPendientes(conAviso)
  }, [])

  const agregarTarea = useCallback(async (texto) => {
    const email = (await supabase.auth.getUser()).data.user?.email || 'usuario'
    await supabase.from('tareas').insert({ texto, creado_por: email })
    await cargarTareas()
    if (registrarActividad) registrarActividad('accion', `Encargó tarea: ${texto}`)
  }, [cargarTareas, registrarActividad])

  const completarTarea = useCallback(async (id) => {
    const email = (await supabase.auth.getUser()).data.user?.email || 'usuario'
    await supabase.from('tareas').update({ completada: true, completada_por: email, completada_en: new Date() }).eq('id', id)
    await cargarTareas()
  }, [cargarTareas])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await cargarRol(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) await cargarRol(s.user.id)
    })
    return () => { subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userRol || userRol.rol !== 'titular') return
    const cargarSolicitudes = async () => {
      const { count } = await supabase.from('solicitudes_eliminacion').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
      setSolicitudesPendientes(count || 0)
    }
    cargarSolicitudes()
    const channel = supabase.channel('solicitudes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitudes_eliminacion' }, () => {
        cargarSolicitudes()
        setSolicitudesPendientes(prev => prev + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userRol, session])

  useEffect(() => {
    if (!session) return
    cargarTareas()
    cargarAudienciasProximas()
    cargarDiligenciasSinRespuesta()
    cargarVisitasPendientes()
    const channel = supabase.channel('tareas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tareas' }, (payload) => {
        cargarTareas()
        if (payload.new.creado_por !== session?.user?.email) {
          setNotifTarea({ texto: payload.new.texto, creado_por: payload.new.creado_por })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tareas' }, () => {
        cargarTareas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audiencias' }, () => {
        cargarAudienciasProximas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diligencias_fiscalia' }, () => {
        cargarDiligenciasSinRespuesta()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'imputados' }, () => {
        cargarVisitasPendientes()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session, cargarTareas, cargarAudienciasProximas, cargarDiligenciasSinRespuesta, cargarVisitasPendientes])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FAF7F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:'#2F5D48', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 12px 32px rgba(30,41,59,0.18)' }}>⚖</div>
        <div style={{ fontFamily:"'Manrope','Inter',sans-serif", color:'#94a3b8', fontSize:13, letterSpacing:1.5, textTransform:'uppercase', fontWeight:500 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  const esTitular = userRol?.rol === 'titular'
  // ✅ Las notas/tareas ya no cuentan para el número de la campanita de
  // Alertas — se sacaron de ese panel a su propia pestaña "Notas", así que
  // ese número ahora corresponde solo a lo que de verdad se ve al abrirlo.
  const alertaTotal = audienciasProximasVigentes.length + diligenciasSinRespuesta.length + visitasPendientes.length
  const handleSignOut = async () => { await supabase.auth.signOut() }

  // ✅ Handler: desde calendario → abrir causa en Dashboard
  const handleVerCausa = (causa) => {
    setCausaDesdeCalendario(causa)
    setPagina('causas')
  }

  // 👁 Handler: desde Panel de Control → buscar causa por RUC y abrirla en Dashboard
  const irACausaPorRuc = async (ruc) => {
    if (!ruc) return
    const { data } = await supabase.from('causas').select('*').ilike('ruc', `%${ruc.replace(/\s/g,'')}%`).limit(1).maybeSingle()
    if (data) {
      setCausaDesdeCalendario(data)
      setPagina('causas')
      setShowPanel(false)
      setShowPanelPropio(false)
      setShowAlerta(false)
    }
  }

  return (
    <div className="app-shell" style={{ background:'#FAF7F0', minHeight:'100vh' }}>
      <style>{css}</style>
      {notifTarea && <TareaToast tarea={notifTarea} onClose={() => setNotifTarea(null)} />}
      {mensajeRespaldo && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border: mensajeRespaldo.ok ? '1.5px solid #bbf7d0' : '1.5px solid #fecaca', borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:420, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', fontFamily:"'Manrope','Inter',sans-serif" }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#2F5D48', lineHeight:1.5 }}>{mensajeRespaldo.texto}</div>
            <button onClick={() => setMensajeRespaldo(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:2, flexShrink:0 }}>✕</button>
          </div>
        </div>
      )}
      {mensajeSincTodo && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border: mensajeSincTodo.ok ? '1.5px solid #bbf7d0' : '1.5px solid #fecaca', borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:420, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', fontFamily:"'Manrope','Inter',sans-serif" }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#2F5D48', lineHeight:1.5 }}>{mensajeSincTodo.texto}</div>
            <button onClick={() => setMensajeSincTodo(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:2, flexShrink:0 }}>✕</button>
          </div>
        </div>
      )}
      {gmailMensaje && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border: gmailMensaje.ok ? '1.5px solid #bbf7d0' : '1.5px solid #fecaca', borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:420, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', fontFamily:"'Manrope','Inter',sans-serif" }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#2F5D48', lineHeight:1.5 }}>{gmailMensaje.texto}</div>
            <button onClick={() => setGmailMensaje(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:2, flexShrink:0 }}>✕</button>
          </div>
        </div>
      )}
      {showPanel && <PanelActividad onClose={() => { setShowPanel(false); setSolicitudesPendientes(0) }} onVerCausa={irACausaPorRuc} />}
      {showPanelPropio && <PanelActividad onClose={() => setShowPanelPropio(false)} onVerCausa={irACausaPorRuc} soloEmail={session.user.email} />}
      {showAlerta && (
        <PanelAlertas
          onClose={() => setShowAlerta(false)}
          esTitular={esTitular}
          audienciasProximas={audienciasProximasVigentes}
          diligenciasSinRespuesta={diligenciasSinRespuesta}
          visitasPendientes={visitasPendientes}
          onVerCausa={irACausaPorRuc}
          session={session}
          registrarActividad={registrarActividad}
        />
      )}

      <nav className="app-nav" style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, order:1 }}>
          <JoaShield height={36} compact />
          <div>
            <div style={{ fontFamily:"'EB Garamond',serif", fontSize:16, fontWeight:600, color:'#2F5D48', letterSpacing:'-0.3px' }}>Obregón y Asociados</div>
            <div className="app-logo-sub" style={{ fontSize:9, color:'#8A7D55', letterSpacing:2, textTransform:'uppercase', fontWeight:500, marginTop:0 }}>Gestión Penal</div>
          </div>
        </div>
        <div className="app-navlinks" style={{ display:'flex', gap:4, background:'#FAF7F0', padding:'4px', borderRadius:12, border:'1px solid #E2E8F0', order:2 }}>
          {[{id:'causas',label:'Causas'},{id:'calendario',label:'Calendario'},{id:'escritos',label:'Escritos'},{id:'notas',label:'Notas'},{id:'codigos',label:'Códigos y Leyes'}].map(item => (
            <button key={item.id} className={`nav-link${pagina===item.id?' active':''}`} onClick={() => setPagina(item.id)}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, order:3, flexShrink:0 }}>
          {(!online || pendientes > 0) && (
            <div title={!online ? 'Sin conexión — se sigue trabajando igual, se manda todo solo apenas vuelva la señal' : `${pendientes} cambio(s) esperando para enviarse`}
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'5px 11px', borderRadius:20, fontFamily:"'Manrope','Inter',sans-serif",
                background: !online ? '#fef2f2' : '#fffbeb', color: !online ? '#dc2626' : '#92400e' }}>
              {!online ? '📴 Sin conexión' : `🔄 ${pendientes} por enviar`}
            </div>
          )}
          <button onClick={() => setShowAlerta(true)} className={alertaTotal > 0 ? 'alerta-btn-active' : 'alerta-btn'}>
            🔔 Alerta
            {alertaTotal > 0 && (
              <span style={{ background:'#fff', color:'#dc2626', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{alertaTotal}</span>
            )}
          </button>
          <div style={{ position:'relative' }}>
            <div onClick={() => setShowUserMenu(v => !v)} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'4px 8px', borderRadius:10, background: showUserMenu ? '#FAF7F0' : 'transparent', transition:'background 0.15s' }}>
              <div style={{ width:29, height:29, borderRadius:'50%', background: esTitular ? '#2F5D48' : '#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>{session.user.email?.[0]?.toUpperCase()}</div>
              <span className='nav-nombre' style={{ fontSize:12, color:'#64748b', fontFamily:"'Manrope','Inter',sans-serif" }}>{userRol?.nombre || session.user.email}</span>
              <span style={{ fontSize:10, color:'#94a3b8', transform: showUserMenu?'rotate(180deg)':'none', transition:'transform 0.15s' }}>▾</span>
            </div>
            {showUserMenu && (
              <>
                <div onClick={() => setShowUserMenu(false)} style={{ position:'fixed', inset:0, zIndex:150 }}/>
                <div style={isMobile
                  // En celular, el menú se ancla a la ventana (no al botón) para que nunca
                  // se salga de la pantalla, sin importar dónde quede el botón "J".
                  ? { position:'fixed', top:56, right:12, left:12, background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, boxShadow:'0 12px 32px rgba(15,23,42,0.14)', zIndex:151, overflow:'hidden', fontFamily:"'Manrope','Inter',sans-serif" }
                  : { position:'absolute', top:'calc(100% + 8px)', right:0, background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, boxShadow:'0 12px 32px rgba(15,23,42,0.14)', minWidth:200, zIndex:151, overflow:'hidden', fontFamily:"'Manrope','Inter',sans-serif" }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #F1F5F9' }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, padding:'4px 12px', borderRadius:20, background: esTitular ? '#2F5D48' : '#F1F5F9', color: esTitular ? '#fff' : '#64748b', border: esTitular ? 'none' : '1px solid #E2E8F0' }}>
                      {esTitular ? '⚖ Titular' : '👤 Asistente'}
                    </span>
                  </div>
                  {esTitular ? (
                    <button onClick={() => { setShowUserMenu(false); setShowPanel(true) }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'12px 16px', fontSize:13, cursor:'pointer', color: solicitudesPendientes > 0 ? '#dc2626' : '#374151', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3 }}>
                      <span>👁 Control</span>
                      {solicitudesPendientes > 0 && (
                        <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{solicitudesPendientes}</span>
                      )}
                    </button>
                  ) : (
                    // ✅ NUEVO: el asistente no ve el Panel de Control del titular,
                    // pero sí puede ver su propio avance del día — pensado para
                    // que sepa en qué causas trabajó, con acceso directo a cada una.
                    <button onClick={() => { setShowUserMenu(false); setShowPanelPropio(true) }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'12px 16px', fontSize:13, cursor:'pointer', color:'#374151', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3 }}>
                      📋 Mi actividad
                    </button>
                  )}
                  <button onClick={() => { setShowUserMenu(false); setPagina('causas'); setShowStatsCausas(v => !v) }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor:'pointer', color: showStatsCausas ? '#2563eb' : '#374151', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3 }}>
                    📊 Estadísticas
                  </button>
                  {esTitular && (
                    <button onClick={() => { setShowUserMenu(false); setPagina('contabilidad') }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor:'pointer', color:'#374151', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3 }}>
                      💰 Contabilidad
                    </button>
                  )}
                  {esTitular && (
                    // 💾 Respaldo manual: descarga un Excel con toda la info de la
                    // app (causas, imputados, audiencias, honorarios, etc.) y de
                    // paso lo sube a OneDrive — dos copias fuera de la base de
                    // datos misma, para no depender solo de ella.
                    <button onClick={() => { setShowUserMenu(false); handleGenerarRespaldo() }} disabled={generandoRespaldo} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor: generandoRespaldo ? 'default' : 'pointer', color:'#374151', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3, opacity: generandoRespaldo ? 0.6 : 1 }}>
                      💾 {generandoRespaldo ? (progresoRespaldo || 'Generando...') : 'Generar respaldo'}
                    </button>
                  )}
                  {esTitular && (
                    // 📤 Recorre TODAS las causas y deja al día en OneDrive los
                    // documentos y el resumen de cada una — para no depender de
                    // haberlas abierto antes (ver openCausa en Dashboard.jsx,
                    // que hace lo mismo pero solo con la causa que se abre).
                    <button onClick={() => { setShowUserMenu(false); handleSincronizarTodo() }} disabled={sincronizandoTodo} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor: sincronizandoTodo ? 'default' : 'pointer', color:'#374151', fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3, opacity: sincronizandoTodo ? 0.6 : 1 }}>
                      📤 {sincronizandoTodo ? (progresoSincTodo || 'Sincronizando...') : 'Sincronizar todo con OneDrive'}
                    </button>
                  )}
                  <button onClick={handleSignOut} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor:'pointer', color:'#dc2626', fontWeight:600, fontFamily:"'Manrope','Inter',sans-serif", textTransform:'uppercase', letterSpacing:0.3 }}>
                    ⏻ Salir
                  </button>
                </div>
              </>
            )}
          </div>
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
            showStats={showStatsCausas}
            setShowStats={setShowStatsCausas}
          />
        )}
        {/* ✅ Calendario recibe onVerCausa para navegar */}
        {pagina === 'calendario' && (
          <Calendario onVerCausa={handleVerCausa} abrirGmailAlEntrar={abrirGmailAlEntrar} />
        )}
        {pagina === 'escritos' && (
          <Escritos session={session} registrarActividad={registrarActividad} />
        )}
        {pagina === 'notas' && (
          <Notas tareas={tareas} esTitular={esTitular} onAgregarTarea={agregarTarea} onCompletarTarea={completarTarea} />
        )}
        {pagina === 'codigos' && (
          <CodigosLeyes />
        )}
        {pagina === 'contabilidad' && esTitular && (
          <Contabilidad />
        )}
      </div>
    </div>
  )
}
