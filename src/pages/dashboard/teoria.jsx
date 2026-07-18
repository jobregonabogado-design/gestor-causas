// Pestaña 'Teoría del Caso' dentro de una causa: hechos, defensa, prueba,
// fallos de referencia, observaciones, carpeta y diligencias.
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { f } from './primitives'
import { DiligenciasFiscalia } from './diligencias'
import { FallosReferencia, DocumentosGuardados } from './documentos'
import CarpetaOneDrive from '../../components/CarpetaOneDrive'

const TC_SECCIONES = [
  { key:'hechos',        icon:'📋', label:'Hechos del caso',       placeholder:'Describe los hechos relevantes: lugar, fecha, circunstancias, cronología de los eventos...' },
  { key:'teoria_defensa',icon:'⚖️',  label:'Teoría y Defensa',      placeholder:'Calificación jurídica, tipo penal, elementos del delito, circunstancias modificatorias, estrategia de defensa, alegaciones, excepciones, jurisprudencia aplicable...' },
  { key:'prueba',        icon:'🔍', label:'Prueba y testigos',      placeholder:'Lista de testigos, peritos, documentos, evidencias materiales, cadena de custodia...' },
  { key:'fallos',        icon:'📄', label:'Fallos de referencia',   placeholder:null },
  { key:'observaciones', icon:'📝', label:'Observaciones',          placeholder:'Notas de seguimiento, criterios del tribunal, pendientes...' },
  { key:'carpeta',       icon:'📁', label:'Carpeta y Documentos',   placeholder:null },
  { key:'diligencias',   icon:'📨', label:'Diligencias Fiscalía',   placeholder:null },
]

export function TeoriaDelCaso({ causaId, ruc, session, registrarActividad, onAccion, carpetaRef, onUpdateCarpetaRef }) {
  const [teoria, setTeoria] = useState(null)
  const [form, setForm] = useState({ hechos:'', teoria_defensa:'', prueba:'', observaciones:'' })
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [seccionActiva, setSeccionActiva] = useState('hechos')
  const [showHistorial, setShowHistorial] = useState(false)
  const [editandoRef, setEditandoRef] = useState(false)
  const [refValue, setRefValue] = useState('')
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
  // ✅ Guardar / Historial / contador de caracteres solo tienen sentido en las
  // secciones de texto con autoguardado. Fallos, Carpeta y Diligencias tienen
  // su propio guardado interno — mostrar el botón "Guardar" de aquí arriba
  // ahí confundía (no hacía nada útil sobre esas secciones).
  const esSeccionTexto = !['fallos','carpeta','diligencias'].includes(seccionActiva)
  const totalCaracteres = Object.values(form).join('').length

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#94a3b8', fontSize:13, ...f }}>Cargando teoría del caso...</div>

  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:0, minHeight:500, border:'1px solid #E2E8F0', borderRadius:14, overflow:'hidden' }}>
      <div style={{ background:'#F8F9FC', borderRight:'1px solid #E2E8F0', padding:'20px 0' }}>
        <div style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:2, fontWeight:700, padding:'0 16px 12px', ...f }}>Secciones</div>
        {TC_SECCIONES.map(s => {
          const tieneContenido = (form[s.key]||'').trim().length > 0
          return (
            <button key={s.key} onClick={() => setSeccionActiva(s.key)}
              style={{ width:'100%', textAlign:'left', padding:'10px 16px', background: seccionActiva===s.key ? '#1E293B' : 'transparent', border:'none', borderLeft: seccionActiva===s.key ? '3px solid #1E293B' : '3px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all 0.2s ease' }}>
              <span style={{ fontSize:13, opacity: seccionActiva===s.key ? 1 : 0.6 }}>{s.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight: seccionActiva===s.key ? 600 : 400, color: seccionActiva===s.key ? '#fff' : '#64748b', ...f, lineHeight:1.3, textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
                {tieneContenido && <div style={{ width:5, height:5, borderRadius:'50%', background: seccionActiva===s.key ? '#fff' : '#1E293B', marginTop:3 }}/>}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', background:'#fff' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FC' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1E293B', ...f }}>{seccionActual?.icon} {seccionActual?.label}</div>
            {esSeccionTexto && (
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>
                {totalCaracteres > 0 ? `${totalCaracteres.toLocaleString()} caracteres` : 'Sin contenido aún'}
                {savedAt && <span style={{ marginLeft:8, color:'#059669' }}>✓ Guardado {savedAt.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>}
              </div>
            )}
          </div>
          {esSeccionTexto && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowHistorial(!showHistorial)} className="btn-secondary" style={{ fontSize:12, borderColor: showHistorial?'#1E293B':'#E2E8F0', color: showHistorial?'#1E293B':'#64748b' }}>
                🕐 Historial {historial.length > 0 && `(${historial.length})`}
              </button>
              <button onClick={() => guardar(form, false)} disabled={saving} className="btn-primary" style={{ fontSize:12 }}>
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
            </div>
          )}
        </div>
        {esSeccionTexto && showHistorial && (
          <div style={{ background:'#F8F9FC', borderBottom:'1px solid #E2E8F0', padding:'16px 20px', maxHeight:200, overflowY:'auto' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:1, marginBottom:10, ...f }}>Historial de modificaciones</div>
            {historial.length === 0 ? (
              <div style={{ fontSize:12, color:'#94a3b8', ...f }}>Sin modificaciones registradas aún.</div>
            ) : historial.map((h, i) => {
              let info = {}
              try { info = JSON.parse(h.contenido) } catch {}
              return (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 0', borderBottom:'1px solid #E2E8F0' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#1E293B', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:700, flexShrink:0 }}>{(info.editor||'?')[0]?.toUpperCase()}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1E293B', ...f }}>{info.editor || 'Usuario'}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', ...f }}>{info.fecha} {info.hora}</div>
                  </div>
                  <span style={{ fontSize:10, color:'#94a3b8', background:'#F1F5F9', padding:'2px 8px', borderRadius:20, ...f }}>modificó</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="tc-section" style={{ flex:1, padding:'20px' }}>
          {seccionActiva === 'fallos' ? (
            <FallosReferencia causaId={causaId} ruc={ruc} email={session?.user?.email || ''} onAccion={onAccion} />
          ) : seccionActiva === 'carpeta' ? (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:600, ...f }}>Referencia carpeta física</div>
                {editandoRef ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <input style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }}
                      value={refValue} onChange={e=>setRefValue(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'){onUpdateCarpetaRef(refValue);setEditandoRef(false)}if(e.key==='Escape')setEditandoRef(false)}} autoFocus/>
                    <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{onUpdateCarpetaRef(refValue);setEditandoRef(false)}}>✓</button>
                    <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditandoRef(false)}>✗</button>
                  </div>
                ) : (
                  <div className="fld" onClick={()=>{setEditandoRef(true);setRefValue(carpetaRef||'')}}
                    style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:carpetaRef?'#1E293B':'#94a3b8', minHeight:38, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background:'#fff', ...f }}>
                    <span>{carpetaRef || 'Clic para agregar...'}</span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>✏</span>
                  </div>
                )}
              </div>
              <CarpetaOneDrive ruc={ruc}/>
              <div style={{ marginTop:28, paddingTop:24, borderTop:'1px solid #f1f5f9' }}>
                <DocumentosGuardados causaId={causaId} ruc={ruc} email={session?.user?.email || ''} registrarActividad={registrarActividad} onAccion={onAccion}/>
              </div>
            </div>
          ) : seccionActiva === 'diligencias' ? (
            <DiligenciasFiscalia causaId={causaId} ruc={ruc} email={session?.user?.email || ''} registrarActividad={registrarActividad} onAccion={onAccion} />
          ) : (
            <textarea value={form[seccionActiva] || ''} onChange={e => handleChange(seccionActiva, e.target.value)} placeholder={seccionActual?.placeholder}
              style={{ width:'100%', height:'100%', minHeight:360, border:'none', outline:'none', resize:'none', fontSize:14, lineHeight:1.8, color:'#1E293B', background:'transparent', fontFamily:"'Inter',sans-serif", padding:0 }}/>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EDAD Y RÉGIMEN RPA/ADULTO ───────────────────────────────────────────────
