import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import CarpetaOneDrive from '../components/CarpetaOneDrive'
import {
  estadoConfig, SUBESTADOS_VIGENTE, SUBESTADOS_TERMINADA, getBadgeConfig,
  corregirOrtografia, getCorteApelaciones, TRIBUNALES_CHILE, DELITOS_CATALOGO,
  CENTROS_PENALES,
} from './dashboard/utils'
import {
  SearchableSelect, DelitosChips, DelitoCard, SemaforoTag, Badge, BadgeEditor, Field, f, normT,
} from './dashboard/primitives'
import { AudienciaCard, ImputadoCard } from './dashboard/cards'
import { DiligenciasFiscalia, parsearComprobanteFiscalia } from './dashboard/diligencias'
import { FallosReferencia, DocumentosGuardados } from './dashboard/documentos'
import { HonorariosTab } from './dashboard/honorarios'
import { TeoriaDelCaso } from './dashboard/teoria'
import { CautelaresPanel, TIPOS_ABONO_DIRECTO, CAUTELAR_NOCTURNO, TIPOS_CAUTELARES_TODAS, diasEntreFechasCaut } from './dashboard/cautelares'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  .row-hover { transition:background 0.2s ease, border-color 0.2s ease; cursor:pointer; }
  .row-hover:hover { background:#f8faff !important; }
  .stat-card { transition:all 0.3s cubic-bezier(0.4,0,0.2,1); cursor:pointer; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,23,42,0.10) !important; }
  .tab-btn { transition:color 0.2s ease, border-color 0.2s ease; border:none; background:none; cursor:pointer; font-family:'Inter',sans-serif; }
  .tab-btn:hover { color:#1E293B !important; }
  .fld { transition:border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease; }
  .fld:hover { border-color:#93c5fd !important; background:#fafcff !important; box-shadow:0 0 0 3px rgba(37,99,235,0.05) !important; }
  .sort-col { cursor:pointer; user-select:none; transition:color 0.2s ease; }
  .sort-col:hover { color:#1E293B !important; }
  .btn-primary { font-family:'Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,58,95,0.2); }
  .btn-primary:hover { background:#1e40af; box-shadow:0 4px 16px rgba(30,58,95,0.3); }
  .btn-secondary { font-family:'Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; }
  .btn-secondary:hover { border-color:#93c5fd; color:#1E293B; background:#f8faff; }
  .detail-enter { animation:detailIn 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes detailIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  input,select,textarea { font-family:'Inter',sans-serif !important; transition:border-color 0.25s ease, box-shadow 0.25s ease; text-transform:uppercase; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08) !important; }
  .tc-section textarea:focus { box-shadow: none !important; border-color: transparent !important; }
  @keyframes semaforo-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.2)} }
  @keyframes chipIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .chip-group { animation:chipIn 0.28s cubic-bezier(0.4,0,0.2,1) forwards; }
  .chip-btn { transition:all 0.18s ease; }
  .chip-btn:hover { transform:translateY(-1px); box-shadow:0 3px 10px rgba(15,23,42,0.08); }
  .caut-header { transition:filter 0.2s ease; }
  .caut-header:hover { filter:brightness(1.08); }
  .causa-row { border-bottom:1px solid #f1f5f9; }
  .causa-row:last-child { border-bottom:none; }
  .causa-row-mobile { display:none; }
  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .hide-mobile { display: none !important; }
    .grid2-mobile { grid-template-columns: 1fr !important; }
    .causa-col-desktop { display: none !important; }
    .causa-row-mobile { display: block !important; }
  }
`

// ─── COMPONENTE DROPDOWN CON BUSQUEDA ────────────────────────────────────────
// ─── TEORÍA DEL CASO ──────────────────────────────────────────────────────────
function calcularRegimenAlMomento(fechaNac, fechaHechos) {
  if (!fechaNac || !fechaHechos) return null
  const nac = new Date(fechaNac + 'T12:00:00')
  const hechos = new Date(fechaHechos + 'T12:00:00')
  if (isNaN(nac) || isNaN(hechos)) return null
  let edad = hechos.getFullYear() - nac.getFullYear()
  const m = hechos.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hechos.getDate() < nac.getDate())) edad--
  return edad < 18 ? 'RPA' : 'ADULTO'
}

function calcularVencimiento(fechaInicio, diasPlazo) {
  if (!fechaInicio || !diasPlazo) return ''
  const inicio = new Date(fechaInicio + 'T12:00:00')
  inicio.setDate(inicio.getDate() + parseInt(diasPlazo))
  return inicio.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function parseFechaCL(str) {
  if (!str) return null
  const limpio = str.replace(/VENCE\s*/i, '').trim()
  const partes = limpio.split(/[\/\-\.]/)
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

function PlazoCalculador({ causaId, plazoActual, aumentos, onGuardarAudiencia, onEditarAudiencia, onEliminarAudiencia }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fecha_audiencia:'', tipo_audiencia:'Formalización', dias_plazo:'', observacion:'', fecha_proxima_audiencia:'' })
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState({ fecha_audiencia:'', tipo_audiencia:'', dias_plazo:'', observacion:'', fecha_proxima_audiencia:'' })
  const [motivoEdit, setMotivoEdit] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [motivoEliminar, setMotivoEliminar] = useState('')
  const f = { fontFamily:"'Inter',sans-serif" }
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

  // "DD-MM-YYYY" (formato de calcularVencimiento) → "YYYY-MM-DD" (para poder restar fechas)
  const aISO = (fechaDDMMYYYY) => {
    if (!fechaDDMMYYYY) return null
    const [d,m,y] = fechaDDMMYYYY.split('-')
    return `${y}-${m}-${d}`
  }

  // Solo las audiencias NO eliminadas cuentan para el cálculo del vencimiento total
  const activos = (aumentos || []).filter(a => !a.eliminado)
  const activosOrdenados = [...activos].sort((a,b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia))

  const calcularVencimientoTotal = (auds) => {
    if (!auds || auds.length === 0) return null
    const sorted = [...auds].sort((a,b) => a.fecha_audiencia.localeCompare(b.fecha_audiencia))
    const diasTotal = auds.reduce((s,a) => s + (parseInt(a.dias_plazo)||0), 0)
    return calcularVencimiento(sorted[0].fecha_audiencia, diasTotal)
  }

  // ✅ CALIBRACIÓN: para "Aumento próxima audiencia" los días NO se cuentan desde la
  // fecha de ESA audiencia puntual — se cuentan desde el VENCIMIENTO ACUMULADO hasta
  // ese momento (la fórmula general es: vencimiento = primera_fecha + suma de TODOS
  // los días). Si se contara desde la fecha de la audiencia, el resultado final no
  // cae en la fecha real de la próxima audiencia, porque arrastra el desfase de
  // todo lo acumulado antes. Contando desde el vencimiento acumulado, si no hay
  // ningún desfase previo, el resultado coincide exactamente con la fecha pedida.
  const vencimientoAntesDeNueva = calcularVencimientoTotal(activos) // acumulado de TODO lo que ya existe
  const baseParaNueva = vencimientoAntesDeNueva ? aISO(vencimientoAntesDeNueva) : form.fecha_audiencia

  // Vencimiento acumulado hasta (pero sin incluir) una audiencia dada — para corregir una ya existente
  const obtenerVencimientoPrevio = (idActual) => {
    const idx = activosOrdenados.findIndex(x => x.id === idActual)
    if (idx <= 0) return null // es la primera (o no está en la lista): no hay "antes"
    const anteriores = activosOrdenados.slice(0, idx)
    const diasPrevios = anteriores.reduce((s,x) => s + (parseInt(x.dias_plazo)||0), 0)
    return calcularVencimiento(anteriores[0].fecha_audiencia, diasPrevios)
  }

  // Días calculados automáticamente cuando el tipo es "Aumento próxima audiencia"
  const diasCalculadosNuevo = form.tipo_audiencia === TIPO_PROXIMA ? diasEntreFechas(baseParaNueva, form.fecha_proxima_audiencia) : null
  const diasFormNuevo = form.tipo_audiencia === TIPO_PROXIMA ? diasCalculadosNuevo : form.dias_plazo
  const vencimientoPreview = form.tipo_audiencia === TIPO_PROXIMA ? form.fecha_proxima_audiencia : (form.fecha_audiencia && diasFormNuevo ? calcularVencimiento(form.fecha_audiencia, diasFormNuevo) : '')

  const vencimientoPrevioEdit = editandoId ? (obtenerVencimientoPrevio(editandoId) || (activosOrdenados.find(x=>x.id===editandoId)?.fecha_audiencia)) : null
  const baseParaEdit = vencimientoPrevioEdit ? (vencimientoPrevioEdit.includes('-') && vencimientoPrevioEdit.length===10 && vencimientoPrevioEdit[4]==='-' ? vencimientoPrevioEdit : aISO(vencimientoPrevioEdit)) : formEdit.fecha_audiencia
  const diasCalculadosEdit = formEdit.tipo_audiencia === TIPO_PROXIMA ? diasEntreFechas(baseParaEdit, formEdit.fecha_proxima_audiencia) : null

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
  const vencFinal = calcularVencimientoTotal(activos)
  const subestado = calcularSubestado(vencFinal)
  const diff = diasRestantes(vencFinal)

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#2563eb',letterSpacing:'-1px',...f}}>{activos.length}</div>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Audiencias vigentes</div>
        </div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:900,color:'#d97706',letterSpacing:'-1px',...f}}>{diasTotal}</div>
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginTop:4,fontWeight:600,...f}}>Días corridos totales</div>
        </div>
        <div style={{background:subestado==='vencido'?'#fef2f2':subestado==='proximo'?'#fffbeb':'#f0fdf4',border:`1.5px solid ${subestado==='vencido'?'#fecaca':subestado==='proximo'?'#fde68a':'#a7f3d0'}`,borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:800,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#059669',...f}}>{vencFinal || '—'}</div>
          {diff !== null && <div style={{fontSize:11,fontWeight:600,marginTop:4,color:subestado==='vencido'?'#dc2626':subestado==='proximo'?'#d97706':'#64748b',...f}}>{subestado==='vencido' ? `Venció hace ${Math.abs(diff)} días` : subestado==='proximo' ? `⚠️ Vence en ${diff} días` : `Faltan ${diff} días`}</div>}
          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginTop:2,fontWeight:600,...f}}>Vencimiento</div>
        </div>
      </div>
      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Historial de audiencias de plazo</div>
      {(!aumentos||aumentos.length===0) && <p style={{color:'#94a3b8',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
      {aumentos && aumentos.map((a,i) => {
        // El acumulado se calcula solo sobre las audiencias vigentes (no eliminadas), en orden de fecha
        const posEnActivos = activos.findIndex(x=>x.id===a.id)
        const audsHasta = posEnActivos >= 0 ? activos.slice(0,posEnActivos+1) : []
        const diasAcum = audsHasta.reduce((s,x)=>s+(parseInt(x.dias_plazo)||0),0)
        const vencAcum = audsHasta.length ? calcularVencimiento(audsHasta[0].fecha_audiencia, diasAcum) : null

        // ─── Fila ELIMINADA: tachada, con el motivo visible (transparencia, no se oculta) ───
        if (a.eliminado) return (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'12px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8,opacity:0.75}}>
            <div style={{width:30,height:30,background:'#94a3b8',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,flexShrink:0}}>✕</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#94a3b8',textDecoration:'line-through',...f}}>{a.tipo_audiencia||'Audiencia'} · {a.fecha_audiencia} · +{a.dias_plazo}d</div>
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
            <div style={{fontSize:12,fontWeight:700,color:'#991b1b',marginBottom:10,...f}}>🗑 Eliminar "{a.tipo_audiencia}" del {a.fecha_audiencia}</div>
            <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Motivo de la eliminación *</div>
            <input style={{...inp,borderColor:'#fecaca',marginBottom:10}} placeholder="Ej: Se ingresó dos veces por error..." value={motivoEliminar} onChange={e=>setMotivoEliminar(e.target.value)} autoFocus/>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:10,...f}}>No se borra de verdad — queda tachada y visible en el historial con este motivo, para tener trazabilidad.</div>
            <div style={{display:'flex',gap:8}}>
              <button style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer',...f}} onClick={()=>confirmarEliminar(a.id)}>✓ Confirmar eliminación</button>
              <button className="btn-secondary" style={{fontSize:12}} onClick={()=>{setEliminandoId(null);setMotivoEliminar('')}}>Cancelar</button>
            </div>
          </div>
        )

        return (
          <div key={a.id} style={{display:'flex',gap:12,alignItems:'center',padding:'14px 16px',background:'#F8F9FC',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:8}}>
            <div style={{width:30,height:30,background:'#1E293B',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>{posEnActivos+1}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#1E293B',...f}}>{a.tipo_audiencia||'Audiencia'}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2,...f}}>📅 {a.fecha_audiencia}{a.fecha_proxima_audiencia?` → próxima audiencia: ${a.fecha_proxima_audiencia}`:''}</div>
              {a.observacion&&<div style={{fontSize:12,color:'#64748b',marginTop:2,...f}}>{a.observacion}</div>}
              {a.historial && (
                <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #e2e8f0'}}>
                  {a.historial.split('\n').map((h,idx)=><div key={idx} style={{fontSize:10,color:'#94a3b8',...f}}>📝 {h}</div>)}
                </div>
              )}
            </div>
            <div style={{textAlign:'right',marginRight:4}}>
              <div style={{fontSize:16,fontWeight:800,color:'#2563eb',...f}}>+{a.dias_plazo}d</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2,...f}}>Vence: {vencAcum||'—'}</div>
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
function ImputadoDatosCard({ imp, numero, causaId, ruc, cautelares, registrarActividad, onUpdateCampo, onDelitoChange, onGuardarCautelar, onActualizarCautelar }) {
  const [expanded, setExpanded] = useState(false)
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const f = { fontFamily:"'Inter',sans-serif" }

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
          {/* Centro Penal */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Centro Penal</div>
            <SearchableSelect value={imp.lugar_detencion} onChange={(v)=>onUpdateCampo('lugar_detencion', v)} options={CENTROS_PENALES} placeholder="Buscar centro penal..." isDelito={false}/>
          </div>

          {/* Cautelar Personal */}
          <CautelaresPanel
            causaId={causaId}
            ruc={ruc}
            cautelares={cautelares}
            esRPA={imp.regimen==='RPA'}
            registrarActividad={registrarActividad}
            onGuardar={onGuardarCautelar}
            onActualizar={onActualizarCautelar}
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
                      onKeyDown={e=>{if(e.key==='Enter'){onUpdateCampo('delegacion_fecha',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                    <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{onUpdateCampo('delegacion_fecha',editValue);setEditField(null)}}>✓</button>
                    <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                  </div>
                ):(
                  <div className="fld" onClick={()=>{setEditField('delegacion_fecha');setEditValue(imp.delegacion_fecha||'')}}
                    style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:imp.delegacion_fecha?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                    <span>{imp.delegacion_fecha || 'Clic para agregar...'}</span>
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

export default function Dashboard({ session, userRol, registrarActividad, causaInicial, onCausaInicialUsada }) {
  const esTitular = userRol?.rol === 'titular'
  const [causas,setCausas]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterTribunal,setFilterTribunal]=useState('')
  const [filterEstado,setFilterEstado]=useState('')
  const [filterDelito,setFilterDelito]=useState('')
  const [filterRegimen,setFilterRegimen]=useState('') // '' | 'RPA' | 'ADULTO' | 'MIXTO'
  const [regimenesPorCausa,setRegimenesPorCausa]=useState({}) // { causa_id: Set(['ADULTO','RPA']) }
  const [sortCol,setSortCol]=useState('created_at')
  const [sortDir,setSortDir]=useState('desc')
  const [view,setView]=useState('list')
  const [selectedCausa,setSelectedCausa]=useState(null)
  const [activeTab,setActiveTab]=useState('datos')
  const [editField,setEditField]=useState(null)
  const [editValue,setEditValue]=useState('')
  const [audiencias,setAudiencias]=useState([])
  const [aumentos,setAumentos]=useState([])
  const [apelaciones,setApelaciones]=useState([])
  const [cautelares,setCautelares]=useState([])
  const [imputados,setImputados]=useState([])
  const [showAudForm,setShowAudForm]=useState(false)
  const [nuevaAud,setNuevaAud]=useState({fecha:'',hora:'',tipo:'',tribunal:'',sala:'',resultado:'',notas:''})
  const [saving,setSaving]=useState(false)
  const [showNuevaCausa,setShowNuevaCausa]=useState(false)
  const [showStats,setShowStats]=useState(false)
  const [grupoAbierto,setGrupoAbierto]=useState('') // '' | 'vigente' | 'terminada' — controla qué chips de subestado se muestran
  const [nuevaCausa,setNuevaCausa]=useState({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',imputado_rut:'',imputado_fecha_nac:'',imputado_domicilio:'',imputado_nacionalidad:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente'})
  const [rutBuscando,setRutBuscando]=useState(false)
  const [rutEncontrado,setRutEncontrado]=useState(null)

  useEffect(()=>{ loadCausas() },[])

  useEffect(() => {
    if (causaInicial) { openCausa(causaInicial); if (onCausaInicialUsada) onCausaInicialUsada() }
  }, [causaInicial])

  const loadCausas = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('causas').select('*').order('created_at', { ascending:false })
    if (!error) {
      const causasActualizadas = (data||[]).map(c => {
        const subestadosEspeciales = ['apjo','juicio_oral']
        let subestado = c.subestado
        if (c.estado === 'vigente' && !subestadosEspeciales.includes(c.subestado)) {
          const autoSub = calcularSubestado(c.plazo)
          if (autoSub !== 'vencido' && c.subestado === 'vencido') subestado = autoSub
          else if (autoSub) subestado = autoSub
        }
        return { ...c, tribunal: normT(c.tribunal), subestado }
      })
      setCausas(causasActualizadas)
    }
    // ✅ Régimen de todos los imputados, para poder filtrar la lista por RPA/Adulto/Mixta
    const { data: todosImputados } = await supabase.from('imputados').select('causa_id, regimen')
    if (todosImputados) {
      const mapa = {}
      todosImputados.forEach(imp => {
        if (!imp.regimen) return
        if (!mapa[imp.causa_id]) mapa[imp.causa_id] = new Set()
        mapa[imp.causa_id].add(imp.regimen)
      })
      setRegimenesPorCausa(mapa)
    }
    setLoading(false)
  }

  const openCausa=async(c)=>{
    setSelectedCausa(c);setView('detail');setActiveTab('datos')
    const[{data:a},{data:au},{data:imp},{data:apel},{data:caut}]=await Promise.all([
      supabase.from('audiencias').select('*').or(`causa_id.eq.${c.id},ruc.eq.${c.ruc}`).order('fecha',{ascending:false}),
      supabase.from('aumentos_plazo').select('*').eq('causa_id',c.id).order('fecha_audiencia',{ascending:true}),
      supabase.from('imputados').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
      supabase.from('apelaciones_corte').select('*').eq('causa_id',c.id).order('created_at',{ascending:true}),
      supabase.from('cautelares_causa').select('*').eq('causa_id',c.id).order('fecha_inicio',{ascending:true}),
    ])
    setAudiencias(a||[]);setAumentos(au||[]);setImputados(imp||[]);setApelaciones(apel||[]);setCautelares(caut||[])
  }

  // ✅ Función central para marcar acción real — actualiza updated_at y semáforo
  const marcarAccion = useCallback(async (causaId) => {
    const ahora = new Date()
    await supabase.from('causas').update({ updated_at: ahora }).eq('id', causaId)
    setCausas(prev => prev.map(c => c.id === causaId ? { ...c, updated_at: ahora.toISOString() } : c))
    setSelectedCausa(prev => prev ? { ...prev, updated_at: ahora.toISOString() } : prev)
  }, [])

  // ✅ Actualiza los delitos de UN imputado específico y recalcula el agregado
  // en causas.delito (unión sin duplicados de los delitos de todos los imputados),
  // para que la búsqueda, la tabla y el gráfico de estadísticas sigan funcionando.
  const actualizarDelitosImputado = async (impId, nuevoValor) => {
    await supabase.from('imputados').update({ delitos: nuevoValor }).eq('id', impId)
    const nuevosImputados = imputados.map(x => x.id === impId ? { ...x, delitos: nuevoValor } : x)
    setImputados(nuevosImputados)
    const acumulados = []
    nuevosImputados.forEach(imp => {
      (imp.delitos || '').split('|').map(d => d.trim()).filter(Boolean).forEach(d => {
        if (!acumulados.includes(d)) acumulados.push(d)
      })
    })
    const agregado = acumulados.join('|')
    const ahora = new Date()
    await supabase.from('causas').update({ delito: agregado, updated_at: ahora }).eq('id', selectedCausa.id)
    const u = { ...selectedCausa, delito: agregado, updated_at: ahora.toISOString() }
    setSelectedCausa(u)
    setCausas(prev => prev.map(c => c.id === u.id ? u : c))
    const imp = nuevosImputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó delitos de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  // ✅ Centro Penal por imputado — usa la misma columna "lugar_detencion" que ya
  // existe en imputados (la que se usa en la pestaña Imputado cuando está detenido),
  // así no hace falta ninguna migración nueva en Supabase.
  const actualizarCentroPenalImputado = async (impId, valor) => {
    await supabase.from('imputados').update({ lugar_detencion: valor }).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, lugar_detencion: valor } : x))
    const imp = imputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó centro penal de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  // ✅ Genérica — usada por Delegación de Poder y Correo de notificación cuando
  // hay varios imputados y cada uno puede tener datos distintos.
  const actualizarCampoImputado = async (impId, field, valor) => {
    await supabase.from('imputados').update({ [field]: valor }).eq('id', impId)
    setImputados(prev => prev.map(x => x.id === impId ? { ...x, [field]: valor } : x))
    const imp = imputados.find(x => x.id === impId)
    if (registrarActividad) registrarActividad('accion', `Actualizó datos de ${imp?.nombre || 'imputado'} en RUC ${selectedCausa.ruc}`)
  }

  const updateField=async(field,value)=>{
    const camposSinMayusculas = ['estado','subestado','tiene_top']
    if (typeof value === 'string' && !camposSinMayusculas.includes(field)) value = value.toUpperCase()
    // Autocorrección ortográfica en campos de texto
    const camposCorregir = ['delito','imputado','tribunal','fiscal','cautelar','centro_penal','plazo']
    if (camposCorregir.includes(field) && typeof value === 'string') {
      value = corregirOrtografia(value)
    }
    setSaving(true)
    const{error}=await supabase.from('causas').update({[field]:value,updated_at:new Date()}).eq('id',selectedCausa.id)
    if(!error){
      const u={...selectedCausa,[field]:value,updated_at:new Date().toISOString()}
      setSelectedCausa(u);setCausas(prev=>prev.map(c=>c.id===u.id?u:c))
      if (registrarActividad) registrarActividad('accion', `Editó campo "${field}" en RUC ${selectedCausa.ruc}`)
      // Al guardar fecha_hechos → recalcular régimen de cada imputado
      if (field === 'fecha_hechos') {
        const nuevosImputados = await Promise.all(imputados.map(async imp => {
          if (!imp.fecha_nacimiento || imp.regimen) return imp // No sobreescribir si ya tiene régimen
          const regAuto = calcularRegimenAlMomento(imp.fecha_nacimiento, value)
          if (regAuto) {
            await supabase.from('imputados').update({ regimen: regAuto }).eq('id', imp.id)
            return { ...imp, regimen: regAuto }
          }
          return imp
        }))
        setImputados(nuevosImputados)
      }
    }
    setEditField(null);setSaving(false)
  }

  const saveAudiencia=async()=>{
    if(!nuevaAud.fecha)return;setSaving(true)
    const upAud = {}
    Object.entries(nuevaAud).forEach(([k,v]) => { upAud[k] = (typeof v === 'string' && !['fecha','hora'].includes(k)) ? corregirOrtografia(v.toUpperCase()) : v })
    const{data,error}=await supabase.from('audiencias').insert({causa_id:selectedCausa.id,ruc:selectedCausa.ruc,imputado:selectedCausa.imputado?.split('|')[0],...upAud}).select().single()
    if(!error){
      setAudiencias(prev=>[data,...prev].sort((a,b)=>b.fecha.localeCompare(a.fecha)))
      if (registrarActividad) registrarActividad('accion', `Nueva audiencia en RUC ${selectedCausa.ruc}: ${nuevaAud.tipo||'Audiencia'} ${nuevaAud.fecha}`)
      await marcarAccion(selectedCausa.id) // ✅ actualiza semáforo
    }
    setNuevaAud({fecha:'',hora:'',tipo:'',tribunal:selectedCausa?.tribunal||'',sala:'',resultado:'',notas:''});setShowAudForm(false);setSaving(false)
  }

  const buscarRutNuevaCausa = async (rut) => {
    if (!rut || rut.length < 6) return
    setRutBuscando(true)
    const rutNorm = rut.replace(/[.\-\s]/g,'').toUpperCase()
    const { data } = await supabase.from('imputados').select('*').limit(500)
    setRutBuscando(false)
    if (!data) return
    const coincidencias = data.filter(d => d.rut && d.rut.replace(/[.\-\s]/g,'').toUpperCase() === rutNorm)
    if (coincidencias.length === 0) { setRutEncontrado(null); return }
    // Tomar el más completo
    const campos = ['nombre','nacionalidad','domicilio','fecha_nacimiento']
    const masCompleto = coincidencias.reduce((mejor, actual) => {
      const pMejor = campos.filter(c => mejor[c] && mejor[c].trim()).length
      const pActual = campos.filter(c => actual[c] && actual[c].trim()).length
      return pActual > pMejor ? actual : mejor
    })
    setRutEncontrado(masCompleto)
    // Autorrellenar campos
    setNuevaCausa(p => ({
      ...p,
      imputado: masCompleto.nombre || p.imputado,
      imputado_rut: rut,
      imputado_fecha_nac: masCompleto.fecha_nacimiento || p.imputado_fecha_nac,
      imputado_domicilio: masCompleto.domicilio || p.imputado_domicilio,
      imputado_nacionalidad: masCompleto.nacionalidad || p.imputado_nacionalidad,
    }))
  }

  const saveCausa = async () => {
    if (!nuevaCausa.ruc) return
    // Autocorrección ortográfica antes de guardar
    setSaving(true)
    let plazoFinal = nuevaCausa.plazo
    if (nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo) plazoFinal = 'VENCE ' + calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)
    const subestadoAuto = calcularSubestado(plazoFinal)
    const up = (v) => typeof v === 'string' ? corregirOrtografia(v.toUpperCase()) : v
    const causaData = { ruc:up(nuevaCausa.ruc), rit:up(nuevaCausa.rit), tribunal:up(nuevaCausa.tribunal), delito:up(nuevaCausa.delito), imputado:up(nuevaCausa.imputado), fiscal:up(nuevaCausa.fiscal), cautelar:up(nuevaCausa.cautelar), centro_penal:up(nuevaCausa.centro_penal), plazo:up(plazoFinal), estado:nuevaCausa.estado, subestado:subestadoAuto, fecha_hechos: nuevaCausa.fecha_hechos || null }
    const { data, error } = await supabase.from('causas').insert(causaData).select().single()
    if (!error) {
      // Crear imputado automáticamente con los datos del RUT
      if (nuevaCausa.imputado_rut || nuevaCausa.imputado) {
        const regAuto = (nuevaCausa.imputado_fecha_nac && nuevaCausa.fecha_hechos)
          ? calcularRegimenAlMomento(nuevaCausa.imputado_fecha_nac, nuevaCausa.fecha_hechos)
          : null
        await supabase.from('imputados').insert({
          causa_id: data.id,
          nombre: up(nuevaCausa.imputado) || '',
          rut: nuevaCausa.imputado_rut || '',
          fecha_nacimiento: nuevaCausa.imputado_fecha_nac || null,
          domicilio: up(nuevaCausa.imputado_domicilio) || '',
          nacionalidad: up(nuevaCausa.imputado_nacionalidad) || '',
          regimen: regAuto || 'ADULTO',
          delitos: up(nuevaCausa.delito) || '',
        })
      }
      setCausas(prev => [data, ...prev])
      setShowNuevaCausa(false)
      setRutEncontrado(null)
      if (registrarActividad) registrarActividad('accion', `Nueva causa: RUC ${causaData.ruc}`)
      setNuevaCausa({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',imputado_rut:'',imputado_fecha_nac:'',imputado_domicilio:'',imputado_nacionalidad:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',fecha_inicio:'',dias_plazo:'',fecha_hechos:'',estado:'vigente'})
    }
    setSaving(false)
  }

  const handleSort=col=>{if(sortCol===col)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(col);setSortDir('asc')}}
  const tribunales=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
  const filtered=useMemo(()=>{
    let list=causas.filter(c=>{
      const s=search.toLowerCase()
      const match=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v?.toLowerCase().includes(s))
      // ✅ "Terminada" (general, sin subestado elegido) funciona como cola de pendientes:
      // solo muestra las terminadas que TODAVÍA no tienen subestado. Apenas se le pone
      // un subestado a una causa, desaparece de aquí y solo aparece en su subestado específico.
      const estadoMatch=!filterEstado||(filterEstado==='vigente'?c.estado==='vigente':filterEstado==='terminada'?(c.estado==='terminada'&&!c.subestado):filterEstado==='top'?(c.subestado==='juicio_oral'||c.tiene_top===true):c.subestado===filterEstado)
      const delitoMatch=!filterDelito||(c.delito||'').split('|').map(d=>d.trim()).includes(filterDelito)
      // ✅ Régimen: RPA/Adulto = al menos un imputado con ese régimen; Mixta = tiene ambos
      const regs = regimenesPorCausa[c.id]
      const regimenMatch=!filterRegimen||(regs && (filterRegimen==='MIXTO' ? (regs.has('RPA')&&regs.has('ADULTO')) : regs.has(filterRegimen)))
      return match&&(!filterTribunal||c.tribunal===filterTribunal)&&estadoMatch&&delitoMatch&&regimenMatch
    })
    return[...list].sort((a,b)=>{const av=a[sortCol]||'',bv=b[sortCol]||'';return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av)})
  },[causas,search,filterTribunal,filterEstado,filterDelito,filterRegimen,regimenesPorCausa,sortCol,sortDir])

  const hayFiltrosActivos = !!(search||filterTribunal||filterEstado||filterDelito||filterRegimen)
  const limpiarFiltros = () => { setSearch(''); setFilterTribunal(''); setFilterEstado(''); setFilterDelito(''); setFilterRegimen('') }

  const stats=useMemo(()=>({
    total:causas.length, vigente:causas.filter(c=>c.estado==='vigente').length, terminada:causas.filter(c=>c.estado==='terminada').length,
    vencido:causas.filter(c=>c.subestado==='vencido').length, proximo:causas.filter(c=>c.subestado==='proximo').length,
    apjo:causas.filter(c=>c.subestado==='apjo').length, juicioOral:causas.filter(c=>c.subestado==='juicio_oral'||c.tiene_top===true).length,
  }),[causas])

  // ✅ Los gráficos respetan TODOS los filtros activos (búsqueda, tribunal, estado, delito) —
  // se guarda el nombre completo del delito (no truncado) para poder filtrar con precisión al hacer clic.
  const chartDelitos=useMemo(()=>{
    const map={}
    filtered.forEach(c=>{(c.delito||'').split('|').map(d=>d.trim()).filter(Boolean).forEach(d=>{ if(!map[d]) map[d]=0; map[d]++ })})
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([nombreCompleto,value])=>({name:nombreCompleto.substring(0,28),nombreCompleto,value}))
  },[filtered])
  const chartTribunales=useMemo(()=>{
    const map={}
    filtered.forEach(c=>{if(c.tribunal){map[c.tribunal]=(map[c.tribunal]||0)+1}})
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}))
  },[filtered])
  // 📊 Resultados en causas terminadas — para tu % de rendimiento (condena preso/libre,
  // absoluciones, salidas alternativas). Respeta los mismos filtros de arriba.
  const chartResultados=useMemo(()=>{
    const terminadas=filtered.filter(c=>c.estado==='terminada')
    const map={}
    terminadas.forEach(c=>{const s=c.subestado||'sin_subestado';map[s]=(map[s]||0)+1})
    const total=terminadas.length
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([subestado,value])=>({
      subestado,
      label: estadoConfig[subestado]?.label || subestado.toUpperCase(),
      color: estadoConfig[subestado]?.color || '#64748b',
      bg: estadoConfig[subestado]?.bg || '#F8F9FC',
      border: estadoConfig[subestado]?.border || '#e2e8f0',
      value,
      pct: total>0 ? Math.round((value/total)*100) : 0,
    }))
  },[filtered])
  const totalTerminadas = chartResultados.reduce((s,r)=>s+r.value,0)
  const sumaSubestados = (...keys) => chartResultados.filter(r=>keys.includes(r.subestado)).reduce((s,r)=>s+r.value,0)
  const pctDe = (n) => totalTerminadas>0 ? Math.round((n/totalTerminadas)*100) : 0
  const resumenRendimiento = {
    absoluciones: { n: sumaSubestados('absuelto'), pct: pctDe(sumaSubestados('absuelto')) },
    condenas: { n: sumaSubestados('condena_preso','condena_libertad'), pct: pctDe(sumaSubestados('condena_preso','condena_libertad')) },
    salidasAlt: { n: sumaSubestados('scp','salida_ar'), pct: pctDe(sumaSubestados('scp','salida_ar')) },
  }
  const COLORS=['#5B7CFA','#F0A868','#5BAE8C','#E0748C','#8B7FD1','#4FADC2','#D4A94E','#7FA6D6','#C77D5E','#8FA85E']
  const inp={width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}

  if(view==='detail'&&selectedCausa){
    const c=causas.find(x=>x.id===selectedCausa.id)||selectedCausa
    return(
      <div style={{background:'#F8F9FC',minHeight:'100vh',...f}} className="detail-enter">
        <style>{CSS}</style>
        <div style={{maxWidth:1060,margin:'0 auto',padding:'24px 28px'}}>
          <button className="btn-secondary" onClick={()=>setView('list')} style={{marginBottom:20,fontSize:13,border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}}>← Volver</button>
          <div style={{background:'#fff',borderRadius:20,boxShadow:'0 1px 3px rgba(15,23,42,0.06)'}}>
          <div style={{padding:'28px 28px 20px',borderRadius:'20px 20px 0 0'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:'#1E293B',marginBottom:6,letterSpacing:'-0.5px',...f}}>RUC <span style={{color:'#1E293B'}}>{c.ruc}</span></div>
                <div style={{fontSize:13,color:'#94a3b8',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',...f}}>
                  <span>RIT <span style={{color:'#475569',fontWeight:500}}>{c.rit||'—'}</span></span>
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.tribunal}</span>
                  {getCorteApelaciones(c.tribunal) && (
                    <span style={{fontSize:10,fontWeight:600,color:'#94a3b8',...f}}>({getCorteApelaciones(c.tribunal)})</span>
                  )}
                  <span style={{color:'#e2e8f0'}}>|</span>
                  <span style={{color:'#475569',fontWeight:500}}>{c.imputado}</span>
                  <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                  {imputados.length === 1 && imputados.filter(i=>i.regimen).map(i=>(
                    <span key={i.id} style={{
                      fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',
                      background:i.regimen==='RPA'?'#faf5ff':'#eff6ff',
                      color:i.regimen==='RPA'?'#5b21b6':'#1E293B',...f
                    }}>{i.regimen}</span>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saving&&<span style={{fontSize:11,color:'#94a3b8',...f}}>Guardando...</span>}
                {c.esta_detenido&&<span style={{background:'#fef2f2',color:'#dc2626',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',padding:'4px 12px',borderRadius:20,fontSize:10,fontWeight:700,textTransform:'uppercase',...f}}>🔒 Detenido</span>}
                <BadgeEditor
                  estado={c.estado}
                  subestado={c.subestado}
                  onChangeEstado={(e)=>updateField('estado',e)}
                  onChangeSubestado={(s)=>updateField('subestado',s||null)}
                />
              </div>
            </div>
          </div>
          <div style={{background:'#fff',display:'flex',overflowX:'auto',padding:'0 20px'}}>
            {[['datos','Datos'],['imputado','Imputado'],['plazo','Plazo'],['audiencias','Audiencias'],['top','Juicio Oral'],['teoria','⚖️ Teoría del Caso'],...(esTitular?[['honorarios','💰 Honorarios']]:[])].map(([k,l])=>(
              <button key={k} className="tab-btn" onClick={()=>setActiveTab(k)} style={{padding:'13px 16px',fontSize:13,fontWeight:activeTab===k?600:400,color:activeTab===k?'#1E293B':'#94a3b8',borderBottom:`2px solid ${activeTab===k?'#1E293B':'transparent'}`,whiteSpace:'nowrap',marginBottom:0}}>{l}</button>
            ))}
          </div>
          <div style={{background:'#fff',padding:28,borderRadius:'0 0 20px 20px'}}>
            {activeTab==='datos'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {/* 1. Imputado(s) — con el botón de agregar en la esquina derecha, junto al label */}
                <div style={{gridColumn:'1/-1',marginBottom:2}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:10}}>
                    <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,...f}}>Imputado(s)</div>
                    <button className="btn-secondary" style={{fontSize:11,padding:'5px 12px',flexShrink:0}} onClick={()=>{setEditField('nuevo_imputado');setEditValue('')}}>+ Agregar imputado</button>
                  </div>
                  {editField==='campo_imputado'?(
                    <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                      <input style={{width:'100%',padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')updateField('imputado',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12,flexShrink:0,borderRadius:14}} onClick={()=>updateField('imputado',editValue)}>✓</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12,flexShrink:0,border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}} onClick={()=>setEditField(null)}>✗</button>
                    </div>
                  ):(
                    <div className="fld" onClick={()=>{setEditField('campo_imputado');setEditValue(c.imputado||'')}}
                      style={{padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:c.imputado?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.imputado||'Clic para agregar...'}</span>
                      <span style={{fontSize:11,color:'#94a3b8',flexShrink:0,marginLeft:8}}>✏</span>
                    </div>
                  )}
                  {editField==='nuevo_imputado' && (
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <input style={{flex:1,padding:'9px 12px',border:'1.5px solid #2563eb',borderRadius:8,fontSize:13,...f}} placeholder="Nombre del nuevo imputado" value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={async e=>{if(e.key==='Enter'){updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                      <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={async()=>{updateField('imputado',(c.imputado||'')+'|'+editValue);const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:editValue}).select().single();if(data)setImputados(prev=>[...prev,data]);setEditField(null)}}>+ Agregar</button>
                      <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✕</button>
                    </div>
                  )}
                </div>

                {/* 🔀 Detecta imputados antiguos guardados con 2+ nombres juntos en un
                    solo campo (ej. "JUAN PEREZ Y PEDRO GOMEZ") y permite separarlos en
                    registros individuales, igual que si se hubieran agregado uno por uno. */}
                {(() => {
                  const nombreCombinado = imputados.length === 1 ? imputados[0].nombre : (imputados.length === 0 ? c.imputado : null)
                  const partes = nombreCombinado ? nombreCombinado.split(/\s+Y\s+|\s*\/\s*|\s+-\s+/i).map(s=>s.trim()).filter(Boolean) : []
                  if (partes.length < 2) return null
                  return (
                    <div style={{gridColumn:'1/-1',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'12px 14px',marginTop:-4,marginBottom:4}}>
                      <div style={{fontSize:12,color:'#1e40af',fontWeight:600,marginBottom:8,...f}}>
                        🔀 Esto parece ser {partes.length} imputados juntos en un solo nombre: {partes.map((p,i)=><span key={i}>{i>0&&' · '}<strong>{p}</strong></span>)}
                      </div>
                      <button className="btn-secondary" style={{fontSize:12}} onClick={async()=>{
                        if (!window.confirm(`¿Separar en ${partes.length} imputados individuales?\n\n${partes.join('\n')}`)) return
                        let actualizados = []
                        if (imputados.length === 1) {
                          await supabase.from('imputados').update({nombre:partes[0]}).eq('id',imputados[0].id)
                          actualizados = [{...imputados[0],nombre:partes[0]}]
                          for (const nombre of partes.slice(1)) {
                            const {data} = await supabase.from('imputados').insert({causa_id:c.id,nombre}).select().single()
                            if (data) actualizados.push(data)
                          }
                        } else {
                          for (const nombre of partes) {
                            const {data} = await supabase.from('imputados').insert({causa_id:c.id,nombre}).select().single()
                            if (data) actualizados.push(data)
                          }
                        }
                        setImputados(actualizados)
                        await updateField('imputado', partes.join('|'))
                        await marcarAccion(c.id)
                        if (registrarActividad) registrarActividad('accion', `Separó ${partes.length} imputados en RUC ${c.ruc}`)
                      }}>🔀 Separar en {partes.length} imputados individuales</button>
                    </div>
                  )
                })()}

                {/* 2. Corte de Apelaciones — se calcula sola según el tribunal. Va justo
                    debajo de Imputado y antes de Tribunal, como pidió Joaquín. */}
                <div style={{gridColumn:'1/-1',marginBottom:2}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:20,fontSize:12,color: getCorteApelaciones(c.tribunal) ? '#1E293B' : '#94a3b8',background:'#fff',fontWeight:600,...f}}>
                      <span>⚖</span>
                      <span>{getCorteApelaciones(c.tribunal) || 'Selecciona un tribunal'}</span>
                    </div>
                    <button onClick={async()=>{
                      const{data,error}=await supabase.from('apelaciones_corte').insert({causa_id:c.id}).select().single()
                      if(!error&&data){setApelaciones(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó una apelación en RUC ${c.ruc}`)}
                    }} style={{fontSize:11,color:'#7c3aed',background:'#faf5ff',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',borderRadius:14,padding:'7px 14px',cursor:'pointer',fontWeight:600,whiteSpace:'nowrap',...f}}>
                      + Agregar apelación
                    </button>
                  </div>
                  {apelaciones.length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
                      {apelaciones.map((apel,i)=>(
                        <div key={apel.id} style={{background:'#faf5ff',border:'1.5px solid #ddd6fe',borderRadius:10,padding:14}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                            <div style={{fontSize:11,fontWeight:700,color:'#5b21b6',...f}}>⚖ Apelación {i+1}</div>
                            <button onClick={async()=>{
                              if(!window.confirm('¿Eliminar esta apelación?'))return
                              await supabase.from('apelaciones_corte').delete().eq('id',apel.id)
                              setApelaciones(prev=>prev.filter(x=>x.id!==apel.id))
                            }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:12,color:'#dc2626',...f}}>✕ Eliminar</button>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                            <Field label="Rol Corte" value={apel.rol_corte} editable fieldKey={`rol_corte_${apel.id}`} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await supabase.from('apelaciones_corte').update({rol_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,rol_corte:editValue}:x));setEditField(null)}}/>
                            <Field label="Sala" value={apel.sala_corte} editable fieldKey={`sala_corte_${apel.id}`} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await supabase.from('apelaciones_corte').update({sala_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,sala_corte:editValue}:x));setEditField(null)}}/>
                            <div style={{gridColumn:'1/-1'}}>
                              <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de audiencia en la Corte</div>
                              {editField===`fecha_audiencia_corte_${apel.id}`?(
                                <div style={{display:'flex',gap:6}}>
                                  <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                                    value={editValue} onChange={e=>setEditValue(e.target.value)} autoFocus/>
                                  <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={async()=>{await supabase.from('apelaciones_corte').update({fecha_audiencia_corte:editValue}).eq('id',apel.id);setApelaciones(prev=>prev.map(x=>x.id===apel.id?{...x,fecha_audiencia_corte:editValue}:x));setEditField(null)}}>✓</button>
                                  <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                                </div>
                              ):(
                                <div className="fld" onClick={()=>{setEditField(`fecha_audiencia_corte_${apel.id}`);setEditValue(apel.fecha_audiencia_corte||'')}}
                                  style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:apel.fecha_audiencia_corte?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                                  <span>{apel.fecha_audiencia_corte || 'Clic para agregar...'}</span>
                                  <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Datos de la causa: Tribunal, RIT, Fiscal y las fechas — agrupados en un
                     solo panel (en vez de casillas sueltas), para que se lea de un vistazo y
                     quede fijo arriba, sin importar cuánto crezcan las tarjetas de imputado. ── */}
                <div style={{gridColumn:'1/-1',border:'1px solid #e2e8f0',borderRadius:16,padding:'18px 20px',background:'#F8F9FC'}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.3,fontWeight:700,marginBottom:14,...f}}>Datos de la causa</div>

                  <Field label="Tribunal" value={c.tribunal} editable full fieldKey="tribunal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField('tribunal',editValue)}/>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:2}}>
                    {[{key:'rit',label:'RIT JG',editable:true},{key:'fiscal',label:'Fiscal a cargo',editable:true}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable={field.editable} full={field.full} fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>

                  <div style={{display:'flex',gap:10,flexWrap:'wrap',maxWidth:640,marginTop:16}}>
                    {/* Vencimiento del plazo */}
                    <div style={{flex:'1 1 190px',minWidth:170}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Vencimiento del plazo</div>
                      {editField==='Plazo / Vencimiento'?(
                        <div style={{display:'flex',gap:4}}>
                          <input style={{width:'100%',padding:'7px 9px',border:'none',borderRadius:8,fontSize:11,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')updateField('plazo',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                          <button className="btn-primary" style={{padding:'5px 9px',fontSize:10,borderRadius:8}} onClick={()=>updateField('plazo',editValue)}>✓</button>
                        </div>
                      ):(
                        <div className="fld" onClick={()=>{setEditField('Plazo / Vencimiento');setEditValue(c.plazo||'')}}
                          style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:600,color:c.plazo?'#1E293B':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.plazo||'Clic para agregar...'}</span>
                        </div>
                      )}
                    </div>
                    {/* Fecha ACD (Control Detención) — se toma de la 1ª audiencia registrada en Plazo */}
                    <div style={{flex:'1 1 150px',minWidth:140}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Fecha ACD</div>
                      {(() => {
                        const activosPlazo = (aumentos||[]).filter(a=>!a.eliminado).sort((x,y)=>x.fecha_audiencia.localeCompare(y.fecha_audiencia))
                        const fechaAcd = activosPlazo[0]?.fecha_audiencia
                        return (
                          <div onClick={()=>setActiveTab('plazo')}
                            style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:600,color:fechaAcd?'#1e40af':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}
                            title="Se toma automáticamente de la primera audiencia registrada en la pestaña Plazo">
                            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fechaAcd || 'Sin audiencias'}</span>
                            <span style={{fontSize:9,color:'#93c5fd'}}>↗</span>
                          </div>
                        )
                      })()}
                    </div>
                    {/* Fecha de los hechos */}
                    <div style={{flex:'1 1 150px',minWidth:140}}>
                      <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>Fecha de los hechos</div>
                      {editField==='fecha_hechos'?(
                        <div style={{display:'flex',gap:4}}>
                          <input type="date" style={{width:'100%',padding:'7px 9px',border:'none',borderRadius:8,fontSize:11,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}
                            value={editValue} onChange={e=>setEditValue(e.target.value)}
                            onKeyDown={e=>{if(e.key==='Enter')updateField('fecha_hechos',editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                          <button className="btn-primary" style={{padding:'5px 9px',fontSize:10,borderRadius:8}} onClick={()=>updateField('fecha_hechos',editValue)}>✓</button>
                        </div>
                      ):(
                        <div className="fld" onClick={()=>{setEditField('fecha_hechos');setEditValue(c.fecha_hechos||'')}}
                          style={{padding:'7px 9px',borderRadius:8,fontSize:11,fontWeight:700,color:c.fecha_hechos?'#991b1b':'#94a3b8',minHeight:30,display:'flex',alignItems:'center',cursor:'pointer',background:c.fecha_hechos?'#fef2f2':'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.fecha_hechos || 'Clic para agregar...'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Todo lo que puede variar por imputado: Centro Penal, Cautelar Personal,
                     Delito(s), Delegación de Poder y Correo de notificación. Con 1 imputado se
                     ve igual que siempre (campos sueltos); con 2+, cada uno tiene su propia
                     tarjeta colapsable con toda su información agrupada, numerada. ── */}
                {imputados.length <= 1 ? (
                  <>
                    {imputados.length === 0 ? (
                      <Field label="Centro Penal" value={c.centro_penal} editable fieldKey="centro_penal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField('centro_penal',editValue)}/>
                    ) : (
                      <Field label="Centro Penal" value={imputados[0].lugar_detencion} editable fieldKey="centro_penal" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={async()=>{await actualizarCentroPenalImputado(imputados[0].id, editValue);setEditField(null)}}/>
                    )}

                    <CautelaresPanel
                      causaId={c.id}
                      ruc={c.ruc}
                      cautelares={cautelares}
                      esRPA={imputados.some(i=>i.regimen==='RPA')}
                      registrarActividad={registrarActividad}
                      onGuardar={async(form)=>{
                        const{data,error}=await supabase.from('cautelares_causa').insert({causa_id:c.id,imputado_id:imputados[0]?.id||null,tipo:form.tipo,fecha_inicio:form.fecha_inicio,fecha_termino:form.fecha_termino||null,frecuencia:form.tipo==='Firma'?form.frecuencia:null}).select().single()
                        if(!error&&data){setCautelares(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó cautelar "${form.tipo}" en RUC ${c.ruc}`)}
                      }}
                      onActualizar={async(id,campos)=>{
                        await supabase.from('cautelares_causa').update(campos).eq('id',id)
                        setCautelares(prev=>prev.map(x=>x.id===id?{...x,...campos}:x))
                      }}
                    />

                    <div style={{gridColumn:'1/-1',marginBottom:2}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Delito(s)</div>
                      {imputados.length === 0 ? (
                        <div style={{display:'flex'}}>
                          <DelitoCard value={c.delito} onChange={(v)=>updateField('delito', v)} options={DELITOS_CATALOGO} />
                        </div>
                      ) : imputados[0].delitos ? (
                        <div style={{display:'flex'}}>
                          <DelitoCard value={imputados[0].delitos} onChange={(v)=>actualizarDelitosImputado(imputados[0].id, v)} options={DELITOS_CATALOGO} />
                        </div>
                      ) : c.delito ? (
                        <div>
                          <div style={{fontSize:12,color:'#92400e',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'10px 12px',marginBottom:8,...f}}>
                            📋 Ya tenías guardado: <strong>{c.delito.replace(/\|/g,', ')}</strong> — aún no vinculado al imputado.
                          </div>
                          <button className="btn-secondary" style={{fontSize:12}} onClick={()=>actualizarDelitosImputado(imputados[0].id, c.delito)}>✓ Vincular a {imputados[0].nombre||'este imputado'}</button>
                        </div>
                      ) : (
                        <div style={{display:'flex'}}>
                          <DelitoCard value="" onChange={(v)=>actualizarDelitosImputado(imputados[0].id, v)} options={DELITOS_CATALOGO} />
                        </div>
                      )}
                    </div>

                    <div style={{gridColumn:'1/-1',marginTop:8}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:8,fontWeight:600,...f}}>Delegación de Poder</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <Field label="Abogado delegado" value={imputados.length===0?c.delegacion_abogado:imputados[0].delegacion_abogado} editable fieldKey="delegacion_abogado" editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>{imputados.length===0?updateField('delegacion_abogado',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_abogado',editValue);setEditField(null)}}/>
                        <div>
                          <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Fecha de delegación</div>
                          {editField==='delegacion_fecha'?(
                            <div style={{display:'flex',gap:6}}>
                              <input type="date" style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:'#1E293B',background:'#fff',...f}}
                                value={editValue} onChange={e=>setEditValue(e.target.value)}
                                onKeyDown={e=>{if(e.key==='Enter'){imputados.length===0?updateField('delegacion_fecha',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_fecha',editValue);setEditField(null)}if(e.key==='Escape')setEditField(null)}} autoFocus/>
                              <button className="btn-primary" style={{padding:'8px 14px',fontSize:12}} onClick={()=>{imputados.length===0?updateField('delegacion_fecha',editValue):actualizarCampoImputado(imputados[0].id,'delegacion_fecha',editValue);setEditField(null)}}>✓</button>
                              <button className="btn-secondary" style={{padding:'8px 12px',fontSize:12}} onClick={()=>setEditField(null)}>✗</button>
                            </div>
                          ):(
                            <div className="fld" onClick={()=>{setEditField('delegacion_fecha');setEditValue((imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha)||'')}}
                              style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:(imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha)?'#1E293B':'#94a3b8',minHeight:38,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff',...f}}>
                              <span>{(imputados.length===0?c.delegacion_fecha:imputados[0].delegacion_fecha) || 'Clic para agregar...'}</span>
                              <span style={{fontSize:11,color:'#94a3b8'}}>✏</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{gridColumn:'1/-1',marginTop:4}}>
                      <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>Correo de notificación</div>
                      <select
                        style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,color:(imputados.length===0?c.correo_notificacion:imputados[0].correo_notificacion)?'#1E293B':'#94a3b8',background:'#fff',cursor:'pointer',...f}}
                        value={(imputados.length===0?c.correo_notificacion:imputados[0].correo_notificacion)||''}
                        onChange={e=>imputados.length===0?updateField('correo_notificacion', e.target.value):actualizarCampoImputado(imputados[0].id,'correo_notificacion', e.target.value)}>
                        <option value="">Seleccionar correo...</option>
                        <option value="JOBREGONABOGADO@GMAIL.COM">JOBREGONABOGADO@GMAIL.COM</option>
                        <option value="NOTIFICACION.DEFENSAPENAL@GMAIL.COM">NOTIFICACION.DEFENSAPENAL@GMAIL.COM</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:12}}>
                    {imputados.map((imp,idx)=>(
                      <ImputadoDatosCard
                        key={imp.id}
                        imp={imp}
                        numero={idx+1}
                        causaId={c.id}
                        ruc={c.ruc}
                        cautelares={cautelares.filter(ct=>ct.imputado_id===imp.id)}
                        registrarActividad={registrarActividad}
                        onUpdateCampo={(field,value)=>actualizarCampoImputado(imp.id, field, value)}
                        onDelitoChange={(v)=>actualizarDelitosImputado(imp.id, v)}
                        onGuardarCautelar={async(form)=>{
                          const{data,error}=await supabase.from('cautelares_causa').insert({causa_id:c.id,imputado_id:imp.id,tipo:form.tipo,fecha_inicio:form.fecha_inicio,fecha_termino:form.fecha_termino||null,frecuencia:form.tipo==='Firma'?form.frecuencia:null}).select().single()
                          if(!error&&data){setCautelares(prev=>[...prev,data]);if(registrarActividad)registrarActividad('accion',`Agregó cautelar "${form.tipo}" a ${imp.nombre||'imputado'} en RUC ${c.ruc}`)}
                        }}
                        onActualizarCautelar={async(id,campos)=>{
                          await supabase.from('cautelares_causa').update(campos).eq('id',id)
                          setCautelares(prev=>prev.map(x=>x.id===id?{...x,...campos}:x))
                        }}
                      />
                    ))}
                  </div>
                )}

              </div>
            )}

            {activeTab==='imputado'&&(
              <div>
                {imputados.map((imp,idx)=>(
                  <ImputadoCard key={imp.id} imp={imp} idx={idx} onUpdate={async(field,value)=>{
                    // Los delitos van sincronizados con el agregado de la causa
                    if (field === 'delitos') { await actualizarDelitosImputado(imp.id, value); return }
                    // Campos que NO deben convertirse a mayúsculas
                    const camposSinUpper = ['fecha_nacimiento','fecha_detencion','rut']
                    if (typeof value === 'string' && !camposSinUpper.includes(field)) value = value.toUpperCase()
                    // Calcular régimen automático al guardar fecha_nacimiento
                    let updateData = {[field]:value}
                    if (field === 'fecha_nacimiento' && value) {
                      const fechaHechos = c.fecha_hechos || selectedCausa?.fecha_hechos
                      if (fechaHechos) {
                        const regAuto = calcularRegimenAlMomento(value, fechaHechos)
                        if (regAuto) updateData.regimen = regAuto
                      }
                    }
                    await supabase.from('imputados').update(updateData).eq('id',imp.id)
                    setImputados(prev=>prev.map(x=>x.id===imp.id?{...x,...updateData}:x))
                    // Sincronizar datos personales en TODAS las causas con el mismo RUT
                    const camposPersonales = ['nombre','nacionalidad','domicilio','fecha_nacimiento','otros_antecedentes']
                    if (camposPersonales.includes(field) && imp.rut) {
                      const rn = imp.rut.replace(/[.\s]/g,'').toUpperCase()
                      const { data: todos } = await supabase.from('imputados').select('id, rut').limit(500)
                      if (todos) {
                        const mismoRut = todos.filter(d => d.rut && d.rut.replace(/[.\s]/g,'').toUpperCase() === rn && d.id !== imp.id)
                        await Promise.all(mismoRut.map(d => supabase.from('imputados').update({ [field]: value }).eq('id', d.id)))
                      }
                    }
                    await marcarAccion(c.id)
                  }} onDelete={async()=>{
                    if(!window.confirm('¿Eliminar este imputado?'))return
                    await supabase.from('imputados').delete().eq('id',imp.id)
                    const restantes = imputados.filter(x=>x.id!==imp.id)
                    setImputados(restantes)
                    // Recalcular agregado de delitos sin este imputado
                    const acumulados = []
                    restantes.forEach(r => { (r.delitos||'').split('|').map(d=>d.trim()).filter(Boolean).forEach(d=>{ if(!acumulados.includes(d)) acumulados.push(d) }) })
                    const agregado = acumulados.join('|')
                    await supabase.from('causas').update({ delito: agregado }).eq('id', c.id)
                    const u = { ...selectedCausa, delito: agregado }
                    setSelectedCausa(u)
                    setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                    await marcarAccion(c.id) // ✅ actualiza semáforo
                  }}/>
                ))}
                <button className="btn-secondary" style={{marginTop:16}} onClick={async()=>{
                  const{data}=await supabase.from('imputados').insert({causa_id:c.id,nombre:'Nuevo imputado'}).select().single()
                  if(data){ setImputados(prev=>[...prev,data]); await marcarAccion(c.id) }
                }}>+ Agregar imputado</button>
              </div>
            )}
            {activeTab==='plazo'&&(
              <PlazoCalculador causaId={c.id} plazoActual={c.plazo} aumentos={aumentos}
                onGuardarAudiencia={async(form)=>{
                const diasNum = parseInt(form.dias_plazo) || 0
                const{data,error}=await supabase.from('aumentos_plazo').insert({causa_id:c.id,fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null}).select().single()
                if(!error){
                  const nuevosAumentos=[...aumentos,data].sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                  setAumentos(nuevosAumentos)
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const diasTotal=activos.reduce((s,a)=>s+(parseInt(a.dias_plazo)||0),0)
                  const primera=activos[0]
                  const nuevoVenc= primera ? 'VENCE '+calcularVencimiento(primera.fecha_audiencia,diasTotal) : ''
                  const nuevoSub=calcularSubestado(nuevoVenc)
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Registró audiencia de plazo (+${diasNum}d, ${form.tipo_audiencia}) en RUC ${c.ruc}`)
                }
              }}
                onEditarAudiencia={async(id, form, motivo)=>{
                const diasNum = parseInt(form.dias_plazo) || 0
                const anterior = aumentos.find(a=>a.id===id)
                const lineaHistorial = `[${new Date().toLocaleString('es-CL')}] Corregido por ${session?.user?.email||'usuario'}. Motivo: ${motivo}. Antes era: ${anterior?.tipo_audiencia||'—'}, ${anterior?.fecha_audiencia||'—'}, ${anterior?.dias_plazo||0} días.`
                const nuevoHistorial = anterior?.historial ? anterior.historial + '\n' + lineaHistorial : lineaHistorial
                const{error}=await supabase.from('aumentos_plazo').update({fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null,historial:nuevoHistorial}).eq('id',id)
                if(!error){
                  const nuevosAumentos=aumentos.map(a=>a.id===id?{...a,fecha_audiencia:form.fecha_audiencia,tipo_audiencia:form.tipo_audiencia,dias_plazo:diasNum,dias_aumento:diasNum,observacion:form.observacion||'',fecha_proxima_audiencia:form.fecha_proxima_audiencia||null,historial:nuevoHistorial}:a).sort((a,b)=>a.fecha_audiencia.localeCompare(b.fecha_audiencia))
                  setAumentos(nuevosAumentos)
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const diasTotal=activos.reduce((s,a)=>s+(parseInt(a.dias_plazo)||0),0)
                  const primera=activos[0]
                  const nuevoVenc = primera ? 'VENCE '+calcularVencimiento(primera.fecha_audiencia,diasTotal) : ''
                  const nuevoSub=calcularSubestado(nuevoVenc)
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Corrigió una audiencia de plazo en RUC ${c.ruc}: ${motivo}`)
                }
              }}
                onEliminarAudiencia={async(id, motivo)=>{
                // ✅ Eliminación lógica: no se borra de la base, se marca "eliminado" con el
                // motivo, y queda visible tachada en el historial para tener trazabilidad.
                const{error}=await supabase.from('aumentos_plazo').update({eliminado:true,motivo_eliminacion:motivo,eliminado_por:session?.user?.email||'usuario',eliminado_en:new Date()}).eq('id',id)
                if(!error){
                  const nuevosAumentos=aumentos.map(a=>a.id===id?{...a,eliminado:true,motivo_eliminacion:motivo,eliminado_por:session?.user?.email||'usuario',eliminado_en:new Date().toISOString()}:a)
                  setAumentos(nuevosAumentos)
                  const activos=nuevosAumentos.filter(a=>!a.eliminado)
                  const diasTotal=activos.reduce((s,a)=>s+(parseInt(a.dias_plazo)||0),0)
                  const primera=activos[0]
                  const nuevoVenc = primera ? 'VENCE '+calcularVencimiento(primera.fecha_audiencia,diasTotal) : ''
                  const nuevoSub = primera ? calcularSubestado(nuevoVenc) : null
                  await supabase.from('causas').update({plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date()}).eq('id',c.id)
                  const u={...selectedCausa,plazo:nuevoVenc,subestado:nuevoSub,updated_at:new Date().toISOString()}
                  setSelectedCausa(u);setCausas(prev=>prev.map(x=>x.id===u.id?u:x))
                  if (registrarActividad) registrarActividad('accion', `Eliminó una audiencia de plazo en RUC ${c.ruc}: ${motivo}`)
                }
              }}/>
            )}
            {activeTab==='audiencias'&&(
              <div>
                {audiencias.map(a=>(
                  <AudienciaCard key={a.id} a={a} onUpdate={async(updated,motivo)=>{
                    const historial = a.notas ? a.notas + `\n[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}` : `[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}`
                    const{error}=await supabase.from('audiencias').update({...updated,notas:historial}).eq('id',a.id)
                    if(!error){
                      setAudiencias(prev=>prev.map(x=>x.id===a.id?{...x,...updated,notas:historial}:x))
                      await marcarAccion(c.id) // ✅ actualiza semáforo
                    }
                  }}/>
                ))}
                {audiencias.length===0&&<p style={{color:'#94a3b8',fontSize:13,marginBottom:14,...f}}>Sin audiencias registradas.</p>}
                {showAudForm&&(
                  <div style={{background:'#F8F9FC',border:'1.5px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',ph:'Formalización, APJO, JO...'},{key:'tribunal',label:'Tribunal',ph:'Ej: 4 JG STGO'},{key:'sala',label:'Sala',ph:'Ej: 903'},{key:'resultado',label:'Resultado',ph:'Resultado'},{key:'notas',label:'Observaciones',ph:'Notas'}].map(field=>(
                        <div key={field.key}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:600,...f}}>{field.label}</div><input type={field.type||'text'} style={inp} placeholder={field.ph} value={nuevaAud[field.key]} onChange={e=>setNuevaAud(p=>({...p,[field.key]:e.target.value}))}/></div>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:8}}><button className="btn-primary" onClick={saveAudiencia} disabled={saving}>{saving?'Guardando...':'Guardar'}</button><button className="btn-secondary" onClick={()=>setShowAudForm(false)}>Cancelar</button></div>
                  </div>
                )}
                <button className="btn-secondary" onClick={()=>{setShowAudForm(true);setNuevaAud(p=>({...p,tribunal:selectedCausa?.tribunal||''}))}}>+ Nueva audiencia</button>
              </div>
            )}
            {activeTab==='top'&&(
              <div>
                <p style={{fontSize:13,color:'#94a3b8',marginBottom:20,lineHeight:1.7,...f}}>Cuando la causa pasa a Juicio Oral se asigna un nuevo RIT y Tribunal bajo el mismo RUC <span style={{fontFamily:'monospace',color:'#475569'}}>{c.ruc}</span>.</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:c.tiene_top?'#faf5ff':'#F8F9FC',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:12,padding:'16px 20px',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:c.tiene_top?'#7c3aed':'#64748b',...f}}>{c.tiene_top?'⚖️ En Juicio Oral':'⚖️ Sin Juicio Oral asignado'}</div>
                    {c.tiene_top&&<div style={{fontSize:12,color:'#a78bfa',marginTop:3,...f}}>{c.tribunal_top||'—'} · RIT {c.rit_top||'—'}</div>}
                  </div>
                  <button onClick={()=>updateField('tiene_top',!c.tiene_top)} style={{background:c.tiene_top?'#faf5ff':'#fff',color:c.tiene_top?'#7c3aed':'#64748b',border:`1.5px solid ${c.tiene_top?'#ddd6fe':'#e2e8f0'}`,borderRadius:8,padding:'7px 18px',fontSize:12,cursor:'pointer',fontWeight:600,...f}}>{c.tiene_top?'Desactivar':'Activar JO'}</button>
                </div>
                {c.tiene_top&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {[{key:'tribunal_top',label:'Tribunal TOP'},{key:'rit_top',label:'RIT Juicio Oral'}].map(field=>(
                      <Field key={field.key} label={field.label} value={c[field.key]} editable fieldKey={field.key} editField={editField} setEditField={setEditField} editValue={editValue} setEditValue={setEditValue} onSave={()=>updateField(field.key,editValue)}/>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab==='teoria'&&(
              <TeoriaDelCaso
                causaId={c.id} ruc={c.ruc} session={session} registrarActividad={registrarActividad}
                carpetaRef={c.carpeta_ref} onUpdateCarpetaRef={(v)=>updateField('carpeta_ref',v)}
                onAccion={() => marcarAccion(c.id)} // ✅ actualiza semáforo
              />
            )}
            {esTitular && activeTab==='honorarios'&&(
              <HonorariosTab causaId={c.id} ruc={c.ruc} email={session?.user?.email||''} registrarActividad={registrarActividad} onAccion={()=>marcarAccion(c.id)}/>
            )}
          </div>
          </div>
        </div>
      </div>
    )
  }

  const SortIcon=({col})=>sortCol!==col?<span style={{color:'#e2e8f0',marginLeft:5,fontSize:10}}>⇅</span>:sortDir==='asc'?<span style={{color:'#2563eb',marginLeft:5}}>↑</span>:<span style={{color:'#2563eb',marginLeft:5}}>↓</span>

  return(
    <div style={{background:'#F8F9FC',minHeight:'100vh',...f}}>
      <style>{CSS}</style>
      <div style={{maxWidth:1380,margin:'0 auto',padding:'28px'}}>
        <div style={{marginBottom:24}}/>

        {/* 3 tarjetas grandes — sin borde duro, solo sombra suave; activa = fondo negro sólido (como Apple) */}
        <div style={{display:'flex',gap:16,marginBottom:16}}>
          {[{key:'',label:'Total',num:stats.total},{key:'vigente',label:'Vigentes',num:stats.vigente},{key:'terminada',label:'Terminadas',num:stats.terminada}].map(st=>{
            const activo = st.key===''? grupoAbierto==='' : grupoAbierto===st.key
            const enfasis = activo && st.key!==''
            return(<div key={st.key} className="stat-card" onClick={()=>{
              if(st.key===''){setFilterEstado('');setGrupoAbierto('')}
              else if(grupoAbierto===st.key){setFilterEstado('');setGrupoAbierto('')}
              else{setFilterEstado(st.key);setGrupoAbierto(st.key)}
            }} style={{flex:1,textAlign:'center',background:enfasis?'#1E293B':'#fff',border:'none',borderRadius:20,padding:'28px 24px',boxShadow:enfasis?'0 8px 24px rgba(15,23,42,0.16)':'0 1px 3px rgba(15,23,42,0.06)',transition:'all 0.2s'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:0.5,color:enfasis?'rgba(255,255,255,0.55)':'#94a3b8',marginBottom:10,...f}}>{st.label}</div>
              <div style={{fontSize:38,fontWeight:800,color:enfasis?'#fff':'#1E293B',lineHeight:1,letterSpacing:'-1.5px',...f}}>{st.num}</div>
            </div>)
          })}
        </div>

        {/* Chips de subestado — mismo criterio: sin borde duro, solo fondo suave */}
        {grupoAbierto==='vigente' && (
          <div className="chip-group" style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap',marginBottom:24,marginTop:4}}>
            {[
              {key:'vencido',label:'⚠ Plazo vencido',num:stats.vencido,activeColor:'#dc2626',activeBg:'#fef2f2'},
              {key:'proximo',label:'⏱ Por vencer',num:stats.proximo,activeColor:'#d97706',activeBg:'#fffbeb'},
              {key:'apjo',label:'⚖ APJO',num:stats.apjo,activeColor:'#334155',activeBg:'#F1F5F9'},
              {key:'top',label:'🏛 Juicio Oral',num:stats.juicioOral,activeColor:'#334155',activeBg:'#F1F5F9'},
            ].filter(ch=>ch.num>0).map(ch=>{
              const active=filterEstado===ch.key
              return(<button key={ch.key} className="chip-btn" onClick={()=>setFilterEstado(filterEstado===ch.key?'vigente':ch.key)}
                style={{fontSize:13,fontWeight:600,padding:'9px 16px',borderRadius:100,cursor:'pointer',border:'none',
                  color:active?ch.activeColor:'#48484A', background:active?ch.activeBg:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                {ch.label} · {ch.num}
              </button>)
            })}
          </div>
        )}
        {grupoAbierto==='terminada' && (
          <div className="chip-group" style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap',marginBottom:24,marginTop:4}}>
            {SUBESTADOS_TERMINADA.map(sub=>{
              const num = causas.filter(c=>c.estado==='terminada'&&c.subestado===sub).length
              if (num===0) return null
              const cfg = estadoConfig[sub]
              const active=filterEstado===sub
              return(<button key={sub} className="chip-btn" onClick={()=>setFilterEstado(filterEstado===sub?'terminada':sub)}
                style={{fontSize:13,fontWeight:600,padding:'9px 16px',borderRadius:100,cursor:'pointer',border:'none',
                  color:active?cfg.color:'#48484A', background:active?cfg.bg:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}}>
                {cfg.label} · {num}
              </button>)
            })}
          </div>
        )}

        {showStats&&(
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:28,marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:8}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:'#1E293B',...f}}>Estadísticas del portfolio</div>
                <div style={{fontSize:12,color:'#94a3b8',marginTop:4,...f}}>
                  {hayFiltrosActivos ? <>Mostrando <strong style={{color:'#1E293B'}}>{filtered.length}</strong> causa{filtered.length!==1?'s':''} con los filtros activos</> : <>Mostrando las {filtered.length} causas del portfolio (sin filtros)</>}
                </div>
              </div>
              {hayFiltrosActivos && <button className="btn-secondary" style={{fontSize:12}} onClick={limpiarFiltros}>✕ Limpiar filtros</button>}
            </div>
            <div style={{fontSize:11,color:'#93c5fd',marginBottom:20,...f}}>💡 Haz clic en un delito o tribunal del gráfico para filtrar la lista por ese valor.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>
              <div className="hide-mobile">
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Top Delitos</div>
                {chartDelitos.length===0 ? (
                  <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8',fontSize:13,...f}}>Sin datos para estos filtros.</div>
                ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartDelitos} layout="vertical" margin={{left:8,right:24,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={140} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'none',boxShadow:'0 4px 16px rgba(15,23,42,0.10)',borderRadius:10,fontSize:12}} formatter={(v,n,entry)=>[v+' causas',entry.payload.nombreCompleto]}/>
                    <Bar dataKey="value" radius={[0,6,6,0]} cursor="pointer" onClick={(data)=>setFilterDelito(prev=>prev===data.nombreCompleto?'':data.nombreCompleto)}>
                      {chartDelitos.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} stroke={filterDelito===d.nombreCompleto?'#1E293B':'none'} strokeWidth={filterDelito===d.nombreCompleto?2:0}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:16,fontWeight:700,...f}}>Causas por Tribunal</div>
                {chartTribunales.length===0 ? (
                  <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8',fontSize:13,...f}}>Sin datos para estos filtros.</div>
                ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartTribunales} layout="vertical" margin={{left:8,right:24,top:4,bottom:4}}>
                    <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} width={110} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'none',boxShadow:'0 4px 16px rgba(15,23,42,0.10)',borderRadius:10,fontSize:12}}/>
                    <Bar dataKey="value" radius={[0,6,6,0]} cursor="pointer" onClick={(data)=>setFilterTribunal(prev=>prev===data.name?'':data.name)}>
                      {chartTribunales.map((d,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} stroke={filterTribunal===d.name?'#1E293B':'none'} strokeWidth={filterTribunal===d.name?2:0}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 📊 Resultados en causas terminadas — % de rendimiento (condena / absolución / salida alternativa) */}
            <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #f1f5f9'}}>
              <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontWeight:700,...f}}>Resultados en causas terminadas</div>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:16,...f}}>Tu % de rendimiento, según los mismos filtros de arriba · {totalTerminadas} causa{totalTerminadas!==1?'s':''} terminada{totalTerminadas!==1?'s':''}</div>
              {totalTerminadas===0 ? (
                <div style={{textAlign:'center',padding:'40px 0',color:'#94a3b8',fontSize:13,...f}}>Sin causas terminadas para estos filtros.</div>
              ) : (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                    <div style={{background:'#ecfdf5',border:'1.5px solid #a7f3d0',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#059669',letterSpacing:'-1px',...f}}>{resumenRendimiento.absoluciones.pct}%</div>
                      <div style={{fontSize:11,color:'#065f46',fontWeight:600,marginTop:4,...f}}>Absoluciones ({resumenRendimiento.absoluciones.n})</div>
                    </div>
                    <div style={{background:'#fff7ed',border:'1.5px solid #fed7aa',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#d97706',letterSpacing:'-1px',...f}}>{resumenRendimiento.salidasAlt.pct}%</div>
                      <div style={{fontSize:11,color:'#92400e',fontWeight:600,marginTop:4,...f}}>Salidas alternativas ({resumenRendimiento.salidasAlt.n})</div>
                    </div>
                    <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'16px',textAlign:'center'}}>
                      <div style={{fontSize:26,fontWeight:900,color:'#dc2626',letterSpacing:'-1px',...f}}>{resumenRendimiento.condenas.pct}%</div>
                      <div style={{fontSize:11,color:'#991b1b',fontWeight:600,marginTop:4,...f}}>Condenas ({resumenRendimiento.condenas.n})</div>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:10,fontWeight:600,...f}}>Detalle por subestado</div>
                  {chartResultados.map(r=>(
                    <div key={r.subestado} style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                      <div style={{width:150,fontSize:12,fontWeight:600,color:r.color,flexShrink:0,...f}}>{r.label}</div>
                      <div style={{flex:1,background:'#F8F9FC',borderRadius:6,height:22,position:'relative',overflow:'hidden',border:`1px solid ${r.border}`}}>
                        <div style={{width:`${r.pct}%`,height:'100%',background:r.bg,borderRight:`2px solid ${r.color}`,transition:'width 0.3s'}}/>
                      </div>
                      <div style={{width:70,fontSize:12,fontWeight:700,color:'#1E293B',textAlign:'right',flexShrink:0,...f}}>{r.value} · {r.pct}%</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:2,minWidth:320,position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}>🔍</span>
            <input style={{width:'100%',padding:'11px 14px',paddingLeft:38,border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} placeholder="Buscar por RUC, RIT, imputado, delito..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select style={{width:'auto',minWidth:180,padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={filterTribunal} onChange={e=>setFilterTribunal(e.target.value)}><option value="">Todos los tribunales</option>{tribunales.map(t=><option key={t} value={t}>{t}</option>)}</select>
          <select style={{width:'auto',minWidth:160,padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}><option value="">Todos los estados</option>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <div style={{width:220}}>
            <SearchableSelect value={filterDelito} onChange={v=>setFilterDelito(v)} options={DELITOS_CATALOGO} placeholder="Todos los delitos" isDelito={true}/>
          </div>
          <select style={{width:'auto',minWidth:150,padding:'11px 14px',border:'none',borderRadius:14,fontSize:13,color:'#1E293B',background:'#fff',boxShadow:'0 1px 2px rgba(15,23,42,0.06)',...f}} value={filterRegimen} onChange={e=>setFilterRegimen(e.target.value)}>
            <option value="">RPA / Adulto</option>
            <option value="ADULTO">Solo Adulto</option>
            <option value="RPA">Solo RPA</option>
            <option value="MIXTO">Mixta (RPA y Adulto)</option>
          </select>
          {hayFiltrosActivos && <button className="btn-secondary" style={{fontSize:12,color:'#dc2626',border:'none',boxShadow:'0 1px 2px rgba(15,23,42,0.06)'}} onClick={limpiarFiltros}>✕ Limpiar</button>}
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>{filtered.length} resultado{filtered.length!==1?'s':''}</span>
          <button className="btn-primary" style={{borderRadius:14}} onClick={()=>setShowNuevaCausa(true)}>+ Nueva causa</button>
          <button className="btn-secondary" onClick={()=>setShowStats(!showStats)} style={{border:'none',borderRadius:14,boxShadow:'0 1px 2px rgba(15,23,42,0.06)',color:showStats?'#2563eb':'#374151'}}>{showStats?'Ocultar':'📊 Estadísticas'}</button>
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:60,color:'#94a3b8',fontSize:14,...f}}>Cargando causas...</div>
        ):(
          <div style={{background:'#fff',border:'none',borderRadius:20,boxShadow:'0 1px 2px rgba(15,23,42,0.06)',padding:8,overflowX:'auto'}}>
            {/* Encabezado — solo en pantalla ancha */}
            <div className="hide-mobile" style={{display:'grid',gridTemplateColumns:'140px 110px 140px 1fr 1fr'}}>
              {[{key:'ruc',label:'RUC'},{key:'rit',label:'RIT'},{key:'tribunal',label:'Tribunal'},{key:'imputado',label:'Imputado'},{key:'delito',label:'Delito'}].map(col=>(
                <div key={col.key} className="sort-col" onClick={()=>handleSort(col.key)} style={{padding:'16px 20px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:sortCol===col.key?'#2563eb':'#94a3b8',textTransform:'uppercase',letterSpacing:1.5,...f}}>{col.label}<SortIcon col={col.key}/></div>
              ))}
            </div>
            {filtered.map((c)=>(
              <div key={c.id} className="row-hover causa-row" onClick={()=>openCausa(c)} style={{borderRadius:14}}>
                {/* Fila ancha (PC/tablet) — misma info y orden de siempre */}
                <div className="causa-col-desktop" style={{display:'grid',gridTemplateColumns:'140px 110px 140px 1fr 1fr'}}>
                  <div style={{padding:'14px 20px',fontSize:12,fontWeight:700,color:'#1E293B',...f}}>{c.ruc}</div>
                  <div style={{padding:'14px 20px',fontSize:12,color:'#94a3b8',fontWeight:500,...f}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                      <span>{c.rit||'—'}</span>
                    </div>
                  </div>
                  <div style={{padding:'12px 16px',fontSize:12,color:'#475569',fontWeight:500,...f}}>{c.tribunal}</div>
                  <div style={{padding:'12px 16px',...f}}><div style={{maxWidth:210,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,color:'#1E293B',fontWeight:500}}>{c.imputado}</div></div>
                  <div style={{padding:'14px 20px',...f}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,color:'#64748b'}}>{(c.delito||'').replace(/\|/g,', ')||'—'}</div></div>
                </div>
                {/* Tarjeta condensada — solo en celular: RUC + estado, luego RIT/Tribunal, luego imputado */}
                <div className="causa-row-mobile" style={{padding:'12px 14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:'#1E293B',...f}}>{c.ruc}</span>
                    <SemaforoTag updated_at={c.updated_at} estado={c.estado} />
                  </div>
                  <div style={{fontSize:11,color:'#94a3b8',marginTop:3,...f}}>{c.rit||'—'} · {c.tribunal||'—'}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',...f}}>{c.imputado}</div>
                </div>
              </div>
            ))}
            {filtered.length===0&&<div style={{textAlign:'center',padding:48,color:'#94a3b8',fontSize:14,...f}}>Sin resultados.</div>}
          </div>
        )}
      </div>

      {showNuevaCausa&&(
        <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'5vh',zIndex:200,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&setShowNuevaCausa(false)}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:32,width:540,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(15,23,42,0.22)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontSize:20,fontWeight:800,color:'#1E293B',marginBottom:24,...f}}>Nueva Causa</div>
            <div className="grid2-mobile" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* RUC y RIT */}
              {[{key:'ruc',label:'RUC *',ph:'Ej: 2600123456-7',full:true},{key:'rit',label:'RIT',ph:'Ej: 1234-2026'}].map(field=>(
                <div key={field.key} style={{gridColumn:field.full?'1/-1':'auto'}}>
                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>{field.label}</div>
                  <input style={inp} placeholder={field.ph} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}
              {/* RUT del imputado con autorelleno */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>RUT del imputado</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{...inp,flex:1}} placeholder="Ej: 12345678-9"
                    value={nuevaCausa.imputado_rut}
                    onChange={e=>setNuevaCausa(p=>({...p,imputado_rut:e.target.value}))}
                    onBlur={e=>buscarRutNuevaCausa(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&buscarRutNuevaCausa(nuevaCausa.imputado_rut)}
                  />
                  {rutBuscando && <span style={{fontSize:12,color:'#94a3b8',alignSelf:'center',...f}}>Buscando...</span>}
                  {rutEncontrado && <span style={{fontSize:12,color:'#065f46',alignSelf:'center',fontWeight:600,...f}}>✓ Datos encontrados</span>}
                </div>
              </div>
              {/* Datos del imputado */}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nombre completo *</div>
                <input style={inp} placeholder="Nombre completo del imputado"
                  value={nuevaCausa.imputado}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de nacimiento</div>
                <input type="date" style={inp}
                  value={nuevaCausa.imputado_fecha_nac}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_fecha_nac:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Nacionalidad</div>
                <input style={inp} placeholder="Ej: CHILENO"
                  value={nuevaCausa.imputado_nacionalidad}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_nacionalidad:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Domicilio</div>
                <input style={inp} placeholder="Domicilio del imputado"
                  value={nuevaCausa.imputado_domicilio}
                  onChange={e=>setNuevaCausa(p=>({...p,imputado_domicilio:e.target.value}))}/>
              </div>
              {/* Fiscal */}
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fiscal</div>
                <input style={inp} placeholder="Nombre del fiscal" value={nuevaCausa.fiscal} onChange={e=>setNuevaCausa(p=>({...p,fiscal:e.target.value}))}/>
              </div>
              {/* Cautelar — ahora como dropdown, igual que en el detalle de la causa */}
              <div>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Cautelar</div>
                <select style={inp} value={nuevaCausa.cautelar} onChange={e=>setNuevaCausa(p=>({...p,cautelar:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_CAUTELARES_TODAS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Centro Penal</div>
                <SearchableSelect
                  value={nuevaCausa.centro_penal}
                  onChange={v=>setNuevaCausa(p=>({...p,centro_penal:v}))}
                  options={CENTROS_PENALES}
                  placeholder="Buscar centro penal..."
                  isDelito={false}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Tribunal *</div>
                <SearchableSelect
                  value={nuevaCausa.tribunal}
                  onChange={v=>setNuevaCausa(p=>({...p,tribunal:v}))}
                  options={TRIBUNALES_CHILE}
                  placeholder="Seleccionar tribunal..."
                  isDelito={false}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Delito(s) *</div>
                <DelitosChips
                  value={nuevaCausa.delito}
                  onChange={v=>setNuevaCausa(p=>({...p,delito:v}))}
                  options={DELITOS_CATALOGO}
                />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha de los hechos</div>
                <input type="date" style={inp} value={nuevaCausa.fecha_hechos} onChange={e=>setNuevaCausa(p=>({...p,fecha_hechos:e.target.value}))}/>
              </div>
              <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1.5px solid #a7f3d0',borderRadius:12,padding:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'#059669',marginBottom:14,...f}}>⏱ Cálculo de plazo ACD</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Fecha inicio</div><input type="date" style={inp} value={nuevaCausa.fecha_inicio} onChange={e=>setNuevaCausa(p=>({...p,fecha_inicio:e.target.value}))}/></div>
                  <div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Días plazo</div><input type="number" style={inp} placeholder="Ej: 210" value={nuevaCausa.dias_plazo} onChange={e=>setNuevaCausa(p=>({...p,dias_plazo:e.target.value}))}/></div>
                </div>
                {nuevaCausa.fecha_inicio && nuevaCausa.dias_plazo && (<div style={{marginTop:10,padding:'10px 14px',background:'#fff',borderRadius:8,border:'1px solid #a7f3d0',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📅</span><div><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:700,...f}}>Vencimiento calculado</div><div style={{fontSize:15,fontWeight:800,color:'#059669',...f}}>{calcularVencimiento(nuevaCausa.fecha_inicio, nuevaCausa.dias_plazo)}</div></div></div>)}
                <div style={{marginTop:12}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>O ingresa plazo manualmente</div><input style={inp} placeholder="VENCE DD-MM-YYYY" value={nuevaCausa.plazo} onChange={e=>setNuevaCausa(p=>({...p,plazo:e.target.value}))}/></div>
              </div>
              <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6,fontWeight:700,...f}}>Estado</div><select style={inp} value={nuevaCausa.estado} onChange={e=>setNuevaCausa(p=>({...p,estado:e.target.value}))}>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
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
