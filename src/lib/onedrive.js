const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID
const TENANT_ID = import.meta.env.VITE_MS_TENANT_ID
// ✅ FIX: antes esto creaba la carpeta directo en la raíz de OneDrive
// ("/CAUSAS JOA/{ruc}"), pero la organización real de Joaquín la espera
// dentro de "JOAQUIN OBREGON/CAUSAS JOA/{ruc}" (así aparece en la miga de
// pan de OneDrive: Mis archivos › JOAQUIN OBREGON › CAUSAS JOA). "Documents"
// NO es una carpeta real navegable vía la API — es solo parte del enlace
// visual de OneDrive, así que no va en esta ruta.
const FOLDER_NAME = 'JOAQUIN OBREGON/' + (import.meta.env.VITE_ONEDRIVE_FOLDER || 'CAUSAS JOA')

const SCOPES = ['Files.ReadWrite', 'User.Read']
const REDIRECT_URI = window.location.origin + '/ms-callback.html'

export function loginOneDrive() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    response_mode: 'fragment',
  })
  localStorage.setItem('ms_login_pending', '1')
  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

export function checkTokenOnLoad() {
  const hash = window.location.hash
  if (hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1))
    const token = params.get('access_token')
    if (token) {
      sessionStorage.setItem('ms_token', token)
      localStorage.removeItem('ms_login_pending')
      window.history.replaceState({}, '', window.location.pathname)
      return token
    }
  }
  return sessionStorage.getItem('ms_token')
}

export function getTokenFromHash() {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')
  if (token) {
    sessionStorage.setItem('ms_token', token)
    window.location.hash = ''
    return token
  }
  return sessionStorage.getItem('ms_token')
}

export function getMSToken() {
  return sessionStorage.getItem('ms_token')
}

export function logoutOneDrive() {
  sessionStorage.removeItem('ms_token')
}

async function graphFetch(path, options = {}) {
  const token = getMSToken()
  if (!token) throw new Error('No token')
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
  const token = getMSToken()
  if (!token) throw new Error('No token')
  await getOrCreateRucFolder(ruc)
  const path = `/${FOLDER_NAME}/${ruc}/${file.name}`
  const sessionRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${path}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
  })
  if (!sessionRes.ok) throw new Error(`No se pudo iniciar la subida (${sessionRes.status})`)
  const { uploadUrl } = await sessionRes.json()

  const CHUNK = 5 * 1024 * 1024 // múltiplo de 320KiB, como exige Graph
  let start = 0
  let ultimaRes
  while (start < file.size) {
    const end = Math.min(start + CHUNK, file.size)
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
  const token = getMSToken()
  if (!token) throw new Error('No token')
  // ✅ FIX: causas creadas antes de que existiera esta sincronización (o
  // donde nunca se apretó "Crear/verificar carpeta") no tenían la carpeta
  // en OneDrive todavía — la subida fallaba con 404/409 porque el destino
  // no existía. Se asegura acá, antes de cada subida.
  await getOrCreateRucFolder(ruc)
  const path = `/${FOLDER_NAME}/${ruc}/${file.name}`
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:${path}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
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
