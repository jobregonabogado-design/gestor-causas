import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import GmailIntegracion from '../components/GmailIntegracion'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  .cal-day { transition: background 0.2s ease, outline 0.2s ease; cursor: pointer; }
  .cal-day:hover { background: #f8faff !important; }
  .aud-card { transition: box-shadow 0.25s ease, transform 0.25s ease; }
  .aud-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(15,23,42,0.08) !important; }
  .nav-btn { transition: background 0.2s ease; }
  .nav-btn:hover { background: #f1f5f9 !important; }
  .tag-pill { transition: background 0.2s ease, border-color 0.2s ease; cursor: pointer; }
  .tag-pill:hover { opacity: 0.85; }
  .btn-blue { font-family:'Century Gothic','Inter',sans-serif; background:#1E293B; color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.25s ease, box-shadow 0.25s ease; box-shadow:0 2px 8px rgba(30,58,95,0.2); }
  .btn-blue:hover { background:#1e40af; box-shadow:0 4px 16px rgba(30,58,95,0.3); }
  .btn-out { font-family:'Century Gothic','Inter',sans-serif; background:#fff; color:#374151; border:1.5px solid #e5e7eb; border-radius:10px; padding:8px 18px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.25s ease, color 0.25s ease, background 0.25s ease; }
  .btn-out:hover { border-color:#93c5fd; color:#1E293B; background:#f8faff; }
  input,select,textarea { font-family:'Century Gothic','Inter',sans-serif !important; text-transform:uppercase; }
  input:focus,select:focus,textarea:focus { outline:none; border-color:#93c5fd !important; box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
`

function tipoColor(tipo) {
  const t = (tipo||"").toUpperCase()
  if (t.includes("JUICIO ORAL") || t === "JO") return { bg:"#fef2f2", border:"#fecdd3", dot:"#9f1239", text:"#9f1239" }
  if (t.includes("ABREVIADO")) return { bg:"#eff6ff", border:"#bfdbfe", dot:"#1e40af", text:"#1e40af" }
  if (t.includes("APJO")) return { bg:"#f5f3ff", border:"#ddd6fe", dot:"#5b21b6", text:"#5b21b6" }
  if (t.includes("REV PP") || t.includes("REVPP")) return { bg:"#fff7ed", border:"#fed7aa", dot:"#92400e", text:"#92400e" }
  if (t.includes("AUMENTO") || t.includes("CIERRE")) return { bg:"#ecfdf5", border:"#a7f3d0", dot:"#065f46", text:"#065f46" }
  if (t.includes("ENTREVISTA") || t.includes("DECLARACION")) return { bg:"#fefce8", border:"#fef08a", dot:"#854d0e", text:"#854d0e" }
  if (t.includes("CAUTELA") || t.includes("APELACION") || t.includes("APELACIÓN")) return { bg:"#fdf4ff", border:"#e9d5ff", dot:"#701a75", text:"#701a75" }
  return { bg:"#F8F9FC", border:"#e2e8f0", dot:"#475569", text:"#334155" }
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
const f = { fontFamily:"'Century Gothic','Inter', sans-serif" }

const leyenda = [
  { label:"Juicio Oral", color:"#e11d48" },
  { label:"Abreviado", color:"#2563eb" },
  { label:"APJO", color:"#7c3aed" },
  { label:"Rev PP", color:"#ea580c" },
  { label:"Aumento/Cierre", color:"#16a34a" },
  { label:"Entrevista", color:"#ca8a04" },
  { label:"Cautela/Apel.", color:"#a21caf" },
]

const TIPOS = ["JUICIO ORAL","ABREVIADO","APJO","REV PP","AUMENTO PLAZO","CIERRE","ENTREVISTA","DECLARACION","FORMALIZACION","CAUTELA DE GARANTIAS","APELACIÓN CAUTELAR","SCP","OTRO"]


function AudienciaEditCard({ a, onDelete, onUpdate, f }) {
  const [editing, setEditing] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [form, setForm] = useState({ fecha:a.fecha||'', hora:a.hora||'', tipo:a.tipo||'', tribunal:a.tribunal||'', sala:a.sala||'', imputado:a.imputado||'' })
  const [saving, setSaving] = useState(false)
  const c = tipoColor(a.tipo)
  const inp = { width:'100%', padding:'7px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:12, color:'#1E293B', background:'#fff', ...f }
  const historial = (a.notas||'').split('\n').filter(l=>l.startsWith('['))

  const handleSave = async () => {
    if (!motivo.trim()) { alert('Ingresa el motivo de la modificación'); return }
    setSaving(true)
    await onUpdate(form, motivo)
    setEditing(false)
    setMotivo('')
    setSaving(false)
  }

  if (editing) return (
    <div style={{background:'#f0f7ff',border:'1.5px solid #2563eb',borderRadius:12,padding:16,marginBottom:8}}>
      <div style={{fontSize:12,fontWeight:700,color:'#2563eb',marginBottom:12,...f}}>✏ Editar audiencia</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        {[{key:'fecha',label:'Fecha',type:'date'},{key:'hora',label:'Hora',type:'time'},{key:'tipo',label:'Tipo',type:'text'},{key:'tribunal',label:'Tribunal',type:'text'},{key:'sala',label:'Sala',type:'text'},{key:'imputado',label:'Imputado',type:'text'}].map(field=>(
          <div key={field.key}>
            <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:600,...f}}>{field.label}</div>
            <input type={field.type} style={inp} value={form[field.key]} onChange={e=>setForm(p=>({...p,[field.key]:e.target.value}))}/>
          </div>
        ))}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:'#dc2626',textTransform:'uppercase',letterSpacing:1.2,marginBottom:4,fontWeight:700,...f}}>Motivo de modificación *</div>
        <input style={{...inp,borderColor:'#fecaca'}} placeholder="Ej: Reprogramada por el tribunal, error en la hora..." value={motivo} onChange={e=>setMotivo(e.target.value)}/>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn-blue" style={{fontSize:12,padding:'7px 16px'}} onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
        <button className="btn-out" style={{fontSize:12,padding:'7px 14px'}} onClick={()=>setEditing(false)}>Cancelar</button>
      </div>
    </div>
  )

  return (
    <div className="aud-card" style={{background:'#fff',border:`1.5px solid ${c.border}`,borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 4px rgba(15,23,42,0.05)',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:c.text,background:c.bg,padding:'3px 8px',borderRadius:20,border:`1px solid ${c.border}`,...f}}>{a.tipo}</span>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#475569',...f}}>🕐 {a.hora}</span>
          <button onClick={()=>setEditing(true)} style={{background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:6,padding:'3px 8px',fontSize:10,color:'#2563eb',cursor:'pointer',fontWeight:600,...f}}>✏</button>
          <button onClick={()=>onDelete(a.id)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:'#fca5a5',padding:'2px 4px'}}>✕</button>
        </div>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:4,...f}}>👤 {a.imputado||'—'}</div>
      <div style={{fontSize:12,color:'#64748b',marginBottom:a.rit?4:0,...f}}>🏛 {a.tribunal||'—'}{a.sala?` · Sala ${a.sala}`:''}</div>
      {a.rit&&<div style={{fontSize:11,color:'#94a3b8',...f}}>RIT: {a.rit}</div>}
      {a.ruc&&<div style={{fontSize:11,color:'#94a3b8',...f}}>RUC: {a.ruc}</div>}
      {historial.length>0&&(
        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #f1f5f9'}}>
          {historial.map((h,i)=><div key={i} style={{fontSize:10,color:'#94a3b8',marginBottom:2,...f}}>📝 {h}</div>)}
        </div>
      )}
    </div>
  )
}

export default function Calendario({ onVerCausa }) {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [selDia, setSelDia] = useState(null)
  const [vistaLista, setVistaLista] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  const [filtroTipo, setFiltroTipo] = useState("")
  const [audiencias, setAudiencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGmail, setShowGmail] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [savingForm, setSavingForm] = useState(false)
  const [nueva, setNueva] = useState({ fecha:"", hora:"", tipo:"", tribunal:"", sala:"", imputado:"", rit:"", ruc:"", notas:"" })

  useEffect(() => { loadAudiencias() }, [])

  // ✅ FIX: recarga audiencias cuando se cierra el panel Gmail (por si se agregaron nuevas)
  const handleGmailToggle = () => {
    if (showGmail) loadAudiencias()
    setShowGmail(!showGmail)
  }

  // Navegar a causa por RUC
  const irACausa = async (ruc) => {
    if (!ruc || !onVerCausa) return
    const { data } = await supabase
      .from('causas')
      .select('*')
      .ilike('ruc', `%${ruc.replace(/\s/g,'')}%`)
      .limit(1)
      .maybeSingle()
    if (data) onVerCausa(data)
  }

  // Autorelleno al escribir RUC
  const buscarCausaPorRuc = async (ruc) => {
    if (!ruc || ruc.length < 8) return
    const rucLimpio = ruc.replace(/\s/g, '')
    const { data } = await supabase
      .from('causas')
      .select('ruc, rit, imputado, tribunal, estado')
      .ilike('ruc', `%${rucLimpio}%`)
      .eq('estado', 'vigente')
      .limit(1)
      .maybeSingle()
    if (data) {
      setNueva(p => ({
        ...p,
        ruc: data.ruc,
        rit: p.rit || data.rit || '',
        imputado: data.imputado?.split('|')[0] || '',
        tribunal: p.tribunal || data.tribunal || '',
      }))
    }
  }

  const loadAudiencias = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("audiencias").select("*").order("fecha", { ascending: true })
    if (!error) setAudiencias(data || [])
    setLoading(false)
  }

  const saveAudiencia = async () => {
    if (!nueva.fecha || !nueva.tipo) return
    setSavingForm(true)  // ✅ FIX: era setSaving (variable inexistente)
    const { error } = await supabase.from("audiencias").insert(nueva)
    if (!error) {
      await loadAudiencias()
      setShowForm(false)
      setNueva({ fecha:"", hora:"", tipo:"", tribunal:"", sala:"", imputado:"", rit:"", ruc:"", notas:"" })
    }
    setSavingForm(false)  // ✅ FIX
  }

  const deleteAudiencia = async (id) => {
    if (!window.confirm("¿Eliminar esta audiencia?")) return
    await supabase.from("audiencias").delete().eq("id", id)
    await loadAudiencias()
  }

  const audPorFecha = useMemo(() => {
    const map = {}
    audiencias.forEach(a => { if (!map[a.fecha]) map[a.fecha] = []; map[a.fecha].push(a) })
    return map
  }, [audiencias])

  const diasDelMes = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const ultimo = new Date(anio, mes + 1, 0)
    const dias = []
    for (let i = 0; i < primero.getDay(); i++) dias.push(null)
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(d)
    return dias
  }, [mes, anio])

  const audDelMes = useMemo(() => {
    const prefix = `${anio}-${String(mes+1).padStart(2,"0")}`
    return audiencias
      .filter(a => a.fecha && a.fecha.startsWith(prefix) && (!filtroTipo || (a.tipo||"").toUpperCase().includes(filtroTipo.toUpperCase())))
      .sort((a,b) => (a.fecha||"").localeCompare(b.fecha||"") || (a.hora||"").localeCompare(b.hora||""))
  }, [audiencias, mes, anio, filtroTipo])

  const audDelDia = selDia ? (audPorFecha[`${anio}-${String(mes+1).padStart(2,"0")}-${String(selDia).padStart(2,"0")}`] || []) : []

  const navMes = (dir) => {
    if (dir===-1){if(mes===0){setMes(11);setAnio(a=>a-1)}else setMes(m=>m-1)}
    else{if(mes===11){setMes(0);setAnio(a=>a+1)}else setMes(m=>m+1)}
    setSelDia(null)
  }

  const inp = { width:"100%", padding:"9px 12px", border:"1.5px solid #e5e7eb", borderRadius:7, fontSize:13, color:"#1a1a2e", background:"#fff", ...f }

  return (
    <div style={{background:"#F8F9FC",minHeight:"100vh",...f}}>
      <style>{CSS}</style>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:800,color:"#1E293B",margin:0,letterSpacing:"-0.5px"}}>Calendario de audiencias</h1>
            <p style={{fontSize:14,color:"#64748b",marginTop:4}}><span style={{fontWeight:700,color:"#1E293B"}}>{audDelMes.length}</span> audiencias en {MESES[mes]} {anio}</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button className="btn-blue" onClick={()=>setShowForm(true)}>+ Nueva audiencia</button>
            <button onClick={handleGmailToggle} style={{background:showGmail?'#1E293B':'#fff',color:showGmail?'#fff':'#475569',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Century Gothic','Inter',sans-serif",transition:'all 0.2s'}}>
              📧 Gmail
            </button>
            <button onClick={()=>setVistaLista(!vistaLista)} className="btn-out"
              style={{background:vistaLista?"#1E293B":"#fff",color:vistaLista?"#fff":"#475569",borderColor:vistaLista?"#1E293B":"#e2e8f0"}}>
              {vistaLista?"📅 Calendario":"☰ Lista"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:4,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"4px"}}>
              <button onClick={()=>navMes(-1)} className="nav-btn" style={{background:"transparent",border:"none",borderRadius:7,width:36,height:36,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>‹</button>
              <span style={{fontWeight:700,fontSize:15,minWidth:170,textAlign:"center",color:"#1E293B",...f}}>{MESES[mes]} {anio}</span>
              <button onClick={()=>navMes(1)} className="nav-btn" style={{background:"transparent",border:"none",borderRadius:7,width:36,height:36,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>›</button>
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {leyenda.map(l=>(
            <div key={l.label} className="tag-pill" onClick={()=>setFiltroTipo(filtroTipo===l.label?"":l.label)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:filtroTipo===l.label?l.color:"#fff",border:`1.5px solid ${filtroTipo===l.label?l.color:"#e2e8f0"}`}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:filtroTipo===l.label?"#fff":l.color}}/>
              <span style={{fontSize:11,fontWeight:600,color:filtroTipo===l.label?"#fff":"#475569",...f}}>{l.label}</span>
            </div>
          ))}
          {filtroTipo&&<button onClick={()=>setFiltroTipo("")} className="btn-out" style={{padding:"4px 12px",borderRadius:20,fontSize:11}}>✕ Limpiar</button>}
        </div>

        {showGmail && (
          <div style={{marginBottom:20}}>
            <GmailIntegracion onImportComplete={loadAudiencias}/>
          </div>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:60,color:"#94a3b8",fontSize:14,...f}}>Cargando audiencias...</div>
        ) : !vistaLista ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:20,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            {/* Calendario */}
            <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",overflowX:"auto",WebkitOverflowScrolling:"touch",boxShadow:"0 1px 8px rgba(15,23,42,0.06)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#1E293B",minWidth:500}}>
                {DIAS.map((d,i)=>(
                  <div key={d} style={{padding:"14px 0",textAlign:"center",fontSize:12,fontWeight:700,color:i===0||i===6?"#f87171":"#94a3b8",letterSpacing:0.8,...f}}>{d}</div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",minWidth:500}}>
                {diasDelMes.map((dia,i)=>{
                  if(!dia) return <div key={`e${i}`} style={{minHeight:80,background:"#fafafa",borderRight:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9"}}/>
                  const key=`${anio}-${String(mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`
                  const auds=audPorFecha[key]||[]
                  const esHoy=dia===hoy.getDate()&&mes===hoy.getMonth()&&anio===hoy.getFullYear()
                  const seleccionado=dia===selDia
                  const diaSem=new Date(anio,mes,dia).getDay()
                  const esFind=diaSem===0||diaSem===6
                  return(
                    <div key={dia} className="cal-day" onClick={()=>setSelDia(dia===selDia?null:dia)}
                      style={{minHeight:96,padding:"8px 6px",background:seleccionado?"#eff6ff":esFind?"#fafafa":"#fff",borderRight:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",outline:seleccionado?"2px solid #93c5fd":"none",outlineOffset:-2}}>
                      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:5}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:esHoy?"#1E293B":"transparent",color:esHoy?"#fff":esFind?"#94a3b8":"#1e293b",fontSize:14,fontWeight:esHoy?700:600,display:"flex",alignItems:"center",justifyContent:"center",...f}}>{dia}</div>
                      </div>
                      {auds.slice(0,3).map((a,idx)=>{
                        const c=tipoColor(a.tipo)
                        return(
                          <div key={idx} style={{fontSize:10,padding:"2px 5px",borderRadius:4,background:c.bg,borderLeft:`2px solid ${c.dot}`,color:c.text,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:500,...f}}>
                            {a.hora} {(a.tipo||"").split("/")[0].substring(0,10)}
                            {a.imputado&&<div style={{fontSize:9,opacity:0.85,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(a.imputado||"").split(" ")[0]}</div>}
                          </div>
                        )
                      })}
                      {auds.length>3&&<div style={{fontSize:10,color:"#64748b",paddingLeft:4,fontWeight:600,...f}}>+{auds.length-3} más</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Panel lateral */}
            <div>
              {selDia&&audDelDia.length>0?(
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#1E293B",marginBottom:12,...f}}>{selDia} de {MESES[mes]} — <span style={{color:"#2563eb"}}>{audDelDia.length} audiencia{audDelDia.length>1?"s":""}</span></div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:580,overflowY:"auto"}}>
                    {audDelDia.map((a,i)=>{
                      const c=tipoColor(a.tipo)
                      return(
                        <div key={i}>
                        {a.ruc && onVerCausa && (
                          <div onClick={()=>irACausa(a.ruc)}
                            style={{fontSize:13,color:'#2563eb',cursor:'pointer',marginBottom:6,display:'inline-flex',alignItems:'center',gap:6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'4px 12px',fontWeight:600,...f}}>
                            🔗 <span style={{fontWeight:600}}>{a.ruc}</span>
                            <span style={{fontSize:11,color:'#60a5fa'}}>→ ver causa</span>
                          </div>
                        )}
                        <AudienciaEditCard key={i} a={a} onDelete={deleteAudiencia} onUpdate={async(updated,motivo)=>{
                          const historial = a.notas ? a.notas + `\n[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}` : `[${new Date().toLocaleDateString('es-CL')}] Modificado: ${motivo}`
                          const{error}=await supabase.from("audiencias").update({...updated,notas:historial}).eq("id",a.id)
                          if(!error)setAudiencias(prev=>prev.map(x=>x.id===a.id?{...x,...updated,notas:historial}:x))
                        }} f={f}/>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ):selDia?(
                <div style={{background:"#F8F9FC",borderRadius:14,padding:24,textAlign:"center",border:"1.5px dashed #e2e8f0"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📅</div>
                  <div style={{fontSize:13,color:"#94a3b8",...f}}>Sin audiencias el {selDia} de {MESES[mes]}</div>
                  <button className="btn-blue" style={{marginTop:12,fontSize:12,padding:"7px 16px"}} onClick={()=>{setNueva(p=>({...p,fecha:`${anio}-${String(mes+1).padStart(2,"0")}-${String(selDia).padStart(2,"0")}`}));setShowForm(true)}}>+ Agregar audiencia</button>
                </div>
              ):(
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#1E293B",marginBottom:12,...f}}>Próximas — {MESES[mes]}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:580,overflowY:"auto"}}>
                    {audDelMes.slice(0,10).map((a,i)=>{
                      const c=tipoColor(a.tipo)
                      const dia=(a.fecha||"").split("-")[2]
                      return(
                        <div key={i} className="aud-card" style={{display:"flex",gap:10,alignItems:"flex-start",background:"#fff",border:"1px solid #f1f5f9",borderRadius:12,padding:"12px 14px",boxShadow:"0 1px 3px rgba(15,23,42,0.05)"}}>
                          <div style={{minWidth:42,height:42,background:c.dot,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,fontWeight:700,flexShrink:0,...f}}>{dia}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:c.text,marginBottom:2,...f}}>{a.tipo}</div>
                            <div style={{fontSize:12,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",...f}}>{a.imputado||"—"}</div>
                            <div style={{fontSize:11,color:"#94a3b8",marginTop:2,...f}}>{a.tribunal||"—"} · {a.hora}</div>
                          </div>
                        </div>
                      )
                    })}
                    {audDelMes.length===0&&<div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:13,...f}}>Sin audiencias este mes.</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ):(
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",overflowX:"auto",WebkitOverflowScrolling:"touch",boxShadow:"0 1px 8px rgba(15,23,42,0.06)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#1E293B"}}>
                  {["Fecha","Hora","Tipo","Imputado","Tribunal","Sala","RIT",""].map(h=>(
                    <th key={h} style={{padding:"13px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,...f}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audDelMes.map((a,i)=>{
                  const c=tipoColor(a.tipo)
                  return(
                    <tr key={i} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"11px 16px",...f}}>
                        {a.ruc && onVerCausa ? (
                          <span onClick={()=>irACausa(a.ruc)} style={{fontSize:12,fontWeight:700,color:'#1E293B',cursor:'pointer',textDecoration:'underline',...f}}>{a.ruc}</span>
                        ) : (
                          <span style={{fontSize:12,color:'#94a3b8',...f}}>{a.ruc||'—'}</span>
                        )}
                      </td>
                      <td style={{padding:"11px 16px",fontSize:13,fontWeight:600,color:"#1e293b",...f}}>{a.fecha}</td>
                      <td style={{padding:"11px 16px",fontSize:13,color:"#475569",...f}}>{a.hora}</td>
                      <td style={{padding:"11px 16px"}}><span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:c.bg,color:c.text,border:`1px solid ${c.border}`,fontWeight:600,...f}}>{a.tipo}</span></td>
                      <td style={{padding:"11px 16px",fontSize:13,color:"#374151",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",...f}}>{a.imputado||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:12,color:"#64748b",...f}}>{a.tribunal||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:12,color:"#64748b",...f}}>{a.sala||"—"}</td>
                      <td style={{padding:"11px 16px",fontSize:11,color:"#94a3b8",fontFamily:"monospace"}}>{a.rit}</td>
                      <td style={{padding:"11px 16px"}}><button onClick={()=>deleteAudiencia(a.id)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:"#fca5a5"}}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {audDelMes.length===0&&<div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14,...f}}>Sin audiencias en {MESES[mes]} {anio}</div>}
          </div>
        )}
      </div>

      {/* Modal nueva audiencia */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(3px)"}}
          onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={{background:"#fff",border:"1px solid #eaecf4",borderRadius:14,padding:32,width:520,maxWidth:"90vw",boxShadow:"0 20px 60px rgba(15,23,42,0.18)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Plus Jakarta Sans',serif",fontSize:20,fontWeight:700,color:"#1E293B",marginBottom:22}}>Nueva Audiencia</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Fecha *</div><input type="date" style={inp} value={nueva.fecha} onChange={e=>setNueva(p=>({...p,fecha:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Hora</div><input type="time" style={inp} value={nueva.hora} onChange={e=>setNueva(p=>({...p,hora:e.target.value}))}/></div>
              <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Tipo *</div>
                <select style={inp} value={nueva.tipo} onChange={e=>setNueva(p=>({...p,tipo:e.target.value}))}>
                  <option value="">Seleccionar tipo...</option>
                  {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Imputado</div><input style={inp} placeholder="Nombre del imputado" value={nueva.imputado} onChange={e=>setNueva(p=>({...p,imputado:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Tribunal</div><input style={inp} placeholder="Ej: 7 JG STGO" value={nueva.tribunal} onChange={e=>setNueva(p=>({...p,tribunal:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Sala</div><input style={inp} placeholder="Ej: 903" value={nueva.sala} onChange={e=>setNueva(p=>({...p,sala:e.target.value}))}/></div>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>RUC</div><input style={inp} placeholder="Ej: 2600123456-7" value={nueva.ruc} onChange={e=>setNueva(p=>({...p,ruc:e.target.value}))} onBlur={e=>buscarCausaPorRuc(e.target.value)}/></div>
              <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>RIT</div><input style={inp} placeholder="Ej: 1234-2026" value={nueva.rit} onChange={e=>setNueva(p=>({...p,rit:e.target.value}))}/></div>
              <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,...f}}>Notas</div><textarea style={{...inp,minHeight:70,resize:"vertical"}} placeholder="Observaciones adicionales..." value={nueva.notas} onChange={e=>setNueva(p=>({...p,notas:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:22}}>
              <button className="btn-blue" onClick={saveAudiencia} disabled={savingForm||!nueva.fecha||!nueva.tipo}>{savingForm?"Guardando...":"Guardar audiencia"}</button>
              <button className="btn-out" onClick={()=>setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
