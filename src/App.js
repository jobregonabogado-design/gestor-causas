import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calendario from './pages/Calendario'
import Escritos from './pages/Escritos'
import CodigosLeyes from './pages/CodigosLeyes'
import Contabilidad from './pages/Contabilidad'

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
  .alerta-btn { background:#fff; border:1.5px solid #E2E8F0; color:#64748b; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s; font-family:'Inter',sans-serif; }
  .alerta-btn:hover { border-color:#dc2626; color:#dc2626; background:#fef2f2; }
  .alerta-btn-active { background:#dc2626; border:1.5px solid #dc2626; color:#fff; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-family:'Inter',sans-serif; animation:alertaPulse 1.4s infinite; }
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

const f = { fontFamily:"'Inter',sans-serif" }

// ─── Helpers de plazo (mismo criterio que Dashboard) ─────────────────────────
function parseFechaCL(str) {
  if (!str) return null
  const limpio = str.replace(/VENCE\s*/i, '').trim()
  const partes = limpio.split(/[\/\-\.]/)
  if (partes.length < 3) return null
  const [d, m, a] = partes
  const fecha = new Date(`${a.length===2?'20'+a:a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
  return isNaN(fecha) ? null : fecha
}
function diasRestantes(plazoStr) {
  const fecha = parseFechaCL(plazoStr)
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  return Math.ceil((fecha - hoy) / (1000*60*60*24))
}

function PanelActividad({ onClose, onVerCausa }) {
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
    // 🔎 Solo interesa qué se hizo (acción), no ingresos/salidas de sesión
    const { data } = await supabase.from('actividad_usuario').select('*').eq('tipo', 'accion').gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(150)
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
      <div style={{ position:'relative', width:520, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-16px 0 48px rgba(15,23,42,0.12)', animation:'slideIn 0.3s ease', fontFamily:"'Inter',sans-serif" }}>
        <div style={{ background:'#1E293B', padding:'24px 24px 20px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>👁 Panel de Control</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>Qué hizo el equipo — solo visible para el titular</div>
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
          {Object.entries(stats).map(([email, cantidad]) => {
            const actividadUsuario = actividad.filter(a => a.email === email)
            return (
              <div key={email} style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, marginBottom:12, overflow:'hidden', boxShadow:'0 4px 16px rgba(15,23,42,0.04)' }}>
                <div onClick={() => setUsuarioExpandido(prev => prev === email ? null : email)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background: usuarioExpandido===email ? '#F8F9FC' : '#fff', transition:'background 0.2s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#1E293B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700 }}>{email[0]?.toUpperCase()}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>{email}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#1E293B', background:'#F1F5F9', padding:'2px 10px', borderRadius:20 }}>📝 {cantidad} acción{cantidad>1?'es':''}</span>
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
                            <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{a.descripcion}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{new Date(a.created_at).toLocaleString('es-CL')}</div>
                          </div>
                          {ruc && onVerCausa && (
                            <button onClick={() => onVerCausa(ruc)} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#1e40af', cursor:'pointer', fontWeight:600, flexShrink:0, fontFamily:"'Inter',sans-serif" }}>→ Ver causa</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:600, marginBottom:10 }}>Registro de acciones</div>
          {loading ? (
            <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>Cargando...</div>
          ) : actividad.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'#cbd5e1', fontSize:13 }}>Sin acciones registradas en este período</div>
          ) : actividad.map(a => {
            const ruc = extraerRuc(a.descripcion)
            return (
              <div key={a.id} style={{ display:'flex', gap:10, padding:'10px 12px', borderBottom:'1px solid #F1F5F9', alignItems:'center' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>📝</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{a.descripcion}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{a.email} · {new Date(a.created_at).toLocaleString('es-CL')}</div>
                </div>
                {ruc && onVerCausa && (
                  <button onClick={() => onVerCausa(ruc)} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#1e40af', cursor:'pointer', fontWeight:600, flexShrink:0, fontFamily:"'Inter',sans-serif" }}>→ Ver causa</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PanelAlertas({ onClose, esTitular, alertaCounts, tareas, audienciasProximas, onVerCausa, onAgregarTarea, onCompletarTarea }) {
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [guardando, setGuardando] = useState(false)

  const pendientes = tareas.filter(t => !t.completada)
  const completadas = tareas.filter(t => t.completada)
  const hoyStr = new Date().toISOString().slice(0,10)

  const handleAgregar = async () => {
    if (!nuevaTarea.trim()) return
    setGuardando(true)
    await onAgregarTarea(nuevaTarea.trim())
    setNuevaTarea('')
    setGuardando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.35)', backdropFilter:'blur(2px)' }} onClick={onClose}/>
      <div style={{ position:'relative', width:480, background:'#fff', height:'100vh', overflowY:'auto', boxShadow:'-16px 0 48px rgba(15,23,42,0.12)', animation:'slideIn 0.3s ease', fontFamily:"'Inter',sans-serif" }}>
        <div style={{ background:'#dc2626', padding:'24px 24px 20px', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>🔔 Centro de Alertas</div>
              <div style={{ fontSize:11, color:'#fecaca', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>Advertencias y tareas del equipo</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:10, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:13 }}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ padding:20 }}>
          {/* Audiencias próximas (hoy / mañana) */}
          {audienciasProximas.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:10, ...f }}>Audiencias próximas</div>
              {audienciasProximas.map(a => {
                const esHoy = a.fecha === hoyStr
                return (
                  <div key={a.id} style={{ display:'flex', gap:10, alignItems:'center', background: esHoy?'#eff6ff':'#F8F9FC', border:`1px solid ${esHoy?'#bfdbfe':'#e2e8f0'}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:800, color: esHoy?'#1e40af':'#64748b', background: esHoy?'#dbeafe':'#F1F5F9', borderRadius:8, padding:'4px 8px', flexShrink:0, whiteSpace:'nowrap', ...f }}>{esHoy?'HOY':'MAÑANA'}{a.hora?' · '+a.hora:''}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1E293B', ...f }}>{a.tipo || 'Audiencia'}{a.imputado?' · '+a.imputado:''}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>{a.tribunal || '—'}{a.sala?' · Sala '+a.sala:''}</div>
                    </div>
                    {a.ruc && onVerCausa && (
                      <button onClick={()=>onVerCausa(a.ruc)} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#1e40af', cursor:'pointer', fontWeight:600, flexShrink:0, fontFamily:"'Inter',sans-serif" }}>→ Ver causa</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Advertencias del sistema */}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:10, ...f }}>Advertencias del sistema</div>
          {alertaCounts.vencido === 0 && alertaCounts.proximo === 0 ? (
            <div style={{ background:'#ecfdf5', border:'1.5px solid #a7f3d0', borderRadius:12, padding:'14px 16px', marginBottom:24, fontSize:13, color:'#065f46', fontWeight:600, ...f }}>✓ Todas las causas vigentes están al día</div>
          ) : (
            <div style={{ marginBottom:24 }}>
              {alertaCounts.vencido > 0 && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderLeft:'4px solid #991b1b', borderRadius:10, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{fontSize:16, flexShrink:0}}>⚠</span>
                  <span style={{fontSize:13, color:'#991b1b', fontWeight:600, ...f}}>{alertaCounts.vencido} causa{alertaCounts.vencido>1?'s':''} con plazo vencido — revisión urgente</span>
                </div>
              )}
              {alertaCounts.proximo > 0 && (
                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderLeft:'4px solid #92400e', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{fontSize:16, flexShrink:0}}>⏱</span>
                  <span style={{fontSize:13, color:'#92400e', fontWeight:600, ...f}}>{alertaCounts.proximo} causa{alertaCounts.proximo>1?'s':''} por vencer en los próximos 3 días</span>
                </div>
              )}
            </div>
          )}

          {/* Tareas pendientes */}
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:10, ...f }}>Tareas pendientes ({pendientes.length})</div>

          {esTitular && (
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <input
                value={nuevaTarea}
                onChange={e=>setNuevaTarea(e.target.value)}
                placeholder="Encargar algo al equipo..."
                onKeyDown={e=>{ if(e.key==='Enter') handleAgregar() }}
                style={{ flex:1, padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:"'Inter',sans-serif", color:'#1E293B' }}/>
              <button onClick={handleAgregar} disabled={guardando||!nuevaTarea.trim()} style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", flexShrink:0 }}>{guardando?'...':'+ Agregar'}</button>
            </div>
          )}

          {pendientes.length === 0 ? (
            <div style={{ fontSize:12, color:'#cbd5e1', textAlign:'center', padding:'16px 0', ...f }}>Sin tareas pendientes.</div>
          ) : pendientes.map(t => (
            <div key={t.id} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
              <button onClick={()=>onCompletarTarea(t.id)} title="Marcar como realizada"
                style={{ width:20, height:20, borderRadius:6, border:'1.5px solid #d97706', background:'#fff', cursor:'pointer', flexShrink:0, marginTop:1, padding:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1E293B', ...f }}>{t.texto}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:3, ...f }}>Encargado por {t.creado_por} · {new Date(t.created_at).toLocaleString('es-CL')}</div>
              </div>
            </div>
          ))}

          {completadas.length > 0 && (
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:10, ...f }}>Completadas ({completadas.length})</div>
              {completadas.map(t => (
                <div key={t.id} style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#F8F9FC', border:'1px solid #E2E8F0', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                  <span style={{ fontSize:14, color:'#059669', marginTop:1, flexShrink:0 }}>✓</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:'#94a3b8', textDecoration:'line-through', ...f }}>{t.texto}</div>
                    <div style={{ fontSize:11, color:'#cbd5e1', marginTop:3, ...f }}>Realizada por {t.completada_por || '—'} · {t.completada_en ? new Date(t.completada_en).toLocaleString('es-CL') : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:2000, background:'#fff', border:'1.5px solid #fecaca', borderRadius:14, padding:'14px 18px', minWidth:300, maxWidth:380, boxShadow:'0 16px 40px rgba(15,23,42,0.14)', animation:'slideIn 0.3s ease', fontFamily:"'Inter',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:22 }}>🔔</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#991b1b' }}>Nueva tarea encargada</div>
            <div style={{ fontSize:12, color:'#1E293B', marginTop:2, fontWeight:500 }}>{tarea.texto}</div>
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
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  // ✅ Estado para causa seleccionada desde el calendario
  const [causaDesdeCalendario, setCausaDesdeCalendario] = useState(null)
  // 🔔 Estado del Centro de Alertas (advertencias + tareas del equipo)
  const [showAlerta, setShowAlerta] = useState(false)
  const [tareas, setTareas] = useState([])
  const [alertaCounts, setAlertaCounts] = useState({ vencido: 0, proximo: 0 })
  const [audienciasProximas, setAudienciasProximas] = useState([])
  const [notifTarea, setNotifTarea] = useState(null)

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
  const cargarAlertaData = useCallback(async () => {
    const { data } = await supabase.from('causas').select('plazo').eq('estado', 'vigente')
    let vencido = 0, proximo = 0
    ;(data || []).forEach(c => {
      const diff = diasRestantes(c.plazo)
      if (diff === null) return
      if (diff < 0) vencido++
      else if (diff <= 3) proximo++
    })
    setAlertaCounts({ vencido, proximo })
  }, [])

  const cargarTareas = useCallback(async () => {
    const { data } = await supabase.from('tareas').select('*').order('created_at', { ascending: false }).limit(100)
    setTareas(data || [])
  }, [])

  // 📅 Recordatorio de audiencias — hoy y mañana, para el Centro de Alertas
  const cargarAudienciasProximas = useCallback(async () => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
    const fmt = (d) => d.toISOString().slice(0,10)
    const { data } = await supabase.from('audiencias').select('*').gte('fecha', fmt(hoy)).lte('fecha', fmt(manana)).order('fecha', { ascending: true }).order('hora', { ascending: true })
    setAudienciasProximas(data || [])
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
    cargarAlertaData()
    cargarTareas()
    cargarAudienciasProximas()
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'causas' }, () => {
        cargarAlertaData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audiencias' }, () => {
        cargarAudienciasProximas()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session, cargarAlertaData, cargarTareas, cargarAudienciasProximas])

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
  const tareasPendientesCount = tareas.filter(t => !t.completada).length
  const alertaTotal = alertaCounts.vencido + alertaCounts.proximo + tareasPendientesCount + audienciasProximas.length
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
      setShowAlerta(false)
    }
  }

  return (
    <div style={{ background:'#F8F9FC', minHeight:'100vh' }}>
      <style>{css}</style>
      {notifTarea && <TareaToast tarea={notifTarea} onClose={() => setNotifTarea(null)} />}
      {showPanel && <PanelActividad onClose={() => { setShowPanel(false); setSolicitudesPendientes(0) }} onVerCausa={irACausaPorRuc} />}
      {showAlerta && (
        <PanelAlertas
          onClose={() => setShowAlerta(false)}
          esTitular={esTitular}
          alertaCounts={alertaCounts}
          tareas={tareas}
          audienciasProximas={audienciasProximas}
          onVerCausa={irACausaPorRuc}
          onAgregarTarea={agregarTarea}
          onCompletarTarea={completarTarea}
        />
      )}

      <nav className="app-nav" style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid #E2E8F0', padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, order:1 }}>
          <div style={{ width:36, height:36, background:'#1E293B', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 6px 16px rgba(30,41,59,0.2)', flexShrink:0 }}>⚖</div>
          <div>
            <div style={{ fontFamily:'Inter,sans-serif', fontSize:15, fontWeight:800, color:'#1E293B', letterSpacing:'-0.5px' }}>LexOffice</div>
            <div className="app-logo-sub" style={{ fontSize:9, color:'#94a3b8', letterSpacing:2, textTransform:'uppercase', fontWeight:500, marginTop:-1 }}>Gestión Penal</div>
          </div>
        </div>
        <div className="app-navlinks" style={{ display:'flex', gap:4, background:'#F8F9FC', padding:'4px', borderRadius:12, border:'1px solid #E2E8F0', order:2 }}>
          {[{id:'causas',label:'Causas'},{id:'calendario',label:'Calendario'},{id:'escritos',label:'Escritos'},{id:'codigos',label:'Códigos y Leyes'}].map(item => (
            <button key={item.id} className={`nav-link${pagina===item.id?' active':''}`} onClick={() => setPagina(item.id)}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, order:3, flexShrink:0 }}>
          <button onClick={() => setShowAlerta(true)} className={alertaTotal > 0 ? 'alerta-btn-active' : 'alerta-btn'}>
            🔔 Alerta
            {alertaTotal > 0 && (
              <span style={{ background:'#fff', color:'#dc2626', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{alertaTotal}</span>
            )}
          </button>
          <div style={{ position:'relative' }}>
            <div onClick={() => setShowUserMenu(v => !v)} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'4px 8px', borderRadius:10, background: showUserMenu ? '#F8F9FC' : 'transparent', transition:'background 0.15s' }}>
              <div style={{ width:29, height:29, borderRadius:'50%', background: esTitular ? '#1E293B' : '#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>{session.user.email?.[0]?.toUpperCase()}</div>
              <span className='nav-nombre' style={{ fontSize:12, color:'#64748b', fontFamily:'Inter,sans-serif' }}>{userRol?.nombre || session.user.email}</span>
              <span style={{ fontSize:10, color:'#94a3b8', transform: showUserMenu?'rotate(180deg)':'none', transition:'transform 0.15s' }}>▾</span>
            </div>
            {showUserMenu && (
              <>
                <div onClick={() => setShowUserMenu(false)} style={{ position:'fixed', inset:0, zIndex:150 }}/>
                <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, boxShadow:'0 12px 32px rgba(15,23,42,0.14)', minWidth:200, zIndex:151, overflow:'hidden', fontFamily:"'Inter',sans-serif" }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #F1F5F9' }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, padding:'4px 12px', borderRadius:20, background: esTitular ? '#1E293B' : '#F1F5F9', color: esTitular ? '#fff' : '#64748b', border: esTitular ? 'none' : '1px solid #E2E8F0' }}>
                      {esTitular ? '⚖ Titular' : '👤 Asistente'}
                    </span>
                  </div>
                  {esTitular && (
                    <button onClick={() => { setShowUserMenu(false); setShowPanel(true) }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'12px 16px', fontSize:13, cursor:'pointer', color: solicitudesPendientes > 0 ? '#dc2626' : '#374151', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:"'Inter',sans-serif" }}>
                      <span>👁 Control</span>
                      {solicitudesPendientes > 0 && (
                        <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{solicitudesPendientes}</span>
                      )}
                    </button>
                  )}
                  {esTitular && (
                    <button onClick={() => { setShowUserMenu(false); setPagina('contabilidad') }} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor:'pointer', color:'#374151', fontFamily:"'Inter',sans-serif" }}>
                      💰 Contabilidad
                    </button>
                  )}
                  <button onClick={handleSignOut} style={{ width:'100%', textAlign:'left', background:'none', border:'none', borderTop:'1px solid #F1F5F9', padding:'12px 16px', fontSize:13, cursor:'pointer', color:'#dc2626', fontWeight:600, fontFamily:"'Inter',sans-serif" }}>
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
          />
        )}
        {/* ✅ Calendario recibe onVerCausa para navegar */}
        {pagina === 'calendario' && (
          <Calendario onVerCausa={handleVerCausa} />
        )}
        {pagina === 'escritos' && (
          <Escritos session={session} registrarActividad={registrarActividad} />
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
