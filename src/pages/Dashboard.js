import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { CAUSAS_SEED } from '../lib/seedData'
import CarpetaOneDrive from '../components/CarpetaOneDrive'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  .row-hover { transition:background 0.15s ease; cursor:pointer; }
  .row-hover:hover { background:#f0f7ff !important; }
  .stat-card { transition:all 0.25s cubic-bezier(0.4,0,0.2,1); cursor:pointer; }
  .stat-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(0,0,0,0.10) !important; }
  .tab-btn { transition:all 0.2s ease; border:none; background:none; cursor:pointer; font-family:'Inter',sans-serif; }
  .tab-btn:hover { color:#2563eb !important; }
  .fld { transition:border-color 0.2s,background 0.2s; }
  .fld:hover { border-color:#2563eb !important; background:#f8fbff !important; }
  .sort-col { cursor:pointer; user-select:none; transition:color 0.15s; }
  .sort-col:hover { color:#2563eb !important; }
  .btn-primary { font-family:'Inter',sans-serif; background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; border:none; border-radius:8px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(37,99,235,0.25); }
  .btn-primary:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(37,99,235,0.35); }
  .btn-secondary { font-family:'Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e2e8f0; border-radius:8px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; }
  .btn-secondary:hover { border-color:#2563eb; color:#2563eb; background:#f0f7ff; }
  .detail-enter { animation:detailIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes detailIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  input,select,textarea { font-family:'Inter',sans-serif !important; transition:border-color 0.2s,box-shadow 0.2s; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#2563eb !important; box-shadow:0 0 0 3px rgba(37,99,235,0.1) !important; }
  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .hide-mobile { display: none !important; }
  }
`

const estadoConfig = {
  vencido:      { label:'PLAZO VENCIDO', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  proximo:      { label:'POR VENCER',    color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
  apjo:         { label:'APJO',          color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe' },
  juicio_oral:  { label:'JUICIO ORAL',   color:'#e11d48', bg:'#fff1f2', border:'#fda4af' },
  terminada:    { label:'TERMINADA',     color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
  vigente:      { label:'VIGENTE',       color:'#059669', bg:'#f0fdf4', border:'#a7f3d0' },
}

function getBadgeConfig(estado, subestado) {
  if (subestado && estadoConfig[subestado]) return estadoConfig[subestado]
  return estadoConfig[estado] || { label:estado||'—', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' }
}

const TMAP = {'JG VINA DEL MAR':'JG VIÑA DEL MAR','JG CONCEPCION':'JG CONCEPCIÓN','JG VALPARAISO':'JG VALPARAÍSO','JG QUILPUE':'JG QUILPUÉ','JG CHILLAN':'JG CHILLÁN','JG AYSEN':'JG AYSÉN','JG CANETE':'JG CAÑETE','TOP CANETE':'TOP CAÑETE','13 JG DE STGO':'13 JG STGO','TOP SERENA':'TOP LA SERENA'}
const normT = t => t ? (TMAP[t.trim()] || t.trim()) : t
const f = { fontFamily:"'Inter',sans-serif" }

function Badge({ estado, subestado }) {
  const c = getBadgeConfig(estado, subestado)
  if (estado === 'terminada') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:'#64748b', background:'#f8fafc', border:'1px solid #e2e8f0', ...f }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:'#64748b', flexShrink:0 }}/>TERMINADA
    </span>
  )
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', gap:3, alignItems:'flex-start' }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:'#059669', background:'#f0fdf4', border:'1px solid #a7f3d0', ...f }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:'#059669', flexShrink:0 }}/>VIGENTE
      </span>
      {subestado && estadoConfig[subestado] && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase', color:c.color, background:c.bg, border:`1px solid ${c.border}`, ...f }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:c.color, flexShrink:0 }}/>{c.label}
        </span>
      )}
    </div>
  )
}

function Field({ label, value, editable, editField, setEditField, editValue, setEditValue, onSave, full }) {
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f172a', background:'#fff', ...f }
  return (
    <div style={{ gridColumn:full?'1/-1':'auto', marginBottom:2 }}>
      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontWeight:600, ...f }}>{label}</div>
      {editField===label ? (
        <div style={{ display:'flex', gap:6 }}>
          <input style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onSave();if(e.key==='Escape')setEditField(null)}} autoFocus/>
          <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={onSave}>✓</button>
          <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
        </div>
      ) : (
        <div className={editable?'fld':''} onClick={()=>{if(editable){setEditField(label);setEditValue(value||'')}}}
          style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:value?'#0f172a':'#cbd5e1', minHeight:38, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:editable?'pointer':'default', background:'#fff', ...f }}>
          <span>{value||(editable?'Clic para agregar...':'—')}</span>
          {editable && <span style={{fontSize:11,color:'#cbd5e1'}}>✏</span>}
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
  const inp = { width:'100%', padding:'7px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:12, color:'#0f172a', background:'#fff', ...f }

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
    <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:600,color:'#0f172a',...f}}>{a.tipo||'Audiencia'}</span>
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
  const inp = { width:'100%', padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f172a', background:'#fff', ...f }

  const Field2 = ({ label, field }) => (
    <div>
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>{label}</div>
      {editField===field?(
        <div style={{display:'flex',gap:6}}>
          <input style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){onUpdate(field,editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
          <button style={{background:'#2563eb',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{onUpdate(field,editValue);setEditField(null)}}>✓</button>
          <button style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,cursor:'pointer',...f}} onClick={()=>setEditField(null)}>✗</button>
        </div>
      ):(
        <div onClick={()=>{setEditField(field);setEditValue(imp[field]||'')}}
          style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp[field]?'#0f172a':'#cbd5e1',minHeight:36,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
          <span>{imp[field]||'Clic para agregar...'}</span>
          <span style={{fontSize:11,color:'#cbd5e1'}}>✏</span>
        </div>
      )}
    </div>
  )

  return (
    <div style={{background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:14,padding:'18px 20px',marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700,...f}}>{idx+1}</div>
          <div style={{fontSize:14,fontWeight:700,color:'#0f172a',...f}}>{imp.nombre||'Sin nombre'}</div>
        </div>
        <button onClick={onDelete} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'5px 12px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,...f}}>✕ Eliminar</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Field2 label="Nombre completo" field="nombre"/>
        <Field2 label="RUT" field="rut"/>
        <Field2 label="Nacionalidad" field="nacionalidad"/>
        <Field2 label="Fecha de nacimiento" field="fecha_nacimiento"/>
        <Field2 label="Domicilio" field="domicilio" />
        <Field2 label="Otros antecedentes" field="otros_antecedentes"/>
      </div>
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

// ─── FUNCIONES DE CÁLCULO DE PLAZO ───────────────────────────────────────────

// Días corridos desde la fecha de formalización
function calcularVencimiento(fechaInicio, diasPlazo) {
  if (!fechaInicio || !diasPlazo) return ''
  const inicio = new Date(fechaInicio + 'T12:00:00')
  inicio.setDate(inicio.getDate() + parseInt(diasPlazo))
  return inicio.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' })
}

// Parsea "DD-MM-YYYY" o "VENCE DD-MM-YYYY" → Date
function parseFechaCL(str) {
  if (!str) return null
  const limpio = str.replace(/VENCE\s*/i, '').trim()
  const partes = limpio.split(/[\/\-\.]/  )
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

// ─────────────────────────────────────────────────────────────────────────────

function PlazoCalculador({ causaId, plazoActual, aumentos, onGuardarAudiencia }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'' })
  const [guardando, setGuardando] = useState(false)
  const f = { fontFamily:"'Inter',sans-serif" }
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f172a', background:'#fff', ...f }

  // Calcular vencimiento acumulado desde todas las audiencias
  const calcularVencimientoTotal = (auds) => {
    if (!auds || auds.length === 0) return null
    // Ordenar por fecha
    const sorted = [...auds].sort((a,b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia))
    // La primera audiencia define el inicio
    const primera = sorted[0]
    const diasTotal = auds.reduce((s,a) => s + (parseInt(a.dias_plazo)||0), 0)
    return calcularVencimiento(primera.fecha_audiencia, diasTotal)
  }

  const vencimientoPreview = form.fecha_audiencia && form.dias_plazo
    ? calcularVencimiento(form.fecha_audiencia, form.dias_plazo)
    : ''

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
      {/* RESUMEN SUPERIOR */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#2563eb',letterSpacing:'-1px',...f}}>{aumentos?aumentos.length:0}</div>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Audiencias registradas</div>
        </div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#d97706',letterSpacing:'-1px',...f}}>{diasTotal}</div>
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Días corridos totales</div>
        </div>
        <div style={{
          background: subestado==='vencido'?'#fef2f2': subestado==='proximo'?'#fffbeb':'#f0fdf4',
          border: `1.5px solid ${subestado==='vencido'?'#fecaca':subestado==='proximo'?'#fde68a':'#a7f3d0'}`,
          borderRadius:12, padding:'14px 16px', textAlign:'center'
        }}>
          <div style={{fontSize:13,fontWeight:800,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#059669',...f}}>
            {vencFinal || '—'}
          </div>
          {diff !== null && (
            <div style={{fontSize:11,fontWeight:600,marginTop:4,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#64748b',...f}}>
              {subestado==='vencido' ? `Venció hace ${Math.abs(diff)} días` : subestado==='proximo' ? `⚠️ Vence en ${diff} días` : `Faltan ${diff} días`}
            </div>
          )}
          <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:2,fontWeight:600,...f}}>Vencimiento</div>
        </div>
      </div>

      {/* HISTORIAL DE AUDIENCIAS DE PLAZO */}
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Historial de audiencias de plazo</div>
      {(!aumentos||aumentos.length===0) && (
        <p style={{color:'#cbd5e1',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas. Agrega la audiencia de formalización para comenzar.</p>
      )}
      {aumentos && aumentos.map((a,i) => {
        // Calcular vencimiento acumulado hasta esta audiencia
        const audsHasta = [...aumentos].sort((x,y)=>x.fecha_audiencia.localeCompare(y.fecha_audiencia)).slice(0,i+1)
        const diasAcum = audsHasta.reduce((s,x)=>s+(parseInt(x.dias_plazo)||0),0)
        const vencAcum = calcularVencimiento(audsHasta[0].fecha_audiencia, diasAcum)
        return (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8}}>
            <div style={{width:30,height:30,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#0f172a',...f}}>{a.tipo_audiencia||'Audiencia'}</div>
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

      {/* FORMULARIO NUEVA AUDIENCIA */}
      {showForm ? (
        <div style={{background:'#f0f7ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:16,marginTop:12}}>
          <div style={{fontSize:12,fontWeight:700,color:'#2563eb',marginBottom:12,...f}}>
            {aumentos && aumentos.length === 0 ? '📋 Registrar audiencia de formalización' : '📋 Registrar nueva audiencia de plazo'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tipo de audiencia</div>
              <select style={inp} value={form.tipo_audiencia} onChange={e=>setForm(p=>({...p,tipo_audiencia:e.target.value}))}>
                <option>Formalización</option>
                <option>Control de detención + Formalización</option>
                <option>Ampliación de plazo</option>
                <option>Reapertura de investigación</option>
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de audiencia</div>
              <input type="date" style={inp} value={form.fecha_audiencia} onChange={e=>setForm(p=>({...p,fecha_audiencia:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días de plazo otorgados</div>
              <input type="number" style={inp} placeholder="Ej: 30, 90, 210" value={form.dias_plazo} onChange={e=>setForm(p=>({...p,dias_plazo:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Observación</div>
              <input style={inp} placeholder="Ej: Diligencias pendientes" value={form.observacion} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}/>
            </div>
          </div>
          {vencimientoPreview && (
            <div style={{marginBottom:12,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #bfdbfe',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:16}}>📅</span>
              <div>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento de este plazo</div>
                <div style={{fontSize:15,fontWeight:800,color:'#2563eb',...f}}>{vencimientoPreview}</div>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            <button className="btn-primary" style={{fontSize:12}} onClick={handleGuardar} disabled={guardando||!form.fecha_audiencia||!form.dias_plazo}>
              {guardando?'Guardando...':'💾 Guardar audiencia'}
            </button>
            <button className="btn-secondary" style={{fontSize:12}} onClick={()=>setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" style={{marginTop:12}} onClick={()=>setShowForm(true)}>
          + {aumentos && aumentos.length === 0 ? 'Registrar formalización' : 'Registrar nueva audiencia de plazo'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const getSemaforo = (updated_at) => {
  if (!updated_at) return { color:'#dc2626', title:'Sin actividad registrada' }
  const dias = Math.floor((new Date() - new Date(updated_at)) / (1000*60*60*24))
  if (dias <= 3) return { color:'#22c55e', title:`Trabajada hace ${dias} día${dias!==1?'s':''}` }
  if (dias <= 6) return { color:'#f59e0b', title:`Trabajada hace ${dias} días` }
  return { color:'#dc2626', title:`Sin actividad hace ${dias} días` }
}

export default function Dashboard({ session, registrarActividad }) {
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
  const [nuevaNota,setNuevaNota]=useState('')
  const [notas,setNotas]=useState([])
  const [audiencias,setAudiencias]=useState([])
  const [aumentos,setAumentos]=useState([])
  const [imputados,setImputados]=useState([])
  const [showAudForm,setShowAudForm]=useState(false)
  const [showAumentoForm,setShowAumentoForm]=useState(false)
  const [nuevaAud,setNuevaAud]=useState({fecha:'',hora:'',tipo:'',tribunal:selectedCausa?.tribunal||'',sala:'',resultado:'',notas:''})
  const [nuevoAumento,setNuevoAumento]=useState({fecha_audiencia:'',dias_aumento:'',observacion:''})
  const [saving,setSaving]=useState(false)
  const [showNuevaCausa,setShowNuevaCausa]=useState(false)
  const [showStats,setShowStats]=useState(false)
  const [nuevaCausa,setNuevaCausa]=useState({
    ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',
    cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',estado:'vigente'
  })

  useEffect(()=>{ loadCausas() },[])

  const loadCausas = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('causas').select('*').order('created_at', { ascending:false })
    if (!error) {
      const causasActualizadas = (data||[]).map(c => {
        // Solo recalcular subestado si es vigente Y no tiene subestado manual especial
        const subestadosEspeciales = ['apjo','juicio_oral']
        let subestado = c.subestado
        if (c.estado === 'vigente' && !subestadosEspeciales.includes(c.subestado)) {
          // Recalcular solo si tiene plazo en formato reconocible
          const autoSub = calcularSubestado(c.plazo)
          // Si el plazo es futuro y subestado dice vencido, corregir
          if (autoSub !== 'vencido' && c.subestado === 'vencido') {
            subestado = autoSub // corregir error
          } else if (autoSub) {
            subestado = autoSub // aplicar auto
          }
          // Si no hay plazo o plazo no reconocible, respetar el subestado guardado
        }
        return { ...c, tribunal: normT(c.tribunal), subestado }
      })
      setCausas(causasActualizadas)
    }
    setLoading(false)
  }

  const openCausa=async(c)=>{
    setSelectedCausa(c);setView('detail');setActiveTab('datos')
    const[{data:n},{data:a},{data:au},{data:imp}]=await Promise.all([
      supabase.from('notas').select('*').eq('causa_id',c.id).order('created_at',{ascending:false}),
      supabase.from('audiencias').select('*').or(`causa_id.eq.${c.id},ruc.eq.${c.ruc}`).order('fecha',{ascending:false}),
      supabase.from('aumentos_plazo').select('*').eq('causa_id',c.id).order('fecha_audiencia',{ascending:true}),
      supabase.from('imputados').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
    ])
    setNotas(n||[]);setAudiencias(a||[]);setAumentos(au||[]);setImputados(imp||[])
  }

  const updateField=async(field,value)=>{
    setSaving(true)
    const{error}=await supabase.from('causas').update({[field]:value,updated_at:new Date()}).eq('id',selectedCausa.id)
    if(!error){
      const u={...selectedCausa,[field]:value};setSelectedCausa(u);setCausas(prev=>prev.map(c=>c.id===u.id?u:c))
      if (registrarActividad) registrarActividad('accion', `Editó campo "${field}" en RUC ${selectedCausa.ruc}`)
    }
    setEditField(null);setSaving(false)
  }

  const saveNota=async()=>{
    if(!nuevaNota.trim())return;setSaving(true)
    const{data,error}=await supabase.from('notas').insert({causa_id:selectedCausa.id,contenido:nuevaNota}).select().single()
    if(!error)setNotas(prev=>[data,...prev])
    setNuevaNota('');setSaving(false)
  }

  const saveAudiencia=async()=>{
    if(!nuevaAud.fecha)return;setSaving(true)
    const{data,error}=await supabase.from('audiencias').insert({causa_id:selectedCausa.id,ruc:selectedCausa.ruc,imputado:selectedCausa.imputado?.split('|')[0],...nuevaAud}).select().single()
    if(!error){
      setAudiencias(prev=>[data,...prev].sort((a,b)=>b.fecha.localeCompare(a.fecha)))
      if (registrarActividad) registrarActividad('accion', `Nueva audiencia agregada en RUC ${selectedCausa.ruc}: ${nuevaAud.tipo||'Audiencia'} ${nuevaAud.fecha}`)
    }
    setNuevaAud({fecha:'',hora:'',tipo:'',tribunal:selectedCausa?.tribunal||'',sala:'',resultado:'',notas:''});setShowAudForm(false);setSaving(false)
  }

  const saveAumento=async()=>{
    if(!nuevoAumento.fecha_audiencia||!nuevoAumento.dias_aumento)return;setSaving(true)
    const total=aumentos.reduce((s,a)=>s+(a.dias_aumento||0),0)+parseInt(nuevoAumento.dias_aumento)
    const{data,error}=await supabase.from('aumentos_plazo').insert({causa_id:selectedCausa.id,fecha_audiencia:nuevoAumento.fecha_audiencia,dias_aumento:parseInt(nuevoAumento.dias_aumento),plazo_acumulado:total,observacion:nuevoAumento.observacion}).select().single()
    if(!error)setAumentos(prev=>[...prev,data])
    setNuevoAumento({fecha_audiencia:'',dias_aumento:'',observacion:''});setShowAumentoForm(false);setSaving(false)
  }

  const saveCausa = async () => {
    if (!nuevaCausa.ruc) return
    setSaving(true)
    let plazoFinal = nuevaCausa.plazo
    if (nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo) {
      plazoFinal = 'VENCE ' + calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)
    }
    const subestadoAuto = calcularSubestado(plazoFinal)
    const causaData = {
      ruc: nuevaCausa.ruc,
      rit: nuevaCausa.rit,
      tribunal: nuevaCausa.tribunal,
      delito: nuevaCausa.delito,
      imputado: nuevaCausa.imputado,
      fiscal: nuevaCausa.fiscal,
      cautelar: nuevaCausa.cautelar,
      centro_penal: nuevaCausa.centro_penal,
      plazo: plazoFinal,
      estado: nuevaCausa.estado,
      subestado: subestadoAuto,
    }
    const { data, error } = await supabase.from('causas').insert(causaData).select().single()
    if (!error) {
      setCausas(prev => [data, ...prev])
      setShowNuevaCausa(false)
      if (registrarActividad) registrarActividad('accion', `Nueva causa agregada: RUC ${causaData.ruc}`)
      setNuevaCausa({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',estado:'vigente'})
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
    total:causas.length,
    vigente:causas.filter(c=>c.estado==='vigente').length,
    terminada:causas.filter(c=>c.estado==='terminada').length,
    vencido:causas.filter(c=>c.subestado==='vencido').length,
    proximo:causas.filter(c=>c.subestado==='proximo').length,
    apjo:causas.filter(c=>c.subestado==='apjo').length,
    juicioOral:causas.filter(c=>c.subestado==='juicio_oral'||c.tiene_top===true).length,
  }),[causas])

  const chartDelitos=useMemo(()=>{const map={};causas.forEach(c=>{if(c.delito){const k=c.delito.substring(0,28);map[k]=(map[k]||0)+1}});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([name,value])=>({name,value}))},[causas])
  const chartTribunales=useMemo(()=>{const map={};causas.forEach(c=>{if(c.tribunal){map[c.tribunal]=(map[c.tribunal]||0)+1}});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}))},[causas])
  const COLORS=['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777','#65a30d','#ea580c','#6366f1']
  const inp={width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#0f172a',background:'#fff',...f}

  if(view==='detail'&&selectedCausa){
    const c=causas.find(x=>x.id===selectedCausa.id)||selectedCausa
    const totalDias=aumentos.reduce((s,a)=>s+(a.dias_aumento||0),0)
    return(
      <div style={{background:'#f8fafc',minHeight:'100vh',...f}} className="detail-enter">
        <style>{CSS}</style>
        <div style={{maxWidth:1060,margin:'0 auto',padding:'24px 28px'}}>
          <button className="btn-secondary" onClick={()=>setView('list')} style={{marginBottom:20,fontSize:13}}>← Volver</button>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px 16px 0 0',padding:'24px 28px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:6,letterSpacing:'-0.5px',...f}}>RUC <span style={{color:'#2563eb'}}>{c.ruc}</span></div>
                <div style={{fontSize:13,color:'#94a3b8',display:'flex',gap:16,flexWrap:'wrap',...f}}>
                  <span>RIT <span style={{color:'#475569',fontWeight:500}}>{c.rit||'—'}</span></span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.tribunal}</span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.imputado}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saving&&<span style={{fontSize:11,color:'#94a3b8',...f}}>Guardando...</span>}
                {c.esta_detenido&&<span style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',...f}}>🔒 Detenido</span>}
                <Badge estado={c.estado} subestado={c.subestado}/>
              </div>
            </div>
          </div>
          <div style={{background:'#fff',borderLeft:'1px solid #e2e8f0',borderRight:'1px solid #e2e8f0',display:'flex',overflowX:'auto',borderBottom:'2px solid #f1f5f9'}}>
            {[['datos','Datos'],['imputado','Imputado'],['plazo','Plazo'],['audiencias','Audiencias'],['top','Juicio Oral'],['notas','Notas'],['carpeta','Carpeta']].map(([k,l])=>(
              <button key={k} className="tab-btn" onClick={()=>setActiveTab(k)} style={{padding:'13px 20px',fontSize:13,fontWeight:activeTab===k?600:400,color:activeTab===k?'#2563eb':'#94a3b8',borderBottom:`2px solid ${activeTab===k?'#2563eb':'transparent'}`,whiteSpace:'nowrap',marginBottom:-2}}>{l}</button>
            ))}
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderTop:'none',borderRadius:'0 0 16px 16px',padding:28,boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
            {activeTab==='datos'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {[
                  {key:'imputado',label:'Imputado(s)',full:true,editable:true},
                  {key:'delito',label:'Delito',full:true,editable:true},
                  {key:'tribunal',label:'Tribunal',editable:true},
                  {key:'rit',label:'RIT JG',editable:true},
                  {key:'fiscal',label:'Fiscal a cargo',editable:true},
                  {key:'cautelar',label:'Cautelar procesal',editable:true},
                  {key:'centro_penal',label:'Centro Penal',editable:true},
                  {key:'plazo',label:'Plazo / Vencimiento',editable:true,full:true},
                ].map(field=>(
                  <Field key={field.key} label={field.label} value={c[field.key]} editable={field.editable} full={field.full} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                ))}
                <div style={{gridColumn:'1/-1',marginTop:8}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Imputados adicionales</div>
                  {(c.imputado||'').split('|').filter((_,i)=>i>0).map((imp,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:6,alignItems:'center'}}>
                      <div style={{flex:1,padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#0f172a',background:'#f8fafc',...f}}>{imp.trim()}</div>
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
                <div style={{gridColumn:'1/-1',marginTop:8}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Estado Procesal</div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Estado principal</div>
                    <div style={{display:'flex',gap:8}}>
                      {[{k:'vigente',v:estadoConfig.vigente},{k:'terminada',v:estadoConfig.terminada}].map(({k,v})=>(
                        <button key={k} onClick={()=>updateField('estado',k)} style={{padding:'7px 18px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:600,border:`1.5px solid ${c.estado===k?v.color:v.border}`,background:c.estado===k?v.bg:'#fff',color:c.estado===k?v.color:'#94a3b8',transition:'all 0.2s',...f}}>{v.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Subestado (solo para vigentes)</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {[{k:'',label:'Sin subestado',color:'#94a3b8',border:'#e2e8f0',bg:'#f8fafc'},{k:'proximo',v:estadoConfig.proximo},{k:'vencido',v:estadoConfig.vencido},{k:'apjo',v:estadoConfig.apjo},{k:'juicio_oral',v:estadoConfig.juicio_oral}].map((item)=>{
                        const k=item.k; const v=item.v||item
                        return <button key={k} onClick={()=>updateField('subestado',k||null)} style={{padding:'7px 18px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:600,border:`1.5px solid ${(c.subestado||'')=== k?v.color:v.border||'#e2e8f0'}`,background:(c.subestado||'')===k?v.bg||'#f8fafc':'#fff',color:(c.subestado||'')===k?v.color||'#94a3b8':'#94a3b8',transition:'all 0.2s',...f}}>{v.label}</button>
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab==='imputado'&&(
              <div>
                {imputados.map((imp,idx)=>(
                  <ImputadoCard key={imp.id} imp={imp} idx={idx} onUpdate={async(field,value)=>{
                    await supabase.from('imputados').update({[field]:value}).eq('id',imp.id)
                    setImputados(prev=>prev.map(x=>x.id===imp.id?{...x,[field]:value}:x))
                  }} onDelete={async()=>{
                    if(!window.confirm('¿Eliminar este imputado?'))return
                    await supabase.from('imputados').delete().eq('id',imp.id)
                    setImputados(prev=>prev.filter(x=>x.id!==imp.id))
                  }}/>
                ))}
                <button className="btn-secondary" style={{marginTop:16}} onClick={async()=>{
                  const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:'Nuevo imputado'}).select().single()
                  if(data)setImputados(prev=>[...prev,data])
                }}>+ Agregar imputado</button>
              </div>
            )}
            {activeTab==='plazo'&&(
              <div>

                <PlazoCalculador
                  causaId={c.id}
                  plazoActual={c.plazo}
                  aumentos={aumentos}
                  onGuardarAudiencia={async(form)=>{
                    const{data,error}=await supabase.from('aumentos_plazo').insert({
                      causa_id:c.id,
                      fecha_audiencia:form.fecha_audiencia,
                      tipo_audiencia:form.tipo_audiencia,
                      dias_plazo:parseInt(form.dias_plazo),
                      dias_aumento:parseInt(form.dias_plazo),
                      observacion:form.observacion,
                    }).select().single()
                    if(!error){
                      const nuevosAumentos=[...aumentos,data].sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                      setAumentos(nuevosAumentos)
                      // Recalcular vencimiento total y actualizar causa
                      const diasTotal=nuevosAumentos.reduce((s,a)=>s+(parseInt(a.dias_plazo)||0),0)
                      const primera=nuevosAumentos[0]
                      const nuevoVenc='VENCE '+calcularVencimiento(primera.fecha_audiencia,diasTotal)
                      const nuevoSub=calcularSubestado(nuevoVenc)
                      await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                      const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub}
                      setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                    }
                  }}
                />
              </div>
            )}
            {activeTab==='audiencias'&&(
              <div>
                {audiencias.map(a=>(
                  <AudienciaCard key={a.id} a={a} onUpdate={async(updated,motivo)=>{
                    const historial = a.notas ? a.notas + `\n[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}` : `[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}`
                    const{error}=await supabase.from('audiencias').update({...updated,notas:historial}).eq('id',a.id)
                    if(!error)setAudiencias(prev=>prev.map(x=>x.id===a.id?{...x,...updated,notas:historial}:x))
                  }}/>
                ))}
                {audiencias.length===0&&<p style={{color:'#cbd5e1',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
                {showAudForm&&(
                  <div style={{background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',ph:'Formalización, APJO, JO...'},{key:'tribunal',label:'Tribunal',ph:'Ej: 4 JG STGO'},{key:'sala',label:'Sala',ph:'Ej: 903'},{key:'resultado',label:'Resultado',ph:'Resultado'},{key:'notas',label:'Observaciones',ph:'Notas'}].map(field=>(
                        <div key={field.key}><div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>{field.label}</div><input type={field.type||'text'} style={inp} placeholder={field.ph} value={nuevaAud[field.key]} onChange={e=>setNuevaAud(p=>({...p,[field.key]:e.target.value}))}/></div>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:8}}><button className="btn-primary" onClick={saveAudiencia} disabled={saving}>{saving?'Guardando...':'Guardar'}</button><button className="btn-secondary" onClick={()=>setShowAudForm(false)}>Cancelar</button></div>
                  </div>
                )}
                <button className="btn-secondary" onClick={()=>setShowAudForm(true)}>+ Nueva audiencia</button>
              </div>
            )}
            {activeTab==='top'&&(
              <div>
                <p style={{fontSize:13,color:'#94a3b8',marginBottom:20,lineHeight:1.7,...f}}>Cuando la causa pasa a Juicio Oral se asigna un nuevo RIT y Tribunal bajo el mismo RUC <span style={{fontFamily:'monospace',color:'#475569'}}>{c.ruc}</span>.</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:c.tiene_top?'#faf5ff':'#f8fafc',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:12,padding:'16px 20px',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:c.tiene_top?'#7c3aed':'#64748b',...f}}>{c.tiene_top?'⚖️ En Juicio Oral':'⚖️ Sin Juicio Oral asignado'}</div>
                    {c.tiene_top&&<div style={{fontSize:12,color:'#a78bfa',marginTop:3,...f}}>{c.tribunal_top||'—'} · RIT {c.rit_top||'—'}</div>}
                  </div>
                  <button onClick={()=>updateField('tiene_top',!c.tiene_top)} style={{background:c.tiene_top?'#faf5ff':'#fff',color:c.tiene_top?'#7c3aed':'#64748b',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:8,padding:'7px 18px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>{c.tiene_top?'Desactivar':'Activar JO'}</button>
                </div>
                {c.tiene_top&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {[{key:'tribunal_top',label:'Tribunal TOP'},{key:'rit_top',label:'RIT Juicio Oral'}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab==='notas'&&(
              <div>
                {notas.map(n=>(
                  <div key={n.id} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',marginBottom:8}}>
                    <div style={{fontSize:10,color:'#cbd5e1',marginBottom:6,fontWeight:500,...f}}>{new Date(n.created_at).toLocaleString('es-CL')}</div>
                    <div style={{fontSize:13,color:'#374151',whiteSpace:'pre-wrap',lineHeight:1.7,...f}}>{n.contenido}</div>
                  </div>
                ))}
                {notas.length===0&&<p style={{color:'#cbd5e1',fontSize:13,marginBottom:14,...f}}>Sin notas.</p>}
                <textarea style={{...inp,minHeight:100,resize:'vertical',marginTop:8}} placeholder="Nueva nota..." value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}/>
                <button className="btn-primary" style={{marginTop:10}} onClick={saveNota} disabled={saving}>{saving?'Guardando...':'+ Agregar nota'}</button>
              </div>
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
    <div style={{background:'#f8fafc',minHeight:'100vh',...f}}>
      <style>{CSS}</style>
      <div style={{maxWidth:1380,margin:'0 auto',padding:'28px'}}>

        {/* ALERTA VENCIDO */}
        {stats.vencido>0&&(
          <div style={{background:'linear-gradient(135deg,#fef2f2,#fff1f0)',border:'1px solid #fecaca',borderRadius:12,padding:'13px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:10,boxShadow:'0 2px 8px rgba(220,38,38,0.08)'}}>
            <div style={{width:32,height:32,background:'linear-gradient(135deg,#ef4444,#dc2626)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🚨</div>
            <span style={{fontSize:13,color:'#991b1b',fontWeight:600,...f}}>{stats.vencido} causa{stats.vencido>1?'s':''} con plazo VENCIDO — Revisión urgente requerida</span>
          </div>
        )}

        {/* ALERTA POR VENCER */}
        {stats.proximo>0&&(
          <div style={{background:'linear-gradient(135deg,#fffbeb,#fef9c3)',border:'1px solid #fde68a',borderRadius:12,padding:'13px 20px',marginBottom:24,display:'flex',alignItems:'center',gap:10,boxShadow:'0 2px 8px rgba(217,119,6,0.08)'}}>
            <div style={{width:32,height:32,background:'linear-gradient(135deg,#f59e0b,#d97706)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>⚠️</div>
            <span style={{fontSize:13,color:'#92400e',fontWeight:600,...f}}>{stats.proximo} causa{stats.proximo>1?'s':''} POR VENCER en los próximos 3 días — Atención requerida</span>
          </div>
        )}

        {/* Si no hay alertas, dejar el margen igual */}
        {stats.vencido===0&&stats.proximo===0&&<div style={{marginBottom:24}}/>}

        <div className='stats-grid' style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:24}}>
          {[
            {key:'',         label:'Total',        num:stats.total,       color:'#0f172a', grad:'linear-gradient(135deg,#1e293b,#0f172a)', border:'#e2e8f0', light:'#f8fafc'},
            {key:'vigente',  label:'Vigentes',     num:stats.vigente,     color:'#059669', grad:'linear-gradient(135deg,#10b981,#059669)', border:'#a7f3d0', light:'#f0fdf4'},
            {key:'terminada',label:'Terminadas',   num:stats.terminada,   color:'#64748b', grad:'linear-gradient(135deg,#94a3b8,#64748b)', border:'#e2e8f0', light:'#f8fafc'},
            {key:'vencido',  label:'Plazo Vencido',num:stats.vencido,     color:'#dc2626', grad:'linear-gradient(135deg,#ef4444,#dc2626)', border:'#fecaca', light:'#fef2f2'},
            {key:'proximo',  label:'Por Vencer',   num:stats.proximo,     color:'#d97706', grad:'linear-gradient(135deg,#f59e0b,#d97706)', border:'#fde68a', light:'#fffbeb'},
            {key:'apjo',     label:'APJO',         num:stats.apjo,        color:'#7c3aed', grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)', border:'#ddd6fe', light:'#faf5ff'},
            {key:'top',      label:'Juicio Oral',  num:stats.juicioOral,  color:'#0891b2', grad:'linear-gradient(135deg,#06b6d4,#0891b2)', border:'#a5f3fc', light:'#ecfeff'},
          ].map(st=>{
            const active=filterEstado===st.key&&st.key!==''
            return(
              <div key={st.key} className="stat-card" onClick={()=>setFilterEstado(filterEstado===st.key?'':st.key)}
                style={{background:active?st.grad:'#fff',border:`1.5px solid ${active?'transparent':st.border}`,borderRadius:14,padding:'16px 18px',boxShadow:active?`0 8px 24px ${st.color}33`:'0 1px 4px rgba(0,0,0,0.04)',position:'relative',overflow:'hidden'}}>
                {active&&<div style={{position:'absolute',top:-10,right:-10,width:60,height:60,background:'rgba(255,255,255,0.15)',borderRadius:'50%'}}/>}
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:active?'rgba(255,255,255,0.7)':st.color,marginBottom:10,...f}}>{st.label}</div>
                <div style={{fontSize:34,fontWeight:900,color:active?'#fff':st.color,lineHeight:1,letterSpacing:'-2px',...f}}>{st.num}</div>
              </div>
            )
          })}
        </div>

        {showStats&&(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:28,marginBottom:24,boxShadow:'0 2px 12px rgba(0,0,0,0.05)'}}>
            <div style={{fontSize:17,fontWeight:800,color:'#0f172a',marginBottom:24,letterSpacing:'-0.5px',...f}}>Estadísticas del portfolio</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>
              <div className="hide-mobile">
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Top Delitos</div>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={chartDelitos} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {chartDelitos.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,fontSize:12,fontFamily:'Inter,sans-serif'}} formatter={(v,n)=>[v+' causas',n]}/>
                    <Legend iconType="circle" iconSize={8} formatter={v=>v.substring(0,24)} wrapperStyle={{fontSize:11,fontFamily:'Inter,sans-serif',color:'#64748b'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Causas por Tribunal</div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartTribunales} layout="vertical" margin={{left:8,right:24,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8',fontFamily:'Inter,sans-serif'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b',fontFamily:'Inter,sans-serif'}} width={110} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,fontSize:12,fontFamily:'Inter,sans-serif'}}/>
                    <Bar dataKey="value" radius={[0,6,6,0]}>{chartTribunales.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1,minWidth:260,position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}>🔍</span>
            <input style={{...inp,paddingLeft:36,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}} placeholder="Buscar por RUC, RIT, imputado, delito, tribunal..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select style={{...inp,width:'auto',minWidth:180}} value={filterTribunal} onChange={e=>setFilterTribunal(e.target.value)}>
            <option value="">Todos los tribunales</option>
            {tribunales.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{...inp,width:'auto',minWidth:160}} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>{filtered.length} resultado{filtered.length!==1?'s':''}</span>
          <button className="btn-primary" onClick={()=>setShowNuevaCausa(true)}>+ Nueva causa</button>
          <button className="btn-secondary" onClick={()=>setShowStats(!showStats)} style={{borderColor:showStats?'#2563eb':'#e2e8f0',color:showStats?'#2563eb':'#374151'}}>{showStats?'Ocultar':'📊 Estadísticas'}</button>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:60,color:'#94a3b8',fontSize:14,...f}}>Cargando causas...</div>
        ):(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,boxShadow:'0 2px 12px rgba(0,0,0,0.05)',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'2px solid #f1f5f9',background:'#fafbff'}}>
                  {[{key:'ruc',label:'RUC'},{key:'rit',label:'RIT'},{key:'tribunal',label:'Tribunal'},{key:'imputado',label:'Imputado'},{key:'delito',label:'Delito'},{key:'fiscal',label:'Fiscal'},{key:'plazo',label:'Plazo'},{key:'estado',label:'Estado'}].map(col=>(
                    <th key={col.key} className="sort-col" onClick={()=>handleSort(col.key)} style={{padding:'13px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:sortCol===col.key?'#2563eb':'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,...f}}>
                      {col.label}<SortIcon col={col.key}/>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c)=>(
                  <tr key={c.id} className="row-hover" onClick={()=>openCausa(c)} style={{borderBottom:'1px solid #f8fafc',background:'#fff'}}>
                    <td style={{padding:'12px 16px',fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#0f172a'}}>{c.ruc}</td>
                    <td style={{padding:'12px 16px',fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {(()=>{const s=getSemaforo(c.updated_at);return <span title={s.title} style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0,display:'inline-block',cursor:'help'}}/>})()}
                        {c.rit||'—'}
                      </div>
                    </td>
                    <td style={{padding:'12px 16px',fontSize:12,color:'#475569',fontWeight:500,...f}}>{c.tribunal}</td>
                    <td style={{padding:'12px 16px',...f}}><div style={{maxWidth:210,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,color:'#0f172a',fontWeight:500}} title={c.imputado}>{c.imputado}</div></td>
                    <td style={{padding:'12px 16px',...f}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,color:'#64748b'}} title={c.delito}>{c.delito||'—'}</div></td>
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

      {/* MODAL NUEVA CAUSA */}
      {showNuevaCausa&&(
        <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'5vh',zIndex:200,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&setShowNuevaCausa(false)}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:32,width:540,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#0f172a',marginBottom:24,letterSpacing:'-0.5px',...f}}>Nueva Causa</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

              {/* Campos normales */}
              {[
                {key:'ruc',label:'RUC *',ph:'Ej: 2600123456-7',full:true},
                {key:'rit',label:'RIT',ph:'Ej: 1234-2026'},
                {key:'tribunal',label:'Tribunal',ph:'Ej: 7 JG STGO'},
                {key:'imputado',label:'Imputado',ph:'Nombre completo',full:true},
                {key:'delito',label:'Delito',ph:'Tipo de delito',full:true},
                {key:'fiscal',label:'Fiscal',ph:'Nombre del fiscal'},
                {key:'cautelar',label:'Cautelar',ph:'Prisión preventiva...'},
              ].map(field=>(
                <div key={field.key} style={{gridColumn:field.full?'1/-1':'auto'}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{field.label}</div>
                  <input style={inp} placeholder={field.ph} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}

              {/* BLOQUE PLAZO ACD */}
              <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1.5px solid #a7f3d0',borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'#059669',marginBottom:14,...f}}>⏱ Cálculo de plazo ACD (días hábiles)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha inicio</div>
                    <input type="date" style={inp} value={nuevaCausa.fecha_inicio} onChange={e=>setNuevaCausa(p=>({...p,fecha_inicio:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días plazo</div>
                    <input type="number" style={inp} placeholder="Ej: 210" value={nuevaCausa.dias_plazo} onChange={e=>setNuevaCausa(p=>({...p,dias_plazo:e.target.value}))}/>
                  </div>
                </div>

                {/* Preview de vencimiento en tiempo real */}
                {nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo && (
                  <div style={{marginTop:10,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #a7f3d0',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:16}}>📅</span>
                    <div>
                      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento calculado</div>
                      <div style={{fontSize:15,fontWeight:800,color:'#059669',...f}}>
                        {calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{marginTop:12}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>O ingresa plazo manualmente</div>
                  <input style={inp} placeholder="VENCE DD-MM-YYYY" value={nuevaCausa.plazo} onChange={e=>setNuevaCausa(p=>({...p,plazo:e.target.value}))}/>
                </div>
              </div>

              {/* Estado */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Estado</div>
                <select style={inp} value={nuevaCausa.estado} onChange={e=>setNuevaCausa(p=>({...p,estado:e.target.value}))}>
                  {Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
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
