// Panel de Fallos de Referencia y Documentos Guardados dentro de una causa.
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { parsearComprobanteFiscalia, extraerTextoPdf } from './diligencias'
import { f } from './primitives'
import { BotonImprimirDocumentos } from './resumen'
import { sanitizarNombreArchivo } from './utils'

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
      <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${drag ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', background: drag ? '#eff6ff' : '#F8F9FC', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
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
            <div style={{ fontSize:13, fontWeight:600, color:'#1E293B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{fallo.nombre}</div>
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

function adivinarTipoDiligencia(observacion) {
  const o = (observacion || '').toUpperCase()
  if (o.includes('DECLARACION') || o.includes('DECLARACIÓN')) return 'Declaración de imputado'
  if (o.includes('CARPETA')) return 'Petición de carpeta'
  if (o.includes('ENTREVISTA')) return 'Entrevista con el fiscal'
  if (o.includes('RECONSTITUCION') || o.includes('RECONSTITUCIÓN')) return 'Reconstitución de escena'
  if (o.includes('CAREO')) return 'Careo'
  return 'Otra diligencia'
}

// Crea el registro en diligencias_fiscalia a partir de un comprobante detectado
// automáticamente (arrastrado en cualquier parte de la app) y le adjunta el
// mismo PDF como comprobante — para que quede junto al resto del seguimiento.
async function guardarComprobanteComoDiligencia(file, texto, { causaId, ruc, email, registrarActividad, onAccion }) {
  const datos = parsearComprobanteFiscalia(texto)
  const tipo = adivinarTipoDiligencia(datos.observacion)
  const { data, error } = await supabase.from('diligencias_fiscalia').insert({
    causa_id: causaId, tipo, fecha_solicitud: datos.fechaSolicitud || new Date().toISOString().slice(0,10),
    folio: datos.folio || 'SIN FOLIO DETECTADO', observacion: datos.observacion || null, estado:'pendiente', registrado_por: email
  }).select().single()
  if (error || !data) throw (error || new Error('No se pudo crear el registro de la diligencia'))
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

  useEffect(() => { cargarDocs() }, [causaId])

  const cargarDocs = async () => {
    const { data } = await supabase.from('documentos_causa').select('*').eq('causa_id', causaId).order('created_at', { ascending: false })
    setDocs(data || [])
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
            alert(`📨 Este archivo es un comprobante de Fiscalía (folio ${resultado.folio || 'no detectado, revísalo'}) — se guardó en la sección "Diligencias Fiscalía", no aquí, para que quede junto con el resto del seguimiento de esa causa.`)
            setSubiendo(false)
            return
          }
        } catch (errLectura) {
          console.warn('No se pudo analizar el PDF, se sube como documento genérico:', errLectura)
        }
      }
      const path = `${causaId}/${Date.now()}_${sanitizarNombreArchivo(file.name)}`
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      const { error: insertError } = await supabase.from('documentos_causa').insert({ causa_id: causaId, nombre: file.name, storage_path: path, url: urlData.publicUrl, tipo_mime: file.type || '', subido_por: email })
      if (insertError) throw insertError
      await cargarDocs()
      if (onAccion) onAccion()
    } catch (err) {
      console.error('Error al subir documento:', err)
      alert('No se pudo subir el archivo: ' + (err?.message || 'Error desconocido. Revisa la consola del navegador (F12) para más detalle.'))
    } finally {
      setSubiendo(false)
    }
  }

  const eliminar = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre}"?`)) return
    await supabase.storage.from('documentos').remove([doc.storage_path])
    await supabase.from('documentos_causa').delete().eq('id', doc.id)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    if (onAccion) onAccion()
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    Array.from(e.dataTransfer.files).forEach(f => subirArchivo(f))
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:4 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', ...f }}>Documentos guardados en la app</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>Solo lo que subas acá explícitamente. El resto del Drive queda solo enlazado, sin ocupar espacio.</div>
        </div>
        <div style={{ flexShrink:0 }}>
          <BotonImprimirDocumentos items={docs}/>
        </div>
      </div>
      <div style={{ marginBottom:14 }}/>
      <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${drag ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center', background: drag ? '#eff6ff' : '#F8F9FC', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
        <input ref={inputRef} type="file" multiple style={{ display:'none' }} onChange={e => Array.from(e.target.files).forEach(f => subirArchivo(f))}/>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{subiendo ? '⏳' : '📎'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: drag ? '#2563eb' : '#475569', ...f }}>{subiendo ? 'Subiendo...' : drag ? 'Suelta aquí el documento' : 'Arrastra un documento aquí'}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, ...f }}>o haz clic para seleccionar — cualquier tipo de archivo</div>
      </div>
      {docs.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px 0', ...f }}>Sin documentos guardados aún.</div>
      ) : docs.map((doc, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{iconoDocumento(doc.nombre)}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1E293B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{doc.nombre}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>Subido por {doc.subido_por || 'usuario'} · {new Date(doc.created_at).toLocaleDateString('es-CL')}</div>
          </div>
          <a href={doc.url} target="_blank" rel="noreferrer" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 12px', fontSize:11, color:'#2563eb', cursor:'pointer', fontWeight:600, textDecoration:'none', ...f }}>Ver / Descargar</a>
          <button onClick={() => eliminar(doc)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600, ...f }}>✕</button>
        </div>
      ))}
    </div>
  )
}

export const CUENTAS_TRANSFERENCIA = ['1. Cuenta RUT Banco Estado','2. Chequera Electrónica Banco Estado','3. Cuenta Empresa Banco Estado','4. Cta. Corriente Banco Chile']

// ─── HONORARIOS (solo Titular) — permite abonos parciales con saldo pendiente ─
