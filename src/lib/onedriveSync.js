// Sincronización automática con OneDrive — pensado para correr solo, sin
// que Joaquín tenga que apretar nada, tanto al abrir una causa (ver
// openCausa en Dashboard.jsx) como desde el "Sincronizar todo" de
// Contabilidad.jsx. Junta la misma lógica que antes vivía en los botones
// manuales de documentos.jsx ("Subir existentes a OneDrive" / "＋ Agregar a
// la lista"), pero corriendo para TODOS los archivos de una causa de una
// vez, no uno por uno con un clic.
import { supabase } from './supabase'
import { getMSToken, getFolderFiles, uploadFile } from './onedrive'

const esErrorDeSesion = (mensaje) => /No token|401|jwt|unauthorized/i.test(mensaje || '')

export async function sincronizarDocumentosCausa(causaId, ruc, email) {
  if (!getMSToken()) return { subidos: 0, agregados: 0, sesionVencida: false }
  const [{ data: docs }, archivosOneDrive] = await Promise.all([
    supabase.from('documentos_causa').select('*').eq('causa_id', causaId),
    getFolderFiles(ruc).catch(() => []),
  ])
  const nombresOneDrive = new Set(archivosOneDrive.map(a => a.name))
  const nombresApp = new Set((docs || []).map(d => d.nombre))

  // App → OneDrive: sube los que tienen storage_path (archivo real subido a
  // la app) y todavía no están en OneDrive.
  let subidos = 0
  let sesionVencida = false
  for (const doc of (docs || [])) {
    if (!doc.storage_path || nombresOneDrive.has(doc.nombre)) continue
    try {
      const blob = await fetch(doc.url).then(r => { if (!r.ok) throw new Error('descarga falló'); return r.blob() })
      const file = new File([blob], doc.nombre, { type: doc.tipo_mime || blob.type })
      await uploadFile(ruc, file)
      subidos++
    } catch (err) {
      // Si la sesión de OneDrive venció a mitad de camino, no tiene sentido
      // seguir intentando con el resto — se detiene, se reintenta la
      // próxima vez que haya sesión.
      if (esErrorDeSesion(err.message)) { sesionVencida = true; break }
    }
  }

  // OneDrive → app: registra los archivos que están solo en OneDrive (se
  // subieron directo ahí, no desde la app).
  let agregados = 0
  if (!sesionVencida) {
    const archivosSoloOneDrive = archivosOneDrive.filter(it => it.file && !nombresApp.has(it.name))
    for (const item of archivosSoloOneDrive) {
      const { error } = await supabase.from('documentos_causa')
        .insert({ causa_id: causaId, nombre: item.name, storage_path: null, url: item.webUrl, tipo_mime: item.file?.mimeType || '', subido_por: email || 'sincronización automática' })
      if (!error) agregados++
    }
  }

  return { subidos, agregados, sesionVencida }
}
