// Pestaña de Honorarios y Abonos dentro de una causa.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { f } from './primitives'
import { CUENTAS_TRANSFERENCIA } from './documentos'
import { fechaDDMM } from './utils'

export function HonorariosTab({ causaId, ruc, imputado, email, registrarActividad, onAccion, esTitular, isMobile }) {
  const [honorario, setHonorario] = useState(null)
  const [abonos, setAbonos] = useState([])
  const [editandoMonto, setEditandoMonto] = useState(false)
  const [montoTemp, setMontoTemp] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nuevoAbono, setNuevoAbono] = useState({ monto:'', fecha:new Date().toISOString().slice(0,10), forma_pago:'Transferencia', cuenta_transferencia:CUENTAS_TRANSFERENCIA[0], observacion:'', imputado_nombre:'' })
  const [guardando, setGuardando] = useState(false)
  // ✅ Editar un abono ya registrado pide motivo (igual que Cautelares/Condena);
  // eliminarlo definitivamente es solo para el titular — es dinero, no un dato menor.
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({ monto:'', fecha:'', forma_pago:'', cuenta_transferencia:'', observacion:'', imputado_nombre:'' })
  const [motivoEdit, setMotivoEdit] = useState('')
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }
  const usaTransferencia = nuevoAbono.forma_pago === 'Transferencia' || nuevoAbono.forma_pago === 'Transferencia + Efectivo'

  // ✅ NUEVO: cuando la causa tiene 2+ imputados, el monto total pactado
  // sigue siendo UNO SOLO para toda la causa (no se toca), pero cada abono
  // se puede asociar a un imputado específico — así se puede ver cuánto ha
  // pagado cada uno por separado aunque el "pactado" y el "saldo pendiente"
  // sigan siendo un solo número para la causa completa.
  const listaImputados = (imputado || '').split('|').map(n => n.trim()).filter(Boolean)
  const tieneVarios = listaImputados.length > 1

  useEffect(() => { cargar() }, [causaId])

  const cargar = async () => {
    const { data: h } = await supabase.from('honorarios').select('*').eq('causa_id', causaId).maybeSingle()
    setHonorario(h)
    const { data: a } = await supabase.from('abonos_honorarios').select('*').eq('causa_id', causaId).order('fecha', { ascending: false })
    setAbonos(a || [])
  }

  const guardarMontoTotal = async () => {
    const monto = parseFloat(montoTemp) || 0
    if (honorario) {
      await supabase.from('honorarios').update({ monto_total: monto, updated_at: new Date() }).eq('id', honorario.id)
    } else {
      await supabase.from('honorarios').insert({ causa_id: causaId, monto_total: monto })
    }
    setEditandoMonto(false)
    await cargar()
    if (registrarActividad) registrarActividad('accion', `Actualizó honorario pactado en RUC ${ruc}`)
  }

  const agregarAbono = async () => {
    const monto = parseFloat(nuevoAbono.monto)
    if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return }
    if (tieneVarios && !nuevoAbono.imputado_nombre) { alert('Esta causa tiene varios imputados — selecciona a quién corresponde este abono.'); return }
    setGuardando(true)
    await supabase.from('abonos_honorarios').insert({
      causa_id: causaId, monto, fecha: nuevoAbono.fecha, forma_pago: nuevoAbono.forma_pago,
      cuenta_transferencia: usaTransferencia ? nuevoAbono.cuenta_transferencia : null,
      observacion: nuevoAbono.observacion, registrado_por: email,
      imputado_nombre: tieneVarios ? nuevoAbono.imputado_nombre : (listaImputados[0] || null),
    })
    setNuevoAbono({ monto:'', fecha:new Date().toISOString().slice(0,10), forma_pago:'Transferencia', cuenta_transferencia:CUENTAS_TRANSFERENCIA[0], observacion:'', imputado_nombre:'' })
    setShowForm(false)
    setGuardando(false)
    await cargar()
    if (onAccion) onAccion()
    if (registrarActividad) registrarActividad('accion', `Registró abono de $${monto.toLocaleString('es-CL')} en RUC ${ruc}`)
  }

  const iniciarEdicionAbono = (a) => {
    setEditandoId(a.id)
    setEditForm({ monto:String(a.monto||''), fecha:a.fecha||'', forma_pago:a.forma_pago||'Transferencia', cuenta_transferencia:a.cuenta_transferencia||CUENTAS_TRANSFERENCIA[0], observacion:a.observacion||'', imputado_nombre:a.imputado_nombre||'' })
    setMotivoEdit('')
  }

  const guardarEdicionAbono = async (abonoAnterior) => {
    if (!motivoEdit.trim()) { alert('Ingresa el motivo de la corrección — queda registrado para tener trazabilidad.'); return }
    const monto = parseFloat(editForm.monto)
    if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return }
    if (tieneVarios && !editForm.imputado_nombre) { alert('Esta causa tiene varios imputados — selecciona a quién corresponde este abono.'); return }
    const usaTransf = editForm.forma_pago === 'Transferencia' || editForm.forma_pago === 'Transferencia + Efectivo'
    const linea = `[${new Date().toLocaleString('es-CL')}] Corregido por ${email}. Motivo: ${motivoEdit.trim()}. Antes era: $${abonoAnterior.monto} · ${fechaDDMM(abonoAnterior.fecha)} · ${abonoAnterior.forma_pago}${abonoAnterior.imputado_nombre ? ' · '+abonoAnterior.imputado_nombre : ''}.`
    const historial = abonoAnterior.historial ? abonoAnterior.historial + '\n' + linea : linea
    await supabase.from('abonos_honorarios').update({
      monto, fecha: editForm.fecha, forma_pago: editForm.forma_pago,
      cuenta_transferencia: usaTransf ? editForm.cuenta_transferencia : null,
      observacion: editForm.observacion, historial,
      imputado_nombre: tieneVarios ? editForm.imputado_nombre : (listaImputados[0] || null),
    }).eq('id', editandoId)
    setEditandoId(null)
    await cargar()
    if (onAccion) onAccion()
    if (registrarActividad) registrarActividad('accion', `Corrigió un abono en RUC ${ruc}: ${motivoEdit.trim()}`)
  }

  const eliminarAbono = async (abono) => {
    const motivo = window.prompt(`¿Eliminar DEFINITIVAMENTE el abono de ${fmt(abono.monto)} del ${fechaDDMM(abono.fecha)}? Esta acción no se puede deshacer.\n\nIngresa el motivo de la eliminación:`)
    if (motivo === null || !motivo.trim()) return
    await supabase.from('abonos_honorarios').delete().eq('id', abono.id)
    await cargar()
    if (onAccion) onAccion()
    if (registrarActividad) registrarActividad('accion', `Eliminó definitivamente un abono de ${fmt(abono.monto)} en RUC ${ruc}. Motivo: ${motivo.trim()}`)
  }

  const montoTotal = honorario?.monto_total || 0
  const totalAbonado = abonos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0)
  const saldoPendiente = montoTotal - totalAbonado
  const fmt = (n) => '$' + (n || 0).toLocaleString('es-CL')

  // ✅ NUEVO: desglose de cuánto ha abonado cada imputado — solo informativo,
  // el pactado y el saldo pendiente de arriba siguen siendo un solo número
  // para toda la causa (no se reparte el total, solo se ve el detalle de
  // los abonos ya registrados).
  const abonadoPorImputado = tieneVarios ? listaImputados.map(nombre => ({
    nombre,
    total: abonos.filter(a => a.imputado_nombre === nombre).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0),
  })) : []
  const abonosSinAsignar = tieneVarios ? abonos.filter(a => !a.imputado_nombre || !listaImputados.includes(a.imputado_nombre)) : []
  const totalSinAsignar = abonosSinAsignar.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0)

  return (
    <div>
      {/* En celular, las 3 tarjetas van apiladas (mismo criterio que Plazo) en vez
          de apretadas lado a lado. */}
      <div style={isMobile?{display:'flex',flexDirection:'column',gap:8,marginBottom:24}:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        <div style={{ background:'#fafbff', border:'2px solid #93c5fd', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6, fontWeight:600, ...f }}>Honorario pactado</div>
          {editandoMonto ? (
            <div style={{ display:'flex', gap:6 }}>
              <input type="number" style={{...inp, fontSize:16, fontWeight:700}} value={montoTemp} onChange={e=>setMontoTemp(e.target.value)} autoFocus/>
              <button className="btn-primary" style={{padding:'6px 10px',fontSize:11}} onClick={guardarMontoTotal}>✓</button>
              <button className="btn-secondary" style={{padding:'6px 10px',fontSize:11}} onClick={()=>setEditandoMonto(false)}>✗</button>
            </div>
          ) : (
            <div onClick={()=>{setEditandoMonto(true);setMontoTemp(String(montoTotal||''))}} style={{ fontSize:22, fontWeight:800, color:'#1e40af', cursor:'pointer', ...f }}>{fmt(montoTotal)} <span style={{fontSize:11,color:'#93c5fd'}}>✏</span></div>
          )}
        </div>
        <div style={{ background:'#fafffd', border:'2px solid #86efac', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6, fontWeight:600, ...f }}>Total abonado</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#059669', ...f }}>{fmt(totalAbonado)}</div>
        </div>
        <div style={{ background: saldoPendiente>0?'#fffafa':'#F8F9FC', border:`2px solid ${saldoPendiente>0?'#fca5a5':'#cbd5e1'}`, borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6, fontWeight:600, ...f }}>Saldo pendiente</div>
          <div style={{ fontSize:22, fontWeight:800, color: saldoPendiente>0?'#dc2626':'#64748b', ...f }}>{fmt(saldoPendiente)}</div>
        </div>
      </div>

      {/* ✅ NUEVO: desglose de abonos por imputado — solo aparece si la causa
          tiene 2 o más imputados. El pactado y el saldo pendiente arriba
          siguen siendo un solo número para toda la causa. */}
      {tieneVarios && (
        <div style={{ background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:8, fontWeight:600, ...f }}>Abonado por imputado</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {abonadoPorImputado.map(({ nombre, total }) => (
              <div key={nombre} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#1E293B', fontWeight:600, ...f }}>{nombre}</span>
                <span style={{ fontSize:13, color: total>0?'#059669':'#94a3b8', fontWeight:700, ...f }}>{fmt(total)}</span>
              </div>
            ))}
            {totalSinAsignar > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:6, borderTop:'1px dashed #e2e8f0' }}>
                <span style={{ fontSize:12, color:'#94a3b8', fontStyle:'italic', ...f }}>Sin asignar (abonos antiguos)</span>
                <span style={{ fontSize:13, color:'#94a3b8', fontWeight:700, ...f }}>{fmt(totalSinAsignar)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, fontWeight:600, ...f }}>Historial de abonos</div>
      {abonos.length === 0 && <p style={{ color:'#94a3b8', fontSize:13, marginBottom:14, ...f }}>Sin abonos registrados.</p>}
      {abonos.map(a => editandoId === a.id ? (
        <div key={a.id} style={{ background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:10, padding:12, marginBottom:8 }}>
          <div className="grid2-mobile" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Monto</div><input type="number" style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.monto} onChange={e=>setEditForm(p=>({...p,monto:e.target.value}))}/></div>
            <div><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Fecha</div><input type="date" style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.fecha} onChange={e=>setEditForm(p=>({...p,fecha:e.target.value}))}/></div>
            <div><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Forma de pago</div>
              <select style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.forma_pago} onChange={e=>setEditForm(p=>({...p,forma_pago:e.target.value}))}>
                <option>Transferencia</option><option>Efectivo</option><option>Transferencia + Efectivo</option><option>Cheque</option><option>Tarjeta</option><option>Otro</option>
              </select>
            </div>
            {(editForm.forma_pago==='Transferencia'||editForm.forma_pago==='Transferencia + Efectivo') && (
              <div><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Cuenta</div>
                <select style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.cuenta_transferencia} onChange={e=>setEditForm(p=>({...p,cuenta_transferencia:e.target.value}))}>
                  {CUENTAS_TRANSFERENCIA.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            )}
            {tieneVarios && (
              <div><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Imputado</div>
                <select style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.imputado_nombre} onChange={e=>setEditForm(p=>({...p,imputado_nombre:e.target.value}))}>
                  <option value="">Selecciona...</option>
                  {listaImputados.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:600,...f}}>Observación</div><input style={{...inp,padding:'7px 9px',fontSize:12}} value={editForm.observacion} onChange={e=>setEditForm(p=>({...p,observacion:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:9,color:'#dc2626',textTransform:'uppercase',letterSpacing:1,marginBottom:3,fontWeight:700,...f}}>Motivo de la corrección *</div>
            <input style={{...inp,padding:'7px 9px',fontSize:12,borderColor:'#fecaca'}} placeholder="Ej: Monto mal ingresado, fecha incorrecta..." value={motivoEdit} onChange={e=>setMotivoEdit(e.target.value)}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn-primary" style={{fontSize:12}} onClick={()=>guardarEdicionAbono(a)}>✓ Guardar</button>
            <button className="btn-secondary" style={{fontSize:12}} onClick={()=>setEditandoId(null)}>✗ Cancelar</button>
          </div>
        </div>
      ) : (
        <div key={a.id} style={{ display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8, flexWrap:'wrap' }}>
          <div style={{ width:36, height:36, background:'#ecfdf5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669', fontSize:15, fontWeight:700, flexShrink:0 }}>$</div>
          <div style={{ flex:'1 1 200px', minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', ...f }}>{fmt(a.monto)} <span style={{fontWeight:400,color:'#94a3b8',fontSize:12}}>· {a.forma_pago}{a.cuenta_transferencia?' · '+a.cuenta_transferencia:''}</span>
              {tieneVarios && a.imputado_nombre && <span style={{marginLeft:8,fontSize:10,fontWeight:700,color:'#5b21b6',background:'#faf5ff',border:'1px solid #ddd6fe',borderRadius:20,padding:'2px 8px',...f}}>{a.imputado_nombre}</span>}
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>{fechaDDMM(a.fecha)}{a.observacion?' · '+a.observacion:''} · registrado por {a.registrado_por}</div>
            {a.historial && (
              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                {a.historial.split('\n').map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
            <button onClick={()=>iniciarEdicionAbono(a)} style={{ background:'#faf5ff', border:'1px solid #ddd6fe', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, color:'#5b21b6', fontWeight:600, ...f }}>✏ Corregir</button>
            {esTitular && <button onClick={()=>eliminarAbono(a)} style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, color:'#dc2626', fontWeight:600, ...f }}>🗑 Eliminar</button>}
          </div>
        </div>
      ))}

      {showForm ? (
        <div style={{ background:'#F8F9FC', border:'1.5px solid #e2e8f0', borderRadius:12, padding:16, marginTop:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Monto</div><input type="number" style={inp} placeholder="Ej: 300000" value={nuevoAbono.monto} onChange={e=>setNuevoAbono(p=>({...p,monto:e.target.value}))}/></div>
            <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Fecha</div><input type="date" style={inp} value={nuevoAbono.fecha} onChange={e=>setNuevoAbono(p=>({...p,fecha:e.target.value}))}/></div>
            <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Forma de pago</div>
              <select style={inp} value={nuevoAbono.forma_pago} onChange={e=>setNuevoAbono(p=>({...p,forma_pago:e.target.value}))}>
                <option>Transferencia</option><option>Efectivo</option><option>Transferencia + Efectivo</option><option>Cheque</option><option>Tarjeta</option><option>Otro</option>
              </select>
            </div>
            {usaTransferencia && (
              <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Cuenta de transferencia</div>
                <select style={inp} value={nuevoAbono.cuenta_transferencia} onChange={e=>setNuevoAbono(p=>({...p,cuenta_transferencia:e.target.value}))}>
                  {CUENTAS_TRANSFERENCIA.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            )}
            {tieneVarios && (
              <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Imputado</div>
                <select style={inp} value={nuevoAbono.imputado_nombre} onChange={e=>setNuevoAbono(p=>({...p,imputado_nombre:e.target.value}))}>
                  <option value="">¿A quién corresponde?</option>
                  {listaImputados.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Observación</div><input style={inp} placeholder="Opcional" value={nuevoAbono.observacion} onChange={e=>setNuevoAbono(p=>({...p,observacion:e.target.value}))}/></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={agregarAbono} disabled={guardando}>{guardando?'Guardando...':'Guardar abono'}</button>
            <button className="btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" style={{ marginTop:8 }} onClick={()=>setShowForm(true)}>+ Registrar abono</button>
      )}
    </div>
  )
}

