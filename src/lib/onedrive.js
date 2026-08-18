const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID
// ✅ FIX: antes esto creaba la carpeta directo en la raíz de OneDrive
// ("/CAUSAS JOA/{ruc}"), pero la organización real de Joaquín la espera
// dentro de "JOAQUIN OBREGON/CAUSAS JOA/{ruc}" (así aparece en la miga de
// pan de OneDrive: Mis archivos › JOAQUIN OBREGON › CAUSAS JOA). "Documents"
// NO es una carpeta real navegable vía la API — es solo parte del enlace
// visual de OneDrive, así que no va en esta ruta.
const FOLDER_NAME = 'JOAQUIN OBREGON/' + (import.meta.env.VITE_ONEDRIVE_FOLDER || 'CAUSAS JOA')

// ✅ FIX: antes esto pedía response_type "token" (flujo implícito), que
// Microsoft NUNCA acompaña con un refresh_token — solo entrega un
// access_token que vence en ~1 hora, sin forma de renovarse solo. Había que
// reconectar OneDrive constantemente. Con "code" + PKCE + "offline_access"
// sí se obtiene un refresh_token — mismo espíritu que el arreglo que ya se
// hizo para Gmail, pero acá no hace falta ninguna función en el servidor:
// el registro de la app en Azure quedó como "Aplicación de página única"
// (SPA), que Microsoft deja canjear el código directo desde el navegador,
// sin necesitar un client_secret.
const SCOPES = ['Files.ReadWrite', 'User.Read', 'offline_access']
const REDIRECT_URI = window.location.origin + '/ms-callback-v2.html'
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

function base64UrlEncode(buffer) {
  let binario = ''
  for (const b of new Uint8Array(buffer)) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generarPKCE() {
  const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return { codeVerifier, codeChallenge: base64UrlEncode(digest) }
}

export async function loginOneDrive() {
  const { codeVerifier, codeChallenge } = await generarPKCE()
  // El code_verifier solo hace falta durante el minuto que dura la ida y
  // vuelta a Microsoft — sessionStorage alcanza y sobra para esto (a
  // diferencia del token en sí, que si necesita sobrevivir mucho más).
  sessionStorage.setItem('ms_code_verifier', codeVerifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  })
  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

export async function refreshMSToken() {
  const refresh_token = localStorage.getItem('ms_refresh_token')
  if (!refresh_token) return false
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token, scope: SCOPES.join(' ') }),
  })
  if (!res.ok) return false
  const data = await res.json()
  if (data.access_token) {
    localStorage.setItem('ms_token', data.access_token)
    // Microsoft normalmente entrega un refresh_token nuevo cada vez — se
    // reemplaza el guardado por el nuevo si viene, para que la renovación
    // siga funcionando la próxima vez también.
    if (data.refresh_token) localStorage.setItem('ms_refresh_token', data.refresh_token)
    return true
  }
  return false
}

// ✅ FIX: el token vivía en sessionStorage, que se borra solo al cerrar la
// pestaña/el navegador — así que había que reconectar OneDrive cada vez que
// se volvía a abrir la app, no solo cuando el token realmente vencía (~1
// hora). localStorage sí sobrevive cerrar y volver a abrir.
export function getMSToken() {
  return localStorage.getItem('ms_token')
}

export function logoutOneDrive() {
  localStorage.removeItem('ms_token')
  localStorage.removeItem('ms_refresh_token')
}

// ✅ FIX: al vencer el access_token (401), antes se fallaba directo — ahora
// primero intenta renovar en silencio con el refresh_token (ver arriba) y
// reintenta la misma llamada; solo si eso también falla, recién ahí se pide
// reconectar. Mismo criterio que ya usa gmailFetch en lib/gmail.js.
async function msFetch(url, options = {}) {
  let token = getMSToken()
  if (!token) throw new Error('No hay sesión de OneDrive activa — conéctate primero')
  const hacerFetch = (tok) => fetch(url, { ...options, headers: { Authorization: `Bearer ${tok}`, ...options.headers } })
  let res = await hacerFetch(token)
  if (res.status === 401) {
    const renovado = await refreshMSToken()
    if (renovado) { token = getMSToken(); res = await hacerFetch(token) }
    if (res.status === 401) { logoutOneDrive(); throw new Error('La sesión de OneDrive venció — reconecta') }
  }
  return res
}

async function graphFetch(path, options = {}) {
  const res = await msFetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Error ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function getOrCreateRucFolder(ruc) {
  try {
    const data = await graphFetch(`/me/drive/root:/${FOLDER_NAME}/${ruc}`)
    return data
  } catch {
    const data = await graphFetch(`/me/drive/root:/${FOLDER_NAME}:/children`, {
      method: 'POST',
      body: JSON.stringify({ name: ruc, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    })
    return data
  }
}

export async function getFolderFiles(ruc) {
  try {
    const data = await graphFetch(`/me/drive/root:/${FOLDER_NAME}/${ruc}:/children?$orderby=name`)
    return data.value || []
  } catch {
    return []
  }
}

export async function getFileDownloadUrl(fileId) {
  const data = await graphFetch(`/me/drive/items/${fileId}`)
  return data['@microsoft.graph.downloadUrl'] || data.webUrl
}

// ✅ FIX: la subida simple (PUT directo a ":/content") solo la acepta
// Microsoft Graph para archivos de hasta 4MB — por eso documentos reales
// (escaneados, con varias páginas) se subían bien a la app pero fallaban
// en silencio al intentar subirlos a OneDrive. Para esos se usa una sesión
// de subida por partes (createUploadSession), que no tiene ese límite.
const LIMITE_SUBIDA_SIMPLE = 4 * 1024 * 1024

async function subirArchivoGrande(ruc, file) {
  await getOrCreateRucFolder(ruc)
  const path = `/${FOLDER_NAME}/${ruc}/${file.name}`
  const sessionRes = await msFetch(`https://graph.microsoft.com/v1.0/me/drive/root:${path}:/createUploadSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
  })
  if (!sessionRes.ok) throw new Error(`No se pudo iniciar la subida (${sessionRes.status})`)
  const { uploadUrl } = await sessionRes.json()

  const CHUNK = 5 * 1024 * 1024 // múltiplo de 320KiB, como exige Graph
  let start = 0
  let ultimaRes
  while (start < file.size) {
    const end = Math.min(start + CHUNK, file.size)
    // La URL de subida por partes ya trae su propia autorización temporal
    // (no es graph.microsoft.com) — no necesita el token de acceso.
    ultimaRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Length': String(end - start), 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` },
      body: file.slice(start, end),
    })
    if (!ultimaRes.ok && ultimaRes.status !== 202) throw new Error(`Error subiendo el archivo (${ultimaRes.status})`)
    start = end
  }
  return ultimaRes.json()
}

export async function uploadFile(ruc, file) {
  if (file.size > LIMITE_SUBIDA_SIMPLE) return subirArchivoGrande(ruc, file)
  // ✅ FIX: causas creadas antes de que existiera esta sincronización (o
  // donde nunca se apretó "Crear/verificar carpeta") no tenían la carpeta
  // en OneDrive todavía — la subida fallaba con 404/409 porque el destino
  // no existía. Se asegura acá, antes de cada subida.
  await getOrCreateRucFolder(ruc)
  const path = `/${FOLDER_NAME}/${ruc}/${file.name}`
  const res = await msFetch(`https://graph.microsoft.com/v1.0/me/drive/root:${path}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

// 💾 Carpeta de respaldos generales (Excel con toda la info de la app) —
// separada de "CAUSAS JOA" porque no es un documento de una causa
// específica, es un respaldo de todo. Vive junto a ella, dentro de
// "JOAQUIN OBREGON".
const CARPETA_RESPALDOS = 'JOAQUIN OBREGON/Respaldos'

async function getOrCreateCarpetaRespaldos() {
  try {
    return await graphFetch(`/me/drive/root:/${CARPETA_RESPALDOS}`)
  } catch {
    return await graphFetch(`/me/drive/root:/JOAQUIN OBREGON:/children`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Respaldos', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
    })
  }
}

export async function subirArchivoRespaldo(file) {
  await getOrCreateCarpetaRespaldos()
  const path = `/${CARPETA_RESPALDOS}/${file.name}`
  const res = await msFetch(`https://graph.microsoft.com/v1.0/me/drive/root:${path}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

export function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼'
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return '🎵'
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎥'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜'
  return '📎'
}

export function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
