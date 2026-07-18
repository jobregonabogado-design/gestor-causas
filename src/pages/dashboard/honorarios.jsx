// Pestaña de Honorarios y Abonos dentro de una causa.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { f } from './primitives'
import { CUENTAS_TRANSFERENCIA } from './documentos'

export function HonorariosTab({ causaId, ruc, email, registrarActividad, onAccion }) {
  const [honorario, setHonorario] = useState(null)
  const [abonos, setAbonos] = useState([])
  const [editandoMonto, setEditandoMonto] = useState(false)
  const [montoTemp, setMontoTemp] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [nuevoAbono, setNuevoAbono] = useState({ monto:'', fecha:new Date().toISOString().slice(0,10), forma_pago:'Transferencia', cuenta_transferencia:CUENTAS_TRANSFERENCIA[0], observacion:'' })
  const [guardando, setGuardando] = useState(false)
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }
  const usaTransferencia = nuevoAbono.forma_pago === 'Transferencia' || nuevoAbono.forma_pago === 'Transferencia + Efectivo'

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
    setGuardando(true)
    await supabase.from('abonos_honorarios').insert({
      causa_id: causaId, monto, fecha: nuevoAbono.fecha, forma_pago: nuevoAbono.forma_pago,
      cuenta_transferencia: usaTransferencia ? nuevoAbono.cuenta_transferencia : null,
      observacion: nuevoAbono.observacion, registrado_por: email
    })
    setNuevoAbono({ monto:'', fecha:new Date().toISOString().slice(0,10), forma_pago:'Transferencia', cuenta_transferencia:CUENTAS_TRANSFERENCIA[0], observacion:'' })
    setShowForm(false)
    setGuardando(false)
    await cargar()
    if (onAccion) onAccion()
    if (registrarActividad) registrarActividad('accion', `Registró abono de $${monto.toLocaleString('es-CL')} en RUC ${ruc}`)
  }

  const eliminarAbono = async (abono) => {
    if (!window.confirm('¿Eliminar este abono?')) return
    await supabase.from('abonos_honorarios').delete().eq('id', abono.id)
    await cargar()
    if (onAccion) onAccion()
  }

  const montoTotal = honorario?.monto_total || 0
  const totalAbonado = abonos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0)
  const saldoPendiente = montoTotal - totalAbonado
  const fmt = (n) => '$' + (n || 0).toLocaleString('es-CL')

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        <div style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:12, padding:'14px 16px' }}>
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
        <div style={{ background:'#ecfdf5', border:'1.5px solid #a7f3d0', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6, fontWeight:600, ...f }}>Total abonado</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#059669', ...f }}>{fmt(totalAbonado)}</div>
        </div>
        <div style={{ background: saldoPendiente>0?'#fef2f2':'#F8F9FC', border:`1.5px solid ${saldoPendiente>0?'#fecaca':'#e2e8f0'}`, borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginBottom:6, fontWeight:600, ...f }}>Saldo pendiente</div>
          <div style={{ fontSize:22, fontWeight:800, color: saldoPendiente>0?'#dc2626':'#64748b', ...f }}>{fmt(saldoPendiente)}</div>
        </div>
      </div>

      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, fontWeight:600, ...f }}>Historial de abonos</div>
      {abonos.length === 0 && <p style={{ color:'#94a3b8', fontSize:13, marginBottom:14, ...f }}>Sin abonos registrados.</p>}
      {abonos.map(a => (
        <div key={a.id} style={{ display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, background:'#ecfdf5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669', fontSize:15, fontWeight:700, flexShrink:0 }}>$</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', ...f }}>{fmt(a.monto)} <span style={{fontWeight:400,color:'#94a3b8',fontSize:12}}>· {a.forma_pago}{a.cuenta_transferencia?' · '+a.cuenta_transferencia:''}</span></div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, ...f }}>{a.fecha}{a.observacion?' · '+a.observacion:''} · registrado por {a.registrado_por}</div>
          </div>
          <button onClick={()=>eliminarAbono(a)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#fca5a5' }}>✕</button>
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

