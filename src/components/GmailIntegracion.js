import { useState, useEffect } from 'react'
import { loginGmail, isGmailConnected, logoutGmail, fetchNotificacionesPJUD, exchangeCodeForToken } from '../lib/gmail'
import { supabase } from '../lib/supabase'

const f = { fontFamily:"'Inter',sans-serif" }

export default function GmailIntegracion({ onImportComplete }) {
  const [conectado, setConectado] = useState(isGmailConnected())
  const [cargando, setCargando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [agregados, setAgregados] = useState([])
  const [errores, setErrores] = useState([])
  const [sinCausa, setSinCausa] = useState([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === '1') {
      const code = localStorage.getItem('gmail_auth_code')
      if (code) {
        setCargando(true)
        exchangeCodeForToken(code).then(ok => {
          if (ok) { setConectado(true); localStorage.removeItem('gmail_auth_code') }
          setCargando(false)
          window.history.replaceState({}, '', window.location.pathname)
        })
      }
    }
  }, [])

  const revisarCorreos = async () => {
    setCargando(true)
    setAgregados([])
    setErrores([])
    setSinCausa([])

    try {
      // 1. Obtener causas vigentes PRIMERO — solo procesamos correos de estas
      const { data: causasVigentes } = await supabase
        .from('causas')
        .select('id, ruc, rit, imputado, tribunal, estado')
        .eq('estado', 'vigente')

      if (!causasVigentes || causasVigentes.length === 0) {
        setCargando(false)
        setProcesando(false)
        return
      }

      // Construir set de RUC vigentes para filtrado rápido
      const rucsVigentes = new Set(
        causasVigentes.map(c => c.ruc?.replace(/[\s\-]/g, '').toLowerCase())
      )

      // 2. Obtener notificaciones de Gmail — solo leer correos de causas vigentes
      const todasNotificaciones = await fetchNotificacionesPJUD()

      // Filtrar: solo procesar correos cuyo RUC esté en causas vigentes
      const notificaciones = todasNotificaciones.filter(n => {
        const rucNorm = n.ruc?.replace(/[\s\-]/g, '').toLowerCase()
        return rucsVigentes.has(rucNorm)
      })

      // 3. Corroborar contra lo que ya existe (RUC+fecha+tipo+HORA — la sala
      // se deja fuera de la comparación porque a veces se lee con espacios o
      // formato levemente distinto entre una revisión y otra, y generaba
      // duplicados de sobra aunque la hora fuera exactamente la misma).
      // - Si ya existe exactamente lo mismo → no se toca.
      // - Si existe algo para ese RUC+fecha+tipo pero con OTRA hora → es una
      //   inconsistencia real (alguien la agregó manual o el correo cambió
      //   de opinión) y queda marcada para que la revises tú.
      const { data: audienciasExistentes } = await supabase
        .from('audiencias')
        .select('id, ruc, fecha, tipo, hora, sala')

      const normalizarParaClave = (v) => (v || '').toString().trim().toLowerCase()
      const normalizarRuc = (ruc) => ruc?.replace(/[\s\-]/g, '').toLowerCase() || ''

      // ✅ FIX: antes esto usaba `a.ruc` tal cual (con guión, ej "1801167745-9")
      // mientras que el RUC de los correos se normaliza sin guión. Como nunca
      // calzaban, el sistema nunca reconocía nada como "ya existente" y volvía
      // a insertar todo de nuevo cada vez que se revisaban los correos.
      const claveExistente = new Set(
        (audienciasExistentes || []).map(a => `${normalizarRuc(a.ruc)}-${a.fecha}-${normalizarParaClave(a.tipo)}-${normalizarParaClave(a.hora)}`)
      )
      // Agrupadas solo por RUC+fecha+tipo (sin hora), para detectar inconsistencias
      const clavesBaseExistentes = new Map()
      ;(audienciasExistentes || []).forEach(a => {
        const claveBase = `${normalizarRuc(a.ruc)}-${a.fecha}-${normalizarParaClave(a.tipo)}`
        if (!clavesBaseExistentes.has(claveBase)) clavesBaseExistentes.set(claveBase, [])
        clavesBaseExistentes.get(claveBase).push(a)
      })

      const clavesProcesadas = new Set()

      // Mapa con RUC normalizado
      const causasPorRucNorm = {}
      ;(causasVigentes || []).forEach(c => {
        causasPorRucNorm[normalizarRuc(c.ruc)] = c
      })

      // Con el filtro previo, todas las notificaciones tienen causa vigente
      // sinCausaVigente ya no aplica — lo dejamos vacío

      const nuevosAgregados = []
      const nuevosErrores = []
      const sinCausaVigente = []
      const sinCausaVistos = new Set()

      setProcesando(true)

      for (const n of notificaciones) {
        const rucLimpio = n.ruc?.replace(/\s/g, '')
        const rucNorm = normalizarRuc(rucLimpio)
        const causa = causasPorRucNorm[rucNorm]

        // Sin causa vigente
        if (!causa) {
          if (!sinCausaVistos.has(rucNorm)) {
            sinCausaVistos.add(rucNorm)
            sinCausaVigente.push(n)
          }
          continue
        }

        // Sin audiencia detectada
        if (!n.audiencia?.fecha) {
          const claveErr = `${rucNorm}-sin-fecha`
          if (!clavesProcesadas.has(claveErr)) {
            clavesProcesadas.add(claveErr)
            nuevosErrores.push({ ...n, motivo: 'No se detectó fecha de audiencia en el correo' })
          }
          continue
        }

        // Corroborar: clave con fecha+tipo+HORA (sin sala, por el motivo de arriba).
        // Si ya existe exactamente esto, no se toca. Si no, se agrega — y si
        // había algo distinto para el mismo RUC/fecha/tipo, se marca como
        // inconsistencia para que la revises tú.
        const clave = `${rucNorm}-${n.audiencia.fecha}-${normalizarParaClave(n.audiencia.tipo)}-${normalizarParaClave(n.audiencia.hora)}`
        if (claveExistente.has(clave) || clavesProcesadas.has(clave)) continue
        clavesProcesadas.add(clave)

        // ¿Ya existía algo con este mismo RUC+fecha+tipo, pero otra hora?
        // Si es así, es una inconsistencia real que hay que revisar a mano.
        const claveBase = `${rucNorm}-${n.audiencia.fecha}-${normalizarParaClave(n.audiencia.tipo)}`
        const posiblesAnteriores = clavesBaseExistentes.get(claveBase) || []
        const notaCorreccion = posiblesAnteriores.length > 0
          ? `⚠ INCONSISTENCIA: ya existía(n) ${posiblesAnteriores.length} audiencia(s) para este RUC/fecha/tipo con hora "${posiblesAnteriores.map(a=>a.hora||'—').join(', ')}". Esta se agregó con hora "${n.audiencia.hora||'—'}". Revisa cuál es la correcta y elimina la que sobre.\n`
          : ''

        // ✅ FIX: incluye imputado y tribunal con fallback desde la causa
        const { data, error } = await supabase.from('audiencias').insert({
          causa_id: causa.id,
          ruc: rucLimpio || causa.ruc,
          rit: n.rit || causa.rit || '',
          fecha: n.audiencia.fecha,
          hora: n.audiencia.hora || '',
          tipo: n.audiencia.tipo || 'AUDIENCIA',
          tribunal: n.audiencia.tribunal || causa.tribunal || '',
          sala: n.audiencia.sala || '',
          imputado: causa.imputado || '',
          resultado: '',
          notas: `${notaCorreccion}Importado automáticamente desde correo ${n.tipo}\nAsunto: ${n.asunto}\nFecha correo: ${new Date(n.fecha_correo).toLocaleDateString('es-CL')}`,
        }).select().single()

        if (!error && data) {
          claveExistente.add(clave)
          nuevosAgregados.push({
            id: data.id,
            ruc: rucLimpio,
            imputado: causa.imputado,
            tipo: n.audiencia.tipo,
            fecha: n.audiencia.fecha,
            hora: n.audiencia.hora,
            tribunal: n.audiencia.tribunal || causa.tribunal,
            asunto: n.asunto,
            origen: n.tipo,
            esPosibleCorreccion: posiblesAnteriores.length > 0,
          })
        } else if (error) {
          nuevosErrores.push({ ...n, motivo: error.message })
        }
      }

      setAgregados(nuevosAgregados)
      setErrores(nuevosErrores)
      setSinCausa(sinCausaVigente)

      // ✅ Notificar al calendario para que recargue
      if (onImportComplete && nuevosAgregados.length > 0) {
        onImportComplete()
      }

    } catch (e) {
      setErrores([{ asunto: 'Error general', motivo: e.message }])
    }

    setCargando(false)
    setProcesando(false)
  }

  const eliminarAudiencia = async (item) => {
    if (!window.confirm(`¿Eliminar audiencia ${item.tipo} del ${item.fecha}?`)) return
    await supabase.from('audiencias').delete().eq('id', item.id)
    setAgregados(prev => prev.filter(x => x.id !== item.id))
  }

  if (!conectado) return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:32, textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📧</div>
      <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:8, ...f }}>Conectar Gmail</div>
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:24, maxWidth:400, margin:'0 auto 24px', lineHeight:1.7, ...f }}>
        Conecta tu correo para importar automáticamente las audiencias notificadas por el PJUD y la Fiscalía.
      </div>
      {cargando ? (
        <div style={{ fontSize:13, color:'#94a3b8', ...f }}>Conectando...</div>
      ) : (
        <button onClick={loginGmail} style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 14px rgba(37,99,235,0.3)', ...f }}>
          🔗 Conectar con Google
        </button>
      )}
    </div>
  )

  const hayResultados = agregados.length > 0 || errores.length > 0 || sinCausa.length > 0

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:28 }}>

      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', ...f }}>📧 Gmail conectado</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, ...f }}>Importación automática desde PJUD y Fiscalía</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={revisarCorreos} disabled={cargando || procesando}
            style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(37,99,235,0.25)', ...f }}>
            {cargando ? '⏳ Revisando...' : '🔄 Revisar correos'}
          </button>
          <button onClick={() => { logoutGmail(); setConectado(false) }}
            style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#94a3b8', cursor:'pointer', ...f }}>
            Desconectar
          </button>
        </div>
      </div>

      {/* LOADING */}
      {(cargando || procesando) && (
        <div style={{ background:'#f0f7ff', border:'1px solid #bfdbfe', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:20, height:20, border:'2px solid #2563eb', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <span style={{ fontSize:13, color:'#2563eb', fontWeight:500, ...f }}>Leyendo correos y procesando audiencias automáticamente...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ESTADO INICIAL */}
      {!hayResultados && !cargando && (
        <div style={{ textAlign:'center', padding:'40px 20px', background:'#f8fafc', borderRadius:12, border:'1.5px dashed #e2e8f0' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13, color:'#94a3b8', ...f }}>Haz clic en "Revisar correos" para importar automáticamente las audiencias notificadas</div>
        </div>
      )}

      {/* BANNER: AUDIENCIAS AGREGADAS */}
      {agregados.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #a7f3d0', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#10b981,#059669)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✅</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#065f46', ...f }}>
                {agregados.length} audiencia{agregados.length > 1 ? 's' : ''} agregada{agregados.length > 1 ? 's' : ''} automáticamente
              </div>
              <div style={{ fontSize:11, color:'#059669', ...f }}>Revisa que los datos sean correctos. Si hay un error, puedes eliminarla.</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {agregados.map((item, i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #a7f3d0', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontWeight:700, background: item.origen==='PJUD'?'#eff6ff':'#faf5ff', color: item.origen==='PJUD'?'#2563eb':'#7c3aed', border:`1px solid ${item.origen==='PJUD'?'#bfdbfe':'#ddd6fe'}`, padding:'2px 8px', borderRadius:20, textTransform:'uppercase', ...f }}>{item.origen}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:'#0f172a', ...f }}>{item.tipo}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', ...f }}>
                    RUC <span style={{ fontFamily:'monospace', fontWeight:600, color:'#0f172a' }}>{item.ruc}</span>
                    {item.imputado && <span style={{ marginLeft:8 }}>· {item.imputado.split('|')[0]}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#059669', fontWeight:500, marginTop:4, ...f }}>
                    📅 {item.fecha}{item.hora ? ` · 🕐 ${item.hora}` : ''}{item.tribunal ? ` · 🏛 ${item.tribunal?.substring(0,30)}` : ''}
                  </div>
                  {item.esPosibleCorreccion && (
                    <div style={{ fontSize:11, color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:7, padding:'4px 8px', marginTop:6, fontWeight:600, ...f }}>
                      ⚠ INCONSISTENCIA: ya existía otra audiencia para este mismo RUC/fecha/tipo con otra hora — revisa cuál es la correcta y elimina la que sobre.
                    </div>
                  )}
                </div>
                <button onClick={() => eliminarAudiencia(item)}
                  style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, padding:'5px 12px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600, flexShrink:0, ...f }}>
                  ✕ Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BANNER: ERRORES */}
      {errores.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⚠️</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#991b1b', ...f }}>
              {errores.length} correo{errores.length > 1 ? 's' : ''} no pudo{errores.length > 1 ? 'ron' : ''} procesarse
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {errores.map((e, i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#0f172a', marginBottom:2, ...f }}>{e.asunto}</div>
                <div style={{ fontSize:11, color:'#dc2626', ...f }}>⚠ {e.motivo}</div>
                {e.ruc && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>RUC: {e.ruc}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BANNER: SIN CAUSA VIGENTE */}
      {sinCausa.length > 0 && (
        <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:32, height:32, background:'#e2e8f0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📂</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#475569', ...f }}>
              {sinCausa.length} correo{sinCausa.length > 1 ? 's' : ''} sin causa vigente
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {sinCausa.map((n, i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#0f172a', ...f }}>{n.asunto}</div>
                  {n.ruc && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>RUC: <span style={{ fontFamily:'monospace' }}>{n.ruc}</span> — no existe o está terminada</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMEN FINAL */}
      {hayResultados && !cargando && (
        <div style={{ textAlign:'center', marginTop:8 }}>
          <button onClick={() => { setAgregados([]); setErrores([]); setSinCausa([]) }}
            style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'7px 18px', fontSize:12, color:'#94a3b8', cursor:'pointer', ...f }}>
            Limpiar resultados
          </button>
        </div>
      )}
    </div>
  )
}
