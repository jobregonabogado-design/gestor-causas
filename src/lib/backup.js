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

// Tablas que forman "la información de la app" para efectos de respaldo —
// se deja afuera lo puramente técnico/interno (tablas vacías, logs de
// deduplicación de Gmail, roles de acceso) que no aportan si hay que
// reconstruir todo desde cero a mano.
const TABLAS = [
  { tabla: 'causas', hoja: 'Causas', orden: 'ruc' },
  { tabla: 'imputados', hoja: 'Imputados', orden: 'created_at' },
  { tabla: 'audiencias', hoja: 'Audiencias', orden: 'fecha' },
  { tabla: 'aumentos_plazo', hoja: 'Aumentos de plazo', orden: 'fecha_audiencia' },
  { tabla: 'apelaciones_corte', hoja: 'Apelaciones Corte', orden: 'created_at' },
  { tabla: 'cautelares_causa', hoja: 'Cautelares', orden: 'fecha_inicio' },
  { tabla: 'ordenes_detencion', hoja: 'Órdenes de detención', orden: 'fecha_orden' },
  { tabla: 'diligencias_fiscalia', hoja: 'Diligencias Fiscalía', orden: 'created_at' },
  { tabla: 'documentos_causa', hoja: 'Documentos (listado)', orden: 'created_at' },
  { tabla: 'honorarios', hoja: 'Honorarios', orden: 'updated_at' },
  { tabla: 'abonos_honorarios', hoja: 'Abonos honorarios', orden: 'created_at' },
  { tabla: 'escritos_generados', hoja: 'Escritos generados', orden: 'created_at' },
  { tabla: 'abogados_delegados', hoja: 'Abogados delegados', orden: 'created_at' },
  { tabla: 'notas', hoja: 'Notas', orden: 'created_at' },
  { tabla: 'tareas', hoja: 'Tareas', orden: 'created_at' },
  { tabla: 'fallos_referencia', hoja: 'Fallos de referencia', orden: 'created_at' },
]

// SheetJS no sabe mostrar objetos/arreglos (columnas jsonb como
// actividad_usuario.metadata) — se convierten a texto para que se vean
// legibles en la celda en vez de "[object Object]".
function aplanarFilas(filas) {
  return filas.map(fila => {
    const plano = {}
    for (const [clave, valor] of Object.entries(fila)) {
      plano[clave] = (valor && typeof valor === 'object') ? JSON.stringify(valor) : valor
    }
    return plano
  })
}

export async function generarRespaldoExcel({ onProgress } = {}) {
  const XLSX = await cargarXlsx()
  const wb = XLSX.utils.book_new()

  for (const { tabla, hoja, orden } of TABLAS) {
    onProgress?.(`Leyendo ${hoja}...`)
    const { data, error } = await supabase.from(tabla).select('*').order(orden, { ascending: true })
    if (error) throw new Error(`No se pudo leer "${hoja}": ${error.message}`)
    const filas = aplanarFilas(data || [])
    // Una hoja vacía (sin filas) igual se agrega, con solo el nombre de la
    // tabla — así el respaldo deja constancia de que esa tabla existe y
    // está vacía, en vez de simplemente desaparecer del archivo.
    const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{}])
    XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31)) // Excel limita el nombre de hoja a 31 caracteres
  }

  onProgress?.('Armando el archivo...')
  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const nombreArchivo = `Respaldo LexOffice ${hoyISO()}.xlsx`
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
