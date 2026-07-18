const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID
const TENANT_ID = import.meta.env.VITE_MS_TENANT_ID
const FOLDER_NAME = import.meta.env.VITE_ONEDRIVE_FOLDER || 'CAUSAS JOA'

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

export async function uploadFile(ruc, file) {
  const token = getMSToken()
  if (!token) throw new Error('No token')
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
