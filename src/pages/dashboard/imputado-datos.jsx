// Tarjeta de datos del imputado (dentro del detalle de una causa): datos
// personales, delitos y medidas cautelares.
import { useState } from 'react'
import { f } from './primitives'
import { SearchableSelect, DelitoCard, Field } from './primitives'
import { DELITOS_CATALOGO, CENTROS_PENALES, calcularEdadActual, fechaDDMM } from './utils'
import { CautelaresPanel, TIPOS_ABONO_DIRECTO, CAUTELAR_NOCTURNO, diasEntreFechasCaut } from './cautelares'

export function ImputadoDatosCard({ imp, numero, causaId, ruc, cautelares, esTitular, isMobile, registrarActividad, onUpdateCampo, onDelitoChange, onGuardarCautelar, onActualizarCautelar, onEliminarCautelar }) {
  const [expanded, setExpanded] = useState(false)
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const f = { fontFamily:"'Manrope','Inter',sans-serif" }

  // Resumen — visible aunque la tarjeta esté colapsada, para no tener que abrirla
  // solo para ver lo esencial. Texto plano, sin emojis.
  const numDelitos = (imp.delitos||'').split('|').map(s=>s.trim()).filter(Boolean).length
  const hoyISO = new Date().toISOString().slice(0,10)
  const totalAbonoImp = (cautelares||[]).reduce((sum,ct)=>{
    if (TIPOS_ABONO_DIRECTO.includes(ct.tipo)) return sum + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || hoyISO)
    if (ct.tipo === CAUTELAR_NOCTURNO && ct.sumado_a_abono) return sum + (parseFloat(ct.abono_nocturno_calculado)||0)
    return sum
  },0)

  return (
    <div style={{border:'1px solid #e2e8f0', borderRadius:14, background:'#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', overflow:'hidden'}}>
      <div
        onClick={()=>setExpanded(v=>!v)}
        style={{cursor:'pointer', padding:'14px 16px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            {numero && (
              <span style={{width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,...f}}>{numero}</span>
            )}
            <span style={{fontSize:14,fontWeight:700,color:'#1E293B',...f}}>{imp.nombre||'Sin nombre'}</span>
            {imp.regimen && (
              <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10,background:imp.regimen==='RPA'?'#faf5ff':'#eff6ff',color:imp.regimen==='RPA'?'#5b21b6':'#1E293B',border:`1px solid ${imp.regimen==='RPA'?'#ddd6fe':'#bfdbfe'}`,...f}}>{imp.regimen}</span>
            )}
          </div>
          <span style={{fontSize:12,color:'#94a3b8'}}>{expanded ? '▲' : '▼'}</span>
        </div>
        <div style={{fontSize:12,color:'#64748b',marginTop:4,...f}}>
          <strong style={{color:'#1E293B'}}>{numDelitos}</strong> delito{numDelitos!==1?'s':''}
          <span style={{color:'#cbd5e1',margin:'0 8px'}}>·</span>
          <strong style={{color:'#1E293B'}}>{totalAbonoImp}</strong> días de abono
          <span style={{color:'#cbd5e1',margin:'0 8px'}}>·</span>
          {imp.lugar_detencion || <span style={{color:'#94a3b8'}}>Sin centro penal</span>}
        </div>
      </div>

      {expanded && (
        <div style={{padding:'0 16px 16px', borderTop:'1px solid #f1f5f9', display:'flex', flexDirection:'column', gap:16}}>
          {/* Fecha de nacimiento — con edad en vivo, igual que en la tarjeta de un solo imputado */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de nacimiento</div>
            {editField==='fecha_nacimiento'?(
              <div style={{display:'flex',gap:6}}>
                <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                  value={editValue} onChange={e=>setEditValue(e.target.value)}
                  onBlur={()=>{if(editValue)onUpdateCampo('fecha_nacimiento',editValue)}}
                  onKeyDown={e=>{if(e.key==='Enter'){onUpdateCampo('fecha_nacimiento',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{onUpdateCampo('fecha_nacimiento',editValue);setEditField(null)}}>✓</button>
                <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
              </div>
            ):(
              <div className="fld" onClick={()=>{setEditField('fecha_nacimiento');setEditValue(imp.fecha_nacimiento||'')}}
                style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.fecha_nacimiento?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                <span>
                  {fechaDDMM(imp.fecha_nacimiento) || 'Clic para agregar...'}
                  {imp.fecha_nacimiento && (() => {
                    const edad = calcularEdadActual(imp.fecha_nacimiento)
                    return edad !== null ? <span style={{marginLeft:8,fontSize:11,color:'#1E293B',fontWeight:600,background:'#eff6ff',padding:'1px 7px',borderRadius:10}}>{edad} AÑOS HOY</span> : null
                  })()}
                </span>
                <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
              </div>
            )}
          </div>

          {/* Centro Penal */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Centro Penal</div>
            <SearchableSelect value={imp.lugar_detencion} onChange={(v)=>onUpdateCampo('lugar_detencion', v)} options={CENTROS_PENALES} placeholder="Buscar centro penal..." isDelito={false}/>
          </div>

          {/* Fecha de detención — mismo campo "fecha_detencion" que en la pestaña
              Imputado (misma columna en la base de datos, así que editarla acá o
              allá queda siempre sincronizado). Distinta de "Fecha de los hechos"
              y de la fecha de formalización: pueden ser 3 días distintos. */}
          {imp.esta_detenido && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de detención</div>
              {editField==='fecha_detencion'?(
                <div style={{display:'flex',gap:6}}>
                  <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                    value={editValue} onChange={e=>setEditValue(e.target.value)}
                    onBlur={()=>{if(editValue)onUpdateCampo('fecha_detencion',editValue)}}
                    onKeyDown={e=>{if(e.key==='Enter'){onUpdateCampo('fecha_detencion',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                  <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{onUpdateCampo('fecha_detencion',editValue);setEditField(null)}}>✓</button>
                  <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                </div>
              ):(
                <div className="fld" onClick={()=>{setEditField('fecha_detencion');setEditValue(imp.fecha_detencion||'')}}
                  style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.fecha_detencion?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                  <span>{fechaDDMM(imp.fecha_detencion) || 'Clic para agregar...'}</span>
                  <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                </div>
              )}
            </div>
          )}

          {/* Cautelar Personal */}
          <CautelaresPanel
            isMobile={isMobile}
            causaId={causaId}
            ruc={ruc}
            cautelares={cautelares}
            esRPA={imp.regimen==='RPA'}
            esTitular={esTitular}
            registrarActividad={registrarActividad}
            onGuardar={onGuardarCautelar}
            onActualizar={onActualizarCautelar}
            onEliminar={onEliminarCautelar}
          />

          {/* Delito(s) */}
          <div>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Delito(s)</div>
            <div style={{display:'flex'}}>
              <DelitoCard value={imp.delitos} onChange={onDelitoChange} options={DELITOS_CATALOGO} />
            </div>
          </div>

          {/* Delegación de Poder */}
          <div>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Delegación de Poder</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Field label="Abogado delegado" value={imp.delegacion_abogado} editable fieldKey="delegacion_abogado" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>{onUpdateCampo('delegacion_abogado',editValue);setEditField(null)}}/>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de delegación</div>
                {editField==='delegacion_fecha'?(
                  <div style={{display:'flex',gap:6}}>
                    <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                      value={editValue} onChange={e=>setEditValue(e.target.value)}
                      onBlur={()=>{if(editValue)onUpdateCampo('delegacion_fecha',editValue)}}
                      onKeyDown={e=>{if(e.key==='Enter'){onUpdateCampo('delegacion_fecha',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                    <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{onUpdateCampo('delegacion_fecha',editValue);setEditField(null)}}>✓</button>
                    <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                  </div>
                ):(
                  <div className="fld" onClick={()=>{setEditField('delegacion_fecha');setEditValue(imp.delegacion_fecha||'')}}
                    style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.delegacion_fecha?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                    <span>{fechaDDMM(imp.delegacion_fecha) || 'Clic para agregar...'}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Correo de Notificación */}
          <div>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Correo de notificación</div>
            <select
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.correo_notificacion?'#1E293B':'#94a3b8',background:'#fff',cursor:'pointer',...f}}
              value={imp.correo_notificacion||''}
              onChange={e=>onUpdateCampo('correo_notificacion', e.target.value)}>
              <option value="">Seleccionar correo...</option>
              <option value="JOBREGONABOGADO@GMAIL.COM">JOBREGONABOGADO@GMAIL.COM</option>
              <option value="NOTIFICACION.DEFENSAPENAL@GMAIL.COM">NOTIFICACION.DEFENSAPENAL@GMAIL.COM</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

