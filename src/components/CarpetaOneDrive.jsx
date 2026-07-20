import { useState, useEffect } from 'react'
const f = { fontFamily: "'Manrope','Inter', sans-serif" }

export default function CarpetaOneDrive({ ruc }) {
  const [copiado, setCopiado] = useState(false)

  const oneDriveUrl = 'https://onedrive.live.com/?id=%2Fpersonal%2F0cfb783f3c750a65%2FDocuments%2FJOAQUIN%20OBREGON%2FCAUSAS%20JOA%2F'
    + ruc.replace(/-/g, '%2D')
    + '&sortField=LinkFilename&isAscending=true'

  const copiarRuc = () => {
    navigator.clipboard.writeText(ruc)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

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

        {/* Botón principal — abrir en OneDrive */}
        <a href={oneDriveUrl} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:600, textDecoration:'none', boxShadow:'0 4px 14px rgba(37,99,235,0.3)', marginBottom:10, ...f }}>
          <span style={{ fontSize:18 }}>📂</span>
          Abrir carpeta en OneDrive
          <span style={{ fontSize:12, opacity:0.8 }}>↗</span>
        </a>

        {/* Botón copiar RUC */}
        <button onClick={copiarRuc}
          style={{ width:'100%', background:'#fff', border:'1.5px solid #bfdbfe', borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:500, color:'#2563eb', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...f }}>
          {copiado ? '✅ RUC copiado' : '📋 Copiar RUC para buscar en OneDrive'}
        </button>
      </div>

      {/* Instrucciones */}
      <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 18px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, ...f }}>Cómo acceder</div>
        {[
          { icon:'1️⃣', texto:'Haz clic en "Abrir carpeta en OneDrive"' },
          { icon:'2️⃣', texto:'Si no carga directo, usa "Copiar RUC" y búscalo en OneDrive' },
          { icon:'3️⃣', texto:'La carpeta está en: Documentos → JOAQUIN OBREGON → CAUSAS JOA → ' + ruc },
        ].map((item, i) => (
          <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
            <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
            <div style={{ fontSize:12, color:'#64748b', lineHeight:1.5, ...f }}>{item.texto}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
