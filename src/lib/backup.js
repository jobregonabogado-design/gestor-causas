// Respaldo manual de toda la información de la app a un Excel — pensado
// para tener una copia fuera de la oficina (se descarga al computador Y se
// sube a OneDrive de una sola vez). Usa SheetJS (xlsx) cargado por CDN en
// tiempo de ejecución, mismo patrón que jsPDF en pages/escritos/generarPdf.js
// y Tesseract en pages/dashboard/diligencias.jsx (sin tocar package.json).
import { supabase } from './supabase'
import { subirArchivoRespaldo } from './onedrive'
import { hoyISO } from '../pages/dashboard/utils'

let _xlsxCargando = null
function cargarXlsx() {
  if (typeof window !== 'undefined' && window.XLSX) return Promise.resolve(window.XLSX)
  if (_xlsxCargando) return _xlsxCargando
  _xlsxCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = () => reject(new Error('No se pudo cargar el generador de Excel (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _xlsxCargando
}

// ✅ Simplificado a pedido de Joaquín: el resto de la información de cada
// causa (audiencias, diligencias, honorarios, etc.) ya queda respaldada
// aparte, en el resumen imprimible que se guarda solo en OneDrive al
// generarlo (ver src/pages/dashboard/resumen.jsx) — este Excel es solo un
// índice rápido de TODAS las causas, para tenerlas todas a la vista en una
// sola hoja.
export async function generarRespaldoExcel({ onProgress } = {}) {
  const XLSX = await cargarXlsx()

  onProgress?.('Leyendo causas...')
  const { data, error } = await supabase.from('causas').select('ruc, rit, imputado, tribunal, delito').order('ruc', { ascending: true })
  if (error) throw new Error(`No se pudo leer las causas: ${error.message}`)

  const filas = (data || []).map(c => ({
    RUC: c.ruc || '',
    RIT: c.rit || '',
    Nombre: (c.imputado || '').replace(/\|/g, ' / '),
    Tribunal: c.tribunal || '',
    Delito: (c.delito || '').replace(/\|/g, ', '),
  }))

  onProgress?.('Armando el archivo...')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(filas)
  XLSX.utils.book_append_sheet(wb, ws, 'Causas')
  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const nombreArchivo = `Causas LexOffice ${hoyISO()}.xlsx`
  return { blob, nombreArchivo }
}

export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Genera el Excel, lo descarga al computador y (si hay sesión de OneDrive
// activa) lo sube también a una carpeta de respaldos — dos copias fuera de
// la base de datos misma con un solo clic, tal como pidió Joaquín.
export async function generarYRespaldar({ onProgress } = {}) {
  const { blob, nombreArchivo } = await generarRespaldoExcel({ onProgress })
  descargarBlob(blob, nombreArchivo)

  let subidoOneDrive = false
  let errorOneDrive = null
  try {
    onProgress?.('Subiendo a OneDrive...')
    const file = new File([blob], nombreArchivo, { type: blob.type })
    await subirArchivoRespaldo(file)
    subidoOneDrive = true
  } catch (err) {
    // No es crítico: el archivo ya se descargó al computador igual. Si
    // OneDrive no está conectado o falla, se avisa pero no se considera un
    // error total del respaldo.
    errorOneDrive = err.message || 'Error desconocido'
  }

  return { nombreArchivo, subidoOneDrive, errorOneDrive }
}
