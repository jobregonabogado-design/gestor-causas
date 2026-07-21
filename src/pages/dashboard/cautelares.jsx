// Panel de Medidas Cautelares dentro de una causa: historial, abono 1x1 y
// fórmula de arresto nocturno.
import { useState } from 'react'
import { f } from './primitives'

export const TIPOS_ABONO_DIRECTO = ['Prisión Preventiva','Internación Provisoria','Arresto Total']
// ✅ Subconjunto que implica que la persona está privada de libertad en un
// centro penal — a diferencia de TIPOS_ABONO_DIRECTO, deja fuera "Arresto
// Total" (no es un recinto) y a CAUTELAR_SENAME (es un centro del SENAME,
// no un "Centro Penal"). Se usa para mostrar/ocultar Centro Penal en la
// pestaña Imputado automáticamente, según qué cautelar tenga la persona.
export const TIPOS_DETENCION_PENAL = ['Prisión Preventiva','Internación Provisoria']
export const CAUTELAR_SENAME = 'Sujeción a SENAME'
export const CAUTELAR_NOCTURNO = 'Arresto Nocturno'
export const TIPOS_CAUTELARES_ADULTO = ['Prisión Preventiva','Arresto Total',CAUTELAR_NOCTURNO,'Firma','Arraigo Nacional','Prohibición de acercarse a la víctima','Prohibición de acercarse a la víctima (VIF Art. 9)','Prohibición de portar armas']
export const TIPOS_CAUTELARES_RPA = ['Internación Provisoria','Arresto Total',CAUTELAR_NOCTURNO,CAUTELAR_SENAME,'Firma','Arraigo Nacional','Prohibición de acercarse a la víctima','Prohibición de acercarse a la víctima (VIF Art. 9)','Prohibición de portar armas']
export const TIPOS_CAUTELARES_TODAS = [...new Set([...TIPOS_CAUTELARES_ADULTO, ...TIPOS_CAUTELARES_RPA])]

export function diasEntreFechasCaut(inicio, fin) {
  if (!inicio || !fin) return 0
  const a = new Date(inicio+'T12:00:00'), b = new Date(fin+'T12:00:00')
  if (isNaN(a)||isNaN(b)) return 0
  return Math.max(0, Math.round((b-a)/(1000*60*60*24)))
}

// ✅ Abono total EN VIVO de un imputado — misma fórmula que usa CautelaresPanel,
// exportada para reutilizarla también en el cálculo de fecha de término de
// condena (pestaña Imputado), sin duplicar el criterio en dos lugares.
export function calcularTotalAbono(cautelares, hoyISO = new Date().toISOString().slice(0,10)) {
  return (cautelares || []).reduce((sum,ct) => {
    if (TIPOS_ABONO_DIRECTO.includes(ct.tipo)) {
      return sum + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || hoyISO)
    }
    if (ct.tipo === CAUTELAR_NOCTURNO && ct.sumado_a_abono) {
      return sum + (parseFloat(ct.abono_nocturno_calculado)||0)
    }
    return sum
  }, 0)
}

export function CautelaresPanel({ causaId, cautelares, esRPA, onGuardar, onActualizar, onEliminar, esTitular, registrarActividad, ruc, nombreImputado, isMobile }) {
  const hoyISO = new Date().toISOString().slice(0,10)
  const TIPOS = esRPA ? TIPOS_CAUTELARES_RPA : TIPOS_CAUTELARES_ADULTO
  const [expanded,setExpanded] = useState(true) // la casilla queda visible; al abrir se ve el detalle
  const [form,setForm] = useState({ tipo:TIPOS[0], fecha_inicio:hoyISO, fecha_termino:'', frecuencia:'Mensual' })
  const [guardando,setGuardando] = useState(false)
  const [fechaCalc,setFechaCalc] = useState(hoyISO) // calculadora ad-hoc, no se guarda
  const [showCalc,setShowCalc] = useState(false) // la calculadora se abre en una ventana chica, no ocupa espacio fijo
  const [nocturnoEdit,setNocturnoEdit] = useState({}) // {id: {bruto, calculado}} temporal por fila
  // ✅ No se borran las cautelares por defecto (queda el historial) — solo se
  // pueden corregir errores editando tipo/fechas. Eliminar de forma definitiva
  // es exclusivo del titular, para no acumular datos erróneos sueltos.
  const [editandoId,setEditandoId] = useState(null)
  const [editForm,setEditForm] = useState({ tipo:'', fecha_inicio:'', fecha_termino:'' })
  const [motivoEdit,setMotivoEdit] = useState('')
  // ✅ "Cerrar / cambiar" — antes pedía la fecha de término con un prompt
  // nativo del navegador (solo un campo suelto, sin contexto). Ahora muestra
  // "Inicio de cautelar" y "Término de cautelar" juntos, en un formulario
  // propio — más claro y dinámico, y se puede corregir el inicio de una vez
  // si hacía falta, sin tener que abrir aparte "✏ Editar".
  const [cerrandoId,setCerrandoId] = useState(null)
  const [cierreForm,setCierreForm] = useState({ fecha_inicio:'', fecha_termino:'' })

  // ✅ Abono total EN VIVO — SOLO cuenta Prisión Preventiva / Internación Provisoria /
  // Arresto Total (y Arresto Nocturno ya sumado explícitamente). Sujeción a SENAME
  // NUNCA suma acá — se cuenta aparte, para no duplicar el cómputo 1x1.
  const totalAbono = calcularTotalAbono(cautelares, hoyISO)

  // Días de SENAME — solo informativo, no entra al abono 1x1
  const totalDiasSename = cautelares.reduce((sum,ct)=>{
    if (ct.tipo === CAUTELAR_SENAME) return sum + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || hoyISO)
    return sum
  },0)

  const handleGuardar = async () => {
    if (!form.fecha_inicio) return
    setGuardando(true)
    await onGuardar(form)
    setForm({ tipo:TIPOS[0], fecha_inicio:hoyISO, fecha_termino:'', frecuencia:'Mensual' })
    setGuardando(false)
  }

  const iniciarCierre = (ct) => {
    setCerrandoId(ct.id)
    setCierreForm({ fecha_inicio: ct.fecha_inicio || '', fecha_termino: hoyISO })
  }

  const guardarCierre = async (ct) => {
    if (!cierreForm.fecha_inicio || !cierreForm.fecha_termino) return
    const cambios = { fecha_termino: cierreForm.fecha_termino }
    if (cierreForm.fecha_inicio !== ct.fecha_inicio) cambios.fecha_inicio = cierreForm.fecha_inicio
    await onActualizar(ct.id, cambios)
    setCerrandoId(null)
  }

  const iniciarEdicion = (ct) => {
    setEditandoId(ct.id)
    setEditForm({ tipo: ct.tipo, fecha_inicio: ct.fecha_inicio || '', fecha_termino: ct.fecha_termino || '' })
    setMotivoEdit('')
  }

  const guardarEdicion = async () => {
    if (!editForm.fecha_inicio) return
    if (!motivoEdit.trim()) { alert('Ingresa el motivo de la corrección — queda registrado para tener trazabilidad.'); return }
    await onActualizar(editandoId, { tipo: editForm.tipo, fecha_inicio: editForm.fecha_inicio, fecha_termino: editForm.fecha_termino || null }, motivoEdit.trim())
    setEditandoId(null)
  }

  const eliminarCautelar = async (ct) => {
    const motivo = window.prompt(`¿Eliminar DEFINITIVAMENTE la cautelar "${ct.tipo}" (desde ${ct.fecha_inicio})? Esta acción no se puede deshacer.\n\nIngresa el motivo de la eliminación:`)
    if (motivo === null || !motivo.trim()) return
    await onEliminar(ct.id, motivo.trim())
  }

  const calcularNocturno = (ct) => {
    const bruto = ct.fecha_termino ? diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino) : diasEntreFechasCaut(ct.fecha_inicio, fechaCalc)
    const calculado = Math.round((bruto*8/12)*100)/100
    setNocturnoEdit(prev=>({...prev,[ct.id]:{bruto,calculado}}))
  }

  const sumarNocturnoAlAbono = async (ct) => {
    const calc = nocturnoEdit[ct.id]
    if (!calc) return
    await onActualizar(ct.id, { dias_nocturno_bruto: calc.bruto, abono_nocturno_calculado: calc.calculado, sumado_a_abono: true })
    if (registrarActividad) registrarActividad('accion', `Sumó ${calc.calculado} días de abono (arresto nocturno) en RUC ${ruc}`)
  }

  return (
    <div style={{gridColumn:'1/-1',marginTop:2,marginBottom:2}}>
      {/* Label arriba, igual que cualquier otro campo del formulario */}
      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>
        Cautelar Personal{nombreImputado && <span style={{color:'#1E293B',textTransform:'none',letterSpacing:0}}> — {nombreImputado}</span>} {esRPA && <span style={{color:'#7c3aed'}}>· RPA</span>}
      </div>

      {/* Casilla — mismo look que los demás campos (fondo blanco, sombra suave, mismo alto).
          Al hacer clic se despliega el detalle, la calculadora y "+ Agregar más cautelares". */}
      <div
        className="fld"
        onClick={()=>setExpanded(v=>!v)}
        style={{
          cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'11px 14px', borderRadius: expanded ? '14px 14px 0 0' : 14, fontSize:13,
          color:'#1E293B', minHeight:38, background:'#fff', boxShadow:'0 1px 2px rgba(15,23,42,0.06)', ...f,
        }}>
        <span style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span>🔒</span>
          <strong>{totalAbono} días de abono</strong>
          {totalDiasSename > 0 && (
            <span style={{fontSize:11,color:'#92400e',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:'2px 8px',...f}}>
              SENAME: {totalDiasSename}d (aparte)
            </span>
          )}
        </span>
        <span style={{fontSize:11,color:'#94a3b8',flexShrink:0,marginLeft:8}}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:'0 0 14px 14px',padding:isMobile?'10px 12px 10px':'14px 16px 12px'}}>

          {cautelares.length===0 && <p style={{fontSize:13,color:'#94a3b8',marginBottom:8,...f}}>Sin cautelares registradas todavía.</p>}

          {/* Lista plana de cautelares registradas — texto/datos, sin tarjeta destacada */}
          {cautelares.map((ct,idx)=>{
            const esDirecto = TIPOS_ABONO_DIRECTO.includes(ct.tipo)
            const esNocturno = ct.tipo === CAUTELAR_NOCTURNO
            const esSename = ct.tipo === CAUTELAR_SENAME
            const vigente = !ct.fecha_termino
            const diasDirecto = esDirecto ? diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino||hoyISO) : 0
            const diasSename = esSename ? diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino||hoyISO) : 0
            const calcLocal = nocturnoEdit[ct.id]
            const editando = editandoId === ct.id
            const cerrando = cerrandoId === ct.id
            return (
              <div key={ct.id} style={{padding:'10px 0', borderBottom: idx<cautelares.length-1 ? '1px solid #f1f5f9' : 'none'}}>
                {cerrando ? (
                  <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#991b1b',marginBottom:8,...f}}>Cerrar "{ct.tipo}"</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <label style={{fontSize:9,color:'#94a3b8',...f}}>Inicio de cautelar</label>
                        <input type="date" style={{padding:'6px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={cierreForm.fecha_inicio} onChange={e=>setCierreForm(p=>({...p,fecha_inicio:e.target.value}))}/>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <label style={{fontSize:9,color:'#94a3b8',...f}}>Término de cautelar</label>
                        <input type="date" style={{padding:'6px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={cierreForm.fecha_termino} onChange={e=>setCierreForm(p=>({...p,fecha_termino:e.target.value}))}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>guardarCierre(ct)} disabled={!cierreForm.fecha_inicio||!cierreForm.fecha_termino} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:7,padding:'7px 14px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>✓ Cerrar cautelar</button>
                      <button onClick={()=>setCerrandoId(null)} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}}>✗ Cancelar</button>
                    </div>
                  </div>
                ) : editando ? (
                  <div style={{background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,padding:10}}>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <select style={{flex:'1 1 200px',minWidth:160,padding:'7px 9px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={editForm.tipo} onChange={e=>setEditForm(p=>({...p,tipo:e.target.value}))}>
                        {TIPOS.map(t=><option key={t}>{t}</option>)}
                      </select>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <label style={{fontSize:9,color:'#94a3b8',...f}}>Inicio</label>
                        <input type="date" style={{padding:'6px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={editForm.fecha_inicio} onChange={e=>setEditForm(p=>({...p,fecha_inicio:e.target.value}))}/>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <label style={{fontSize:9,color:'#94a3b8',...f}}>Término (opcional)</label>
                        <input type="date" style={{padding:'6px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} value={editForm.fecha_termino} onChange={e=>setEditForm(p=>({...p,fecha_termino:e.target.value}))}/>
                      </div>
                    </div>
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:9,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:700,...f}}>Motivo de la corrección *</div>
                      <input style={{width:'100%',padding:'7px 9px',border:'1.5px solid #fecaca',borderRadius:8,fontSize:12,color:'#1E293B',background:'#fff',...f}} placeholder="Ej: Error de tipeo en la fecha, tipo mal seleccionado..." value={motivoEdit} onChange={e=>setMotivoEdit(e.target.value)}/>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={guardarEdicion} disabled={!editForm.fecha_inicio} style={{background:'#1E293B',color:'#fff',border:'none',borderRadius:7,padding:'7px 14px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>✓ Guardar</button>
                      <button onClick={()=>setEditandoId(null)} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:7,padding:'7px 12px',fontSize:12,cursor:'pointer',...f}}>✗ Cancelar</button>
                    </div>
                  </div>
                ) : (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:6}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#1E293B',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',...f}}>
                      {ct.tipo}
                      <span style={{fontSize:11,fontWeight:600,color:vigente?'#059669':'#94a3b8',...f}}>{vigente?'Vigente':'Cerrada'}</span>
                      {esSename && <span style={{fontSize:11,color:'#92400e',...f}}>· sin abono 2×1</span>}
                    </div>
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:2,...f}}>
                      Desde {ct.fecha_inicio}{ct.fecha_termino?` hasta ${ct.fecha_termino}`:''}
                      {ct.frecuencia?` · ${ct.frecuencia}`:''}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:10,flexShrink:0,alignItems:'center'}}>
                    {vigente && <button onClick={()=>iniciarCierre(ct)} style={{fontSize:11,color:'#dc2626',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>Cerrar / cambiar</button>}
                    <button onClick={()=>iniciarEdicion(ct)} style={{fontSize:11,color:'#2563eb',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>✏ Editar</button>
                    {/* Eliminar de forma definitiva — solo el titular, para no acumular
                        registros erróneos sueltos sin perder el historial por defecto. */}
                    {esTitular && <button onClick={()=>eliminarCautelar(ct)} style={{fontSize:11,color:'#94a3b8',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>🗑 Eliminar</button>}
                  </div>
                </div>
                )}

                {!editando && esDirecto && (
                  <div style={{marginTop:6,fontSize:12,color:'#1E293B',...f}}>
                    📐 Abono 1×1: <strong>{diasDirecto} días</strong>{vigente?' (a hoy, sigue corriendo)':''}
                  </div>
                )}

                {!editando && esSename && (
                  <div style={{marginTop:6,fontSize:12,color:'#92400e',...f}}>
                    {diasSename} días de Sujeción a SENAME{vigente?' (a hoy, sigue corriendo)':''} — no otorgan abono 2×1, se llevan aparte.
                  </div>
                )}

                {!editando && esNocturno && (
                  <div style={{marginTop:6,fontSize:12,color:'#64748b',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',...f}}>
                    <span>Arresto nocturno (informativo): <strong>{ct.fecha_termino ? diasEntreFechasCaut(ct.fecha_inicio,ct.fecha_termino) : diasEntreFechasCaut(ct.fecha_inicio,fechaCalc)}</strong> días</span>
                    {ct.sumado_a_abono ? (
                      <span style={{color:'#059669',fontWeight:600}}>✓ Sumado: {ct.abono_nocturno_calculado} días</span>
                    ) : (
                      <>
                        <button onClick={()=>calcularNocturno(ct)} style={{fontSize:11,color:'#2563eb',background:'none',border:'none',cursor:'pointer',fontWeight:600,...f}}>🧮 Calcular (×8÷12)</button>
                        {calcLocal && (
                          <>
                            <span>= <strong>{calcLocal.calculado}</strong> días</span>
                            <button onClick={()=>sumarNocturnoAlAbono(ct)} style={{fontSize:11,color:'#059669',background:'none',border:'none',cursor:'pointer',fontWeight:600,...f}}>+ Sumar al abono</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {!editando && ct.historial && (
                  <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                    {ct.historial.split('\n').map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Calculadora — botón que abre una ventana chica encima de la página, en vez de
              ocupar espacio fijo siempre. Solo aparece si hay al menos una cautelar que
              otorgue abono (directo o nocturno). No guarda nada, es solo una previsualización. */}
          {cautelares.some(ct => TIPOS_ABONO_DIRECTO.includes(ct.tipo) || ct.tipo === CAUTELAR_NOCTURNO) && (
            <div style={{padding:'10px 0', borderTop: cautelares.length>0 ? '1px solid #f1f5f9' : 'none'}}>
              <button onClick={()=>setShowCalc(true)} style={{fontSize:12,color:'#2563eb',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontWeight:600,...f}}>🧮 Calcular abono a otra fecha</button>
            </div>
          )}

          {showCalc && (
            <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,backdropFilter:'blur(2px)'}}
              onClick={e=>e.target===e.currentTarget&&setShowCalc(false)}>
              <div style={{background:'#fff',borderRadius:16,padding:20,width:340,maxWidth:'90vw',boxShadow:'0 20px 60px rgba(15,23,42,0.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1E293B',...f}}>🧮 Abono a otra fecha</div>
                  <button onClick={()=>setShowCalc(false)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,color:'#94a3b8'}}>✕</button>
                </div>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:12,...f}}>Solo es una previsualización — no guarda nada.</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={fechaCalc} onChange={e=>setFechaCalc(e.target.value)}/>
                  {fechaCalc !== hoyISO && (
                    <button onClick={()=>setFechaCalc(hoyISO)} style={{fontSize:11,color:'#2563eb',background:'none',border:'none',cursor:'pointer',fontWeight:600,alignSelf:'flex-start',...f}}>↺ Volver a hoy</button>
                  )}
                  <div style={{background:'#F8F9FC',borderRadius:10,padding:'12px 14px',fontSize:13,color:'#475569',...f}}>
                    Abono proyectado: <strong style={{color:'#1E293B',fontSize:16}}>{cautelares.reduce((s,ct)=>{
                      if (TIPOS_ABONO_DIRECTO.includes(ct.tipo)) return s + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || fechaCalc)
                      if (ct.tipo===CAUTELAR_NOCTURNO && ct.sumado_a_abono) return s + (parseFloat(ct.abono_nocturno_calculado)||0)
                      return s
                    },0)} días</strong>
                  </div>
                </div>
                <button className="btn-primary" style={{width:'100%',marginTop:14,fontSize:13}} onClick={()=>setShowCalc(false)}>OK, cerrar</button>
              </div>
            </div>
          )}

          {/* Agregar cautelar — dropdown directo, sin botón intermedio */}
          <div style={{paddingTop:12, marginTop: cautelares.length>0 ? 2 : 0, borderTop: cautelares.length>0 ? '1px solid #f1f5f9' : 'none'}}>
            <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.2,marginBottom:6,fontWeight:600,...f}}>Agregar cautelar</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <select style={{flex:'1 1 220px',minWidth:180,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
              <input type="date" style={{flex:'1 1 140px',minWidth:140,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={form.fecha_inicio} onChange={e=>setForm(p=>({...p,fecha_inicio:e.target.value}))}/>
              {form.tipo==='Firma' && (
                <select style={{flex:'1 1 140px',minWidth:140,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={form.frecuencia} onChange={e=>setForm(p=>({...p,frecuencia:e.target.value}))}>
                  <option>Mensual</option><option>Quincenal</option><option>Semanal</option>
                </select>
              )}
              <button className="btn-primary" style={{fontSize:12,padding:'8px 16px',borderRadius:8}} onClick={handleGuardar} disabled={guardando || !form.fecha_inicio}>{guardando?'Guardando...':'+ Agregar'}</button>
            </div>
            {form.tipo === CAUTELAR_SENAME && (
              <div style={{fontSize:11,color:'#b45309',marginTop:6,...f}}>⚠ Esta medida no otorga abono 2×1 — se registrará por separado.</div>
            )}
          </div>

          <div style={{fontSize:10,color:'#94a3b8',marginTop:10,lineHeight:1.5,...f}}>
            El conteo de días no suma +1 por el día de inicio — si en tu práctica se cuenta incluyendo ese primer día, avísame y lo ajusto.
          </div>
        </div>
      )}
    </div>
  )
}

