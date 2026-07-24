import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  .btn-primary { font-family:'Manrope','Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,41,59,0.2); text-transform:uppercase; letter-spacing:0.3px; }
  .btn-primary:hover { background:#0f172a; box-shadow:0 4px 16px rgba(30,41,59,0.3); }
  .btn-secondary { font-family:'Manrope','Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; text-transform:uppercase; letter-spacing:0.3px; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E293B; background:#F8F9FC; }
  .plantilla-card { transition:all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; }
  .plantilla-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.1) !important; border-color:#93c5fd !important; }
  .causa-row { transition:background 0.2s ease; cursor:pointer; }
  .causa-row:hover { background:#F8F9FC !important; }
  input,select,textarea { font-family:'Manrope','Inter',sans-serif !important; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
`

const f = { fontFamily:"'Manrope','Inter',sans-serif" }

// ─── PLANTILLAS DE ESCRITOS ───────────────────────────────────────────────────
// Cada plantilla recibe un objeto `d` con los datos ya fusionados (causa + imputado + abogado)
// y devuelve el texto completo del escrito. El texto queda siempre en un cuadro editable,
// así sirve tanto para escritos 100% boilerplate como para los que necesitan redacción manual.
const PLANTILLAS = [
  {
    id: 'patrocinio_poder',
    nombre: 'Patrocinio y Poder',
    descripcion: 'Confiere patrocinio y poder al abogado en la causa.',
    generar: (d) => `PATROCINIO Y PODER

SJ DE GARANTÍA DE ${d.TRIBUNAL}

\t${d.IMPUTADO_NOMBRE}, Cédula Nacional de Identidad Nº ${d.IMPUTADO_RUT}, ${d.SITUACION_LIBERTAD}, en causa RUC. ${d.RUC} RIT ${d.RIT} a SS., respetuosamente digo:

\tQué, en este acto, vengo en conferir patrocinio y poder al abogado habilitado para el ejercicio de la profesión don ${d.ABOGADO_NOMBRE}, con domicilio en ${d.ABOGADO_DOMICILIO} y forma de notificación al correo electrónico ${d.CORREO_NOTIFICACION}, quien firma en señal de aceptación.

Por tanto;

Ruego a SS., tenerlo presente para todos los efectos legales.`,
  },
]

function construirDatos(causa, imputado, abogado) {
  const estaDetenido = imputado?.esta_detenido
  const centroPenal = imputado?.lugar_detencion || causa?.centro_penal
  return {
    TRIBUNAL: causa?.tribunal || '[TRIBUNAL]',
    RUC: causa?.ruc || '[RUC]',
    RIT: causa?.rit || '[RIT]',
    DELITO: (causa?.delito || '').replace(/\|/g, ', ') || '[DELITO]',
    IMPUTADO_NOMBRE: imputado?.nombre || causa?.imputado?.split('|')[0] || '[NOMBRE IMPUTADO]',
    IMPUTADO_RUT: imputado?.rut || '[RUT IMPUTADO]',
    IMPUTADO_DOMICILIO: imputado?.domicilio || '[DOMICILIO IMPUTADO]',
    IMPUTADO_NACIONALIDAD: imputado?.nacionalidad || 'CHILENA',
    SITUACION_LIBERTAD: estaDetenido
      ? `actualmente privado de libertad en ${centroPenal || '[CENTRO PENAL]'}`
      : `domiciliado(a) en ${imputado?.domicilio || '[DOMICILIO IMPUTADO]'}`,
    ABOGADO_NOMBRE: abogado?.nombre || '[NOMBRE ABOGADO]',
    ABOGADO_RUN: abogado?.run || '[RUN ABOGADO]',
    ABOGADO_DOMICILIO: abogado?.domicilio || '[DOMICILIO ABOGADO]',
    ABOGADO_CORREO: abogado?.correo || '[CORREO ABOGADO]',
    // ✅ Si la causa no tiene su propio correo de notificación elegido, se
    // usa el del perfil del abogado como respaldo — antes quedaba en
    // "[CORREO DE NOTIFICACIÓN]" aunque el abogado sí tuviera uno guardado.
    CORREO_NOTIFICACION: causa?.correo_notificacion || abogado?.correo || '[CORREO DE NOTIFICACIÓN]',
    FECHA: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
  }
}

// ✅ FIX: el .doc se veía "desprolijo" al abrirlo en Word de verdad — sin
// sangría, sin espacio entre párrafos y con letra muy grande. La causa: Word
// NO respeta de forma confiable el CSS puesto solo en <body> cuando importa
// un archivo HTML como si fuera .doc — ignora la herencia y aplica su propio
// estilo "Normal" por defecto (que suele ser más grande). La forma correcta
// de generar un .doc por HTML que Word SÍ respeta es la que usa Word mismo al
// exportar "Página web filtrada": una clase p.MsoNormal declarada en un
// <style>, repetir tamaño/tipografía en CADA párrafo (no solo en el body), y
// un bloque [if gte mso 9] con la configuración del documento. Los tamaños se
// dan en puntos (pt), no píxeles, que es la unidad real de Word.
function descargarWord(texto, nombreArchivo) {
  const FUENTE = "'Times New Roman',serif"
  const TAMANO = '12pt'
  const parrafos = texto.split('\n').map(l => {
    const estiloBase = `margin:0 0 12pt 0;font-family:${FUENTE};font-size:${TAMANO};line-height:150%;text-align:justify;`
    if (!l) return `<p class="MsoNormal" style="${estiloBase}">&nbsp;</p>`
    const tieneSangria = l.startsWith('\t')
    const limpio = l.replace(/^\t+/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const estilo = estiloBase + (tieneSangria ? 'text-indent:35.4pt;' : '')
    return `<p class="MsoNormal" style="${estilo}"><span style="font-family:${FUENTE};font-size:${TAMANO};">${limpio}</span></p>`
  }).join('')
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>${nombreArchivo}</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page Section1 { size:21.0cm 29.7cm; margin:2.5cm 2.5cm 2.5cm 2.5cm; }
      div.Section1 { page:Section1; }
      body { font-family:${FUENTE}; font-size:${TAMANO}; }
      p.MsoNormal { margin:0 0 12pt 0; font-family:${FUENTE}; font-size:${TAMANO}; line-height:150%; }
    </style>
  </head>
  <body><div class="Section1">${parrafos}</div></body>
  </html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function PerfilAbogado({ abogado, setAbogado, onGuardar, guardando }) {
  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1E293B', background: '#fff', ...f }
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4, ...f }}>Datos del abogado patrocinante</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, ...f }}>Se usan para rellenar automáticamente los escritos. Se guardan para la próxima vez.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.3fr 1.3fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, fontWeight: 600, ...f }}>Nombre completo</div>
          <input style={inp} value={abogado.nombre} onChange={e => setAbogado(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del abogado" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, fontWeight: 600, ...f }}>RUN</div>
          <input style={inp} value={abogado.run} onChange={e => setAbogado(p => ({ ...p, run: e.target.value }))} placeholder="Ej: 12.345.678-9" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, fontWeight: 600, ...f }}>Domicilio profesional</div>
          <input style={inp} value={abogado.domicilio} onChange={e => setAbogado(p => ({ ...p, domicilio: e.target.value }))} placeholder="Domicilio para notificaciones" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, fontWeight: 600, ...f }}>Correo</div>
          <select style={inp} value={abogado.correo || ''} onChange={e => setAbogado(p => ({ ...p, correo: e.target.value }))}>
            <option value="">Seleccionar correo...</option>
            <option value="JOBREGONABOGADO@GMAIL.COM">JOBREGONABOGADO@GMAIL.COM</option>
            <option value="NOTIFICACION.DEFENSAPENAL@GMAIL.COM">NOTIFICACION.DEFENSAPENAL@GMAIL.COM</option>
          </select>
        </div>
      </div>
      <button className="btn-secondary" style={{ marginTop: 12, fontSize: 12 }} onClick={onGuardar} disabled={guardando}>{guardando ? 'Guardando...' : '💾 Guardar datos'}</button>
    </div>
  )
}

export default function Escritos({ session, registrarActividad }) {
  const [search, setSearch] = useState('')
  const [causas, setCausas] = useState([])
  const [loading, setLoading] = useState(false)
  const [causaSel, setCausaSel] = useState(null)
  const [imputados, setImputados] = useState([])
  const [impSel, setImpSel] = useState(null)
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [preview, setPreview] = useState('')
  // ✅ RUT y domicilio definitivos de Joaquín — se usan como valor por
  // defecto para cualquier cuenta que aún no tenga su propio perfil
  // guardado en `perfil_abogado`.
  const [abogado, setAbogado] = useState({ nombre: 'JOAQUÍN IGNACIO OBREGÓN ABARCA', run: '17.348.087-3', domicilio: 'CALLE FABRICA 1996-D OFICINA 4 SANTIAGO', correo: '' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [guardandoEscrito, setGuardandoEscrito] = useState(false)

  useEffect(() => { cargarPerfilAbogado() }, [session])

  const cargarPerfilAbogado = async () => {
    const email = session?.user?.email
    if (!email) return
    const { data } = await supabase.from('perfil_abogado').select('*').eq('email', email).maybeSingle()
    if (data) setAbogado({ nombre: data.nombre || '', run: data.run || '', domicilio: data.domicilio || '', correo: data.correo || '' })
  }

  const guardarPerfilAbogado = async () => {
    const email = session?.user?.email
    if (!email) return
    setGuardandoPerfil(true)
    await supabase.from('perfil_abogado').upsert({ email, nombre: abogado.nombre.toUpperCase(), run: abogado.run.toUpperCase(), domicilio: abogado.domicilio.toUpperCase(), correo: abogado.correo || null }, { onConflict: 'email' })
    setGuardandoPerfil(false)
  }

  const buscarCausas = async (q) => {
    setSearch(q)
    if (!q || q.length < 2) { setCausas([]); return }
    setLoading(true)
    const { data } = await supabase.from('causas').select('*').or(`ruc.ilike.%${q}%,imputado.ilike.%${q}%,rit.ilike.%${q}%`).limit(15)
    setCausas(data || [])
    setLoading(false)
  }

  const seleccionarCausa = async (c) => {
    setCausaSel(c)
    setCausas([])
    setSearch('')
    setPlantillaSel(null)
    setImpSel(null)
    const { data } = await supabase.from('imputados').select('*').eq('causa_id', c.id).order('created_at', { ascending: true })
    setImputados(data || [])
    if ((data || []).length === 1) setImpSel(data[0])
  }

  const abrirPlantilla = (plantilla) => {
    setPlantillaSel(plantilla)
    const datos = construirDatos(causaSel, impSel, abogado)
    setPreview(plantilla.generar(datos))
  }

  const handleDescargar = () => {
    const nombreArchivo = `${plantillaSel.nombre.replace(/\s+/g, '_')}_${causaSel?.ruc || 'causa'}`
    descargarWord(preview, nombreArchivo)
    if (registrarActividad) registrarActividad('accion', `Generó escrito "${plantillaSel.nombre}" en RUC ${causaSel?.ruc}`)
  }

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(preview)
    alert('Texto copiado al portapapeles.')
  }

  const handleGuardarRegistro = async () => {
    setGuardandoEscrito(true)
    await supabase.from('escritos_generados').insert({
      causa_id: causaSel.id, ruc: causaSel.ruc, imputado_id: impSel?.id || null,
      tipo_escrito: plantillaSel.nombre, contenido_texto: preview, generado_por: session?.user?.email || 'usuario',
    })
    setGuardandoEscrito(false)
    if (registrarActividad) registrarActividad('accion', `Guardó escrito "${plantillaSel.nombre}" en RUC ${causaSel?.ruc}`)
    alert('Escrito guardado en el historial de la causa.')
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1E293B', background: '#fff', ...f }

  return (
    <div style={{ background: '#F8F9FC', minHeight: '100vh', ...f }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>Escritos</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Genera escritos judiciales rellenados automáticamente con los datos de la causa.</p>
        </div>

        <PerfilAbogado abogado={abogado} setAbogado={setAbogado} onGuardar={guardarPerfilAbogado} guardando={guardandoPerfil} />

        {/* Paso 1: elegir causa */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 12, ...f }}>1. Elige la causa</div>
          {causaSel ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', ...f }}>RUC {causaSel.ruc} · RIT {causaSel.rit || '—'}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, ...f }}>{causaSel.tribunal} · {causaSel.imputado}</div>
              </div>
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setCausaSel(null); setImputados([]); setImpSel(null); setPlantillaSel(null) }}>Cambiar</button>
            </div>
          ) : (
            <div>
              <input style={inp} placeholder="Buscar por RUC, RIT o nombre del imputado..." value={search} onChange={e => buscarCausas(e.target.value)} />
              {loading && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, ...f }}>Buscando...</div>}
              {causas.length > 0 && (
                <div style={{ marginTop: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  {causas.map(c => (
                    <div key={c.id} className="causa-row" onClick={() => seleccionarCausa(c)} style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', ...f }}>RUC {c.ruc} · RIT {c.rit || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, ...f }}>{c.tribunal} · {c.imputado}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paso 2: elegir imputado si hay más de uno */}
        {causaSel && imputados.length > 1 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 12, ...f }}>2. Esta causa tiene varios imputados — ¿para cuál es el escrito?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {imputados.map(imp => (
                <button key={imp.id} onClick={() => setImpSel(imp)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${impSel?.id === imp.id ? '#1E293B' : '#E2E8F0'}`, background: impSel?.id === imp.id ? '#1E293B' : '#fff', color: impSel?.id === imp.id ? '#fff' : '#64748b', cursor: 'pointer', ...f }}>
                  {imp.nombre || 'Sin nombre'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paso 3: elegir plantilla */}
        {causaSel && (imputados.length <= 1 || impSel) && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 12, ...f }}>{imputados.length > 1 ? '3' : '2'}. Elige el escrito</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {PLANTILLAS.map(p => (
                <div key={p.id} className="plantilla-card" onClick={() => abrirPlantilla(p)}
                  style={{ border: `1.5px solid ${plantillaSel?.id === p.id ? '#1E293B' : '#E2E8F0'}`, borderRadius: 12, padding: 16, background: plantillaSel?.id === p.id ? '#F8F9FC' : '#fff' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4, ...f }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', ...f }}>{p.descripcion}</div>
                </div>
              ))}
              <div style={{ border: '1.5px dashed #E2E8F0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>➕</div>
                <div style={{ fontSize: 12, textAlign: 'center', ...f }}>Más escritos próximamente</div>
              </div>
            </div>
          </div>
        )}

        {/* Paso 4: editor / preview */}
        {plantillaSel && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', ...f }}>{plantillaSel.nombre} — revisa y edita antes de descargar</div>
              <span style={{ fontSize: 11, color: '#94a3b8', ...f }}>Puedes escribir directo en el cuadro</span>
            </div>
            <textarea value={preview} onChange={e => setPreview(e.target.value)}
              style={{ width: '100%', minHeight: 420, padding: 20, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, lineHeight: 1.7, color: '#1E293B', fontFamily: "'Times New Roman',serif", resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={handleDescargar}>📄 Descargar Word</button>
              <button className="btn-secondary" onClick={handleCopiar}>📋 Copiar texto</button>
              <button className="btn-secondary" onClick={handleGuardarRegistro} disabled={guardandoEscrito}>{guardandoEscrito ? 'Guardando...' : '💾 Guardar en historial'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
