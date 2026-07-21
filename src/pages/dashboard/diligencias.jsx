// Panel de Diligencias de Fiscalía dentro de una causa: registro, carga de
// comprobantes (PDF/imagen con OCR) y cálculo de plazos hábiles.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { BotonImprimirLista } from './resumen'
import { fechaDDMM, sanitizarNombreArchivo } from './utils'

// ✅ FIX: se deja SOLO la lista oficial, tal cual aparece en el desplegable
// "Seleccione Solicitud" de Mi Fiscalía en Línea (agenda.minpublico.cl) — a
// pedido explícito de Joaquín, se sacan las que no son oficiales ("Declaración
// de imputado", "Petición de carpeta", "Entrevista con el fiscal",
// "Reconstitución de escena", "Careo", "Otra diligencia").
// ✅ NUEVO: se agrega "Activar/Anular acreditación de representación" — no
// sale en ese desplegable, pero es igual de oficial: es el "Detalle
// Servicio" real que aparece impreso (con el sello de Fiscalía) en los
// comprobantes de la gestión de causa del portal, y Joaquín confirmó que sí
// lo usa.
export const TIPOS_DILIGENCIA = [
  'Solicitud de diligencias de investigación',
  'Información específica sobre término de una causa',
  'Información sobre diligencias de investigación',
  'Solicitud de copia de la carpeta',
  'Solicitud de audiencia o entrevista',
  'Solicitud de cambio de fecha/hora de citación o entrevista',
  'Solicitud de devolución de especies/dinero',
  'Solicitud de revisión de la carpeta de investigación',
  'Solicitud de revisión de evidencia',
  'Aporte de antecedentes asociados a una causa',
  'Solicitud de documentos específicos de la causa',
  'Activar/Anular acreditación de representación',
]
export const ESTADOS_DILIGENCIA = {
  pendiente:    { label:'Pendiente de respuesta',   color:'#92400e', bg:'#fff7ed', border:'#fed7aa' },
  aprobada:     { label:'Aprobada',                 color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
  con_citacion: { label:'Con fecha de citación',     color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe' },
  rechazada:    { label:'Rechazada',                color:'#991b1b', bg:'#fef2f2', border:'#fecaca' },
}

let _pdfjsCargando = null
function cargarPdfJs() {
  if (typeof window !== 'undefined' && window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  if (_pdfjsCargando) return _pdfjsCargando
  _pdfjsCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(window.pdfjsLib)
      } catch (e) { reject(e) }
    }
    script.onerror = () => reject(new Error('No se pudo cargar el lector de PDF (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _pdfjsCargando
}

export async function extraerTextoPdf(file) {
  const pdfjsLib = await cargarPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texto += content.items.map(it => it.str).join(' ') + '\n'
  }
  return texto
}

// ✅ NUEVO: intenta adivinar cuál de los tipos OFICIALES (TIPOS_DILIGENCIA)
// corresponde según el texto del "Detalle Servicio" o de la observación del
// comprobante — por palabras clave, sin tildes para no fallar por acentos.
// Si no encuentra ninguna coincidencia confiable, devuelve '' (no se
// inventa un tipo — mejor dejar que Joaquín lo elija a mano viendo el
// detalle real, que siempre queda visible en la observación).
function adivinarTipoOficial(texto) {
  const t = (texto || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (t.includes('ACREDITA')) return 'Activar/Anular acreditación de representación'
  if (t.includes('COPIA') && t.includes('CARPETA')) return 'Solicitud de copia de la carpeta'
  if (t.includes('REVISION') && t.includes('CARPETA')) return 'Solicitud de revisión de la carpeta de investigación'
  if (t.includes('REVISION') && t.includes('EVIDENCIA')) return 'Solicitud de revisión de evidencia'
  if ((t.includes('CAMBIO') || t.includes('REPROGRAMA')) && (t.includes('FECHA') || t.includes('HORA')) && (t.includes('CITACION') || t.includes('ENTREVISTA'))) return 'Solicitud de cambio de fecha/hora de citación o entrevista'
  if (t.includes('AUDIENCIA') || t.includes('ENTREVISTA')) return 'Solicitud de audiencia o entrevista'
  if (t.includes('DEVOLUCION') && (t.includes('ESPECIE') || t.includes('DINERO'))) return 'Solicitud de devolución de especies/dinero'
  if (t.includes('TERMINO') && t.includes('CAUSA')) return 'Información específica sobre término de una causa'
  if (t.includes('APORTE') && t.includes('ANTECEDENTE')) return 'Aporte de antecedentes asociados a una causa'
  if (t.includes('DOCUMENTO') && t.includes('ESPECIFIC')) return 'Solicitud de documentos específicos de la causa'
  if (t.includes('DILIGENCIA') && t.includes('INVESTIGACION') && t.includes('INFORMACION')) return 'Información sobre diligencias de investigación'
  if (t.includes('DILIGENCIA') && t.includes('INVESTIGACION')) return 'Solicitud de diligencias de investigación'
  return ''
}

// Reconoce el formato del "Comprobante Ingreso Solicitud Asociada a una Causa"
// de mi.Fiscalía en línea. Es a prueba de variaciones menores de espaciado,
// pero siempre se muestra al usuario para que revise/corrija antes de guardar.
export function parsearComprobanteFiscalia(texto) {
  const buscar = (regex) => { const m = texto.match(regex); return m ? m[1].replace(/\s+/g,' ').trim() : '' }
  // ✅ FIX: en el PDF real, pdf.js extrae primero TODAS las etiquetas
  // ("Nombre Solicitante RUT Fecha Ingreso ... RUC Nombre Caso ...") y RECIÉN
  // DESPUÉS todos los valores en otro orden — la palabra "RUC" nunca queda
  // pegada a su número, así que buscar "RUC seguido del número" nunca
  // encontraba nada y "ruc" quedaba vacío. En vez de depender del orden del
  // texto, se buscan directamente todos los RUT/RUC del documento (formato
  // dígitos-guión-verificador) y se toma el que tiene MÁS dígitos: el RUC de
  // una causa es de 9-10 dígitos, mientras que el RUT de una persona
  // (solicitante o representado) tiene 7-8 — así no se confunden entre sí.
  const candidatosRuc = (texto.match(/\b(\d{6,10}-[\dkK])\b/gi) || []).sort((a, b) => b.length - a.length)
  const ruc = candidatosRuc[0] || buscar(/RUC\s+(\d{6,10}-[\dkK])/i)
  const fechaIngresoRaw = buscar(/Fecha Ingreso\s+(\d{2}\/\d{2}\/\d{4})/i)
  const fiscal = buscar(/Fiscal Asignado\s+([A-ZÁÉÍÓÚÑ ]+?)(?=\s+Representado|\s+Tipo Abogado|$)/i)
  const representado = buscar(/Representado\s+([A-ZÁÉÍÓÚÑ ]+?)(?=\s+Tipo Abogado|$)/i)
  const nombreCaso = buscar(/Nombre Caso\s+([^\n]+?)(?=\s+Fiscalia|$)/i)

  // ✅ FIX: antes esto tomaba el PRIMER número largo del documento — pero el
  // RUC (ej. "2600437612-8") aparece ANTES que el Folio en el comprobante, y
  // sus 10 dígitos (sin el guión ni el dígito verificador) igual calzaban con
  // \d{10,15}, así que el folio guardado terminaba siendo el RUC. Ahora se
  // saca el RUC del texto ANTES de buscar, para que sus dígitos nunca
  // compitan, y entre los números que queden se toma el más LARGO — el folio
  // real (13 dígitos típicamente) siempre es más largo que el N° de
  // Solicitud, el RUT del solicitante u otros números que puedan aparecer.
  const textoSinRuc = ruc ? texto.replace(new RegExp(`RUC\\s+${ruc.replace('-', '\\-')}`, 'i'), '') : texto
  const numeros = (textoSinRuc.match(/\b\d{8,20}\b/g) || []).sort((a, b) => b.length - a.length)
  const folio = numeros[0] || ''

  // Observación / detalle de lo solicitado: todo el texto entre "Observación"
  // (encabezado de la tabla) y "Documentos Adjuntos".
  // ✅ FIX: el bloque entre "Observación" y "Documentos Adjuntos" trae PEGADO
  // por delante el "Detalle Servicio" y el "Estado" de la fila (ej.
  // "Activar/Anular acreditación de representación 1406310459777 10706440
  // Ingresado ..."), porque el PDF ordena esas columnas antes que la
  // observación real. Antes solo se recortaba el prefijo "Ingreso Solicitud
  // Portal." si quedaba justo al INICIO del bloque — como en la práctica casi
  // nunca queda al inicio, ese recorte nunca se aplicaba y se guardaba
  // "Folio N° Solicitud Detalle Servicio Estado..." completo. Ahora se busca
  // esa frase EN CUALQUIER PARTE del bloque (siempre marca el inicio real de
  // la observación en este formato de comprobante) y se toma todo desde ahí.
  let observacion = ''
  // ✅ NUEVO: "Detalle Servicio" es el motivo real de la petición (ej.
  // "Activar/Anular acreditación de representación") — es el texto que
  // queda ANTES del folio en ese mismo bloque revuelto. Antes no se
  // guardaba en ningún lado, así que si el tipo no se adivinaba bien, ese
  // motivo se perdía por completo. Ahora se guarda aparte y se antepone a
  // la observación, para que SIEMPRE se vea qué se pidió exactamente,
  // aunque el tipo automático no calce con ninguna opción oficial.
  let detalleServicio = ''
  const idxObs = texto.indexOf('Observación')
  const idxDocs = texto.indexOf('Documentos Adjuntos')
  if (idxObs !== -1) {
    const fin = idxDocs !== -1 ? idxDocs : texto.length
    let bloque = texto.slice(idxObs + 'Observación'.length, fin).replace(/\s+/g,' ').trim()
    const idxPrimerNumeroLargo = bloque.search(/\d{6,}/)
    if (idxPrimerNumeroLargo > 0) detalleServicio = bloque.slice(0, idxPrimerNumeroLargo).trim()
    const idxPortal = bloque.search(/Ingreso Solicitud Portal\.?/i)
    if (idxPortal !== -1) bloque = bloque.slice(idxPortal)
    observacion = bloque.replace(/^Ingreso Solicitud Portal\.?\s*/i, '')
  }
  const tipoDetectado = adivinarTipoOficial(detalleServicio) || adivinarTipoOficial(observacion)

  let fechaSolicitud = ''
  if (fechaIngresoRaw) {
    const [d,m,y] = fechaIngresoRaw.split('/')
    if (d && m && y) fechaSolicitud = `${y}-${m}-${d}`
  }

  return { ruc, fechaSolicitud, fiscal, representado, nombreCaso, folio, observacion, detalleServicio, tipoDetectado }
}

// ─── LECTURA DE SCREENSHOTS (imágenes) DEL COMPROBANTE — vía OCR ─────────────
// A diferencia del PDF (que ya trae texto real), una foto/captura es solo
// píxeles: hay que leerla con reconocimiento óptico de caracteres (OCR).
// Se usa Tesseract.js cargado desde un CDN en tiempo de ejecución (mismo
// enfoque que pdf.js, no requiere tocar package.json).
let _tesseractCargando = null
function cargarTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract)
  if (_tesseractCargando) return _tesseractCargando
  _tesseractCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js'
    script.onload = () => resolve(window.Tesseract)
    script.onerror = () => reject(new Error('No se pudo cargar el lector de imágenes (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _tesseractCargando
}

async function extraerTextoImagen(file) {
  const Tesseract = await cargarTesseract()
  const { data } = await Tesseract.recognize(file, 'spa')
  return data.text || ''
}

// Días HÁBILES transcurridos desde una fecha (excluye sábados y domingos) —
// para avisar cuando ya pasaron los ~5 días hábiles típicos de respuesta de
// Fiscalía y todavía no ha llegado nada, así el usuario sabe que debe
// hacer seguimiento.
function diasHabilesDesde(fechaISO) {
  if (!fechaISO) return 0
  const inicio = new Date(fechaISO + 'T00:00:00')
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  if (isNaN(inicio) || inicio > hoy) return 0
  let dias = 0
  const cursor = new Date(inicio)
  while (cursor < hoy) {
    cursor.setDate(cursor.getDate() + 1)
    const diaSemana = cursor.getDay() // 0=domingo, 6=sábado
    if (diaSemana !== 0 && diaSemana !== 6) dias++
  }
  return dias
}

export function DiligenciasFiscalia({ causaId, ruc, email, registrarActividad, onAccion }) {
  const [diligencias, setDiligencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tipo: TIPOS_DILIGENCIA[0], fecha_solicitud: new Date().toISOString().slice(0,10), folio:'', observacion:'' })
  const [guardando, setGuardando] = useState(false)
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [editandoDatosId, setEditandoDatosId] = useState(null)
  const [formEdit, setFormEdit] = useState({ tipo:'', fecha_solicitud:'', folio:'', observacion:'' })
  const [motivoEditDatos, setMotivoEditDatos] = useState('')
  const [formResp, setFormResp] = useState({ estado:'aprobada', fecha_respuesta:new Date().toISOString().slice(0,10), fecha_citacion:'', respuesta_detalle:'' })
  const [subiendoId, setSubiendoId] = useState(null) // id de la diligencia que está subiendo un archivo (comprobante o respuesta)
  const [analizandoPdf, setAnalizandoPdf] = useState(false)
  const [dragPdf, setDragPdf] = useState(false)
  const [comprobantePendiente, setComprobantePendiente] = useState(null) // File detectado, se sube junto con la diligencia al guardar
  const [avisoRuc, setAvisoRuc] = useState('') // aviso si el RUC leído del PDF no coincide con esta causa
  const nuevaDiligenciaFileRef = useRef(null)
  const comprobanteInputRef = useRef(null)
  const respuestaInputRef = useRef(null)
  const f = { fontFamily:"'Manrope','Inter',sans-serif" }
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }

  useEffect(() => { cargar() }, [causaId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('diligencias_fiscalia').select('*').eq('causa_id', causaId).order('fecha_solicitud', { ascending:false })
    setDiligencias(data || [])
    setLoading(false)
  }

  const agregar = async () => {
    if (!form.folio.trim()) { alert('El folio es obligatorio — es tu número de seguimiento ante la Fiscalía. Exígelo siempre al hacer la solicitud.'); return }
    if (!form.fecha_solicitud) return
    setGuardando(true)
    const { data, error } = await supabase.from('diligencias_fiscalia').insert({
      causa_id: causaId, tipo: form.tipo, fecha_solicitud: form.fecha_solicitud, folio: form.folio.toUpperCase(), observacion: form.observacion || null, estado:'pendiente', registrado_por: email
    }).select().single()
    if (error || !data) {
      // ✅ Antes esto fallaba en silencio y solo cerraba el formulario. Ahora
      // se muestra el error real y NO se pierde lo que ya habías escrito.
      alert('No se pudo guardar la diligencia: ' + (error?.message || 'Error desconocido. Revisa la consola del navegador (F12) para más detalle.'))
      setGuardando(false)
      return
    }
    let dataFinal = data
    // Si el comprobante se detectó por PDF (arrastrado), se sube y se adjunta
    // automáticamente a esta misma diligencia — sin tener que volver a subirlo.
    if (comprobantePendiente) {
      try {
        const path = `diligencias/${data.id}/comprobante_${Date.now()}_${sanitizarNombreArchivo(comprobantePendiente.name)}`
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, comprobantePendiente)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
          const camposArchivo = { comprobante_url: urlData.publicUrl, comprobante_path: path, comprobante_nombre: comprobantePendiente.name }
          await supabase.from('diligencias_fiscalia').update(camposArchivo).eq('id', data.id)
          dataFinal = { ...data, ...camposArchivo }
        }
      } catch { /* si falla el adjunto, la diligencia igual queda guardada */ }
    }
    setDiligencias(prev => [dataFinal, ...prev])
    if (registrarActividad) registrarActividad('accion', `Registró diligencia "${form.tipo}" (folio ${form.folio}) en RUC ${ruc}`)
    if (onAccion) onAccion()
    setForm({ tipo: TIPOS_DILIGENCIA[0], fecha_solicitud: new Date().toISOString().slice(0,10), folio:'', observacion:'' })
    setComprobantePendiente(null)
    setAvisoRuc('')
    setShowForm(false)
    setGuardando(false)
  }

  const normalizarRuc = (r) => (r||'').replace(/[.\-\s]/g,'').toUpperCase()

  // ✅ Corregir el folio, fecha, tipo u observación de una diligencia ya
  // registrada — para cuando la lectura automática del PDF se equivoca
  // (folio duplicado o mal leído), sin tener que borrar todo y perder el
  // comprobante ya adjuntado.
  const empezarEdicionDatos = (d) => {
    setEditandoDatosId(d.id)
    setFormEdit({ tipo: d.tipo, fecha_solicitud: d.fecha_solicitud, folio: d.folio, observacion: d.observacion || '' })
    setMotivoEditDatos('')
  }

  const guardarEdicionDatos = async (id) => {
    if (!formEdit.folio.trim()) { alert('El folio no puede quedar vacío.'); return }
    if (!formEdit.fecha_solicitud) return
    if (!motivoEditDatos.trim()) { alert('Ingresa el motivo de la corrección — queda registrado para tener trazabilidad.'); return }
    const anterior = diligencias.find(d => d.id === id)
    const lineaHistorial = `[${new Date().toLocaleString('es-CL')}] Corregido por ${email||'usuario'}. Motivo: ${motivoEditDatos.trim()}. Antes era: ${anterior?.tipo||'—'}, ${fechaDDMM(anterior?.fecha_solicitud)||'—'}, folio ${anterior?.folio||'—'}.`
    const nuevoHistorial = anterior?.historial ? anterior.historial + '\n' + lineaHistorial : lineaHistorial
    const campos = { tipo: formEdit.tipo, fecha_solicitud: formEdit.fecha_solicitud, folio: formEdit.folio.toUpperCase(), observacion: formEdit.observacion || null, historial: nuevoHistorial }
    await supabase.from('diligencias_fiscalia').update(campos).eq('id', id)
    setDiligencias(prev => prev.map(d => d.id === id ? { ...d, ...campos } : d))
    setEditandoDatosId(null)
    if (registrarActividad) registrarActividad('accion', `Corrigió datos de una diligencia (folio ${formEdit.folio}) en RUC ${ruc}: ${motivoEditDatos.trim()}`)
    if (onAccion) onAccion()
  }

  const empezarRespuesta = (d) => {
    setRespondiendoId(d.id)
    setFormResp({
      estado: d.estado !== 'pendiente' ? d.estado : 'aprobada',
      fecha_respuesta: d.fecha_respuesta || new Date().toISOString().slice(0,10),
      fecha_citacion: d.fecha_citacion || '',
      respuesta_detalle: d.respuesta_detalle || '',
    })
  }

  const guardarRespuesta = async (id) => {
    if (!formResp.fecha_respuesta) return
    const campos = {
      estado: formResp.estado,
      fecha_respuesta: formResp.fecha_respuesta,
      fecha_citacion: formResp.estado === 'con_citacion' ? (formResp.fecha_citacion || null) : null,
      respuesta_detalle: formResp.respuesta_detalle || null,
    }
    await supabase.from('diligencias_fiscalia').update(campos).eq('id', id)
    setDiligencias(prev => prev.map(d => d.id === id ? { ...d, ...campos } : d))
    setRespondiendoId(null)
    if (registrarActividad) registrarActividad('accion', `Registró respuesta de Fiscalía (${ESTADOS_DILIGENCIA[formResp.estado]?.label}) en RUC ${ruc}`)
    if (onAccion) onAccion()
  }

  // ⚠️ Por regla general las diligencias de Fiscalía NO se eliminan (sirven
  // como medio de prueba y argumento de alegatos). Esto es solo para corregir
  // errores reales de carga: una lectura automática duplicada, un folio mal
  // detectado, etc. — por eso pide confirmar dos veces antes de borrar.
  const eliminarDiligencia = async (d) => {
    if (!window.confirm(`¿Seguro que quieres eliminar esta diligencia?\n\n"${d.tipo}" — Folio ${d.folio}\n\nEsto NO se puede deshacer. Solo hazlo si es un error de carga (por ejemplo, quedó duplicada o el folio se leyó mal) — nunca para borrar una diligencia real.`)) return
    if (!window.confirm('Confirma una segunda vez: ¿eliminar definitivamente esta diligencia?')) return
    await supabase.from('diligencias_fiscalia').delete().eq('id', d.id)
    setDiligencias(prev => prev.filter(x => x.id !== d.id))
    if (registrarActividad) registrarActividad('accion', `Eliminó diligencia "${d.tipo}" (folio ${d.folio}) en RUC ${ruc} — corrección de error de carga`)
    if (onAccion) onAccion()
  }

  // ✅ Antes de guardar cualquier documento (comprobante o respuesta) desde las
  // tarjetas ya existentes, se pide confirmar el RUC que aparece en ese PDF.
  // Si no coincide con el RUC de esta causa, se avisa antes de subirlo — para
  // evitar arrastrarlo a la causa equivocada por error.
  const confirmarRucYSubir = (file, tipoDoc, diligenciaId) => {
    const rucIngresado = window.prompt(`Confirma el RUC que aparece en este documento (esta causa es RUC ${ruc}):`, ruc)
    if (rucIngresado === null) return // canceló
    if (normalizarRuc(rucIngresado) !== normalizarRuc(ruc)) {
      const continuar = window.confirm(`⚠ El RUC que escribiste (${rucIngresado}) no coincide con el RUC de esta causa (${ruc}).\n\n¿Seguro que quieres guardar este documento aquí de todas formas?`)
      if (!continuar) return
    }
    subirDocumento(file, tipoDoc, diligenciaId)
  }

  const subirDocumento = async (file, tipoDoc, diligenciaId) => {
    setSubiendoId(diligenciaId)
    try {
      const path = `diligencias/${diligenciaId}/${tipoDoc}_${Date.now()}_${sanitizarNombreArchivo(file.name)}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      const campos = tipoDoc === 'comprobante'
        ? { comprobante_url: urlData.publicUrl, comprobante_path: path, comprobante_nombre: file.name }
        : { respuesta_url: urlData.publicUrl, respuesta_path: path, respuesta_nombre: file.name }
      await supabase.from('diligencias_fiscalia').update(campos).eq('id', diligenciaId)
      setDiligencias(prev => prev.map(d => d.id === diligenciaId ? { ...d, ...campos } : d))
      if (registrarActividad) registrarActividad('accion', `Adjuntó ${tipoDoc==='comprobante'?'comprobante':'respuesta'} de diligencia en RUC ${ruc}`)
      if (onAccion) onAccion()
    } catch (err) {
      alert('No se pudo subir el archivo: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setSubiendoId(null)
    }
  }

  // ✅ Al arrastrar/seleccionar el comprobante (PDF o screenshot/imagen) de
  // Fiscalía para una diligencia NUEVA: se lee el texto (o se hace OCR si es
  // una imagen), se completan folio/fecha/observación solas, y el archivo
  // queda listo para adjuntarse automáticamente al guardar. Nunca se guarda
  // nada sin que el usuario revise y confirme — el formulario siempre se abre
  // para poder corregir cualquier campo antes de "Guardar diligencia".
  const procesarPdfComprobante = async (file) => {
    const esPdf = file?.type === 'application/pdf'
    const esImagen = file?.type?.startsWith('image/')
    if (!file || (!esPdf && !esImagen)) { alert('Solo se aceptan archivos PDF o imágenes (screenshot).'); return }
    setAnalizandoPdf(true)
    setAvisoRuc('')
    try {
      const texto = esPdf ? await extraerTextoPdf(file) : await extraerTextoImagen(file)
      const datos = parsearComprobanteFiscalia(texto)
      // ✅ FIX: antes "tipo" nunca se completaba con lo leído del comprobante
      // — se quedaba en lo que ya tuviera el formulario (por defecto, el
      // primer ítem de la lista), así que SIEMPRE mostraba ese mismo tipo
      // sin importar qué se hubiera pedido en realidad. Ahora se usa el tipo
      // detectado por palabras clave (ver adivinarTipoOficial) si hay uno
      // confiable; si no, se antepone igual el "Detalle Servicio" real (ej.
      // "Activar/Anular acreditación de representación") al detalle, para
      // que el motivo real de la petición nunca quede oculto — Joaquín
      // elige el tipo correcto a mano si ninguno de los oficiales calza.
      const detalleCompleto = [datos.detalleServicio, datos.observacion].filter(Boolean).join(' — ')
      setForm(p => ({
        ...p,
        tipo: datos.tipoDetectado || p.tipo,
        folio: datos.folio || p.folio,
        fecha_solicitud: datos.fechaSolicitud || p.fecha_solicitud,
        observacion: detalleCompleto || p.observacion,
      }))
      setComprobantePendiente(file)
      if (datos.ruc && normalizarRuc(datos.ruc) !== normalizarRuc(ruc)) {
        setAvisoRuc(`⚠ Este comprobante indica RUC ${datos.ruc}, pero esta causa es RUC ${ruc}. Revisa antes de guardar — puede que corresponda a otra causa.`)
      }
      if (!datos.folio) {
        alert(esImagen
          ? 'No se pudo detectar el folio automáticamente en la imagen (el OCR de screenshots es menos preciso que leer un PDF) — complétalo a mano antes de guardar.'
          : 'No se pudo detectar el folio automáticamente — complétalo a mano antes de guardar.')
      }
    } catch (err) {
      alert('No se pudo leer el comprobante automáticamente. Completa los datos a mano. (' + (err?.message || '') + ')')
    } finally {
      setAnalizandoPdf(false)
      setShowForm(true)
    }
  }

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13, ...f }}>Cargando diligencias...</div>

  const pendientesConAviso = diligencias.filter(d => d.estado === 'pendiente' && diasHabilesDesde(d.fecha_solicitud) >= 5).length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }} className="no-imprimir">
        <BotonImprimirLista ruc={ruc} titulo="Diligencias de Fiscalía" items={diligencias} renderItem={(d)=> (
          <div style={{fontSize:12,color:'#475569'}}>
            <strong style={{color:'#1E293B'}}>{d.tipo}</strong> — solicitada el {fechaDDMM(d.fecha_solicitud)}{d.folio ? ` · Folio ${d.folio}` : ''}
            {d.estado === 'pendiente' ? ' · Pendiente de respuesta' : ` · Respondida el ${fechaDDMM(d.fecha_respuesta) || '—'}${d.estado === 'con_citacion' && d.fecha_citacion ? ` · Cita el ${fechaDDMM(d.fecha_citacion)}` : ''}`}
          </div>
        )}/>
      </div>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16, lineHeight:1.6, ...f }}>
        Cada solicitud a Fiscalía (declaración, petición de carpeta, entrevista con el fiscal, etc.) entrega un <strong>folio de seguimiento</strong> al momento de ingresarla — exígelo siempre y regístralo aquí. Días después llega la respuesta por correo: aprobada, con fecha de citación, o rechazada con motivo.
      </div>

      {pendientesConAviso > 0 && (
        <div style={{ fontSize:12, color:'#991b1b', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px', marginBottom:14, fontWeight:600, ...f }}>
          ⚠ Tienes {pendientesConAviso} diligencia{pendientesConAviso!==1?'s':''} con más de 5 días hábiles sin respuesta — puede que sea hora de hacer seguimiento.
        </div>
      )}

      {diligencias.length === 0 && <p style={{ color:'#94a3b8', fontSize:13, marginBottom:14, ...f }}>Sin diligencias registradas todavía.</p>}

      {diligencias.map(d => {
        const cfg = ESTADOS_DILIGENCIA[d.estado] || ESTADOS_DILIGENCIA.pendiente
        const diasHabiles = d.estado === 'pendiente' ? diasHabilesDesde(d.fecha_solicitud) : 0
        const avisoSeguimiento = d.estado === 'pendiente' && diasHabiles >= 5
        return (
          <div key={d.id} style={{ background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', ...f }}>{d.tipo}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>Solicitada el {fechaDDMM(d.fecha_solicitud)} · Folio <strong style={{color:'#475569'}}>{d.folio}</strong></div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, textTransform:'uppercase', letterSpacing:0.3, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}`, ...f }}>{cfg.label}</span>
                {avisoSeguimiento && (
                  <span style={{ fontSize:10, fontWeight:700, color:'#991b1b', ...f }}>⚠ {diasHabiles} días hábiles sin respuesta</span>
                )}
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>empezarEdicionDatos(d)} style={{ fontSize:10, color:'#2563eb', background:'transparent', border:'none', cursor:'pointer', padding:0, marginTop:2, fontWeight:600, ...f }}>
                    ✏ Editar
                  </button>
                  <button onClick={()=>eliminarDiligencia(d)} title="Solo para corregir errores de carga (duplicados, folio mal leído, etc.)"
                    style={{ fontSize:10, color:'#cbd5e1', background:'transparent', border:'none', cursor:'pointer', padding:0, marginTop:2, ...f }}>
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            </div>

            {editandoDatosId === d.id ? (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #e2e8f0' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Tipo de diligencia</div>
                    <select style={inp} value={formEdit.tipo} onChange={e=>setFormEdit(p=>({...p,tipo:e.target.value}))}>
                      {/* ✅ Si esta diligencia se guardó con un tipo que ya no está en la
                          lista oficial (ej. una antigua "Declaración de imputado" o "Otra
                          diligencia"), se agrega igual como opción — así nunca se cambia
                          solo por abrir a editar sin querer, aunque ya no se pueda elegir
                          de nuevo para diligencias nuevas. */}
                      {!TIPOS_DILIGENCIA.includes(formEdit.tipo) && formEdit.tipo && <option value={formEdit.tipo}>{formEdit.tipo} (tipo anterior, ya no oficial)</option>}
                      {TIPOS_DILIGENCIA.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Fecha de la solicitud</div>
                    <input type="date" style={inp} value={formEdit.fecha_solicitud} onChange={e=>setFormEdit(p=>({...p,fecha_solicitud:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'#dc2626', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:700, ...f }}>Folio *</div>
                    <input style={{...inp,borderColor:'#fecaca'}} value={formEdit.folio} onChange={e=>setFormEdit(p=>({...p,folio:e.target.value}))}/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Detalle de lo solicitado</div>
                    <textarea style={{...inp,minHeight:76,resize:'vertical',lineHeight:1.5}} rows={3} value={formEdit.observacion} onChange={e=>setFormEdit(p=>({...p,observacion:e.target.value}))}/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:10, color:'#dc2626', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:700, ...f }}>Motivo de la corrección *</div>
                    <input style={{...inp,borderColor:'#fecaca'}} placeholder="Ej: Folio mal leído del PDF, fecha incorrecta..." value={motivoEditDatos} onChange={e=>setMotivoEditDatos(e.target.value)}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-primary" style={{ fontSize:12 }} onClick={()=>guardarEdicionDatos(d.id)}>✓ Guardar corrección</button>
                  <button className="btn-secondary" style={{ fontSize:12 }} onClick={()=>setEditandoDatosId(null)}>Cancelar</button>
                </div>
              </div>
            ) : d.observacion && (
              <div style={{ fontSize:12, color:'#64748b', marginTop:8, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', ...f }}>{d.observacion}</div>
            )}
            {editandoDatosId !== d.id && d.historial && (
              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                {d.historial.split('\n').map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
              </div>
            )}

            {/* Comprobante y respuesta — adjuntar / ver PDF, cada uno con verificación de RUC al subir */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10 }}>
              <div>
                <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, fontWeight:600, marginBottom:4, ...f }}>Comprobante</div>
                {d.comprobante_url ? (
                  <a href={d.comprobante_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#2563eb', fontWeight:600, textDecoration:'none', ...f }}>📄 {d.comprobante_nombre || 'Ver PDF'}</a>
                ) : (
                  <button
                    onClick={()=>{ comprobanteInputRef.current.dataset.diligenciaId = d.id; comprobanteInputRef.current.click() }}
                    disabled={subiendoId===d.id}
                    style={{ fontSize:11, color:'#2563eb', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, padding:0, ...f }}>
                    {subiendoId===d.id ? 'Subiendo...' : '+ Adjuntar comprobante'}
                  </button>
                )}
              </div>
              <div>
                <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, fontWeight:600, marginBottom:4, ...f }}>Respuesta</div>
                {d.respuesta_url ? (
                  <a href={d.respuesta_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#2563eb', fontWeight:600, textDecoration:'none', ...f }}>📄 {d.respuesta_nombre || 'Ver PDF'}</a>
                ) : (
                  <button
                    onClick={()=>{ respuestaInputRef.current.dataset.diligenciaId = d.id; respuestaInputRef.current.click() }}
                    disabled={subiendoId===d.id}
                    style={{ fontSize:11, color:'#2563eb', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, padding:0, ...f }}>
                    {subiendoId===d.id ? 'Subiendo...' : '+ Adjuntar respuesta'}
                  </button>
                )}
              </div>
            </div>

            {respondiendoId === d.id ? (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #e2e8f0' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Resultado</div>
                    <select style={inp} value={formResp.estado} onChange={e=>setFormResp(p=>({...p,estado:e.target.value}))}>
                      <option value="aprobada">Aprobada</option>
                      <option value="con_citacion">Con fecha de citación</option>
                      <option value="rechazada">Rechazada</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Fecha de la respuesta</div>
                    <input type="date" style={inp} value={formResp.fecha_respuesta} onChange={e=>setFormResp(p=>({...p,fecha_respuesta:e.target.value}))}/>
                  </div>
                  {formResp.estado === 'con_citacion' && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Fecha de la citación</div>
                      <input type="date" style={inp} value={formResp.fecha_citacion} onChange={e=>setFormResp(p=>({...p,fecha_citacion:e.target.value}))}/>
                    </div>
                  )}
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>{formResp.estado==='rechazada' ? 'Motivo del rechazo' : 'Detalle (opcional)'}</div>
                    <input style={inp} placeholder={formResp.estado==='rechazada' ? 'Motivo indicado por Fiscalía...' : 'Notas adicionales...'} value={formResp.respuesta_detalle} onChange={e=>setFormResp(p=>({...p,respuesta_detalle:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-primary" style={{ fontSize:12 }} onClick={()=>guardarRespuesta(d.id)}>✓ Guardar respuesta</button>
                  <button className="btn-secondary" style={{ fontSize:12 }} onClick={()=>setRespondiendoId(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:10 }}>
                {d.estado !== 'pendiente' && (
                  <div style={{ fontSize:12, color:'#475569', ...f }}>
                    Respondida el {fechaDDMM(d.fecha_respuesta)}
                    {d.estado === 'con_citacion' && d.fecha_citacion && <> · Cita el <strong>{fechaDDMM(d.fecha_citacion)}</strong></>}
                    {d.respuesta_detalle && <div style={{ marginTop:4, color:'#64748b' }}>{d.respuesta_detalle}</div>}
                  </div>
                )}
                <button onClick={()=>empezarRespuesta(d)} style={{ fontSize:11, color:'#2563eb', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, marginTop:6, padding:0, ...f }}>
                  {d.estado === 'pendiente' ? '+ Registrar respuesta' : '✏ Editar respuesta'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Inputs de archivo ocultos y compartidos — se activan según en qué tarjeta se hizo clic */}
      <input ref={comprobanteInputRef} type="file" accept=".pdf,image/*" style={{ display:'none' }}
        onChange={e=>{ const file=e.target.files[0]; const id=e.target.dataset.diligenciaId; if(file&&id) confirmarRucYSubir(file,'comprobante',id); e.target.value='' }}/>
      <input ref={respuestaInputRef} type="file" accept=".pdf,image/*" style={{ display:'none' }}
        onChange={e=>{ const file=e.target.files[0]; const id=e.target.dataset.diligenciaId; if(file&&id) confirmarRucYSubir(file,'respuesta',id); e.target.value='' }}/>

      {showForm ? (
        <div style={{ background:'#F8F9FC', border:'1.5px solid #e2e8f0', borderRadius:12, padding:16, marginTop:8 }}>
          {comprobantePendiente && (
            <div style={{ fontSize:12, color:'#065f46', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8, padding:'8px 10px', marginBottom:10, ...f }}>
              📎 Se detectó y se adjuntará automáticamente: <strong>{comprobantePendiente.name}</strong>
              <button onClick={()=>setComprobantePendiente(null)} style={{ marginLeft:8, background:'transparent', border:'none', color:'#059669', cursor:'pointer', fontSize:11, textDecoration:'underline', ...f }}>quitar</button>
            </div>
          )}
          {avisoRuc && (
            <div style={{ fontSize:12, color:'#991b1b', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 10px', marginBottom:10, ...f }}>{avisoRuc}</div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Tipo de diligencia</div>
              <select style={inp} value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                {TIPOS_DILIGENCIA.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Fecha de la solicitud</div>
              <input type="date" style={inp} value={form.fecha_solicitud} onChange={e=>setForm(p=>({...p,fecha_solicitud:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#dc2626', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:700, ...f }}>Folio *</div>
              <input style={{...inp,borderColor:'#fecaca'}} placeholder="Número de seguimiento" value={form.folio} onChange={e=>setForm(p=>({...p,folio:e.target.value}))}/>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:5, fontWeight:600, ...f }}>Detalle de lo solicitado (opcional)</div>
              <textarea style={{...inp,minHeight:76,resize:'vertical',lineHeight:1.5}} rows={3} placeholder="Ej: Declaración de los imputados para reconocer los hechos y aportar antecedentes..." value={form.observacion} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={agregar} disabled={guardando}>{guardando?'Guardando...':'Guardar diligencia'}</button>
            <button className="btn-secondary" onClick={()=>{setShowForm(false);setComprobantePendiente(null);setAvisoRuc('')}}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e=>{e.preventDefault();setDragPdf(true)}}
          onDragLeave={()=>setDragPdf(false)}
          onDrop={e=>{e.preventDefault();setDragPdf(false);const file=e.dataTransfer.files[0];if(file)procesarPdfComprobante(file)}}
          onClick={()=>nuevaDiligenciaFileRef.current.click()}
          style={{ border:`2px dashed ${dragPdf?'#2563eb':'#e2e8f0'}`, borderRadius:12, padding:'22px 16px', textAlign:'center', background:dragPdf?'#eff6ff':'#F8F9FC', cursor:'pointer', marginTop:8, transition:'all 0.2s' }}>
          <input ref={nuevaDiligenciaFileRef} type="file" accept=".pdf,image/*" style={{ display:'none' }}
            onChange={e=>{ const file=e.target.files[0]; if(file) procesarPdfComprobante(file); e.target.value='' }}/>
          <div style={{ fontSize:24, marginBottom:6 }}>{analizandoPdf ? '⏳' : '📄'}</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#475569', ...f }}>
            {analizandoPdf ? 'Leyendo comprobante...' : dragPdf ? 'Suelta el archivo aquí' : 'Arrastra el comprobante (PDF o screenshot) de Fiscalía — se completa solo'}
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:6, ...f }}>
            o <span style={{ color:'#2563eb', fontWeight:600 }} onClick={e=>{e.stopPropagation();setShowForm(true)}}>ingresar manualmente</span>
          </div>
        </div>
      )}
    </div>
  )
}

