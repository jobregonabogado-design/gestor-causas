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
    // Buscar correos judiciales — ampliado para capturar todos los remitentes relevantes
    const query = 'from:(notificacion_judicial OR minpublico.cl OR fiscaliadechile.cl OR pjud.cl OR notificacion OR judicial) newer_than:60d'
    const data = await gmailFetch(`/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=200`)
    if (!data.messages) return []

    const mensajes = []
    // Procesar hasta 100 correos (antes era 20)
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

  // Tipo 1: PJUD — "Notificación en RUC: XXXX, RIT XXXX"
  const matchPJUD = asunto.match(/RUC[:\s]+([0-9]+-[0-9A-Za-z]+)[,\s]+RIT[:\s]+([0-9]+-[0-9]+)/i)
  if (matchPJUD) {
    resultado = {
      tipo: 'PJUD',
      ruc: matchPJUD[1].replace(/\s/g, ''),
      rit: matchPJUD[2],
      asunto,
      cuerpo: cuerpo.substring(0, 1000),
      fecha_correo: new Date(parseInt(msg.internalDate)).toISOString(),
      audiencia: extraerAudienciaPJUD(cuerpo, asunto),
    }
  }

  // Tipo 2: Fiscalía — "Entrevista causa RUC XXXX" o "RUC XXXX"
  const matchFiscalia = asunto.match(/RUC[:\s]+([0-9]+-[0-9A-Za-z]+)/i)
  if (!resultado && matchFiscalia && (de.includes('minpublico') || de.includes('fiscalia') || de.includes('Fiscalia'))) {
    resultado = {
      tipo: 'FISCALIA',
      ruc: matchFiscalia[1].replace(/\s/g, ''),
      rit: '',
      asunto,
      cuerpo: cuerpo.substring(0, 1000),
      fecha_correo: new Date(parseInt(msg.internalDate)).toISOString(),
      audiencia: extraerAudienciaFiscalia(cuerpo, asunto),
    }
  }

  return resultado
}

function extraerAudienciaPJUD(cuerpo, asunto) {
  const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}

  let fecha = null, hora = null, tipo = null, tribunal = null

  // Fecha escrita: "26 de mayo de 2026"
  const matchFechaEscrita = cuerpo.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (matchFechaEscrita) {
    const mes = meses[matchFechaEscrita[2].toLowerCase()]
    if (mes) {
      const d = String(matchFechaEscrita[1]).padStart(2,'0')
      const m = String(mes).padStart(2,'0')
      fecha = `${matchFechaEscrita[3]}-${m}-${d}`
    }
  }

  // Fecha numérica: "26/05/2026" o "26-05-2026"
  if (!fecha) {
    const matchFechaNum = cuerpo.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (matchFechaNum) {
      fecha = `${matchFechaNum[3]}-${matchFechaNum[2]}-${matchFechaNum[1]}`
    }
  }

  // Hora: "13:30" o "13:30 horas"
  const matchHora = cuerpo.match(/(\d{1,2}:\d{2})\s*(horas?|hrs?)?/i)
  if (matchHora) hora = matchHora[1]

  // Tipo audiencia
  if (cuerpo.match(/juicio oral/i)) tipo = 'JUICIO ORAL'
  else if (cuerpo.match(/preparaci[oó]n.*juicio|APJO/i)) tipo = 'APJO'
  else if (cuerpo.match(/abreviado/i)) tipo = 'ABREVIADO'
  else if (cuerpo.match(/formalizaci[oó]n/i)) tipo = 'FORMALIZACION'
  else if (cuerpo.match(/cautelar|garant[ií]a/i)) tipo = 'CAUTELA DE GARANTIAS'
  else if (cuerpo.match(/reprogramac/i)) tipo = 'REPROGRAMACION'
  else if (cuerpo.match(/coordinaci[oó]n/i)) tipo = 'COORDINACION JO'
  else if (cuerpo.match(/control.*detenci[oó]n/i)) tipo = 'CONTROL DETENCION'
  else if (cuerpo.match(/revisi[oó]n.*PP|rev.*pp/i)) tipo = 'REVISION PP'
  else tipo = 'AUDIENCIA'

  // Tribunal
  const matchTribunal = cuerpo.match(/((?:\d+[°º]?\s+)?(?:Juzgado|Tribunal|TOP|JG)[^,\n\.]{3,50})/i)
  if (matchTribunal) tribunal = matchTribunal[1].trim().substring(0, 60)

  return { fecha, hora, tipo, tribunal }
}

function extraerAudienciaFiscalia(cuerpo, asunto) {
  const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}

  let fecha = null, hora = null, tipo = 'ENTREVISTA'

  const matchFecha = cuerpo.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (matchFecha) {
    const mes = meses[matchFecha[2].toLowerCase()]
    if (mes) {
      const d = String(matchFecha[1]).padStart(2,'0')
      const m = String(mes).padStart(2,'0')
      fecha = `${matchFecha[3]}-${m}-${d}`
    }
  }

  if (!fecha) {
    const matchFechaNum = cuerpo.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (matchFechaNum) {
      fecha = `${matchFechaNum[3]}-${matchFechaNum[2]}-${matchFechaNum[1]}`
    }
  }

  const matchHora = cuerpo.match(/(\d{1,2}:\d{2})\s*(horas?|hrs?)?/i)
  if (matchHora) hora = matchHora[1]

  if (asunto.match(/entrevista/i)) tipo = 'ENTREVISTA'
  else if (asunto.match(/declarac/i)) tipo = 'DECLARACION'
  else if (asunto.match(/audiencia/i)) tipo = 'AUDIENCIA'

  return { fecha, hora, tipo, tribunal: 'FISCALÍA' }
}
