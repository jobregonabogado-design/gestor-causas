const CLIENT_ID = process.env.REACT_APP_GMAIL_CLIENT_ID
const REDIRECT_URI = window.location.origin + '/gmail-callback.html'
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

const SUPABASE_FUNCTION_URL = 'https://qttwthpgzzjzidimlkkh.supabase.co/functions/v1/gmail-token'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

export async function exchangeCodeForToken(code) {
  const res = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  if (data.access_token) {
    localStorage.setItem('gmail_access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('gmail_refresh_token', data.refresh_token)
    return true
  }
  return false
}

export async function refreshAccessToken() {
  const refresh_token = localStorage.getItem('gmail_refresh_token')
  if (!refresh_token) return false
  const res = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ refresh_token }),
  })
  const data = await res.json()
  if (data.access_token) {
    localStorage.setItem('gmail_access_token', data.access_token)
    return true
  }
  return false
}

export function loginGmail() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    prompt: 'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function getGmailToken() {
  return localStorage.getItem('gmail_access_token')
}

export function isGmailConnected() {
  return !!localStorage.getItem('gmail_access_token')
}

export function logoutGmail() {
  localStorage.removeItem('gmail_access_token')
  localStorage.removeItem('gmail_refresh_token')
  localStorage.removeItem('gmail_auth_code')
}

async function gmailFetch(path, options = {}) {
  const token = getGmailToken()
  if (!token) throw new Error('No token')
  const res = await fetch(`https://gmail.googleapis.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (res.status === 401) { logoutGmail(); throw new Error('Token expirado') }
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function fetchNotificacionesPJUD() {
  try {
    const query = 'from:(notificacion_judicial OR minpublico.cl OR fiscaliadechile.cl OR pjud.cl OR notificacion OR judicial) newer_than:60d'
    const data = await gmailFetch(`/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`)
    if (!data.messages) return []

    const mensajes = []
    for (const msg of data.messages.slice(0, 100)) {
      try {
        const detalle = await gmailFetch(`/gmail/v1/users/me/messages/${msg.id}?format=full`)
        const parsed = parsearCorreo(detalle)
        if (parsed) mensajes.push(parsed)
      } catch(e) {}
    }
    return mensajes
  } catch(e) {
    console.error('Error Gmail:', e)
    return []
  }
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function decodeBase64(str) {
  try {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  } catch { return '' }
}

function getBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data)
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data)
    }
    for (const part of payload.parts) {
      const body = getBody(part)
      if (body) return body
    }
  }
  return ''
}

function parsearCorreo(msg) {
  const headers = msg.payload?.headers || []
  const asunto = getHeader(headers, 'subject')
  const de = getHeader(headers, 'from')
  const cuerpo = getBody(msg.payload)

  let resultado = null

  // Tipo 1: PJUD — asunto con RUC y RIT
  const matchPJUD = asunto.match(/RUC[:\s]+([0-9]+-[0-9A-Za-z]+)[,\s]+RIT[:\s]+([0-9]+-[0-9]+)/i)
  if (matchPJUD) {
    resultado = {
      tipo: 'PJUD',
      ruc: matchPJUD[1].replace(/\s/g, ''),
      rit: matchPJUD[2],
      asunto,
      cuerpo: cuerpo.substring(0, 2000),
      fecha_correo: new Date(parseInt(msg.internalDate)).toISOString(),
      audiencia: extraerAudienciaPJUD(cuerpo, asunto),
    }
  }

  // Tipo 2: Fiscalía
  const matchFiscalia = asunto.match(/RUC[:\s]+([0-9]+-[0-9A-Za-z]+)/i)
  if (!resultado && matchFiscalia && (de.includes('minpublico') || de.includes('fiscalia') || de.includes('Fiscalia'))) {
    resultado = {
      tipo: 'FISCALIA',
      ruc: matchFiscalia[1].replace(/\s/g, ''),
      rit: '',
      asunto,
      cuerpo: cuerpo.substring(0, 2000),
      fecha_correo: new Date(parseInt(msg.internalDate)).toISOString(),
      audiencia: extraerAudienciaFiscalia(cuerpo, asunto),
    }
  }

  return resultado
}

// ─── PARSER PRINCIPAL PJUD ────────────────────────────────────────────────────
// Los correos del PJUD son actas o resoluciones que al final fijan una FECHA FUTURA.
// La estrategia es buscar primero en la sección de "fijación/reprogramación"
// que aparece al final del documento, y solo si no hay, buscar en el encabezado.

function extraerAudienciaPJUD(cuerpo, asunto) {
  const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}

  let fecha = null, hora = null, tipo = null, tribunal = null, sala = null

  // ═══════════════════════════════════════════════════════
  // PASO 1: Buscar fecha en sección de FIJACIÓN (al final)
  // Patrones de los PDFs reales del PJUD:
  // - "para el día 31 de julio de 2026"
  // - "Fecha  2026/07/31" (tabla al final)
  // - "fijada para el día 22 de junio de 2026, a las 09:30 hrs"
  // - "8 de octubre de 2026" (en tabla Reprogramación)
  // ═══════════════════════════════════════════════════════

  // Patrón 1a: "para el día DD de MES de YYYY" — año en dígitos
  const matchFijacion = cuerpo.match(/para\s+el\s+d[ií]a\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (matchFijacion) {
    const mes = meses[matchFijacion[2].toLowerCase()]
    if (mes) {
      const d = String(matchFijacion[1]).padStart(2,'0')
      const m = String(mes).padStart(2,'0')
      const posibleFecha = `${matchFijacion[3]}-${m}-${d}`
      if (esFechaFuturaOReciente(posibleFecha)) fecha = posibleFecha
    }
  }

  // Patrón 1b: "DD de MES de dos mil veintiséis" — año en palabras (formato actas PJUD)
  // Ejemplo exacto: "Fecha 25 de junio de dos mil veintiséis"
  // IMPORTANTE: usar [a-záéíóúüñ]+ en lugar de \w+ para capturar letras con tilde
  if (!fecha) {
    const regexAnioPalabras = /(\d{1,2})\s+de\s+([a-záéíóúüñ]+)\s+de\s+(dos|tres|cuatro)\s+mil\s+([a-záéíóúüñ]+(?:\s+[a-záéíóúüñ]+)?)/gi
    const matchesAP = [...cuerpo.matchAll(regexAnioPalabras)]
    for (const m of matchesAP) {
      const normalizar = s => s.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u').replace(/ñ/g,'n')
      const mes = meses[normalizar(m[2])]
      const anioTexto = `${m[3]} mil ${m[4]}`
      const anio = añoEnPalabrasANumero(anioTexto)
      if (mes && anio) {
        const d = String(m[1]).padStart(2,'0')
        const mm = String(mes).padStart(2,'0')
        const posible = `${anio}-${mm}-${d}`
        if (esFechaFuturaOReciente(posible)) { fecha = posible; break }
      }
    }
  }

  // Patrón 2a: "Fecha  2026/07/31" — tabla del PDF
  if (!fecha) {
    const matchTablaFecha = cuerpo.match(/Fecha\s+(\d{4})\/(\d{2})\/(\d{2})/i)
    if (matchTablaFecha) {
      fecha = `${matchTablaFecha[1]}-${matchTablaFecha[2]}-${matchTablaFecha[3]}`
    }
  }

  // Patrón 2b: "Fecha 25 de junio de dos mil veintiséis" — tabla acta PJUD con año en palabras
  // Captura específica para este formato de tabla
  if (!fecha) {
    const matchTablaAP = cuerpo.match(/Fecha\s+(\d{1,2})\s+de\s+([a-z\u00e0-\u00ff]+)\s+de\s+(dos|tres|cuatro)\s+mil\s+([a-z\u00e0-\u00ff]+(?:\s+[a-z\u00e0-\u00ff]+)?)/i)
    if (matchTablaAP) {
      const normalizar = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      const mesNorm = normalizar(matchTablaAP[2])
      const mesesNorm = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}
      const mes = mesesNorm[mesNorm]
      const anioTexto = normalizar(`${matchTablaAP[3]} mil ${matchTablaAP[4]}`)
      const mapAnio = {'dos mil veintiuno':2021,'dos mil veintidos':2022,'dos mil veintitres':2023,'dos mil veinticuatro':2024,'dos mil veinticinco':2025,'dos mil veintiseis':2026,'dos mil veintisiete':2027,'dos mil veintiocho':2028,'dos mil veintinueve':2029,'dos mil treinta':2030}
      const anio = mapAnio[anioTexto]
      if (mes && anio) {
        const d = String(matchTablaAP[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        const posible = `${anio}-${m}-${d}`
        if (esFechaFuturaOReciente(posible)) fecha = posible
      }
    }
  }

  // Patrón 3: "fijada para el DD de MES de YYYY"
  if (!fecha) {
    const matchFijada = cuerpo.match(/fijada?\s+para\s+el\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (matchFijada) {
      const mes = meses[matchFijada[2].toLowerCase()]
      if (mes) {
        const d = String(matchFijada[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        fecha = `${matchFijada[3]}-${m}-${d}`
      }
    }
  }

  // Patrón 4: tabla Reprogramación — "Fecha  8 de octubre de 2026"
  if (!fecha) {
    const matchReprog = cuerpo.match(/(?:Reprogramaci[oó]n|Fecha\s+de\s+Audiencia)[^\n]*\n[^\n]*?(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (matchReprog) {
      const mes = meses[matchReprog[2].toLowerCase()]
      if (mes) {
        const d = String(matchReprog[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        fecha = `${matchReprog[3]}-${m}-${d}`
      }
    }
  }

  // Patrón 5: cualquier fecha escrita futura en el cuerpo (fallback)
  if (!fecha) {
    const matches = [...cuerpo.matchAll(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi)]
    for (const m of matches) {
      const mes = meses[m[2].toLowerCase()]
      if (mes) {
        const d = String(m[1]).padStart(2,'0')
        const mm = String(mes).padStart(2,'0')
        const posible = `${m[3]}-${mm}-${d}`
        if (esFechaFuturaOReciente(posible)) { fecha = posible; break }
      }
    }
  }

  // Patrón 6: fecha numérica PDF YYYY/MM/DD (solo si es futura)
  if (!fecha) {
    const matchesPDF = [...cuerpo.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)]
    for (const m of matchesPDF) {
      const posible = `${m[1]}-${m[2]}-${m[3]}`
      if (esFechaFuturaOReciente(posible)) { fecha = posible; break }
    }
  }

  // ═══════════════════════════════════════════════════════
  // PASO 2: Hora — solo con contexto real de audiencia
  // Patrones: "a las 11:00 horas", "11:00AM", "Hora  11:00AM"
  // ═══════════════════════════════════════════════════════
  const matchHora =
    cuerpo.match(/(?:a\s+las|Hora[:\s]+|inicio[:\s]+)\s*(\d{1,2}:\d{2})\s*(?:AM|PM|horas?|hrs?)?/i) ||
    cuerpo.match(/(\d{1,2}:\d{2})\s*(?:AM|PM)\b/i) ||
    cuerpo.match(/(\d{1,2}:\d{2})\s*(?:horas?|hrs?)\b/i)
  if (matchHora) {
    hora = matchHora[1]
    // Normalizar AM/PM
    const ampm = matchHora[0].match(/(\d{1,2}:\d{2})\s*(AM|PM)/i)
    if (ampm) {
      let [h, min] = ampm[1].split(':').map(Number)
      if (ampm[2].toUpperCase() === 'PM' && h < 12) h += 12
      if (ampm[2].toUpperCase() === 'AM' && h === 12) h = 0
      hora = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
    }
  }

  // ═══════════════════════════════════════════════════════
  // PASO 3: Tipo de audiencia
  // Prioriza la sección "Tipo de Audiencia" de la tabla
  // ═══════════════════════════════════════════════════════
  const matchTipoTabla = cuerpo.match(/Tipo\s+de\s+Audiencia\s+([^\n]{5,80})/i)
  if (matchTipoTabla) {
    const t = matchTipoTabla[1].trim()
    if (t.match(/preparaci[oó]n.*juicio|APJO/i)) tipo = 'APJO'
    else if (t.match(/abreviado/i)) tipo = 'ABREVIADO'
    else if (t.match(/juicio oral/i)) tipo = 'JUICIO ORAL'
    else if (t.match(/formalizaci[oó]n/i)) tipo = 'FORMALIZACION'
  }

  if (!tipo) {
    if (cuerpo.match(/juicio oral/i)) tipo = 'JUICIO ORAL'
    else if (cuerpo.match(/preparaci[oó]n.*juicio|APJO/i)) tipo = 'APJO'
    else if (cuerpo.match(/abreviado/i)) tipo = 'ABREVIADO'
    else if (cuerpo.match(/formalizaci[oó]n/i)) tipo = 'FORMALIZACION'
    else if (cuerpo.match(/cautelar/i)) tipo = 'CAUTELA DE GARANTIAS'
    else if (cuerpo.match(/reprogramac/i)) tipo = 'REPROGRAMACION'
    else if (cuerpo.match(/coordinaci[oó]n/i)) tipo = 'COORDINACION JO'
    else if (cuerpo.match(/control.*detenci[oó]n/i)) tipo = 'CONTROL DETENCION'
    else if (cuerpo.match(/revisi[oó]n.*PP|rev.*pp/i)) tipo = 'REVISION PP'
    else if (cuerpo.match(/cierre/i)) tipo = 'CIERRE'
    else if (cuerpo.match(/apelaci[oó]n/i)) tipo = 'APELACION'
    else tipo = 'AUDIENCIA'
  }

  // ═══════════════════════════════════════════════════════
  // PASO 4: Tribunal — desde campo "Tribunal" de la tabla
  // Ejemplos reales: "7º Juzgado de Garantía de Santiago"
  //                  "Juzgado de Garantía de Melipilla"
  //                  "9° Juzgado de Garantía de Santiago"
  // ═══════════════════════════════════════════════════════
  const matchTribTabla = cuerpo.match(/Tribunal\s+((?:\d+[°º]?\s+)?(?:Juzgado|Tribunal)[^\n]{5,60})/i)
  if (matchTribTabla) {
    tribunal = matchTribTabla[1].trim().replace(/\s+/g, ' ')
  }

  if (!tribunal) {
    const matchTrib = cuerpo.match(/((?:\d+[°º]?\s+)?(?:Juzgado\s+de\s+Garantía|Juzgado\s+de\s+Garantia|Tribunal\s+de\s+Juicio\s+Oral)[^\n,]{3,50})/i)
    if (matchTrib) tribunal = matchTrib[1].trim().replace(/\s+/g, ' ').substring(0, 60)
  }

  // ═══════════════════════════════════════════════════════
  // PASO 5: Sala
  // ═══════════════════════════════════════════════════════
  const matchSala = cuerpo.match(/Sala\s+([A-Z0-9\s]{1,20}?)(?:\n|$)/i)
  if (matchSala) sala = matchSala[1].trim()

  return { fecha, hora, tipo, tribunal, sala }
}

// Convierte año en palabras a número: "dos mil veintiséis" → 2026
function añoEnPalabrasANumero(str) {
  // Normalizar: quitar tildes para comparación robusta
  const normalizar = s => s.toLowerCase().trim()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  const map = {
    'dos mil veintiuno':2021,'dos mil veintidos':2022,'dos mil veintitres':2023,
    'dos mil veinticuatro':2024,'dos mil veinticinco':2025,
    'dos mil veintiseis':2026,'dos mil veintisiete':2027,
    'dos mil veintiocho':2028,'dos mil veintinueve':2029,'dos mil treinta':2030,
  }
  return map[normalizar(str)] || null
}

// Verifica si una fecha es futura o de los últimos 7 días (audiencia reciente)
function esFechaFuturaOReciente(fechaISO) {
  try {
    const fecha = new Date(fechaISO + 'T12:00:00')
    const hoy = new Date()
    hoy.setHours(0,0,0,0)
    const hace7dias = new Date(hoy)
    hace7dias.setDate(hace7dias.getDate() - 7)
    return fecha >= hace7dias
  } catch { return false }
}

// ─── PARSER FISCALÍA ─────────────────────────────────────────────────────────
function extraerAudienciaFiscalia(cuerpo, asunto) {
  const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}

  let fecha = null, hora = null, tipo = 'ENTREVISTA'

  // Buscar todas las fechas escritas y tomar la más futura
  const matches = [...cuerpo.matchAll(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi)]
  for (const m of matches) {
    const mes = meses[m[2].toLowerCase()]
    if (mes) {
      const d = String(m[1]).padStart(2,'0')
      const mm = String(mes).padStart(2,'0')
      const posible = `${m[3]}-${mm}-${d}`
      if (esFechaFuturaOReciente(posible)) { fecha = posible; break }
    }
  }

  if (!fecha) {
    const matchFechaNum = cuerpo.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (matchFechaNum) fecha = `${matchFechaNum[3]}-${matchFechaNum[2]}-${matchFechaNum[1]}`
  }

  if (!fecha) {
    const matchPDF = cuerpo.match(/(\d{4})\/(\d{2})\/(\d{2})/)
    if (matchPDF) fecha = `${matchPDF[1]}-${matchPDF[2]}-${matchPDF[3]}`
  }

  const matchHora =
    cuerpo.match(/(?:a\s+las|hora[:\s]+|inicio[:\s]+)\s*(\d{1,2}:\d{2})/i) ||
    cuerpo.match(/(\d{1,2}:\d{2})\s*(?:horas?|hrs?)\b/i)
  if (matchHora) hora = matchHora[1]

  if (asunto.match(/entrevista/i)) tipo = 'ENTREVISTA'
  else if (asunto.match(/declarac/i)) tipo = 'DECLARACION'
  else if (asunto.match(/audiencia/i)) tipo = 'AUDIENCIA'

  return { fecha, hora, tipo, tribunal: 'FISCALÍA', sala: null }
}
