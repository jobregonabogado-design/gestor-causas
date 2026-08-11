// Generador de PDF real (texto seleccionable, no una foto) para los escritos
// judiciales — usa jsPDF cargado por CDN en tiempo de ejecución, mismo
// patrón que pdf-lib/html2canvas en dashboard/resumen.jsx y
// pdf.js/Tesseract en dashboard/diligencias.jsx (sin tocar package.json).
//
// Convención del texto que se le pasa (la misma que se edita en el cuadro
// de texto de Escritos.jsx, así que tiene que seguir siendo legible ahí):
//   "# texto"   → línea de suma/título: negrita, alineada a la izquierda.
//   "## texto"  → línea de tribunal/destinatario: negrita, centrada.
//   línea vacía → separación de párrafo (y sangra la primera línea del
//                 párrafo que sigue).
//   cualquier otra línea → párrafo normal, justificado.
//   una línea que empieza con "POR TANTO" → se pone en negrita sola.
//   "**texto**" dentro de cualquier línea → ese tramo en negrita.

let _jspdfCargando = null
export function cargarJsPdf() {
  if (typeof window !== 'undefined' && window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF)
  if (_jspdfCargando) return _jspdfCargando
  _jspdfCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => resolve(window.jspdf.jsPDF)
    script.onerror = () => reject(new Error('No se pudo cargar el generador de PDF (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _jspdfCargando
}

// ✅ Convierte el código corto que usa el resto de la app para el tribunal
// (ej. "3 JG STGO", "JG LA FLORIDA", "TOP CAÑETE") al nombre completo que va
// en el encabezado de un escrito ("S.J. DE GARANTÍA DE SANTIAGO (3°)"). Esto
// también corrige el mismo problema que ya tenía Patrocinio y Poder, que
// hoy usa el código corto tal cual.
const CIUDAD_MAP = { STGO: 'SANTIAGO' }
function extraerCiudad(codigo) {
  const m = (codigo || '').trim().match(/^(\d+)?\s*(JG|TOP)\s+(.+)$/i)
  if (!m) return null
  const [, numero, tipo, ciudadRaw] = m
  const ciudad = ciudadRaw.trim().toUpperCase().split(' ').map(w => CIUDAD_MAP[w] || w).join(' ')
  return { ciudad, numero, tipo: tipo.toUpperCase() }
}
export function tribunalCompleto(codigo) {
  if (!codigo) return '[TRIBUNAL]'
  const info = extraerCiudad(codigo)
  if (!info) return codigo.trim()
  const ordinal = info.numero ? ` (${info.numero}°)` : ''
  return info.tipo === 'TOP'
    ? `TRIBUNAL DE JUICIO ORAL EN LO PENAL DE ${info.ciudad}${ordinal}`
    : `S.J. DE GARANTÍA DE ${info.ciudad}${ordinal}`
}
// ✅ NUEVO: para escritos dirigidos a la Corte de Apelaciones (ej. "Anuncio
// para alegar") — usa la ciudad del tribunal de origen de la causa, que en
// la gran mayoría de los casos coincide con la jurisdicción de la Corte
// (Joaquín pidió explícitamente que acá vaya el nombre de la CORTE, no el
// del tribunal de origen).
export function corteCompleta(codigo) {
  const info = extraerCiudad(codigo)
  return `ILUSTRÍSIMA CORTE DE APELACIONES DE ${info ? info.ciudad : '[CIUDAD]'}`
}

const FUENTE = 'helvetica'
const TAMANO = 11
const INTERLINEA = 2
const MARGEN = 25 // mm
const SANGRIA = 12 // mm, sangría de primera línea de párrafo

function parseRuns(linea) {
  const partes = []
  const regex = /\*\*(.+?)\*\*/g
  let last = 0, m
  while ((m = regex.exec(linea))) {
    if (m.index > last) partes.push({ texto: linea.slice(last, m.index), negrita: false })
    partes.push({ texto: m[1], negrita: true })
    last = m.index + m[0].length
  }
  if (last < linea.length) partes.push({ texto: linea.slice(last), negrita: false })
  return partes
}

// ✅ FIX: separar por espacio CADA TRAMO de negrita por separado (en vez de
// la línea completa) partía mal una palabra cuando la negrita terminaba
// pegada a una coma o punto (ej. "**POR TANTO**,") — la coma quedaba como
// su propio "token" con un espacio de más antes. Ahora se arma el texto
// plano completo (sin los **) y se recorre una sola vez, tomando el estado
// de negrita del PRIMER carácter de cada palabra — así "TANTO," queda como
// una sola palabra, sin importar que la negrita termine a mitad de ella.
function tokenizarPalabras(linea, negritaBase) {
  const runs = parseRuns(linea)
  const negritaPorIndice = []
  let textoPlano = ''
  runs.forEach(r => {
    textoPlano += r.texto
    for (let i = 0; i < r.texto.length; i++) negritaPorIndice.push(r.negrita)
  })
  const palabras = []
  let actual = ''
  let actualNegrita = false
  let iniciando = true
  for (let i = 0; i < textoPlano.length; i++) {
    const ch = textoPlano[i]
    if (/\s/.test(ch)) {
      if (actual) { palabras.push({ texto: actual, negrita: actualNegrita || negritaBase }); actual = ''; iniciando = true }
    } else {
      if (iniciando) { actualNegrita = negritaPorIndice[i]; iniciando = false }
      actual += ch
    }
  }
  if (actual) palabras.push({ texto: actual, negrita: actualNegrita || negritaBase })
  return palabras
}

// ✅ FIX: doc.getTextWidth() incluye "kerning" (achica el ancho medido para
// pares de letras que se ven mejor más juntas, ej. "IO"), pero doc.text()
// dibuja cada palabra sin aplicar ese kerning — quedaba más ancha de lo
// medido. Al calcular dónde poner la palabra SIGUIENTE con el ancho medido
// (más angosto), se pisaban sin espacio entre ellas (pasaba, por ejemplo,
// con "PATROCINIO Y PODER" — salía "PATROCINIOY PODER"). Se mide sin
// kerning para que calce con lo que realmente se dibuja.
function medirPalabra(doc, texto, negrita) {
  doc.setFont(FUENTE, negrita ? 'bold' : 'normal')
  const fontSize = doc.internal.getFontSize()
  return doc.getStringUnitWidth(texto, { doKerning: false }) * fontSize / doc.internal.scaleFactor
}

// ✅ FIX: doc.getLineHeight() de jsPDF devuelve el alto en una escala interna
// (puntos), NO en la unidad del documento (acá, mm) — hay que dividirlo por
// internal.scaleFactor. Sin este ajuste, cada línea quedaba ~2.8x más alta
// de lo que debía, y un escrito de una página terminaba ocupando 3.
function alturaLinea(doc) {
  return doc.getLineHeight() / doc.internal.scaleFactor
}

// Arma las líneas físicas (con wrap) de un párrafo y las dibuja,
// justificando todas menos la última de cada párrafo. Devuelve el nuevo Y.
function dibujarParrafo(doc, palabras, x, yInicio, maxWidth, sangriaPrimeraLinea, justificar, altoPagina) {
  const lineHeight = alturaLinea(doc)
  const espacioNormal = medirPalabra(doc, ' ', false)
  const lineasFisicas = []
  let actual = []
  let anchoActual = 0
  palabras.forEach(p => {
    const anchoPalabra = medirPalabra(doc, p.texto, p.negrita)
    const sangriaEstaLinea = lineasFisicas.length === 0 ? sangriaPrimeraLinea : 0
    const disponible = maxWidth - sangriaEstaLinea
    const anchoConEspacio = actual.length ? anchoActual + espacioNormal + anchoPalabra : anchoPalabra
    if (anchoConEspacio > disponible && actual.length > 0) {
      lineasFisicas.push({ palabras: actual, sangria: sangriaEstaLinea })
      actual = [p]; anchoActual = anchoPalabra
    } else {
      actual.push(p); anchoActual = anchoConEspacio
    }
  })
  if (actual.length) lineasFisicas.push({ palabras: actual, sangria: lineasFisicas.length === 0 ? sangriaPrimeraLinea : 0 })

  let y = yInicio
  lineasFisicas.forEach((linea, i) => {
    if (y > altoPagina - MARGEN) { doc.addPage(); y = MARGEN }
    const esUltima = i === lineasFisicas.length - 1
    const anchoUsado = linea.palabras.reduce((s, p) => s + medirPalabra(doc, p.texto, p.negrita), 0)
    const espacios = linea.palabras.length - 1
    const espacioExtra = (justificar && !esUltima && espacios > 0)
      ? (maxWidth - linea.sangria - anchoUsado) / espacios
      : espacioNormal
    let cursorX = x + linea.sangria
    linea.palabras.forEach(p => {
      doc.setFont(FUENTE, p.negrita ? 'bold' : 'normal')
      doc.text(p.texto, cursorX, y)
      cursorX += medirPalabra(doc, p.texto, p.negrita) + espacioExtra
    })
    y += lineHeight
  })
  return y
}

// Convierte el texto (con la convención de arriba) en un Blob de PDF real.
export async function generarPdfEscrito(texto) {
  const jsPDF = await cargarJsPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setLineHeightFactor(INTERLINEA)
  doc.setFont(FUENTE, 'normal')
  doc.setFontSize(TAMANO)
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const maxWidth = anchoPagina - MARGEN * 2
  const lineHeight = alturaLinea(doc)
  let y = MARGEN
  let lineaAnteriorVacia = true

  texto.split('\n').forEach(lineaRaw => {
    const linea = lineaRaw.trimEnd()
    if (y > altoPagina - MARGEN) { doc.addPage(); y = MARGEN }
    if (!linea.trim()) { y += lineHeight * 0.6; lineaAnteriorVacia = true; return }

    if (linea.trim().startsWith('##')) {
      doc.setFont(FUENTE, 'bold')
      doc.text(linea.trim().replace(/^##\s*/, ''), anchoPagina / 2, y, { align: 'center' })
      y += lineHeight
    } else if (linea.trim().startsWith('#')) {
      const palabras = tokenizarPalabras(linea.trim().replace(/^#\s*/, ''), true)
      y = dibujarParrafo(doc, palabras, MARGEN, y, maxWidth, 0, false, altoPagina)
    } else {
      const esPorTanto = /^POR TANTO/i.test(linea.trim())
      const palabras = tokenizarPalabras(linea, esPorTanto)
      const sangria = lineaAnteriorVacia ? SANGRIA : 0
      y = dibujarParrafo(doc, palabras, MARGEN, y, maxWidth, sangria, true, altoPagina)
    }
    lineaAnteriorVacia = false
  })

  return doc.output('blob')
}
