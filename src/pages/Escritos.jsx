import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generarPdfEscrito, tribunalCompleto } from './escritos/generarPdf'
import { getMSToken, uploadFile } from '../lib/onedrive'
import { sanitizarNombreArchivo, hoyISO } from './dashboard/utils'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  .btn-primary { font-family:'Manrope','Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,41,59,0.2); text-transform:uppercase; letter-spacing:0.3px; }
  .btn-primary:hover { background:#0f172a; box-shadow:0 4px 16px rgba(30,41,59,0.3); }
  .btn-primary:disabled { opacity:0.5; cursor:default; }
  .btn-secondary { font-family:'Manrope','Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; text-transform:uppercase; letter-spacing:0.3px; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E293B; background:#F8F9FC; }
  .plantilla-card { transition:all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; position:relative; }
  .plantilla-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.1) !important; border-color:#93c5fd !important; }
  .causa-row { transition:background 0.2s ease; cursor:pointer; }
  .causa-row:hover { background:#F8F9FC !important; }
  input,select,textarea { font-family:'Manrope','Inter',sans-serif !important; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
`

const f = { fontFamily:"'Manrope','Inter',sans-serif" }

// "PRIMER OTROSÍ", "SEGUNDO OTROSÍ"... — solo se usan cuando hay 3 o más
// escritos combinados; con 2 va simplemente "OTROSÍ" sin numerar.
const ORDINALES = ['PRIMER','SEGUNDO','TERCER','CUARTO','QUINTO','SEXTO','SÉPTIMO','OCTAVO','NOVENO','DÉCIMO']

function construirDatos(causa, imputado, abogado) {
  const estaDetenido = imputado?.esta_detenido
  const centroPenal = imputado?.lugar_detencion || causa?.centro_penal
  const delitos = (causa?.delito || '').split('|').map(d => d.trim()).filter(Boolean)
  return {
    TRIBUNAL: causa?.tribunal || '[TRIBUNAL]',
    RUC: causa?.ruc || '[RUC]',
    RIT: causa?.rit || '[RIT]',
    DELITO: delitos.join(', ') || '[DELITO]',
    // ✅ Si hay más de un delito, se nombra solo el primero + "y otros" — así
    // lo pidió Joaquín, en vez de listarlos todos en la identificación.
    DELITO_TEXTO: delitos.length > 1 ? `${delitos[0]} y otros` : (delitos[0] || ''),
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
    CORREO_NOTIFICACION: causa?.correo_notificacion || abogado?.correo || '[CORREO DE NOTIFICACIÓN]',
    FECHA: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
  }
}

// Reemplaza {TOKEN} por su valor — si no hay valor para ese token, lo deja
// tal cual (mejor que borrarlo en silencio: se nota que falta completarlo).
function resolverPlaceholders(texto, datos) {
  return (texto || '').replace(/\{(\w+)\}/g, (m, key) => (datos[key] !== undefined && datos[key] !== '') ? datos[key] : m)
}

// Arma el bloque de "suma" ("EN LO PRINCIPAL: X" / "OTROSÍ: Y" / "PRIMER
// OTROSÍ..." según cuántos capítulos se combinen) y el cuerpo completo,
// anteponiendo la misma etiqueta al inicio del cuerpo de cada otrosí (menos
// el principal, que no la repite — igual que en los escritos reales).
function armarSumaYCuerpo(capitulos) {
  if (capitulos.length === 1) return { sumaBlock: `# ${capitulos[0].suma}`, cuerpoBlock: capitulos[0].cuerpo }
  const etiquetas = capitulos.length === 2
    ? ['EN LO PRINCIPAL', 'OTROSÍ']
    : ['EN LO PRINCIPAL', ...ORDINALES.slice(0, capitulos.length - 1).map(o => `${o} OTROSÍ`)]
  const sumaBlock = capitulos.map((c, i) => `# ${etiquetas[i]}: ${c.suma}`).join('\n')
  const cuerpoBlock = capitulos.map((c, i) => i === 0 ? c.cuerpo : `${etiquetas[i]}: ${c.cuerpo}`).join('\n\n')
  return { sumaBlock, cuerpoBlock }
}

// Patrocinio y Poder tiene una estructura propia: primero van los datos del
// IMPUTADO (es quien "digo" en el escrito, no el abogado), a diferencia de
// todos los demás, donde el abogado se identifica primero. Por eso no se
// puede combinar con otros escritos en el mismo documento.
function construirEscrito({ causa, imputado, abogado, capitulos, delegado }) {
  const datosBase = construirDatos(causa, imputado, abogado)
  const datos = {
    ...datosBase,
    DELEGADO_NOMBRE: delegado?.nombre || '[NOMBRE DEL ABOGADO DELEGADO]',
    DELEGADO_RUT: delegado?.rut || '[RUT DEL ABOGADO DELEGADO]',
    DELEGADO_CORREO: delegado?.correo || '[CORREO DEL ABOGADO DELEGADO]',
    DELEGADO_DOMICILIO: delegado?.domicilio || '',
    DELEGADO_DOMICILIO_FRASE: delegado?.domicilio ? `con domicilio en ${delegado.domicilio}` : 'de mi mismo domicilio',
  }
  const capitulosResueltos = capitulos.map(p => ({
    suma: resolverPlaceholders(p.suma_defecto, datos),
    cuerpo: resolverPlaceholders(p.cuerpo_defecto, datos),
  }))
  const { sumaBlock, cuerpoBlock } = armarSumaYCuerpo(capitulosResueltos)

  const primero = capitulos[0]
  const destinatario = primero.destinatario_tipo === 'custom'
    ? resolverPlaceholders(primero.destinatario_texto || '[DESTINATARIO]', datos)
    : tribunalCompleto(causa?.tribunal)

  const esSoloPatrocinio = capitulos.length === 1 && capitulos[0].categoria === 'patrocinio_poder'
  const identificacion = esSoloPatrocinio
    ? `${datos.IMPUTADO_NOMBRE}, Cédula Nacional de Identidad Nº ${datos.IMPUTADO_RUT}, ${datos.SITUACION_LIBERTAD}, en causa RUC. ${datos.RUC} RIT ${datos.RIT} a SS., respetuosamente digo:`
    : `${datos.ABOGADO_NOMBRE}, abogado, en representación de ${datos.IMPUTADO_NOMBRE}, en causa RUC. ${datos.RUC} y RIT. ${datos.RIT}${datos.DELITO_TEXTO ? `, por el delito de ${datos.DELITO_TEXTO}` : ''}, a S.S. respetuosamente digo:`

  return `${sumaBlock}\n\n## ${destinatario}\n\n${identificacion}\n\n${cuerpoBlock}`
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

// Buscador/desplegable de abogados a los que ya se les delegó poder antes —
// elegir uno autocompleta RUT/correo/domicilio; "+ Nuevo" pide los datos a
// mano y los deja guardados para la próxima vez.
function SelectorDelegado({ delegados, delegadoSel, setDelegadoSel, nuevo, setNuevo }) {
  const inp = { width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, color: '#1E293B', background: '#fff', ...f }
  return (
    <div style={{ background: '#F8F9FC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 10, ...f }}>Abogado a quien se delega el poder</div>
      <select style={inp} value={delegadoSel ? delegadoSel.id : (nuevo ? '__nuevo__' : '')}
        onChange={e => {
          if (e.target.value === '__nuevo__') { setDelegadoSel(null); setNuevo(true); return }
          setNuevo(false)
          setDelegadoSel(delegados.find(d => d.id === e.target.value) || null)
        }}>
        <option value="">— Elegir abogado ya guardado —</option>
        {delegados.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        <option value="__nuevo__">➕ Nuevo abogado delegado</option>
      </select>
      {delegadoSel && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.6, ...f }}>
          RUT: {delegadoSel.rut || '—'} · Correo: {delegadoSel.correo || '—'} · Domicilio: {delegadoSel.domicilio || '—'}
        </div>
      )}
      {nuevo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <input style={{ ...inp, gridColumn: '1/-1' }} placeholder="Nombre completo *" value={nuevo.nombre || ''} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} />
          <input style={inp} placeholder="RUT" value={nuevo.rut || ''} onChange={e => setNuevo(p => ({ ...p, rut: e.target.value }))} />
          <input style={inp} placeholder="Correo" value={nuevo.correo || ''} onChange={e => setNuevo(p => ({ ...p, correo: e.target.value }))} />
          <input style={{ ...inp, gridColumn: '1/-1' }} placeholder="Domicilio (si es distinto al mío)" value={nuevo.domicilio || ''} onChange={e => setNuevo(p => ({ ...p, domicilio: e.target.value }))} />
        </div>
      )}
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
  const [plantillas, setPlantillas] = useState([])
  const [capitulosSel, setCapitulosSel] = useState([]) // orden = orden de selección
  const [preview, setPreview] = useState('')
  const [delegados, setDelegados] = useState([])
  const [delegadoSel, setDelegadoSel] = useState(null)
  const [delegadoNuevo, setDelegadoNuevo] = useState(false)
  const [abogado, setAbogado] = useState({ nombre: 'JOAQUÍN IGNACIO OBREGÓN ABARCA', run: '17.348.087-3', domicilio: 'CALLE FABRICA 1996-D OFICINA 4 SANTIAGO', correo: '' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok, mensaje }

  useEffect(() => { cargarPerfilAbogado() }, [session])
  useEffect(() => { cargarPlantillas() }, [])
  useEffect(() => {
    if (capitulosSel.some(c => c.categoria === 'delegacion_poder')) cargarDelegados()
  }, [capitulosSel])

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

  const cargarPlantillas = async () => {
    const { data } = await supabase.from('escritos_plantillas').select('*').order('orden')
    setPlantillas(data || [])
  }

  const cargarDelegados = async () => {
    const { data } = await supabase.from('abogados_delegados').select('*').order('nombre')
    setDelegados(data || [])
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
    setCapitulosSel([])
    setPreview('')
    setResultado(null)
    setImpSel(null)
    const { data } = await supabase.from('imputados').select('*').eq('causa_id', c.id).order('created_at', { ascending: true })
    setImputados(data || [])
    if ((data || []).length === 1) setImpSel(data[0])
  }

  // ✅ Patrocinio y Poder no se puede combinar con otros escritos en el
  // mismo documento (ahí quien "digo" es el imputado, no el abogado) — se
  // avisa en vez de dejar armar una combinación que no tiene sentido legal.
  const toggleCapitulo = (p) => {
    setResultado(null)
    const yaEsta = capitulosSel.some(c => c.id === p.id)
    if (yaEsta) { setCapitulosSel(prev => prev.filter(c => c.id !== p.id)); return }
    if (p.categoria === 'patrocinio_poder' && capitulosSel.length > 0) {
      alert('"Patrocinio y Poder" no se puede combinar con otros escritos en el mismo documento — genera uno aparte.')
      return
    }
    if (p.categoria !== 'patrocinio_poder' && capitulosSel.some(c => c.categoria === 'patrocinio_poder')) {
      alert('"Patrocinio y Poder" no se puede combinar con otros escritos en el mismo documento — quita esa selección primero.')
      return
    }
    setCapitulosSel(prev => [...prev, p])
  }

  const necesitaDelegado = capitulosSel.some(c => c.categoria === 'delegacion_poder')
  const delegadoListo = !necesitaDelegado || delegadoSel || (delegadoNuevo && delegadoNuevo.nombre?.trim())
  const puedeGenerar = causaSel && (imputados.length <= 1 || impSel) && capitulosSel.length > 0 && delegadoListo

  const generarPreview = () => {
    const texto = construirEscrito({ causa: causaSel, imputado: impSel, abogado, capitulos: capitulosSel, delegado: delegadoSel || delegadoNuevo || null })
    setPreview(texto)
    setResultado(null)
  }

  const handleDescargarYGuardar = async () => {
    setGenerando(true)
    setResultado(null)
    try {
      // Si se escribió un delegado nuevo (no elegido de la lista), se guarda
      // primero para poder reutilizarlo la próxima vez sin volver a tipearlo.
      let delegadoFinal = delegadoSel
      if (necesitaDelegado && delegadoNuevo && delegadoNuevo.nombre?.trim() && !delegadoSel) {
        const { data } = await supabase.from('abogados_delegados')
          .insert({ nombre: delegadoNuevo.nombre.trim(), rut: delegadoNuevo.rut || null, correo: delegadoNuevo.correo || null, domicilio: delegadoNuevo.domicilio || null })
          .select().single()
        delegadoFinal = data
      }

      const nombreEscrito = capitulosSel.map(c => c.nombre).join(' + ')
      const nombreArchivo = `${nombreEscrito} - ${hoyISO()}.pdf`
      const blob = await generarPdfEscrito(preview)
      const file = new File([blob], nombreArchivo, { type: 'application/pdf' })

      // Descarga en el navegador — igual que antes, pero en PDF real.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = nombreArchivo
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // ✅ El escrito definitivo queda guardado en Carpeta y Documentos de
      // la causa — mismo patrón que documentos.jsx: sube a Storage, inserta
      // en documentos_causa.
      const path = `${causaSel.id}/${Date.now()}_${sanitizarNombreArchivo(nombreArchivo)}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
        await supabase.from('documentos_causa').insert({
          causa_id: causaSel.id, nombre: nombreArchivo, storage_path: path, url: urlData.publicUrl,
          tipo_mime: 'application/pdf', subido_por: session?.user?.email || 'usuario',
        })
      }
      // Si OneDrive está conectado, se sube también allá — no bloquea el
      // resto si falla (sesión vencida, etc.).
      if (getMSToken()) uploadFile(causaSel.ruc, file).catch(() => {})

      await supabase.from('escritos_generados').insert({
        causa_id: causaSel.id, ruc: causaSel.ruc, imputado_id: impSel?.id || null,
        tipo_escrito: nombreEscrito, contenido_texto: preview, generado_por: session?.user?.email || 'usuario',
      })

      if (registrarActividad) registrarActividad('accion', `Generó escrito "${nombreEscrito}" en RUC ${causaSel.ruc}`)
      setResultado({ ok: true, mensaje: 'Descargado y guardado en Carpeta y Documentos de la causa' + (getMSToken() ? ' y en OneDrive' : '') + '.' })
      if (necesitaDelegado) { setDelegadoSel(delegadoFinal); setDelegadoNuevo(false); cargarDelegados() }
    } catch (err) {
      setResultado({ ok: false, mensaje: 'No se pudo generar/guardar el PDF: ' + (err?.message || 'Error desconocido.') })
    } finally {
      setGenerando(false)
    }
  }

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(preview)
    alert('Texto copiado al portapapeles.')
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1E293B', background: '#fff', ...f }

  return (
    <div style={{ background: '#F8F9FC', minHeight: '100vh', ...f }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>Escritos</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Genera escritos judiciales rellenados automáticamente con los datos de la causa. Puedes marcar varios para combinarlos en uno solo (En lo principal / Otrosí).</p>
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
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setCausaSel(null); setImputados([]); setImpSel(null); setCapitulosSel([]); setPreview(''); setResultado(null) }}>Cambiar</button>
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

        {/* Paso 3: elegir escrito(s) — selección múltiple */}
        {causaSel && (imputados.length <= 1 || impSel) && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 12, ...f }}>{imputados.length > 1 ? '3' : '2'}. Elige el o los escritos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {plantillas.map(p => {
                const posicion = capitulosSel.findIndex(c => c.id === p.id)
                const marcada = posicion !== -1
                return (
                  <div key={p.id} className="plantilla-card" onClick={() => toggleCapitulo(p)}
                    style={{ border: `1.5px solid ${marcada ? '#1E293B' : '#E2E8F0'}`, borderRadius: 12, padding: 16, background: marcada ? '#F8F9FC' : '#fff' }}>
                    {marcada && (
                      <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', background: '#1E293B', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', ...f }}>{posicion + 1}</div>
                    )}
                    <div style={{ fontSize: 20, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4, ...f }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', ...f }}>{p.categoria === 'patrocinio_poder' ? 'No se combina con otros' : 'Puedes combinarlo con otros'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {necesitaDelegado && (
          <SelectorDelegado delegados={delegados} delegadoSel={delegadoSel} setDelegadoSel={setDelegadoSel} nuevo={delegadoNuevo} setNuevo={setDelegadoNuevo} />
        )}

        {puedeGenerar && !preview && (
          <div style={{ marginBottom: 20 }}>
            <button className="btn-primary" onClick={generarPreview}>Generar vista previa</button>
          </div>
        )}

        {/* Paso 4: editor / preview */}
        {preview && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', ...f }}>Revisa y edita antes de descargar</div>
              <span style={{ fontSize: 11, color: '#94a3b8', ...f }}>Puedes escribir directo en el cuadro · **texto** = negrita</span>
            </div>
            <textarea value={preview} onChange={e => setPreview(e.target.value)}
              style={{ width: '100%', minHeight: 420, padding: 20, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, lineHeight: 1.7, color: '#1E293B', fontFamily: "'Times New Roman',serif", resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={handleDescargarYGuardar} disabled={generando}>{generando ? 'Generando...' : '📄 Descargar PDF'}</button>
              <button className="btn-secondary" onClick={handleCopiar}>📋 Copiar texto</button>
              <button className="btn-secondary" onClick={() => { setCapitulosSel([]); setPreview(''); setResultado(null); setDelegadoSel(null); setDelegadoNuevo(false) }}>Empezar de nuevo</button>
            </div>
            {resultado && (
              <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: resultado.ok ? '#065f46' : '#dc2626', background: resultado.ok ? '#ecfdf5' : '#fef2f2', border: `1px solid ${resultado.ok ? '#a7f3d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 12px', ...f }}>
                {resultado.ok ? '✅ ' : '⚠ '}{resultado.mensaje}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
