// Componentes de UI pequeños y reutilizables del Dashboard: selector con
// búsqueda, chips de delitos, badges de estado y el campo editable base.
import { useState, useEffect, useMemo, useRef } from 'react'
import { estadoConfig, getBadgeConfig, SUBESTADOS_VIGENTE, SUBESTADOS_TERMINADA, TRIBUNALES_CHILE, DELITOS_CATALOGO, CENTROS_PENALES } from './utils'

export function SearchableSelect({ value, onChange, options, placeholder, isDelito }) {
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
          alignItems: 'center', minHeight: 38, fontFamily: "'Century Gothic','Inter',sans-serif",
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
                fontFamily: "'Century Gothic','Inter',sans-serif",
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {value && (
              <div
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', borderBottom: '1px solid #F8F9FC', fontFamily: "'Century Gothic','Inter',sans-serif" }}
              >
                — Limpiar selección
              </div>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: '#94a3b8', textAlign: 'center', fontFamily: "'Century Gothic','Inter',sans-serif" }}>
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
                    fontFamily: "'Century Gothic','Inter',sans-serif",
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
              <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8', textAlign: 'center', fontFamily: "'Century Gothic','Inter',sans-serif" }}>
                Escribe para filtrar más resultados...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── COMPONENTE DELITOS MÚLTIPLES (chips + agregar más) ──────────────────────
export function DelitosChips({ value, onChange, options }) {
  const [adding, setAdding] = useState(false)
  const [temp, setTemp] = useState('')
  const lista = (value || '').split('|').map(s => s.trim()).filter(Boolean)
  const f = { fontFamily:"'Century Gothic','Inter',sans-serif" }

  const agregar = (nuevo) => {
    if (!nuevo || lista.includes(nuevo)) { setAdding(false); setTemp(''); return }
    onChange([...lista, nuevo].join('|'))
    setAdding(false)
    setTemp('')
  }
  const quitar = (idx) => {
    onChange(lista.filter((_, i) => i !== idx).join('|'))
  }

  return (
    <div>
      {lista.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
          {lista.map((d, i) => (
            <div key={i} title={d} style={{ display:'flex', alignItems:'center', gap:7, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'5px 9px', maxWidth:'100%', minWidth:0 }}>
              <span style={{ fontSize:11, color:'#991b1b', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280, ...f }}>{d}</span>
              <button onClick={() => quitar(i)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#fca5a5', fontSize:12, padding:0, flexShrink:0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <SearchableSelect value={temp} onChange={v => agregar(v)} options={options} placeholder="Buscar delito..." isDelito={true} />
          </div>
          <button className="btn-secondary" style={{ padding:'8px 12px', fontSize:12, flexShrink:0 }} onClick={() => { setAdding(false); setTemp('') }}>✕</button>
        </div>
      ) : (
        <button className="btn-secondary" style={{ fontSize:12 }} onClick={() => setAdding(true)}>+ Agregar delito</button>
      )}
    </div>
  )
}

// ─── TARJETA DE DELITOS COLAPSABLE — angosta (no ocupa todo el ancho), con la
// misma dinámica de "clic para desplegar" que Cautelares. Se usa tanto para el
// caso de 1 imputado como para cada imputado cuando hay varios. ──────────────
export function DelitoCard({ nombreImputado, value, onChange, options }) {
  const [expanded, setExpanded] = useState(true)
  const lista = (value || '').split('|').map(s => s.trim()).filter(Boolean)
  const f = { fontFamily:"'Century Gothic','Inter',sans-serif" }
  return (
    <div style={{flex:'1 1 360px', maxWidth:460, minWidth:260}}>
      {nombreImputado && (
        <div style={{fontSize:11,fontWeight:700,color:'#1E293B',marginBottom:6,...f}}>👤 {nombreImputado}</div>
      )}
      <div
        className="fld"
        onClick={()=>setExpanded(v=>!v)}
        style={{
          cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'9px 12px', borderRadius: expanded ? '12px 12px 0 0' : 12, fontSize:13,
          color:'#1E293B', minHeight:34, background:'#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', ...f,
        }}>
        <span>{lista.length===0 ? 'Sin delitos' : `${lista.length} delito${lista.length!==1?'s':''}`}</span>
        <span style={{fontSize:11,color:'#94a3b8'}}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{background:'#F8F9FC',borderRadius:'0 0 12px 12px',padding:'12px',boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}}>
          <DelitosChips value={value} onChange={onChange} options={options} />
        </div>
      )}
    </div>
  )
}

const TMAP = {'JG VINA DEL MAR':'JG VIÑA DEL MAR','JG CONCEPCION':'JG CONCEPCIÓN','JG VALPARAISO':'JG VALPARAÍSO','JG QUILPUE':'JG QUILPUÉ','JG CHILLAN':'JG CHILLÁN','JG AYSEN':'JG AYSÉN','JG CANETE':'JG CAÑETE','TOP CANETE':'TOP CAÑETE','13 JG DE STGO':'13 JG STGO','TOP SERENA':'TOP LA SERENA'}
export const normT = t => t ? (TMAP[t.trim()] || t.trim()) : t
export const f = { fontFamily:"'Century Gothic','Inter',sans-serif" }

// ─── SEMÁFORO MEJORADO — solo causas vigentes ─────────────────────────────────
const getSemaforo = (updated_at, estado) => {
  if (estado !== 'vigente') return null
  if (!updated_at) return {
    color: '#991b1b', bg: '#fef2f2', border: '#fecaca',
    label: 'SIN ACTIVIDAD', dias: null, pulsar: true
  }
  const dias = Math.max(0, Math.floor((new Date() - new Date(updated_at)) / (1000*60*60*24)))
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

export function SemaforoTag({ updated_at, estado }) {
  const s = getSemaforo(updated_at, estado)
  if (!s) return null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: s.color, flexShrink: 0, display: 'inline-block',
        animation: s.pulsar ? 'semaforo-pulse 1.5s infinite' : 'none',
      }}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: s.color, ...f }}>
        {s.label}
      </span>
    </div>
  )
}

export function Badge({ estado, subestado }) {
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
export function BadgeEditor({ estado, subestado, onChangeEstado, onChangeSubestado }) {
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
            <div key={e} onClick={()=>{ onChangeEstado(e) }}
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

export function Field({ label, value, editable, editField, setEditField, editValue, setEditValue, onSave, full, fieldKey }) {
  const inp = { width:'100%', padding:'11px 14px', border:'none', borderRadius:14, fontSize:13, color:'#1E293B', background:'#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', ...f }
  const isTribunal = fieldKey === 'tribunal'
  const isDelito = fieldKey === 'delito'
  const isCentroPenal = fieldKey === 'centro_penal'
  const useDropdown = isTribunal || isDelito || isCentroPenal

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
                options={isTribunal ? TRIBUNALES_CHILE : isDelito ? DELITOS_CATALOGO : CENTROS_PENALES}
                placeholder={isTribunal ? 'Seleccionar tribunal...' : isDelito ? 'Buscar delito...' : 'Buscar centro penal...'}
                isDelito={isDelito}
              />
            </div>
          ) : (
            <input style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onSave();if(e.key==='Escape')setEditField(null)}} autoFocus/>
          )}
          <button className="btn-primary" style={{padding:'8px 14px',fontSize:12,flexShrink:0,borderRadius:14}} onClick={onSave}>✓</button>
          <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12,flexShrink:0,border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}} onClick={()=>setEditField(null)}>✗</button>
        </div>
      ) : (
        <div className={editable?'fld':''} onClick={()=>{if(editable){setEditField(label);setEditValue(value||'')}}} title={value||''}
          style={{ padding:'11px 14px', border:'none', borderRadius:14, fontSize:13, color:value?'#1E293B':'#94a3b8', minHeight:38, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:editable?'pointer':'default', background:'#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', maxWidth:'100%', minWidth:0, ...f }}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:'1 1 0%',minWidth:0}}>{value||(editable?'Clic para agregar...':'—')}</span>
          {editable && <span style={{fontSize:11,color:'#94a3b8',flexShrink:0,marginLeft:8}}>✏</span>}
        </div>
      )}
    </div>
  )
}

