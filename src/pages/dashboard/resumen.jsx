// Resumen imprimible de una causa: junta Datos, Audiencias, Plazo, Teoría
// del Caso y una lista (solo nombres) de Documentos y Fallos de referencia,
// en una vista limpia que se imprime con Cmd/Ctrl+P o "Guardar como PDF"
// desde el propio diálogo de impresión del navegador — sin depender de
// ninguna librería nueva.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { f } from './primitives'
import { calcularVencimiento, calcularSubestado, calcularEdadActual, estadoConfig } from './utils'
import { calcularTotalAbono, diasEntreFechasCaut } from './cautelares'

const TC_LABELS = {
  hechos: 'Hechos del caso',
  teoria_defensa: 'Teoría y Defensa',
  prueba: 'Prueba y testigos',
  observaciones: 'Observaciones',
}

export function BotonResumenImprimible({ causa, imputados, audiencias, aumentos, cautelares, esTitular }) {
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [mostrar, setMostrar] = useState(false)

  if (!esTitular) return null

  const abrir = async () => {
    setCargando(true)
    const [{ data: notaTeoria }, { data: fallos }, { data: documentos }, { data: diligencias }] = await Promise.all([
      supabase.from('notas').select('*').eq('causa_id', causa.id).eq('tipo', 'teoria_caso').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('fallos_referencia').select('*').eq('causa_id', causa.id).order('created_at', { ascending: false }),
      supabase.from('documentos_causa').select('*').eq('causa_id', causa.id).order('created_at', { ascending: false }),
      supabase.from('diligencias_fiscalia').select('*').eq('causa_id', causa.id).order('fecha_solicitud', { ascending: false }),
    ])
    let teoria = {}
    if (notaTeoria) {
      try { teoria = JSON.parse(notaTeoria.contenido).contenido || {} }
      catch { teoria = { hechos: notaTeoria.contenido || '' } }
    }
    setDatos({ teoria, fallos: fallos || [], documentos: documentos || [], diligencias: diligencias || [] })
    setCargando(false)
    setMostrar(true)
  }

  if (!mostrar || !datos) {
    return (
      <button onClick={abrir} disabled={cargando} className="btn-secondary no-imprimir" style={{ fontSize: 12, border: 'none', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
        {cargando ? 'Preparando...' : '🖨 Imprimir resumen'}
      </button>
    )
  }

  const activos = (aumentos || []).filter(a => !a.eliminado)
  const diasTotal = activos.reduce((s, a) => s + (parseInt(a.dias_plazo) || 0), 0)
  // ✅ El vencimiento vigente es el de la audiencia MÁS RECIENTE (por fecha),
  // calculado desde su propia fecha — no se encadena desde el origen. Mismo
  // criterio que plazo.jsx. "diasTotal" queda solo como dato informativo.
  const ultimaOrdenada = [...activos].sort((a, b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia)).at(-1)
  const vencimientoTotal = ultimaOrdenada ? calcularVencimiento(ultimaOrdenada.fecha_audiencia, ultimaOrdenada.dias_plazo) : null
  const subestadoCalc = calcularSubestado(vencimientoTotal)

  // ✅ Portal a document.body: el botón que abre este resumen vive dentro de
  // un contenedor "no-imprimir" (el encabezado de la causa) — si el modal se
  // quedara anidado ahí, al imprimir Chrome oculta TODO ese contenedor
  // (display:none) y se lleva el contenido imprimible con él, sin importar
  // qué CSS se le ponga al modal en sí. El portal lo saca de esa jerarquía.
  return (
    <>
      <button onClick={() => setMostrar(false)} className="btn-secondary no-imprimir" style={{ fontSize: 12, border: 'none', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>✕ Cerrar resumen</button>

      {createPortal(
      <div className="resumen-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 400, overflowY: 'auto', padding: '4vh 0' }}>
        <div className="resumen-imprimible" style={{ background: '#fff', maxWidth: 760, margin: '0 auto', padding: '40px 48px', borderRadius: 14, boxShadow: '0 24px 80px rgba(15,23,42,0.25)', ...f }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }} className="no-imprimir">
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Vista previa — usa el botón de abajo para imprimir o guardar como PDF</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 12 }}>🖨 Imprimir / Guardar PDF</button>
              <button onClick={() => setMostrar(false)} className="btn-secondary" style={{ fontSize: 12, border: '1.5px solid #e5e7eb' }}>✕ Cerrar</button>
            </div>
          </div>

          {/* ── Encabezado ── */}
          <div style={{ borderBottom: '2px solid #1E293B', paddingBottom: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>RUC {causa.ruc}</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
              RIT {causa.rit || '—'} · {causa.tribunal || '—'}
              {causa.tiene_top && causa.tribunal_top ? ` · Juicio Oral: ${causa.tribunal_top}${causa.rit_top ? ' RIT ' + causa.rit_top : ''}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {(estadoConfig[causa.subestado]?.label) || (causa.estado === 'terminada' ? 'Terminada' : 'Vigente')} · Fiscal: {causa.fiscal || '—'}
            </div>
          </div>

          {/* ── Datos / Imputados ── */}
          <Seccion titulo="Datos de la causa">
            <Fila label="Delito(s)" valor={(causa.delito || '').replace(/\|/g, ', ') || '—'} />
            <Fila label="Plazo" valor={causa.plazo || '—'} />
            <Fila label="Fecha de los hechos" valor={causa.fecha_hechos || '—'} />
            {(imputados && imputados.length > 0 ? imputados : [null]).map((imp, i) => (
              <div key={i} style={{ marginTop: 12, paddingTop: 12, borderTop: i > 0 ? '1px dashed #e2e8f0' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{imp ? (imp.nombre || 'Imputado sin nombre') : (causa.imputado || 'Imputado sin nombre')}</div>
                {imp && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.7 }}>
                    RUT: {imp.rut || '—'} · {imp.regimen || 'Régimen no calculado'}
                    {imp.fecha_nacimiento ? ` · ${calcularEdadActual(imp.fecha_nacimiento)} años` : ''}
                    <br />
                    Situación: {imp.esta_detenido ? `Privado de libertad${imp.lugar_detencion ? ' en ' + imp.lugar_detencion : ''}` : 'En libertad'}
                  </div>
                )}
              </div>
            ))}
          </Seccion>

          {/* ── Cautelares y abono — por imputado si hay más de uno ── */}
          <Seccion titulo="Cautelares y abono">
            {(!cautelares || cautelares.length === 0) ? <Vacio texto="Sin medidas cautelares registradas." /> : (
              (imputados && imputados.length > 0 ? imputados : [null]).map((imp, i) => {
                const propias = imp ? cautelares.filter(ct => ct.imputado_id === imp.id) : cautelares
                if (propias.length === 0) return null
                const totalAbono = calcularTotalAbono(propias)
                return (
                  <div key={i} style={{ marginTop: i > 0 ? 12 : 0, paddingTop: i > 0 ? 12 : 0, borderTop: i > 0 ? '1px dashed #e2e8f0' : 'none' }}>
                    {imp && <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>{imp.nombre}</div>}
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Abono total (1×1): <strong>{totalAbono} días</strong></div>
                    {propias.map((ct, j) => (
                      <div key={j} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>
                        {ct.tipo} — desde {ct.fecha_inicio}{ct.fecha_termino ? ` hasta ${ct.fecha_termino}` : ' (vigente)'}
                        {!ct.fecha_termino ? '' : ` · ${diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino)} días`}
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </Seccion>

          {/* ── Audiencias ── */}
          <Seccion titulo={`Audiencias registradas (${(audiencias || []).length})`}>
            {(!audiencias || audiencias.length === 0) ? <Vacio texto="Sin audiencias registradas." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                    {['Fecha', 'Hora', 'Tipo', 'Tribunal', 'Resultado'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...audiencias].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>{a.fecha}</td>
                      <td style={{ padding: '6px 8px' }}>{a.hora || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.tipo || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.tribunal || '—'}{a.sala ? ' · Sala ' + a.sala : ''}</td>
                      <td style={{ padding: '6px 8px' }}>{a.resultado || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Seccion>

          {/* ── Plazo ── */}
          <Seccion titulo="Plazo">
            {activos.length === 0 ? <Vacio texto="Sin audiencias de plazo registradas." /> : (
              <>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                  {activos.length} audiencia{activos.length !== 1 ? 's' : ''} vigente{activos.length !== 1 ? 's' : ''} · {diasTotal} días corridos totales · Vencimiento: <strong>{vencimientoTotal || '—'}</strong> ({estadoConfig[subestadoCalc]?.label || subestadoCalc || '—'})
                </div>
                {activos.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#475569', padding: '4px 0' }}>
                    {a.fecha_audiencia} · {a.tipo_audiencia || 'Audiencia'} · +{a.dias_plazo}d{a.observacion ? ' · ' + a.observacion : ''}
                  </div>
                ))}
              </>
            )}
          </Seccion>

          {/* ── Teoría del Caso — siempre se muestran los 4 títulos, aunque estén
              vacíos, igual que Documentos/Fallos siempre muestran su cantidad. ── */}
          <Seccion titulo="Teoría del Caso">
            {Object.entries(TC_LABELS).map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                {datos.teoria[key]
                  ? <div style={{ fontSize: 13, color: '#1E293B', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{datos.teoria[key]}</div>
                  : <Vacio texto="Sin contenido registrado." />}
              </div>
            ))}
          </Seccion>

          {/* ── Diligencias de Fiscalía ── */}
          <Seccion titulo={`Diligencias de Fiscalía (${datos.diligencias.length})`}>
            {datos.diligencias.length === 0 ? <Vacio texto="Sin diligencias solicitadas." /> : (
              datos.diligencias.map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: '#475569', padding: '4px 0' }}>
                  <strong style={{ color: '#1E293B' }}>{d.tipo}</strong> — solicitada el {d.fecha_solicitud}{d.folio ? ` · Folio ${d.folio}` : ''}
                  {d.estado === 'pendiente'
                    ? ' · Pendiente de respuesta'
                    : ` · Respondida el ${d.fecha_respuesta || '—'}${d.estado === 'con_citacion' && d.fecha_citacion ? ` · Cita el ${d.fecha_citacion}` : ''}`}
                </div>
              ))
            )}
          </Seccion>

          {/* ── Documentos y Fallos — solo nombre y cantidad, sin abrir contenido ── */}
          <Seccion titulo={`Documentos (${datos.documentos.length})`}>
            {datos.documentos.length === 0 ? <Vacio texto="Sin documentos subidos." /> : (
              datos.documentos.map((d, i) => <div key={i} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>📄 {d.nombre}</div>)
            )}
          </Seccion>
          <Seccion titulo={`Fallos de referencia (${datos.fallos.length})`} ultima>
            {datos.fallos.length === 0 ? <Vacio texto="Sin fallos de referencia guardados." /> : (
              datos.fallos.map((d, i) => <div key={i} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>📄 {d.nombre}</div>)
            )}
          </Seccion>

          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
            Generado el {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })} · Gestor de Causas Penales
          </div>
        </div>
      </div>,
      document.body
      )}
    </>
  )
}

function Seccion({ titulo, children, ultima }) {
  return (
    <div style={{ marginBottom: ultima ? 0 : 20, paddingBottom: ultima ? 0 : 16, borderBottom: ultima ? 'none' : '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, ...f }}>{titulo}</div>
      {children}
    </div>
  )
}
function Fila({ label, valor }) {
  return <div style={{ fontSize: 13, color: '#1E293B', marginBottom: 4 }}><strong style={{ color: '#475569', fontWeight: 600 }}>{label}:</strong> {valor}</div>
}
function Vacio({ texto }) {
  return <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{texto}</div>
}

// ─── Botón de impresión chico y reutilizable — para Documentos, Fallos de
// referencia y Diligencias de Fiscalía. Cada uno imprime SOLO su propia
// lista (nombre, cantidad), independiente del resumen completo de la
// causa — útil cuando alguien necesita saber/tener el listado de esa
// pestaña en particular sin tener que abrir cada ítem uno por uno. ────────
export function BotonImprimirLista({ ruc, titulo, items, renderItem }) {
  const [mostrar, setMostrar] = useState(false)

  if (!mostrar) {
    return (
      <button onClick={() => setMostrar(true)} className="btn-secondary no-imprimir" style={{ fontSize: 11, padding: '5px 10px' }}>🖨 Imprimir lista</button>
    )
  }

  // ✅ Portal a document.body — igual que en BotonResumenImprimible: estos
  // botones suelen vivir dentro de un contenedor "no-imprimir" (la barra de
  // acciones de cada sección), así que el modal se saca de esa jerarquía
  // para que no se oculte junto con ella al imprimir.
  return createPortal(
    <div className="resumen-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 400, overflowY: 'auto', padding: '4vh 0' }}>
      <div className="resumen-imprimible" style={{ background: '#fff', maxWidth: 640, margin: '0 auto', padding: '36px 44px', borderRadius: 14, boxShadow: '0 24px 80px rgba(15,23,42,0.25)', ...f }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="no-imprimir">
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Vista previa</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 12 }}>🖨 Imprimir / Guardar PDF</button>
            <button onClick={() => setMostrar(false)} className="btn-secondary" style={{ fontSize: 12, border: '1.5px solid #e5e7eb' }}>✕ Cerrar</button>
          </div>
        </div>
        <div style={{ borderBottom: '2px solid #1E293B', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>{titulo}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>RUC {ruc} · {items.length} en total</div>
        </div>
        {items.length === 0 ? <Vacio texto="Sin elementos para mostrar." /> : items.map((item, i) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>{renderItem(item, i)}</div>
        ))}
        <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
          Generado el {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Combinar e imprimir TODOS los documentos PDF de una sección de una vez ─
// A diferencia de BotonImprimirLista (que solo imprime el nombre de cada
// archivo), esto junta el CONTENIDO real de todos los PDF en un solo
// archivo — para no tener que abrir y guardar cada uno por separado. El
// navegador no puede leer Word/Excel/etc., así que esos simplemente no
// entran en la combinación — ya tienen su propio botón "Ver/Descargar" en
// la lista de documentos, no hace falta duplicarlo acá. Ver pdf-lib cargado
// abajo, mismo patrón que pdf.js/Tesseract en diligencias.jsx (CDN, sin
// tocar package.json).
let _pdfLibCargando = null
function cargarPdfLib() {
  if (typeof window !== 'undefined' && window.PDFLib) return Promise.resolve(window.PDFLib)
  if (_pdfLibCargando) return _pdfLibCargando
  _pdfLibCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
    script.onload = () => resolve(window.PDFLib)
    script.onerror = () => reject(new Error('No se pudo cargar el combinador de PDF (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _pdfLibCargando
}

const esPdf = (nombre) => /\.pdf$/i.test(nombre || '')

export function BotonImprimirDocumentos({ items }) {
  const [combinando, setCombinando] = useState(false)

  const pdfs = (items || []).filter(it => esPdf(it.nombre))

  const combinarYAbrir = async () => {
    if (pdfs.length === 0) { alert('No hay archivos PDF para combinar en esta sección.'); return }
    setCombinando(true)
    try {
      const PDFLib = await cargarPdfLib()
      const combinado = await PDFLib.PDFDocument.create()
      const fallidos = []
      for (const item of pdfs) {
        try {
          const bytes = await fetch(item.url).then(r => {
            if (!r.ok) throw new Error('descarga falló')
            return r.arrayBuffer()
          })
          const origen = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })
          const paginas = await combinado.copyPages(origen, origen.getPageIndices())
          paginas.forEach(p => combinado.addPage(p))
        } catch {
          fallidos.push(item.nombre)
        }
      }
      if (combinado.getPageCount() === 0) {
        alert('No se pudo leer ningún PDF de esta sección. Intenta abrirlos uno por uno.')
        setCombinando(false)
        return
      }
      const bytesFinal = await combinado.save()
      const blob = new Blob([bytesFinal], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      if (fallidos.length > 0) {
        alert(`Se combinaron ${pdfs.length - fallidos.length} de ${pdfs.length} PDF. No se pudieron leer: ${fallidos.join(', ')} — ábrelos individualmente desde la lista.`)
      }
    } catch (err) {
      alert('No se pudieron combinar los PDF: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setCombinando(false)
    }
  }

  return (
    <button onClick={combinarYAbrir} disabled={combinando || pdfs.length === 0} className="btn-secondary no-imprimir" style={{ fontSize: 11, padding: '5px 10px' }}>
      {combinando ? 'Combinando...' : `🖨 Imprimir todos (${pdfs.length} PDF)`}
    </button>
  )
}
