import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const f = { fontFamily:"'Inter',sans-serif" }
const CACHE_KEY = 'lexoffice_codigos_leyes_cache_v1'

// ─── Guardado local (funciona sin internet) ──────────────────────────────────
// Se guarda en localStorage del navegador cada vez que se logra actualizar
// desde Supabase. Si no hay internet, se usa lo último guardado acá.
function guardarCache(lista) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lista, guardadoEn: new Date().toISOString() }))
  } catch { /* si el navegador no permite guardar (modo privado, etc.), simplemente no se cachea */ }
}
function leerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function CodigosLeyes() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [seleccionId, setSeleccionId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

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
      if (!seleccionId && data && data.length > 0) setSeleccionId(data[0].id)
    } catch (err) {
      // Sin internet (o Supabase no responde) → se usa lo último guardado localmente
      const cache = leerCache()
      if (cache) {
        setLista(cache.lista || [])
        setGuardadoEn(cache.guardadoEn)
        setSinConexion(true)
        if (!seleccionId && cache.lista?.length > 0) setSeleccionId(cache.lista[0].id)
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

  // Búsqueda simple dentro del texto del código seleccionado — filtra por
  // párrafo/línea para no tener que cargar una librería de búsqueda pesada.
  const parrafosFiltrados = useMemo(() => {
    if (!seleccionado?.contenido) return []
    const parrafos = seleccionado.contenido.split(/\n+/).filter(p => p.trim())
    if (!busqueda.trim()) return parrafos
    const q = busqueda.toLowerCase()
    return parrafos.filter(p => p.toLowerCase().includes(q))
  }, [seleccionado, busqueda])

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
                <span>✓ Actualizado el {new Date(guardadoEn).toLocaleDateString('es-CL')} a las {new Date(guardadoEn).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})} — disponible sin internet desde este dispositivo</span>
              ) : null}
            </div>
          </div>
          <button className="btn-secondary" onClick={actualizar} disabled={actualizando}
            style={{ fontFamily:"'Inter',sans-serif", background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#374151' }}>
            {actualizando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>

        {lista.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
            No hay códigos ni leyes cargados todavía, y no hay ninguna versión guardada en este dispositivo. Conéctate a internet al menos una vez para descargarlos.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:0, background:'#fff', borderRadius:16, boxShadow:'0 1px 3px rgba(15,23,42,0.06)', overflow:'hidden', minHeight:560 }}>
            {/* Sidebar */}
            <div style={{ background:'#F8F9FC', borderRight:'1px solid #E2E8F0', padding:'16px 0', overflowY:'auto' }}>
              <div style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:2, fontWeight:700, padding:'0 16px 10px' }}>Cuerpo legal</div>
              {lista.map(c => (
                <button key={c.id} onClick={() => { setSeleccionId(c.id); setBusqueda('') }}
                  style={{ width:'100%', textAlign:'left', padding:'11px 16px', background: seleccionId===c.id ? '#1E293B' : 'transparent', border:'none', borderLeft: seleccionId===c.id ? '3px solid #1E293B' : '3px solid transparent', cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>
                  <div style={{ fontSize:12, fontWeight: seleccionId===c.id ? 600 : 400, color: seleccionId===c.id ? '#fff' : '#475569', lineHeight:1.4 }}>{c.titulo}</div>
                </button>
              ))}
            </div>

            {/* Contenido */}
            <div style={{ display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'16px 24px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, background:'#F8F9FC' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#1E293B' }}>{seleccionado?.titulo}</div>
                {seleccionado?.fuente_url && (
                  <a href={seleccionado.fuente_url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#2563eb', fontWeight:600, textDecoration:'none' }}>Ver en BCN/LeyChile ↗</a>
                )}
              </div>
              <div style={{ padding:'12px 24px', borderBottom:'1px solid #f1f5f9' }}>
                <input
                  value={busqueda}
                  onChange={e=>setBusqueda(e.target.value)}
                  placeholder="Buscar artículo o palabra dentro de este texto..."
                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontFamily:"'Inter',sans-serif", color:'#1E293B' }}/>
              </div>
              <div style={{ flex:1, padding:'20px 24px', overflowY:'auto', maxHeight:600 }}>
                {seleccionado?.contenido === '(Pendiente de cargar)' ? (
                  <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.7 }}>
                    Este cuerpo legal todavía no tiene el texto cargado — se va completando por partes. Mientras tanto, puedes abrirlo en BCN/LeyChile con el enlace de arriba.
                  </div>
                ) : parrafosFiltrados.length === 0 ? (
                  <div style={{ fontSize:13, color:'#94a3b8' }}>Sin resultados para "{busqueda}".</div>
                ) : (
                  parrafosFiltrados.map((p, i) => (
                    <p key={i} style={{ fontSize:14, lineHeight:1.8, color:'#1E293B', marginBottom:14, whiteSpace:'pre-wrap' }}>{p}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
