// Calculadora de plazo procesal dentro de una causa: agrega/edita
// audiencias y recalcula vencimiento y subestado automáticamente.
import { useState } from 'react'
import { f } from './primitives'
import { calcularVencimiento, calcularSubestado, diasRestantes, fechaDDMM } from './utils'

export function PlazoCalculador({ causaId, plazoActual, aumentos, onGuardarAudiencia, onEditarAudiencia, onEliminarAudiencia, isMobile }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'', fecha_proxima_audiencia:'' })
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({ fecha_audiencia:'', tipo_audiencia:'', dias_plazo:'', observacion:'', fecha_proxima_audiencia:'' })
  const [motivoEdit, setMotivoEdit] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [motivoEliminar, setMotivoEliminar] = useState('')
  const f = { fontFamily:"'Manrope','Inter',sans-serif" }
  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#1E293B', background:'#fff', ...f }
  const TIPO_PROXIMA = 'Aumento próxima audiencia'
  const TIPOS_AUDIENCIA_PLAZO = ['Formalización','Control de detención + Formalización','Ampliación de plazo',TIPO_PROXIMA,'Reapertura de investigación']

  // Días corridos entre dos fechas (para "Aumento próxima audiencia")
  const diasEntreFechas = (fechaA, fechaB) => {
    if (!fechaA || !fechaB) return null
    const a = new Date(fechaA + 'T12:00:00')
    const b = new Date(fechaB + 'T12:00:00')
    if (isNaN(a) || isNaN(b)) return null
    return Math.round((b - a) / (1000*60*60*24))
  }

  // Solo las audiencias NO eliminadas cuentan para el cálculo del vencimiento
  const activos = (aumentos || []).filter(a => !a.eliminado)

  // ✅ Cada audiencia calcula su PROPIO vencimiento desde su PROPIA fecha (no se
  // encadena desde la audiencia de origen) — así lo pidió Joaquín explícitamente:
  // "cada vez que se suma un plazo es desde la fecha de la audiencia que se está
  // registrando... se debe nuevamente calcular la fecha de vencimiento" — el
  // vencimiento VIGENTE es siempre el de la audiencia más reciente (por fecha).
  // El total acumulado de días SÍ se sigue mostrando (Acum.), pero solo como
  // registro histórico — ya no se usa para calcular la fecha de vencimiento.
  const calcularVencimientoActual = (auds) => {
    if (!auds || auds.length === 0) return null
    const sorted = [...auds].sort((a,b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia))
    const ultima = sorted[sorted.length - 1]
    return calcularVencimiento(ultima.fecha_audiencia, ultima.dias_plazo)
  }

  // ✅ Para "Aumento próxima audiencia": como cada audiencia ahora calcula su
  // PROPIO vencimiento (fecha_audiencia + dias_plazo, sin encadenar con las
  // anteriores), los días se calculan DIRECTO entre la fecha de ESTA audiencia
  // y la fecha real conocida de la próxima — así, al aplicar la fórmula normal
  // (fecha_audiencia + dias_plazo), el resultado cae exacto en la fecha pedida.
  const diasCalculadosNuevo = form.tipo_audiencia === TIPO_PROXIMA ? diasEntreFechas(form.fecha_audiencia, form.fecha_proxima_audiencia) : null
  const diasFormNuevo = form.tipo_audiencia === TIPO_PROXIMA ? diasCalculadosNuevo : form.dias_plazo
  const vencimientoPreview = form.tipo_audiencia === TIPO_PROXIMA ? form.fecha_proxima_audiencia : (form.fecha_audiencia && diasFormNuevo ? calcularVencimiento(form.fecha_audiencia, diasFormNuevo) : '')

  const diasCalculadosEdit = formEdit.tipo_audiencia === TIPO_PROXIMA ? diasEntreFechas(formEdit.fecha_audiencia, formEdit.fecha_proxima_audiencia) : null

  const handleGuardar = async () => {
    const diasFinal = form.tipo_audiencia === TIPO_PROXIMA ? diasCalculadosNuevo : parseInt(form.dias_plazo)
    if (!form.fecha_audiencia || !diasFinal || diasFinal <= 0) return
    setGuardando(true)
    await onGuardarAudiencia({ ...form, dias_plazo: diasFinal })
    setForm({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'', fecha_proxima_audiencia:'' })
    setShowForm(false)
    setGuardando(false)
  }

  const empezarEdicion = (a) => {
    setEditandoId(a.id)
    setMotivoEdit('')
    setFormEdit({ fecha_audiencia:a.fecha_audiencia||'', tipo_audiencia:a.tipo_audiencia||'Formalización', dias_plazo:String(a.dias_plazo||''), observacion:a.observacion||'', fecha_proxima_audiencia:a.fecha_proxima_audiencia||'' })
  }

  const guardarEdicion = async () => {
    const diasFinal = formEdit.tipo_audiencia === TIPO_PROXIMA ? diasCalculadosEdit : parseInt(formEdit.dias_plazo)
    if (!formEdit.fecha_audiencia || !diasFinal || diasFinal <= 0) return
    if (!motivoEdit.trim()) { alert('Ingresa el motivo de la corrección — queda registrado para tener trazabilidad.'); return }
    setGuardandoEdit(true)
    await onEditarAudiencia(editandoId, { ...formEdit, dias_plazo: diasFinal }, motivoEdit.trim())
    setEditandoId(null)
    setGuardandoEdit(false)
  }

  const confirmarEliminar = async (id) => {
    if (!motivoEliminar.trim()) { alert('Ingresa el motivo de la eliminación — queda registrado, visible y tachado en el historial.'); return }
    await onEliminarAudiencia(id, motivoEliminar.trim())
    setEliminandoId(null)
    setMotivoEliminar('')
  }

  const diasTotal = activos.reduce((s,a) => s + (parseInt(a.dias_plazo)||0), 0)
  const vencFinal = calcularVencimientoActual(activos)
  const subestado = calcularSubestado(vencFinal)
  const diff = diasRestantes(vencFinal)

  return (
    <div>
      {/* En celular, las 3 tarjetas de resumen se apilan una debajo de otra (fila
          horizontal: valor a la izquierda, etiqueta a la derecha) en vez de ir
          las 3 apretadas lado a lado — la de Vencimiento en particular tiene 3
          líneas de texto y quedaba muy chica para leer. */}
      <div style={isMobile?{display:'flex',flexDirection:'column',gap:8,marginBottom:20}:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <div style={isMobile
          ?{background:'#fafbff',border:'2px solid #93c5fd',borderRadius:12,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}
          :{background:'#fafbff',border:'2px solid #93c5fd',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:600,order:isMobile?0:1,marginTop:isMobile?0:4,...f}}>Audiencias vigentes</div>
          <div style={{fontSize:28,fontWeight:900,color:'#2563eb',letterSpacing:'-1px',order:isMobile?1:0,...f}}>{activos.length}</div>
        </div>
        <div style={isMobile
          ?{background:'#fffefa',border:'2px solid #fcd34d',borderRadius:12,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}
          :{background:'#fffefa',border:'2px solid #fcd34d',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:600,order:isMobile?0:1,marginTop:isMobile?0:4,...f}}>Días corridos totales</div>
          <div style={{fontSize:28,fontWeight:900,color:'#d97706',letterSpacing:'-1px',order:isMobile?1:0,...f}}>{diasTotal}</div>
        </div>
        <div style={isMobile
          ?{background:subestado==='vencido'?'#fffafa':subestado==='proximo'?'#fffefa':'#fafffd',border:`2px solid ${subestado==='vencido'?'#fca5a5':subestado==='proximo'?'#fcd34d':'#86efac'}`,borderRadius:12,padding:'12px 16px'}
          :{background:subestado==='vencido'?'#fffafa':subestado==='proximo'?'#fffefa':'#fafffd',border:`2px solid ${subestado==='vencido'?'#fca5a5':subestado==='proximo'?'#fcd34d':'#86efac'}`,borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:600,...f}}>Vencimiento</div>
          <div style={{fontSize:isMobile?16:13,fontWeight:800,marginTop:isMobile?4:0,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#059669',...f}}>{vencFinal || '—'}</div>
          {diff !== null && <div style={{fontSize:11,fontWeight:600,marginTop:4,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#64748b',...f}}>{subestado==='vencido' ? `Venció hace ${Math.abs(diff)} días` : subestado==='proximo' ? `⚠️ Vence en ${diff} días` : `Faltan ${diff} días`}</div>}
        </div>
      </div>
      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Historial de audiencias de plazo</div>
      {(!aumentos||aumentos.length===0) && <p style={{color:'#94a3b8',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
      {aumentos && aumentos.map((a,i) => {
        // "Acum." = solo un registro histórico de días sumados hasta esta audiencia
        // (no eliminadas, en orden de fecha) — ya NO se usa para calcular el
        // vencimiento. "Vence" es el vencimiento PROPIO de esta audiencia: su
        // propia fecha + sus propios días, sin encadenar con las anteriores.
        const posEnActivos = activos.findIndex(x=>x.id===a.id)
        const audsHasta = posEnActivos >= 0 ? activos.slice(0,posEnActivos+1) : []
        const diasAcum = audsHasta.reduce((s,x)=>s+(parseInt(x.dias_plazo)||0),0)
        const vencPropio = a.fecha_audiencia && a.dias_plazo ? calcularVencimiento(a.fecha_audiencia, a.dias_plazo) : null

        // ─── Fila ELIMINADA: tachada, con el motivo visible (transparencia, no se oculta) ───
        if (a.eliminado) return (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'12px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8,opacity:0.75}}>
            <div style={{width:30,height:30,background:'#94a3b8',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,flexShrink:0}}>✕</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#94a3b8',textDecoration:'line-through',...f}}>{a.tipo_audiencia||'Audiencia'} · {fechaDDMM(a.fecha_audiencia)} · +{a.dias_plazo}d</div>
              <div style={{fontSize:11,color:'#dc2626',marginTop:4,...f}}>🗑 Eliminada por {a.eliminado_por||'—'} el {a.eliminado_en ? new Date(a.eliminado_en).toLocaleDateString('es-CL') : '—'} · Motivo: {a.motivo_eliminacion||'—'}</div>
            </div>
          </div>
        )

        if (editandoId === a.id) return (
          <div key={a.id} style={{background:'#faf5ff',border:'1.5px solid #ddd6fe',borderRadius:12,padding:16,marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:'#5b21b6',marginBottom:12,...f}}>✏ Corregir audiencia de plazo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tipo de audiencia</div>
                <select style={inp} value={formEdit.tipo_audiencia} onChange={e=>setFormEdit(p=>({...p,tipo_audiencia:e.target.value}))}>
                  {TIPOS_AUDIENCIA_PLAZO.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de audiencia</div><input type="date" style={inp} value={formEdit.fecha_audiencia} onChange={e=>setFormEdit(p=>({...p,fecha_audiencia:e.target.value}))}/></div>
              {formEdit.tipo_audiencia === TIPO_PROXIMA ? (
                <div>
                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de la próxima audiencia</div>
                  <input type="date" style={inp} value={formEdit.fecha_proxima_audiencia} onChange={e=>setFormEdit(p=>({...p,fecha_proxima_audiencia:e.target.value}))}/>
                </div>
              ) : (
                <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días de plazo otorgados</div><input type="number" style={inp} value={formEdit.dias_plazo} onChange={e=>setFormEdit(p=>({...p,dias_plazo:e.target.value}))}/></div>
              )}
              {formEdit.tipo_audiencia === TIPO_PROXIMA && diasCalculadosEdit !== null && (
                <div style={{gridColumn:'1/-1',fontSize:12,color:'#5b21b6',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:'8px 12px',...f}}>📐 Se calculó automáticamente: <strong>{diasCalculadosEdit} días corridos</strong></div>
              )}
              <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{formEdit.tipo_audiencia === TIPO_PROXIMA ? 'Motivo / tipo de la próxima audiencia' : 'Observación'}</div><input style={inp} placeholder={formEdit.tipo_audiencia === TIPO_PROXIMA ? 'Ej: Procedimiento Abreviado' : ''} value={formEdit.observacion} onChange={e=>setFormEdit(p=>({...p,observacion:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Motivo de la corrección *</div>
                <input style={{...inp,borderColor:'#fecaca'}} placeholder="Ej: Error de tipeo en los días, fecha mal ingresada..." value={motivoEdit} onChange={e=>setMotivoEdit(e.target.value)}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn-primary" style={{fontSize:12}} onClick={guardarEdicion} disabled={guardandoEdit}>{guardandoEdit?'Guardando...':'✓ Guardar corrección'}</button>
              <button className="btn-secondary" style={{fontSize:12}} onClick={()=>setEditandoId(null)}>Cancelar</button>
            </div>
          </div>
        )

        if (eliminandoId === a.id) return (
          <div key={a.id} style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:16,marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:'#991b1b',marginBottom:10,...f}}>🗑 Eliminar "{a.tipo_audiencia}" del {fechaDDMM(a.fecha_audiencia)}</div>
            <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Motivo de la eliminación *</div>
            <input style={{...inp,borderColor:'#fecaca',marginBottom:10}} placeholder="Ej: Se ingresó dos veces por error..." value={motivoEliminar} onChange={e=>setMotivoEliminar(e.target.value)} autoFocus/>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:10,...f}}>No se borra de verdad — queda tachada y visible en el historial con este motivo, para tener trazabilidad.</div>
            <div style={{display:'flex',gap:8}}>
              <button style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer',...f}} onClick={()=>confirmarEliminar(a.id)}>✓ Confirmar eliminación</button>
              <button className="btn-secondary" style={{fontSize:12}} onClick={()=>{setEliminandoId(null);setMotivoEliminar('')}}>Cancelar</button>
            </div>
          </div>
        )

        // En celular la fila se apila vertical (número/tipo, fecha, plazo, botones)
        // en vez de ir todo horizontal, porque no cabía y se salía del cuadro.
        return isMobile ? (
          <div key={a.id} style={{padding:'14px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:26,height:26,background:'#1E293B',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700,flexShrink:0}}>{posEnActivos+1}</div>
              <div style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>{a.tipo_audiencia||'Audiencia'}</div>
            </div>
            <div style={{fontSize:12,color:'#94a3b8',marginBottom:2,...f}}>📅 {fechaDDMM(a.fecha_audiencia)}{a.fecha_proxima_audiencia?` → próxima: ${fechaDDMM(a.fecha_proxima_audiencia)}`:''}</div>
            {a.observacion&&<div style={{fontSize:12,color:'#64748b',marginBottom:2,...f}}>{a.observacion}</div>}
            <div style={{display:'flex',gap:14,alignItems:'center',marginTop:8,padding:'8px 10px',background:'#fff',borderRadius:8}}>
              <div style={{fontSize:15,fontWeight:800,color:'#2563eb',...f}}>+{a.dias_plazo}d</div>
              <div>
                <div style={{fontSize:11,color:'#94a3b8',...f}}>Vence: {vencPropio||"—"}</div>
                <div style={{fontSize:10,color:'#94a3b8',...f}}>Acum. {diasAcum}d</div>
              </div>
            </div>
            {a.historial && (
              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                {a.historial.split('\n').map((h,idx)=><div key={idx} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <button onClick={()=>empezarEdicion(a)} style={{flex:1,background:'#faf5ff',border:'1px solid #ddd6fe',borderRadius:6,padding:'6px 8px',fontSize:11,color:'#5b21b6',cursor:'pointer',fontWeight:600,...f}}>✏ Corregir</button>
              <button onClick={()=>{setEliminandoId(a.id);setMotivoEliminar('')}} style={{flex:1,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'6px 8px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,...f}}>✕ Eliminar</button>
            </div>
          </div>
        ) : (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8}}>
            <div style={{width:30,height:30,background:'#1E293B',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{posEnActivos+1}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>{a.tipo_audiencia||'Audiencia'}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2,...f}}>📅 {fechaDDMM(a.fecha_audiencia)}{a.fecha_proxima_audiencia?` → próxima audiencia: ${fechaDDMM(a.fecha_proxima_audiencia)}`:''}</div>
              {a.observacion&&<div style={{fontSize:12,color:'#64748b',marginTop:2,...f}}>{a.observacion}</div>}
              {a.historial && (
                <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                  {a.historial.split('\n').map((h,idx)=><div key={idx} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
                </div>
              )}
            </div>
            <div style={{textAlign:'right',marginRight:4}}>
              <div style={{fontSize:16,fontWeight:800,color:'#2563eb',...f}}>+{a.dias_plazo}d</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2,...f}}>Vence: {vencPropio||"—"}</div>
              <div style={{fontSize:10,color:'#94a3b8',...f}}>Acum. {diasAcum}d</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
              <button onClick={()=>empezarEdicion(a)} style={{background:'#faf5ff',border:'1px solid #ddd6fe',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#5b21b6',cursor:'pointer',fontWeight:600,...f}}>✏ Corregir</button>
              <button onClick={()=>{setEliminandoId(a.id);setMotivoEliminar('')}} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#dc2626',cursor:'pointer',fontWeight:600,...f}}>✕ Eliminar</button>
            </div>
          </div>
        )
      })}
      {showForm ? (
        <div style={{background:'#f0f7ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:16,marginTop:12}}>
          <div style={{fontSize:12,fontWeight:700,color:'#2563eb',marginBottom:12,...f}}>{activos.length === 0 ? '📋 Registrar audiencia de formalización' : '📋 Registrar nueva audiencia de plazo'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tipo de audiencia</div><select style={inp} value={form.tipo_audiencia} onChange={e=>setForm(p=>({...p,tipo_audiencia:e.target.value}))}>{TIPOS_AUDIENCIA_PLAZO.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de audiencia</div><input type="date" style={inp} value={form.fecha_audiencia} onChange={e=>setForm(p=>({...p,fecha_audiencia:e.target.value}))}/></div>
            {form.tipo_audiencia === TIPO_PROXIMA ? (
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de la próxima audiencia</div>
                <input type="date" style={inp} value={form.fecha_proxima_audiencia} onChange={e=>setForm(p=>({...p,fecha_proxima_audiencia:e.target.value}))}/>
              </div>
            ) : (
              <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días de plazo otorgados</div><input type="number" style={inp} placeholder="Ej: 30, 90, 210" value={form.dias_plazo} onChange={e=>setForm(p=>({...p,dias_plazo:e.target.value}))}/></div>
            )}
            {form.tipo_audiencia === TIPO_PROXIMA && diasCalculadosNuevo !== null && (
              <div style={{gridColumn:'1/-1',fontSize:12,color:'#5b21b6',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:'8px 12px',...f}}>📐 Se calculó automáticamente: <strong>{diasCalculadosNuevo} días corridos</strong></div>
            )}
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{form.tipo_audiencia === TIPO_PROXIMA ? 'Motivo / tipo de la próxima audiencia' : 'Observación'}</div><input style={inp} placeholder={form.tipo_audiencia === TIPO_PROXIMA ? 'Ej: Procedimiento Abreviado' : 'Ej: Diligencias pendientes'} value={form.observacion} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}/></div>
          </div>
          {vencimientoPreview && <div style={{marginBottom:12,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #bfdbfe',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📅</span><div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento de este plazo</div><div style={{fontSize:15,fontWeight:800,color:'#2563eb',...f}}>{vencimientoPreview}</div></div></div>}
          <div style={{display:'flex',gap:8}}><button className="btn-primary" style={{fontSize:12}} onClick={handleGuardar} disabled={guardando||!form.fecha_audiencia}>{guardando?'Guardando...':'💾 Guardar audiencia'}</button><button className="btn-secondary" style={{fontSize:12}} onClick={()=>setShowForm(false)}>Cancelar</button></div>
        </div>
      ) : (
        <button className="btn-secondary" style={{marginTop:12}} onClick={()=>setShowForm(true)}>+ {activos.length === 0 ? 'Registrar formalización' : 'Registrar nueva audiencia de plazo'}</button>
      )}
    </div>
  )
}

// ─── TARJETA POR IMPUTADO — cuando hay 2+ imputados, agrupa todo lo que puede
// variar entre ellos: Centro Penal, Cautelar Personal, Delito(s), Delegación de
// Poder y Correo de notificación. Colapsable, con su propio estado de edición
// local (para que no choquen entre tarjetas de distintos imputados). Los datos
// de la causa (Tribunal, Corte, RIT, Fiscal, Fechas) quedan arriba, compartidos,
// porque son los mismos para toda la causa sin importar cuántos imputados haya. ─
