import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import {
  estadoConfig, SUBESTADOS_VIGENTE, SUBESTADOS_TERMINADA, getBadgeConfig,
  corregirOrtografia, getCorteApelaciones, TRIBUNALES_CHILE, DELITOS_CATALOGO,
  CENTROS_PENALES,
} from './dashboard/utils'
import {
  SearchableSelect, DelitosChips, DelitoCard, SemaforoTag, Badge, BadgeEditor, Field, f, normT,
} from './dashboard/primitives'
import { AudienciaCard, ImputadoCard } from './dashboard/cards'
import { DiligenciasFiscalia, parsearComprobanteFiscalia } from './dashboard/diligencias'
import { FallosReferencia, DocumentosGuardados } from './dashboard/documentos'
import { HonorariosTab } from './dashboard/honorarios'
import { TeoriaDelCaso } from './dashboard/teoria'
import { BotonResumenImprimible } from './dashboard/resumen'
import { PlazoCalculador } from './dashboard/plazo'
import { calcularRegimenAlMomento, calcularVencimiento, parseFechaCL, diasRestantes, calcularSubestado, calcularEdadActual, TRIBUNAL_RPA, normRut, normalizarBusqueda, formatearRut, fechaDDMM } from './dashboard/utils'
import { ImputadoDatosCard } from './dashboard/imputado-datos'
import { CautelaresPanel, TIPOS_ABONO_DIRECTO, TIPOS_DETENCION_PENAL, CAUTELAR_NOCTURNO, CAUTELAR_SENAME, TIPOS_CAUTELARES_TODAS, diasEntreFechasCaut } from './dashboard/cautelares'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  .row-hover { transition:background 0.2s ease, border-color 0.2s ease; cursor:pointer; }
  .row-hover:hover { background:#f8faff !important; }
  .stat-card { transition:all 0.3s cubic-bezier(0.4,0,0.2,1); cursor:pointer; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.10) !important; }
  .tab-btn { transition:color 0.2s ease, border-color 0.2s ease; border:none; background:none; cursor:pointer; font-family:'Manrope','Inter',sans-serif; text-transform:uppercase; letter-spacing:0.3px; }
  .tab-btn:hover { color:#1E293B !important; }
  .fld { transition:border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease; }
  .fld:hover { border-color:#93c5fd !important; background:#fafcff !important; box-shadow:0 0 0 3px rgba(37,99,235,0.05) !important; }
  .sort-col { cursor:pointer; user-select:none; transition:color 0.2s ease; }
  .sort-col:hover { color:#1E293B !important; }
  .btn-primary { font-family:'Manrope','Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,58,95,0.2); text-transform:uppercase; letter-spacing:0.3px; }
  .btn-primary:hover { background:#1e40af; box-shadow:0 4px 16px rgba(30,58,95,0.3); }
  .btn-secondary { font-family:'Manrope','Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; text-transform:uppercase; letter-spacing:0.3px; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E293B; background:#f8faff; }
  .detail-enter { animation:detailIn 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes detailIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  input,select,textarea { font-family:'Manrope','Inter',sans-serif !important; transition:border-color 0.25s ease, box-shadow 0.25s ease; text-transform:uppercase; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08) !important; }
  .tc-section textarea:focus { box-shadow: none !important; border-color: transparent !important; }
  @keyframes semaforo-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.2)} }
  @keyframes chipIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .chip-group { animation:chipIn 0.28s cubic-bezier(0.4,0,0.2,1) forwards; }
  .chip-btn { transition:all 0.18s ease; }
  .chip-btn:hover { transform:translateY(-1px); box-shadow:0 3px 10px rgba(15,23,42,0.08); }
  .caut-header { transition:filter 0.2s ease; }
  .caut-header:hover { filter:brightness(1.08); }
  .causa-row { border-bottom:1px solid #f1f5f9; }
  .causa-row:last-child { border-bottom:none; }
  .causa-row-mobile { display:none; }
  /* Secciones plegables (con <details>/<summary>) — usadas para achicar la
     ficha de una causa en celular sin perder ningún dato ni función, solo
     colapsando lo que no estás mirando en ese momento. */
  .seccion-plegable summary { cursor:pointer; list-style:none; }
  .seccion-plegable summary::-webkit-details-marker { display:none; }
  .seccion-plegable .seccion-chevron { transition:transform 0.2s ease; display:inline-block; }
  .seccion-plegable[open] .seccion-chevron { transform:rotate(180deg); }
  /* ✅ Resumen imprimible de una causa — al imprimir, se oculta todo menos el
     contenido del resumen (el resto de la app no debe salir en el PDF/papel).
     El modal (.resumen-overlay/.resumen-imprimible) se renderiza con un
     Portal de React directo a <body> — a propósito, para que NUNCA quede
     anidado dentro de ".detail-enter" ni de ningún ".no-imprimir": si
     quedara adentro, ocultar ese contenedor se llevaría el contenido
     imprimible con él sin importar qué CSS se le ponga al modal. Gracias a
     eso, acá se puede ocultar con total tranquilidad TODO lo demás,
     incluyendo ".detail-enter" completo (que si no se oculta, sigue
     reservando su alto de min-height:100vh aunque esté con
     visibility:hidden, empujando el resumen a la página 2 o 3). */
  @media print {
    body * { visibility:hidden; }
    .resumen-imprimible, .resumen-imprimible * { visibility:visible; }
    /* .app-shell (App.jsx) también tiene min-height:100vh — sigue
       reservando una pantalla completa de espacio en blanco antes del
       resumen aunque esté oculta con visibility, empujando el contenido
       real a la página 2. .detail-enter queda igual por si acaso. */
    .app-shell, .detail-enter { display:none !important; }
    .resumen-overlay { position:static !important; inset:auto !important; background:none !important; overflow:visible !important; padding:0 !important; z-index:auto !important; }
    .resumen-imprimible { position:static !important; width:100%; max-width:100%; margin:0 !important; box-shadow:none !important; }
    .no-imprimir { display:none !important; }
  }
  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .hide-mobile { display: none !important; }
    .grid2-mobile { grid-template-columns: minmax(0,1fr) !important; }
    /* Red de seguridad: en celular, ningún bloque puede forzar la página a ser
       más ancha que la pantalla — el texto largo se corta en vez de empujar. */
    .seccion-plegable, .seccion-plegable > summary { max-width: 100%; }
    .causa-col-desktop { display: none !important; }
    .causa-row-mobile { display: block !important; }
    /* Cada tarjeta ya trae su propio marco — se saca la línea divisoria extra
       para que no queden dos bordes encimados. */
    .causa-row { border-bottom: none !important; }
  }
`

// ─── COMPONENTE DROPDOWN CON BUSQUEDA ────────────────────────────────────────
// ─── TEORÍA DEL CASO ──────────────────────────────────────────────────────────
export default function Dashboard({ session, userRol, registrarActividad, causaInicial, onCausaInicialUsada, showStats, setShowStats }) {
  const esTitular = userRol?.rol === 'titular'
  const [causas,setCausas]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterTribunal,setFilterTribunal]=useState('')
  const [filterEstado,setFilterEstado]=useState('')
  const [filterDelito,setFilterDelito]=useState('')
  const [filterRegimen,setFilterRegimen]=useState('') // '' | 'RPA' | 'ADULTO' | 'MIXTO'
  const [regimenesPorCausa,setRegimenesPorCausa]=useState({}) // { causa_id: Set(['ADULTO','RPA']) }
  const [sortCol,setSortCol]=useState('created_at')
  const [sortDir,setSortDir]=useState('desc')
  const [view,setView]=useState('list')
  const [selectedCausa,setSelectedCausa]=useState(null)
  const [activeTab,setActiveTab]=useState('datos')
  const [editField,setEditField]=useState(null)
  const [editValue,setEditValue]=useState('')
  const [audiencias,setAudiencias]=useState([])
  const [aumentos,setAumentos]=useState([])
  const [apelaciones,setApelaciones]=useState([])
  const [cautelares,setCautelares]=useState([])
  const [ordenesDetencion,setOrdenesDetencion]=useState([])
  const [imputados,setImputados]=useState([])
  const [showAudForm,setShowAudForm]=useState(false)
  const [nuevaAud,setNuevaAud]=useState({fecha:'',hora:'',tipo:'',tribunal:'',sala:'',resultado:'',notas:''})
  const [saving,setSaving]=useState(false)
  const [showNuevaCausa,setShowNuevaCausa]=useState(false)
  const [showFiltros,setShowFiltros]=useState(false)
  // ✅ Mismo criterio que Calendario.jsx para detectar celular — se usa para
  // achicar los gráficos de Estadísticas (ancho de etiquetas y alto) en vez
  // de ocultarlos, así no se pierde funcionalidad (clic para filtrar sigue
  // funcionando igual, solo se ve más compacto).
  const [isMobile,setIsMobile]=useState(typeof window!=='undefined' && window.innerWidth<640)
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<640)
    window.addEventListener('resize',onResize)
    return ()=>window.removeEventListener('resize',onResize)
  },[])
  const [grupoAbierto,setGrupoAbierto]=useState('') // '' | 'vigente' | 'terminada' — controla qué chips de subestado se muestran
  const [nuevaCausa,setNuevaCausa]=useState({ruc:'',rit:'',tribunal:'',delito:'',imputados:[{nombre:'',rut:'',fecha_nac:'',domicilio:'',nacionalidad:'',delito:'',centro_penal:'',cautelar:'',cautelar_fecha_inicio:''}],fiscal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente',subestado:''})
  const [rutBuscando,setRutBuscando]=useState({})
  const [rutEncontrado,setRutEncontrado]=useState({})

  useEffect(()=>{ loadCausas() },[])

  useEffect(() => {
    if (causaInicial) { openCausa(causaInicial); if (onCausaInicialUsada) onCausaInicialUsada() }
  }, [causaInicial])

  const loadCausas = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('causas').select('*').order('created_at', { ascending:false })
    if (!error) {
      const causasActualizadas = (data||[]).map(c => {
        const subestadosEspeciales = ['apjo','juicio_oral']
        let subestado = c.subestado
        if (c.estado === 'vigente' && !subestadosEspeciales.includes(c.subestado)) {
          const autoSub = calcularSubestado(c.plazo)
          if (autoSub !== 'vencido' && c.subestado === 'vencido') subestado = autoSub
          else if (autoSub) subestado = autoSub
        }
        return { ...c, tribunal: normT(c.tribunal), subestado }
      })
      setCausas(causasActualizadas)
    }
    // ✅ Régimen de todos los imputados, para poder filtrar la lista por RPA/Adulto/Mixta
    const { data: todosImputados } = await supabase.from('imputados').select('causa_id, regimen')
    if (todosImputados) {
      const mapa = {}
      todosImputados.forEach(imp => {
        if (!imp.regimen) return
        if (!mapa[imp.causa_id]) mapa[imp.causa_id] = new Set()
        mapa[imp.causa_id].add(imp.regimen)
      })
      setRegimenesPorCausa(mapa)
    }
    setLoading(false)
  }

  const openCausa=async(c)=>{
    setSelectedCausa(c);setView('detail');setActiveTab('datos')
    const[{data:a},{data:au},{data:imp},{data:apel},{data:caut},{data:ords}]=await Promise.all([
      supabase.from('audiencias').select('*').or(`causa_id.eq.${c.id},ruc.eq.${c.ruc}`).order('fecha',{ascending:false}),
      supabase.from('aumentos_plazo').select('*').eq('causa_id',c.id).order('fecha_audiencia',{ascending:true}),
      supabase.from('imputados').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
      supabase.from('apelaciones_corte').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
      supabase.from('cautelares_causa').select('*').eq('causa_id',c.id).order('fecha_inicio',{ascending:true}),
      supabase.from('ordenes_detencion').select('*').eq('causa_id',c.id).order('fecha_orden',{ascending:true}),
    ])
    setAudiencias(a||[]);setAumentos(au||[]);setImputados(imp||[]);setApelaciones(apel||[]);setCautelares(caut||[]);setOrdenesDetencion(ords||[])
  }

  // ✅ Abrir otra causa desde adentro de la actual (ej. "Causas asociadas al
  // imputado" por RUT) — reutiliza openCausa, buscando primero en lo que ya
  // está cargado en pantalla antes de ir a la base de datos.
  const abrirCausaAsociada = async (causaId) => {
    const existente = causas.find(x => x.id === causaId)
    if (existente) { await openCausa(existente); return }
    const { data } = await supabase.from('causas').select('*').eq('id', causaId).single()
    if (data) await openCausa(data)
  }

  // ✅ Función central para marcar acción real — actualiza updated_at y semáforo
  const marcarAccion = useCallback(async (causaId) => {
    const ahora = new Date()
    await supabase.from('causas').update({ updated_at: ahora }).eq('id', causaId)
    setCausas(prev => prev.map(c => c.id === causaId ? { ...c, updated_at: ahora.toISOString() } : c))
    setSelectedCausa(prev => prev ? { ...prev, updated_at: ahora.toISOString() } : prev)
  }, [])

  // ✅ Actualiza los delitos de UN imputado específico y recalcula el agregado
  // en causas.delito (unión sin duplicados de los delitos de todos los imputados),
  // para que la búsqueda, la tabla y el gráfico de estadísticas sigan funcionando.
  const actualizarDelitosImputado = async (impId, nuevoValor) => {
    await supabase.from('imputados').update({ delitos: nuevoValor }).eq('id', impId)
    const nuevosImputados = imputados.map(x => x.id === impId ? { ...x, delitos: nuevoValor } : x)
    setImputados(nuevosImputados)
    const acumulados = []
    nuevosImputados.forEach(imp => {
      (imp.delitos || '').split('|').map(d => d.trim()).filter(Boolean).forEach(d => {
        if (!acumulados.includes(d)) acumulados.push(d)
      })
    })
    const agregado = acumulados.join('|')
    const ahora = new Date()
    await supabase.from('causas').update({ delito: agregado, updated_at: ahora }).eq('id', selectedCausa.id)
    const u = { ...selectedCausa, delito: agregado, updated_at: ahora.toISOString() }
    setSelectedCausa(u)
    setCausas(prev => prev.map(c => c.id === u.id ? u : c))
    const imp = nuevosImputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó delitos de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  // ✅ Centro Penal por imputado — usa la misma columna "lugar_detencion" que ya
  // existe en imputados (la que se usa en la pestaña Imputado cuando está detenido),
  // así no hace falta ninguna migración nueva en Supabase.
  // ✅ "Detenido / En libertad" (pestaña Imputado) se calcula solo, a partir de
  // si la persona tiene una cautelar VIGENTE (sin fecha de término) de Prisión
  // Preventiva o Internación Provisoria — así no hace falta marcarlo a mano, y
  // Centro Penal aparece automáticamente ahí cuando corresponde. Se llama cada
  // vez que se agrega, cierra o quita una cautelar de un imputado.
  const sincronizarDetencionImputado = async (impId) => {
    const { data } = await supabase.from('cautelares_causa').select('tipo, fecha_termino').eq('imputado_id', impId)
    const detenido = (data || []).some(ct => TIPOS_DETENCION_PENAL.includes(ct.tipo) && !ct.fecha_termino)
    await supabase.from('imputados').update({ esta_detenido: detenido }).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, esta_detenido: detenido } : x))
  }

  // ✅ Eliminar una cautelar de forma DEFINITIVA — a propósito no existe botón
  // para esto salvo para el titular (CautelaresPanel ya filtra por esTitular
  // antes de mostrar el botón). Por defecto las cautelares nunca se borran,
  // solo se editan o se cierran, para mantener el historial.
  const eliminarCautelarDefinitivo = async (id, impId, motivo) => {
    const cautelar = cautelares.find(x => x.id === id)
    await supabase.from('cautelares_causa').delete().eq('id', id)
    setCautelares(prev => prev.filter(x => x.id !== id))
    if (impId) await sincronizarDetencionImputado(impId)
    if (registrarActividad) registrarActividad('accion', `Eliminó definitivamente la cautelar "${cautelar?.tipo||''}" (desde ${cautelar?.fecha_inicio||'—'}) en RUC ${selectedCausa?.ruc}. Motivo: ${motivo}`)
  }

  // ✅ Igual patrón que ya usa la pestaña Plazo para corregir audiencias: se
  // arma una línea de historial con fecha, quién lo hizo y el motivo, y se
  // concatena al historial anterior de esa misma cautelar (queda visible en
  // la tarjeta, no solo en el log de actividad general).
  const actualizarCautelarConMotivo = async (id, campos, motivo) => {
    const anterior = cautelares.find(x => x.id === id)
    const lineaHistorial = `[${new Date().toLocaleString('es-CL')}] Corregido por ${session?.user?.email||'usuario'}. Motivo: ${motivo}. Antes era: ${anterior?.tipo||'—'}, ${fechaDDMM(anterior?.fecha_inicio)||'—'}${anterior?.fecha_termino?' hasta '+fechaDDMM(anterior.fecha_termino):''}.`
    const nuevoHistorial = anterior?.historial ? anterior.historial + '\n' + lineaHistorial : lineaHistorial
    const camposFinales = { ...campos, historial: nuevoHistorial }
    await supabase.from('cautelares_causa').update(camposFinales).eq('id', id)
    setCautelares(prev => prev.map(x => x.id === id ? { ...x, ...camposFinales } : x))
  }

  // ✅ Condena — mismo patrón de historial con motivo que Cautelares/Plazo.
  // Solo pide motivo si ya había una condena cargada antes (motivo === '' en
  // la primera carga, porque no hay nada previo que corregir).
  const actualizarCondenaImputado = async (impId, campos, motivo) => {
    let camposFinales = campos
    if (motivo) {
      const anterior = imputados.find(x => x.id === impId)
      const lineaHistorial = `[${new Date().toLocaleString('es-CL')}] Corregido por ${session?.user?.email||'usuario'}. Motivo: ${motivo}. Antes era: ${anterior?.condena_tipo||'—'}, ${fechaDDMM(anterior?.condena_fecha_inicio)||'—'}, ${anterior?.condena_anos||0}a ${anterior?.condena_meses||0}m ${anterior?.condena_dias||0}d.`
      const nuevoHistorial = anterior?.condena_historial ? anterior.condena_historial + '\n' + lineaHistorial : lineaHistorial
      camposFinales = { ...campos, condena_historial: nuevoHistorial }
    }
    await supabase.from('imputados').update(camposFinales).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, ...camposFinales } : x))
    if (registrarActividad) registrarActividad('accion', `${motivo ? 'Corrigió' : 'Registró'} la condena de un imputado en RUC ${selectedCausa?.ruc}${motivo ? ': ' + motivo : ''}`)
  }

  const vaciarCondenaImputado = async (impId) => {
    if (!window.confirm('¿Vaciar por completo los datos de Condena de este imputado? Esta acción no se puede deshacer.')) return
    const campos = { condena_fecha_inicio: null, condena_tipo: null, condena_anos: null, condena_meses: null, condena_dias: null }
    await supabase.from('imputados').update(campos).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, ...campos } : x))
    if (registrarActividad) registrarActividad('accion', `Vació los datos de Condena de un imputado en RUC ${selectedCausa?.ruc}`)
  }

  const actualizarCentroPenalImputado = async (impId, valor) => {
    await supabase.from('imputados').update({ lugar_detencion: valor }).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, lugar_detencion: valor } : x))
    // Con un solo imputado, se sincroniza de vuelta a causas.centro_penal — mismo
    // patrón que ya usa actualizarDelitosImputado, para que el dato no quede huérfano
    // si el imputado se llega a eliminar más adelante.
    if (imputados.length <= 1) {
      await supabase.from('causas').update({ centro_penal: valor }).eq('id', selectedCausa.id)
      const u = { ...selectedCausa, centro_penal: valor }
      setSelectedCausa(u)
      setCausas(prev => prev.map(c => c.id === u.id ? u : c))
    }
    const imp = imputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó centro penal de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  // ✅ Genérica — usada por Delegación de Poder y Correo de notificación cuando
  // hay varios imputados y cada uno puede tener datos distintos.
  const actualizarCampoImputado = async (impId, field, valor) => {
    const updateData = { [field]: valor }
    // Calcular régimen automático al guardar fecha_nacimiento — mismo criterio
    // que en la pestaña Imputado, para que quede sincronizado en los 2 caminos.
    if (field === 'fecha_nacimiento' && valor) {
      const fechaHechos = selectedCausa?.fecha_hechos
      if (fechaHechos) {
        const regAuto = calcularRegimenAlMomento(valor, fechaHechos)
        if (regAuto) updateData.regimen = regAuto
      }
    }
    await supabase.from('imputados').update(updateData).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, ...updateData } : x))
    if (updateData.regimen === 'RPA') await sincronizarTribunalRPA(selectedCausa.id, selectedCausa.tribunal, selectedCausa.ruc)
    const imp = imputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó datos de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  // ✅ Si un imputado queda con régimen RPA (menor de edad al momento de los
  // hechos), el tribunal de la causa se sincroniza automáticamente a "UNIDAD
  // ESPECIALIZADA RPA" — aunque haya coimputados mayores de edad en la misma
  // causa (el menor "arrastra" al mayor solo en el nombre del tribunal, no en
  // la ley aplicable a cada uno). No revierte el tribunal si luego el régimen
  // cambia — esa corrección queda a criterio manual del titular.
  // ✅ Pide confirmación SIEMPRE antes de aplicar el cambio — un valor
  // intermedio del selector de fecha (por ejemplo, la rueda de fecha en
  // iPhone al desplazarse por los años) puede quedar guardado por accidente y
  // gatillar esto sin que nadie se dé cuenta. Con esta confirmación, el
  // tribunal nunca cambia en silencio.
  const sincronizarTribunalRPA = async (causaId, tribunalActual, rucRef) => {
    if (tribunalActual === TRIBUNAL_RPA) return
    const confirmar = window.confirm(`⚠ Un imputado quedó en régimen RPA (menor de edad al momento de los hechos) en RUC ${rucRef || ''}.\n\nEsto cambiará el tribunal de esta causa a "${TRIBUNAL_RPA}" automáticamente.\n\nRevisa la fecha de nacimiento y la fecha de los hechos antes de confirmar. ¿Corresponde el cambio?`)
    if (!confirmar) return
    await supabase.from('causas').update({ tribunal: TRIBUNAL_RPA, updated_at: new Date() }).eq('id', causaId)
    setCausas(prev => prev.map(x => x.id === causaId ? { ...x, tribunal: TRIBUNAL_RPA } : x))
    setSelectedCausa(prev => prev && prev.id === causaId ? { ...prev, tribunal: TRIBUNAL_RPA } : prev)
    if (registrarActividad) registrarActividad('accion', `Tribunal sincronizado automáticamente a "${TRIBUNAL_RPA}" por tener un imputado RPA en RUC ${rucRef || ''}`)
  }

  const updateField=async(field,value)=>{
    const camposSinMayusculas = ['estado','subestado','tiene_top']
    if (typeof value === 'string' && !camposSinMayusculas.includes(field)) value = value.toUpperCase()
    // Autocorrección ortográfica en campos de texto
    const camposCorregir = ['delito','imputado','tribunal','fiscal','cautelar','centro_penal','plazo']
    if (camposCorregir.includes(field) && typeof value === 'string') {
      value = corregirOrtografia(value)
    }
    setSaving(true)
    const{error}=await supabase.from('causas').update({[field]:value,updated_at:new Date()}).eq('id',selectedCausa.id)
    if(!error){
      const u={...selectedCausa,[field]:value,updated_at:new Date().toISOString()}
      setSelectedCausa(u);setCausas(prev=>prev.map(c=>c.id===u.id?u:c))
      if (registrarActividad) registrarActividad('accion', `Editó campo "${field}" en RUC ${selectedCausa.ruc}`)
      // Al guardar fecha_hechos → recalcular régimen de cada imputado. Siempre
      // recalcula (no es "sticky") porque puede que el imputado ya tuviera el
      // valor por defecto 'ADULTO' asignado al crear la causa sin fecha_hechos
      // todavía — si no se recalcula acá, se queda mal para siempre.
      if (field === 'fecha_hechos') {
        const nuevosImputados = await Promise.all(imputados.map(async imp => {
          if (!imp.fecha_nacimiento) return imp
          const regAuto = calcularRegimenAlMomento(imp.fecha_nacimiento, value)
          if (regAuto) {
            await supabase.from('imputados').update({ regimen: regAuto }).eq('id', imp.id)
            return { ...imp, regimen: regAuto }
          }
          return imp
        }))
        setImputados(nuevosImputados)
        if (nuevosImputados.some(imp => imp.regimen === 'RPA')) {
          await sincronizarTribunalRPA(selectedCausa.id, u.tribunal, selectedCausa.ruc)
        }
      }
    }
    setEditField(null);setSaving(false)
  }

  const saveAudiencia=async()=>{
    if(!nuevaAud.fecha)return;setSaving(true)
    const upAud = {}
    Object.entries(nuevaAud).forEach(([k,v]) => { upAud[k] = (typeof v === 'string' && !['fecha','hora'].includes(k)) ? corregirOrtografia(v.toUpperCase()) : v })
    const{data,error}=await supabase.from('audiencias').insert({causa_id:selectedCausa.id,ruc:selectedCausa.ruc,imputado:selectedCausa.imputado?.split('|')[0],...upAud}).select().single()
    if(!error){
      setAudiencias(prev=>[data,...prev].sort((a,b)=>b.fecha.localeCompare(a.fecha)))
      if (registrarActividad) registrarActividad('accion', `Nueva audiencia en RUC ${selectedCausa.ruc}: ${nuevaAud.tipo||'Audiencia'} ${fechaDDMM(nuevaAud.fecha)}`)
      await marcarAccion(selectedCausa.id) // ✅ actualiza semáforo
    }
    setNuevaAud({fecha:'',hora:'',tipo:'',tribunal:selectedCausa?.tribunal||'',sala:'',resultado:'',notas:''});setShowAudForm(false);setSaving(false)
  }

  // ✅ Ahora recibe el índice del imputado dentro del arreglo nuevaCausa.imputados,
  // porque Nueva Causa puede tener más de uno — cada uno busca y autorrellena
  // por separado, sin pisar a los demás.
  const buscarRutNuevaCausa = async (rut, idx) => {
    if (!rut || rut.length < 6) return
    setRutBuscando(prev => ({ ...prev, [idx]: true }))
    const rutNorm = normRut(rut)
    const { data } = await supabase.from('imputados').select('*').limit(500)
    setRutBuscando(prev => ({ ...prev, [idx]: false }))
    if (!data) return
    const coincidencias = data.filter(d => d.rut && normRut(d.rut) === rutNorm)
    if (coincidencias.length === 0) { setRutEncontrado(prev => ({ ...prev, [idx]: false })); return }
    // Tomar el más completo
    const campos = ['nombre','nacionalidad','domicilio','fecha_nacimiento']
    const masCompleto = coincidencias.reduce((mejor, actual) => {
      const pMejor = campos.filter(c => mejor[c] && mejor[c].trim()).length
      const pActual = campos.filter(c => actual[c] && actual[c].trim()).length
      return pActual > pMejor ? actual : mejor
    })
    setRutEncontrado(prev => ({ ...prev, [idx]: true }))
    // Autorrellenar solo el imputado buscado, dejando los demás intactos
    setNuevaCausa(p => ({
      ...p,
      imputados: p.imputados.map((imp, i) => i !== idx ? imp : {
        ...imp,
        nombre: masCompleto.nombre || imp.nombre,
        rut,
        fecha_nac: masCompleto.fecha_nacimiento || imp.fecha_nac,
        domicilio: masCompleto.domicilio || imp.domicilio,
        nacionalidad: masCompleto.nacionalidad || imp.nacionalidad,
      }),
    }))
  }

  // ✅ Actualiza un campo de un imputado específico dentro del arreglo de Nueva Causa
  const actualizarImputadoNuevaCausa = (idx, campo, valor) => {
    setNuevaCausa(p => ({ ...p, imputados: p.imputados.map((imp, i) => i === idx ? { ...imp, [campo]: valor } : imp) }))
  }
  const agregarImputadoNuevaCausa = () => {
    setNuevaCausa(p => ({ ...p, imputados: [...p.imputados, { nombre:'', rut:'', fecha_nac:'', domicilio:'', nacionalidad:'', delito:'', centro_penal:'', cautelar:'', cautelar_fecha_inicio:'' }] }))
  }
  const quitarImputadoNuevaCausa = (idx) => {
    setNuevaCausa(p => ({ ...p, imputados: p.imputados.filter((_, i) => i !== idx) }))
  }

  const saveCausa = async () => {
    if (!nuevaCausa.ruc) return
    // Autocorrección ortográfica antes de guardar
    setSaving(true)
    let plazoFinal = nuevaCausa.plazo
    if (nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo) plazoFinal = 'VENCE ' + calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)
    const subestadoAuto = nuevaCausa.subestado || calcularSubestado(plazoFinal)
    const up = (v) => typeof v === 'string' ? corregirOrtografia(v.toUpperCase()) : v
    const nombresImputados = nuevaCausa.imputados.map(i => i.nombre).filter(Boolean).join('|')
    // Delito(s) agregado de la causa = unión sin duplicados de los delitos de
    // todos los imputados — mismo criterio que usa actualizarDelitosImputado
    // en el detalle, para que búsqueda/tabla/gráfico de estadísticas funcionen igual.
    const delitosAcumulados = []
    nuevaCausa.imputados.forEach(imp => {
      (imp.delito || '').split('|').map(d => d.trim()).filter(Boolean).forEach(d => {
        if (!delitosAcumulados.includes(d)) delitosAcumulados.push(d)
      })
    })
    const delitoAgregado = delitosAcumulados.join('|')
    // ✅ Si algún imputado queda RPA (menor de edad al momento de los hechos), el
    // tribunal se fija directo en "Unidad Especializada RPA" — mismo criterio que
    // sincronizarTribunalRPA para causas ya creadas (el menor arrastra al mayor
    // solo en el nombre del tribunal, no en la ley aplicable a cada uno).
    const hayImputadoRPA = nuevaCausa.imputados.some(imp =>
      imp.fecha_nac && nuevaCausa.fecha_hechos && calcularRegimenAlMomento(imp.fecha_nac, nuevaCausa.fecha_hechos) === 'RPA'
    )
    const causaData = { ruc:up(nuevaCausa.ruc), rit:up(nuevaCausa.rit), tribunal: hayImputadoRPA ? TRIBUNAL_RPA : up(nuevaCausa.tribunal), delito:up(delitoAgregado), imputado:up(nombresImputados), fiscal:up(nuevaCausa.fiscal), cautelar:'', centro_penal:'', plazo:up(plazoFinal), estado:nuevaCausa.estado, subestado:subestadoAuto, fecha_hechos: nuevaCausa.fecha_hechos || null }
    const { data, error } = await supabase.from('causas').insert(causaData).select().single()
    if (!error) {
      // Crear un imputado por cada entrada del arreglo que tenga al menos nombre o
      // RUT. Delito(s), Centro Penal y Cautelar son todos por imputado desde el
      // formulario — cada coimputado puede enfrentar cargos distintos, estar en
      // un recinto distinto y tener una medida cautelar distinta. El régimen
      // (ADULTO/RPA) también se calcula por separado, según la fecha de
      // nacimiento de cada uno.
      for (const imp of nuevaCausa.imputados) {
        if (!imp.rut && !imp.nombre) continue
        const regAuto = (imp.fecha_nac && nuevaCausa.fecha_hechos)
          ? calcularRegimenAlMomento(imp.fecha_nac, nuevaCausa.fecha_hechos)
          : null
        const { data: impData } = await supabase.from('imputados').insert({
          causa_id: data.id,
          nombre: up(imp.nombre) || '',
          rut: formatearRut(imp.rut) || '',
          fecha_nacimiento: imp.fecha_nac || null,
          domicilio: up(imp.domicilio) || '',
          nacionalidad: up(imp.nacionalidad) || '',
          regimen: regAuto || 'ADULTO',
          delitos: up(imp.delito) || '',
          lugar_detencion: up(imp.centro_penal) || '',
          // Detenido automáticamente si la cautelar elegida es Prisión Preventiva
          // o Internación Provisoria — igual criterio que sincronizarDetencionImputado.
          esta_detenido: TIPOS_DETENCION_PENAL.includes(imp.cautelar),
        }).select().single()
        // Si este imputado tiene una cautelar con fecha (Prisión Preventiva,
        // Internación Provisoria, Arresto Total o Sujeción a SENAME), se
        // registra de una vez en su historial de cautelares — igual que se
        // hace desde el panel de una causa ya creada, para que el conteo de
        // días de abono empiece a correr desde hoy.
        if (impData && imp.cautelar && imp.cautelar_fecha_inicio &&
            (TIPOS_ABONO_DIRECTO.includes(imp.cautelar) || imp.cautelar === CAUTELAR_SENAME)) {
          await supabase.from('cautelares_causa').insert({
            causa_id: data.id,
            imputado_id: impData.id,
            tipo: imp.cautelar,
            fecha_inicio: imp.cautelar_fecha_inicio,
            fecha_termino: null,
          })
        }
      }
      setCausas(prev => [data, ...prev])
      setShowNuevaCausa(false)
      setRutEncontrado({})
      if (registrarActividad) registrarActividad('accion', `Nueva causa: RUC ${causaData.ruc}`)
      setNuevaCausa({ruc:'',rit:'',tribunal:'',delito:'',imputados:[{nombre:'',rut:'',fecha_nac:'',domicilio:'',nacionalidad:'',delito:'',centro_penal:'',cautelar:'',cautelar_fecha_inicio:''}],fiscal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente',subestado:''})
    }
    setSaving(false)
  }

  // ✅ NUEVO: eliminar una causa completa — no existía forma de hacerlo desde
  // la app (solo se podían borrar registros sueltos como audiencias o
  // cautelares). Es irreversible y borra TODO lo asociado (imputados,
  // audiencias, diligencias, documentos, honorarios, etc. — todas las
  // tablas tienen ON DELETE CASCADE), así que además de ser exclusivo del
  // titular, pide escribir el RUC exacto para confirmar — no basta un
  // simple "sí" como en otras eliminaciones, porque acá se pierde la causa
  // completa, no un solo dato.
  const eliminarCausa = async (c) => {
    if (!esTitular) return
    const escrito = window.prompt(`Esto elimina DEFINITIVAMENTE la causa RUC ${c.ruc} y TODO lo asociado (imputados, audiencias, diligencias, documentos, honorarios, etc.) — no se puede deshacer.\n\nPara confirmar, escribe exactamente el RUC "${c.ruc}":`)
    if (escrito === null) return
    if (escrito.trim() !== c.ruc) { alert('El RUC escrito no coincide — no se eliminó nada.'); return }
    const motivo = window.prompt('Motivo de la eliminación (queda registrado en el historial de actividad):')
    if (motivo === null || !motivo.trim()) { alert('Debes indicar un motivo — no se eliminó nada.'); return }
    const { error } = await supabase.from('causas').delete().eq('id', c.id)
    if (error) { alert('No se pudo eliminar la causa: ' + error.message); return }
    setCausas(prev => prev.filter(x => x.id !== c.id))
    setView('list')
    if (registrarActividad) registrarActividad('accion', `Eliminó definitivamente la causa RUC ${c.ruc} (${(c.imputado||'').replace(/\|/g,' / ')}). Motivo: ${motivo.trim()}`)
  }

  const handleSort=col=>{if(sortCol===col)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(col);setSortDir('asc')}}
  const tribunales=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
  const filtered=useMemo(()=>{
    let list=causas.filter(c=>{
      // ✅ Sin distinguir tildes ni "ñ"/"n" — así buscar "avendano" o "trafico"
      // encuentra "Avendaño" o "tráfico" aunque estén guardados con tilde/ñ.
      const s=normalizarBusqueda(search)
      const match=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v&&normalizarBusqueda(v).includes(s))
      // ✅ "Terminada" (general, sin subestado elegido) funciona como cola de pendientes:
      // solo muestra las terminadas que TODAVÍA no tienen subestado. Apenas se le pone
      // un subestado a una causa, desaparece de aquí y solo aparece en su subestado específico.
      const estadoMatch=!filterEstado||(filterEstado==='vigente'?c.estado==='vigente':filterEstado==='terminada'?(c.estado==='terminada'&&!c.subestado):filterEstado==='top'?(c.subestado==='juicio_oral'||c.tiene_top===true):c.subestado===filterEstado)
      const delitoMatch=!filterDelito||(c.delito||'').split('|').map(d=>d.trim()).includes(filterDelito)
      // ✅ Régimen: RPA/Adulto = al menos un imputado con ese régimen; Mixta = tiene ambos
      const regs = regimenesPorCausa[c.id]
      const regimenMatch=!filterRegimen||(regs && (filterRegimen==='MIXTO' ? (regs.has('RPA')&&regs.has('ADULTO')) : regs.has(filterRegimen)))
      return match&&(!filterTribunal||c.tribunal===filterTribunal)&&estadoMatch&&delitoMatch&&regimenMatch
    })
    return[...list].sort((a,b)=>{const av=a[sortCol]||'',bv=b[sortCol]||'';return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av)})
  },[causas,search,filterTribunal,filterEstado,filterDelito,filterRegimen,regimenesPorCausa,sortCol,sortDir])

  const hayFiltrosActivos = !!(search||filterTribunal||filterEstado||filterDelito||filterRegimen)
  const limpiarFiltros = () => { setSearch(''); setFilterTribunal(''); setFilterEstado(''); setFilterDelito(''); setFilterRegimen('') }

  const stats=useMemo(()=>({
    total:causas.length, vigente:causas.filter(c=>c.estado==='vigente').length, terminada:causas.filter(c=>c.estado==='terminada').length,
    vencido:causas.filter(c=>c.subestado==='vencido').length, proximo:causas.filter(c=>c.subestado==='proximo').length,
    apjo:causas.filter(c=>c.subestado==='apjo').length, juicioOral:causas.filter(c=>c.subestado==='juicio_oral'||c.tiene_top===true).length,
  }),[causas])

  // ✅ Los gráficos respetan TODOS los filtros activos (búsqueda, tribunal, estado, delito) —
  // se guarda el nombre completo del delito (no truncado) para poder filtrar con precisión al hacer clic.
  const chartDelitos=useMemo(()=>{
    const map={}
    filtered.forEach(c=>{(c.delito||'').split('|').map(d=>d.trim()).filter(Boolean).forEach(d=>{ if(!map[d]) map[d]=0; map[d]++ })})
    // En celular se resume a los 6 más frecuentes para que las barras no queden apretadas
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,isMobile?6:12).map(([nombreCompleto,value])=>({name:nombreCompleto.substring(0,isMobile?16:28),nombreCompleto,value}))
  },[filtered,isMobile])
  const chartTribunales=useMemo(()=>{
    const map={}
    filtered.forEach(c=>{if(c.tribunal){map[c.tribunal]=(map[c.tribunal]||0)+1}})
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,isMobile?6:15).map(([name,value])=>({name,value}))
  },[filtered,isMobile])
  // 📊 Resultados en causas terminadas — para tu % de rendimiento (condena preso/libre,
  // absoluciones, salidas alternativas). Respeta los mismos filtros de arriba.
  const chartResultados=useMemo(()=>{
    const terminadas=filtered.filter(c=>c.estado==='terminada')
    const map={}
    terminadas.forEach(c=>{const s=c.subestado||'sin_subestado';map[s]=(map[s]||0)+1})
    const total=terminadas.length
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([subestado,value])=>({
      subestado,
      label: estadoConfig[subestado]?.label || subestado.toUpperCase(),
      color: estadoConfig[subestado]?.color || '#64748b',
      bg: estadoConfig[subestado]?.bg || '#F8F9FC',
      border: estadoConfig[subestado]?.border || '#e2e8f0',
      value,
      pct: total>0 ? Math.round((value/total)*100) : 0,
    }))
  },[filtered])
  const totalTerminadas = chartResultados.reduce((s,r)=>s+r.value,0)
  const sumaSubestados = (...keys) => chartResultados.filter(r=>keys.includes(r.subestado)).reduce((s,r)=>s+r.value,0)
  const pctDe = (n) => totalTerminadas>0 ? Math.round((n/totalTerminadas)*100) : 0
  const resumenRendimiento = {
    absoluciones: { n: sumaSubestados('absuelto'), pct: pctDe(sumaSubestados('absuelto')) },
    condenas: { n: sumaSubestados('condena_preso','condena_libertad'), pct: pctDe(sumaSubestados('condena_preso','condena_libertad')) },
    salidasAlt: { n: sumaSubestados('scp','salida_ar'), pct: pctDe(sumaSubestados('scp','salida_ar')) },
  }
  // 📊 A favor / en contra — mismo criterio pedido: a favor = absuelto,
  // condena en libertad, salidas alternativas (SCP/AR) y DNP; en contra =
  // renuncia, revocación (patrocinio y poder o de pena sustitutiva) y
  // condena con preso. "Orden de detención" queda fuera de ambos — es un
  // estado procesal, no un resultado del caso.
  const nFavor = sumaSubestados('absuelto','condena_libertad','scp','salida_ar','dnp','sobreseimiento')
  const nContra = sumaSubestados('renuncia','revocacion','revocacion_pena_sustitutiva','condena_preso')
  const totalFavorContra = nFavor + nContra
  const resumenFavorContra = {
    favor: { n: nFavor, pct: totalFavorContra>0 ? Math.round((nFavor/totalFavorContra)*100) : 0 },
    contra: { n: nContra, pct: totalFavorContra>0 ? Math.round((nContra/totalFavorContra)*100) : 0 },
  }
  const COLORS=['#5B7CFA','#F0A868','#5BAE8C','#E0748C','#8B7FD1','#4FADC2','#D4A94E','#7FA6D6','#C77D5E','#8FA85E']
  const inp={width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}

  if(view==='detail'&&selectedCausa){
    const c=causas.find(x=>x.id===selectedCausa.id)||selectedCausa
    return(
      <div style={{background:'#F8F9FC',minHeight:'100vh',...f}} className="detail-enter">
        <style>{CSS}</style>
        <div style={{maxWidth:1060,margin:'0 auto',padding:'24px 28px'}}>
          <div className="no-imprimir" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
            <button className="btn-secondary" onClick={()=>setView('list')} style={{fontSize:13,border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}}>← Volver</button>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {/* ✅ Solo visible en las causas importadas del Excel (las que tienen
                  "Excel fila..." en Carpeta y referencia) — a pedido de Joaquín, no
                  quiere este botón disponible siempre en todas las causas, solo
                  mientras revisa esta tanda para sacar las que no sirven. */}
              {esTitular && (c.carpeta_ref||'').startsWith('Excel fila') && (
                <button onClick={()=>eliminarCausa(c)} title="Elimina la causa completa y todo lo asociado — irreversible"
                  style={{fontSize:12,fontWeight:600,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:14,padding:'9px 16px',cursor:'pointer',...f}}>
                  🗑 Eliminar causa
                </button>
              )}
              <BotonResumenImprimible causa={c} imputados={imputados} audiencias={audiencias} aumentos={aumentos} cautelares={cautelares} esTitular={esTitular}/>
            </div>
          </div>
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 1px 3px rgba(15,23,42,0.06)'}}>
          <div style={{padding:'28px 28px 20px',borderRadius:'20px 20px 0 0'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:'#1E293B',marginBottom:6,letterSpacing:'-0.5px',...f}}>RUC <span style={{color:'#1E293B'}}>{c.ruc}</span></div>
                <div style={{fontSize:13,color:'#94a3b8',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',...f}}>
                  <span>RIT <span style={{color:'#475569',fontWeight:500}}>{c.rit||'—'}</span></span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.tribunal}</span>
                  {getCorteApelaciones(c.tribunal) && (
                    <span style={{fontSize:10,fontWeight:600,color:'#94a3b8',...f}}>({getCorteApelaciones(c.tribunal)})</span>
                  )}
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{(c.imputado||'').replace(/\|/g,' / ')}</span>
                  <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                  {imputados.length === 1 && imputados.filter(i=>i.regimen).map(i=>(
                    <span key={i.id} style={{
                      fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',
                      background:i.regimen==='RPA'?'#faf5ff':'#eff6ff',
                      color:i.regimen==='RPA'?'#5b21b6':'#1E293B',...f
                    }}>{i.regimen}</span>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saving&&<span style={{fontSize:11,color:'#94a3b8',...f}}>Guardando...</span>}
                {c.esta_detenido&&<span style={{background:'#fef2f2',color:'#dc2626',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',...f}}>🔒 Detenido</span>}
                <BadgeEditor
                  estado={c.estado}
                  subestado={c.subestado}
                  isMobile={isMobile}
                  onChangeEstado={(e)=>updateField('estado',e)}
                  onChangeSubestado={(s)=>updateField('subestado',s||null)}
                />
              </div>
            </div>
          </div>
          {(() => {
            const tabsList = [['datos','Datos'],['imputado','Imputado'],['plazo','Plazo'],['audiencias','Audiencias'],['top','Juicio Oral'],['teoria','⚖️ Teoría del Caso'],...(esTitular?[['honorarios','💰 Honorarios']]:[])]
            if (isMobile) {
              // En celular, la franja de pestañas pasa a ser un menú desplegable real
              // (no solo letra más chica) — eliges una y se abre esa parte específica.
              return (
                <div style={{background:'#fff',padding:'10px 16px'}}>
                  <select value={activeTab} onChange={e=>setActiveTab(e.target.value)}
                    style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:13,fontWeight:600,color:'#1E293B',background:'#F8F9FC',...f}}>
                    {tabsList.map(([k,l])=>(<option key={k} value={k}>{l}</option>))}
                  </select>
                </div>
              )
            }
            return (
              <div style={{background:'#fff',display:'flex',overflowX:'auto',padding:'0 20px'}}>
                {tabsList.map(([k,l])=>(
                  <button key={k} className="tab-btn" onClick={()=>setActiveTab(k)} style={{padding:'13px 16px',fontSize:13,fontWeight:activeTab===k?600:400,color:activeTab===k?'#1E293B':'#94a3b8',borderBottom:`2px solid ${activeTab===k?'#1E293B':'transparent'}`,whiteSpace:'nowrap',marginBottom:0}}>{l}</button>
                ))}
              </div>
            )
          })()}
          <div style={{background:'#fff',padding:isMobile?16:28,borderRadius:'0 0 20px 20px'}}>
            {activeTab==='datos'&&(
              <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {/* 1. Imputado(s) — con el botón de agregar en la esquina derecha, junto al label */}
                <div style={{gridColumn:'1/-1',marginBottom:2}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:10}}>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,...f}}>Imputado(s)</div>
                    <button className="btn-secondary" style={{fontSize:11,padding:'5px 12px',flexShrink:0}} onClick={()=>{setEditField('nuevo_imputado');setEditValue('')}}>+ Agregar imputado</button>
                  </div>
                  {editField==='campo_imputado'?(
                    <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                      <input style={{width:'100%',padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')updateField('imputado',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12,flexShrink:0,borderRadius:14}} onClick={()=>updateField('imputado',editValue)}>✓</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12,flexShrink:0,border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}} onClick={()=>setEditField(null)}>✗</button>
                    </div>
                  ):(
                    <div className="fld" onClick={()=>{setEditField('campo_imputado');setEditValue(c.imputado||'')}}
                      style={{padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:c.imputado?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.imputado?c.imputado.replace(/\|/g,' / '):'Clic para agregar...'}</span>
                      <span style={{fontSize:11,color:'#94a3b8',flexShrink:0,marginLeft:8}}>✏</span>
                    </div>
                  )}
                  {editField==='nuevo_imputado' && (
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <input style={{flex:1,padding:'9px 12px',border:'1.5px solid #2563eb',borderRadius:8,fontSize:13,...f}} placeholder="Nombre del nuevo imputado" value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={async e=>{if(e.key==='Enter'){updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={async()=>{updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}}>+ Agregar</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✕</button>
                    </div>
                  )}
                </div>

                {/* 🔀 Detecta imputados antiguos guardados con 2+ nombres juntos en un
                    solo campo (ej. "JUAN PEREZ Y PEDRO GOMEZ") y permite separarlos en
                    registros individuales, igual que si se hubieran agregado uno por uno. */}
                {(() => {
                  const nombreCombinado = imputados.length === 1 ? imputados[0].nombre : (imputados.length === 0 ? c.imputado : null)
                  // ✅ El guion no siempre viene con espacios alrededor (ej.
                  // "PEREZ-JUAN GOMEZ", pegado) — antes exigía espacio a ambos
                  // lados (\s+-\s+) y por eso no detectaba esos casos. También se
                  // agrega la coma como separador (ej. "JUAN PEREZ, PEDRO GOMEZ Y
                  // ANA DIAZ"), que antes no se reconocía en absoluto.
                  const partes = nombreCombinado ? nombreCombinado.split(/\s+Y\s+|\s*\/\s*|\s*-\s*|\s*,\s*/i).map(s=>s.trim()).filter(Boolean) : []
                  if (partes.length < 2) return null
                  return (
                    <div style={{gridColumn:'1/-1',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'12px 14px',marginTop:-4,marginBottom:4}}>
                      <div style={{fontSize:12,color:'#1e40af',fontWeight:600,marginBottom:8,...f}}>
                        🔀 Esto parece ser {partes.length} imputados juntos en un solo nombre: {partes.map((p,i)=><span key={i}>{i>0&&' · '}<strong>{p}</strong></span>)}
                      </div>
                      <button className="btn-secondary" style={{fontSize:12}} onClick={async()=>{
                        if (!window.confirm(`¿Separar en ${partes.length} imputados individuales?\n\n${partes.join('\n')}`)) return
                        let actualizados = []
                        if (imputados.length === 1) {
                          await supabase.from('imputados').update({nombre:partes[0]}).eq('id',imputados[0].id)
                          actualizados = [{...imputados[0],nombre:partes[0]}]
                          for (const nombre of partes.slice(1)) {
                            const {data} = await supabase.from('imputados').insert({causa_id:c.id,nombre}).select().single()
                            if (data) actualizados.push(data)
                          }
                        } else {
                          for (const nombre of partes) {
                            const {data} = await supabase.from('imputados').insert({causa_id:c.id,nombre}).select().single()
                            if (data) actualizados.push(data)
                          }
                        }
                        setImputados(actualizados)
                        await updateField('imputado', partes.join('|'))
                        await marcarAccion(c.id)
                        if (registrarActividad) registrarActividad('accion', `Separó ${partes.length} imputados en RUC ${c.ruc}`)
                      }}>🔀 Separar en {partes.length} imputados individuales</button>
                    </div>
                  )
                })()}

                {/* 2. Corte de Apelaciones — se calcula sola según el tribunal. Va justo
                    debajo de Imputado y antes de Tribunal, como pidió Joaquín. */}
                <div style={{gridColumn:'1/-1',marginBottom:2}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:10,flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:20,fontSize:12,color: getCorteApelaciones(c.tribunal) ? '#1E293B' : '#94a3b8',background:'#fff',fontWeight:600,minWidth:0,maxWidth:'100%',...f}}>
                      <span style={{flexShrink:0}}>⚖</span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{getCorteApelaciones(c.tribunal) || 'Selecciona un tribunal'}</span>
                    </div>
                    <button onClick={async()=>{
                      const{data,error}=await supabase.from('apelaciones_corte').insert({causa_id:c.id}).select().single()
                      if(!error&&data){setApelaciones(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó una apelación en RUC ${c.ruc}`)}
                    }} style={{fontSize:11,color:'#7c3aed',background:'#faf5ff',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:14,padding:'7px 14px',cursor:'pointer',fontWeight:600,whiteSpace:'nowrap',...f}}>
                      + Agregar apelación
                    </button>
                  </div>
                  {apelaciones.length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
                      {apelaciones.map((apel,i)=>(
                        <div key={apel.id} style={{background:'#faf5ff',border:'1.5px solid #ddd6fe',borderRadius:10,padding:14}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#5b21b6',...f}}>⚖ Apelación {i+1}</div>
                            <button onClick={async()=>{
                              if(!window.confirm('¿Eliminar esta apelación?'))return
                              await supabase.from('apelaciones_corte').delete().eq('id',apel.id)
                              setApelaciones(prev=>prev.filter(x=>x.id!==apel.id))
                            }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:12,color:'#dc2626',...f}}>✕ Eliminar</button>
                          </div>
                          <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                            <Field label="Rol Corte" value={apel.rol_corte} editable fieldKey={`rol_corte_${apel.id}`} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await supabase.from('apelaciones_corte').update({rol_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,rol_corte:editValue}:x));setEditField(null)}}/>
                            <Field label="Sala" value={apel.sala_corte} editable fieldKey={`sala_corte_${apel.id}`} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await supabase.from('apelaciones_corte').update({sala_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,sala_corte:editValue}:x));setEditField(null)}}/>
                            <div style={{gridColumn:'1/-1'}}>
                              <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de audiencia en la Corte</div>
                              {editField===`fecha_audiencia_corte_${apel.id}`?(
                                <div style={{display:'flex',gap:6}}>
                                  <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                                    value={editValue} onChange={e=>setEditValue(e.target.value)}
                                    onBlur={async()=>{if(editValue){await supabase.from('apelaciones_corte').update({fecha_audiencia_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,fecha_audiencia_corte:editValue}:x))}}} autoFocus/>
                                  <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={async()=>{await supabase.from('apelaciones_corte').update({fecha_audiencia_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,fecha_audiencia_corte:editValue}:x));setEditField(null)}}>✓</button>
                                  <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                                </div>
                              ):(
                                <div className="fld" onClick={()=>{setEditField(`fecha_audiencia_corte_${apel.id}`);setEditValue(apel.fecha_audiencia_corte||'')}}
                                  style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:apel.fecha_audiencia_corte?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                                  <span>{fechaDDMM(apel.fecha_audiencia_corte) || 'Clic para agregar...'}</span>
                                  <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Datos de la causa: Tribunal, RIT, Fiscal y las fechas — agrupados en un
                     solo panel (en vez de casillas sueltas), para que se lea de un vistazo y
                     quede fijo arriba, sin importar cuánto crezcan las tarjetas de imputado. ── */}
                <details className="seccion-plegable" open={!isMobile} style={{gridColumn:'1/-1',border:'1px solid #e2e8f0',borderRadius:16,padding:'18px 20px',background:'#F8F9FC'}}>
                  <summary style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.3,fontWeight:700,marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',...f}}>
                    Datos de la causa
                    <span className="seccion-chevron" style={{fontSize:12}}>▾</span>
                  </summary>

                  {/* ✅ NUEVO: el RUC nunca se pudo editar después de crear la causa —
                      hacía falta para corregir los "SIN-RUC-Fxxx" provisorios que se
                      usaron al importar el Excel. Solo el titular puede tocarlo (es el
                      identificador principal, usado para el enlace con Gmail y el
                      seguimiento de la causa) y pide confirmar antes de guardar. */}
                  <Field label="RUC" value={c.ruc} editable={esTitular} full fieldKey="ruc" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>{
                    if (!window.confirm(`¿Cambiar el RUC de esta causa de "${c.ruc}" a "${editValue}"?\n\nEs el identificador principal — revisa que esté bien escrito antes de confirmar.`)) return
                    updateField('ruc',editValue)
                  }}/>

                  <Field label="Tribunal" value={c.tribunal} editable full fieldKey="tribunal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField('tribunal',editValue)}/>

                  <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:2}}>
                    {[{key:'rit',label:'RIT JG',editable:true},{key:'fiscal',label:'Fiscal a cargo',editable:true}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable={field.editable} full={field.full} fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>

                  <div style={{display:'flex',gap:10,flexWrap:'wrap',maxWidth:640,marginTop:16}}>
                    {/* Vencimiento del plazo */}
                    <div style={{flex:'1 1 190px',minWidth:170}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Vencimiento del plazo</div>
                      {editField==='Plazo / Vencimiento'?(
                        <div style={{display:'flex',gap:4}}>
                          <input style={{width:'100%',padding:'7px 9px',border:'none',borderRadius:8,fontSize:11,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')updateField('plazo',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                          <button className="btn-primary" style={{padding:'5px 9px',fontSize:10,borderRadius:8}} onClick={()=>updateField('plazo',editValue)}>✓</button>
                        </div>
                      ):(
                        <div className="fld" onClick={()=>{setEditField('Plazo / Vencimiento');setEditValue(c.plazo||'')}}
                          style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:600,color:c.plazo?'#1E293B':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.plazo||'Clic para agregar...'}</span>
                        </div>
                      )}
                    </div>
                    {/* Fecha ACD (Control Detención) — se toma de la 1ª audiencia registrada en Plazo */}
                    <div style={{flex:'1 1 150px',minWidth:140}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Fecha ACD</div>
                      {(() => {
                        const activosPlazo = (aumentos||[]).filter(a=>!a.eliminado).sort((x,y)=>x.fecha_audiencia.localeCompare(y.fecha_audiencia))
                        const fechaAcd = activosPlazo[0]?.fecha_audiencia
                        return (
                          <div onClick={()=>setActiveTab('plazo')}
                            style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:600,color:fechaAcd?'#1e40af':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}
                            title="Se toma automáticamente de la primera audiencia registrada en la pestaña Plazo">
                            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fechaAcd || 'Sin audiencias'}</span>
                            <span style={{fontSize:9,color:'#93c5fd'}}>↗</span>
                          </div>
                        )
                      })()}
                    </div>
                    {/* Fecha de los hechos */}
                    <div style={{flex:'1 1 150px',minWidth:140}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Fecha de los hechos</div>
                      {editField==='fecha_hechos'?(
                        <div style={{display:'flex',gap:4}}>
                          {/* ✅ Se guarda solo al salir del campo (onBlur) — no en cada tecleo,
                              porque si escribes la fecha a mano eso guardaría valores a medio
                              escribir. Antes dependía solo del botón ✓ y el guardado a veces
                              se perdía si no se tocaba aparte. */}
                          <input type="date" style={{width:'100%',padding:'7px 9px',border:'none',borderRadius:8,fontSize:11,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}
                            value={editValue} onChange={e=>setEditValue(e.target.value)}
                            onBlur={()=>{if(editValue)updateField('fecha_hechos',editValue)}}
                            onKeyDown={e=>{if(e.key==='Enter')updateField('fecha_hechos',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                          <button className="btn-primary" style={{padding:'5px 9px',fontSize:10,borderRadius:8}} onClick={()=>updateField('fecha_hechos',editValue)}>✓</button>
                        </div>
                      ):(
                        <div className="fld" onClick={()=>{setEditField('fecha_hechos');setEditValue(c.fecha_hechos||'')}}
                          style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:700,color:c.fecha_hechos?'#991b1b':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',cursor:'pointer',background:c.fecha_hechos?'#fef2f2':'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fechaDDMM(c.fecha_hechos) || 'Clic para agregar...'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* ── Todo lo que puede variar por imputado: Centro Penal, Cautelar Personal,
                     Delito(s), Delegación de Poder y Correo de notificación. Con 1 imputado se
                     ve igual que siempre (campos sueltos); con 2+, cada uno tiene su propia
                     tarjeta colapsable con toda su información agrupada, numerada. ── */}
                {imputados.length <= 1 ? (
                  <details className="seccion-plegable" open={!isMobile} style={{gridColumn:'1/-1',border:'1px solid #e2e8f0',borderRadius:16,padding:'18px 20px',background:'#F8F9FC',marginTop:2}}>
                    <summary style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.3,fontWeight:700,marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',...f}}>
                      Custodia, Cautelares, Delitos y Notificación
                      <span className="seccion-chevron" style={{fontSize:12}}>▾</span>
                    </summary>
                    <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {imputados.length === 0 ? (
                      <Field label="Centro Penal" value={c.centro_penal} editable fieldKey="centro_penal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField('centro_penal',editValue)}/>
                    ) : (
                      <Field label="Centro Penal" value={imputados[0].lugar_detencion} editable fieldKey="centro_penal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await actualizarCentroPenalImputado(imputados[0].id, editValue);setEditField(null)}}/>
                    )}

                    {/* Fecha de detención — mismo campo "fecha_detencion" que en la pestaña
                        Imputado (misma columna en la base de datos, sincronizado). Solo
                        aplica si hay 1 imputado registrado y está privado de libertad. */}
                    {imputados.length === 1 && imputados[0].esta_detenido && (
                      <div>
                        <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de detención</div>
                        {editField==='fecha_detencion'?(
                          <div style={{display:'flex',gap:6}}>
                            <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                              value={editValue} onChange={e=>setEditValue(e.target.value)}
                              onBlur={()=>{if(editValue)actualizarCampoImputado(imputados[0].id,'fecha_detencion',editValue)}}
                              onKeyDown={e=>{if(e.key==='Enter'){actualizarCampoImputado(imputados[0].id,'fecha_detencion',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                            <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{actualizarCampoImputado(imputados[0].id,'fecha_detencion',editValue);setEditField(null)}}>✓</button>
                            <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                          </div>
                        ):(
                          <div className="fld" onClick={()=>{setEditField('fecha_detencion');setEditValue(imputados[0].fecha_detencion||'')}}
                            style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imputados[0].fecha_detencion?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                            <span>{imputados[0].fecha_detencion || 'Clic para agregar...'}</span>
                            <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                          </div>
                        )}
                      </div>
                    )}

                    <CautelaresPanel
                      isMobile={isMobile}
                      causaId={c.id}
                      ruc={c.ruc}
                      cautelares={cautelares}
                      esRPA={imputados.some(i=>i.regimen==='RPA')}
                      esTitular={esTitular}
                      registrarActividad={registrarActividad}
                      onGuardar={async(form)=>{
                        const{data,error}=await supabase.from('cautelares_causa').insert({causa_id:c.id,imputado_id:imputados[0]?.id||null,tipo:form.tipo,fecha_inicio:form.fecha_inicio,fecha_termino:form.fecha_termino||null,frecuencia:form.tipo==='Firma'?form.frecuencia:null}).select().single()
                        if(!error&&data){setCautelares(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó cautelar "${form.tipo}" en RUC ${c.ruc}`)}
                        if(imputados[0]?.id) await sincronizarDetencionImputado(imputados[0].id)
                      }}
                      onActualizar={async(id,campos,motivo)=>{
                        if (motivo) { await actualizarCautelarConMotivo(id, campos, motivo) }
                        else { await supabase.from('cautelares_causa').update(campos).eq('id',id); setCautelares(prev=>prev.map(x=>x.id===id?{...x,...campos}:x)) }
                        if(imputados[0]?.id) await sincronizarDetencionImputado(imputados[0].id)
                      }}
                      onEliminar={(id,motivo)=>eliminarCautelarDefinitivo(id, imputados[0]?.id, motivo)}
                    />

                    <div style={{gridColumn:'1/-1',marginBottom:2}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Delito(s)</div>
                      {imputados.length === 0 ? (
                        <div style={{display:'flex'}}>
                          <DelitoCard value={c.delito} onChange={(v)=>updateField('delito', v)} options={DELITOS_CATALOGO} />
                        </div>
                      ) : imputados[0].delitos ? (
                        <div style={{display:'flex'}}>
                          <DelitoCard value={imputados[0].delitos} onChange={(v)=>actualizarDelitosImputado(imputados[0].id, v)} options={DELITOS_CATALOGO} />
                        </div>
                      ) : c.delito ? (
                        <div>
                          <div style={{fontSize:12,color:'#92400e',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'10px 12px',marginBottom:8,...f}}>
                            📋 Ya tenías guardado: <strong>{c.delito.replace(/\|/g,', ')}</strong> — aún no vinculado al imputado.
                          </div>
                          <button className="btn-secondary" style={{fontSize:12}} onClick={()=>actualizarDelitosImputado(imputados[0].id, c.delito)}>✓ Vincular a {imputados[0].nombre||'este imputado'}</button>
                        </div>
                      ) : (
                        <div style={{display:'flex'}}>
                          <DelitoCard value="" onChange={(v)=>actualizarDelitosImputado(imputados[0].id, v)} options={DELITOS_CATALOGO} />
                        </div>
                      )}
                    </div>

                    <div style={{gridColumn:'1/-1',marginTop:8}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Delegación de Poder</div>
                      <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <Field label="Abogado delegado" value={imputados.length===0?c.delegacion_abogado:imputados[0].delegacion_abogado} editable fieldKey="delegacion_abogado" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>{imputados.length===0?updateField('delegacion_abogado',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_abogado',editValue);setEditField(null)}}/>
                        <div>
                          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de delegación</div>
                          {editField==='delegacion_fecha'?(
                            <div style={{display:'flex',gap:6}}>
                              <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                                value={editValue} onChange={e=>setEditValue(e.target.value)}
                                onBlur={()=>{if(editValue){imputados.length===0?updateField('delegacion_fecha',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_fecha',editValue)}}}
                                onKeyDown={e=>{if(e.key==='Enter'){imputados.length===0?updateField('delegacion_fecha',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_fecha',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                              <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{imputados.length===0?updateField('delegacion_fecha',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_fecha',editValue);setEditField(null)}}>✓</button>
                              <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                            </div>
                          ):(
                            <div className="fld" onClick={()=>{setEditField('delegacion_fecha');setEditValue((imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha)||'')}}
                              style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:(imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha)?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                              <span>{(imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha) || 'Clic para agregar...'}</span>
                              <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{gridColumn:'1/-1',marginTop:4}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Correo de notificación</div>
                      <select
                        style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:(imputados.length===0?c.correo_notificacion:imputados[0].correo_notificacion)?'#1E293B':'#94a3b8',background:'#fff',cursor:'pointer',...f}}
                        value={(imputados.length===0?c.correo_notificacion:imputados[0].correo_notificacion)||''}
                        onChange={e=>imputados.length===0?updateField('correo_notificacion', e.target.value):actualizarCampoImputado(imputados[0].id,'correo_notificacion', e.target.value)}>
                        <option value="">Seleccionar correo...</option>
                        <option value="JOBREGONABOGADO@GMAIL.COM">JOBREGONABOGADO@GMAIL.COM</option>
                        <option value="NOTIFICACION.DEFENSAPENAL@GMAIL.COM">NOTIFICACION.DEFENSAPENAL@GMAIL.COM</option>
                      </select>
                    </div>
                    </div>
                  </details>
                ) : (
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:12}}>
                    {imputados.map((imp,idx)=>(
                      <ImputadoDatosCard
                        key={imp.id}
                        isMobile={isMobile}
                        imp={imp}
                        numero={idx+1}
                        causaId={c.id}
                        ruc={c.ruc}
                        cautelares={cautelares.filter(ct=>ct.imputado_id===imp.id)}
                        esTitular={esTitular}
                        registrarActividad={registrarActividad}
                        onUpdateCampo={(field,value)=>field==='lugar_detencion'?actualizarCentroPenalImputado(imp.id, value):actualizarCampoImputado(imp.id, field, value)}
                        onDelitoChange={(v)=>actualizarDelitosImputado(imp.id, v)}
                        onGuardarCautelar={async(form)=>{
                          const{data,error}=await supabase.from('cautelares_causa').insert({causa_id:c.id,imputado_id:imp.id,tipo:form.tipo,fecha_inicio:form.fecha_inicio,fecha_termino:form.fecha_termino||null,frecuencia:form.tipo==='Firma'?form.frecuencia:null}).select().single()
                          if(!error&&data){setCautelares(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó cautelar "${form.tipo}" a ${imp.nombre||'imputado'} en RUC ${c.ruc}`)}
                          await sincronizarDetencionImputado(imp.id)
                        }}
                        onActualizarCautelar={async(id,campos,motivo)=>{
                          if (motivo) { await actualizarCautelarConMotivo(id, campos, motivo) }
                          else { await supabase.from('cautelares_causa').update(campos).eq('id',id); setCautelares(prev=>prev.map(x=>x.id===id?{...x,...campos}:x)) }
                          await sincronizarDetencionImputado(imp.id)
                        }}
                        onEliminarCautelar={(id,motivo)=>eliminarCautelarDefinitivo(id, imp.id, motivo)}
                      />
                    ))}
                  </div>
                )}

              </div>
            )}

            {activeTab==='imputado'&&(
              <div>
                {imputados.map((imp,idx)=>(
                  <ImputadoCard key={imp.id} imp={imp} idx={idx} totalImputados={imputados.length} cautelares={cautelares.filter(ct=>ct.imputado_id===imp.id)} ordenesDetencion={ordenesDetencion.filter(o=>o.imputado_id===imp.id)} esTitular={esTitular} isMobile={isMobile} causaId={c.id} onAbrirCausaAsociada={abrirCausaAsociada}
                    onGuardarOrdenDetencion={async(form)=>{
                      const{data,error}=await supabase.from('ordenes_detencion').insert({causa_id:c.id,imputado_id:imp.id,fecha_orden:form.fecha_orden,motivo:form.motivo}).select().single()
                      if(!error&&data){setOrdenesDetencion(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó orden de detención (${form.fecha_orden}) a ${imp.nombre||'imputado'} en RUC ${c.ruc}`);await marcarAccion(c.id)}
                    }}
                    onActualizarOrdenDetencion={async(id,campos)=>{
                      await supabase.from('ordenes_detencion').update(campos).eq('id',id)
                      setOrdenesDetencion(prev=>prev.map(o=>o.id===id?{...o,...campos}:o))
                      if(campos.fecha_levantamiento&&registrarActividad)registrarActividad('accion',`Dejó sin efecto una orden de detención (${campos.fecha_levantamiento}) de ${imp.nombre||'imputado'} en RUC ${c.ruc}`)
                      await marcarAccion(c.id)
                    }}
                    onEliminarOrdenDetencion={async(id,motivo)=>{
                      await supabase.from('ordenes_detencion').delete().eq('id',id)
                      setOrdenesDetencion(prev=>prev.filter(o=>o.id!==id))
                      if(registrarActividad)registrarActividad('accion',`Eliminó definitivamente una orden de detención de ${imp.nombre||'imputado'} en RUC ${c.ruc}. Motivo: ${motivo}`)
                    }}
                    onGuardarCondena={(campos,motivo)=>actualizarCondenaImputado(imp.id,campos,motivo)} onVaciarCondena={()=>vaciarCondenaImputado(imp.id)} onUpdate={async(field,value)=>{
                    // Los delitos van sincronizados con el agregado de la causa
                    if (field === 'delitos') { await actualizarDelitosImputado(imp.id, value); return }
                    // Centro Penal ("Recinto penitenciario" en esta pestaña) usa la misma
                    // función que en la pestaña Datos, para que quede sincronizado igual
                    // en los 3 caminos posibles de edición.
                    if (field === 'lugar_detencion') { await actualizarCentroPenalImputado(imp.id, value); return }
                    // Campos que NO deben convertirse a mayúsculas
                    const camposSinUpper = ['fecha_nacimiento','fecha_detencion','rut','condena_fecha_inicio']
                    if (typeof value === 'string' && !camposSinUpper.includes(field)) value = value.toUpperCase()
                    // Calcular régimen automático al guardar fecha_nacimiento
                    let updateData = {[field]:value}
                    if (field === 'fecha_nacimiento' && value) {
                      const fechaHechos = c.fecha_hechos || selectedCausa?.fecha_hechos
                      if (fechaHechos) {
                        const regAuto = calcularRegimenAlMomento(value, fechaHechos)
                        if (regAuto) updateData.regimen = regAuto
                      }
                    }
                    await supabase.from('imputados').update(updateData).eq('id',imp.id)
                    setImputados(prev=>prev.map(x=>x.id===imp.id?{...x,...updateData}:x))
                    if (updateData.regimen === 'RPA') await sincronizarTribunalRPA(c.id, c.tribunal, c.ruc)
                    // ✅ "causas.imputado" es un campo de texto APARTE (aparece en la lista
                    // de Causas y arriba en Datos) — es una copia, no se actualiza sola con
                    // los datos de la pestaña Imputado. Si se corrige el nombre acá, hay que
                    // recalcularlo también, si no queda desactualizado en esos dos lugares.
                    if (field === 'nombre') {
                      const nombresActualizados = imputados.map(x => x.id === imp.id ? value : x.nombre).filter(Boolean).join('|')
                      await supabase.from('causas').update({ imputado: nombresActualizados }).eq('id', c.id)
                      const u = { ...selectedCausa, imputado: nombresActualizados }
                      setSelectedCausa(u)
                      setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                    }
                    // Sincronizar datos personales en TODAS las causas con el mismo RUT
                    const camposPersonales = ['nombre','nacionalidad','domicilio','fecha_nacimiento','otros_antecedentes']
                    if (camposPersonales.includes(field) && imp.rut) {
                      const rn = normRut(imp.rut)
                      const { data: todos } = await supabase.from('imputados').select('id, rut').limit(500)
                      if (todos) {
                        const mismoRut = todos.filter(d => d.rut && normRut(d.rut) === rn && d.id !== imp.id)
                        await Promise.all(mismoRut.map(d => supabase.from('imputados').update({ [field]: value }).eq('id', d.id)))
                      }
                    }
                    await marcarAccion(c.id)
                  }} onDelete={async()=>{
                    if(!window.confirm('¿Eliminar este imputado?'))return
                    await supabase.from('imputados').delete().eq('id',imp.id)
                    const restantes = imputados.filter(x=>x.id!==imp.id)
                    setImputados(restantes)
                    // Recalcular agregado de delitos sin este imputado
                    const acumulados = []
                    restantes.forEach(r => { (r.delitos||'').split('|').map(d=>d.trim()).filter(Boolean).forEach(d=>{ if(!acumulados.includes(d)) acumulados.push(d) }) })
                    const agregado = acumulados.join('|')
                    await supabase.from('causas').update({ delito: agregado }).eq('id', c.id)
                    const u = { ...selectedCausa, delito: agregado }
                    setSelectedCausa(u)
                    setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                    await marcarAccion(c.id) // ✅ actualiza semáforo
                  }}/>
                ))}
                <button className="btn-secondary" style={{marginTop:16}} onClick={async()=>{
                  const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:'Nuevo imputado'}).select().single()
                  if(data){ setImputados(prev=>[...prev,data]); await marcarAccion(c.id) }
                }}>+ Agregar imputado</button>
              </div>
            )}
            {activeTab==='plazo'&&(
              <PlazoCalculador causaId={c.id} plazoActual={c.plazo} aumentos={aumentos} isMobile={isMobile}
                onGuardarAudiencia={async(form)=>{
                const diasNum = parseInt(form.dias_plazo) || 0
                const{data,error}=await supabase.from('aumentos_plazo').insert({causa_id:c.id,fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null}).select().single()
                if(!error){
                  const nuevosAumentos=[...aumentos,data].sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                  setAumentos(nuevosAumentos)
                  // ✅ El vencimiento vigente es el de la audiencia MÁS RECIENTE (por
                  // fecha), calculado desde su propia fecha — no se encadena desde el
                  // origen. "activos" ya queda ordenado por fecha_audiencia (ver el
                  // .sort() más arriba), así que la última posición es la más reciente.
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const ultima=activos[activos.length-1]
                  const nuevoVenc= ultima ? 'VENCE '+calcularVencimiento(ultima.fecha_audiencia,ultima.dias_plazo) : ''
                  const nuevoSub=calcularSubestado(nuevoVenc)
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Registró audiencia de plazo (+${diasNum}d, ${form.tipo_audiencia}) en RUC ${c.ruc}`)
                }
              }}
                onEditarAudiencia={async(id, form, motivo)=>{
                const diasNum = parseInt(form.dias_plazo) || 0
                const anterior = aumentos.find(a=>a.id===id)
                const lineaHistorial = `[${new Date().toLocaleString('es-CL')}] Corregido por ${session?.user?.email||'usuario'}. Motivo: ${motivo}. Antes era: ${anterior?.tipo_audiencia||'—'}, ${fechaDDMM(anterior?.fecha_audiencia)||'—'}, ${anterior?.dias_plazo||0} días.`
                const nuevoHistorial = anterior?.historial ? anterior.historial + '\n' + lineaHistorial : lineaHistorial
                const{error}=await supabase.from('aumentos_plazo').update({fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null,historial:nuevoHistorial}).eq('id',id)
                if(!error){
                  const nuevosAumentos=aumentos.map(a=>a.id===id?{...a,fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null,historial:nuevoHistorial}:a).sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                  setAumentos(nuevosAumentos)
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const ultima=activos[activos.length-1]
                  const nuevoVenc = ultima ? 'VENCE '+calcularVencimiento(ultima.fecha_audiencia,ultima.dias_plazo) : ''
                  const nuevoSub=calcularSubestado(nuevoVenc)
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Corrigió una audiencia de plazo en RUC ${c.ruc}: ${motivo}`)
                }
              }}
                onEliminarAudiencia={async(id, motivo)=>{
                // ✅ Eliminación lógica: no se borra de la base, se marca "eliminado" con el
                // motivo, y queda visible tachada en el historial para tener trazabilidad.
                const{error}=await supabase.from('aumentos_plazo').update({eliminado:true,motivo_eliminacion:motivo,eliminado_por:session?.user?.email||'usuario',eliminado_en:new Date()}).eq('id',id)
                if(!error){
                  const nuevosAumentos=aumentos.map(a=>a.id===id?{...a,eliminado:true,motivo_eliminacion:motivo,eliminado_por:session?.user?.email||'usuario',eliminado_en:new Date().toISOString()}:a)
                  setAumentos(nuevosAumentos)
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const ultima=activos[activos.length-1]
                  const nuevoVenc = ultima ? 'VENCE '+calcularVencimiento(ultima.fecha_audiencia,ultima.dias_plazo) : ''
                  const nuevoSub = ultima ? calcularSubestado(nuevoVenc) : null
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Eliminó una audiencia de plazo en RUC ${c.ruc}: ${motivo}`)
                }
              }}/>
            )}
            {activeTab==='audiencias'&&(
              <div>
                {audiencias.map(a=>(
                  <AudienciaCard key={a.id} a={a} onUpdate={async(updated,motivo)=>{
                    const historial = a.notas ? a.notas + `\n[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}` : `[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}`
                    const{error}=await supabase.from('audiencias').update({...updated,notas:historial}).eq('id',a.id)
                    if(!error){
                      setAudiencias(prev=>prev.map(x=>x.id===a.id?{...x,...updated,notas:historial}:x))
                      await marcarAccion(c.id) // ✅ actualiza semáforo
                    }
                  }}/>
                ))}
                {audiencias.length===0&&<p style={{color:'#94a3b8',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
                {showAudForm&&(
                  <div style={{background:'#F8F9FC',border:'1.5px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14}}>
                    <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',ph:'Formalización, APJO, JO...'},{key:'tribunal',label:'Tribunal',ph:'Ej: 4 JG STGO'},{key:'sala',label:'Sala',ph:'Ej: 903'},{key:'notas',label:'Observaciones',ph:'Notas'}].map(field=>(
                        <div key={field.key}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>{field.label}</div><input type={field.type||'text'} style={inp} placeholder={field.ph} value={nuevaAud[field.key]} onChange={e=>setNuevaAud(p=>({...p,[field.key]:e.target.value}))}/></div>
                      ))}
                    </div>
                    {/* ✅ El resultado queda aparte, con más espacio para escribir —
                        se usa para dejar algo especial si la audiencia lo requiere
                        (no siempre es necesario), y se muestra igual en el Resumen. */}
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Resultado de audiencia (opcional)</div>
                      <textarea style={{...inp,minHeight:70,resize:'vertical',lineHeight:1.5}} rows={3} placeholder="Escribe aquí cualquier detalle especial del resultado, si corresponde..." value={nuevaAud.resultado} onChange={e=>setNuevaAud(p=>({...p,resultado:e.target.value}))}/>
                    </div>
                    <div style={{display:'flex',gap:8}}><button className="btn-primary" onClick={saveAudiencia} disabled={saving}>{saving?'Guardando...':'Guardar'}</button><button className="btn-secondary" onClick={()=>setShowAudForm(false)}>Cancelar</button></div>
                  </div>
                )}
                <button className="btn-secondary" onClick={()=>{setShowAudForm(true);setNuevaAud(p=>({...p,tribunal:selectedCausa?.tribunal||''}))}}>+ Nueva audiencia</button>
              </div>
            )}
            {activeTab==='top'&&(
              <div>
                <p style={{fontSize:13,color:'#94a3b8',marginBottom:20,lineHeight:1.7,...f}}>Cuando la causa pasa a Juicio Oral se asigna un nuevo RIT y Tribunal bajo el mismo RUC <span style={{fontFamily:'monospace',color:'#475569'}}>{c.ruc}</span>.</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:c.tiene_top?'#faf5ff':'#F8F9FC',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:12,padding:'16px 20px',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:c.tiene_top?'#7c3aed':'#64748b',...f}}>{c.tiene_top?'⚖️ En Juicio Oral':'⚖️ Sin Juicio Oral asignado'}</div>
                    {c.tiene_top&&<div style={{fontSize:12,color:'#a78bfa',marginTop:3,...f}}>{c.tribunal_top||'—'} · RIT {c.rit_top||'—'}</div>}
                  </div>
                  <button onClick={()=>updateField('tiene_top',!c.tiene_top)} style={{background:c.tiene_top?'#faf5ff':'#fff',color:c.tiene_top?'#7c3aed':'#64748b',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:8,padding:'7px 18px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>{c.tiene_top?'Desactivar':'Activar JO'}</button>
                </div>
                {c.tiene_top&&(
                  <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {[{key:'tribunal_top',label:'Tribunal TOP'},{key:'rit_top',label:'RIT Juicio Oral'}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab==='teoria'&&(
              <TeoriaDelCaso
                causaId={c.id} ruc={c.ruc} session={session} registrarActividad={registrarActividad}
                carpetaRef={c.carpeta_ref} onUpdateCarpetaRef={(v)=>updateField('carpeta_ref',v)}
                onAccion={() => marcarAccion(c.id)} // ✅ actualiza semáforo
                isMobile={isMobile}
              />
            )}
            {esTitular && activeTab==='honorarios'&&(
              <HonorariosTab causaId={c.id} ruc={c.ruc} email={session?.user?.email||''} registrarActividad={registrarActividad} onAccion={()=>marcarAccion(c.id)} esTitular={esTitular} isMobile={isMobile}/>
            )}
          </div>
          </div>
        </div>
      </div>
    )
  }

  const SortIcon=({col})=>sortCol!==col?<span style={{color:'#e2e8f0',marginLeft:5,fontSize:10}}>⇅</span>:sortDir==='asc'?<span style={{color:'#2563eb',marginLeft:5}}>↑</span>:<span style={{color:'#2563eb',marginLeft:5}}>↓</span>

  return(
    <div style={{background:'#F8F9FC',minHeight:'100vh',...f}}>
      <style>{CSS}</style>
      <div style={{maxWidth:1380,margin:'0 auto',padding:'28px'}}>
        <div style={{marginBottom:24}}/>

        {/* Tarjetas de resumen — sin íconos, solo un punto de color sutil como acento; solo las 3 principales */}
        <div style={{display:'flex',gap:16,marginBottom:24}}>
          {[
            {key:'',label:'Total causas',dot:'#2563eb',num:stats.total},
            {key:'vigente',label:'Vigentes',dot:'#059669',num:stats.vigente},
            {key:'terminada',label:'Terminadas',dot:'#64748b',num:stats.terminada},
          ].map(st=>{
            const activo = st.key===''? grupoAbierto==='' : grupoAbierto===st.key
            const enfasis = activo && st.key!==''
            return(<div key={st.key} className="stat-card" onClick={()=>{
              if(st.key===''){setFilterEstado('');setGrupoAbierto('')}
              else if(grupoAbierto===st.key){setFilterEstado('');setGrupoAbierto('')}
              else{setFilterEstado(st.key);setGrupoAbierto(st.key)}
            }} style={{flex:1,textAlign:'center',background:enfasis?'#1E293B':'#fff',border:'none',borderRadius:20,padding:'28px 22px',boxShadow:enfasis?'0 8px 24px rgba(15,23,42,0.16)':'0 1px 3px rgba(15,23,42,0.06)',transition:'all 0.2s'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,marginBottom:12}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:enfasis?'rgba(255,255,255,0.55)':st.dot}}/>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:0.5,color:enfasis?'rgba(255,255,255,0.55)':'#94a3b8',...f}}>{st.label}</div>
              </div>
              <div style={{fontSize:38,fontWeight:800,color:enfasis?'#fff':'#1E293B',lineHeight:1,letterSpacing:'-1.5px',...f}}>{st.num}</div>
            </div>)
          })}
        </div>

        {/* Chips de subestado — mismo criterio: sin borde duro, solo fondo suave */}
        {grupoAbierto==='vigente' && (
          <div className="chip-group" style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap',marginBottom:24,marginTop:4}}>
            {[
              {key:'vencido',label:'⚠ Plazo vencido',num:stats.vencido,activeColor:'#dc2626',activeBg:'#fef2f2'},
              {key:'proximo',label:'⏱ Por vencer',num:stats.proximo,activeColor:'#d97706',activeBg:'#fffbeb'},
              {key:'apjo',label:'⚖ APJO',num:stats.apjo,activeColor:'#334155',activeBg:'#F1F5F9'},
              {key:'top',label:'🏛 Juicio Oral',num:stats.juicioOral,activeColor:'#334155',activeBg:'#F1F5F9'},
            ].filter(ch=>ch.num>0).map(ch=>{
              const active=filterEstado===ch.key
              return(<button key={ch.key} className="chip-btn" onClick={()=>setFilterEstado(filterEstado===ch.key?'vigente':ch.key)}
                style={{fontSize:13,fontWeight:600,padding:'9px 16px',borderRadius:100,cursor:'pointer',border:'none',
                  color:active?ch.activeColor:'#48484A', background:active?ch.activeBg:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                {ch.label} · {ch.num}
              </button>)
            })}
          </div>
        )}
        {grupoAbierto==='terminada' && (
          <div className="chip-group" style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap',marginBottom:24,marginTop:4}}>
            {SUBESTADOS_TERMINADA.map(sub=>{
              const num = causas.filter(c=>c.estado==='terminada'&&c.subestado===sub).length
              if (num===0) return null
              const cfg = estadoConfig[sub]
              const active=filterEstado===sub
              return(<button key={sub} className="chip-btn" onClick={()=>setFilterEstado(filterEstado===sub?'terminada':sub)}
                style={{fontSize:13,fontWeight:600,padding:'9px 16px',borderRadius:100,cursor:'pointer',border:'none',
                  color:active?cfg.color:'#48484A', background:active?cfg.bg:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                {cfg.label} · {num}
              </button>)
            })}
          </div>
        )}

        {showStats&&(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:28,marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:8}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:'#1E293B',...f}}>Estadísticas del portfolio</div>
                <div style={{fontSize:12,color:'#94a3b8',marginTop:4,...f}}>
                  {hayFiltrosActivos ? <>Mostrando <strong style={{color:'#1E293B'}}>{filtered.length}</strong> causa{filtered.length!==1?'s':''} con los filtros activos</> : <>Mostrando las {filtered.length} causas del portfolio (sin filtros)</>}
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                {hayFiltrosActivos && <button className="btn-secondary" style={{fontSize:12}} onClick={limpiarFiltros}>✕ Limpiar filtros</button>}
                <button className="btn-secondary" style={{fontSize:12}} onClick={()=>setShowStats(false)}>✕ Cerrar</button>
              </div>
            </div>
            <div style={{fontSize:11,color:'#93c5fd',marginBottom:20,...f}}>💡 Haz clic en un delito o tribunal del gráfico para filtrar la lista por ese valor.</div>
            <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Top Delitos</div>
                {chartDelitos.length===0 ? (
                  <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8',fontSize:13,...f}}>Sin datos para estos filtros.</div>
                ) : (
                <ResponsiveContainer width="100%" height={isMobile?240:320}>
                  <BarChart data={chartDelitos} layout="vertical" margin={{left:isMobile?0:8,right:isMobile?12:24,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={isMobile?76:140} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'none',boxShadow:'0 4px 16px rgba(15,23,42,0.10)',borderRadius:10,fontSize:12}} formatter={(v,n,entry)=>[v+' causas',entry.payload.nombreCompleto]}/>
                    <Bar dataKey="value" radius={[0,6,6,0]} cursor="pointer" onClick={(data)=>setFilterDelito(prev=>prev===data.nombreCompleto?'':data.nombreCompleto)}>
                      {chartDelitos.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} stroke={filterDelito===d.nombreCompleto?'#1E293B':'none'} strokeWidth={filterDelito===d.nombreCompleto?2:0}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Causas por Tribunal</div>
                {chartTribunales.length===0 ? (
                  <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8',fontSize:13,...f}}>Sin datos para estos filtros.</div>
                ) : (
                <ResponsiveContainer width="100%" height={isMobile?240:320}>
                  <BarChart data={chartTribunales} layout="vertical" margin={{left:isMobile?0:8,right:isMobile?12:24,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={isMobile?68:110} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'none',boxShadow:'0 4px 16px rgba(15,23,42,0.10)',borderRadius:10,fontSize:12}}/>
                    <Bar dataKey="value" radius={[0,6,6,0]} cursor="pointer" onClick={(data)=>setFilterTribunal(prev=>prev===data.name?'':data.name)}>
                      {chartTribunales.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} stroke={filterTribunal===d.name?'#1E293B':'none'} strokeWidth={filterTribunal===d.name?2:0}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 📊 Resultados en causas terminadas — % de rendimiento (condena / absolución / salida alternativa) */}
            <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #f1f5f9'}}>
              <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:700,...f}}>Resultados en causas terminadas</div>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:16,...f}}>Tu % de rendimiento, según los mismos filtros de arriba · {totalTerminadas} causa{totalTerminadas!==1?'s':''} terminada{totalTerminadas!==1?'s':''}</div>
              {totalTerminadas===0 ? (
                <div style={{textAlign:'center',padding:'40px 0',color:'#94a3b8',fontSize:13,...f}}>Sin causas terminadas para estos filtros.</div>
              ) : (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                    <div style={{background:'#ecfdf5',border:'1.5px solid #a7f3d0',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#059669',letterSpacing:'-1px',...f}}>{resumenRendimiento.absoluciones.pct}%</div>
                      <div style={{fontSize:11,color:'#065f46',fontWeight:600,marginTop:4,...f}}>Absoluciones ({resumenRendimiento.absoluciones.n})</div>
                    </div>
                    <div style={{background:'#fff7ed',border:'1.5px solid #fed7aa',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#d97706',letterSpacing:'-1px',...f}}>{resumenRendimiento.salidasAlt.pct}%</div>
                      <div style={{fontSize:11,color:'#92400e',fontWeight:600,marginTop:4,...f}}>Salidas alternativas ({resumenRendimiento.salidasAlt.n})</div>
                    </div>
                    <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#dc2626',letterSpacing:'-1px',...f}}>{resumenRendimiento.condenas.pct}%</div>
                      <div style={{fontSize:11,color:'#991b1b',fontWeight:600,marginTop:4,...f}}>Condenas ({resumenRendimiento.condenas.n})</div>
                    </div>
                  </div>

                  {/* 📊 A favor / en contra — a favor: absuelto, condena en
                      libertad, salidas alternativas, DNP · en contra:
                      renuncia, revocación (patrocinio y poder o pena
                      sustitutiva), condena con preso. */}
                  {totalFavorContra > 0 && (
                    <div style={{marginBottom:24}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>A favor vs. en contra</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <div style={{background:'#ecfdf5',border:'1.5px solid #a7f3d0',borderRadius:12,padding:'16px',textAlign:'center'}}>
                          <div style={{fontSize:26,fontWeight:900,color:'#059669',letterSpacing:'-1px',...f}}>{resumenFavorContra.favor.pct}%</div>
                          <div style={{fontSize:11,color:'#065f46',fontWeight:600,marginTop:4,...f}}>A favor ({resumenFavorContra.favor.n})</div>
                        </div>
                        <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'16px',textAlign:'center'}}>
                          <div style={{fontSize:26,fontWeight:900,color:'#dc2626',letterSpacing:'-1px',...f}}>{resumenFavorContra.contra.pct}%</div>
                          <div style={{fontSize:11,color:'#991b1b',fontWeight:600,marginTop:4,...f}}>En contra ({resumenFavorContra.contra.n})</div>
                        </div>
                      </div>
                      <div style={{display:'flex',background:'#F8F9FC',borderRadius:8,height:10,overflow:'hidden',marginTop:10,border:'1px solid #e2e8f0'}}>
                        <div style={{width:`${resumenFavorContra.favor.pct}%`,background:'#a7f3d0'}}/>
                        <div style={{width:`${resumenFavorContra.contra.pct}%`,background:'#fca5a5'}}/>
                      </div>
                    </div>
                  )}

                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Detalle por subestado</div>
                  {chartResultados.map(r=>(
                    <div key={r.subestado} style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                      <div style={{width:150,fontSize:12,fontWeight:600,color:r.color,flexShrink:0,...f}}>{r.label}</div>
                      <div style={{flex:1,background:'#F8F9FC',borderRadius:6,height:22,position:'relative',overflow:'hidden',border:`1px solid ${r.border}`}}>
                        <div style={{width:`${r.pct}%`,height:'100%',background:r.bg,borderRight:`2px solid ${r.color}`,transition:'width 0.3s'}}/>
                      </div>
                      <div style={{width:70,fontSize:12,fontWeight:700,color:'#1E293B',textAlign:'right',flexShrink:0,...f}}>{r.value} · {r.pct}%</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Fila única: buscador + Filtros a la izquierda (alineados con la tabla), Nueva causa al extremo derecho */}
        <div style={{display:'flex',gap:10,marginBottom:showFiltros?10:24,alignItems:'center',flexWrap:'wrap',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{width:320,position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}>🔍</span>
            <input style={{width:'100%',padding:'11px 14px',paddingLeft:38,border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} placeholder="Buscar por RUC, RIT, imputado, delito..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn-secondary" onClick={()=>setShowFiltros(!showFiltros)} style={{border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)',color:showFiltros||hayFiltrosActivos?'#2563eb':'#374151',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            ⚙ Filtros{hayFiltrosActivos&&<span style={{background:'#2563eb',color:'#fff',borderRadius:100,fontSize:10,fontWeight:700,padding:'1px 7px'}}>●</span>}
          </button>
          </div>
          <button className="btn-primary" style={{borderRadius:14,whiteSpace:'nowrap'}} onClick={()=>setShowNuevaCausa(true)}>+ Nueva causa</button>
        </div>

        {/* Panel de filtros — oculto por defecto, se despliega solo al apretar "Filtros" */}
        {showFiltros && (
          <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap',alignItems:'center',background:'#fff',borderRadius:16,padding:14,boxShadow:'0 1px 3px rgba(15,23,42,0.06)'}}>
            <select style={{width:'auto',minWidth:150,padding:'8px 12px',border:'none',borderRadius:12,fontSize:12,color:'#1E293B',background:'#F8F9FC',...f}} value={filterTribunal} onChange={e=>setFilterTribunal(e.target.value)}><option value="">Todos los tribunales</option>{tribunales.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <select style={{width:'auto',minWidth:130,padding:'8px 12px',border:'none',borderRadius:12,fontSize:12,color:'#1E293B',background:'#F8F9FC',...f}} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}><option value="">Todos los estados</option>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
            <div style={{width:180}}>
              <SearchableSelect value={filterDelito} onChange={v=>setFilterDelito(v)} options={DELITOS_CATALOGO} placeholder="Todos los delitos" isDelito={true}/>
            </div>
            <select style={{width:'auto',minWidth:130,padding:'8px 12px',border:'none',borderRadius:12,fontSize:12,color:'#1E293B',background:'#F8F9FC',...f}} value={filterRegimen} onChange={e=>setFilterRegimen(e.target.value)}>
              <option value="">RPA / Adulto</option>
              <option value="ADULTO">Solo Adulto</option>
              <option value="RPA">Solo RPA</option>
              <option value="MIXTO">Mixta (RPA y Adulto)</option>
            </select>
            {hayFiltrosActivos && <button className="btn-secondary" style={{fontSize:11,padding:'6px 12px',color:'#dc2626',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}} onClick={limpiarFiltros}>✕ Limpiar</button>}
            <span style={{fontSize:12,color:'#94a3b8',fontWeight:500,marginLeft:'auto',...f}}>{filtered.length} resultado{filtered.length!==1?'s':''}</span>
          </div>
        )}

        {loading?(
          <div style={{textAlign:'center',padding:60,color:'#94a3b8',fontSize:14,...f}}>Cargando causas...</div>
        ):(
          <div style={{background:'#fff',border:'none',borderRadius:20,boxShadow:'0 1px 2px rgba(15,23,42,0.06)',padding:8,overflowX:'auto'}}>
            {/* Encabezado — solo en pantalla ancha */}
            <div className="hide-mobile" style={{display:'grid',gridTemplateColumns:'140px 110px 140px minmax(180px,320px) 1fr',columnGap:24}}>
              {[{key:'ruc',label:'RUC'},{key:'rit',label:'RIT'},{key:'tribunal',label:'Tribunal'},{key:'imputado',label:'Imputado',centrado:true},{key:'delito',label:'Delito',centrado:true}].map(col=>(
                <div key={col.key} className="sort-col" onClick={()=>handleSort(col.key)} style={{padding:'16px 20px 12px',textAlign:col.centrado?'center':'left',fontSize:10,fontWeight:700,color:sortCol===col.key?'#2563eb':'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,...f}}>{col.label}<SortIcon col={col.key}/></div>
              ))}
            </div>
            {filtered.map((c)=>(
              <div key={c.id} className="row-hover causa-row" onClick={()=>openCausa(c)} style={{borderRadius:14}}>
                {/* Fila ancha (PC/tablet) — misma info y orden de siempre */}
                <div className="causa-col-desktop" style={{display:'grid',gridTemplateColumns:'140px 110px 140px minmax(180px,320px) 1fr',columnGap:24}}>
                  <div style={{padding:'14px 20px',fontSize:12,fontWeight:700,color:'#1E293B',...f}}>{c.ruc}</div>
                  <div style={{padding:'14px 20px',fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                      <span>{c.rit||'—'}</span>
                    </div>
                  </div>
                  <div style={{padding:'14px 20px',fontSize:12,color:'#475569',fontWeight:500,...f}}>{c.tribunal}</div>
                  <div style={{padding:'14px 20px',textAlign:'center',...f}}><div style={{maxWidth:'100%',margin:'0 auto',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,color:'#1E293B',fontWeight:500}}>{(c.imputado||'').replace(/\|/g,' / ')}</div></div>
                  <div style={{padding:'14px 20px',textAlign:'center',...f}}><div style={{maxWidth:280,margin:'0 auto',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,color:'#64748b'}}>{(c.delito||'').replace(/\|/g,', ')||'—'}</div></div>
                </div>
                {/* Tarjeta condensada — solo en celular: RUC + estado, luego RIT/Tribunal, luego imputado.
                    Con borde propio para que se vea como una tarjeta enmarcada, no solo una fila. */}
                <div className="causa-row-mobile" style={{padding:'12px 14px',margin:'6px 8px',background:c.estado==='vigente'?'#fafffd':'#F8F9FC',border:`2px solid ${c.estado==='vigente'?'#86efac':'#cbd5e1'}`,borderRadius:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:'#0f172a',...f}}>{c.ruc}</span>
                    <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:'#475569',marginTop:4,...f}}>{c.rit||'—'} · {c.tribunal||'—'}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#1E293B',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',...f}}>{(c.imputado||'').replace(/\|/g,' / ')}</div>
                </div>
              </div>
            ))}
            {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:'#94a3b8',fontSize:14,...f}}>Sin resultados.</div>}
          </div>
        )}
      </div>

      {/* ✅ Ejemplo de animación con Framer Motion (ya estaba en package.json, no
          se agregó nada nuevo) — el fondo se desvanece y la tarjeta entra con un
          leve deslizamiento hacia arriba, en vez de aparecer de golpe. */}
      <AnimatePresence>
      {showNuevaCausa&&(
        <motion.div
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
          style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'5vh',zIndex:200,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&setShowNuevaCausa(false)}>
          <motion.div
            initial={{opacity:0,y:24,scale:0.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:0.98}}
            transition={{duration:0.25,ease:[0.16,1,0.3,1]}}
            style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:32,width:540,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(15,23,42,0.22)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#1E293B',marginBottom:24,...f}}>Nueva Causa</div>
            <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* RUC y RIT */}
              {[{key:'ruc',label:'RUC *',ph:'Ej: 2600123456-7',full:true},{key:'rit',label:'RIT',ph:'Ej: 1234-2026'}].map(field=>(
                <div key={field.key} style={{gridColumn:field.full?'1/-1':'auto'}}>
                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{field.label}</div>
                  <input style={inp} placeholder={field.ph} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}
              {/* Tribunal — agrupado arriba junto con RUC/RIT/Imputado, son los datos
                  base de identificación de la causa. */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tribunal *</div>
                <SearchableSelect
                  value={nuevaCausa.tribunal}
                  onChange={v=>setNuevaCausa(p=>({...p,tribunal:v}))}
                  options={TRIBUNALES_CHILE}
                  placeholder="Seleccionar tribunal..."
                  isDelito={false}
                />
              </div>
              {/* Imputado(s) — uno o más. Cada uno con su propio RUT (con
                  autorelleno independiente), nombre, fecha de nacimiento
                  (con edad en vivo), nacionalidad y domicilio. */}
              {nuevaCausa.imputados.map((imp, idx) => (
                <div key={idx} className="grid2-mobile" style={{gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, ...(idx>0 ? {borderTop:'1px dashed #e2e8f0', paddingTop:16, marginTop:2} : {})}}>
                  {nuevaCausa.imputados.length > 1 && (
                    <div style={{gridColumn:'1/-1', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div style={{fontSize:12, fontWeight:700, color:'#1E293B', ...f}}>Imputado {idx+1}</div>
                      {idx > 0 && (
                        <button type="button" className="btn-secondary" style={{fontSize:11, padding:'4px 10px'}} onClick={()=>quitarImputadoNuevaCausa(idx)}>✕ Quitar</button>
                      )}
                    </div>
                  )}
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>RUT del imputado</div>
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...inp,flex:1}} placeholder="Ej: 12345678-9"
                        value={imp.rut}
                        onChange={e=>actualizarImputadoNuevaCausa(idx,'rut',e.target.value)}
                        onBlur={e=>buscarRutNuevaCausa(e.target.value, idx)}
                        onKeyDown={e=>e.key==='Enter'&&buscarRutNuevaCausa(imp.rut, idx)}
                      />
                      {rutBuscando[idx] && <span style={{fontSize:12,color:'#94a3b8',alignSelf:'center',...f}}>Buscando...</span>}
                      {rutEncontrado[idx] && <span style={{fontSize:12,color:'#065f46',alignSelf:'center',fontWeight:600,...f}}>✓ Datos encontrados</span>}
                    </div>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nombre completo *</div>
                    <input style={inp} placeholder="Nombre completo del imputado"
                      value={imp.nombre}
                      onChange={e=>actualizarImputadoNuevaCausa(idx,'nombre',e.target.value)}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de nacimiento</div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="date" style={inp}
                        value={imp.fecha_nac}
                        onChange={e=>actualizarImputadoNuevaCausa(idx,'fecha_nac',e.target.value)}/>
                      {imp.fecha_nac && (() => {
                        const edad = calcularEdadActual(imp.fecha_nac)
                        return edad !== null ? <span style={{flexShrink:0,fontSize:11,color:'#1E293B',fontWeight:600,background:'#eff6ff',padding:'4px 9px',borderRadius:10,...f}}>{edad} AÑOS HOY</span> : null
                      })()}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nacionalidad</div>
                    <input style={inp} placeholder="Ej: CHILENO"
                      value={imp.nacionalidad}
                      onChange={e=>actualizarImputadoNuevaCausa(idx,'nacionalidad',e.target.value)}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Domicilio</div>
                    <input style={inp} placeholder="Domicilio del imputado"
                      value={imp.domicilio}
                      onChange={e=>actualizarImputadoNuevaCausa(idx,'domicilio',e.target.value)}/>
                  </div>
                  {/* Centro Penal — por imputado, cada uno puede estar en un recinto distinto */}
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Centro Penal</div>
                    <SearchableSelect
                      value={imp.centro_penal}
                      onChange={v=>actualizarImputadoNuevaCausa(idx,'centro_penal',v)}
                      options={CENTROS_PENALES}
                      placeholder="Buscar centro penal..."
                      isDelito={false}
                    />
                  </div>
                  {/* Cautelar — por imputado, cada uno puede tener una medida distinta */}
                  <div style={{gridColumn: (TIPOS_ABONO_DIRECTO.includes(imp.cautelar) || imp.cautelar === CAUTELAR_SENAME) ? '1/-1' : 'auto'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Cautelar</div>
                    <select style={inp} value={imp.cautelar} onChange={e=>{
                      const nuevoTipo = e.target.value
                      setNuevaCausa(p=>({...p, imputados: p.imputados.map((x,i)=>i!==idx?x:{...x, cautelar:nuevoTipo, cautelar_fecha_inicio: x.cautelar_fecha_inicio || new Date().toISOString().slice(0,10)})}))
                    }}>
                      <option value="">Seleccionar...</option>
                      {TIPOS_CAUTELARES_TODAS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {(TIPOS_ABONO_DIRECTO.includes(imp.cautelar) || imp.cautelar === CAUTELAR_SENAME) && (
                      <div style={{marginTop:10,padding:'12px 14px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                        <div>
                          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de inicio *</div>
                          <input type="date" style={{...inp, ...(imp.cautelar_fecha_inicio ? {} : {borderColor:'#fca5a5'})}} value={imp.cautelar_fecha_inicio} onChange={e=>actualizarImputadoNuevaCausa(idx,'cautelar_fecha_inicio',e.target.value)}/>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:16}}>
                          <span style={{fontSize:16}}>🔒</span>
                          <strong style={{...f}}>{diasEntreFechasCaut(imp.cautelar_fecha_inicio, new Date().toISOString().slice(0,10))} días{imp.cautelar === CAUTELAR_SENAME ? ' (SENAME, aparte)' : ' de abono'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Delito(s) — por imputado, cada coimputado puede enfrentar cargos distintos */}
                  <div style={{gridColumn:'1/-1'}}>
                    <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Delito(s) *</div>
                    <DelitosChips
                      value={imp.delito}
                      onChange={v=>actualizarImputadoNuevaCausa(idx,'delito',v)}
                      options={DELITOS_CATALOGO}
                    />
                  </div>
                </div>
              ))}
              <div style={{gridColumn:'1/-1'}}>
                <button type="button" className="btn-secondary" style={{fontSize:12}} onClick={agregarImputadoNuevaCausa}>+ Agregar otro imputado</button>
              </div>
              {/* Fiscal */}
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fiscal</div>
                <input style={inp} placeholder="Nombre del fiscal" value={nuevaCausa.fiscal} onChange={e=>setNuevaCausa(p=>({...p,fiscal:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de los hechos</div>
                <input type="date" style={inp} value={nuevaCausa.fecha_hechos} onChange={e=>setNuevaCausa(p=>({...p,fecha_hechos:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1.5px solid #a7f3d0',borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'#059669',marginBottom:14,...f}}>⏱ Cálculo de plazo ACD</div>
                <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha inicio</div><input type="date" style={inp} value={nuevaCausa.fecha_inicio} onChange={e=>setNuevaCausa(p=>({...p,fecha_inicio:e.target.value}))}/></div>
                  <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días plazo</div><input type="number" style={inp} placeholder="Ej: 210" value={nuevaCausa.dias_plazo} onChange={e=>setNuevaCausa(p=>({...p,dias_plazo:e.target.value}))}/></div>
                </div>
                {nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo && (<div style={{marginTop:10,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #a7f3d0',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📅</span><div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento calculado</div><div style={{fontSize:15,fontWeight:800,color:'#059669',...f}}>{calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)}</div></div></div>)}
                <div style={{marginTop:12}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>O ingresa plazo manualmente</div><input style={inp} placeholder="VENCE DD-MM-YYYY" value={nuevaCausa.plazo} onChange={e=>setNuevaCausa(p=>({...p,plazo:e.target.value}))}/></div>
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Estado</div>
                <select style={inp} value={nuevaCausa.estado} onChange={e=>setNuevaCausa(p=>({...p,estado:e.target.value,subestado:''}))}>
                  <option value="vigente">{estadoConfig.vigente.label}</option>
                  <option value="terminada">{estadoConfig.terminada.label}</option>
                </select>
              </div>
              <div>
                {/* Subestado — opcional. Si no se elige, se calcula solo según el plazo
                    (vencido / por vencer) al guardar, igual que antes. Útil para dejar la
                    causa ya en "Juicio Oral", "APJO", etc. desde que se crea, sin tener que
                    editarla después en el detalle. */}
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Subestado (opcional)</div>
                <select style={inp} value={nuevaCausa.subestado} onChange={e=>setNuevaCausa(p=>({...p,subestado:e.target.value}))}>
                  <option value="">Se calcula solo según el plazo</option>
                  {(nuevaCausa.estado==='terminada'?SUBESTADOS_TERMINADA:SUBESTADOS_VIGENTE).map(s=><option key={s} value={s}>{estadoConfig[s].label}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button className="btn-primary" onClick={saveCausa} disabled={saving||!nuevaCausa.ruc||nuevaCausa.imputados.some(imp=>(TIPOS_ABONO_DIRECTO.includes(imp.cautelar)||imp.cautelar===CAUTELAR_SENAME)&&!imp.cautelar_fecha_inicio)}>{saving?'Guardando...':'Guardar causa'}</button>
              <button className="btn-secondary" onClick={()=>setShowNuevaCausa(false)}>Cancelar</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
