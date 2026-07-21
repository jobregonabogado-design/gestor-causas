// Tarjetas de Audiencia e Imputado usadas dentro de la lista de una causa.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DELITOS_CATALOGO, CENTROS_PENALES, calcularEdadActual, calcularFechaTerminoCondena, getBadgeConfig, normRut, formatearRut } from './utils'
import { SearchableSelect, DelitosChips } from './primitives'
import { calcularTotalAbono } from './cautelares'

export function AudienciaCard({ a, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [form, setForm] = useState({ fecha:a.fecha||'', hora:a.hora||'', tipo:a.tipo||'', resultado:a.resultado||'', tribunal:a.tribunal||'', sala:a.sala||'' })
  const [saving, setSaving] = useState(false)
  const f = { fontFamily:"'Manrope','Inter',sans-serif" }
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

// ✅ Muestra solo las unidades que corresponden — "5 años y 1 día" en vez de
// "5a 0m 1d" — para que se lea igual a como se dicta la condena en la práctica.
function formatearTiempoCondena(anos, meses, dias) {
  const partes = []
  if (anos) partes.push(`${anos} ${anos===1?'año':'años'}`)
  if (meses) partes.push(`${meses} ${meses===1?'mes':'meses'}`)
  if (dias) partes.push(`${dias} ${dias===1?'día':'días'}`)
  if (partes.length === 0) return '—'
  if (partes.length === 1) return partes[0]
  return partes.slice(0,-1).join(', ') + ' y ' + partes[partes.length-1]
}

export function ImputadoCard({ imp, idx, totalImputados, cautelares, esTitular, isMobile, causaId, onAbrirCausaAsociada, onUpdate, onDelete, onGuardarCondena, onVaciarCondena }) {
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [causasAsociadas, setCausasAsociadas] = useState([])
  const f = { fontFamily:"'Manrope','Inter',sans-serif" }
  const inp = { width:'100%', padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }
  // ✅ Mismo cálculo de abono que usa la pestaña Datos (Cautelares), para
  // descontarlo de la condena sin duplicar el criterio.
  const totalAbono = calcularTotalAbono(cautelares)
  const condenaCompleta = imp.condena_fecha_inicio && (imp.condena_anos || imp.condena_meses || imp.condena_dias)

  // ✅ Condena: modo lectura una vez cargada, con "Editar" que pide motivo
  // (igual patrón que Cautelares/Plazo) — salvo la primera vez que se
  // ingresa, que no pide motivo porque no hay nada previo que corregir.
  const [editandoCondena, setEditandoCondena] = useState(false)
  const [condenaForm, setCondenaForm] = useState({ fecha_inicio:'', tipo:'efectiva', anos:'', meses:'', dias:'' })
  const [motivoCondena, setMotivoCondena] = useState('')
  const mostrarFormCondena = editandoCondena || !condenaCompleta

  const iniciarEdicionCondena = () => {
    setCondenaForm({ fecha_inicio: imp.condena_fecha_inicio||'', tipo: imp.condena_tipo||'efectiva', anos: imp.condena_anos??'', meses: imp.condena_meses??'', dias: imp.condena_dias??'' })
    setMotivoCondena('')
    setEditandoCondena(true)
  }

  const guardarCondena = async () => {
    if (condenaCompleta && !motivoCondena.trim()) { alert('Ingresa el motivo de la corrección — queda registrado para tener trazabilidad.'); return }
    const campos = {
      condena_fecha_inicio: condenaForm.fecha_inicio || null,
      condena_tipo: condenaForm.tipo,
      condena_anos: condenaForm.anos===''?null:parseInt(condenaForm.anos),
      condena_meses: condenaForm.meses===''?null:parseInt(condenaForm.meses),
      condena_dias: condenaForm.dias===''?null:parseInt(condenaForm.dias),
    }
    await onGuardarCondena(campos, condenaCompleta ? motivoCondena.trim() : '')
    setEditandoCondena(false)
  }

  // ✅ "Causas asociadas al imputado" — busca en TODAS las causas si hay otro
  // imputado con el mismo RUT (persona repetida en distintas causas), para
  // no tener que acordarse manualmente ni buscar una por una. Se recalcula
  // solo cuando cambia el RUT de esta tarjeta (recién guardado o al cargar).
  const cargarCausasAsociadas = async (rut) => {
    if (!rut || rut.length < 6) { setCausasAsociadas([]); return }
    const rutNorm = normRut(rut)
    const { data } = await supabase.from('imputados').select('causa_id, rut').limit(1000)
    if (!data) { setCausasAsociadas([]); return }
    const idsAsociados = [...new Set(data.filter(d => d.rut && normRut(d.rut) === rutNorm && d.causa_id !== causaId).map(d => d.causa_id))]
    if (idsAsociados.length === 0) { setCausasAsociadas([]); return }
    const { data: causasData } = await supabase.from('causas').select('id, ruc, estado, subestado').in('id', idsAsociados)
    setCausasAsociadas(causasData || [])
  }

  useEffect(() => { cargarCausasAsociadas(imp.rut) }, [imp.rut, causaId])

  // ✅ Sincronización COMPLETA y en AMBOS sentidos al guardar el RUT — antes
  // solo "rellenaba" los campos vacíos de esta tarjeta con datos de otra
  // causa, así que si el RUT se agregaba DESPUÉS de corregir el nombre en
  // una causa, esa corrección nunca llegaba a las demás (dependía del orden
  // en que se editara cada cosa). Ahora, cada vez que se guarda el RUT: por
  // cada campo (nombre, nacionalidad, domicilio, fecha de nacimiento, otros
  // antecedentes) se busca el valor MÁS COMPLETO (el más largo) entre TODAS
  // las causas con ese RUT, y se pareja en todas — sin importar en cuál se
  // haya escrito ni en qué orden.
  const buscarPorRut = async (rut) => {
    if (!rut || rut.length < 6) return
    const rutNorm = normRut(rut)
    const { data, error } = await supabase.from('imputados').select('*').limit(500)
    if (error || !data || data.length === 0) return
    const coincidencias = data.filter(d => d.rut && normRut(d.rut) === rutNorm)
    if (coincidencias.length === 0) return
    const campos = ['nombre','nacionalidad','domicilio','fecha_nacimiento','otros_antecedentes']
    const mejorValor = {}
    for (const campo of campos) {
      let mejor = ''
      for (const c of coincidencias) {
        const val = (c[campo] || '').trim()
        if (val.length > mejor.length) mejor = val
      }
      if (mejor) mejorValor[campo] = mejor
    }
    await Promise.all(coincidencias.map(async c => {
      const cambios = {}
      for (const campo of campos) {
        if (mejorValor[campo] && (c[campo] || '').trim() !== mejorValor[campo]) cambios[campo] = mejorValor[campo]
      }
      if (Object.keys(cambios).length === 0) return
      if (c.id === imp.id) {
        // La tarjeta actual: pasa por onUpdate para que la pantalla se
        // actualice al toque (y de paso guarda en la base igual que siempre).
        for (const campo of Object.keys(cambios)) onUpdate(campo, cambios[campo])
      } else {
        await supabase.from('imputados').update(cambios).eq('id', c.id)
      }
    }))
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
            onKeyDown={e=>{if(e.key==='Enter'){const v=field==='rut'?formatearRut(editValue):editValue;onUpdate(field,v);setEditField(null);if(field==='rut')buscarPorRut(v)}if(e.key==='Escape')setEditField(null)}}
            onBlur={()=>{ if(field==='rut' && editValue) buscarPorRut(editValue) }}
            autoFocus/>
          <button style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}} onClick={()=>{const v=field==='rut'?formatearRut(editValue):editValue;onUpdate(field,v);setEditField(null);if(field==='rut')buscarPorRut(v)}}>✓</button>
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
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          {/* El numerito solo sirve para distinguir coimputados — con 1 solo
              imputado no aporta nada y solo satura, así que se oculta. */}
          {totalImputados > 1 && (
            <div style={{width:20,height:20,background:'linear-gradient(135deg,#2563eb,#1d4ed8)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700,flexShrink:0,...f}}>{idx+1}</div>
          )}
          <div style={{fontSize:14,fontWeight:700,color:'#1E293B',minWidth:0,...f}}>{imp.nombre||'Sin nombre'}</div>
        </div>
        <button onClick={onDelete} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'5px 12px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,...f}}>✕ Eliminar</button>
      </div>
      <details className="seccion-plegable" open={!isMobile} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px'}}>
        <summary style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center',...f}}>
          Datos personales
          <span className="seccion-chevron" style={{fontSize:12}}>▾</span>
        </summary>
        <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
        <Field2 label="Nombre completo" field="nombre"/>
        <Field2 label="RUT" field="rut"/>
        <Field2 label="Nacionalidad" field="nacionalidad"/>
        <div>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>Fecha de nacimiento</div>
          {editField==='fecha_nacimiento'?(
            <div style={{display:'flex',gap:6}}>
              <input type="date" style={inp} value={editValue} onChange={e=>setEditValue(e.target.value)}
                onBlur={()=>{if(editValue)onUpdate('fecha_nacimiento',editValue)}}
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
      </details>
      {/* ✅ Causas asociadas al imputado — mismo RUT en otra(s) causa(s). Útil
          para no tener que acordarse/buscar a mano cuando una persona ya
          tiene otras causas registradas en el sistema. */}
      {causasAsociadas.length > 0 && (
        <div style={{marginTop:12,background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'12px 14px'}}>
          <div style={{fontSize:10,color:'#1e40af',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:700,...f}}>
            🔗 Causas asociadas al imputado ({causasAsociadas.length})
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {causasAsociadas.map(ca => {
              const badge = getBadgeConfig(ca.estado, ca.subestado)
              return (
                <button key={ca.id} onClick={()=>onAbrirCausaAsociada && onAbrirCausaAsociada(ca.id)}
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,background:'#fff',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:12,...f}}>
                  <span style={{fontWeight:600,color:'#1e40af'}}>RUC {ca.ruc}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:10,color:badge.color,background:badge.bg,border:`1px solid ${badge.border}`}}>{badge.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
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

      {/* ✅ Condena — inicio + tipo (efectiva/sustitutiva) + tiempo (años/meses/
          días), descontando el abono ya registrado en Cautelares. La fecha de
          término se calcula sola, aparte, siempre en días corridos. Una vez
          cargada, corregirla pide motivo (igual que Cautelares); vaciarla del
          todo es solo para el titular. */}
      <div style={{marginTop:14,background:'#F8F9FC',border:'1.5px solid #e2e8f0',borderRadius:10,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>⚖️ Condena</div>
          {condenaCompleta && !editandoCondena && (
            <div style={{display:'flex',gap:10}}>
              <button onClick={iniciarEdicionCondena} style={{fontSize:11,color:'#2563eb',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>✏ Editar</button>
              {esTitular && <button onClick={()=>onVaciarCondena()} style={{fontSize:11,color:'#94a3b8',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>🗑 Vaciar Condena</button>}
            </div>
          )}
        </div>

        {mostrarFormCondena ? (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>Tipo de condena</div>
                <select style={inp} value={condenaForm.tipo} onChange={e=>setCondenaForm(p=>({...p,tipo:e.target.value}))}>
                  <option value="efectiva">Efectiva</option>
                  <option value="sustitutiva">Pena sustitutiva</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>{condenaForm.tipo==='sustitutiva' ? 'Inicio pena sustitutiva' : 'Inicio condena efectiva'}</div>
                <input type="date" style={inp} value={condenaForm.fecha_inicio} onChange={e=>setCondenaForm(p=>({...p,fecha_inicio:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:600,...f}}>Tiempo de condena</div>
                <div style={{display:'flex',gap:6}}>
                  <input type="number" min="0" placeholder="Años" style={inp} value={condenaForm.anos} onChange={e=>setCondenaForm(p=>({...p,anos:e.target.value}))}/>
                  <input type="number" min="0" max="11" placeholder="Meses" style={inp} value={condenaForm.meses} onChange={e=>setCondenaForm(p=>({...p,meses:e.target.value}))}/>
                  <input type="number" min="0" placeholder="Días" style={inp} value={condenaForm.dias} onChange={e=>setCondenaForm(p=>({...p,dias:e.target.value}))}/>
                </div>
              </div>
              {condenaCompleta && (
                <div style={{gridColumn:'1/-1'}}>
                  <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.2,marginBottom:5,fontWeight:700,...f}}>Motivo de la corrección *</div>
                  <input style={{...inp,borderColor:'#fecaca'}} placeholder="Ej: Se corrigió el tiempo de condena tras la sentencia definitiva..." value={motivoCondena} onChange={e=>setMotivoCondena(e.target.value)}/>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <button className="btn-primary" style={{fontSize:12}} onClick={guardarCondena}>✓ Guardar</button>
              {condenaCompleta && <button className="btn-secondary" style={{fontSize:12}} onClick={()=>setEditandoCondena(false)}>Cancelar</button>}
            </div>
          </>
        ) : (
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div style={{padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #e2e8f0'}}>
              <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>{imp.condena_tipo==='sustitutiva' ? 'Pena sustitutiva desde' : 'Condena efectiva desde'}</div>
              <div style={{fontSize:14,fontWeight:700,color:'#1E293B',...f}}>{imp.condena_fecha_inicio} · {formatearTiempoCondena(imp.condena_anos, imp.condena_meses, imp.condena_dias)}</div>
            </div>
            <div style={{padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>🔒</span>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Abono (Cautelares)</div>
                <div style={{fontSize:16,fontWeight:800,color:'#1E293B',...f}}>{totalAbono} días</div>
              </div>
            </div>
            <div style={{padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>📅</span>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Fecha de término de condena</div>
                <div style={{fontSize:16,fontWeight:800,color:'#1E293B',...f}}>{calcularFechaTerminoCondena(imp.condena_fecha_inicio, imp.condena_anos, imp.condena_meses, imp.condena_dias, totalAbono)}</div>
                <div style={{fontSize:10,color:'#94a3b8',marginTop:2,...f}}>Días corridos, ya descontado el abono</div>
              </div>
            </div>
          </div>
        )}

        {imp.condena_historial && (
          <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #e2e8f0'}}>
            {imp.condena_historial.split('\n').map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

