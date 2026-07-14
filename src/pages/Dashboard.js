import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import CarpetaOneDrive from '../components/CarpetaOneDrive'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  .row-hover { transition:background 0.2s ease, border-color 0.2s ease; cursor:pointer; }
  .row-hover:hover { background:#f8faff !important; }
  .stat-card { transition:all 0.3s cubic-bezier(0.4,0,0.2,1); cursor:pointer; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.10) !important; }
  .tab-btn { transition:color 0.2s ease, border-color 0.2s ease; border:none; background:none; cursor:pointer; font-family:'Inter',sans-serif; }
  .tab-btn:hover { color:#1E293B !important; }
  .fld { transition:border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease; }
  .fld:hover { border-color:#93c5fd !important; background:#fafcff !important; box-shadow:0 0 0 3px rgba(37,99,235,0.05) !important; }
  .sort-col { cursor:pointer; user-select:none; transition:color 0.2s ease; }
  .sort-col:hover { color:#1E293B !important; }
  .btn-primary { font-family:'Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,58,95,0.2); }
  .btn-primary:hover { background:#1e40af; box-shadow:0 4px 16px rgba(30,58,95,0.3); }
  .btn-secondary { font-family:'Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E293B; background:#f8faff; }
  .detail-enter { animation:detailIn 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes detailIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  input,select,textarea { font-family:'Inter',sans-serif !important; transition:border-color 0.25s ease, box-shadow 0.25s ease; text-transform:uppercase; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08) !important; }
  .tc-section textarea:focus { box-shadow: none !important; border-color: transparent !important; }
  @keyframes semaforo-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.2)} }
  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .hide-mobile { display: none !important; }
  }
`

const estadoConfig = {
  // Subestados VIGENTE
  vencido:           { label:'PLAZO VENCIDO',          color:'#991b1b', bg:'#fef2f2', border:'#fecaca' },
  proximo:           { label:'POR VENCER',              color:'#92400e', bg:'#fff7ed', border:'#fed7aa' },
  plazo_vigente:     { label:'PLAZO VIGENTE',           color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
  apjo:              { label:'APJO',                    color:'#5b21b6', bg:'#f5f3ff', border:'#ddd6fe' },
  juicio_oral:       { label:'JUICIO ORAL',             color:'#9f1239', bg:'#fff1f2', border:'#fecdd3' },
  // Subestados TERMINADA
  renuncia:          { label:'RENUNCIA',                color:'#475569', bg:'#F8F9FC', border:'#e2e8f0' },
  revocacion:        { label:'REVOCACIÓN',              color:'#475569', bg:'#F8F9FC', border:'#e2e8f0' },
  condena_preso:     { label:'CONDENA — PRESO',         color:'#991b1b', bg:'#fef2f2', border:'#fecaca' },
  condena_libertad:  { label:'CONDENA — LIBERTAD',      color:'#92400e', bg:'#fff7ed', border:'#fed7aa' },
  scp:               { label:'SALIDA ALTERNATIVA SCP',  color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
  salida_ar:         { label:'SALIDA ALTERNATIVA AR',   color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
  // Estados principales
  terminada:         { label:'TERMINADA',               color:'#475569', bg:'#F8F9FC', border:'#e2e8f0' },
  vigente:           { label:'VIGENTE',                 color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
}

const SUBESTADOS_VIGENTE = ['plazo_vigente','proximo','vencido','apjo','juicio_oral']
const SUBESTADOS_TERMINADA = ['renuncia','revocacion','condena_preso','condena_libertad','scp','salida_ar']

function getBadgeConfig(estado, subestado) {
  if (subestado && estadoConfig[subestado]) return estadoConfig[subestado]
  return estadoConfig[estado] || { label:estado||'—', color:'#64748b', bg:'#F8F9FC', border:'#e2e8f0' }
}

// ─── AUTOCORRECCIÓN ORTOGRÁFICA ──────────────────────────────────────────────
// Diccionario de correcciones: siempre se aplican automáticamente al guardar
const CORRECCIONES = [
  // ── Delitos — palabras confirmadas en la BD ──────────────────────────────
  ['INTIMIDACION', 'INTIMIDACIÓN'],
  ['VEHICULO', 'VEHÍCULO'],
  ['PORNOGRAFICO', 'PORNOGRÁFICO'],
  ['PORNOGRAFICA', 'PORNOGRÁFICA'],
  ['RECEPTACION', 'RECEPTACIÓN'],
  ['ASOCIACION', 'ASOCIACIÓN'],
  ['ILICITA', 'ILÍCITA'],
  ['ILICITO', 'ILÍCITO'],
  ['FALSIFICACION', 'FALSIFICACIÓN'],
  ['PUBLICO', 'PÚBLICO'],
  ['PUBLICA', 'PÚBLICA'],
  ['CONDUCCION', 'CONDUCCIÓN'],
  ['TRAFICO', 'TRÁFICO'],
  ['TRANSITO', 'TRÁNSITO'],
  ['OBSTRUCCION', 'OBSTRUCCIÓN'],
  ['POSESION', 'POSESIÓN'],
  ['USURPACION', 'USURPACIÓN'],
  ['VIOLACION', 'VIOLACIÓN'],
  ['GRAVISIMAS', 'GRAVÍSIMAS'],
  ['GRAVISIMO', 'GRAVÍSIMO'],
  // ── Otras palabras jurídicas comunes ─────────────────────────────────────
  ['APELACION', 'APELACIÓN'],
  ['FORMALIZACION', 'FORMALIZACIÓN'],
  ['PRIVACION', 'PRIVACIÓN'],
  ['INVESTIGACION', 'INVESTIGACIÓN'],
  ['DETENCION', 'DETENCIÓN'],
  ['ACUSACION', 'ACUSACIÓN'],
  ['IMPUTACION', 'IMPUTACIÓN'],
  ['INTERVENCION', 'INTERVENCIÓN'],
  ['DECLARACION', 'DECLARACIÓN'],
  ['REVISION', 'REVISIÓN'],
  ['PARTICIPACION', 'PARTICIPACIÓN'],
  ['SANCION', 'SANCIÓN'],
  ['EJECUCION', 'EJECUCIÓN'],
  ['RESOLUCION', 'RESOLUCIÓN'],
  ['FRUSTRACION', 'FRUSTRACIÓN'],
  ['ADMINISTRACION', 'ADMINISTRACIÓN'],
  ['CELEBRACION', 'CELEBRACIÓN'],
  ['JURIDICO', 'JURÍDICO'],
  ['JURIDICA', 'JURÍDICA'],
  ['UNICO', 'ÚNICO'],
  ['UNICA', 'ÚNICA'],
  // ── Errores tipográficos ─────────────────────────────────────────────────
  ['ALMACENIMIENTO', 'ALMACENAMIENTO'],
  ['DEVOLUCION', 'DEVOLUCIÓN'],
  ['BIENES NACIONES', 'BIENES NACIONALES'],
]

function corregirOrtografia(texto) {
  if (!texto) return texto
  let resultado = texto.toUpperCase()
  for (const [mal, bien] of CORRECCIONES) {
    // Reemplazar todas las ocurrencias sin distinción de límite de palabra
    while (resultado.includes(mal)) {
      resultado = resultado.replace(mal, bien)
    }
  }
  return resultado
}


// ─── LISTA COMPLETA DE TRIBUNALES CHILE ──────────────────────────────────────
const TRIBUNALES_CHILE = [
  // ── Juzgados de Garantia — Region Metropolitana ──
  '1 JG STGO','2 JG STGO','3 JG STGO','4 JG STGO','5 JG STGO',
  '6 JG STGO','7 JG STGO','8 JG STGO','9 JG STGO','10 JG STGO',
  '11 JG STGO','12 JG STGO','13 JG STGO','14 JG STGO','15 JG STGO',
  'JG COLINA','JG PUENTE ALTO','JG SAN BERNARDO','JG MELIPILLA',
  'JG TALAGANTE','JG CURACAVI',
  // ── Juzgados de Garantia — Regiones ──
  'JG ARICA','JG IQUIQUE','JG TOCOPILLA','JG CALAMA','JG ANTOFAGASTA',
  'JG DIEGO DE ALMAGRO','JG COPIAPO','JG VALLENAR',
  'JG LA SERENA','JG VICUNA','JG COQUIMBO','JG OVALLE','JG ILLAPEL',
  'JG LA LIGUA','JG CALERA','JG SAN FELIPE','JG LOS ANDES','JG QUILLOTA',
  'JG LIMACHE','JG VINA DEL MAR','JG VALPARAISO','JG QUILPUE',
  'JG VILLA ALEMANA','JG CASABLANCA','JG SAN ANTONIO',
  'JG GRANEROS','JG RANCAGUA','JG SAN VICENTE','JG RENGO',
  'JG SAN FERNANDO','JG SANTA CRUZ',
  'JG CURICO','JG MOLINA','JG CONSTITUCION','JG TALCA','JG SAN JAVIER',
  'JG CAUQUENES','JG LINARES','JG PARRAL',
  'JG TOME','JG TALCAHUANO','JG CONCEPCION','JG SAN PEDRO DE LA PAZ',
  'JG CHIGUAYANTE','JG CORONEL','JG LOS ANGELES','JG ARAUCO','JG CANETE',
  'JG ANGOL','JG VICTORIA','JG NUEVA IMPERIAL','JG TEMUCO','JG LAUTARO',
  'JG PITRUFQUEN','JG LONCOCHE','JG VILLARRICA',
  'JG OSORNO','JG RIO NEGRO','JG PUERTO VARAS','JG PUERTO MONTT',
  'JG ANCUD','JG CASTRO','JG COIHAIQUE','JG PUNTA ARENAS',
  'JG MARIQUINA','JG VALDIVIA','JG LOS LAGOS',
  'JG SAN CARLOS','JG CHILLAN','JG YUNGAY',
  // ── Tribunales de Juicio Oral ──
  '1 TOP STGO','2 TOP STGO','3 TOP STGO','4 TOP STGO',
  '5 TOP STGO','6 TOP STGO','7 TOP STGO',
  'TOP COLINA','TOP PUENTE ALTO','TOP SAN BERNARDO','TOP MELIPILLA','TOP TALAGANTE',
  'TOP ARICA','TOP IQUIQUE','TOP CALAMA','TOP ANTOFAGASTA','TOP COPIAPO',
  'TOP LA SERENA','TOP OVALLE','TOP SAN FELIPE','TOP LOS ANDES','TOP QUILLOTA',
  'TOP VINA DEL MAR','TOP VALPARAISO','TOP SAN ANTONIO',
  'TOP RANCAGUA','TOP SAN FERNANDO','TOP SANTA CRUZ',
  'TOP CURICO','TOP TALCA','TOP LINARES','TOP CAUQUENES',
  'TOP CONCEPCION','TOP LOS ANGELES','TOP CANETE',
  'TOP ANGOL','TOP TEMUCO','TOP VILLARRICA',
  'TOP OSORNO','TOP PUERTO MONTT','TOP CASTRO',
  'TOP COIHAIQUE','TOP PUNTA ARENAS','TOP VALDIVIA','TOP CHILLAN',
]

// ─── CATÁLOGO DE DELITOS FISCALÍA (con artículo) ─────────────────────────────
const DELITOS_CATALOGO = [
  // ROBOS
  {c:802, n:'ROBO CON INTIMIDACIÓN. ART. 433, 436 INC. 1'},
  {c:803, n:'ROBO CON VIOLENCIA. ART. 436 INC. 1, 433, 439'},
  {c:804, n:'ROBO POR SORPRESA. ART. 436 INC. 2'},
  {c:807, n:'ROBO CON FUERZA EN LAS COSAS'},
  {c:808, n:'ROBO EN BIENES NACIONALES DE USO PUBLICO'},
  {c:809, n:'ROBO EN LUGAR HABITADO O DESTINADO A LA HABITACIÓN. ART. 440'},
  {c:810, n:'ROBO EN LUGAR NO HABITADO. ART. 442'},
  {c:827, n:'ROBO CON HOMICIDIO'},
  {c:828, n:'ROBO CON VIOLACIÓN. ART. 433 N°1'},
  {c:829, n:'ROBO CON CASTRACIÓN, MUTILACIÓN O LESIONES GRAVES GRAVÍSIMAS'},
  {c:831, n:'ROBO DE VEHÍCULO MOTORIZADO. ART. 443 INC. 2'},
  {c:861, n:'ROBO CON LESIONES GRAVES GRAVÍSIMAS. ART. 433 N°2'},
  {c:862, n:'ROBO CON RETENCIÓN DE VÍCTIMAS O LESIONES GRAVES. ART. 433 N°3'},
  {c:867, n:'ROBO VEHÍCULO MOTORIZADO POR SORPRESA, VIOLENCIA O INTIMIDACIÓN'},
  {c:868, n:'ROBO DE VEHÍCULO UTILIZANDO ELEMENTOS DISTRACTIVOS'},
  {c:870, n:'ROBO CON OCASIÓN DE CALAMIDAD O ALTERACIÓN AL ORDEN PUBLICO'},
  {c:872, n:'SAQUEO'},
  // HURTOS
  {c:801, n:'HURTO SIMPLE'},
  {c:821, n:'HURTO DE HALLAZGO'},
  {c:826, n:'HURTO AGRAVADO. ART. 447 CODIGO PENAL'},
  {c:846, n:'HURTO SIMPLE POR UN VALOR SOBRE 40 UTM'},
  {c:847, n:'HURTO SIMPLE POR UN VALOR DE 4 A 40 UTM'},
  {c:848, n:'HURTO SIMPLE POR UN VALOR DE MEDIA A 4 UTM'},
  {c:13028, n:'HURTO FALTA. ART. 494 BIS CODIGO PENAL'},
  // HOMICIDIOS
  {c:701, n:'PARRICIDIO. ART. 390 INC. 1°'},
  {c:702, n:'HOMICIDIO. ART. 391'},
  {c:703, n:'HOMICIDIO CALIFICADO. ART. 391 N°1'},
  {c:705, n:'HOMICIDIO EN RIÑA O PELEA'},
  {c:707, n:'INFANTICIDIO'},
  {c:720, n:'FEMICIDIO ÍNTIMO. ART. 390 BIS'},
  {c:766, n:'FEMICIDIO NO ÍNTIMO. ART. 390 TER'},
  {c:769, n:'CONSPIRACIÓN HOMICIDIO CALIFICADO POR PREMIO. ART. 391 BIS INC. 1°'},
  // LESIONES
  {c:709, n:'LESIONES GRAVES'},
  {c:710, n:'LESIONES MENOS GRAVES'},
  {c:717, n:'LESIONES GRAVES GRAVÍSIMAS. ART. 397 N°1'},
  {c:718, n:'CASTRACIÓN Y MUTILACIÓN'},
  {c:13001, n:'LESIONES LEVES. ART. 494 N°5'},
  {c:763, n:'MALTRATO CORPORAL A PERSONAS VULNERABLES. ART. 403 BIS INC. 1°'},
  {c:764, n:'MALTRATO COMETIDO POR GARANTE. ART. 403 BIS INC. FINAL'},
  {c:765, n:'TRATOS DEGRADANTES A PERSONAS VULNERABLES. ART. 403 TER'},
  // DROGAS
  {c:7007, n:'TRÁFICO ILÍCITO DE DROGAS. ART. 3 LEY 20.000'},
  {c:7037, n:'MICROTRÁFICO. ART. 4 LEY 20.000'},
  {c:7001, n:'ELABORACIÓN ILEGAL DE DROGAS. ART. 1 LEY 20.000'},
  {c:7014, n:'ASOCIACIONES ILÍCITAS LEY DE DROGAS. ART. 16 LEY 20.000'},
  {c:7032, n:'SUMINISTRO INDEBIDO DE DROGAS. ART. 7 LEY 20.000'},
  // DELITOS SEXUALES
  {c:621, n:'VIOLACIÓN DE MENOR DE 14 AÑOS. ART. 362'},
  {c:637, n:'VIOLACIÓN DE MAYOR DE 14 AÑOS. ART. 361'},
  {c:620, n:'ABUSO SEXUAL SIN CONTACTO MENOR 14 AÑOS. ART. 366 QUÁTER INC. 1, 2 Y 3'},
  {c:619, n:'ABUSO SEXUAL SIN CONTACTO MAYOR 14 MENOR 18 AÑOS. ART. 366 QUÁTER INC. 4'},
  {c:623, n:'ABUSO SEXUAL CON CONTACTO CORPORAL MENOR 14 AÑOS. ART. 366 BIS'},
  {c:633, n:'ABUSO SEXUAL CALIFICADO. ART. 365 BIS'},
  {c:635, n:'ABUSO SEXUAL DE MAYOR DE 14 CON CIRCUNSTANCIAS DE VIOLACIÓN. ART. 366'},
  {c:634, n:'ABUSO SEXUAL MAYOR 14 MENOR 18 CON CIRCUNSTANCIAS ESTUPRO. ART. 366 INC. 2'},
  {c:639, n:'ABUSO SEXUAL MAYOR DE 14 AÑOS POR SORPRESA. ART. 366 QUÁTER'},
  {c:628, n:'VIOLACIÓN CON HOMICIDIO O FEMICIDIO. ART. 372 BIS'},
  {c:650, n:'ALMACENAMIENTO MATERIAL PORNOGRÁFICO INFANTIL. ART. 367 QUÁTER INC. 3°'},
  {c:649, n:'PRODUCCIÓN MATERIAL PORNOGRÁFICO UTILIZANDO MENOR 18. ART. 367 QUÁTER INC. 2°'},
  {c:648, n:'COMERCIALIZACIÓN MATERIAL PORNOGRÁFICO MENOR 18. ART. 367 QUÁTER INC. 1°'},
  {c:638, n:'CAPTACIÓN, GRABACIÓN Y DIFUSIÓN DE REGISTROS AUDIOVISUALES ÍNTIMOS'},
  {c:608, n:'ESTUPRO. ART. 363'},
  {c:609, n:'INCESTO. ART. 375'},
  // ARMAS
  {c:10008, n:'PORTE DE ARMA PROHIBIDA. ART. 14 INC. 1° LEY 17.798'},
  {c:10009, n:'TENENCIA DE ARMAS PROHIBIDAS. ART. 13 LEY 17.798'},
  {c:10016, n:'DISPAROS INJUSTIFICADOS EN VÍA PÚBLICA. ART. 14 D INC. FINAL LEY 17.798'},
  {c:10015, n:'COLOCACIÓN DE BOMBA O ARTEFACTO. ART. 14 D LEY 17.798'},
  {c:518, n:'PORTE DE ARMA CORTANTE O PUNZANTE. ART. 288 BIS'},
  // RECEPTACIÓN
  {c:812, n:'RECEPTACIÓN. ART. 456 BIS A'},
  {c:869, n:'RECEPTACIÓN DE VEHÍCULOS MOTORIZADOS'},
  {c:864, n:'RECEPTACIÓN COMETIDA POR PERSONA JURÍDICA. ART. 456 BIS A'},
  // AMENAZAS
  {c:524, n:'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES. ART. 296 N°3'},
  {c:525, n:'AMENAZAS CONDICIONALES CONTRA PERSONAS Y PROPIEDADES. ART. 296 1 Y 2, 297'},
  {c:515, n:'ATENTADOS Y AMENAZAS CONTRA LA AUTORIDAD. ART. 261 N°1 Y 264'},
  // TRÁNSITO
  {c:14006, n:'CONDUCCIÓN EN ESTADO DE EBRIEDAD CON RESULTADO MUERTE. ART. 196 INC. 3 LEY TRÁNSITO'},
  {c:14007, n:'CONDUCCIÓN EN ESTADO DE EBRIEDAD CON LESIONES GRAVÍSIMAS. ART. 196 INC. 3 LEY TRÁNSITO'},
  {c:14008, n:'CONDUCCIÓN EN ESTADO DE EBRIEDAD CON LESIONES GRAVES. ART. 196 INC. 2 LEY TRÁNSITO'},
  {c:14004, n:'CONDUCCIÓN EN ESTADO DE EBRIEDAD CON SUSPENSIÓN LICENCIA. ART. 196, 209 LEY TRÁNSITO'},
  {c:12079, n:'CONDUCCIÓN BAJO INFLUENCIA DEL ALCOHOL CAUSANDO LESIONES MENOS GRAVES'},
  {c:12080, n:'CONDUCCIÓN BAJO INFLUENCIA DEL ALCOHOL CAUSANDO LESIONES GRAVES'},
  {c:14022, n:'OCULTAMIENTO DE PLACA PATENTE. ART. 192 LETRA E'},
  {c:14020, n:'CUASIDELITO VEHÍCULO MOTORIZADO LEY TRÁNSITO'},
  // VIF
  {c:22100, n:'MALTRATO HABITUAL VIF. ART. 14 LEY 20.066'},
  {c:22101, n:'INCUMPLIMIENTO REITERADO PAGO PENSIÓN ALIMENTOS. ART. 14 BIS LEY 20.066'},
  // OTROS FRECUENTES
  {c:101, n:'QUEBRANTAMIENTO. ART. 90'},
  {c:512, n:'CONNIVENCIA FUGA Y EVASIÓN CULPABLE DETENIDO. ART. 299 A 304'},
  {c:816, n:'ESTAFAS Y OTRAS DEFRAUDACIONES CONTRA PARTICULARES'},
  {c:806, n:'EXTORSIÓN. ART. 438'},
  {c:840, n:'DAÑOS SIMPLES. ART. 487'},
  {c:841, n:'DAÑOS CALIFICADOS. ART. 485 Y 486'},
  {c:12149, n:'DESACATO. ART. 240 CÓDIGO DE PROCEDIMIENTO CIVIL'},
  {c:501, n:'DESÓRDENES PÚBLICOS. ART. 269'},
  {c:552, n:'ASOCIACIÓN ILÍCITA PARA SIMPLES DELITOS. ART. 293'},
  {c:553, n:'ASOCIACIÓN ILÍCITA PARA CRÍMENES. ART. 293'},
  {c:16403, n:'ASOCIACIÓN ILÍCITA PARA COMERCIO ILEGAL. ART. 2 LEY 21.426'},
  {c:716, n:'INJURIA ACCIÓN PRIVADA. ART. 416 AL 420'},
  {c:715, n:'CALUMNIA ACCIÓN PRIVADA. ART. 412 AL 415'},
  {c:706, n:'AUXILIO AL SUICIDIO'},
  {c:604, n:'USURPACIÓN DE ESTADO CIVIL. ART. 354'},
  {c:509, n:'ABANDONO O MALTRATO ANIMAL. ART. 291 BIS'},
  {c:410, n:'COHECHO COMETIDO POR EMPLEADO PÚBLICO. ART. 248, 248 BIS Y 249'},
  {c:411, n:'COHECHO O SOBORNO COMETIDO POR PARTICULAR. ART. 250'},
  {c:406, n:'MALVERSACIÓN DE CAUDALES PÚBLICOS. ART. 233, 234, 235 Y 236'},
  {c:202, n:'SECUESTRO. ART. 141 INC. 1 Y 2'},
  {c:203, n:'SUSTRACCIÓN DE MENORES. ART. 142'},
]

// ─── COMPONENTE DROPDOWN CON BUSQUEDA ────────────────────────────────────────
function SearchableSelect({ value, onChange, options, placeholder, isDelito }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 40)
    const q = query.toUpperCase()
    return options.filter(o => {
      const text = isDelito ? o.n : o
      return text.toUpperCase().includes(q)
    }).slice(0, 40)
  }, [query, options, isDelito])

  const displayValue = value
    ? (isDelito
        ? (options.find(o => o.n === value)?.n || value)
        : value)
    : ''

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => { setOpen(!open); setQuery('') }}
        style={{
          padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, color: value ? '#1E293B' : '#94a3b8', background: '#fff',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', minHeight: 38, fontFamily: "'Inter',sans-serif",
          transition: 'border-color 0.2s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {displayValue || placeholder}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.14)', marginTop: 4, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: '100%', padding: '6px 10px', border: '1.5px solid #e2e8f0',
                borderRadius: 7, fontSize: 12, outline: 'none',
                fontFamily: "'Inter',sans-serif",
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {value && (
              <div
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', borderBottom: '1px solid #F8F9FC', fontFamily: "'Inter',sans-serif" }}
              >
                — Limpiar selección
              </div>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: '#94a3b8', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
                Sin resultados para "{query}"
              </div>
            )}
            {filtered.map((opt, i) => {
              const label = isDelito ? opt.n : opt
              const isSelected = isDelito ? value === opt.n : value === opt
              return (
                <div
                  key={i}
                  onClick={() => { onChange(isDelito ? opt.n : opt); setOpen(false); setQuery('') }}
                  style={{
                    padding: '9px 12px', fontSize: 12, cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1E293B' : '#374151',
                    fontWeight: isSelected ? 600 : 400,
                    borderBottom: '1px solid #F8F9FC',
                    fontFamily: "'Inter',sans-serif",
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8faff' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {isDelito && <span style={{ color: '#94a3b8', fontSize: 10, flexShrink: 0, marginTop: 1 }}>#{opt.c}</span>}
                  <span>{label}</span>
                </div>
              )
            })}
            {filtered.length === 40 && (
              <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
                Escribe para filtrar más resultados...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


const TMAP = {'JG VINA DEL MAR':'JG VIÑA DEL MAR','JG CONCEPCION':'JG CONCEPCIÓN','JG VALPARAISO':'JG VALPARAÍSO','JG QUILPUE':'JG QUILPUÉ','JG CHILLAN':'JG CHILLÁN','JG AYSEN':'JG AYSÉN','JG CANETE':'JG CAÑETE','TOP CANETE':'TOP CAÑETE','13 JG DE STGO':'13 JG STGO','TOP SERENA':'TOP LA SERENA'}
const normT = t => t ? (TMAP[t.trim()] || t.trim()) : t
const f = { fontFamily:"'Inter',sans-serif" }

// ─── SEMÁFORO MEJORADO — solo causas vigentes ─────────────────────────────────
const getSemaforo = (updated_at, estado) => {
  if (estado !== 'vigente') return null
  if (!updated_at) return {
    color: '#991b1b', bg: '#fef2f2', border: '#fecaca',
    label: 'SIN ACTIVIDAD', dias: null, pulsar: true
  }
  const dias = Math.floor((new Date() - new Date(updated_at)) / (1000*60*60*24))
  if (dias <= 2) return {
    color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7',
    label: dias === 0 ? 'HOY' : dias === 1 ? 'AYER' : `HACE ${dias} DÍAS`,
    dias, pulsar: false
  }
  if (dias <= 6) return {
    color: '#92400e', bg: '#fff7ed', border: '#fed7aa',
    label: `HACE ${dias} DÍAS`,
    dias, pulsar: false
  }
  return {
    color: '#991b1b', bg: '#fef2f2', border: '#fecaca',
    label: `${dias} DÍAS SIN REVISAR`,
    dias, pulsar: true
  }
}

function SemaforoTag({ updated_at, estado }) {
  const s = getSemaforo(updated_at, estado)
  if (!s) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: 20, padding: '3px 10px',
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: s.color, flexShrink: 0, display: 'inline-block',
        animation: s.pulsar ? 'semaforo-pulse 1.5s infinite' : 'none',
        boxShadow: `0 0 6px ${s.color}88`
      }}/>
      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: 0.5, ...f }}>
        {s.label}
      </span>
    </div>
  )
}

function Badge({ estado, subestado }) {
  const c = getBadgeConfig(estado, subestado)
  const sub = subestado && estadoConfig[subestado]
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', gap:3, alignItems:'flex-start' }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color: estado==='terminada'?'#475569':'#065f46', background: estado==='terminada'?'#F8F9FC':'#ecfdf5', border: `1px solid ${estado==='terminada'?'#e2e8f0':'#a7f3d0'}`, ...f }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background: estado==='terminada'?'#475569':'#065f46', flexShrink:0 }}/>{estado==='terminada'?'TERMINADA':'VIGENTE'}
      </span>
      {sub && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:c.color, background:c.bg, border:`1px solid ${c.border}`, ...f }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:c.color, flexShrink:0 }}/>{c.label}
        </span>
      )}
    </div>
  )
}

// Badge clickeable para el header de la causa
function BadgeEditor({ estado, subestado, onChangeEstado, onChangeSubestado }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const subestados = estado === 'vigente' ? SUBESTADOS_VIGENTE : SUBESTADOS_TERMINADA
  const c = subestado && estadoConfig[subestado]
  const eColor = estado === 'terminada' ? '#475569' : '#065f46'
  const eBg = estado === 'terminada' ? '#F8F9FC' : '#ecfdf5'
  const eBorder = estado === 'terminada' ? '#e2e8f0' : '#a7f3d0'

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex', flexDirection:'column', gap:3, alignItems:'flex-start' }}>
      {/* Badge principal clickeable */}
      <span onClick={()=>setOpen(!open)} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:eColor, background:eBg, border:`1.5px solid ${eBorder}`, cursor:'pointer', userSelect:'none', ...f }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:eColor, flexShrink:0 }}/>
        {estado==='terminada'?'TERMINADA':'VIGENTE'}
        <span style={{ fontSize:9, opacity:0.6 }}>▼</span>
      </span>
      {c && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:c.color, background:c.bg, border:`1px solid ${c.border}`, ...f }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:c.color, flexShrink:0 }}/>{c.label}
        </span>
      )}
      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'100%', right:0, zIndex:500, background:'#fff', border:'1.5px solid #bfdbfe', borderRadius:12, boxShadow:'0 8px 24px rgba(15,23,42,0.14)', marginTop:6, minWidth:220, overflow:'hidden' }}>
          {/* Cambiar estado principal */}
          <div style={{ padding:'8px 12px', fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, borderBottom:'1px solid #f1f5f9', ...f }}>Estado principal</div>
          {['vigente','terminada'].map(e => (
            <div key={e} onClick={()=>{ onChangeEstado(e); setOpen(false) }}
              style={{ padding:'9px 14px', fontSize:12, fontWeight: estado===e?700:400, color: estado===e?'#1E293B':'#374151', background: estado===e?'#eff6ff':'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:8, ...f }}
              onMouseEnter={ev=>{ if(estado!==e) ev.currentTarget.style.background='#f8faff' }}
              onMouseLeave={ev=>{ if(estado!==e) ev.currentTarget.style.background='transparent' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background: e==='vigente'?'#065f46':'#475569', flexShrink:0 }}/>
              {e==='vigente'?'VIGENTE':'TERMINADA'}
              {estado===e && <span style={{ marginLeft:'auto', color:'#1E293B' }}>✓</span>}
            </div>
          ))}
          {/* Subestados */}
          <div style={{ padding:'8px 12px', fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, borderTop:'1px solid #f1f5f9', borderBottom:'1px solid #f1f5f9', ...f }}>Subestado</div>
          <div onClick={()=>{ onChangeSubestado(null); setOpen(false) }}
            style={{ padding:'8px 14px', fontSize:12, color:'#94a3b8', cursor:'pointer', fontStyle:'italic', ...f }}
            onMouseEnter={ev=>ev.currentTarget.style.background='#f8faff'}
            onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
            Sin subestado
          </div>
          {subestados.map(s => {
            const sc = estadoConfig[s]
            return (
              <div key={s} onClick={()=>{ onChangeSubestado(s); setOpen(false) }}
                style={{ padding:'9px 14px', fontSize:12, fontWeight: subestado===s?700:400, color: subestado===s?sc.color:'#374151', background: subestado===s?sc.bg:'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:8, ...f }}
                onMouseEnter={ev=>{ if(subestado!==s) ev.currentTarget.style.background='#f8faff' }}
                onMouseLeave={ev=>{ if(subestado!==s) ev.currentTarget.style.background='transparent' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:sc.color, flexShrink:0 }}/>
                {sc.label}
                {subestado===s && <span style={{ marginLeft:'auto', color:sc.color }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, editable, editField, setEditField, editValue, setEditValue, onSave, full, fieldKey }) {
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }
  const isTribunal = fieldKey === 'tribunal'
  const isDelito = fieldKey === 'delito'
  const useDropdown = isTribunal || isDelito

  return (
    <div style={{ gridColumn:full?'1/-1':'auto', marginBottom:2 }}>
      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:600, ...f }}>{label}</div>
      {editField===label ? (
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          {useDropdown ? (
            <div style={{ flex:1 }}>
              <SearchableSelect
                value={editValue}
                onChange={v => { setEditValue(v); }}
                options={isTribunal ? TRIBUNALES_CHILE : DELITOS_CATALOGO}
                placeholder={isTribunal ? 'Seleccionar tribunal...' : 'Buscar delito...'}
                isDelito={isDelito}
              />
            </div>
          ) : (
            <input style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onSave();if(e.key==='Escape')setEditField(null)}} autoFocus/>
          )}
          <button className="btn-primary" style={{padding:'8px 14px',fontSize:12,flexShrink:0}} onClick={onSave}>✓</button>
          <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12,flexShrink:0}} onClick={()=>setEditField(null)}>✗</button>
        </div>
      ) : (
        <div className={editable?'fld':''} onClick={()=>{if(editable){setEditField(label);setEditValue(value||'')}}}
          style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:value?'#1E293B':'#cbd5e1', minHeight:38, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:editable?'pointer':'default', background:'#fff', ...f }}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{value||(editable?'Clic para agregar...':'—')}</span>
          {editable && <span style={{fontSize:11,color:'#cbd5e1',flexShrink:0,marginLeft:8}}>✏</span>}
        </div>
      )}
    </div>
  )
}

function AudienciaCard({ a, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [form, setForm] = useState({ fecha:a.fecha||'', hora:a.hora||'', tipo:a.tipo||'', resultado:a.resultado||'', tribunal:a.tribunal||'', sala:a.sala||'' })
  const [saving, setSaving] = useState(false)
  const f = { fontFamily:"'Inter',sans-serif" }
  const inp = { width:'100%', padding:'7px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:12, color:'#1E293B', background:'#fff', ...f }

  const tipoColor = (tipo) => {
    const t = (tipo||'').toUpperCase()
    if (t.includes('JUICIO ORAL')||t==='JO') return '#e11d48'
    if (t.includes('ABREVIADO')) return '#2563eb'
    if (t.includes('APJO')) return '#7c3aed'
    if (t.includes('REV PP')||t.includes('REVPP')) return '#ea580c'
    if (t.includes('AUMENTO')||t.includes('CIERRE')) return '#16a34a'
    if (t.includes('ENTREVISTA')||t.includes('DECLARACION')) return '#ca8a04'
    return '#475569'
  }

  const handleSave = async () => {
    if (!motivo.trim()) { alert('Ingresa el motivo de la modificación'); return }
    setSaving(true)
    await onUpdate(form, motivo)
    setEditing(false)
    setSaving(false)
  }

  const color = tipoColor(a.tipo)
  const historial = (a.notas||'').split('\n').filter(l=>l.startsWith('['))
  const notasLimpias = (a.notas||'').split('\n').filter(l=>!l.startsWith('[')).join('\n')

  if (editing) return (
    <div style={{background:'#f0f7ff',border:'1.5px solid #2563eb',borderRadius:12,padding:16,marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:'#2563eb',marginBottom:12,...f}}>✏ Editar audiencia</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',type:'text'},{key:'resultado',label:'Resultado',type:'text'},{key:'tribunal',label:'Tribunal',type:'text'},{key:'sala',label:'Sala',type:'text'}].map(field=>(
          <div key={field.key}>
            <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>{field.label}</div>
            <input type={field.type} style={inp} value={form[field.key]} onChange={e=>setForm(p=>({...p,[field.key]:e.target.value}))}/>
          </div>
        ))}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:700,...f}}>Motivo de la modificación *</div>
        <input style={{...inp,borderColor:'#fecaca'}} placeholder="Ej: Error en la hora, reprogramación por el tribunal..." value={motivo} onChange={e=>setMotivo(e.target.value)}/>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn-primary" style={{fontSize:12,padding:'7px 16px'}} onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
        <button className="btn-secondary" style={{fontSize:12,padding:'7px 14px'}} onClick={()=>setEditing(false)}>Cancelar</button>
      </div>
    </div>
  )

  return (
    <div style={{background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>{a.tipo||'Audiencia'}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11,color:'#94a3b8',fontWeight:500,...f}}>{a.fecha}{a.hora?' · '+a.hora:''}</span>
          <button onClick={()=>setEditing(true)} style={{background:'transparent',border:'1px solid #e2e8f0',borderRadius:6,padding:'3px 8px',fontSize:10,color:'#94a3b8',cursor:'pointer',fontWeight:500,...f}}>✏ Editar</button>
        </div>
      </div>
      {a.tribunal&&<div style={{fontSize:12,color:'#64748b',marginBottom:2,...f}}>🏛 {a.tribunal}{a.sala?' · Sala '+a.sala:''}</div>}
      {a.resultado&&<div style={{fontSize:12,color:'#475569',marginTop:4,...f}}>Resultado: {a.resultado}</div>}
      {notasLimpias&&<div style={{fontSize:12,color:'#94a3b8',marginTop:3,...f}}>{notasLimpias}</div>}
      {a.ruc&&<div style={{fontSize:10,color:'#cbd5e1',marginTop:4,fontFamily:'monospace'}}>RUC: {a.ruc}</div>}
      {historial.length>0&&(
        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #f1f5f9'}}>
          {historial.map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',marginBottom:2,...f}}>📝 {h}</div>)}
        </div>
      )}
    </div>
  )
}

function ImputadoCard({ imp, idx, onUpdate, onDelete }) {
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const f = { fontFamily:"'Inter',sans-serif" }
  const inp = { width:'100%', padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }

  const normRut = (r) => (r||'').replace(/[.\-\s]/g,'').toUpperCase()

  const buscarPorRut = async (rut) => {
    if (!rut || rut.length < 6) return
    const rutNorm = normRut(rut)
    const { data, error } = await supabase.from('imputados').select('*').limit(500)
    if (error || !data || data.length === 0) return
    // Filtrar todos los que tienen ese RUT
    const coincidencias = data.filter(d => d.rut && normRut(d.rut) === rutNorm)
    if (coincidencias.length === 0) return
    // Tomar el más completo (más campos llenos)
    const campos = ['nombre','nacionalidad','domicilio','fecha_nacimiento','otros_antecedentes']
    const masCompleto = coincidencias.reduce((mejor, actual) => {
      const puntajeMejor = campos.filter(c => mejor[c] && mejor[c].trim()).length
      const puntajeActual = campos.filter(c => actual[c] && actual[c].trim()).length
      return puntajeActual > puntajeMejor ? actual : mejor
    })
    // Rellenar campos vacíos con los datos más completos
    for (const campo of campos) {
      if (masCompleto[campo] && masCompleto[campo].trim() && (!imp[campo] || imp[campo].trim() === '')) {
        onUpdate(campo, masCompleto[campo])
      }
    }
  }

  const sincronizarRutEnTodasLasCausas = async (campo, valor, rut) => {
    if (!rut || rut.length < 6) return
    const rutNorm = normRut(rut)
    // Obtener todos los imputados con ese RUT
    const { data } = await supabase.from('imputados').select('id, rut').limit(500)
    if (!data) return
    const mismoRut = data.filter(d => d.rut && normRut(d.rut) === rutNorm && d.id !== imp.id)
    // Actualizar en paralelo
    await Promise.all(mismoRut.map(d =>
      supabase.from('imputados').update({ [campo]: valor }).eq('id', d.id)
    ))
  }

  const Field2 = ({ label, field }) => (
    <div>
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>{label}</div>
      {editField===field?(
        <div style={{display:'flex',gap:6}}>
          <input
            style={inp}
            value={editValue}
            onChange={e=>setEditValue(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'){onUpdate(field,editValue);setEditField(null);if(field==='rut')buscarPorRut(editValue)}if(e.key==='Escape')setEditField(null)}}
            onBlur={()=>{ if(field==='rut' && editValue) buscarPorRut(editValue) }}
            autoFocus/>
          <button style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{onUpdate(field,editValue);setEditField(null);if(field==='rut')buscarPorRut(editValue)}}>✓</button>
          <button style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,cursor:'pointer',...f}} onClick={()=>setEditField(null)}>✗</button>
        </div>
      ):(
        <div onClick={()=>{setEditField(field);setEditValue(imp[field]||'')}}
          style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp[field]?'#1E293B':'#cbd5e1',minHeight:36,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
          <span>{imp[field]||'Clic para agregar...'}</span>
          <span style={{fontSize:11,color:'#cbd5e1'}}>✏</span>
        </div>
      )}
    </div>
  )

  return (
    <div style={{background:'#F8F9FC',border:'1.5px solid #e2e8f0',borderRadius:14,padding:'18px 20px',marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700,...f}}>{idx+1}</div>
          <div style={{fontSize:14,fontWeight:700,color:'#1E293B',...f}}>{imp.nombre||'Sin nombre'}</div>
        </div>
        <button onClick={onDelete} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'5px 12px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,...f}}>✕ Eliminar</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Field2 label="Nombre completo" field="nombre"/>
        <Field2 label="RUT" field="rut"/>
        <Field2 label="Nacionalidad" field="nacionalidad"/>
        <div>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>Fecha de nacimiento</div>
          {editField==='fecha_nacimiento'?(
            <div style={{display:'flex',gap:6}}>
              <input type="date" style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){onUpdate('fecha_nacimiento',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
              <button style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{onUpdate('fecha_nacimiento',editValue);setEditField(null)}}>✓</button>
              <button style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,cursor:'pointer',...f}} onClick={()=>setEditField(null)}>✗</button>
            </div>
          ):(
            <div onClick={()=>{setEditField('fecha_nacimiento');setEditValue(imp.fecha_nacimiento||'')}}
              style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.fecha_nacimiento?'#1E293B':'#cbd5e1',minHeight:36,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
              <span>
                {imp.fecha_nacimiento || 'Clic para agregar...'}
                {imp.fecha_nacimiento && (() => {
                  const edad = calcularEdadActual(imp.fecha_nacimiento)
                  return edad !== null ? <span style={{marginLeft:8,fontSize:11,color:'#1E293B',fontWeight:600,background:'#eff6ff',padding:'1px 7px',borderRadius:10}}>
                    {edad} AÑOS HOY
                  </span> : null
                })()}
              </span>
              <span style={{fontSize:11,color:'#cbd5e1'}}>✏</span>
            </div>
          )}
        </div>
        <Field2 label="Domicilio" field="domicilio" />
        <Field2 label="Otros antecedentes" field="otros_antecedentes"/>
      </div>
      {/* Régimen RPA / ADULTO */}
      {imp.regimen && (
        <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            display:'inline-flex',alignItems:'center',gap:6,
            padding:'5px 14px',borderRadius:20,fontWeight:700,fontSize:12,
            background: imp.regimen==='RPA' ? '#faf5ff' : '#eff6ff',
            border: `1.5px solid ${imp.regimen==='RPA' ? '#ddd6fe' : '#bfdbfe'}`,
            color: imp.regimen==='RPA' ? '#5b21b6' : '#1E293B',
            ...f
          }}>
            {imp.regimen==='RPA' ? 'RPA — LEY PENAL ADOLESCENTE' : 'ADULTO — CÓDIGO PROCESAL PENAL'}
          </div>
          <button onClick={()=>onUpdate('regimen', imp.regimen==='RPA'?'ADULTO':'RPA')}
            style={{fontSize:11,color:'#94a3b8',background:'transparent',border:'1px solid #e2e8f0',borderRadius:6,padding:'3px 8px',cursor:'pointer',...f}}>
            Cambiar
          </button>
        </div>
      )}
      <div style={{marginTop:14,background:imp.esta_detenido?'#fef2f2':'#f0fdf4',border:`1.5px solid ${imp.esta_detenido?'#fecaca':'#a7f3d0'}`,borderRadius:10,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:imp.esta_detenido?12:0}}>
          <div style={{fontSize:13,fontWeight:600,color:imp.esta_detenido?'#dc2626':'#059669',...f}}>{imp.esta_detenido?'🔒 Privado de libertad':'🔓 En libertad'}</div>
          <button onClick={()=>onUpdate('esta_detenido',!imp.esta_detenido)} style={{background:'#fff',border:`1.5px solid ${imp.esta_detenido?'#fecaca':'#a7f3d0'}`,borderRadius:7,padding:'5px 14px',fontSize:11,cursor:'pointer',fontWeight:600,color:imp.esta_detenido?'#dc2626':'#059669',...f}}>
            {imp.esta_detenido?'Marcar liberado':'Marcar detenido'}
          </button>
        </div>
        {imp.esta_detenido&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8}}>
            <Field2 label="Recinto penitenciario" field="lugar_detencion"/>
            <Field2 label="Fecha de detención" field="fecha_detencion"/>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TEORÍA DEL CASO ──────────────────────────────────────────────────────────
const TC_SECCIONES = [
  { key:'hechos',        icon:'📋', label:'Hechos del caso',       placeholder:'Describe los hechos relevantes: lugar, fecha, circunstancias, cronología de los eventos...' },
  { key:'teoria_defensa',icon:'⚖️',  label:'Teoría y Defensa',      placeholder:'Calificación jurídica, tipo penal, elementos del delito, circunstancias modificatorias, estrategia de defensa, alegaciones, excepciones, jurisprudencia aplicable...' },
  { key:'prueba',        icon:'🔍', label:'Prueba y testigos',      placeholder:'Lista de testigos, peritos, documentos, evidencias materiales, cadena de custodia...' },
  { key:'fallos',        icon:'📄', label:'Fallos de referencia',   placeholder:null },
  { key:'observaciones', icon:'📝', label:'Observaciones',          placeholder:'Notas de seguimiento, criterios del tribunal, pendientes...' },
]

function FallosReferencia({ causaId, ruc, email, onAccion }) {
  const [fallos, setFallos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { cargarFallos() }, [causaId])

  const cargarFallos = async () => {
    const { data } = await supabase.from('fallos_referencia').select('*').eq('causa_id', causaId).order('created_at', { ascending: false })
    setFallos(data || [])
  }

  const subirArchivo = async (file) => {
    if (!file || file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF'); return }
    setSubiendo(true)
    const path = `${causaId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('fallos').upload(path, file, { contentType: 'application/pdf' })
    if (uploadError) { alert('Error al subir: ' + uploadError.message); setSubiendo(false); return }
    const { data: urlData } = supabase.storage.from('fallos').getPublicUrl(path)
    await supabase.from('fallos_referencia').insert({ causa_id: causaId, nombre: file.name, storage_path: path, url: urlData.publicUrl, subido_por: email })
    await cargarFallos()
    if (onAccion) onAccion() // ✅ actualiza semáforo
    setSubiendo(false)
  }

  const eliminar = async (fallo) => {
    if (!window.confirm(`¿Eliminar "${fallo.nombre}"?`)) return
    await supabase.storage.from('fallos').remove([fallo.storage_path])
    await supabase.from('fallos_referencia').delete().eq('id', fallo.id)
    setFallos(prev => prev.filter(f => f.id !== fallo.id))
    if (onAccion) onAccion() // ✅ actualiza semáforo
  }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => subirArchivo(f))
  }

  return (
    <div>
      <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${drag ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center', background: drag ? '#eff6ff' : '#F8F9FC', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 }}>
        <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display:'none' }} onChange={e => Array.from(e.target.files).forEach(f => subirArchivo(f))}/>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{subiendo ? '⏳' : '📄'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: drag ? '#2563eb' : '#475569', ...f }}>{subiendo ? 'Subiendo...' : drag ? 'Suelta aquí el fallo' : 'Arrastra fallos PDF aquí'}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, ...f }}>o haz clic para seleccionar desde tu carpeta de descargas</div>
      </div>
      {fallos.length === 0 ? (
        <div style={{ fontSize: 13, color: '#cbd5e1', textAlign: 'center', padding: '12px 0', ...f }}>Sin fallos de referencia aún.</div>
      ) : fallos.map((fallo, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📄</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1E293B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', ...f }}>{fallo.nombre}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>Subido por {fallo.subido_por || 'usuario'} · {new Date(fallo.created_at).toLocaleDateString('es-CL')}</div>
          </div>
          <a href={fallo.url} target="_blank" rel="noreferrer" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, padding:'5px 12px', fontSize:11, color:'#2563eb', cursor:'pointer', fontWeight:600, textDecoration:'none', ...f }}>Ver PDF</a>
          <button onClick={() => eliminar(fallo)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, padding:'5px 10px', fontSize:11, color:'#dc2626', cursor:'pointer', fontWeight:600, ...f }}>✕</button>
        </div>
      ))}
    </div>
  )
}

function TeoriaDelCaso({ causaId, ruc, session, registrarActividad, onAccion }) {
  const [teoria, setTeoria] = useState(null)
  const [form, setForm] = useState({ hechos:'', teoria_defensa:'', prueba:'', observaciones:'' })
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [seccionActiva, setSeccionActiva] = useState('hechos')
  const [showHistorial, setShowHistorial] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { cargar() }, [causaId])

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('notas').select('*').eq('causa_id', causaId).eq('tipo', 'teoria_caso').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) {
      try { const parsed = JSON.parse(data.contenido); setForm(parsed.contenido || {}); setTeoria(data) }
      catch { setForm({ hechos: data.contenido || '', teoria_defensa:'', prueba:'', observaciones:'' }); setTeoria(data) }
    }
    const { data: hist } = await supabase.from('notas').select('*').eq('causa_id', causaId).eq('tipo', 'teoria_caso_historial').order('created_at', { ascending: false }).limit(20)
    setHistorial(hist || [])
    setLoading(false)
  }

  const guardar = useCallback(async (formData, esAutoguardado = false) => {
    setSaving(true)
    const email = session?.user?.email || 'usuario'
    const ahora = new Date()
    const contenidoJSON = JSON.stringify({ contenido: formData, version: ahora.toISOString() })
    if (teoria) {
      if (!esAutoguardado) {
        await supabase.from('notas').insert({ causa_id: causaId, tipo: 'teoria_caso_historial', contenido: JSON.stringify({ contenido: form, editor: email, fecha: ahora.toLocaleDateString('es-CL'), hora: ahora.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' }) }) })
      }
      await supabase.from('notas').update({ contenido: contenidoJSON, updated_at: ahora }).eq('id', teoria.id)
    } else {
      const { data } = await supabase.from('notas').insert({ causa_id: causaId, tipo: 'teoria_caso', contenido: contenidoJSON }).select().single()
      setTeoria(data)
    }
    if (!esAutoguardado) {
      if (registrarActividad) registrarActividad('accion', `Editó Teoría del Caso en RUC ${ruc}`)
      if (onAccion) onAccion() // ✅ actualiza semáforo
    }
    setSavedAt(ahora)
    setSaving(false)
    if (!esAutoguardado) await cargar()
  }, [causaId, teoria, form, session, ruc, registrarActividad, onAccion])

  const handleChange = (key, value) => {
    const nuevo = { ...form, [key]: value }
    setForm(nuevo)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => guardar(nuevo, true), 3000)
  }

  const seccionActual = TC_SECCIONES.find(s => s.key === seccionActiva)
  const totalCaracteres = Object.values(form).join('').length

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13, ...f }}>Cargando teoría del caso...</div>

  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:0, minHeight:500, border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
      <div style={{ background:'#1E293B', padding:'20px 0' }}>
        <div style={{ fontSize:9, color:'#93c5fd', textTransform:'uppercase', letterSpacing:2, fontWeight:700, padding:'0 16px 12px', ...f }}>Secciones</div>
        {TC_SECCIONES.map(s => {
          const tieneContenido = (form[s.key]||'').trim().length > 0
          return (
            <button key={s.key} onClick={() => setSeccionActiva(s.key)}
              style={{ width:'100%', textAlign:'left', padding:'10px 16px', background: seccionActiva===s.key ? 'rgba(147,197,253,0.15)' : 'transparent', border:'none', borderLeft: seccionActiva===s.key ? '3px solid #93c5fd' : '3px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all 0.2s ease' }}>
              <span style={{ fontSize:13, opacity: seccionActiva===s.key ? 1 : 0.6 }}>{s.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight: seccionActiva===s.key ? 600 : 400, color: seccionActiva===s.key ? '#fff' : '#93c5fd', ...f, lineHeight:1.3, textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
                {tieneContenido && <div style={{ width:5, height:5, borderRadius:'50%', background:'#93c5fd', marginTop:3 }}/>}
              </div>
            </button>
          )
        })}
        <div style={{ padding:'16px', marginTop:8, borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:9, color:'#93c5fd', textTransform:'uppercase', letterSpacing:1.5, fontWeight:700, marginBottom:8, ...f }}>Progreso</div>
          {TC_SECCIONES.map(s => {
            const pct = Math.min(100, Math.round(((form[s.key]||'').length / 200) * 100))
            return (
              <div key={s.key} style={{ marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontSize:9, color:'#475569', ...f }}>{s.icon}</span>
                  <span style={{ fontSize:9, color:'#93c5fd', ...f }}>{pct}%</span>
                </div>
                <div style={{ height:3, background:'rgba(255,255,255,0.1)', borderRadius:2 }}>
                  <div style={{ height:3, width:`${pct}%`, background: pct>0?'#2563eb':'transparent', borderRadius:2, transition:'width 0.3s' }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', background:'#fff' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafbff' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1E293B', ...f }}>{seccionActual?.icon} {seccionActual?.label}</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>
              {totalCaracteres > 0 ? `${totalCaracteres.toLocaleString()} caracteres` : 'Sin contenido aún'}
              {savedAt && <span style={{ marginLeft:8, color:'#a7f3d0' }}>✓ Guardado {savedAt.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowHistorial(!showHistorial)} style={{ background: showHistorial?'#1E293B':'#fff', color: showHistorial?'#fff':'#64748b', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500, ...f }}>
              🕐 Historial {historial.length > 0 && `(${historial.length})`}
            </button>
            <button onClick={() => guardar(form, false)} disabled={saving} style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:8, padding:'6px 16px', fontSize:12, cursor:'pointer', fontWeight:600, ...f }}>
              {saving ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </div>
        {showHistorial && (
          <div style={{ background:'#F8F9FC', borderBottom:'1px solid #e2e8f0', padding:'16px 20px', maxHeight:200, overflowY:'auto' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:1, marginBottom:10, ...f }}>Historial de modificaciones</div>
            {historial.length === 0 ? (
              <div style={{ fontSize:12, color:'#cbd5e1', ...f }}>Sin modificaciones registradas aún.</div>
            ) : historial.map((h, i) => {
              let info = {}
              try { info = JSON.parse(h.contenido) } catch {}
              return (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:700, flexShrink:0 }}>{(info.editor||'?')[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1E293B', ...f }}>{info.editor || 'Usuario'}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', ...f }}>{info.fecha} {info.hora}</div>
                  </div>
                  <span style={{ fontSize:10, color:'#94a3b8', background:'#f1f5f9', padding:'2px 8px', borderRadius:20, ...f }}>modificó</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="tc-section" style={{ flex:1, padding:'20px' }}>
          {seccionActiva === 'fallos' ? (
            <FallosReferencia causaId={causaId} ruc={ruc} email={session?.user?.email || ''} onAccion={onAccion} />
          ) : (
            <textarea value={form[seccionActiva] || ''} onChange={e => handleChange(seccionActiva, e.target.value)} placeholder={seccionActual?.placeholder}
              style={{ width:'100%', height:'100%', minHeight:360, border:'none', outline:'none', resize:'none', fontSize:14, lineHeight:1.8, color:'#1e293b', background:'transparent', fontFamily:"'Inter',sans-serif", padding:0 }}/>
          )}
        </div>
        <div style={{ padding:'10px 20px', borderTop:'1px solid #f1f5f9', display:'flex', gap:8, overflowX:'auto' }}>
          {TC_SECCIONES.map(s => (
            <button key={s.key} onClick={() => setSeccionActiva(s.key)}
              style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:`1.5px solid ${seccionActiva===s.key?'#2563eb':'#e2e8f0'}`, background: seccionActiva===s.key?'#eff6ff':'#fff', color: seccionActiva===s.key?'#2563eb':'#94a3b8', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap', ...f }}>
              {s.icon} {s.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── EDAD Y RÉGIMEN RPA/ADULTO ───────────────────────────────────────────────
function calcularEdadActual(fechaNac) {
  if (!fechaNac) return null
  const nac = new Date(fechaNac + 'T12:00:00')
  if (isNaN(nac)) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function calcularRegimenAlMomento(fechaNac, fechaHechos) {
  if (!fechaNac || !fechaHechos) return null
  const nac = new Date(fechaNac + 'T12:00:00')
  const hechos = new Date(fechaHechos + 'T12:00:00')
  if (isNaN(nac) || isNaN(hechos)) return null
  let edad = hechos.getFullYear() - nac.getFullYear()
  const m = hechos.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hechos.getDate() < nac.getDate())) edad--
  return edad < 18 ? 'RPA' : 'ADULTO'
}

function calcularVencimiento(fechaInicio, diasPlazo) {
  if (!fechaInicio || !diasPlazo) return ''
  const inicio = new Date(fechaInicio + 'T12:00:00')
  inicio.setDate(inicio.getDate() + parseInt(diasPlazo))
  return inicio.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function parseFechaCL(str) {
  if (!str) return null
  const limpio = str.replace(/VENCE\s*/i, '').trim()
  const partes = limpio.split(/[\/\-\.]/)
  if (partes.length < 3) return null
  const [d, m, a] = partes
  const fecha = new Date(`${a.length===2?'20'+a:a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
  return isNaN(fecha) ? null : fecha
}

function diasRestantes(plazoStr) {
  const fecha = parseFechaCL(plazoStr)
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  return Math.ceil((fecha - hoy) / (1000*60*60*24))
}

function calcularSubestado(plazoStr) {
  const diff = diasRestantes(plazoStr)
  if (diff === null) return null
  if (diff < 0) return 'vencido'
  if (diff <= 3) return 'proximo'
  return null
}

function PlazoCalculador({ causaId, plazoActual, aumentos, onGuardarAudiencia }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'' })
  const [guardando, setGuardando] = useState(false)
  const f = { fontFamily:"'Inter',sans-serif" }
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }

  const calcularVencimientoTotal = (auds) => {
    if (!auds || auds.length === 0) return null
    const sorted = [...auds].sort((a,b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia))
    const diasTotal = auds.reduce((s,a) => s + (parseInt(a.dias_plazo)||0), 0)
    return calcularVencimiento(sorted[0].fecha_audiencia, diasTotal)
  }

  const vencimientoPreview = form.fecha_audiencia && form.dias_plazo ? calcularVencimiento(form.fecha_audiencia, form.dias_plazo) : ''

  const handleGuardar = async () => {
    if (!form.fecha_audiencia || !form.dias_plazo) return
    setGuardando(true)
    await onGuardarAudiencia(form)
    setForm({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'' })
    setShowForm(false)
    setGuardando(false)
  }

  const diasTotal = aumentos ? aumentos.reduce((s,a) => s + (parseInt(a.dias_plazo)||0), 0) : 0
  const vencFinal = calcularVencimientoTotal(aumentos)
  const subestado = calcularSubestado(vencFinal)
  const diff = diasRestantes(vencFinal)

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#2563eb',letterSpacing:'-1px',...f}}>{aumentos?aumentos.length:0}</div>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Audiencias registradas</div>
        </div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#d97706',letterSpacing:'-1px',...f}}>{diasTotal}</div>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Días corridos totales</div>
        </div>
        <div style={{background:subestado==='vencido'?'#fef2f2':subestado==='proximo'?'#fffbeb':'#f0fdf4',border:`1.5px solid ${subestado==='vencido'?'#fecaca':subestado==='proximo'?'#fde68a':'#a7f3d0'}`,borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:800,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#059669',...f}}>{vencFinal || '—'}</div>
          {diff !== null && <div style={{fontSize:11,fontWeight:600,marginTop:4,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#64748b',...f}}>{subestado==='vencido' ? `Venció hace ${Math.abs(diff)} días` : subestado==='proximo' ? `⚠️ Vence en ${diff} días` : `Faltan ${diff} días`}</div>}
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:2,fontWeight:600,...f}}>Vencimiento</div>
        </div>
      </div>
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Historial de audiencias de plazo</div>
      {(!aumentos||aumentos.length===0) && <p style={{color:'#cbd5e1',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
      {aumentos && aumentos.map((a,i) => {
        const audsHasta = [...aumentos].sort((x,y)=>x.fecha_audiencia.localeCompare(y.fecha_audiencia)).slice(0,i+1)
        const diasAcum = audsHasta.reduce((s,x)=>s+(parseInt(x.dias_plazo)||0),0)
        const vencAcum = calcularVencimiento(audsHasta[0].fecha_audiencia, diasAcum)
        return (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8}}>
            <div style={{width:30,height:30,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>{a.tipo_audiencia||'Audiencia'}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2,...f}}>📅 {a.fecha_audiencia}</div>
              {a.observacion&&<div style={{fontSize:12,color:'#64748b',marginTop:2,...f}}>{a.observacion}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:16,fontWeight:800,color:'#2563eb',...f}}>+{a.dias_plazo}d</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2,...f}}>Vence: {vencAcum}</div>
              <div style={{fontSize:10,color:'#cbd5e1',...f}}>Acum. {diasAcum}d</div>
            </div>
          </div>
        )
      })}
      {showForm ? (
        <div style={{background:'#f0f7ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:16,marginTop:12}}>
          <div style={{fontSize:12,fontWeight:700,color:'#2563eb',marginBottom:12,...f}}>{aumentos && aumentos.length === 0 ? '📋 Registrar audiencia de formalización' : '📋 Registrar nueva audiencia de plazo'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tipo de audiencia</div><select style={inp} value={form.tipo_audiencia} onChange={e=>setForm(p=>({...p,tipo_audiencia:e.target.value}))}><option>Formalización</option><option>Control de detención + Formalización</option><option>Ampliación de plazo</option><option>Reapertura de investigación</option></select></div>
            <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de audiencia</div><input type="date" style={inp} value={form.fecha_audiencia} onChange={e=>setForm(p=>({...p,fecha_audiencia:e.target.value}))}/></div>
            <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días de plazo otorgados</div><input type="number" style={inp} placeholder="Ej: 30, 90, 210" value={form.dias_plazo} onChange={e=>setForm(p=>({...p,dias_plazo:e.target.value}))}/></div>
            <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Observación</div><input style={inp} placeholder="Ej: Diligencias pendientes" value={form.observacion} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}/></div>
          </div>
          {vencimientoPreview && <div style={{marginBottom:12,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #bfdbfe',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📅</span><div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento de este plazo</div><div style={{fontSize:15,fontWeight:800,color:'#2563eb',...f}}>{vencimientoPreview}</div></div></div>}
          <div style={{display:'flex',gap:8}}><button className="btn-primary" style={{fontSize:12}} onClick={handleGuardar} disabled={guardando||!form.fecha_audiencia||!form.dias_plazo}>{guardando?'Guardando...':'💾 Guardar audiencia'}</button><button className="btn-secondary" style={{fontSize:12}} onClick={()=>setShowForm(false)}>Cancelar</button></div>
        </div>
      ) : (
        <button className="btn-secondary" style={{marginTop:12}} onClick={()=>setShowForm(true)}>+ {aumentos && aumentos.length === 0 ? 'Registrar formalización' : 'Registrar nueva audiencia de plazo'}</button>
      )}
    </div>
  )
}

export default function Dashboard({ session, registrarActividad, causaInicial, onCausaInicialUsada }) {
  const [causas,setCausas]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterTribunal,setFilterTribunal]=useState('')
  const [filterEstado,setFilterEstado]=useState('')
  const [sortCol,setSortCol]=useState('created_at')
  const [sortDir,setSortDir]=useState('desc')
  const [view,setView]=useState('list')
  const [selectedCausa,setSelectedCausa]=useState(null)
  const [activeTab,setActiveTab]=useState('datos')
  const [editField,setEditField]=useState(null)
  const [editValue,setEditValue]=useState('')
  const [audiencias,setAudiencias]=useState([])
  const [aumentos,setAumentos]=useState([])
  const [imputados,setImputados]=useState([])
  const [showAudForm,setShowAudForm]=useState(false)
  const [nuevaAud,setNuevaAud]=useState({fecha:'',hora:'',tipo:'',tribunal:'',sala:'',resultado:'',notas:''})
  const [saving,setSaving]=useState(false)
  const [showNuevaCausa,setShowNuevaCausa]=useState(false)
  const [showStats,setShowStats]=useState(false)
  const [nuevaCausa,setNuevaCausa]=useState({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',imputado_rut:'',imputado_fecha_nac:'',imputado_domicilio:'',imputado_nacionalidad:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente'})
  const [rutBuscando,setRutBuscando]=useState(false)
  const [rutEncontrado,setRutEncontrado]=useState(null)

  useEffect(()=>{ loadCausas() },[])

  useEffect(() => {
    if (causaInicial) { openCausa(causaInicial); if (onCausaInicialUsada) onCausaInicialUsada() }
  }, [causaInicial])

  const loadCausas = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('causas').select('*').order('created_at', { ascending:false })
    if (!error) {
      const causasActualizadas = (data||[]).map(c => {
        const subestadosEspeciales = ['apjo','juicio_oral']
        let subestado = c.subestado
        if (c.estado === 'vigente' && !subestadosEspeciales.includes(c.subestado)) {
          const autoSub = calcularSubestado(c.plazo)
          if (autoSub !== 'vencido' && c.subestado === 'vencido') subestado = autoSub
          else if (autoSub) subestado = autoSub
        }
        return { ...c, tribunal: normT(c.tribunal), subestado }
      })
      setCausas(causasActualizadas)
    }
    setLoading(false)
  }

  const openCausa=async(c)=>{
    setSelectedCausa(c);setView('detail');setActiveTab('datos')
    const[{data:a},{data:au},{data:imp}]=await Promise.all([
      supabase.from('audiencias').select('*').or(`causa_id.eq.${c.id},ruc.eq.${c.ruc}`).order('fecha',{ascending:false}),
      supabase.from('aumentos_plazo').select('*').eq('causa_id',c.id).order('fecha_audiencia',{ascending:true}),
      supabase.from('imputados').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
    ])
    setAudiencias(a||[]);setAumentos(au||[]);setImputados(imp||[])
  }

  // ✅ Función central para marcar acción real — actualiza updated_at y semáforo
  const marcarAccion = useCallback(async (causaId) => {
    const ahora = new Date()
    await supabase.from('causas').update({ updated_at: ahora }).eq('id', causaId)
    setCausas(prev => prev.map(c => c.id === causaId ? { ...c, updated_at: ahora.toISOString() } : c))
    setSelectedCausa(prev => prev ? { ...prev, updated_at: ahora.toISOString() } : prev)
  }, [])

  const updateField=async(field,value)=>{
    const camposSinMayusculas = ['estado','subestado','tiene_top']
    if (typeof value === 'string' && !camposSinMayusculas.includes(field)) value = value.toUpperCase()
    // Autocorrección ortográfica en campos de texto
    const camposCorregir = ['delito','imputado','tribunal','fiscal','cautelar','centro_penal','plazo']
    if (camposCorregir.includes(field) && typeof value === 'string') {
      value = corregirOrtografia(value)
    }
    setSaving(true)
    const{error}=await supabase.from('causas').update({[field]:value,updated_at:new Date()}).eq('id',selectedCausa.id)
    if(!error){
      const u={...selectedCausa,[field]:value,updated_at:new Date().toISOString()}
      setSelectedCausa(u);setCausas(prev=>prev.map(c=>c.id===u.id?u:c))
      if (registrarActividad) registrarActividad('accion', `Editó campo "${field}" en RUC ${selectedCausa.ruc}`)
      // Al guardar fecha_hechos → recalcular régimen de cada imputado
      if (field === 'fecha_hechos') {
        const nuevosImputados = await Promise.all(imputados.map(async imp => {
          if (!imp.fecha_nacimiento || imp.regimen) return imp // No sobreescribir si ya tiene régimen
          const regAuto = calcularRegimenAlMomento(imp.fecha_nacimiento, value)
          if (regAuto) {
            await supabase.from('imputados').update({ regimen: regAuto }).eq('id', imp.id)
            return { ...imp, regimen: regAuto }
          }
          return imp
        }))
        setImputados(nuevosImputados)
      }
    }
    setEditField(null);setSaving(false)
  }

  const saveAudiencia=async()=>{
    if(!nuevaAud.fecha)return;setSaving(true)
    const upAud = {}
    Object.entries(nuevaAud).forEach(([k,v]) => { upAud[k] = (typeof v === 'string' && !['fecha','hora'].includes(k)) ? corregirOrtografia(v.toUpperCase()) : v })
    const{data,error}=await supabase.from('audiencias').insert({causa_id:selectedCausa.id,ruc:selectedCausa.ruc,imputado:selectedCausa.imputado?.split('|')[0],...upAud}).select().single()
    if(!error){
      setAudiencias(prev=>[data,...prev].sort((a,b)=>b.fecha.localeCompare(a.fecha)))
      if (registrarActividad) registrarActividad('accion', `Nueva audiencia en RUC ${selectedCausa.ruc}: ${nuevaAud.tipo||'Audiencia'} ${nuevaAud.fecha}`)
      await marcarAccion(selectedCausa.id) // ✅ actualiza semáforo
    }
    setNuevaAud({fecha:'',hora:'',tipo:'',tribunal:selectedCausa?.tribunal||'',sala:'',resultado:'',notas:''});setShowAudForm(false);setSaving(false)
  }

  const buscarRutNuevaCausa = async (rut) => {
    if (!rut || rut.length < 6) return
    setRutBuscando(true)
    const rutNorm = rut.replace(/[.\-\s]/g,'').toUpperCase()
    const { data } = await supabase.from('imputados').select('*').limit(500)
    setRutBuscando(false)
    if (!data) return
    const coincidencias = data.filter(d => d.rut && d.rut.replace(/[.\-\s]/g,'').toUpperCase() === rutNorm)
    if (coincidencias.length === 0) { setRutEncontrado(null); return }
    // Tomar el más completo
    const campos = ['nombre','nacionalidad','domicilio','fecha_nacimiento']
    const masCompleto = coincidencias.reduce((mejor, actual) => {
      const pMejor = campos.filter(c => mejor[c] && mejor[c].trim()).length
      const pActual = campos.filter(c => actual[c] && actual[c].trim()).length
      return pActual > pMejor ? actual : mejor
    })
    setRutEncontrado(masCompleto)
    // Autorrellenar campos
    setNuevaCausa(p => ({
      ...p,
      imputado: masCompleto.nombre || p.imputado,
      imputado_rut: rut,
      imputado_fecha_nac: masCompleto.fecha_nacimiento || p.imputado_fecha_nac,
      imputado_domicilio: masCompleto.domicilio || p.imputado_domicilio,
      imputado_nacionalidad: masCompleto.nacionalidad || p.imputado_nacionalidad,
    }))
  }

  const saveCausa = async () => {
    if (!nuevaCausa.ruc) return
    // Autocorrección ortográfica antes de guardar
    setSaving(true)
    let plazoFinal = nuevaCausa.plazo
    if (nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo) plazoFinal = 'VENCE ' + calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)
    const subestadoAuto = calcularSubestado(plazoFinal)
    const up = (v) => typeof v === 'string' ? corregirOrtografia(v.toUpperCase()) : v
    const causaData = { ruc:up(nuevaCausa.ruc), rit:up(nuevaCausa.rit), tribunal:up(nuevaCausa.tribunal), delito:up(nuevaCausa.delito), imputado:up(nuevaCausa.imputado), fiscal:up(nuevaCausa.fiscal), cautelar:up(nuevaCausa.cautelar), centro_penal:up(nuevaCausa.centro_penal), plazo:up(plazoFinal), estado:nuevaCausa.estado, subestado:subestadoAuto, fecha_hechos: nuevaCausa.fecha_hechos || null }
    const { data, error } = await supabase.from('causas').insert(causaData).select().single()
    if (!error) {
      // Crear imputado automáticamente con los datos del RUT
      if (nuevaCausa.imputado_rut || nuevaCausa.imputado) {
        const regAuto = (nuevaCausa.imputado_fecha_nac && nuevaCausa.fecha_hechos)
          ? calcularRegimenAlMomento(nuevaCausa.imputado_fecha_nac, nuevaCausa.fecha_hechos)
          : null
        await supabase.from('imputados').insert({
          causa_id: data.id,
          nombre: up(nuevaCausa.imputado) || '',
          rut: nuevaCausa.imputado_rut || '',
          fecha_nacimiento: nuevaCausa.imputado_fecha_nac || null,
          domicilio: up(nuevaCausa.imputado_domicilio) || '',
          nacionalidad: up(nuevaCausa.imputado_nacionalidad) || '',
          regimen: regAuto || 'ADULTO',
        })
      }
      setCausas(prev => [data, ...prev])
      setShowNuevaCausa(false)
      setRutEncontrado(null)
      if (registrarActividad) registrarActividad('accion', `Nueva causa: RUC ${causaData.ruc}`)
      setNuevaCausa({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',imputado_rut:'',imputado_fecha_nac:'',imputado_domicilio:'',imputado_nacionalidad:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente'})
    }
    setSaving(false)
  }

  const handleSort=col=>{if(sortCol===col)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(col);setSortDir('asc')}}
  const tribunales=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
  const filtered=useMemo(()=>{
    let list=causas.filter(c=>{
      const s=search.toLowerCase()
      const match=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v?.toLowerCase().includes(s))
      const estadoMatch=!filterEstado||(filterEstado==='vigente'?c.estado==='vigente':filterEstado==='terminada'?c.estado==='terminada':filterEstado==='top'?(c.subestado==='juicio_oral'||c.tiene_top===true):c.subestado===filterEstado)
      return match&&(!filterTribunal||c.tribunal===filterTribunal)&&estadoMatch
    })
    return[...list].sort((a,b)=>{const av=a[sortCol]||'',bv=b[sortCol]||'';return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av)})
  },[causas,search,filterTribunal,filterEstado,sortCol,sortDir])

  const stats=useMemo(()=>({
    total:causas.length, vigente:causas.filter(c=>c.estado==='vigente').length, terminada:causas.filter(c=>c.estado==='terminada').length,
    vencido:causas.filter(c=>c.subestado==='vencido').length, proximo:causas.filter(c=>c.subestado==='proximo').length,
    apjo:causas.filter(c=>c.subestado==='apjo').length, juicioOral:causas.filter(c=>c.subestado==='juicio_oral'||c.tiene_top===true).length,
  }),[causas])

  const chartDelitos=useMemo(()=>{const map={};causas.forEach(c=>{if(c.delito){const k=c.delito.substring(0,28);map[k]=(map[k]||0)+1}});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,value])=>({name,value}))},[causas])
  const chartTribunales=useMemo(()=>{const map={};causas.forEach(c=>{if(c.tribunal){map[c.tribunal]=(map[c.tribunal]||0)+1}});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}))},[causas])
  const COLORS=['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777','#65a30d','#ea580c','#6366f1']
  const inp={width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}

  if(view==='detail'&&selectedCausa){
    const c=causas.find(x=>x.id===selectedCausa.id)||selectedCausa
    return(
      <div style={{background:'#F8F9FC',minHeight:'100vh',...f}} className="detail-enter">
        <style>{CSS}</style>
        <div style={{maxWidth:1060,margin:'0 auto',padding:'24px 28px'}}>
          <button className="btn-secondary" onClick={()=>setView('list')} style={{marginBottom:20,fontSize:13}}>← Volver</button>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px 16px 0 0',padding:'24px 28px',boxShadow:'0 1px 4px rgba(15,23,42,0.05)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:'#1E293B',marginBottom:6,letterSpacing:'-0.5px',...f}}>RUC <span style={{color:'#1E293B'}}>{c.ruc}</span></div>
                <div style={{fontSize:13,color:'#94a3b8',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',...f}}>
                  <span>RIT <span style={{color:'#475569',fontWeight:500}}>{c.rit||'—'}</span></span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.tribunal}</span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.imputado}</span>
                  <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                  {imputados.filter(i=>i.regimen).map(i=>(
                    <span key={i.id} style={{
                      fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,
                      background:i.regimen==='RPA'?'#faf5ff':'#eff6ff',
                      color:i.regimen==='RPA'?'#5b21b6':'#1E293B',
                      border:`1px solid ${i.regimen==='RPA'?'#ddd6fe':'#bfdbfe'}`,...f
                    }}>{i.regimen}</span>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saving&&<span style={{fontSize:11,color:'#94a3b8',...f}}>Guardando...</span>}
                {c.esta_detenido&&<span style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',...f}}>🔒 Detenido</span>}
                <BadgeEditor
                  estado={c.estado}
                  subestado={c.subestado}
                  onChangeEstado={(e)=>updateField('estado',e)}
                  onChangeSubestado={(s)=>updateField('subestado',s||null)}
                />
              </div>
            </div>
          </div>
          <div style={{background:'#fff',borderLeft:'1px solid #e2e8f0',borderRight:'1px solid #e2e8f0',display:'flex',overflowX:'auto',borderBottom:'2px solid #f1f5f9'}}>
            {[['datos','Datos'],['imputado','Imputado'],['plazo','Plazo'],['audiencias','Audiencias'],['top','Juicio Oral'],['teoria','⚖️ Teoría del Caso'],['carpeta','Carpeta']].map(([k,l])=>(
              <button key={k} className="tab-btn" onClick={()=>setActiveTab(k)} style={{padding:'13px 20px',fontSize:13,fontWeight:activeTab===k?600:400,color:activeTab===k?'#2563eb':'#94a3b8',borderBottom:`2px solid ${activeTab===k?'#2563eb':'transparent'}`,whiteSpace:'nowrap',marginBottom:-2}}>{l}</button>
            ))}
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderTop:'none',borderRadius:'0 0 16px 16px',padding:28,boxShadow:'0 2px 8px rgba(15,23,42,0.05)'}}>
            {activeTab==='datos'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {[{key:'imputado',label:'Imputado(s)',full:true,editable:true},{key:'delito',label:'Delito',full:true,editable:true},{key:'tribunal',label:'Tribunal',editable:true},{key:'rit',label:'RIT JG',editable:true},{key:'fiscal',label:'Fiscal a cargo',editable:true},{key:'cautelar',label:'Cautelar procesal',editable:true},{key:'centro_penal',label:'Centro Penal',editable:true},{key:'plazo',label:'Plazo / Vencimiento',editable:true,full:true}].map(field=>(
                  <Field key={field.key} label={field.label} value={c[field.key]} editable={field.editable} full={field.full} fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                ))}
                {/* Fecha de los hechos */}
                <div style={{gridColumn:'1/-1',marginTop:4}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de los hechos</div>
                  {editField==='fecha_hechos'?(
                    <div style={{display:'flex',gap:6}}>
                      <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                        value={editValue} onChange={e=>setEditValue(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')updateField('fecha_hechos',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>updateField('fecha_hechos',editValue)}>✓</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                    </div>
                  ):(
                    <div className="fld" onClick={()=>{setEditField('fecha_hechos');setEditValue(c.fecha_hechos||'')}}
                      style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:c.fecha_hechos?'#1E293B':'#cbd5e1',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span>{c.fecha_hechos || 'Clic para agregar...'}</span>
                        {c.fecha_hechos && imputados.map(imp => {
                          if (!imp.fecha_nacimiento && !imp.regimen) return null
                          const regimen = imp.regimen || calcularRegimenAlMomento(imp.fecha_nacimiento, c.fecha_hechos)
                          if (!regimen) return null
                          return (
                            <span key={imp.id} style={{
                              fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:10,
                              background: regimen==='RPA'?'#faf5ff':'#eff6ff',
                              color: regimen==='RPA'?'#5b21b6':'#1E293B',
                              border: `1.5px solid ${regimen==='RPA'?'#ddd6fe':'#bfdbfe'}`,
                              ...f
                            }}>
                              ✓ {imp.nombre?.split(' ')[0]}: {regimen}
                            </span>
                          )
                        })}
                      </div>
                      <span style={{fontSize:11,color:'#cbd5e1'}}>✏</span>
                    </div>
                  )}
                </div>
                <div style={{gridColumn:'1/-1',marginTop:8}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Imputados adicionales</div>
                  {(c.imputado||'').split('|').filter((_,i)=>i>0).map((imp,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:6,alignItems:'center'}}>
                      <div style={{flex:1,padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#F8F9FC',...f}}>{imp.trim()}</div>
                      <button onClick={async()=>{const imps=(c.imputado||'').split('|');imps.splice(i+1,1);updateField('imputado',imps.join('|'));const impEncontrado=imputados.find(x=>x.nombre&&x.nombre.trim()===imp.trim());if(impEncontrado){await supabase.from('imputados').delete().eq('id',impEncontrado.id);setImputados(prev=>prev.filter(x=>x.id!==impEncontrado.id))}}} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'7px 10px',fontSize:12,color:'#dc2626',cursor:'pointer',...f}}>✕</button>
                    </div>
                  ))}
                  {editField==='nuevo_imputado'?(
                    <div style={{display:'flex',gap:8,marginTop:6}}>
                      <input style={{flex:1,padding:'9px 12px',border:'1.5px solid #2563eb',borderRadius:8,fontSize:13,...f}} placeholder="Nombre del imputado adicional" value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={async e=>{if(e.key==='Enter'){updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={async()=>{updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}}>+ Agregar</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✕</button>
                    </div>
                  ):(
                    <button className="btn-secondary" style={{fontSize:12,marginTop:4}} onClick={()=>{setEditField('nuevo_imputado');setEditValue('')}}>+ Agregar imputado</button>
                  )}
                </div>

              </div>
            )}
            {activeTab==='imputado'&&(
              <div>
                {imputados.map((imp,idx)=>(
                  <ImputadoCard key={imp.id} imp={imp} idx={idx} onUpdate={async(field,value)=>{
                    // Campos que NO deben convertirse a mayúsculas
                    const camposSinUpper = ['fecha_nacimiento','fecha_detencion','rut']
                    if (typeof value === 'string' && !camposSinUpper.includes(field)) value = value.toUpperCase()
                    // Calcular régimen automático al guardar fecha_nacimiento
                    let updateData = {[field]:value}
                    if (field === 'fecha_nacimiento' && value) {
                      const fechaHechos = c.fecha_hechos || selectedCausa?.fecha_hechos
                      if (fechaHechos) {
                        const regAuto = calcularRegimenAlMomento(value, fechaHechos)
                        if (regAuto) updateData.regimen = regAuto
                      }
                    }
                    await supabase.from('imputados').update(updateData).eq('id',imp.id)
                    setImputados(prev=>prev.map(x=>x.id===imp.id?{...x,...updateData}:x))
                    // Sincronizar datos personales en TODAS las causas con el mismo RUT
                    const camposPersonales = ['nombre','nacionalidad','domicilio','fecha_nacimiento','otros_antecedentes']
                    if (camposPersonales.includes(field) && imp.rut) {
                      const rn = imp.rut.replace(/[.\s]/g,'').toUpperCase()
                      const { data: todos } = await supabase.from('imputados').select('id, rut').limit(500)
                      if (todos) {
                        const mismoRut = todos.filter(d => d.rut && d.rut.replace(/[.\s]/g,'').toUpperCase() === rn && d.id !== imp.id)
                        await Promise.all(mismoRut.map(d => supabase.from('imputados').update({ [field]: value }).eq('id', d.id)))
                      }
                    }
                    await marcarAccion(c.id)
                  }} onDelete={async()=>{
                    if(!window.confirm('¿Eliminar este imputado?'))return
                    await supabase.from('imputados').delete().eq('id',imp.id)
                    setImputados(prev=>prev.filter(x=>x.id!==imp.id))
                    await marcarAccion(c.id) // ✅ actualiza semáforo
                  }}/>
                ))}
                <button className="btn-secondary" style={{marginTop:16}} onClick={async()=>{
                  const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:'Nuevo imputado'}).select().single()
                  if(data){ setImputados(prev=>[...prev,data]); await marcarAccion(c.id) }
                }}>+ Agregar imputado</button>
              </div>
            )}
            {activeTab==='plazo'&&(
              <PlazoCalculador causaId={c.id} plazoActual={c.plazo} aumentos={aumentos} onGuardarAudiencia={async(form)=>{
                const diasNum = parseInt(form.dias_plazo) || 0
                const{data,error}=await supabase.from('aumentos_plazo').insert({causa_id:c.id,fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||''}).select().single()
                if(!error){
                  const nuevosAumentos=[...aumentos,data].sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                  setAumentos(nuevosAumentos)
                  const diasTotal=nuevosAumentos.reduce((s,a)=>s+(parseInt(a.dias_plazo)||0),0)
                  const primera=nuevosAumentos[0]
                  const nuevoVenc='VENCE '+calcularVencimiento(primera.fecha_audiencia,diasTotal)
                  const nuevoSub=calcularSubestado(nuevoVenc)
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                }
              }}/>
            )}
            {activeTab==='audiencias'&&(
              <div>
                {audiencias.map(a=>(
                  <AudienciaCard key={a.id} a={a} onUpdate={async(updated,motivo)=>{
                    const historial = a.notas ? a.notas + `\n[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}` : `[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}`
                    const{error}=await supabase.from('audiencias').update({...updated,notas:historial}).eq('id',a.id)
                    if(!error){
                      setAudiencias(prev=>prev.map(x=>x.id===a.id?{...x,...updated,notas:historial}:x))
                      await marcarAccion(c.id) // ✅ actualiza semáforo
                    }
                  }}/>
                ))}
                {audiencias.length===0&&<p style={{color:'#cbd5e1',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
                {showAudForm&&(
                  <div style={{background:'#F8F9FC',border:'1.5px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',ph:'Formalización, APJO, JO...'},{key:'tribunal',label:'Tribunal',ph:'Ej: 4 JG STGO'},{key:'sala',label:'Sala',ph:'Ej: 903'},{key:'resultado',label:'Resultado',ph:'Resultado'},{key:'notas',label:'Observaciones',ph:'Notas'}].map(field=>(
                        <div key={field.key}><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>{field.label}</div><input type={field.type||'text'} style={inp} placeholder={field.ph} value={nuevaAud[field.key]} onChange={e=>setNuevaAud(p=>({...p,[field.key]:e.target.value}))}/></div>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:8}}><button className="btn-primary" onClick={saveAudiencia} disabled={saving}>{saving?'Guardando...':'Guardar'}</button><button className="btn-secondary" onClick={()=>setShowAudForm(false)}>Cancelar</button></div>
                  </div>
                )}
                <button className="btn-secondary" onClick={()=>{setShowAudForm(true);setNuevaAud(p=>({...p,tribunal:selectedCausa?.tribunal||''}))}}>+ Nueva audiencia</button>
              </div>
            )}
            {activeTab==='top'&&(
              <div>
                <p style={{fontSize:13,color:'#94a3b8',marginBottom:20,lineHeight:1.7,...f}}>Cuando la causa pasa a Juicio Oral se asigna un nuevo RIT y Tribunal bajo el mismo RUC <span style={{fontFamily:'monospace',color:'#475569'}}>{c.ruc}</span>.</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:c.tiene_top?'#faf5ff':'#F8F9FC',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:12,padding:'16px 20px',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:c.tiene_top?'#7c3aed':'#64748b',...f}}>{c.tiene_top?'⚖️ En Juicio Oral':'⚖️ Sin Juicio Oral asignado'}</div>
                    {c.tiene_top&&<div style={{fontSize:12,color:'#a78bfa',marginTop:3,...f}}>{c.tribunal_top||'—'} · RIT {c.rit_top||'—'}</div>}
                  </div>
                  <button onClick={()=>updateField('tiene_top',!c.tiene_top)} style={{background:c.tiene_top?'#faf5ff':'#fff',color:c.tiene_top?'#7c3aed':'#64748b',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:8,padding:'7px 18px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>{c.tiene_top?'Desactivar':'Activar JO'}</button>
                </div>
                {c.tiene_top&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {[{key:'tribunal_top',label:'Tribunal TOP'},{key:'rit_top',label:'RIT Juicio Oral'}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab==='teoria'&&(
              <TeoriaDelCaso
                causaId={c.id} ruc={c.ruc} session={session} registrarActividad={registrarActividad}
                onAccion={() => marcarAccion(c.id)} // ✅ actualiza semáforo
              />
            )}
            {activeTab==='carpeta'&&(
              <div>
                <Field label="Referencia carpeta física" value={c.carpeta_ref} editable editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField('carpeta_ref',editValue)}/>
                <div style={{marginTop:16}}><CarpetaOneDrive ruc={c.ruc}/></div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const SortIcon=({col})=>sortCol!==col?<span style={{color:'#e2e8f0',marginLeft:5,fontSize:10}}>⇅</span>:sortDir==='asc'?<span style={{color:'#2563eb',marginLeft:5}}>↑</span>:<span style={{color:'#2563eb',marginLeft:5}}>↓</span>

  return(
    <div style={{background:'#F8F9FC',minHeight:'100vh',...f}}>
      <style>{CSS}</style>
      <div style={{maxWidth:1380,margin:'0 auto',padding:'28px'}}>
        {stats.vencido>0&&(<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderLeft:'4px solid #991b1b',borderRadius:10,padding:'12px 20px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:14,flexShrink:0}}>⚠</span><span style={{fontSize:13,color:'#991b1b',fontWeight:600,...f}}>{stats.vencido} CAUSA{stats.vencido>1?'S':''} CON PLAZO VENCIDO — REVISIÓN URGENTE REQUERIDA</span></div>)}
        {stats.proximo>0&&(<div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderLeft:'4px solid #92400e',borderRadius:10,padding:'12px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:14,flexShrink:0}}>⏱</span><span style={{fontSize:13,color:'#92400e',fontWeight:600,...f}}>{stats.proximo} CAUSA{stats.proximo>1?'S':''} POR VENCER EN LOS PRÓXIMOS 3 DÍAS</span></div>)}
        {stats.vencido===0&&stats.proximo===0&&<div style={{marginBottom:24}}/>}

        <div className='stats-grid' style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:24}}>
          {[{key:'',label:'Total',num:stats.total,color:'#1E293B',grad:'linear-gradient(135deg,#1e293b,#1E293B)',border:'#e2e8f0'},{key:'vigente',label:'Vigentes',num:stats.vigente,color:'#059669',grad:'linear-gradient(135deg,#10b981,#059669)',border:'#a7f3d0'},{key:'terminada',label:'Terminadas',num:stats.terminada,color:'#64748b',grad:'linear-gradient(135deg,#94a3b8,#64748b)',border:'#e2e8f0'},{key:'vencido',label:'Plazo Vencido',num:stats.vencido,color:'#dc2626',grad:'linear-gradient(135deg,#ef4444,#dc2626)',border:'#fecaca'},{key:'proximo',label:'Por Vencer',num:stats.proximo,color:'#d97706',grad:'linear-gradient(135deg,#f59e0b,#d97706)',border:'#fde68a'},{key:'apjo',label:'APJO',num:stats.apjo,color:'#7c3aed',grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)',border:'#ddd6fe'},{key:'top',label:'Juicio Oral',num:stats.juicioOral,color:'#0891b2',grad:'linear-gradient(135deg,#06b6d4,#0891b2)',border:'#a5f3fc'}].map(st=>{
            const active=filterEstado===st.key&&st.key!==''
            return(<div key={st.key} className="stat-card" onClick={()=>setFilterEstado(filterEstado===st.key?'':st.key)} style={{background:active?'#f8faff':'#fff',border:`1.5px solid ${active?st.border:st.border}`,borderLeft:`3px solid ${st.color}`,borderRadius:10,padding:'16px 18px',boxShadow:active?`0 4px 16px rgba(15,23,42,0.10)`:'0 1px 3px rgba(15,23,42,0.05)'}}>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:1.5,textTransform:'uppercase',color:'#94a3b8',marginBottom:8,...f}}>{st.label}</div>
              <div style={{fontSize:32,fontWeight:800,color:st.color,lineHeight:1,letterSpacing:'-1px',...f}}>{st.num}</div>
            </div>)
          })}
        </div>

        {showStats&&(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:28,marginBottom:24}}>
            <div style={{fontSize:17,fontWeight:800,color:'#1E293B',marginBottom:24,...f}}>Estadísticas del portfolio</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>
              <div className="hide-mobile"><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Top Delitos</div><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={chartDelitos} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>{chartDelitos.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,fontSize:12}} formatter={(v,n)=>[v+' causas',n]}/><Legend iconType="circle" iconSize={8} formatter={v=>v.substring(0,24)} wrapperStyle={{fontSize:11,color:'#64748b'}}/></PieChart></ResponsiveContainer></div>
              <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Causas por Tribunal</div><ResponsiveContainer width="100%" height={320}><BarChart data={chartTribunales} layout="vertical" margin={{left:8,right:24,top:4,bottom:4}}><XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={110} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,fontSize:12}}/><Bar dataKey="value" radius={[0,6,6,0]}>{chartTribunales.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1,minWidth:260,position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}>🔍</span>
            <input style={{...inp,paddingLeft:36}} placeholder="Buscar por RUC, RIT, imputado, delito, tribunal..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select style={{...inp,width:'auto',minWidth:180}} value={filterTribunal} onChange={e=>setFilterTribunal(e.target.value)}><option value="">Todos los tribunales</option>{tribunales.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <select style={{...inp,width:'auto',minWidth:160}} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}><option value="">Todos los estados</option>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>{filtered.length} resultado{filtered.length!==1?'s':''}</span>
          <button className="btn-primary" onClick={()=>setShowNuevaCausa(true)}>+ Nueva causa</button>
          <button className="btn-secondary" onClick={()=>setShowStats(!showStats)} style={{borderColor:showStats?'#2563eb':'#e2e8f0',color:showStats?'#2563eb':'#374151'}}>{showStats?'Ocultar':'📊 Estadísticas'}</button>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:60,color:'#94a3b8',fontSize:14,...f}}>Cargando causas...</div>
        ):(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,boxShadow:'0 2px 12px rgba(15,23,42,0.06)',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'2px solid #f1f5f9',background:'#fafbff'}}>
                  {[{key:'ruc',label:'RUC'},{key:'rit',label:'RIT'},{key:'tribunal',label:'Tribunal'},{key:'imputado',label:'Imputado'},{key:'delito',label:'Delito'},{key:'fiscal',label:'Fiscal'},{key:'plazo',label:'Plazo'},{key:'estado',label:'Estado'}].map(col=>(
                    <th key={col.key} className="sort-col" onClick={()=>handleSort(col.key)} style={{padding:'13px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:sortCol===col.key?'#2563eb':'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,...f}}>{col.label}<SortIcon col={col.key}/></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c)=>(
                  <tr key={c.id} className="row-hover" onClick={()=>openCausa(c)} style={{borderBottom:'1px solid #F8F9FC',background:'#fff'}}>
                    <td style={{padding:'12px 16px',fontSize:12,fontWeight:700,color:'#1E293B',...f}}>{c.ruc}</td>
                    <td style={{padding:'12px 16px',fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>
                      {/* ✅ Semáforo como tag visible en la lista — solo causas vigentes */}
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                        <span>{c.rit||'—'}</span>
                      </div>
                    </td>
                    <td style={{padding:'12px 16px',fontSize:12,color:'#475569',fontWeight:500,...f}}>{c.tribunal}</td>
                    <td style={{padding:'12px 16px',...f}}><div style={{maxWidth:210,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,color:'#1E293B',fontWeight:500}}>{c.imputado}</div></td>
                    <td style={{padding:'12px 16px',...f}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,color:'#64748b'}}>{c.delito||'—'}</div></td>
                    <td style={{padding:'12px 16px',fontSize:12,color:c.fiscal?'#374151':'#e2e8f0',fontStyle:c.fiscal?'normal':'italic',...f}}>{c.fiscal||'Sin asignar'}</td>
                    <td style={{padding:'12px 16px',...f}}><div style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11,color:'#94a3b8'}}>{c.plazo||'—'}</div></td>
                    <td style={{padding:'12px 16px'}}><Badge estado={c.estado} subestado={c.subestado}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:'#94a3b8',fontSize:14,...f}}>Sin resultados.</div>}
          </div>
        )}
      </div>

      {showNuevaCausa&&(
        <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'5vh',zIndex:200,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&setShowNuevaCausa(false)}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:32,width:540,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(15,23,42,0.22)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#1E293B',marginBottom:24,...f}}>Nueva Causa</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* RUC y RIT */}
              {[{key:'ruc',label:'RUC *',ph:'Ej: 2600123456-7',full:true},{key:'rit',label:'RIT',ph:'Ej: 1234-2026'}].map(field=>(
                <div key={field.key} style={{gridColumn:field.full?'1/-1':'auto'}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{field.label}</div>
                  <input style={inp} placeholder={field.ph} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}
              {/* RUT del imputado con autorelleno */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>RUT del imputado</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{...inp,flex:1}} placeholder="Ej: 12345678-9"
                    value={nuevaCausa.imputado_rut}
                    onChange={e=>setNuevaCausa(p=>({...p,imputado_rut:e.target.value}))}
                    onBlur={e=>buscarRutNuevaCausa(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&buscarRutNuevaCausa(nuevaCausa.imputado_rut)}
                  />
                  {rutBuscando && <span style={{fontSize:12,color:'#94a3b8',alignSelf:'center',...f}}>Buscando...</span>}
                  {rutEncontrado && <span style={{fontSize:12,color:'#065f46',alignSelf:'center',fontWeight:600,...f}}>✓ Datos encontrados</span>}
                </div>
              </div>
              {/* Datos del imputado */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nombre completo *</div>
                <input style={inp} placeholder="Nombre completo del imputado"
                  value={nuevaCausa.imputado}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de nacimiento</div>
                <input type="date" style={inp}
                  value={nuevaCausa.imputado_fecha_nac}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_fecha_nac:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nacionalidad</div>
                <input style={inp} placeholder="Ej: CHILENO"
                  value={nuevaCausa.imputado_nacionalidad}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_nacionalidad:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Domicilio</div>
                <input style={inp} placeholder="Domicilio del imputado"
                  value={nuevaCausa.imputado_domicilio}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_domicilio:e.target.value}))}/>
              </div>
              {/* Fiscal y Cautelar */}
              {[{key:'fiscal',label:'Fiscal',ph:'Nombre del fiscal'},{key:'cautelar',label:'Cautelar',ph:'Prisión preventiva...'}].map(field=>(
                <div key={field.key}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{field.label}</div>
                  <input style={inp} placeholder={field.ph} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tribunal *</div>
                <SearchableSelect
                  value={nuevaCausa.tribunal}
                  onChange={v=>setNuevaCausa(p=>({...p,tribunal:v}))}
                  options={TRIBUNALES_CHILE}
                  placeholder="Seleccionar tribunal..."
                  isDelito={false}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Delito *</div>
                <SearchableSelect
                  value={nuevaCausa.delito}
                  onChange={v=>setNuevaCausa(p=>({...p,delito:v}))}
                  options={DELITOS_CATALOGO}
                  placeholder="Buscar delito..."
                  isDelito={true}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de los hechos</div>
                <input type="date" style={inp} value={nuevaCausa.fecha_hechos} onChange={e=>setNuevaCausa(p=>({...p,fecha_hechos:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1.5px solid #a7f3d0',borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'#059669',marginBottom:14,...f}}>⏱ Cálculo de plazo ACD</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha inicio</div><input type="date" style={inp} value={nuevaCausa.fecha_inicio} onChange={e=>setNuevaCausa(p=>({...p,fecha_inicio:e.target.value}))}/></div>
                  <div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días plazo</div><input type="number" style={inp} placeholder="Ej: 210" value={nuevaCausa.dias_plazo} onChange={e=>setNuevaCausa(p=>({...p,dias_plazo:e.target.value}))}/></div>
                </div>
                {nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo && (<div style={{marginTop:10,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #a7f3d0',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📅</span><div><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento calculado</div><div style={{fontSize:15,fontWeight:800,color:'#059669',...f}}>{calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)}</div></div></div>)}
                <div style={{marginTop:12}}><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>O ingresa plazo manualmente</div><input style={inp} placeholder="VENCE DD-MM-YYYY" value={nuevaCausa.plazo} onChange={e=>setNuevaCausa(p=>({...p,plazo:e.target.value}))}/></div>
              </div>
              <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Estado</div><select style={inp} value={nuevaCausa.estado} onChange={e=>setNuevaCausa(p=>({...p,estado:e.target.value}))}>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button className="btn-primary" onClick={saveCausa} disabled={saving||!nuevaCausa.ruc}>{saving?'Guardando...':'Guardar causa'}</button>
              <button className="btn-secondary" onClick={()=>setShowNuevaCausa(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
