import { useState, useEffect } from 'react'
import { loginOneDrive, getMSToken, getOrCreateRucFolder } from '../lib/onedrive'
const f = { fontFamily: "'Manrope','Inter', sans-serif" }

// ✅ NUEVO: Joaquín recordó que se había planeado que crear una causa
// creara sola su carpeta en OneDrive — el código para hacerlo
// (getOrCreateRucFolder, con inicio de sesión de Microsoft) ya existía en
// src/lib/onedrive.js, pero nunca se conectó a ningún botón ni se llamaba
// desde ningún lado. Se agrega acá: conectar OneDrive, y un botón para
// crear la carpeta a mano — útil tanto para causas nuevas (si por algún
// motivo no se creó sola) como para todas las causas ya existentes, que
// nunca tuvieron esta opción disponible.
// ✅ FIX: la tarjeta tenía 3 botones apilados + un cuadro aparte de "Cómo
// acceder" explicando lo que los botones ya decían — Joaquín: "creo que es
// muy grande la dinámica y muchas cosas". Ahora queda 1 botón principal
// (Abrir carpeta) + 2 enlaces chicos abajo (verificar/crear la carpeta,
// copiar RUC), sin el cuadro de instrucciones. "Crear/verificar" ya no
// necesita que lo apreten: se hace solo al entrar a esta pestaña.
export default function CarpetaOneDrive({ ruc }) {
  const [copiado, setCopiado] = useState(false)
  const [conectado, setConectado] = useState(!!getMSToken())
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState(false)
  const [errorCrear, setErrorCrear] = useState(false)

  const oneDriveUrl = 'https://onedrive.live.com/?id=%2Fpersonal%2F0cfb783f3c750a65%2FDocuments%2FJOAQUIN%20OBREGON%2FCAUSAS%20JOA%2F'
    + ruc.replace(/-/g, '%2D')
    + '&sortField=LinkFilename&isAscending=true'

  const copiarRuc = () => {
    navigator.clipboard.writeText(ruc)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const crearCarpeta = async () => {
    setCreando(true)
    setErrorCrear(false)
    try {
      await getOrCreateRucFolder(ruc)
      setCreada(true)
    } catch (err) {
      // Si el token venció (dura solo la sesión del navegador, no queda
      // guardado entre visitas), se pide reconectar en vez de mostrar un
      // error críptico.
      if (/No token|401|token/i.test(err.message)) {
        setConectado(false)
      } else {
        setErrorCrear(true)
      }
    } finally {
      setCreando(false)
    }
  }

  useEffect(() => { if (conectado) crearCarpeta() }, [ruc, conectado])

  return (
    <div style={{ background:'#FDFCF8', border:'1px solid #DDD7C6', borderRadius:14, padding:'18px 20px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <div style={{ width:40, height:40, background:'#2F5D48', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, boxShadow:'0 0 0 1px rgba(168,146,95,.35)' }}>📁</div>
        <div>
          <div style={{ fontSize:13.5, fontWeight:700, color:'#1E3A2F', ...f }}>Carpeta OneDrive</div>
          <div style={{ fontSize:11.5, color:'#A6A397', marginTop:1, fontVariantNumeric:'tabular-nums' }}>CAUSAS JOA / {ruc}</div>
        </div>
      </div>

      {!conectado ? (
        <button onClick={loginOneDrive}
          style={{ width:'100%', background:'#1E3A2F', border:'none', borderRadius:9, padding:'11px 18px', fontSize:12.5, fontWeight:600, color:'#FDFCF8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...f }}>
          🔗 Conectar OneDrive
        </button>
      ) : (
        <>
          <a href={oneDriveUrl} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#1E3A2F', color:'#FDFCF8', borderRadius:9, padding:'11px 18px', fontSize:13, fontWeight:600, textDecoration:'none', ...f }}>
            📂 Abrir carpeta en OneDrive ↗
          </a>
          <div style={{ display:'flex', justifyContent:'center', gap:18, marginTop:11 }}>
            <span onClick={errorCrear ? crearCarpeta : undefined}
              style={{ fontSize:11.5, fontWeight:600, color: errorCrear ? '#8C2F26' : '#6F7B6F', cursor: errorCrear ? 'pointer' : 'default', borderBottom: errorCrear ? '1px solid #8C2F26' : 'none', ...f }}>
              {creando ? 'Verificando carpeta…' : errorCrear ? '⚠ No se pudo verificar — reintentar' : creada ? '✓ Carpeta verificada' : ''}
            </span>
            <span onClick={copiarRuc}
              style={{ fontSize:11.5, fontWeight:600, color:'#6F7B6F', cursor:'pointer', borderBottom:'1px solid #DDD7C6', ...f }}>
              {copiado ? '✓ RUC copiado' : '📋 Copiar RUC'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
