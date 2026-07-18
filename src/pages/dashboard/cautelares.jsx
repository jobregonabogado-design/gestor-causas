// Panel de Medidas Cautelares dentro de una causa: historial, abono 1x1 y
// fórmula de arresto nocturno.
import { useState } from 'react'
import { f } from './primitives'

export const TIPOS_ABONO_DIRECTO = ['Prisión Preventiva','Internación Provisoria','Arresto Total']
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

export function CautelaresPanel({ causaId, cautelares, esRPA, onGuardar, onActualizar, registrarActividad, ruc, nombreImputado }) {
  const hoyISO = new Date().toISOString().slice(0,10)
  const TIPOS = esRPA ? TIPOS_CAUTELARES_RPA : TIPOS_CAUTELARES_ADULTO
  const [expanded,setExpanded] = useState(true) // la casilla queda visible; al abrir se ve el detalle
  const [form,setForm] = useState({ tipo:TIPOS[0], fecha_inicio:hoyISO, fecha_termino:'', frecuencia:'Mensual' })
  const [guardando,setGuardando] = useState(false)
  const [fechaCalc,setFechaCalc] = useState(hoyISO) // calculadora ad-hoc, no se guarda
  const [nocturnoEdit,setNocturnoEdit] = useState({}) // {id: {bruto, calculado}} temporal por fila

  // ✅ Abono total EN VIVO — SOLO cuenta Prisión Preventiva / Internación Provisoria /
  // Arresto Total (y Arresto Nocturno ya sumado explícitamente). Sujeción a SENAME
  // NUNCA suma acá — se cuenta aparte, para no duplicar el cómputo 1x1.
  const totalAbono = cautelares.reduce((sum,ct)=>{
    if (TIPOS_ABONO_DIRECTO.includes(ct.tipo)) {
      return sum + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || hoyISO)
    }
    if (ct.tipo === CAUTELAR_NOCTURNO && ct.sumado_a_abono) {
      return sum + (parseFloat(ct.abono_nocturno_calculado)||0)
    }
    return sum
  },0)

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

  const cerrarCautelar = async (ct) => {
    const fecha = window.prompt(`¿Hasta qué fecha estuvo vigente "${ct.tipo}"? (formato AAAA-MM-DD)`, hoyISO)
    if (!fecha) return
    await onActualizar(ct.id, { fecha_termino: fecha })
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
        <div style={{background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:'0 0 14px 14px',padding:'14px 16px 12px'}}>

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
            return (
              <div key={ct.id} style={{padding:'10px 0', borderBottom: idx<cautelares.length-1 ? '1px solid #f1f5f9' : 'none'}}>
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
                  {vigente && <button onClick={()=>cerrarCautelar(ct)} style={{fontSize:11,color:'#dc2626',background:'transparent',border:'none',cursor:'pointer',fontWeight:600,...f}}>Cerrar / cambiar</button>}
                </div>

                {esDirecto && (
                  <div style={{marginTop:6,fontSize:12,color:'#1E293B',...f}}>
                    📐 Abono 1×1: <strong>{diasDirecto} días</strong>{vigente?' (a hoy, sigue corriendo)':''}
                  </div>
                )}

                {esSename && (
                  <div style={{marginTop:6,fontSize:12,color:'#92400e',...f}}>
                    {diasSename} días de Sujeción a SENAME{vigente?' (a hoy, sigue corriendo)':''} — no otorgan abono 2×1, se llevan aparte.
                  </div>
                )}

                {esNocturno && (
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
              </div>
            )
          })}

          {/* Calculadora — solo aparece si hay al menos una cautelar que otorgue abono (directo o nocturno) */}
          {cautelares.some(ct => TIPOS_ABONO_DIRECTO.includes(ct.tipo) || ct.tipo === CAUTELAR_NOCTURNO) && (
            <div style={{padding:'10px 0', borderTop: cautelares.length>0 ? '1px solid #f1f5f9' : 'none'}}>
              <div style={{fontSize:11,color:'#64748b',marginBottom:8,...f}}>🧮 Previsualizar abono a otra fecha (no guarda nada)</div>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <input type="date" style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}} value={fechaCalc} onChange={e=>setFechaCalc(e.target.value)}/>
                {fechaCalc !== hoyISO && (
                  <button onClick={()=>setFechaCalc(hoyISO)} style={{fontSize:11,color:'#2563eb',background:'none',border:'none',cursor:'pointer',fontWeight:600,...f}}>↺ Volver a hoy</button>
                )}
                <span style={{fontSize:12,color:'#475569',...f}}>
                  Abono proyectado: <strong>{cautelares.reduce((s,ct)=>{
                    if (TIPOS_ABONO_DIRECTO.includes(ct.tipo)) return s + diasEntreFechasCaut(ct.fecha_inicio, ct.fecha_termino || fechaCalc)
                    if (ct.tipo===CAUTELAR_NOCTURNO && ct.sumado_a_abono) return s + (parseFloat(ct.abono_nocturno_calculado)||0)
                    return s
                  },0)} días</strong>
                </span>
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

