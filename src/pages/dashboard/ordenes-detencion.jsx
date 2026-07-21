// Panel de Órdenes de Detención dentro de la pestaña Imputado — a diferencia
// de Cautelares, una causa puede tener varias órdenes de detención (o
// ninguna) a lo largo del tiempo, cada una con su propio motivo y, si
// corresponde, la fecha en que se dejó sin efecto. Se deja historial completo,
// nunca se sobrescribe una orden anterior.
import { useState } from 'react'
import { f } from './primitives'
import { fechaDDMM } from './utils'

export function OrdenesDetencionPanel({ ordenes, onGuardar, onActualizar, onEliminar, esTitular, isMobile }) {
  const hoyISO = new Date().toISOString().slice(0,10)
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({ fecha_orden: hoyISO, motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const [levantandoId, setLevantandoId] = useState(null)
  const [fechaLevanta, setFechaLevanta] = useState(hoyISO)

  const lista = ordenes || []
  const vigentes = lista.filter(o => !o.fecha_levantamiento).length

  const handleGuardar = async () => {
    if (!form.fecha_orden) return
    if (!form.motivo.trim()) { alert('Ingresa el motivo de la orden de detención.'); return }
    setGuardando(true)
    await onGuardar(form)
    setForm({ fecha_orden: hoyISO, motivo: '' })
    setGuardando(false)
  }

  const iniciarLevantamiento = (o) => {
    setLevantandoId(o.id)
    setFechaLevanta(hoyISO)
  }

  const guardarLevantamiento = async (o) => {
    if (!fechaLevanta) return
    await onActualizar(o.id, { fecha_levantamiento: fechaLevanta })
    setLevantandoId(null)
  }

  const eliminarOrden = async (o) => {
    const motivo = window.prompt(`¿Eliminar DEFINITIVAMENTE esta orden de detención (del ${fechaDDMM(o.fecha_orden)})? Esta acción no se puede deshacer.\n\nIngresa el motivo de la eliminación:`)
    if (motivo === null || !motivo.trim()) return
    await onEliminar(o.id, motivo.trim())
  }

  return (
    <div style={{gridColumn:'1/-1', marginTop:2, marginBottom:2}}>
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>
        Orden de detención
      </div>
      <div
        className="fld"
        onClick={()=>setExpanded(v=>!v)}
        style={{cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', borderRadius: expanded ? '14px 14px 0 0' : 14, fontSize:13, color:'#1E293B', minHeight:38, background: vigentes>0 ? '#fef2f2' : '#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', ...f}}>
        <span style={{display:'flex',alignItems:'center',gap:10}}>
          <span>🚨</span>
          {vigentes > 0
            ? <strong style={{color:'#dc2626'}}>{vigentes} vigente{vigentes!==1?'s':''}</strong>
            : <span style={{color: lista.length>0 ? '#64748b' : '#94a3b8'}}>{lista.length>0 ? `${lista.length} en el historial` : 'Sin órdenes registradas'}</span>}
        </span>
        <span style={{fontSize:11,color:'#94a3b8',flexShrink:0,marginLeft:8}}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:'0 0 14px 14px',padding:isMobile?'10px 12px 10px':'14px 16px 12px'}}>
          {lista.length===0 && <p style={{fontSize:13,color:'#94a3b8',marginBottom:8,...f}}>Sin órdenes de detención registradas todavía.</p>}

          {lista.map((o,idx)=>{
            const vigente = !o.fecha_levantamiento
            const levantando = levantandoId === o.id
            return (
              <div key={o.id} style={{padding:'10px 0', borderBottom: idx<lista.length-1 ? '1px solid #f1f5f9' : 'none'}}>
                {levantando ? (
                  <div style={{background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,padding:10}}>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:6,...f}}>Se deja sin efecto la orden de detención el:</div>
                    <input type="date" style={{padding:'7px 9px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={fechaLevanta} onChange={e=>setFechaLevanta(e.target.value)}/>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>guardarLevantamiento(o)} disabled={!fechaLevanta} style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 14px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>✓ Guardar</button>
                      <button onClick={()=>setLevantandoId(null)} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}}>✗ Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:6}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:'#1E293B',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',...f}}>
                        Orden de detención
                        <span style={{fontSize:11,fontWeight:600,color:vigente?'#dc2626':'#059669',...f}}>{vigente?'VIGENTE':'Se dejó sin efecto'}</span>
                      </div>
                      <div style={{fontSize:11,color:'#94a3b8',marginTop:2,...f}}>
                        Desde {fechaDDMM(o.fecha_orden)}{o.fecha_levantamiento?` · Sin efecto desde ${fechaDDMM(o.fecha_levantamiento)}`:''}
                      </div>
                      {o.motivo && <div style={{fontSize:12,color:'#475569',marginTop:4,...f}}>{o.motivo}</div>}
                    </div>
                    <div style={{display:'flex',gap:10,flexShrink:0,alignItems:'center'}}>
                      {vigente && <button onClick={()=>iniciarLevantamiento(o)} style={{fontSize:11,color:'#059669',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>Dejar sin efecto</button>}
                      {esTitular && <button onClick={()=>eliminarOrden(o)} style={{fontSize:11,color:'#94a3b8',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>🗑 Eliminar</button>}
                    </div>
                  </div>
                )}
                {!levantando && o.historial && (
                  <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                    {o.historial.split('\n').map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Agregar nueva orden de detención */}
          <div style={{paddingTop:12, marginTop: lista.length>0 ? 2 : 0, borderTop: lista.length>0 ? '1px solid #f1f5f9' : 'none'}}>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:6,fontWeight:600,...f}}>Agregar orden de detención</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-start'}}>
              <input type="date" style={{flex:'1 1 140px',minWidth:140,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={form.fecha_orden} onChange={e=>setForm(p=>({...p,fecha_orden:e.target.value}))}/>
              <input style={{flex:'1 1 220px',minWidth:180,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} placeholder="Motivo de la orden..." value={form.motivo} onChange={e=>setForm(p=>({...p,motivo:e.target.value}))}/>
              <button className="btn-primary" style={{fontSize:12,padding:'8px 16px',borderRadius:8}} onClick={handleGuardar} disabled={guardando || !form.fecha_orden}>{guardando?'Guardando...':'+ Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
