// Panel de Fallos de Referencia y Documentos Guardados dentro de una causa.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { parsearComprobanteFiscalia, extraerTextoPdf, marcarAcreditacionHabilitada } from './diligencias'
import { f } from './primitives'
import { BotonImprimirDocumentos } from './resumen'
import { sanitizarNombreArchivo, hoyISO } from './utils'
import { getMSToken, uploadFile, getFolderFiles, getFileIcon, renameFileInOneDrive } from '../../lib/onedrive'
import { estaOnline, leerCausaDeCache, guardarCausaEnCache } from '../../lib/offline'

export function FallosReferencia({ causaId, ruc, email, onAccion }) {
  const [fallos, setFallos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { cargarFallos() }, [causaId])

  const cargarFallos = async () => {
    const { data } = await supabase.from('fallos_referencia').select('*').eq('causa_id', causaId).order('created_at', { ascending: false })
    setFallos(data || [])
  }

  const subirArchivo = async (file) => {
    if (!file || file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    setSubiendo(true)
    try {
      const path = `${causaId}/${Date.now()}_${sanitizarNombreArchivo(file.name)}`
      const { error: uploadError } = await supabase.storage.from('fallos').upload(path, file, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('fallos').getPublicUrl(path)
      const { error: insertError } = await supabase.from('fallos_referencia').insert({ causa_id: causaId, nombre: file.name, storage_path: path, url: urlData.publicUrl, subido_por: email })
      if (insertError) throw insertError
      await cargarFallos()
      if (onAccion) onAccion() // ✅ actualiza semáforo
    } catch (err) {
      console.error('Error al subir fallo:', err)
      alert('No se pudo subir el archivo: ' + (err?.message || 'Error desconocido. Revisa la consola del navegador (F12) para más detalle.'))
    } finally {
      setSubiendo(false)
    }
  }

  const eliminar = async (fallo) => {
    if (!window.confirm(`¿Eliminar "${fallo.nombre}"?`)) return
    await supabase.storage.from('fallos').remove([fallo.storage_path])
    await supabase.from('fallos_referencia').delete().eq('id', fallo.id)
    setFallos(prev => prev.filter(f => f.id !== fallo.id))
    if (onAccion) onAccion() // ✅ actualiza semáforo
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => subirArchivo(f))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
        <BotonImprimirDocumentos items={fallos}/>
      </div>
      {/* ✅ FIX: mismo arreglo que en diligencias.jsx — algunos navegadores en
          Windows (ej. Edge) necesitan que "dragenter" también prevenga el
          default y que se fije dropEffect="copy", si no muestran el
          símbolo rojo de "no permitido" y nunca aceptan el archivo. */}
      <div onDragEnter={e => { e.preventDefault(); setDrag(true) }} onDragOver={e => { e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect='copy'; setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${drag ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', background: drag ? '#eff6ff' : '#FAF7F0', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
        <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display:'none' }} onChange={e => Array.from(e.target.files).forEach(f => subirArchivo(f))}/>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{subiendo ? '⏳' : '📄'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: drag ? '#2563eb' : '#475569', ...f }}>{subiendo ? 'Subiendo...' : drag ? 'Suelta aquí el fallo' : 'Arrastra fallos PDF aquí'}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, ...f }}>o haz clic para seleccionar desde tu carpeta de descargas</div>
      </div>
      {fallos.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0', ...f }}>Sin fallos de referencia aún.</div>
      ) : fallos.map((fallo, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📄</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#2F5D48', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{fallo.nombre}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>Subido por {fallo.subido_por || 'usuario'} · {new Date(fallo.created_at).toLocaleDateString('es-CL')}</div>
          </div>
          <a href={fallo.url} target="_blank" rel="noreferrer" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 12px', fontSize:11, color:'#2563eb', cursor:'pointer', fontWeight:600, textDecoration:'none', ...f }}>Ver PDF</a>
          <button onClick={() => eliminar(fallo)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600, ...f }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── DOCUMENTOS GUARDADOS EN LA APP (independiente de OneDrive) ──────────────
const ICONO_POR_EXT = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', zip:'🗜️' }
// ✅ NUEVO: detecta si el nombre del archivo es un código/hash ilegible en vez
// de un nombre real — pasa seguido con archivos descargados de portales como
// "Mi Fiscalía en Línea" o el PJUD, que nombran los PDF con su ID interno
// (ej. "baea1338505841582382e1885f2d6e8.pdf") en vez de algo como
// "ACUSACION.pdf". Se usa para ofrecer ponerle un nombre más claro antes de
// guardarlo, en vez de dejarlo así para siempre en la lista.
function pareceNombreHash(nombre) {
  const sinExtension = (nombre || '').replace(/\.[a-zA-Z0-9]{1,5}$/, '')
  const soloCaracteres = sinExtension.replace(/[-_\s]/g, '')
  return soloCaracteres.length >= 16 && /^[0-9a-f]+$/i.test(soloCaracteres)
}

function iconoDocumento(nombre) {
  const ext = (nombre.split('.').pop() || '').toLowerCase()
  return ICONO_POR_EXT[ext] || '📎'
}

// Detecta si un PDF es un comprobante de mi.Fiscalía en línea (por palabras
// clave que siempre aparecen en ese formato), para poder redirigirlo solo a
// "Diligencias Fiscalía" en vez de guardarlo como documento genérico.
function esComprobanteFiscalia(texto) {
  return /SIAU|Comprobante Ingreso Solicitud|mi\s*\.\s*FISCAL[IÍ]A|Sistema de Informaci[oó]n y Atenci[oó]n a Usuarios/i.test(texto || '')
}

// Crea el registro en diligencias_fiscalia a partir de un comprobante detectado
// automáticamente (arrastrado en cualquier parte de la app) y le adjunta el
// mismo PDF como comprobante — para que quede junto al resto del seguimiento.
// ✅ FIX: antes tenía su propia lista de tipos "adivinados" (Declaración de
// imputado, Petición de carpeta, etc.) que ya no son las oficiales — ahora
// usa el mismo tipo detectado por parsearComprobanteFiscalia (por palabras
// clave contra los tipos oficiales de Mi Fiscalía en Línea). Si no hay
// ninguno confiable, se antepone igual el "Detalle Servicio" real al
// detalle para que el motivo de la petición nunca quede oculto.
// ✅ FIX: antes, sin tipo confiable, se usaba igual "TIPOS_DILIGENCIA[0]"
// (el primero de la lista) como si se hubiera detectado de verdad — mismo
// bug que en diligencias.jsx: una diligencia de "Activar/Anular
// acreditación de representación" que no se logró leer bien quedó guardada
// como "Solicitud de diligencias de investigación" sin ningún aviso. Ahora
// se guarda con tipo vacío (nulo) y se avisa en el mensaje de arriba, para
// que Joaquín entre a "Diligencias Fiscalía" y lo complete a mano.
async function guardarComprobanteComoDiligencia(file, texto, { causaId, ruc, email, registrarActividad, onAccion }) {
  const datos = parsearComprobanteFiscalia(texto)
  const tipo = datos.tipoDetectado || null
  const detalleCompleto = [datos.detalleServicio, datos.observacion].filter(Boolean).join(' — ')
  const { data, error } = await supabase.from('diligencias_fiscalia').insert({
    causa_id: causaId, tipo, fecha_solicitud: datos.fechaSolicitud || hoyISO(),
    folio: datos.folio || 'SIN FOLIO DETECTADO', observacion: detalleCompleto || null, estado:'pendiente', registrado_por: email
  }).select().single()
  if (error || !data) throw (error || new Error('No se pudo crear el registro de la diligencia'))
  if (tipo) await marcarAcreditacionHabilitada(causaId, tipo)
  try {
    const path = `diligencias/${data.id}/comprobante_${Date.now()}_${sanitizarNombreArchivo(file.name)}`
    const { error: upErr } = await supabase.storage.from('documentos').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      await supabase.from('diligencias_fiscalia').update({ comprobante_url: urlData.publicUrl, comprobante_path: path, comprobante_nombre: file.name }).eq('id', data.id)
    }
  } catch { /* la diligencia igual queda registrada aunque falle adjuntar el archivo */ }
  if (registrarActividad) registrarActividad('accion', `Detectó y registró automáticamente una diligencia de Fiscalía (folio ${datos.folio || 'sin detectar'}) en RUC ${ruc}`)
  if (onAccion) onAccion()
  return { folio: datos.folio, rucDetectado: datos.ruc, tipo }
}

export function DocumentosGuardados({ causaId, ruc, email, registrarActividad, onAccion }) {
  const [docs, setDocs] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  // ✅ NUEVO: archivos que están en la carpeta de OneDrive pero todavía no
  // están en esta lista (porque se subieron directo ahí, no desde la app).
  const [archivosOneDrive, setArchivosOneDrive] = useState([])
  const [cargandoOneDrive, setCargandoOneDrive] = useState(false)
  const [agregandoId, setAgregandoId] = useState(null)
  // ✅ NUEVO: si falla la subida a OneDrive (ej. sesión vencida, archivo
  // muy grande) antes quedaba solo en la consola, sin que Joaquín se
  // enterara — el documento igual se guardaba bien en la app y parecía
  // que todo había salido bien.
  const [erroresOneDrive, setErroresOneDrive] = useState([])
  // ✅ NUEVO: los documentos que se subieron ANTES de que existiera la
  // sincronización automática nunca llegaron a OneDrive — esto migra los
  // que ya están guardados en la app, uno por uno, con tu sesión de
  // OneDrive abierta (no se puede hacer desde el servidor).
  const [migrando, setMigrando] = useState(false)
  const [migracion, setMigracion] = useState(null) // { hecho, total, fallidos:[] }
  // ✅ FIX: para separar "Escritos" de "Documentos" antes se adivinaba por
  // el nombre del archivo (" - RIT ....pdf"), pero los escritos generados
  // ANTES del cambio a RIT quedaron con fecha en el nombre (" - 2026-08-17
  // .pdf") y no calzaban con ese patrón — se colaban en "Documentos". Ahora
  // se usa la tabla real que registra cada escrito generado
  // (escritos_generados): un documento es "Escrito" si su nombre EMPIEZA
  // con el mismo "tipo_escrito" con el que se generó — el prefijo del
  // nombre del archivo siempre es ese mismo texto, sin importar qué se le
  // haya puesto después (fecha o RIT).
  const [tiposEscrito, setTiposEscrito] = useState([])

  useEffect(() => { cargarDocs(); cargarTiposEscrito() }, [causaId])
  useEffect(() => { if (getMSToken()) cargarArchivosOneDrive() }, [causaId, docs.length])

  const cargarTiposEscrito = async () => {
    const { data } = await supabase.from('escritos_generados').select('tipo_escrito').eq('causa_id', causaId)
    setTiposEscrito([...new Set((data || []).map(d => d.tipo_escrito).filter(Boolean))])
  }

  const cargarArchivosOneDrive = async () => {
    setCargandoOneDrive(true)
    try {
      const items = await getFolderFiles(ruc)
      const nombresYaEnApp = new Set(docs.map(d => d.nombre))
      setArchivosOneDrive(items.filter(it => it.file && !nombresYaEnApp.has(it.name)))
    } catch {
      setArchivosOneDrive([])
    } finally {
      setCargandoOneDrive(false)
    }
  }

  // Sube a OneDrive los documentos que ya estaban guardados en la app
  // desde antes (los que tienen storage_path — los agregados desde
  // OneDrive con "agregarDesdeOneDrive" ya están allá, no se tocan).
  const esErrorDeSesion = (mensaje) => /No token|401|jwt|unauthorized/i.test(mensaje || '')

  const migrarExistentesAOneDrive = async () => {
    // ✅ FIX: antes volvía a subir TODO cada vez que se apretaba el botón,
    // aunque ya estuviera allá — igual que "Crear/verificar carpeta" revisa
    // antes de crear, acá se revisa primero qué ya está en OneDrive y solo
    // se sube lo que falta.
    const yaEnOneDrive = new Set((await getFolderFiles(ruc).catch(() => [])).map(it => it.name))
    const pendientes = docs.filter(d => d.storage_path && !yaEnOneDrive.has(d.nombre))
    if (pendientes.length === 0) { setMigracion({ hecho: 0, total: 0, fallidos: [] }); return }
    setMigrando(true)
    const fallidos = []
    for (let i = 0; i < pendientes.length; i++) {
      const doc = pendientes[i]
      setMigracion({ hecho: i, total: pendientes.length, fallidos })
      try {
        const blob = await fetch(doc.url).then(r => { if (!r.ok) throw new Error('descarga falló'); return r.blob() })
        const file = new File([blob], doc.nombre, { type: doc.tipo_mime || blob.type })
        await uploadFile(ruc, file)
      } catch (err) {
        fallidos.push(`${doc.nombre}: ${err.message}`)
        // Si la sesión de OneDrive venció, seguir intentando con el resto
        // solo repite el mismo error una y otra vez — se corta altiro y se
        // pide reconectar en vez de mostrar una lista larga confusa.
        if (esErrorDeSesion(err.message)) {
          fallidos.length = 1
          fallidos[0] = 'La conexión con OneDrive venció — reconéctate (en "Teoría del Caso") y vuelve a intentar.'
          break
        }
      }
    }
    setMigracion({ hecho: pendientes.length, total: pendientes.length, fallidos })
    setMigrando(false)
  }

  // Deja registrado en la app un archivo que Joaquín subió directo a
  // OneDrive (sin pasar por acá) — no se vuelve a descargar/subir el
  // archivo, solo se guarda el enlace de OneDrive como si fuera el suyo.
  const agregarDesdeOneDrive = async (item) => {
    setAgregandoId(item.id)
    try {
      const { data: nuevoDoc, error } = await supabase.from('documentos_causa')
        .insert({ causa_id: causaId, nombre: item.name, storage_path: null, url: item.webUrl, tipo_mime: item.file?.mimeType || '', subido_por: email })
        .select().single()
      if (error) throw error
      if (nuevoDoc) setDocs(prev => [nuevoDoc, ...prev])
      setArchivosOneDrive(prev => prev.filter(a => a.id !== item.id))
      if (onAccion) onAccion()
    } catch (err) {
      alert('No se pudo agregar el archivo: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setAgregandoId(null)
    }
  }

  // 📴 Igual criterio que openCausa en Dashboard.jsx: si no hay señal, se
  // muestra directo lo último guardado; si la consulta falla por red aunque
  // estaOnline() dijera que sí había señal, se cae al mismo respaldo.
  const cargarDocs = async () => {
    if (!estaOnline()) {
      setDocs(leerCausaDeCache(causaId)?.documentos || [])
      return
    }
    try {
      const { data } = await supabase.from('documentos_causa').select('*').eq('causa_id', causaId).order('created_at', { ascending: false })
      setDocs(data || [])
      // Se guarda para poder verlos después sin señal — mezclado con lo que
      // ya hubiera en caché para esta causa (audiencias, etc.), sin pisarlo.
      guardarCausaEnCache(causaId, { ...(leerCausaDeCache(causaId) || {}), documentos: data || [] })
    } catch {
      setDocs(leerCausaDeCache(causaId)?.documentos || [])
    }
  }

  const subirArchivo = async (file) => {
    if (!file) return
    setSubiendo(true)
    try {
      // ✅ Si es un PDF, primero se revisa si es un comprobante de Fiscalía —
      // en ese caso NO se guarda acá, se redirige solo a "Diligencias Fiscalía"
      // (leyendo folio/fecha/observación igual que si se arrastrara ahí).
      if (file.type === 'application/pdf') {
        try {
          const texto = await extraerTextoPdf(file)
          if (esComprobanteFiscalia(texto)) {
            const resultado = await guardarComprobanteComoDiligencia(file, texto, { causaId, ruc, email, registrarActividad, onAccion })
            alert(`📨 Este archivo es un comprobante de Fiscalía (folio ${resultado.folio || 'no detectado, revísalo'}) — se guardó en la sección "Diligencias Fiscalía", no aquí, para que quede junto con el resto del seguimiento de esa causa.${resultado.tipo ? '' : '\n\n⚠ No se pudo determinar el tipo de diligencia automáticamente — entra a "Diligencias Fiscalía" y complétalo a mano.'}`)
            setSubiendo(false)
            return
          }
        } catch (errLectura) {
          console.warn('No se pudo analizar el PDF, se sube como documento genérico:', errLectura)
        }
      }
      // ✅ NUEVO: si el nombre del archivo parece un código/hash sin sentido
      // (típico de descargas de "Mi Fiscalía en Línea" o el PJUD), se ofrece
      // ponerle un nombre más claro ANTES de guardarlo — así nunca queda en
      // la lista un nombre ilegible, sin tener que arreglarlo después.
      let nombreFinal = file.name
      if (pareceNombreHash(file.name)) {
        const extension = (file.name.match(/\.[a-zA-Z0-9]{1,5}$/) || [''])[0]
        const sugerido = window.prompt(`Este archivo se llama "${file.name}" — un código, no un nombre real (pasa con descargas de Fiscalía o el PJUD). Ponle un nombre más claro para identificarlo después:`, extension ? `Documento${extension}` : 'Documento')
        if (sugerido && sugerido.trim()) nombreFinal = sugerido.trim()
      }
      const path = `${causaId}/${Date.now()}_${sanitizarNombreArchivo(file.name)}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      const { data: nuevoDoc, error: insertError } = await supabase.from('documentos_causa').insert({ causa_id: causaId, nombre: nombreFinal, storage_path: path, url: urlData.publicUrl, tipo_mime: file.type || '', subido_por: email }).select().single()
      if (insertError) throw insertError
      // ✅ FIX: antes se hacía cargarDocs() (recarga completa de la lista)
      // después de cada subida. Si se suben varios archivos seguidos
      // (arrastrando varios a la vez), cada uno dispara su propia recarga en
      // paralelo — y si una de esas recargas alcanza a completarse con una
      // foto vieja de la lista justo después de renombrar otro documento,
      // pisa el renombre sin avisar. Pasó de verdad en la causa RUC
      // 2601171833-6. Ahora cada subida solo agrega SU propia fila nueva al
      // estado local, sin tocar ni volver a pedir el resto de la lista —
      // así nunca puede chocar con un renombre (u otra edición) que esté
      // pasando al mismo tiempo en otro documento.
      if (nuevoDoc) setDocs(prev => [nuevoDoc, ...prev])
      // ✅ NUEVO: si OneDrive está conectado, el mismo archivo se sube
      // también a la carpeta de la causa — así queda en ambos lados sin
      // tener que subirlo dos veces a mano. No bloquea el guardado en la
      // app si falla (ej. sesión de OneDrive vencida).
      if (getMSToken()) {
        uploadFile(ruc, file).catch(err => {
          console.warn('No se pudo subir a OneDrive:', err.message)
          setErroresOneDrive(prev => [...prev, `${nombreFinal}: ${err.message}`])
        })
      }
      if (onAccion) onAccion()
    } catch (err) {
      console.error('Error al subir documento:', err)
      alert('No se pudo subir el archivo: ' + (err?.message || 'Error desconocido. Revisa la consola del navegador (F12) para más detalle.'))
    } finally {
      setSubiendo(false)
    }
  }

  // ✅ NUEVO: renombrar un documento ya subido — para los que quedaron con
  // nombre de código antes de que existiera este arreglo (como los de la
  // captura de Joaquín), sin tener que borrarlos y volver a subirlos.
  const renombrar = async (doc) => {
    const nuevo = window.prompt('Nuevo nombre para este documento:', doc.nombre)
    if (!nuevo || !nuevo.trim() || nuevo.trim() === doc.nombre) return
    const nombreViejo = doc.nombre
    const nombreNuevo = nuevo.trim()
    const { error } = await supabase.from('documentos_causa').update({ nombre: nombreNuevo }).eq('id', doc.id)
    if (error) { alert('No se pudo renombrar: ' + error.message); return }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, nombre: nombreNuevo } : d))
    if (onAccion) onAccion()
    // ✅ NUEVO: si ya estaba subido a OneDrive con el nombre viejo, se
    // renombra allá también — si no, la próxima sincronización subía una
    // copia nueva con el nombre nuevo y dejaba la vieja huérfana (el mismo
    // documento duplicado dos veces).
    if (getMSToken()) renameFileInOneDrive(ruc, nombreViejo, nombreNuevo).catch(() => {})
  }

  const eliminar = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre}"?`)) return
    // Los agregados desde OneDrive (agregarDesdeOneDrive) no tienen
    // storage_path — el archivo vive solo en OneDrive, no hay nada que
    // borrar en Supabase Storage.
    if (doc.storage_path) await supabase.storage.from('documentos').remove([doc.storage_path])
    await supabase.from('documentos_causa').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    if (onAccion) onAccion()
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    Array.from(e.dataTransfer.files).forEach(f => subirArchivo(f))
  }

  // Separa los PDF generados desde "Escritos" del resto de documentos
  // subidos a mano — Joaquín pidió que quedaran en su propia sección para
  // no mezclarlos con todo lo demás (ver cargarTiposEscrito arriba).
  const esEscrito = (nombre) => tiposEscrito.some(tipo => nombre.startsWith(tipo + ' - '))
  const escritos = docs.filter(d => esEscrito(d.nombre))
  const otros = docs.filter(d => !esEscrito(d.nombre))

  const fila = (doc) => (
    <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'#fff', border:'1px solid #E2DDCD', borderRadius:9, marginBottom:6 }}>
      <div style={{ width:30, height:30, background:'#FAF7F0', border:'1px solid #E2DDCD', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{iconoDocumento(doc.nombre)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:'#1E3A2F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{doc.nombre}</div>
        <div style={{ fontSize:10.5, color:'#A6A397', marginTop:1, ...f }}>{doc.subido_por || 'usuario'} · {new Date(doc.created_at).toLocaleDateString('es-CL')}</div>
      </div>
      <a href={doc.url} target="_blank" rel="noreferrer" style={{ background:'#FAF7F0', border:'1px solid #DDD7C6', borderRadius:6, padding:'4px 10px', fontSize:10.5, color:'#1E3A2F', cursor:'pointer', fontWeight:600, textDecoration:'none', ...f }}>Ver</a>
      <button onClick={() => renombrar(doc)} title="Renombrar" style={{ background:'none', border:'none', padding:'4px 4px', fontSize:12, color:'#A6A397', cursor:'pointer' }}>✏️</button>
      <button onClick={() => eliminar(doc)} title="Eliminar" style={{ background:'none', border:'none', padding:'4px 4px', fontSize:12, color:'#c4988e', cursor:'pointer' }}>✕</button>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:10 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:'#1E3A2F', ...f }}>Documentos</div>
        <div style={{ flexShrink:0, display:'flex', gap:6 }}>
          {getMSToken() && docs.some(d => d.storage_path) && (
            <button onClick={migrarExistentesAOneDrive} disabled={migrando} className="btn-secondary" style={{ fontSize:10.5, padding:'4px 9px' }}>
              {migrando ? `${migracion?.hecho ?? 0}/${migracion?.total ?? 0}...` : '📤 Subir existentes'}
            </button>
          )}
          <BotonImprimirDocumentos items={docs}/>
        </div>
      </div>
      {migracion && !migrando && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background: migracion.fallidos.length ? '#FBEAEA' : '#EAF2EC', border: `1px solid ${migracion.fallidos.length ? '#E9C6C2' : '#c9dfd0'}`, borderRadius:9, padding:'8px 12px', marginBottom:10 }}>
          <div style={{ flex:1, fontSize:11, color: migracion.fallidos.length ? '#8C2F26' : '#2F6B4F', ...f }}>
            {migracion.fallidos.length === 0
              ? (migracion.total === 0 ? '✅ Ya estaban todos en OneDrive.' : `✅ Se subieron ${migracion.total} documento${migracion.total !== 1 ? 's' : ''}.`)
              : `Se subieron ${migracion.total - migracion.fallidos.length} de ${migracion.total}. Fallaron: ${migracion.fallidos.join(' · ')}`}
          </div>
          <button onClick={() => setMigracion(null)} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontWeight:700, fontSize:12, flexShrink:0 }}>✕</button>
        </div>
      )}
      {erroresOneDrive.length > 0 && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#FBEAEA', border:'1px solid #E9C6C2', borderRadius:9, padding:'8px 12px', marginBottom:10 }}>
          <div style={{ flex:1, fontSize:11, color:'#8C2F26', ...f }}>⚠ No se pudo subir a OneDrive (quedó guardado igual acá): {erroresOneDrive.join(' · ')}</div>
          <button onClick={() => setErroresOneDrive([])} style={{ background:'none', border:'none', color:'#8C2F26', cursor:'pointer', fontWeight:700, fontSize:12, flexShrink:0 }}>✕</button>
        </div>
      )}
      {/* ✅ FIX: mismo arreglo que en diligencias.jsx — algunos navegadores en
          Windows (ej. Edge) necesitan que "dragenter" también prevenga el
          default y que se fije dropEffect="copy", si no muestran el
          símbolo rojo de "no permitido" y nunca aceptan el archivo. */}
      <div onDragEnter={e => { e.preventDefault(); setDrag(true) }} onDragOver={e => { e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect='copy'; setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `1.5px dashed ${drag ? '#A8925F' : '#DDD7C6'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center', background: drag ? '#F5EFE2' : '#FAF7F0', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 14, ...f }}>
        <input ref={inputRef} type="file" multiple style={{ display:'none' }} onChange={e => Array.from(e.target.files).forEach(f => subirArchivo(f))}/>
        <span style={{ fontSize:12.5, fontWeight:600, color: drag ? '#8A7D55' : '#6F7B6F' }}>{subiendo ? '⏳ Subiendo...' : drag ? 'Suelta aquí el documento' : '📎 Arrastra un documento aquí, o haz clic'}</span>
      </div>

      {escritos.length > 0 && (
        <div style={{ marginBottom: otros.length > 0 ? 14 : 4 }}>
          {otros.length > 0 && <div style={{ fontSize:10.5, fontWeight:700, color:'#8A7D55', textTransform:'uppercase', letterSpacing:1, marginBottom:6, ...f }}>📝 Escritos ({escritos.length})</div>}
          {escritos.map(fila)}
        </div>
      )}
      {(otros.length > 0 || escritos.length === 0) && (
        <div>
          {escritos.length > 0 && <div style={{ fontSize:10.5, fontWeight:700, color:'#8A7D55', textTransform:'uppercase', letterSpacing:1, marginBottom:6, ...f }}>📎 Documentos ({otros.length})</div>}
          {otros.length === 0 && escritos.length === 0
            ? <div style={{ fontSize:12.5, color:'#A6A397', textAlign:'center', padding:'10px 0', ...f }}>Sin documentos guardados aún.</div>
            : otros.map(fila)}
        </div>
      )}

      {/* ✅ NUEVO: archivos que están en OneDrive pero se subieron directo
          ahí (no desde acá) — se pueden agregar a esta lista con un clic,
          sin volver a subir el archivo. */}
      {getMSToken() && archivosOneDrive.length > 0 && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px dashed #DDD7C6' }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'#8A7D55', textTransform:'uppercase', letterSpacing:1, marginBottom:6, ...f }}>📁 En OneDrive, sin agregar acá ({archivosOneDrive.length})</div>
          {archivosOneDrive.map(item => (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#FAF7F0', border:'1px dashed #DDD7C6', borderRadius:9, marginBottom:6 }}>
              <div style={{ width:28, height:28, background:'#fff', border:'1px solid #E2DDCD', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{getFileIcon(item.name)}</div>
              <div style={{ flex:1, minWidth:0, fontSize:12, fontWeight:600, color:'#6F7B6F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{item.name}</div>
              <button onClick={() => agregarDesdeOneDrive(item)} disabled={agregandoId === item.id}
                style={{ background:'#fff', border:'1px solid #DDD7C6', borderRadius:6, padding:'4px 10px', fontSize:10.5, color:'#1E3A2F', cursor:'pointer', fontWeight:600, ...f }}>
                {agregandoId === item.id ? 'Agregando...' : '＋ Agregar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {cargandoOneDrive && <div style={{ fontSize:10.5, color:'#A6A397', textAlign:'center', marginTop:8, ...f }}>Revisando OneDrive...</div>}
    </div>
  )
}

export const CUENTAS_TRANSFERENCIA = ['1. Cuenta RUT Banco Estado','2. Chequera Electrónica Banco Estado','3. Cuenta Empresa Banco Estado','4. Cta. Corriente Banco Chile']

// ─── HONORARIOS (solo Titular) — permite abonos parciales con saldo pendiente ─
