import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID
const REDIRECT_URI = window.location.origin + '/gmail-callback.html'
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

const SUPABASE_FUNCTION_URL = 'https://qttwthpgzzjzidimlkkh.supabase.co/functions/v1/gmail-token'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

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

// ✅ FIX: antes pedía response_type "token" (flujo implícito), que Google
// NUNCA acompaña con un refresh_token — solo entrega un access_token que
// vence en ~1 hora. Como no había refresh_token guardado, cada vez que se
// vencía había que iniciar sesión desde cero, mostrando otra vez la pantalla
// completa de "requiere acceso a tu cuenta". Con response_type "code" +
// access_type "offline" sí se obtiene un refresh_token (la función de
// Supabase que lo canjea ya estaba lista para esto, solo nunca se usaba).
export function loginGmail() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
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

// ✅ FIX: antes, al vencer el access_token (401), se cerraba la sesión de
// Gmail directamente — sin siquiera intentar usar el refresh_token para
// renovarlo solo, que es justo para lo que existe. Ahora primero intenta
// renovar en silencio; solo si eso también falla, recién ahí pide iniciar
// sesión de nuevo.
async function gmailFetch(path, options = {}) {
  let token = getGmailToken()
  if (!token) throw new Error('No token')
  const hacerFetch = (tok) => fetch(`https://gmail.googleapis.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${tok}`, ...options.headers },
  })
  let res = await hacerFetch(token)
  if (res.status === 401) {
    const renovado = await refreshAccessToken()
    if (renovado) {
      token = getGmailToken()
      res = await hacerFetch(token)
    }
    if (res.status === 401) { logoutGmail(); throw new Error('Token expirado') }
  }
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function fetchNotificacionesPJUD(rucsVigentes) {
  try {
    // ✅ FIX: antes solo buscaba por remitente exacto (pjud.cl, minpublico.cl, etc.)
    // y se perdía cualquier correo que llegara de otra dirección. Como más abajo
    // (en GmailIntegracion.jsx) ya se filtra por RUC de causas vigentes, acá basta
    // con buscar correos que mencionen RUC o RIT — más amplio, pero igual de seguro.
    // ✅ FIX: 60 días se quedaba corto para audiencias/actas más antiguas
    // (ej. una del 28 de mayo, revisada bastante después). Se amplía a 150 días.
    // ✅ NUEVO: se agrega "from:siau@minpublico.cl" explícito — es la
    // dirección desde donde llegan las respuestas a las solicitudes hechas
    // por el portal (confirmado por Joaquín), y así nunca se pierde un
    // correo de ahí aunque su texto no calce con ninguna de las palabras
    // clave de abajo.
    const query = 'newer_than:150d (RUC OR RIT OR "rol único" OR audiencia OR resolución OR resolucion OR notificación OR notificacion OR from:siau@minpublico.cl)'
    const data = await gmailFetch(`/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=150`)
    if (!data.messages) return []

    const mensajes = []
    for (const msg of data.messages.slice(0, 150)) {
      try {
        const detalle = await gmailFetch(`/gmail/v1/users/me/messages/${msg.id}?format=full`)
        const parsed = await parsearCorreo(detalle, rucsVigentes)
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

// ✅ NUEVO: convierte HTML a texto plano (quitando etiquetas) — se usa como
// respaldo cuando el correo no trae ninguna parte "text/plain" (ver getBody
// más abajo). Es simple a propósito: no necesita renderizar el HTML, solo
// dejar el texto legible para poder buscar RUC/folio/fechas con regex.
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function getBody(payload) {
  // ✅ FIX: antes, si el correo venía en HTML puro (sin ninguna parte
  // "text/plain" — típico en correos con diseño, como las respuestas de
  // mi.Fiscalía/SIAU con su banner celeste), esta función devolvía texto
  // vacío. Sin texto, parsearCorreo no encontraba el RUC y el correo se
  // descartaba ENTERO, silenciosamente — por eso una respuesta real de
  // Fiscalía nunca aparecía en "respuestas detectadas". Ahora, si no hay
  // ninguna parte de texto plano, se usa el HTML como respaldo quitándole
  // las etiquetas.
  if (payload.body?.data) {
    const crudo = decodeBase64(payload.body.data)
    return payload.mimeType === 'text/html' ? stripHtml(crudo) : crudo
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data)
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) return stripHtml(decodeBase64(part.body.data))
    }
    for (const part of payload.parts) {
      const body = getBody(part)
      if (body) return body
    }
  }
  return ''
}

// ✅ NUEVO: las resoluciones del PJUD casi siempre traen la fecha REAL de la
// audiencia (tabla "Reprogramación") dentro del PDF adjunto — el texto del
// correo en sí solo dice "se emitió una resolución", sin la fecha. Por eso
// antes nunca se detectaba: había que abrir el PDF, no solo leer el correo.

function encontrarAdjuntosPDF(payload, adjuntos = []) {
  if (payload.filename && payload.filename.toLowerCase().endsWith('.pdf') && payload.body?.attachmentId) {
    adjuntos.push({ filename: payload.filename, attachmentId: payload.body.attachmentId })
  }
  if (payload.parts) {
    for (const part of payload.parts) encontrarAdjuntosPDF(part, adjuntos)
  }
  return adjuntos
}

async function descargarAdjunto(messageId, attachmentId) {
  const data = await gmailFetch(`/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`)
  return data.data // base64url
}

async function extraerTextoPDF(base64urlData) {
  try {
    const binary = atob(base64urlData.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
    let texto = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const contenido = await page.getTextContent()
      texto += contenido.items.map(it => it.str).join(' ') + '\n'
    }
    return texto
  } catch (e) {
    console.error('No se pudo leer el PDF adjunto:', e)
    return ''
  }
}

async function parsearCorreo(msg, rucsVigentes) {
  const headers = msg.payload?.headers || []
  const asunto = getHeader(headers, 'subject')
  const de = getHeader(headers, 'from')
  const cuerpoEmail = getBody(msg.payload)

  // ✅ NUEVO: antes se descargaban y analizaban SIEMPRE los PDF adjuntos
  // (hasta 2 por correo, con pdf.js) de los 150 correos, ANTES de siquiera
  // revisar si el RUC del correo correspondía a una causa vigente — muchos
  // de esos 150 correos son de causas ya terminadas o de otras personas que
  // igual mencionan "RUC"/"audiencia", y ese trabajo se botaba igual más
  // abajo en GmailIntegracion.jsx. En el celular, procesar tantos PDF
  // seguidos (cada uno abre su propio motor de lectura en el navegador)
  // satura la memoria y el navegador termina recargando la pestaña solo,
  // sin mostrar ningún resultado. Ahora se busca el RUC primero SOLO en el
  // asunto + cuerpo del correo (sin abrir el PDF, que es rapidísimo) — casi
  // siempre alcanza, porque el tribunal/Fiscalía ya lo escribe ahí. Si ese
  // RUC no es de una causa vigente, se descarta de inmediato sin tocar el
  // PDF. Solo se abre el PDF si el RUC sí es vigente, o si no se encontró
  // ningún RUC en el texto (para no perder casos raros donde solo viene
  // dentro del PDF).
  const normalizarRucRapido = (r) => (r || '').replace(/[\s-]/g, '').toLowerCase()
  const textoRapido = `${asunto}\n${cuerpoEmail.substring(0, 6000)}`
  const matchRucRapido = textoRapido.match(/RUC[°:\s]*N?[°:\s]*([0-9]{6,10}[\s-][0-9Kk])/i)
  if (matchRucRapido && rucsVigentes && rucsVigentes.size > 0) {
    const rucRapidoNorm = normalizarRucRapido(matchRucRapido[1])
    if (!rucsVigentes.has(rucRapidoNorm)) return null // no es de una causa vigente — no hace falta abrir el PDF
  }

  // Leer el/los PDF adjuntos (máximo 2 por correo, para no demorar demasiado)
  // y sumar su texto al del correo antes de buscar RUC/RIT/fecha/tribunal/sala.
  let textoPdf = ''
  const adjuntosPDF = encontrarAdjuntosPDF(msg.payload)
  for (const adj of adjuntosPDF.slice(0, 2)) {
    const base64 = await descargarAdjunto(msg.id, adj.attachmentId)
    textoPdf += '\n' + await extraerTextoPDF(base64)
  }
  const cuerpo = `${cuerpoEmail}\n${textoPdf}`

  // ✅ FIX: antes el RUC/RIT solo se buscaba en el asunto con un formato exacto
  // ("RUC: XXXXXX-X, RIT: XXXX-XXXX"). Si el tribunal escribía el asunto distinto
  // (otro orden, "RUC N°", sin coma, etc.) el correo se perdía por completo, sin
  // ningún aviso. Ahora se busca en asunto + cuerpo + PDF, con formato flexible.
  const textoCompleto = `${asunto}\n${cuerpo.substring(0, 6000)}`

  const matchRuc = textoCompleto.match(/RUC[°:\s]*N?[°:\s]*([0-9]{6,10}[\s-][0-9Kk])/i)
  const matchRit = textoCompleto.match(/RIT[°:\s]*N?[°:\s]*([0-9]{1,6}[\s-][0-9]{4})/i)

  if (!matchRuc) return null // sin RUC detectable en ningún lado, no hay con qué vincular la causa

  let ruc = matchRuc[1].trim()
  if (!ruc.includes('-')) ruc = ruc.replace(/\s+/, '-') // "12345678 9" → "12345678-9"
  ruc = ruc.replace(/\s/g, '')
  const rit = matchRit ? matchRit[1].trim().replace(/\s+/, '-').replace(/\s/g, '') : ''
  const esFiscalia = /minpublico|fiscalia/i.test(de)

  // Se intenta primero con el parser PJUD (más completo); si no encuentra fecha
  // y el correo parece ser de Fiscalía, se prueba también con ese parser.
  let audiencia = extraerAudienciaPJUD(cuerpo, asunto)
  if (!audiencia?.fecha && esFiscalia) {
    audiencia = extraerAudienciaFiscalia(cuerpo, asunto)
  }

  // ✅ NUEVO: además de detectar una CITACIÓN nueva (arriba), se intenta
  // detectar si este correo es la RESPUESTA de Fiscalía a una solicitud ya
  // ingresada (folio de seguimiento) — para poder avisar/completar la
  // diligencia "Pendiente de respuesta" correspondiente en GmailIntegracion.jsx.
  // ✅ Se restringe específicamente a "siau@minpublico.cl" (el sistema
  // automático de solicitudes/SIAU, visto en el sello del comprobante de
  // ingreso) — Joaquín confirmó que las respuestas llegan de ahí. Usar
  // cualquier correo "@minpublico.cl" en general (como esFiscalia, usado
  // arriba solo para audiencias/citaciones) traería también correos de
  // funcionarios/fiscales a título personal que no son respuestas formales
  // de una solicitud, generando falsos positivos.
  const esSiau = /siau@minpublico/i.test(de)
  const respuestaFiscalia = esSiau ? extraerRespuestaFiscalia(cuerpo, asunto) : null

  return {
    id: msg.id, // ✅ id del mensaje de Gmail — se usa para poder "recordar"
    // que este correo puntual ya fue revisado y descartado, y no volver a
    // mostrarlo en futuras revisiones aunque el correo siga llegando en la
    // búsqueda (ver gmail_correos_descartados en GmailIntegracion.jsx).
    tipo: esFiscalia ? 'FISCALIA' : 'PJUD',
    ruc,
    rit,
    asunto,
    cuerpo: cuerpo.substring(0, 2000),
    fecha_correo: new Date(parseInt(msg.internalDate)).toISOString(),
    audiencia,
    respuestaFiscalia,
  }
}

// ─── PARSER: RESPUESTA de una solicitud ya ingresada a Fiscalía ─────────────
// A diferencia de extraerAudienciaFiscalia (que detecta una CITACIÓN nueva a
// entrevista/declaración), esto detecta cuando Fiscalía CONTESTA una
// solicitud que Joaquín ya ingresó por el portal — usa el mismo folio de
// seguimiento del "Comprobante Ingreso Solicitud" para poder vincularla con
// la diligencia "Pendiente de respuesta" correspondiente en la app.
// Nunca se aplica sola — siempre se muestra para que Joaquín la revise y
// confirme antes de guardar (misma lógica de "sugerir, no decidir sola" que
// el resto de las lecturas automáticas de correo).
function extraerRespuestaFiscalia(cuerpo, asunto) {
  const textoCompleto = `${asunto}\n${cuerpo}`

  // Folio: se busca primero explícito ("Folio N° XXXXX" / "folio: XXXXX");
  // si no aparece etiquetado, se toma el número más largo del texto (mismo
  // criterio ya probado en parsearComprobanteFiscalia de diligencias.jsx).
  let folio = ''
  const matchFolioEtiquetado = textoCompleto.match(/folio\s*(?:n[°º]?\s*)?:?\s*(\d{6,20})/i)
  if (matchFolioEtiquetado) {
    folio = matchFolioEtiquetado[1]
  } else {
    const numeros = (textoCompleto.match(/\b\d{8,20}\b/g) || []).sort((a, b) => b.length - a.length)
    folio = numeros[0] || ''
  }
  if (!folio) return null // sin folio no hay con qué vincular la respuesta a una diligencia

  // ¿Realmente suena a una respuesta/resolución de una solicitud? (no
  // cualquier correo de Fiscalía que mencione un número largo por otra razón).
  const pareceRespuesta = /solicitud|petici[oó]n|se\s+(?:informa|resuelve|responde|acoge|rechaza|deniega)|respuesta|resoluci[oó]n/i.test(textoCompleto)
  if (!pareceRespuesta) return null

  // Estado: rechazada tiene prioridad si aparece esa palabra explícita.
  let estado = 'aprobada'
  if (/rechaza|deniega|no\s+ha\s+lugar|improcedente|no\s+se\s+acoge/i.test(textoCompleto)) {
    estado = 'rechazada'
  }

  // Fecha de citación (solo si no fue rechazada)
  // ✅ FIX: el correo real de "Comunicacion Respuesta" de siau@minpublico.cl
  // escribe la fecha de la cita como "MIERCOLES 5 AGOSTO DE 2026" (SIN la
  // palabra "de" entre el día y el mes) y también como "05.08.2026" (con
  // puntos) — ninguno de los dos formatos calzaba con los patrones viejos
  // (que exigían "5 DE agosto de 2026" o fecha con barra/guión), así que
  // fechaCitacion quedaba vacía. Peor aún: el mismo correo TAMBIÉN trae la
  // fecha en que se ingresó la solicitud original (ej. "ingresada con fecha
  // 22/07/2026", con barra) — que si el patrón numérico viejo llegaba a
  // usarse como respaldo, la tomaba a ella por error en vez de la fecha
  // real de la cita. Ahora se busca primero SOLO en el bloque de texto
  // cerca de palabras que indican agendamiento real ("agendamiento",
  // "aprueba", "entrevista", "cita"/"citación"), y con el "de" opcional
  // entre día y mes; solo si ahí no se encuentra nada se usa una búsqueda
  // genérica de respaldo en todo el texto.
  let fechaCitacion = null
  if (estado !== 'rechazada') {
    const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}
    const buscarFechaProsa = (texto) => {
      const matches = [...texto.matchAll(/(\d{1,2})\s+(?:de\s+)?(\w+)\s+de\s+(\d{4})/gi)]
      for (const m of matches) {
        const mes = meses[m[2].toLowerCase()]
        if (mes) {
          const d = String(m[1]).padStart(2, '0')
          const mm = String(mes).padStart(2, '0')
          const posible = `${m[3]}-${mm}-${d}`
          if (esFechaFuturaOReciente(posible)) return posible
        }
      }
      return null
    }
    const buscarFechaNumerica = (texto) => {
      const m = texto.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/)
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null
    }
    const idxAgendamiento = textoCompleto.search(/agendamiento|aprueba|entrevista|se\s+cita|citaci[oó]n/i)
    const bloqueCita = idxAgendamiento >= 0 ? textoCompleto.substring(idxAgendamiento, idxAgendamiento + 400) : ''
    fechaCitacion = (bloqueCita && (buscarFechaProsa(bloqueCita) || buscarFechaNumerica(bloqueCita)))
      || buscarFechaProsa(textoCompleto)
      || buscarFechaNumerica(textoCompleto)
    if (fechaCitacion) estado = 'con_citacion'
  }

  // Motivo/detalle (útil sobre todo si fue rechazada)
  let detalle = ''
  const matchMotivo = textoCompleto.match(/motivo[:\s]+([^\n.]{5,200})/i)
  if (matchMotivo) detalle = matchMotivo[1].trim()

  return { folio, estado, fechaCitacion, detalle }
}

// ─── PARSER PRINCIPAL PJUD ────────────────────────────────────────────────────
// Los correos del PJUD son actas o resoluciones que al final fijan una FECHA FUTURA.
// La estrategia es buscar primero en la sección de "fijación/reprogramación"
// que aparece al final del documento, y solo si no hay, buscar en el encabezado.

function extraerAudienciaPJUD(cuerpo, asunto) {
  const meses = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12}

  let fecha = null, hora = null, tipo = null, tribunal = null, sala = null
  let posFecha = -1 // posición en el texto donde se encontró la fecha — para buscar hora/sala CERCA de ahí

  // ✅ NUEVO: un correo que solo notifica un PLAZO para responder/formular
  // observaciones/contestar (ej. "se confiere traslado por el plazo de 5
  // días, esto es, hasta el 18 de julio de 2026") NO es una audiencia — es
  // un plazo procesal. Se comprueba ANTES de buscar cualquier fecha, y
  // bloquea TODOS los patrones (no solo los de respaldo/débiles): se vio en
  // la práctica que frases como "...plazo... para el día 18 de julio de
  // 2026..." también calzaban con el patrón "fuerte" que busca "para el
  // día X" pensado para audiencias fijadas de verdad, así que solo bloquear
  // los patrones débiles no bastaba. Mejor que Joaquín revise el correo a
  // mano que agendar una audiencia falsa con la fecha del vencimiento.
  const esNotificacionDePlazo = /plazo\s+de\s+\d+\s+d[ií]as?[^.]{0,100}(responder|contestar|evacuar|traslado|observaci[oó]n|formular)/i.test(cuerpo)
    || /se\s+confiere\s+traslado/i.test(cuerpo)
    || /t[eé]ngase\s+por\s+notificad[oa][^.]{0,60}plazo/i.test(cuerpo)

  // ═══════════════════════════════════════════════════════
  // PASO 1: Buscar fecha en sección de FIJACIÓN (al final)
  // Patrones de los PDFs reales del PJUD:
  // - "para el día 31 de julio de 2026"
  // - "Fecha  2026/07/31" (tabla al final)
  // - "fijada para el día 22 de junio de 2026, a las 09:30 hrs"
  // - "8 de octubre de 2026" (en tabla Reprogramación)
  // ═══════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════
  // PASO 0 (máxima prioridad): la palabra "definitiva" marca cuál es la
  // fecha que realmente vale, cuando el documento menciona dos fechas en
  // el mismo párrafo (la vieja que se reprograma, y la nueva y definitiva).
  // Ejemplo real: "se procede a reprogramar la audiencia fijada para el
  // día 21 de julio de 2026... quedando en definitiva para el día 10 de
  // julio de 2026, a las 09:00 horas..." → debe tomar el 10 de julio, no el 21.
  // ═══════════════════════════════════════════════════════
  const matchDefinitiva = !esNotificacionDePlazo && cuerpo.match(/definitiv[oa]?\s*(?:mente)?[^.]{0,60}?para\s+el\s+d[ií]a\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (matchDefinitiva) {
    const mes = meses[matchDefinitiva[2].toLowerCase()]
    if (mes) {
      const d = String(matchDefinitiva[1]).padStart(2,'0')
      const m = String(mes).padStart(2,'0')
      const posible = `${matchDefinitiva[3]}-${m}-${d}`
      if (esFechaFuturaOReciente(posible)) { fecha = posible; posFecha = matchDefinitiva.index }
    }
  }

  // Patrón 1a: "para el día DD de MES de YYYY" — año en dígitos
  if (!fecha && !esNotificacionDePlazo) {
    const matchFijacion = cuerpo.match(/para\s+el\s+d[ií]a\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (matchFijacion) {
      const mes = meses[matchFijacion[2].toLowerCase()]
      if (mes) {
        const d = String(matchFijacion[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        const posibleFecha = `${matchFijacion[3]}-${m}-${d}`
        if (esFechaFuturaOReciente(posibleFecha)) { fecha = posibleFecha; posFecha = matchFijacion.index }
      }
    }
  }

  // Patrón 1b: "DD de MES de dos mil veintiséis" — año en palabras (formato actas PJUD)
  // Ejemplo exacto: "Fecha 25 de junio de dos mil veintiséis"
  // IMPORTANTE: usar [a-záéíóúüñ]+ en lugar de \w+ para capturar letras con tilde
  if (!fecha && !esNotificacionDePlazo) {
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
        if (esFechaFuturaOReciente(posible)) { fecha = posible; posFecha = m.index; break }
      }
    }
  }

  // Patrón 2a: "Fecha  2026/07/31" — tabla del PDF
  if (!fecha && !esNotificacionDePlazo) {
    const matchTablaFecha = cuerpo.match(/Fecha\s+(\d{4})\/(\d{2})\/(\d{2})/i)
    if (matchTablaFecha) {
      fecha = `${matchTablaFecha[1]}-${matchTablaFecha[2]}-${matchTablaFecha[3]}`
      posFecha = matchTablaFecha.index
    }
  }

  // Patrón 2b: "Fecha 25 de junio de dos mil veintiséis" — tabla acta PJUD con año en palabras
  // Captura específica para este formato de tabla
  if (!fecha && !esNotificacionDePlazo) {
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
        if (esFechaFuturaOReciente(posible)) { fecha = posible; posFecha = matchTablaAP.index }
      }
    }
  }

  // Patrón 3: "fijada para el DD de MES de YYYY"
  if (!fecha && !esNotificacionDePlazo) {
    const matchFijada = cuerpo.match(/fijada?\s+para\s+el\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (matchFijada) {
      const mes = meses[matchFijada[2].toLowerCase()]
      if (mes) {
        const d = String(matchFijada[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        fecha = `${matchFijada[3]}-${m}-${d}`
        posFecha = matchFijada.index
      }
    }
  }

  // Patrón 4: tabla Reprogramación — "Fecha  8 de octubre de 2026"
  if (!fecha && !esNotificacionDePlazo) {
    const matchReprog = cuerpo.match(/(?:Reprogramaci[oó]n|Fecha\s+de\s+Audiencia)[^\n]*\n[^\n]*?(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    if (matchReprog) {
      const mes = meses[matchReprog[2].toLowerCase()]
      if (mes) {
        const d = String(matchReprog[1]).padStart(2,'0')
        const m = String(mes).padStart(2,'0')
        fecha = `${matchReprog[3]}-${m}-${d}`
        posFecha = matchReprog.index
      }
    }
  }

  const fechaEsFuerte = fecha !== null // patrones 1-4: viene de una sección específica (fijación/tabla/reprogramación)

  // Patrón 5: cualquier fecha escrita futura en el cuerpo (fallback — menos confiable)
  if (!fecha && !esNotificacionDePlazo) {
    const matches = [...cuerpo.matchAll(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi)]
    for (const m of matches) {
      const mes = meses[m[2].toLowerCase()]
      if (mes) {
        const d = String(m[1]).padStart(2,'0')
        const mm = String(mes).padStart(2,'0')
        const posible = `${m[3]}-${mm}-${d}`
        if (esFechaFuturaOReciente(posible)) { fecha = posible; posFecha = m.index; break }
      }
    }
  }

  // Patrón 6: fecha numérica PDF YYYY/MM/DD (solo si es futura — fallback menos confiable)
  if (!fecha && !esNotificacionDePlazo) {
    const matchesPDF = [...cuerpo.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)]
    for (const m of matchesPDF) {
      const posible = `${m[1]}-${m[2]}-${m[3]}`
      if (esFechaFuturaOReciente(posible)) { fecha = posible; posFecha = m.index; break }
    }
  }

  // ✅ NUEVO: si el correo dice que se deja SIN EFECTO una audiencia y no hay
  // ninguna reprogramación / nueva fecha mencionada en el mismo documento,
  // no hay que agregar nada — la fecha detectada sería la de la audiencia
  // anulada, no una nueva. Se descarta para que quede para revisión manual.
  const hayCancelacion = /dejar[aá]?\s+sin\s+efecto|deja\s+sin\s+efecto|queda\s+sin\s+efecto|se\s+suspende\s+la\s+audiencia|se\s+revoca\s+la\s+audiencia/i.test(cuerpo)
  // ✅ Se agregan "corregir"/"corrección"/"error en la transcripción" — antes
  // solo reconocía "reprogramación"/"nueva fecha"/"definitiva", así que un
  // correo como "se cometió un error en la transcripción de la fecha... se
  // procede a corregir lo obrado" no quedaba marcado como corrección de una
  // audiencia ya agendada, y la anterior (con la fecha vieja) nunca se
  // detectaba como algo que revisar.
  const hayReprogramacion = /reprogramaci[oó]n|reprograma[r]?|nueva\s+fecha|se\s+fija\s+nueva|definitiv[oa]|correcci[oó]n|corregi[r]?|error\s+en\s+la\s+transcripci[oó]n/i.test(cuerpo)
  if (hayCancelacion && !hayReprogramacion) {
    fecha = null
  }

  // ✅ NUEVO: señal FUERTE de corrección — el documento dice explícitamente
  // que corrige un error, o deja algo sin efecto (no solo palabras más
  // débiles/ambiguas como "definitiva" o "nueva fecha" sueltas, que también
  // pueden aparecer en una audiencia genuinamente distinta). Con esta señal
  // Y solo cuando hay UNA única audiencia anterior de la misma causa/tipo
  // (se revisa en GmailIntegracion.jsx), se aplica el cambio automático y
  // solo se avisa — sin pedir que elijas. Si la señal es más débil, o hay
  // más de una posible anterior, se sigue preguntando como antes.
  const esCorreccionFuerte = /correcci[oó]n|corregi[r]?|error\s+en\s+la\s+transcripci[oó]n|dejar[aá]?\s+sin\s+efecto|deja\s+sin\s+efecto|queda\s+sin\s+efecto/i.test(cuerpo)

  // ═══════════════════════════════════════════════════════
  // PASO 2: Hora — se busca PRIMERO cerca de donde se encontró la fecha nueva
  // (para no confundirla con la "Hora inicio"/"Hora término" de la audiencia
  // ANTERIOR, que suele aparecer más arriba en el mismo documento).
  // Patrones: "a las 11:00 horas", "11:00AM", "Hora  11:00AM", "12:00 Horas"
  // (este último con el número ANTES de la palabra, como en las actas en prosa)
  // ═══════════════════════════════════════════════════════
  // ✅ FIX: antes solo se miraba el texto DESPUÉS de la fecha encontrada. Pero en
  // los documentos redactados en prosa (no en tabla), la descripción del tipo de
  // audiencia suele venir ANTES de la fecha: "habilítese la audiencia de
  // preparación juicio oral... para el día 5 de agosto de 2026" — el tipo se
  // perdía porque estaba "más atrás" del punto donde se encontró la fecha.
  // Ahora se mira un poco antes y bastante después.
  const bloqueCercaFecha = posFecha >= 0 ? cuerpo.substring(Math.max(0, posFecha - 300), posFecha + 600) : ''
  const matchHora =
    (bloqueCercaFecha && bloqueCercaFecha.match(/Hora\s*(\d{1,2}:\d{2})\s*(?:AM|PM|horas?|hrs?)?/i)) ||
    (bloqueCercaFecha && bloqueCercaFecha.match(/(\d{1,2}:\d{2})\s*[Hh]oras?\b/)) ||
    (bloqueCercaFecha && bloqueCercaFecha.match(/a\s+las\s*(\d{1,2}:\d{2})\s*(?:AM|PM|horas?|hrs?)?/i)) ||
    cuerpo.match(/(?:a\s+las|Hora[:\s]+)\s*(\d{1,2}:\d{2})\s*(?:AM|PM|horas?|hrs?)?/i) ||
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
  const matchTipoTabla = cuerpo.match(/Tipo\s+(?:de\s+)?Audiencia\s+([^\n]{5,80})/i)
  if (matchTipoTabla) {
    const t = matchTipoTabla[1].trim()
    if (t.match(/preparaci[oó]n.*juicio|prep\.?\s*juicio|\bAPJO\b/i)) tipo = 'APJO'
    else if (t.match(/abreviado/i)) tipo = 'ABREVIADO'
    else if (t.match(/juicio oral/i)) tipo = 'JUICIO ORAL'
    else if (t.match(/formalizaci[oó]n/i)) tipo = 'FORMALIZACION'
  }

  if (!tipo) {
    // ✅ FIX: "juicio oral" es una frase muy genérica que también aparece en el
    // NOMBRE del tribunal (ej. "Tribunal de Juicio Oral en lo Penal"), así que
    // buscarla primero hacía clasificar como JUICIO ORAL audiencias que en
    // realidad eran APJO u otra cosa. Se revisan primero los tipos más
    // específicos, y "juicio oral" se deja como penúltima opción.
    // Además se busca primero cerca de la fecha encontrada (mismo criterio que
    // hora/sala), para no confundirse con menciones de otras secciones.
    const texto = bloqueCercaFecha || cuerpo
    if (texto.match(/preparaci[oó]n.*juicio|prep\.?\s*juicio|\bAPJO\b/i)) tipo = 'APJO'
    else if (texto.match(/abreviado/i)) tipo = 'ABREVIADO'
    else if (texto.match(/formalizaci[oó]n/i)) tipo = 'FORMALIZACION'
    else if (texto.match(/cautelar/i)) tipo = 'CAUTELA DE GARANTIAS'
    else if (texto.match(/reprogramac/i)) tipo = 'REPROGRAMACION'
    else if (texto.match(/coordinaci[oó]n/i)) tipo = 'COORDINACION JO'
    else if (texto.match(/control.*detenci[oó]n/i)) tipo = 'CONTROL DETENCION'
    else if (texto.match(/revisi[oó]n.*PP|rev.*pp/i)) tipo = 'REVISION PP'
    else if (texto.match(/cierre/i)) tipo = 'CIERRE'
    else if (texto.match(/apelaci[oó]n/i)) tipo = 'APELACION'
    else if (texto.match(/juicio oral/i)) tipo = 'JUICIO ORAL'
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
  // PASO 5: Sala — igual que la hora, se busca primero cerca de la fecha
  // nueva para no tomar la sala de la audiencia ANTERIOR (que aparece más
  // arriba en el mismo documento con su propio campo "Sala").
  // ═══════════════════════════════════════════════════════
  const matchSalaCerca = bloqueCercaFecha && bloqueCercaFecha.match(/Sala\s+([A-Z0-9\s,]{1,30}?)(?:\n|$)/i)
  const matchSala = matchSalaCerca || cuerpo.match(/Sala\s+([A-Z0-9\s,]{1,30}?)(?:\n|$)/i)
  if (matchSala) sala = matchSala[1].trim()

  // ✅ NUEVO: se marca si el correo suena a corrección/reprogramación de una
  // audiencia YA agendada (aunque la fecha nueva sea distinta a cualquier
  // audiencia existente para esa causa) — GmailIntegracion.jsx lo usa para
  // buscar la audiencia anterior de esa misma causa y avisar que puede haber
  // quedado desactualizada, en vez de dejarla ahí sin decir nada.
  return { fecha, hora, tipo, tribunal, sala, esReprogramacion: hayReprogramacion, esCorreccionFuerte }
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

  // ✅ FIX: antes se tomaba CUALQUIER fecha futura mencionada en el documento,
  // aunque el correo no citara a nada (ej. un plazo, una fecha de otro trámite).
  // Ahora solo se agenda algo si el texto realmente menciona una cita, entrevista,
  // audiencia o comparecencia — si no, se descarta (queda para revisión manual).
  const textoCompleto = `${asunto}\n${cuerpo}`
  const hayCitacionReal = /cita(?:ci[oó]n|r)?|entrevista|declarac|audiencia|comparec/i.test(textoCompleto)
  if (!hayCitacionReal) return { fecha: null, hora: null, tipo: null, tribunal: 'FISCALÍA', sala: null }

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
    cuerpo.match(/(?:a\s+las|hora[:\s]+)\s*(\d{1,2}:\d{2})/i) ||
    cuerpo.match(/(\d{1,2}:\d{2})\s*(?:horas?|hrs?)\b/i)
  if (matchHora) hora = matchHora[1]

  if (asunto.match(/entrevista/i)) tipo = 'ENTREVISTA'
  else if (asunto.match(/declarac/i)) tipo = 'DECLARACION'
  else if (asunto.match(/audiencia/i)) tipo = 'AUDIENCIA'

  return { fecha, hora, tipo, tribunal: 'FISCALÍA', sala: null }
}
