import { useState } from 'react'

const f = { fontFamily: "'Outfit', sans-serif" }

const BASE_SHARE = 'https://onedrive.live.com/embed?resid=CFB783F3C750A65%210&authkey=!AGeZynSn31N0mnxsucbEeYg0'

export default function CarpetaOneDrive({ ruc }) {
  const [expanded, setExpanded] = useState(false)

  const oneDriveUrl = 'https://onedrive.live.com/?id=%2Fpersonal%2F0cfb783f3c750a65%2FDocuments%2FJOAQUIN%20OBREGON%2FCAUSAS%20JOA%2F' + ruc.replace(/-/g, '%2D') + '&sortField=LinkFilename&isAscending=true'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:13, color:'#6b7280', ...f }}>
          📁 <span style={{ fontFamily:'monospace' }}>CAUSAS JOA / {ruc}</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setExpanded(!expanded)}
            style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600, ...f }}>
            {expanded ? 'Ocultar archivos' : '📂 Ver archivos'}
          </button>
          <a href={oneDriveUrl} target="_blank" rel="noreferrer"
            style={{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', textDecoration:'none', color:'#374151', ...f }}>
            Abrir en OneDrive ↗
          </a>
        </div>
      </div>

      {expanded && (
        <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid #eaecf4' }}>
          <iframe
            src={`https://onedrive.live.com/embed?authkey=%21AGeZynSn31N0mnxsucbEeYg0&id=CFB783F3C750A65%210&path=%2FCAUSAS%20JOA%2F${encodeURIComponent(ruc)}&action=view`}
            width="100%"
            height="500"
            frameBorder="0"
            scrolling="yes"
            title={`Carpeta ${ruc}`}
            style={{ display:'block' }}
          />
        </div>
      )}

      {!expanded && (
        <div style={{ textAlign:'center', padding:'24px 20px', background:'#f7f8fc', borderRadius:10, border:'1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginBottom:12, ...f }}>
            Haz clic en "Ver archivos" para ver los documentos de esta causa
          </div>
        </div>
      )}
    </div>
  )
}
