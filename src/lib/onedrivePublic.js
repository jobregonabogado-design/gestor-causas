import { getFileIcon, formatFileSize } from './onedrive'

const SHARE_URL = 'https://1drv.ms/f/c/0cfb783f3c750a65/IgBlCnU8P3j7IIAMClAAAAAAAeZynSn31N0mnxsucbEeYg0'

// Encode share URL para Graph API
function encodeShareUrl(url) {
  const b64 = btoa(url).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return 'u!' + b64
}

const SHARE_ID = encodeShareUrl(SHARE_URL)

export async function getFolderFilesByRuc(ruc) {
  try {
    // Primero obtener el contenido de la carpeta compartida
    const res = await fetch(`https://graph.microsoft.com/v1.0/shares/${SHARE_ID}/driveItem/children`)
    if (!res.ok) throw new Error('Error accediendo carpeta')
    const data = await res.json()
    
    // Buscar subcarpeta con el RUC
    const folder = (data.value || []).find(f => f.name === ruc)
    if (!folder) return []
    
    // Obtener archivos de esa subcarpeta
    const res2 = await fetch(`https://graph.microsoft.com/v1.0/shares/${SHARE_ID}/driveItem/children/${folder.id}/children`)
    if (!res2.ok) return []
    const data2 = await res2.json()
    return data2.value || []
  } catch(e) {
    console.error(e)
    return []
  }
}
