import { useState, useEffect } from 'react'
import { loginGmail, isGmailConnected, logoutGmail, fetchNotificacionesPJUD, exchangeCodeForToken } from '../lib/gmail'
import { supabase } from '../lib/supabase'
import { fechaDDMM } from '../pages/dashboard/utils'
import { ESTADOS_DILIGENCIA } from '../pages/dashboard/diligencias'

const f = { fontFamily:"'Manrope','Inter',sans-serif" }

export default function GmailIntegracion({ onImportComplete }) {
  const [conectado, setConectado] = useState(isGmailConnected())
  const [cargando, setCargando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [agregados, setAgregados] = useState([])
  const [errores, setErrores] = useState([])
  const [sinCausa, setSinCausa] = useState([])
  const [duplicados, setDuplicados] = useState([])
  // ✅ NUEVO: respuestas de Fiscalía detectadas en el correo, que calzan por
  // folio con una diligencia "Pendiente de respuesta" — nunca se aplican
  // solas, siempre se muestran para que Joaquín las revise y confirme.
  const [respuestasDetectadas, setRespuestasDetectadas] = useState([])
  const [aplicandoId, setAplicandoId] = useState(null)

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
    setDuplicados([])
    setRespuestasDetectadas([])

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

      // ✅ NUEVO: correos que Joaquín ya revisó y resolvió antes (eliminó una
      // audiencia agregada por error, o eliminó la anterior/desactualizada
      // tras confirmar la corrección) — se guardan por el id del correo de
      // Gmail para que NUNCA más se vuelvan a mostrar como inconsistencia,
      // aunque "Revisar correos" lo vuelva a leer una y otra vez.
      const { data: descartadosData } = await supabase
        .from('gmail_correos_descartados')
        .select('gmail_message_id')
      const correosDescartados = new Set((descartadosData || []).map(d => d.gmail_message_id))

      // Filtrar: solo procesar correos cuyo RUC esté en causas vigentes y que
      // no hayan sido descartados ya en una revisión anterior.
      const notificaciones = todasNotificaciones.filter(n => {
        if (n.id && correosDescartados.has(n.id)) return false
        const rucNorm = n.ruc?.replace(/[\s\-]/g, '').toLowerCase()
        return rucsVigentes.has(rucNorm)
      })

      // 2.b ✅ NUEVO: buscar RESPUESTAS de Fiscalía a solicitudes ya
      // ingresadas — se hace con la misma lista de correos ya descargada
      // (sin llamadas extra a Gmail), matcheando por FOLIO contra las
      // diligencias "Pendiente de respuesta" de causas vigentes. Nunca se
      // aplica sola: solo se sugiere, y Joaquín confirma con un clic.
      const causasPorId = Object.fromEntries(causasVigentes.map(c => [c.id, c]))
      const { data: diligenciasPendientes } = await supabase
        .from('diligencias_fiscalia')
        .select('id, causa_id, tipo, folio, fecha_solicitud, estado')
        .eq('estado', 'pendiente')
        .in('causa_id', causasVigentes.map(c => c.id))

      const normalizarFolio = (f) => (f || '').toString().replace(/\D/g, '')
      const pendientesPorFolio = new Map()
      ;(diligenciasPendientes || []).forEach(d => {
        const fn = normalizarFolio(d.folio)
        if (fn) pendientesPorFolio.set(fn, d)
      })

      const nuevasRespuestas = []
      const foliosVistos = new Set()
      for (const n of todasNotificaciones) {
        const folioDetectado = normalizarFolio(n.respuestaFiscalia?.folio)
        if (!folioDetectado || foliosVistos.has(folioDetectado)) continue
        const diligencia = pendientesPorFolio.get(folioDetectado)
        if (!diligencia) continue
        foliosVistos.add(folioDetectado)
        const causa = causasPorId[diligencia.causa_id]
        nuevasRespuestas.push({
          diligenciaId: diligencia.id,
          tipoDiligencia: diligencia.tipo,
          folio: diligencia.folio,
          fechaSolicitud: diligencia.fecha_solicitud,
          ruc: causa?.ruc || '',
          imputado: causa?.imputado || '',
          estado: n.respuestaFiscalia.estado,
          fechaCitacion: n.respuestaFiscalia.fechaCitacion,
          detalle: n.respuestaFiscalia.detalle,
          fechaRespuestaEmail: n.fecha_correo ? n.fecha_correo.slice(0, 10) : new Date().toISOString().slice(0, 10),
          asunto: n.asunto,
        })
      }
      setRespuestasDetectadas(nuevasRespuestas)

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
      // ✅ FIX: antes se agrupaba por RUC+fecha+TIPO — si el tipo también
      // cambiaba entre una lectura y otra (ej. "CIERRE" vs "AUDIENCIA" para la
      // misma fecha), nunca se comparaban entre sí y por eso no avisaba de
      // ninguna inconsistencia. Ahora se agrupa solo por RUC+fecha, así
      // cualquier diferencia (en hora O en tipo) queda marcada para revisar.
      const clavesBaseExistentes = new Map()
      ;(audienciasExistentes || []).forEach(a => {
        const claveBase = `${normalizarRuc(a.ruc)}-${a.fecha}`
        if (!clavesBaseExistentes.has(claveBase)) clavesBaseExistentes.set(claveBase, [])
        clavesBaseExistentes.get(claveBase).push(a)
      })

      const clavesProcesadas = new Set()

      // Mapa con RUC normalizado
      const causasPorRucNorm = {}
      ;(causasVigentes || []).forEach(c => {
        causasPorRucNorm[normalizarRuc(c.ruc)] = c
      })

      // ✅ NUEVO: todas las audiencias existentes agrupadas SOLO por RUC (sin
      // fecha) — para poder encontrar "la audiencia anterior" cuando el
      // correo corrige/reprograma y la fecha nueva es DISTINTA a cualquier
      // audiencia ya guardada para esa causa (si no, nunca se detectaba,
      // porque antes solo se comparaba RUC+fecha exactos).
      const audienciasPorRuc = new Map()
      ;(audienciasExistentes || []).forEach(a => {
        const rn = normalizarRuc(a.ruc)
        if (!audienciasPorRuc.has(rn)) audienciasPorRuc.set(rn, [])
        audienciasPorRuc.get(rn).push(a)
      })

      // Con el filtro previo, todas las notificaciones tienen causa vigente
      // sinCausaVigente ya no aplica — lo dejamos vacío

      const nuevosAgregados = []
      const nuevosErrores = []
      const sinCausaVigente = []
      const sinCausaVistos = new Set()
      const nuevosDuplicados = []

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
        const clave = `${rucNorm}-${n.audiencia.fecha}-${normalizarParaClave(n.audiencia.tipo)}-${normalizarParaClave(n.audiencia.hora)}`
        const yaExiste = claveExistente.has(clave)

        // ¿Ya existía algo con este mismo RUC+fecha (sin importar tipo/hora)?
        const claveBase = `${rucNorm}-${n.audiencia.fecha}`
        const posiblesAnteriores = clavesBaseExistentes.get(claveBase) || []

        // ✅ Esta comparación se hace SIEMPRE, exista ya o no la audiencia
        // nueva — antes solo corría al insertarla recién, así que una vez
        // procesado un correo una vez, revisarlo de nuevo nunca detectaba un
        // duplicado que hubiera quedado de una corrección anterior (ej. si
        // ya tenías guardadas la del 31 Y la del 30 desde antes de este
        // arreglo, "Revisar correos" ahora sí lo detecta igual).
        let posibleReemplazo = null
        if (n.audiencia.esReprogramacion && posiblesAnteriores.length === 0) {
          const todasDeLaCausa = audienciasPorRuc.get(rucNorm) || []
          const candidatas = todasDeLaCausa.filter(a =>
            a.fecha !== n.audiencia.fecha && normalizarParaClave(a.tipo) === normalizarParaClave(n.audiencia.tipo)
          )
          if (candidatas.length === 1) posibleReemplazo = candidatas[0]
        }

        // Si ya estaba guardada (o ya se procesó en esta misma revisión), no
        // se inserta de nuevo — pero si se detectó una posible duplicada/
        // anterior, igual se avisa en su propio aviso.
        if (yaExiste || clavesProcesadas.has(clave)) {
          const claveDup = `dup-${clave}`
          if (posibleReemplazo && !clavesProcesadas.has(claveDup)) {
            clavesProcesadas.add(claveDup)
            const actual = (audienciasExistentes || []).find(a =>
              normalizarRuc(a.ruc) === rucNorm && a.fecha === n.audiencia.fecha &&
              normalizarParaClave(a.tipo) === normalizarParaClave(n.audiencia.tipo) &&
              normalizarParaClave(a.hora) === normalizarParaClave(n.audiencia.hora)
            )
            nuevosDuplicados.push({
              id: actual?.id || null,
              correoId: n.id || null,
              ruc: rucLimpio, imputado: causa.imputado, tipo: n.audiencia.tipo,
              fecha: n.audiencia.fecha, hora: n.audiencia.hora,
              tribunal: n.audiencia.tribunal || causa.tribunal, asunto: n.asunto, origen: n.tipo,
              audienciaAnterior: posibleReemplazo,
            })
          }
          continue
        }
        clavesProcesadas.add(clave)

        // ✅ NUEVO: si la señal es FUERTE (el documento dice explícitamente
        // que corrige un error o deja algo sin efecto) Y hay UNA sola
        // audiencia anterior candidata (sin ambigüedad), se aplica el
        // cambio solo — se borra la anterior y se avisa del cambio, sin
        // pedir que elijas. Si la señal es más débil o hay ambigüedad
        // (varias candidatas, o inconsistencia en la misma fecha), se
        // sigue preguntando como antes.
        const esCorreccionAutomatica = n.audiencia.esCorreccionFuerte && posiblesAnteriores.length === 0 && !!posibleReemplazo

        const notaCorreccion = esCorreccionAutomatica
          ? `✓ CORREGIDA AUTOMÁTICAMENTE: el correo indicó explícitamente que la audiencia del ${fechaDDMM(posibleReemplazo.fecha)} (${posibleReemplazo.tipo||'—'}) quedaba corregida/sin efecto — se eliminó esa y se dejó esta con la fecha correcta.\n`
          : posiblesAnteriores.length > 0
          ? `⚠ INCONSISTENCIA: ya existía(n) ${posiblesAnteriores.length} audiencia(s) para este RUC/fecha con tipo "${posiblesAnteriores.map(a=>a.tipo||'—').join(', ')}" y hora "${posiblesAnteriores.map(a=>a.hora||'—').join(', ')}". Esta se agregó como tipo "${n.audiencia.tipo||'—'}" y hora "${n.audiencia.hora||'—'}". Revisa cuál es la correcta y elimina la que sobre.\n`
          : posibleReemplazo
          ? `⚠ POSIBLE REPROGRAMACIÓN: el correo corrige/reprograma una audiencia — parece reemplazar la del ${fechaDDMM(posibleReemplazo.fecha)} (${posibleReemplazo.tipo||'—'}). Revisa y elimina la anterior si corresponde.\n`
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
          ...(esCorreccionAutomatica ? { corregida_en: new Date().toISOString(), corregida_de: `${fechaDDMM(posibleReemplazo.fecha)} (${posibleReemplazo.tipo||'—'}, ${posibleReemplazo.hora||'sin hora'})` } : {}),
        }).select().single()

        if (!error && data) {
          claveExistente.add(clave)

          // ✅ Se elimina la audiencia anterior AUTOMÁTICAMENTE (solo en el
          // caso de señal fuerte + candidata única) — se revisa el error
          // igual que en cualquier otro borrado, para no fallar en silencio.
          let borradoOk = true
          if (esCorreccionAutomatica) {
            const { error: errBorrado } = await supabase.from('audiencias').delete().eq('id', posibleReemplazo.id)
            if (errBorrado) borradoOk = false
          }

          nuevosAgregados.push({
            id: data.id,
            correoId: n.id || null,
            ruc: rucLimpio,
            imputado: causa.imputado,
            tipo: n.audiencia.tipo,
            fecha: n.audiencia.fecha,
            hora: n.audiencia.hora,
            tribunal: n.audiencia.tribunal || causa.tribunal,
            asunto: n.asunto,
            origen: n.tipo,
            esPosibleCorreccion: posiblesAnteriores.length > 0,
            audienciaAnterior: esCorreccionAutomatica ? null : posibleReemplazo,
            esCorreccionAutomatica,
            corregidaDe: esCorreccionAutomatica ? posibleReemplazo : null,
            fallóBorrarAnterior: esCorreccionAutomatica && !borradoOk,
          })
        } else if (error) {
          nuevosErrores.push({ ...n, motivo: error.message })
        }
      }

      setAgregados(nuevosAgregados)
      setErrores(nuevosErrores)
      setSinCausa(sinCausaVigente)
      setDuplicados(nuevosDuplicados)

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

  // ✅ NUEVO: aplica una respuesta de Fiscalía detectada por correo a la
  // diligencia pendiente correspondiente (por folio) — siempre pide
  // confirmación antes, ya que la lectura automática puede fallar (mismo
  // criterio que el resto de las lecturas de correo de esta pantalla).
  const aplicarRespuesta = async (item) => {
    const etiquetaEstado = ESTADOS_DILIGENCIA[item.estado]?.label || item.estado
    const detalleCita = item.estado === 'con_citacion' && item.fechaCitacion ? ` (cita el ${fechaDDMM(item.fechaCitacion)})` : ''
    if (!window.confirm(`¿Marcar la diligencia "${item.tipoDiligencia}" (folio ${item.folio}) como "${etiquetaEstado}"${detalleCita}?\n\nRevisa que sea correcto — se detectó automáticamente del correo "${item.asunto}".`)) return
    setAplicandoId(item.diligenciaId)
    const { error } = await supabase.from('diligencias_fiscalia').update({
      estado: item.estado,
      fecha_respuesta: item.fechaRespuestaEmail,
      fecha_citacion: item.estado === 'con_citacion' ? item.fechaCitacion : null,
      respuesta_detalle: item.detalle || null,
    }).eq('id', item.diligenciaId)
    setAplicandoId(null)
    if (error) { alert('No se pudo aplicar la respuesta: ' + error.message); return }
    setRespuestasDetectadas(prev => prev.filter(x => x.diligenciaId !== item.diligenciaId))
    if (onImportComplete) onImportComplete()
  }

  // ✅ NUEVO: una vez que Joaquín revisó una inconsistencia y decidió qué
  // hacer con ella (eliminar la agregada por error, o eliminar la anterior
  // ya corregida), se guarda el id del correo de Gmail que la originó — así
  // "Revisar correos" nunca más la vuelve a mostrar, aunque el correo siga
  // apareciendo en la búsqueda cada vez que se actualiza. Si el correo no
  // trae id (correos antiguos, de antes de este arreglo) simplemente no se
  // guarda nada — no hay como recordarlo, pero tampoco rompe nada.
  const descartarCorreo = async (correoId) => {
    if (!correoId) return
    await supabase.from('gmail_correos_descartados').upsert(
      { gmail_message_id: correoId },
      { onConflict: 'gmail_message_id', ignoreDuplicates: true }
    )
  }

  // ✅ FIX: antes no se revisaba si el borrado fallaba (ej. permisos) — la
  // tarjeta desaparecía de la pantalla igual, aunque el registro siguiera
  // guardado en la base de datos (por eso seguía apareciendo en Calendario).
  const eliminarAudiencia = async (item) => {
    if (!window.confirm(`¿Eliminar audiencia ${item.tipo} del ${fechaDDMM(item.fecha)}?`)) return
    const { error } = await supabase.from('audiencias').delete().eq('id', item.id)
    if (error) { alert('No se pudo eliminar la audiencia: ' + error.message); return }
    await descartarCorreo(item.correoId)
    setAgregados(prev => prev.filter(x => x.id !== item.id))
    if (onImportComplete) onImportComplete()
  }

  // ✅ NUEVO: elimina la audiencia ANTERIOR detectada como posible
  // reprogramación (no la que se acaba de agregar, sino la vieja con la
  // fecha desactualizada) — deja la tarjeta de la nueva tal cual, solo
  // saca el aviso una vez que ya se resolvió.
  const eliminarAudienciaAnterior = async (item) => {
    const anterior = item.audienciaAnterior
    if (!anterior) return
    if (!window.confirm(`¿Eliminar la audiencia anterior ${anterior.tipo||''} del ${fechaDDMM(anterior.fecha)}? Esto es la que quedó desactualizada, no la que se acaba de agregar.`)) return
    const { error } = await supabase.from('audiencias').delete().eq('id', anterior.id)
    if (error) { alert('No se pudo eliminar la audiencia anterior: ' + error.message); return }
    await descartarCorreo(item.correoId)
    setAgregados(prev => prev.map(x => x.id === item.id ? { ...x, audienciaAnterior: null } : x))
    if (onImportComplete) onImportComplete()
  }

  // ✅ NUEVO: mismo caso que arriba, pero para cuando la audiencia "nueva" ya
  // estaba guardada de antes (por eso no aparece en "Agregadas") y recién al
  // volver a revisar los correos se detecta que quedó una anterior sin
  // eliminar — típicamente audiencias del 31/07 y 30/07 que ya existían las
  // dos desde antes de este arreglo.
  const eliminarDuplicadoAnterior = async (item) => {
    const anterior = item.audienciaAnterior
    if (!anterior) return
    if (!window.confirm(`¿Eliminar la audiencia anterior ${anterior.tipo||''} del ${fechaDDMM(anterior.fecha)}? Esto es la que quedó desactualizada.`)) return
    const { error } = await supabase.from('audiencias').delete().eq('id', anterior.id)
    if (error) { alert('No se pudo eliminar la audiencia anterior: ' + error.message); return }
    await descartarCorreo(item.correoId)
    setDuplicados(prev => prev.filter(x => x !== item))
    if (onImportComplete) onImportComplete()
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

  const hayResultados = agregados.length > 0 || errores.length > 0 || sinCausa.length > 0 || duplicados.length > 0 || respuestasDetectadas.length > 0

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
          <div style={{ fontSize:13, color:'#94a3b8', ...f }}>Haz clic en "Revisar correos" para importar automáticamente las audiencias notificadas y detectar respuestas de Fiscalía a solicitudes pendientes</div>
        </div>
      )}

      {/* BANNER: RESPUESTAS DE FISCALÍA DETECTADAS — nunca se aplican solas,
          siempre piden confirmación con "Aplicar respuesta". */}
      {respuestasDetectadas.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1.5px solid #bfdbfe', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📨</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1e40af', ...f }}>
                {respuestasDetectadas.length} respuesta{respuestasDetectadas.length > 1 ? 's' : ''} de Fiscalía detectada{respuestasDetectadas.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize:11, color:'#2563eb', ...f }}>Encontrada(s) por folio en una diligencia pendiente — revisa y confirma antes de aplicar.</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {respuestasDetectadas.map((item, i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:220 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'#0f172a', ...f }}>{item.tipoDiligencia}</span>
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, textTransform:'uppercase', ...f,
                      background: ESTADOS_DILIGENCIA[item.estado]?.bg, color: ESTADOS_DILIGENCIA[item.estado]?.color,
                      border: `1px solid ${ESTADOS_DILIGENCIA[item.estado]?.border}`,
                    }}>{ESTADOS_DILIGENCIA[item.estado]?.label || item.estado}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', ...f }}>
                    RUC <span style={{ fontFamily:'monospace', fontWeight:600, color:'#0f172a' }}>{item.ruc}</span>
                    {item.imputado && <span style={{ marginLeft:8 }}>· {item.imputado.split('|')[0]}</span>}
                    <span style={{ marginLeft:8 }}>· Folio <span style={{ fontFamily:'monospace' }}>{item.folio}</span></span>
                  </div>
                  <div style={{ fontSize:12, color:'#2563eb', fontWeight:500, marginTop:4, ...f }}>
                    Solicitada el {fechaDDMM(item.fechaSolicitud)} · Respondida el {fechaDDMM(item.fechaRespuestaEmail)}
                    {item.estado === 'con_citacion' && item.fechaCitacion ? ` · Cita el ${fechaDDMM(item.fechaCitacion)}` : ''}
                  </div>
                  {item.detalle && <div style={{ fontSize:11, color:'#64748b', marginTop:4, fontStyle:'italic', ...f }}>"{item.detalle}"</div>}
                </div>
                <button onClick={() => aplicarRespuesta(item)} disabled={aplicandoId === item.diligenciaId}
                  style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:7, padding:'6px 14px', fontSize:11, cursor:'pointer', fontWeight:700, flexShrink:0, ...f }}>
                  {aplicandoId === item.diligenciaId ? 'Aplicando...' : '✓ Aplicar respuesta'}
                </button>
              </div>
            ))}
          </div>
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
                    📅 {fechaDDMM(item.fecha)}{item.hora ? ` · 🕐 ${item.hora}` : ''}{item.tribunal ? ` · 🏛 ${item.tribunal?.substring(0,30)}` : ''}
                  </div>
                  {item.esPosibleCorreccion && (
                    <div style={{ fontSize:11, color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:7, padding:'4px 8px', marginTop:6, fontWeight:600, ...f }}>
                      ⚠ INCONSISTENCIA: ya existía otra audiencia para este mismo RUC/fecha con otro tipo o hora — revisa cuál es la correcta y elimina la que sobre.
                    </div>
                  )}
                  {/* ✅ NUEVO: el correo sonaba a corrección/reprogramación y se
                      encontró UNA sola audiencia anterior de la misma causa y
                      tipo, en otra fecha — probablemente quedó desactualizada.
                      Se avisa con un botón directo para eliminarla, en vez de
                      dejarla ahí sin decir nada. */}
                  {item.audienciaAnterior && (
                    <div style={{ fontSize:11, color:'#9a3412', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:7, padding:'6px 8px', marginTop:6, fontWeight:600, ...f, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                      <span>⚠ Parece reemplazar la audiencia del {fechaDDMM(item.audienciaAnterior.fecha)} ({item.audienciaAnterior.tipo||'—'}, {item.audienciaAnterior.hora||'sin hora'}) — ¿eliminarla?</span>
                      <button onClick={() => eliminarAudienciaAnterior(item)}
                        style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', fontWeight:700, flexShrink:0, ...f }}>
                        Eliminar anterior
                      </button>
                    </div>
                  )}
                  {/* ✅ NUEVO: el correo decía explícitamente que corregía/
                      dejaba sin efecto una audiencia y solo había UNA candidata
                      posible — se aplicó el cambio solo (se eliminó la
                      anterior) y esto es solo un AVISO informativo, no pide
                      que elijas nada. Igual queda marcada para que la revises
                      con calma, por si el correo se leyó mal. */}
                  {item.esCorreccionAutomatica && (
                    <div style={{ fontSize:11, color:'#065f46', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:7, padding:'6px 8px', marginTop:6, fontWeight:600, ...f }}>
                      ✓ CORREGIDA AUTOMÁTICAMENTE — el correo indicó que reemplazaba la audiencia del {fechaDDMM(item.corregidaDe?.fecha)} ({item.corregidaDe?.tipo||'—'}, {item.corregidaDe?.hora||'sin hora'}); esa se eliminó y quedó esta con la fecha correcta. Revisa que esté bien.
                      {item.fallóBorrarAnterior && <div style={{ color:'#dc2626', marginTop:4 }}>⚠ No se pudo eliminar la anterior — revisa el Calendario, puede que haya quedado duplicada.</div>}
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

      {/* BANNER: POSIBLES DUPLICADOS DE ANTES — el correo ya se había procesado
          en una revisión anterior (por eso no aparece en "Agregadas"), pero
          recién ahora se detecta que quedó una audiencia vieja sin eliminar. */}
      {duplicados.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,#fff7ed,#fed7aa22)', border:'1.5px solid #fdba74', borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>⚠️</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#9a3412', ...f }}>
                {duplicados.length} audiencia{duplicados.length > 1 ? 's' : ''} con posible versión anterior sin eliminar
              </div>
              <div style={{ fontSize:11, color:'#c2410c', ...f }}>Ya estaban guardadas de una revisión anterior — recién ahora se detectó la anterior desactualizada.</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {duplicados.map((item, i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #fdba74', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, fontWeight:700, background: item.origen==='PJUD'?'#eff6ff':'#faf5ff', color: item.origen==='PJUD'?'#2563eb':'#7c3aed', border:`1px solid ${item.origen==='PJUD'?'#bfdbfe':'#ddd6fe'}`, padding:'2px 8px', borderRadius:20, textTransform:'uppercase', ...f }}>{item.origen}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#0f172a', ...f }}>{item.tipo}</span>
                </div>
                <div style={{ fontSize:12, color:'#64748b', ...f }}>
                  RUC <span style={{ fontFamily:'monospace', fontWeight:600, color:'#0f172a' }}>{item.ruc}</span>
                  {item.imputado && <span style={{ marginLeft:8 }}>· {item.imputado.split('|')[0]}</span>}
                  <span style={{ marginLeft:8 }}>· Vigente: 📅 {fechaDDMM(item.fecha)}{item.hora ? ` · 🕐 ${item.hora}` : ''}</span>
                </div>
                <div style={{ fontSize:11, color:'#9a3412', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:7, padding:'6px 8px', marginTop:6, fontWeight:600, ...f, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                  <span>⚠ Parece que reemplaza a la audiencia del {fechaDDMM(item.audienciaAnterior.fecha)} ({item.audienciaAnterior.tipo||'—'}, {item.audienciaAnterior.hora||'sin hora'}) — ¿eliminarla?</span>
                  <button onClick={() => eliminarDuplicadoAnterior(item)}
                    style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:10, cursor:'pointer', fontWeight:700, flexShrink:0, ...f }}>
                    Eliminar anterior
                  </button>
                </div>
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
          <button onClick={() => { setAgregados([]); setErrores([]); setSinCausa([]); setDuplicados([]); setRespuestasDetectadas([]) }}
            style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'7px 18px', fontSize:12, color:'#94a3b8', cursor:'pointer', ...f }}>
            Limpiar resultados
          </button>
        </div>
      )}
    </div>
  )
}
