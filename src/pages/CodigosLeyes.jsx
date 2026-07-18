import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const f = { fontFamily:"'Inter',sans-serif" }
const CACHE_KEY = 'lexoffice_codigos_leyes_cache_v1'

// ─── Guardado local (funciona sin internet) ──────────────────────────────────
function guardarCache(lista) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lista, guardadoEn: new Date().toISOString() }))
  } catch { /* si el navegador no permite guardar, simplemente no se cachea */ }
}
function leerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Colores pastel generados dinámicamente (no una lista fija) — así, sin
// importar cuántos códigos/leyes haya, cada tarjeta recibe un tono distinto
// y nunca se repiten entre sí.
function colorDeLey(idx, total) {
  const hue = Math.round((360 / Math.max(total, 1)) * idx)
  return {
    bg: `hsl(${hue}, 70%, 96%)`,
    border: `hsl(${hue}, 55%, 85%)`,
    text: `hsl(${hue}, 55%, 30%)`,
  }
}

export default function CodigosLeyes() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [seleccionId, setSeleccionId] = useState(null) // solo si se quiere ver el texto ya cargado, inline

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('codigos_leyes').select('*').order('orden', { ascending: true })
      if (error) throw error
      setLista(data || [])
      setSinConexion(false)
      guardarCache(data || [])
      setGuardadoEn(new Date().toISOString())
    } catch (err) {
      const cache = leerCache()
      if (cache) {
        setLista(cache.lista || [])
        setGuardadoEn(cache.guardadoEn)
        setSinConexion(true)
      } else {
        setLista([])
      }
    }
    setLoading(false)
  }

  const actualizar = async () => {
    setActualizando(true)
    await cargar()
    setActualizando(false)
  }

  const seleccionado = lista.find(c => c.id === seleccionId)
  const tieneTextoCargado = (c) => c.contenido && c.contenido !== '(Pendiente de cargar)'

  if (loading) {
    return <div style={{ textAlign:'center', padding:80, color:'#94a3b8', fontSize:14, ...f }}>Cargando…</div>
  }

  return (
    <div style={{ background:'#F8F9FC', minHeight:'calc(100vh - 60px)', ...f }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:'#1E293B', letterSpacing:'-0.4px' }}>Códigos y Leyes</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
              {sinConexion ? (
                <span style={{ color:'#92400e' }}>📡 Sin conexión — viendo la última versión guardada{guardadoEn ? ` (${new Date(guardadoEn).toLocaleDateString('es-CL')})` : ''}</span>
              ) : guardadoEn ? (
                <span>✓ Actualizado el {new Date(guardadoEn).toLocaleDateString('es-CL')} — disponible sin internet desde este dispositivo</span>
              ) : null}
            </div>
          </div>
          <button onClick={actualizar} disabled={actualizando}
            style={{ fontFamily:"'Inter',sans-serif", background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
            {actualizando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>

        {lista.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
            No hay códigos ni leyes cargados todavía, y no hay ninguna versión guardada en este dispositivo. Conéctate a internet al menos una vez para descargarlos.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))', gap:16 }}>
            {lista.map((c, idx) => {
              const col = colorDeLey(idx, lista.length)
              return (
                <div key={c.id} style={{ position:'relative' }}>
                  <a
                    href={c.fuente_url || undefined}
                    target={c.fuente_url ? '_blank' : undefined}
                    rel="noreferrer"
                    style={{
                      display:'flex', alignItems:'center', gap:10, textDecoration:'none',
                      background:col.bg, border:`1px solid ${col.border}`, borderRadius:16, padding:'20px 18px',
                      minHeight:76, cursor: c.fuente_url ? 'pointer' : 'default',
                      transition:'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e=>{ if(c.fuente_url){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(15,23,42,0.08)' } }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}
                    onClick={e=>{ if(!c.fuente_url) e.preventDefault() }}
                  >
                    <div style={{ fontSize:14, fontWeight:700, color:col.text, lineHeight:1.35 }}>{c.titulo}</div>
                  </a>
                  {tieneTextoCargado(c) && (
                    <button onClick={()=>setSeleccionId(c.id)}
                      style={{ position:'absolute', bottom:8, right:8, fontFamily:"'Inter',sans-serif", background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'5px 10px', fontSize:10, fontWeight:600, color:'#374151', cursor:'pointer' }}>
                      📄 Texto
                    </button>
                  )}
                  {!c.fuente_url && (
                    <div style={{ fontSize:10, color:'#cbd5e1', marginTop:6, textAlign:'center' }}>Enlace por confirmar</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Texto cargado — solo se abre si el usuario elige "Ver texto cargado" en alguna tarjeta */}
      {seleccionado && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, zIndex:200 }} onClick={e=>e.target===e.currentTarget && setSeleccionId(null)}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:800, width:'100%', maxHeight:'85vh', overflowY:'auto', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#1E293B' }}>{seleccionado.titulo}</div>
              <button onClick={()=>setSeleccionId(null)} style={{ background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ fontSize:14, lineHeight:1.8, color:'#1E293B', whiteSpace:'pre-wrap' }}>{seleccionado.contenido}</div>
          </div>
        </div>
      )}
    </div>
  )
}
