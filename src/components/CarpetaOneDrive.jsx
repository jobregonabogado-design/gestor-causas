import { useState } from 'react'
const f = { fontFamily: "'Manrope','Inter', sans-serif" }

export default function CarpetaOneDrive({ ruc, isMobile }) {
  const [copiado, setCopiado] = useState(false)

  const oneDriveUrl = 'https://onedrive.live.com/?id=%2Fpersonal%2F0cfb783f3c750a65%2FDocuments%2FJOAQUIN%20OBREGON%2FCAUSAS%20JOA%2F'
    + ruc.replace(/-/g, '%2D')
    + '&sortField=LinkFilename&isAscending=true'

  const copiarRuc = () => {
    navigator.clipboard.writeText(ruc)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ✅ En computador, si OneDrive ya está sincronizado localmente, buscar con
  // Spotlight es instantáneo (no depende de internet ni de OneDrive.com) — por
  // eso ese camino va primero en escritorio. Los navegadores no permiten que
  // una página web abra directamente un archivo local (por seguridad), así que
  // no hay forma de hacerlo con un solo clic — pero copiar el RUC + Spotlight
  // son solo 2 pasos. En celular ese atajo no aplica, así que ahí el link a
  // OneDrive por internet queda como la única opción, sin cambios.
  return (
    <div>
      {/* Card principal */}
      <div style={{ background:'linear-gradient(135deg,#f0f7ff,#e8f0fe)', border:'1.5px solid #bfdbfe', borderRadius:14, padding:'20px 24px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={{ width:48, height:48, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>📁</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1e3a8a', ...f }}>Carpeta OneDrive</div>
            <div style={{ fontSize:12, color:'#3b82f6', marginTop:2, fontFamily:'monospace' }}>CAUSAS JOA / {ruc}</div>
          </div>
        </div>

        {!isMobile && (
          <>
            {/* En computador: copiar RUC + Spotlight, primero y destacado */}
            <button onClick={copiarRuc}
              style={{ width:'100%', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 4px 14px rgba(37,99,235,0.3)', marginBottom:10, ...f }}>
              <span style={{ fontSize:18 }}>⌘</span>
              {copiado ? '✅ RUC copiado — ahora presiona ⌘+Espacio y pega' : 'Copiar RUC y abrir con Spotlight (más rápido)'}
            </button>
            <div style={{ fontSize:11, color:'#64748b', textAlign:'center', marginBottom:14, ...f }}>
              Si tienes OneDrive sincronizado en este Mac, esto abre la carpeta ya descargada — sin pasar por internet.
            </div>
          </>
        )}

        {/* Botón — abrir en OneDrive por internet (siempre disponible; único camino en celular) */}
        <a href={oneDriveUrl} target="_blank" rel="noreferrer"
          style={isMobile
            ? { display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:600, textDecoration:'none', boxShadow:'0 4px 14px rgba(37,99,235,0.3)', marginBottom:10, ...f }
            : { display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#fff', border:'1.5px solid #bfdbfe', color:'#2563eb', borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:500, textDecoration:'none', marginBottom:10, ...f }}>
          <span style={{ fontSize:isMobile?18:14 }}>📂</span>
          Abrir carpeta en OneDrive (internet)
          <span style={{ fontSize:12, opacity:0.8 }}>↗</span>
        </a>

        {isMobile && (
          /* En celular, "copiar RUC" queda como respaldo para buscar dentro de OneDrive.com si el link directo no carga */
          <button onClick={copiarRuc}
            style={{ width:'100%', background:'#fff', border:'1.5px solid #bfdbfe', borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:500, color:'#2563eb', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...f }}>
            {copiado ? '✅ RUC copiado' : '📋 Copiar RUC para buscar en OneDrive'}
          </button>
        )}
      </div>

      {/* Instrucciones */}
      <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 18px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, ...f }}>Cómo acceder</div>
        {(isMobile ? [
          { icon:'1️⃣', texto:'Haz clic en "Abrir carpeta en OneDrive"' },
          { icon:'2️⃣', texto:'Si no carga directo, usa "Copiar RUC" y búscalo en OneDrive' },
          { icon:'3️⃣', texto:'La carpeta está en: Documentos → JOAQUIN OBREGON → CAUSAS JOA → ' + ruc },
        ] : [
          { icon:'1️⃣', texto:'Clic en "Copiar RUC y abrir con Spotlight" (se copia el RUC solo)' },
          { icon:'2️⃣', texto:'Presiona ⌘ + Espacio, pega el RUC (⌘+V) y presiona Enter' },
          { icon:'3️⃣', texto:'Si ese archivo no está sincronizado en este Mac, usa "Abrir carpeta en OneDrive (internet)" en su lugar' },
        ]).map((item, i) => (
          <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
            <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
            <div style={{ fontSize:12, color:'#64748b', lineHeight:1.5, ...f }}>{item.texto}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
