import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generarPdfEscrito, tribunalCompleto, corteCompleta } from './escritos/generarPdf'
import { getMSToken, uploadFile } from '../lib/onedrive'
import { sanitizarNombreArchivo, fechaDDMM } from './dashboard/utils'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
  .btn-primary { font-family:'Manrope','Inter',sans-serif; background:#1E3A2F; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,58,47,0.2); text-transform:uppercase; letter-spacing:0.3px; }
  .btn-primary:hover { background:#16301F; box-shadow:0 4px 16px rgba(30,58,47,0.3); }
  .btn-primary:disabled { opacity:0.5; cursor:default; }
  .btn-secondary { font-family:'Manrope','Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; text-transform:uppercase; letter-spacing:0.3px; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E3A2F; background:#FAF7F0; }
  .plantilla-card { transition:all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; position:relative; }
  .plantilla-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.1) !important; border-color:#93c5fd !important; }
  .causa-row { transition:background 0.2s ease; cursor:pointer; }
  .causa-row:hover { background:#FAF7F0 !important; }
  input,select,textarea { font-family:'Manrope','Inter',sans-serif !important; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
`

const f = { fontFamily:"'Manrope','Inter',sans-serif" }

// "PRIMER OTROSÍ", "SEGUNDO OTROSÍ"... — solo se usan cuando hay 3 o más
// escritos combinados; con 2 va simplemente "OTROSÍ" sin numerar.
const ORDINALES = ['PRIMER','SEGUNDO','TERCER','CUARTO','QUINTO','SEXTO','SÉPTIMO','OCTAVO','NOVENO','DÉCIMO']

// Junta varios nombres en una lista legal ("A y B" / "A, B y C") — se usa
// cuando el escrito es respecto de más de un imputado a la vez.
function listaNombres(nombres) {
  if (nombres.length <= 1) return nombres[0] || ''
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

// ✅ Ahora recibe un ARREGLO de imputados (antes uno solo) — Joaquín pidió
// poder elegir uno, varios, o todos, ya que a veces el escrito es respecto
// de más de una persona a la vez (ej. una Delegación de Poder para dos
// imputados). El RUT/domicilio/situación de libertad siguen tomando al
// PRIMER imputado elegido, porque esos datos no tienen cómo combinarse en
// una sola frase con sentido si son dos personas distintas.
function construirDatos(causa, imputados, abogado) {
  const lista = imputados && imputados.length ? imputados : [null]
  const primero = lista[0]
  const estaDetenido = primero?.esta_detenido
  const centroPenal = primero?.lugar_detencion || causa?.centro_penal
  const delitos = (causa?.delito || '').split('|').map(d => d.trim()).filter(Boolean)
  return {
    TRIBUNAL: causa?.tribunal || '[TRIBUNAL]',
    RUC: causa?.ruc || '[RUC]',
    RIT: causa?.rit || '[RIT]',
    DELITO: delitos.join(', ') || '[DELITO]',
    // ✅ Si hay más de un delito, se nombra solo el primero + "y otros" — así
    // lo pidió Joaquín, en vez de listarlos todos en la identificación.
    DELITO_TEXTO: delitos.length > 1 ? `${delitos[0]} y otros` : (delitos[0] || ''),
    IMPUTADO_NOMBRE: listaNombres(lista.map(i => i?.nombre).filter(Boolean)) || causa?.imputado?.split('|')[0] || '[NOMBRE IMPUTADO]',
    IMPUTADO_RUT: primero?.rut || '[RUT IMPUTADO]',
    IMPUTADO_DOMICILIO: primero?.domicilio || '[DOMICILIO IMPUTADO]',
    IMPUTADO_NACIONALIDAD: primero?.nacionalidad || 'CHILENA',
    SITUACION_LIBERTAD: estaDetenido
      ? `actualmente privado de libertad en ${centroPenal || '[CENTRO PENAL]'}`
      : `domiciliado(a) en ${primero?.domicilio || '[DOMICILIO IMPUTADO]'}`,
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

// Arma las líneas de "suma" ("EN LO PRINCIPAL: X" / "OTROSÍ: Y" / "PRIMER
// OTROSÍ..." según cuántos capítulos se combinen) y el cuerpo completo,
// anteponiendo la misma etiqueta al inicio del cuerpo de cada otrosí (menos
// el principal, que no la repite — igual que en los escritos reales).
function armarSumaYCuerpo(capitulos) {
  if (capitulos.length === 1) return { sumaLineas: [capitulos[0].suma], cuerpoBlock: capitulos[0].cuerpo }
  const etiquetas = capitulos.length === 2
    ? ['EN LO PRINCIPAL', 'OTROSÍ']
    : ['EN LO PRINCIPAL', ...ORDINALES.slice(0, capitulos.length - 1).map(o => `${o} OTROSÍ`)]
  const sumaLineas = capitulos.map((c, i) => `${etiquetas[i]}: ${c.suma}`)
  const cuerpoBlock = capitulos.map((c, i) => i === 0 ? c.cuerpo : `${etiquetas[i]}: ${c.cuerpo}`).join('\n\n')
  return { sumaLineas, cuerpoBlock }
}

// Patrocinio y Poder tiene una estructura propia: primero van los datos del
// IMPUTADO (es quien "digo" en el escrito, no el abogado), a diferencia de
// todos los demás, donde el abogado se identifica primero. Por eso no se
// puede combinar con otros escritos en el mismo documento.
//
// ✅ Devuelve un objeto { sumaLineas, destinatario, cuerpo } en vez de un
// solo texto con las marcas "#"/"##" — esas marcas son solo para el
// generador de PDF (ver generarPdf.js) y confundían a Joaquín al verlas tal
// cual en el cuadro de edición. La suma y el destinatario se muestran y
// editan aparte, ya con el estilo (negrita/centrado) real; el cuadro de
// texto grande solo tiene la identificación + el cuerpo, sin marcas.
function construirEscrito({ causa, imputados, abogado, capitulos, delegado, apelacionCorte }) {
  const datosBase = construirDatos(causa, imputados, abogado)
  const datos = {
    ...datosBase,
    DELEGADO_NOMBRE: delegado?.nombre || '[NOMBRE DEL ABOGADO DELEGADO]',
    DELEGADO_RUT: delegado?.rut || '[RUT DEL ABOGADO DELEGADO]',
    DELEGADO_CORREO: delegado?.correo || '[CORREO DEL ABOGADO DELEGADO]',
    DELEGADO_DOMICILIO: delegado?.domicilio || '',
    DELEGADO_DOMICILIO_FRASE: delegado?.domicilio ? `con domicilio en ${delegado.domicilio}` : 'de mi mismo domicilio',
    // ✅ Rol/sala/fecha de la apelación ya registrada en la pestaña
    // "Apelaciones a la Corte" de esta causa — para no volver a tipearlo en
    // el escrito de Anuncio.
    ROL_CORTE: apelacionCorte?.rol_corte || '[ROL DE CORTE — regístralo primero en "Apelaciones a la Corte"]',
    SALA_CORTE: apelacionCorte?.sala_corte || '[SALA]',
    FECHA_AUDIENCIA_CORTE: apelacionCorte?.fecha_audiencia_corte ? fechaDDMM(apelacionCorte.fecha_audiencia_corte) : '[FECHA]',
  }
  const capitulosResueltos = capitulos.map(p => ({
    suma: resolverPlaceholders(p.suma_defecto, datos),
    cuerpo: resolverPlaceholders(p.cuerpo_defecto, datos),
  }))
  const { sumaLineas, cuerpoBlock } = armarSumaYCuerpo(capitulosResueltos)

  const primero = capitulos[0]
  const destinatario = primero.destinatario_tipo === 'corte'
    ? corteCompleta(causa?.tribunal)
    : primero.destinatario_tipo === 'custom'
      ? resolverPlaceholders(primero.destinatario_texto || '[DESTINATARIO]', datos)
      : tribunalCompleto(causa?.tribunal)

  const esSoloPatrocinio = capitulos.length === 1 && capitulos[0].categoria === 'patrocinio_poder'
  // ✅ Los escritos dirigidos a la Corte de Apelaciones (ej. Anuncio para
  // alegar) no llevan RUC/RIT del tribunal de origen — se identifican por
  // el Rol de Ingreso Corte, y llevan "por la parte recurrente" antes de
  // "en representación de", como en los modelos reales de Joaquín.
  const esCorte = primero.destinatario_tipo === 'corte'
  // ✅ NUEVO: escritos donde Joaquín YA NO representa a nadie en la causa
  // (ej. pedir que se eliminen sus correos de notificación como EX
  // interviniente, ya con otro abogado a cargo) — no tiene sentido decir
  // "en representación de X" si justamente el punto es que ya no lo es.
  const esSinRepresentacion = primero.categoria === 'sin_representacion'
  const identificacion = esSoloPatrocinio
    ? `${datos.IMPUTADO_NOMBRE}, Cédula Nacional de Identidad Nº ${datos.IMPUTADO_RUT}, ${datos.SITUACION_LIBERTAD}, en causa RUC. ${datos.RUC} RIT ${datos.RIT} a SS., respetuosamente digo:`
    : esCorte
      ? `${datos.ABOGADO_NOMBRE}, abogado, por la parte recurrente, en representación de ${datos.IMPUTADO_NOMBRE} autos Rol de Ingreso Corte ${datos.ROL_CORTE} a SS., Iltma., respetuosamente digo:`
      : esSinRepresentacion
        ? `${datos.ABOGADO_NOMBRE}, abogado, como ex interviniente en causa RIT ${datos.RIT} RUC ${datos.RUC}${datos.DELITO_TEXTO ? `, por el delito de ${datos.DELITO_TEXTO}` : ''}, a SS., con respeto digo:`
        : `${datos.ABOGADO_NOMBRE}, abogado, en representación de ${datos.IMPUTADO_NOMBRE}, en causa RUC. ${datos.RUC} y RIT. ${datos.RIT}${datos.DELITO_TEXTO ? `, por el delito de ${datos.DELITO_TEXTO}` : ''}, a S.S. respetuosamente digo:`

  // ✅ NUEVO: "pre-suma" — bloque de datos (Rol de Ingreso, Secretaría,
  // Materia, Parte, Tabla, Vista de la causa) que va ANTES del título en
  // los escritos a la Corte, tal como en los modelos reales de Joaquín.
  // Solo la primera plantilla puede traerlo (pre_suma_defecto en la BD);
  // el resto de los escritos no lo usan y queda como arreglo vacío.
  // ✅ FIX: se guarda como {rotulo, valor} en vez del texto crudo con
  // "**rótulo:**" — Joaquín veía los asteriscos literales en el cuadro de
  // edición. Acá se separan una sola vez; el rótulo queda fijo (en negrita,
  // no se edita) y solo el valor es editable, sin marcas de por medio.
  const preSumaLineas = primero.pre_suma_defecto
    ? resolverPlaceholders(primero.pre_suma_defecto, datos).split('\n').filter(Boolean).map(linea => {
        const m = linea.match(/^\*\*(.+?):\*\*\s*(.*)$/)
        return m ? { rotulo: m[1], valor: m[2] } : { rotulo: '', valor: linea }
      })
    : []

  return { preSumaLineas, sumaLineas, destinatario, cuerpo: `${identificacion}\n\n${cuerpoBlock}` }
}

// Junta todo de nuevo en el formato con "#"/"##" que necesita el generador
// de PDF (ver generarPdf.js) — solo en este punto, justo antes de generar
// el archivo, nunca se le muestra así a Joaquín.
const lineaPreSuma = ({ rotulo, valor }) => rotulo ? `**${rotulo}:** ${valor}` : valor

function textoParaPdf({ preSumaLineas, sumaLineas, destinatario, cuerpo }) {
  const preSuma = preSumaLineas?.length ? `${preSumaLineas.map(l => `% ${lineaPreSuma(l)}`).join('\n')}\n\n` : ''
  return `${preSuma}${sumaLineas.map(l => `# ${l}`).join('\n')}\n\n## ${destinatario}\n\n${cuerpo}`
}

// Versión limpia para copiar al portapapeles o guardar en el historial —
// sin las marcas de negrita/centrado, que no sirven fuera de esta app.
function textoLimpio({ preSumaLineas, sumaLineas, destinatario, cuerpo }) {
  const preSuma = preSumaLineas?.length ? `${preSumaLineas.map(lineaPreSuma).join('\n')}\n\n` : ''
  return `${preSuma}${sumaLineas.join('\n')}\n\n${destinatario}\n\n${cuerpo}`.replace(/\*\*(.+?)\*\*/g, '$1')
}

function PerfilAbogado({ abogado, setAbogado, onGuardar, guardando }) {
  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1E3A2F', background: '#fff', ...f }
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 4, ...f }}>Datos del abogado patrocinante</div>
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
  const inp = { width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, color: '#1E3A2F', background: '#fff', ...f }
  return (
    <div style={{ background: '#FAF7F0', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1E3A2F', marginBottom: 10, ...f }}>Abogado a quien se delega el poder</div>
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
  // ✅ NUEVO: causas que ya pasaron a Juicio Oral tienen un RIT/Tribunal
  // aparte (TOP) del original (Juzgado de Garantía) bajo el mismo RUC — hay
  // que elegir a propósito a cuál de los dos va dirigido el escrito, porque
  // un escrito presentado en el tribunal que no corresponde no sirve.
  // null = todavía no se elige (obliga a elegir antes de poder generar).
  const [destinoJudicial, setDestinoJudicial] = useState(null) // 'garantia' | 'top'
  const [imputados, setImputados] = useState([])
  // ✅ Antes era uno solo (impSel) — ahora es un arreglo: se puede elegir
  // uno, varios, o todos los imputados de la causa para el mismo escrito
  // (ej. una Delegación de Poder que aplica a dos imputados a la vez).
  const [impsSel, setImpsSel] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [capitulosSel, setCapitulosSel] = useState([]) // orden = orden de selección
  const [escrito, setEscrito] = useState(null) // { sumaLineas, destinatario, cuerpo }
  // ✅ Apelación a la Corte más reciente de la causa (rol/sala/fecha) — se
  // usa para rellenar sola el escrito de "Anuncio para alegar en Corte".
  const [apelacionCorte, setApelacionCorte] = useState(null)
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
    setEscrito(null)
    setResultado(null)
    setImpsSel([])
    // Si no tiene Juicio Oral no hay nada que elegir — se usa directo el
    // tribunal/RIT de siempre, sin pedirle nada de más a Joaquín.
    setDestinoJudicial(c.tiene_top ? null : 'garantia')
    const { data } = await supabase.from('imputados').select('*').eq('causa_id', c.id).order('created_at', { ascending: true })
    setImputados(data || [])
    if ((data || []).length === 1) setImpsSel([data[0]])
    // ✅ FIX: puede haber más de una apelación en la misma causa — el
    // Anuncio siempre es respecto a la ÚLTIMA que se registró (por fecha de
    // creación, no por fecha de audiencia, que a veces todavía no está).
    const { data: apelaciones } = await supabase.from('apelaciones_corte').select('*').eq('causa_id', c.id).order('created_at', { ascending: false }).limit(1)
    setApelacionCorte((apelaciones && apelaciones[0]) || null)
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

  const toggleImputado = (imp) => {
    setImpsSel(prev => prev.some(i => i.id === imp.id) ? prev.filter(i => i.id !== imp.id) : [...prev, imp])
  }

  const necesitaDelegado = capitulosSel.some(c => c.categoria === 'delegacion_poder')
  const delegadoListo = !necesitaDelegado || delegadoSel || (delegadoNuevo && delegadoNuevo.nombre?.trim())
  const puedeGenerar = causaSel && !!destinoJudicial && (imputados.length <= 1 || impsSel.length > 0) && capitulosSel.length > 0 && delegadoListo

  // Si eligió Tribunal Oral, el escrito se arma con el tribunal/RIT del
  // Juicio Oral en vez de los del Juzgado de Garantía original — todo el
  // resto de los datos de la causa (RUC, imputados, etc.) siguen siendo los
  // mismos, es el mismo RUC bajo el mismo cuadro.
  const causaParaEscrito = destinoJudicial === 'top'
    ? { ...causaSel, tribunal: causaSel.tribunal_top, rit: causaSel.rit_top }
    : causaSel

  const generarPreview = () => {
    const nuevoEscrito = construirEscrito({ causa: causaParaEscrito, imputados: impsSel, abogado, capitulos: capitulosSel, delegado: delegadoSel || delegadoNuevo || null, apelacionCorte })
    setEscrito(nuevoEscrito)
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
      // ✅ RIT en vez de la fecha en el nombre del archivo — Joaquín pidió
      // poder identificar de qué causa es cada escrito descargado con solo
      // mirar el nombre. Se usa el RIT del tribunal que realmente se eligió
      // (Garantía o Juicio Oral, ver causaParaEscrito más arriba), no
      // siempre el RIT original de la causa.
      const nombreArchivo = `${nombreEscrito} - RIT ${causaParaEscrito.rit || causaSel.ruc}.pdf`
      const blob = await generarPdfEscrito(textoParaPdf(escrito))
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
        causa_id: causaSel.id, ruc: causaSel.ruc, imputado_id: impsSel[0]?.id || null,
        tipo_escrito: nombreEscrito, contenido_texto: textoLimpio(escrito), generado_por: session?.user?.email || 'usuario',
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

  // ✅ FIX: "navigator.clipboard.writeText" a veces falla en silencio en
  // iPhone/iPad (sobre todo con la app instalada como PWA, agregada a la
  // pantalla de inicio) — el navegador puede negar el permiso o simplemente
  // no completar la escritura real, sin lanzar ningún error visible, y como
  // acá no había try/catch, si fallaba no pasaba NADA (ni el aviso de
  // "copiado" ni ningún error): el botón parecía no hacer nada y al pegar
  // en otro lado no aparecía el texto. Ahora, si el método moderno falla,
  // se intenta con el método clásico (textarea oculto + execCommand), que
  // es más confiable en esos casos — y si de plano ninguno funciona, se
  // avisa explícitamente en vez de quedar en silencio.
  const handleCopiar = async () => {
    const texto = textoLimpio(escrito)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API no disponible')
      await navigator.clipboard.writeText(texto)
      alert('Texto copiado al portapapeles.')
      return
    } catch { /* sigue con el método de respaldo abajo */ }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = texto
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (!ok) throw new Error('execCommand copy falló')
      alert('Texto copiado al portapapeles.')
    } catch {
      alert('No se pudo copiar automáticamente (el navegador lo bloqueó). Mantén presionado sobre el texto del cuerpo más abajo y usa "Seleccionar todo" → "Copiar" a mano.')
    }
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#1E3A2F', background: '#fff', ...f }

  // Numeración de pasos — cambia según si la causa tiene Juicio Oral (paso
  // extra para elegir el tribunal) y/o varios imputados (paso extra para
  // elegir a quién corresponde), para que el "1. 2. 3." de la pantalla
  // siempre calce con lo que realmente se está mostrando.
  let _paso = 1
  const pasoCausa = _paso++
  const pasoDestino = causaSel?.tiene_top ? _paso++ : null
  const pasoImputados = imputados.length > 1 ? _paso++ : null
  const pasoEscritos = _paso++

  return (
    <div style={{ background: '#FAF7F0', minHeight: '100vh', ...f }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E3A2F', margin: 0, letterSpacing: '-0.5px' }}>Escritos</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Genera escritos judiciales rellenados automáticamente con los datos de la causa. Puedes marcar varios para combinarlos en uno solo (En lo principal / Otrosí).</p>
        </div>

        <PerfilAbogado abogado={abogado} setAbogado={setAbogado} onGuardar={guardarPerfilAbogado} guardando={guardandoPerfil} />

        {/* Paso 1: elegir causa */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 12, ...f }}>{pasoCausa}. Elige la causa</div>
          {causaSel ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF7F0', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', ...f }}>RUC {causaSel.ruc} · RIT {causaSel.rit || '—'}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, ...f }}>{causaSel.tribunal} · {causaSel.imputado}</div>
              </div>
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setCausaSel(null); setImputados([]); setImpsSel([]); setCapitulosSel([]); setEscrito(null); setResultado(null); setDestinoJudicial(null) }}>Cambiar</button>
            </div>
          ) : (
            <div>
              <input style={inp} placeholder="Buscar por RUC, RIT o nombre del imputado..." value={search} onChange={e => buscarCausas(e.target.value)} />
              {loading && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, ...f }}>Buscando...</div>}
              {causas.length > 0 && (
                <div style={{ marginTop: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  {causas.map(c => (
                    <div key={c.id} className="causa-row" onClick={() => seleccionarCausa(c)} style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A2F', ...f }}>RUC {c.ruc} · RIT {c.rit || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, ...f }}>{c.tribunal} · {c.imputado}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paso extra: si la causa ya pasó a Juicio Oral, tiene un RIT/
            Tribunal aparte (TOP) del original (Juzgado de Garantía) bajo el
            mismo RUC — hay que elegir a propósito a cuál de los dos va
            dirigido el escrito, sin default silencioso, porque presentarlo
            en el tribunal que no corresponde no sirve. */}
        {causaSel?.tiene_top && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 12, ...f }}>{pasoDestino}. Esta causa tiene Juicio Oral — ¿a qué tribunal va este escrito?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setDestinoJudicial('garantia')} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: 'left', border: `1.5px solid ${destinoJudicial === 'garantia' ? '#1E3A2F' : '#E2E8F0'}`, background: destinoJudicial === 'garantia' ? '#FAF7F0' : '#fff', color: '#1E3A2F', cursor: 'pointer', ...f }}>
                {destinoJudicial === 'garantia' ? '✓ ' : ''}Juzgado de Garantía<br/>
                <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>{causaSel.tribunal} · RIT {causaSel.rit}</span>
              </button>
              <button onClick={() => setDestinoJudicial('top')} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: 'left', border: `1.5px solid ${destinoJudicial === 'top' ? '#1E3A2F' : '#E2E8F0'}`, background: destinoJudicial === 'top' ? '#FAF7F0' : '#fff', color: '#1E3A2F', cursor: 'pointer', ...f }}>
                {destinoJudicial === 'top' ? '✓ ' : ''}Tribunal Oral en lo Penal<br/>
                <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>{causaSel.tribunal_top} · RIT {causaSel.rit_top}</span>
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: elegir imputado(s) si hay más de uno — selección múltiple,
            porque un mismo escrito a veces es respecto de varios a la vez
            (ej. una Delegación de Poder para dos imputados). */}
        {causaSel && imputados.length > 1 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 12, ...f }}>{pasoImputados}. Esta causa tiene varios imputados — ¿respecto de quién es el escrito?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {imputados.map(imp => {
                const marcado = impsSel.some(i => i.id === imp.id)
                return (
                  <button key={imp.id} onClick={() => toggleImputado(imp)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${marcado ? '#1E3A2F' : '#E2E8F0'}`, background: marcado ? '#1E3A2F' : '#fff', color: marcado ? '#fff' : '#64748b', cursor: 'pointer', ...f }}>
                    {marcado ? '✓ ' : ''}{imp.nombre || 'Sin nombre'}
                  </button>
                )
              })}
              <button onClick={() => setImpsSel(impsSel.length === imputados.length ? [] : imputados)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', cursor: 'pointer', ...f }}>
                {impsSel.length === imputados.length ? 'Ninguno' : 'Todos'}
              </button>
            </div>
          </div>
        )}

        {/* Paso 3: elegir escrito(s) — selección múltiple */}
        {causaSel && (imputados.length <= 1 || impsSel.length > 0) && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 12, ...f }}>{pasoEscritos}. Elige el o los escritos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {plantillas.map(p => {
                const posicion = capitulosSel.findIndex(c => c.id === p.id)
                const marcada = posicion !== -1
                return (
                  <div key={p.id} className="plantilla-card" onClick={() => toggleCapitulo(p)}
                    style={{ border: `1.5px solid ${marcada ? '#1E3A2F' : '#E2E8F0'}`, borderRadius: 12, padding: 16, background: marcada ? '#FAF7F0' : '#fff' }}>
                    {marcada && (
                      <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', background: '#1E3A2F', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', ...f }}>{posicion + 1}</div>
                    )}
                    <div style={{ fontSize: 20, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 4, ...f }}>{p.nombre}</div>
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

        {puedeGenerar && !escrito && (
          <div style={{ marginBottom: 20 }}>
            <button className="btn-primary" onClick={generarPreview}>Generar vista previa</button>
          </div>
        )}

        {/* Paso 4: editor / preview */}
        {escrito && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A2F', ...f }}>Revisa y edita antes de descargar</div>
              <span style={{ fontSize: 11, color: '#94a3b8', ...f }}>Así queda en el PDF: título a la izquierda, tribunal centrado, cuerpo justificado</span>
            </div>

            {/* ✅ NUEVO: "pre-suma" — Rol de Ingreso, Secretaría, Materia,
                Parte, Tabla, Vista de la causa — solo aparece en escritos a
                la Corte que la traen (ej. Anuncio para alegar), va ANTES
                del título, tal como en los modelos reales. */}
            {escrito.preSumaLineas?.length > 0 && (
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '14px 20px', marginBottom: 10 }}>
                {/* ✅ FIX: antes se editaba el texto crudo con "**rótulo:**"
                    — se veían los asteriscos literales. El rótulo va fijo
                    (no se edita, no tiene por qué cambiar) y solo el valor
                    es un campo editable, sin ninguna marca de por medio. */}
                {escrito.preSumaLineas.map((linea, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {linea.rotulo && <span style={{ fontSize: 12, fontWeight: 700, color: '#1E3A2F', flexShrink: 0, fontFamily: "'Times New Roman',serif" }}>{linea.rotulo}:</span>}
                    <input value={linea.valor} onChange={e => setEscrito(prev => ({ ...prev, preSumaLineas: prev.preSumaLineas.map((l, j) => j === i ? { ...l, valor: e.target.value } : l) }))}
                      style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, color: '#475569', padding: '2px 0', fontFamily: "'Times New Roman',serif" }} />
                  </div>
                ))}
              </div>
            )}

            {/* ✅ Título(s) y tribunal se muestran y editan aparte, ya con el
                estilo con el que van a salir en el PDF (negrita, izquierda /
                centrado) — antes iban dentro del mismo cuadro de texto con
                marcas "#"/"##" al inicio de la línea, y eso confundía. */}
            <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '16px 20px', marginBottom: 2 }}>
              {escrito.sumaLineas.map((linea, i) => (
                <input key={i} value={linea} onChange={e => setEscrito(prev => ({ ...prev, sumaLineas: prev.sumaLineas.map((l, j) => j === i ? e.target.value : l) }))}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: '#1E3A2F', marginBottom: 4, padding: '2px 0', fontFamily: "'Times New Roman',serif" }} />
              ))}
              <input value={escrito.destinatario} onChange={e => setEscrito(prev => ({ ...prev, destinatario: e.target.value }))}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: '#1E3A2F', textAlign: 'center', marginTop: 10, padding: '2px 0', fontFamily: "'Times New Roman',serif" }} />
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 12, ...f }}>Puedes editar el título y el tribunal directo ahí arriba.</div>

            <textarea value={escrito.cuerpo} onChange={e => setEscrito(prev => ({ ...prev, cuerpo: e.target.value }))}
              style={{ width: '100%', minHeight: 380, padding: 20, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, lineHeight: 1.7, color: '#1E3A2F', fontFamily: "'Times New Roman',serif", textAlign: 'justify', resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, ...f }}>**texto** = negrita en el PDF</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={handleDescargarYGuardar} disabled={generando}>{generando ? 'Generando...' : '📄 Descargar PDF'}</button>
              <button className="btn-secondary" onClick={handleCopiar}>📋 Copiar texto</button>
              <button className="btn-secondary" onClick={() => { setCapitulosSel([]); setEscrito(null); setResultado(null); setDelegadoSel(null); setDelegadoNuevo(false) }}>Empezar de nuevo</button>
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
