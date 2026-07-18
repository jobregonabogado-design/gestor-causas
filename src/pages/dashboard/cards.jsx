// Tarjetas de Audiencia e Imputado usadas dentro de la lista de una causa.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DELITOS_CATALOGO, CENTROS_PENALES } from './utils'
import { SearchableSelect, DelitosChips } from './primitives'

export function AudienciaCard({ a, onUpdate }) {
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
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>{field.label}</div>
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
      {a.ruc&&<div style={{fontSize:10,color:'#94a3b8',marginTop:4,fontFamily:'monospace'}}>RUC: {a.ruc}</div>}
      {historial.length>0&&(
        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #f1f5f9'}}>
          {historial.map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',marginBottom:2,...f}}>📝 {h}</div>)}
        </div>
      )}
    </div>
  )
}

export function ImputadoCard({ imp, idx, onUpdate, onDelete }) {
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
      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>{label}</div>
      {editField===field?(
        field==='lugar_detencion' ? (
          <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <SearchableSelect
                value={editValue}
                onChange={v=>setEditValue(v)}
                options={CENTROS_PENALES}
                placeholder="Buscar centro penal..."
                isDelito={false}
              />
            </div>
            <button style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{onUpdate(field,editValue);setEditField(null)}}>✓</button>
            <button style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,cursor:'pointer',...f}} onClick={()=>setEditField(null)}>✗</button>
          </div>
        ) : (
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
        )
      ):(
        <div onClick={()=>{setEditField(field);setEditValue(imp[field]||'')}}
          style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp[field]?'#1E293B':'#94a3b8',minHeight:36,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
          <span>{imp[field]||'Clic para agregar...'}</span>
          <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
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
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>Fecha de nacimiento</div>
          {editField==='fecha_nacimiento'?(
            <div style={{display:'flex',gap:6}}>
              <input type="date" style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'){onUpdate('fecha_nacimiento',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
              <button style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{onUpdate('fecha_nacimiento',editValue);setEditField(null)}}>✓</button>
              <button style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,cursor:'pointer',...f}} onClick={()=>setEditField(null)}>✗</button>
            </div>
          ):(
            <div onClick={()=>{setEditField('fecha_nacimiento');setEditValue(imp.fecha_nacimiento||'')}}
              style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.fecha_nacimiento?'#1E293B':'#94a3b8',minHeight:36,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
              <span>
                {imp.fecha_nacimiento || 'Clic para agregar...'}
                {imp.fecha_nacimiento && (() => {
                  const edad = calcularEdadActual(imp.fecha_nacimiento)
                  return edad !== null ? <span style={{marginLeft:8,fontSize:11,color:'#1E293B',fontWeight:600,background:'#eff6ff',padding:'1px 7px',borderRadius:10}}>
                    {edad} AÑOS HOY
                  </span> : null
                })()}
              </span>
              <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
            </div>
          )}
        </div>
        <Field2 label="Domicilio" field="domicilio" />
        <Field2 label="Otros antecedentes" field="otros_antecedentes"/>
      </div>
      {/* Delitos imputados a esta persona (puede diferir entre coimputados) */}
      <div style={{marginTop:12}}>
        <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Delitos imputados a esta persona</div>
        <DelitosChips value={imp.delitos} onChange={(v)=>onUpdate('delitos', v)} options={DELITOS_CATALOGO} />
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
  { key:'carpeta',       icon:'📁', label:'Carpeta y Documentos',   placeholder:null },
  { key:'diligencias',   icon:'📨', label:'Diligencias Fiscalía',   placeholder:null },
]

// ─── DILIGENCIAS ANTE FISCALÍA — declaración de imputado, petición de carpeta,
// entrevista con el fiscal, etc. Cada una nace con un FOLIO (número de
// seguimiento que entrega el portal de Fiscalía al momento de la solicitud —
// obligatorio, hay que exigirlo siempre) y más adelante recibe una respuesta
// por correo (aprobada, con fecha de citación, o rechazada con motivo). ──────
const TIPOS_DILIGENCIA = ['Declaración de imputado','Petición de carpeta','Entrevista con el fiscal','Reconstitución de escena','Careo','Otra diligencia']
const ESTADOS_DILIGENCIA = {
  pendiente:    { label:'Pendiente de respuesta',   color:'#92400e', bg:'#fff7ed', border:'#fed7aa' },
  aprobada:     { label:'Aprobada',                 color:'#065f46', bg:'#ecfdf5', border:'#a7f3d0' },
  con_citacion: { label:'Con fecha de citación',     color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe' },
  rechazada:    { label:'Rechazada',                color:'#991b1b', bg:'#fef2f2', border:'#fecaca' },
}

// ─── LECTURA AUTOMÁTICA DEL COMPROBANTE DE FISCALÍA ──────────────────────────
// Los PDF que entrega el portal "mi.Fiscalía en línea" tienen texto real (no
// son una foto escaneada), así que se puede leer sin OCR. Se carga pdf.js
// desde un CDN en tiempo de ejecución (no requiere agregar nada al
// package.json ni tocar el proceso de build).
let _pdfjsCargando = null
