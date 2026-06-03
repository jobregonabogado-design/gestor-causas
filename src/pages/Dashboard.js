import { useState, useEffect, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { CAUSAS_SEED } from "../lib/seedData"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

const E={vencido:{l:"VENCIDO",c:"#ef4444",bg:"rgba(239,68,68,0.12)"},proximo:{l:"POR VENCER",c:"#f59e0b",bg:"rgba(245,158,11,0.12)"},apjo:{l:"APJO",c:"#a78bfa",bg:"rgba(167,139,250,0.12)"},suspendida:{l:"SUSPENDIDA",c:"#6b7280",bg:"rgba(107,114,128,0.12)"},vigente:{l:"VIGENTE",c:"#38bdf8",bg:"rgba(56,189,248,0.12)"}}
const css=`@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap");*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Inter",sans-serif;background:#111827;color:#f1f5f9;-webkit-font-smoothing:antialiased}input,select,textarea,button{font-family:"Inter",sans-serif}.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}.row{transition:background 0.12s;cursor:pointer}.row:hover{background:rgba(14,165,233,0.06)!important}.btn{transition:all 0.12s;cursor:pointer}.btn:hover{opacity:0.88;transform:translateY(-1px)}.btn:active{transform:scale(0.97)}.modal-bg{animation:fi 0.18s ease}.modal-box{animation:su 0.22s cubic-bezier(0.16,1,0.3,1)}.fade{animation:fi 0.2s ease}.kpi{transition:all 0.15s;cursor:pointer}.kpi:hover{transform:translateY(-2px)}@keyframes fi{from{opacity:0}to{opacity:1}}@keyframes su{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1f2937;border-radius:4px}input:focus,select:focus,textarea:focus{border-color:#0ea5e9!important;outline:none}`

export default function Dashboard({session}){
const [causas,setCausas]=useState([])
const [loading,setLoading]=useState(true)
const [seeding,setSeeding]=useState(false)
const [search,setSearch]=useState("")
const [ft,setFt]=useState("")
const [fe,setFe]=useState("")
const [modal,setModal]=useState(null)
const [tab,setTab]=useState("datos")
const [ef,setEf]=useState(null)
const [ev,setEv]=useState("")
const [nota,setNota]=useState("")
const [notas,setNotas]=useState([])
const [auds,setAuds]=useState([])
const [showAF,setShowAF]=useState(false)
const [newAud,setNewAud]=useState({fecha:"",tipo:"",resultado:"",notas:""})
const [saving,setSaving]=useState(false)
const [showN,setShowN]=useState(false)
const [nC,setNC]=useState({ruc:"",rit:"",tribunal:"",delito:"",imputado:"",fiscal:"",cautelar:"",centro_penal:"",plazo:"",estado:"vigente"})
const [vista,setVista]=useState("tabla")
useEffect(()=>{load()},[])
const load=async()=>{setLoading(true);const{data}=await supabase.from("causas").select("*").order("created_at",{ascending:false});setCausas(data||[]);setLoading(false)}
const seed=async()=>{setSeeding(true);const ch=[];for(let i=0;i<CAUSAS_SEED.length;i+=50)ch.push(CAUSAS_SEED.slice(i,i+50));for(const c of ch)await supabase.from("causas").insert(c.map(x=>({ruc:x.ruc,rit:x.rit,tribunal:x.tribunal,delito:x.delito,imputado:x.imputado,fiscal:"",cautelar:"",centro_penal:"",plazo:x.plazo,estado:x.estado,carpeta_ref:""})));await load();setSeeding(false)}
const open=async(c)=>{setModal(c);setTab("datos");const[{data:n},{data:a}]=await Promise.all([supabase.from("notas").select("*").eq("causa_id",c.id).order("created_at",{ascending:false}),supabase.from("audiencias").select("*").eq("causa_id",c.id).order("fecha",{ascending:false})]);setNotas(n||[]);setAuds(a||[])}
const close=()=>{setModal(null);setEf(null)}
const upd=async(f,v)=>{setSaving(true);await supabase.from("causas").update({[f]:v,updated_at:new Date()}).eq("id",modal.id);const u={...modal,[f]:v};setModal(u);setCausas(p=>p.map(c=>c.id===u.id?u:c));setEf(null);setSaving(false)}
const addNota=async()=>{if(!nota.trim())return;setSaving(true);const{data}=await supabase.from("notas").insert({causa_id:modal.id,contenido:nota}).select().single();if(data)setNotas(p=>[data,...p]);setNota("");setSaving(false)}
const addAud=async()=>{if(!newAud.fecha)return;setSaving(true);const{data}=await supabase.from("audiencias").insert({causa_id:modal.id,...newAud}).select().single();if(data)setAuds(p=>[data,...p]);setNewAud({fecha:"",tipo:"",resultado:"",notas:""});setShowAF(false);setSaving(false)}
const addCausa=async()=>{if(!nC.ruc)return;setSaving(true);const{data}=await supabase.from("causas").insert(nC).select().single();if(data){setCausas(p=>[data,...p]);setShowN(false);setNC({ruc:"",rit:"",tribunal:"",delito:"",imputado:"",fiscal:"",cautelar:"",centro_penal:"",plazo:"",estado:"vigente"})};setSaving(false)}
const out=()=>supabase.auth.signOut()
const tribs=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
const filt=useMemo(()=>causas.filter(c=>{const s=search.toLowerCase();const m=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v?.toLowerCase().includes(s));return m&&(!ft||c.tribunal===ft)&&(!fe||c.estado===fe)}),[causas,search,ft,fe])
const st=useMemo(()=>({tot:causas.length,vig:causas.filter(c=>c.estado==="vigente").length,ven:causas.filter(c=>c.estado==="vencido").length,prx:causas.filter(c=>c.estado==="proximo").length,apj:causas.filter(c=>c.estado==="apjo").length}),[causas])
const delitosData=useMemo(()=>{const m={};causas.forEach(c=>{if(!c.delito)return;const d=c.delito.split(" ").slice(0,3).join(" ");m[d]=(m[d]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}))},[causas])
const tribunalData=useMemo(()=>{const m={};causas.forEach(c=>{if(c.tribunal)m[c.tribunal]=(m[c.tribunal]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name:name.replace("JG STGO","JG"),value}))},[causas])
const COLORS=["#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","#0284c7","#0369a1","#93c5fd","#60a5fa"]
const C=modal?causas.find(x=>x.id===modal.id)||modal:null
const Bdg=({e})=>{const cfg=E[e]||E.vigente;return(<span className="badge" style={{background:cfg.bg,color:cfg.c,border:"1px solid "+cfg.c+"40"}}><span style={{width:5,height:5,borderRadius:"50%",background:cfg.c,display:"inline-block"}}/>{cfg.l}</span>)}
const Inp=({label,fk,ed,full})=>{const val=C?C[fk]:null;return(<div style={{gridColumn:full?"1/-1":"auto"}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:600}}>{label}</div>{ef===fk?(<div style={{display:"flex",gap:6}}><input style={{flex:1,padding:"8px 12px",background:"#1f2937",border:"1px solid #0ea5e9",borderRadius:8,fontSize:13,color:"#f1f5f9",outline:"none"}} value={ev} onChange={e=>setEv(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")upd(fk,ev);if(e.key==="Escape")setEf(null)}} autoFocus/><button className="btn" onClick={()=>upd(fk,ev)} style={{background:"#0ea5e9",color:"#fff",border:"none",borderRadius:8,padding:"0 14px",fontWeight:700}}>ok</button><button className="btn" onClick={()=>setEf(null)} style={{background:"#1f2937",color:"#6b7280",border:"1px solid #374151",borderRadius:8,padding:"0 12px"}}>x</button></div>):(<div onClick={()=>{if(ed){setEf(fk);setEv(val||"")}}} style={{padding:"9px 12px",background:"#111827",borderRadius:8,border:"1px solid #1f2937",fontSize:13,color:val?"#f1f5f9":"#374151",fontStyle:val?"normal":"italic",cursor:ed?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>{if(ed)e.currentTarget.style.borderColor="#374151"}} onMouseLeave={e=>{if(ed)e.currentTarget.style.borderColor="#1f2937"}}><span>{val||(ed?"Agregar...":"sin datos")}</span>{ed&&<span style={{color:"#374151",fontSize:11}}>e</span>}</div>)}</div>)}
const inp={padding:"9px 12px",background:"#111827",border:"1px solid #1f2937",borderRadius:9,fontSize:13,color:"#f1f5f9",outline:"none",width:"100%",transition:"border-color 0.15s",boxSizing:"border-box"}
return(
<div style={{fontFamily:"Inter,sans-serif",background:"#111827",minHeight:"100vh",color:"#f1f5f9"}}>
<style>{css}</style>
<div style={{padding:"24px 28px",maxWidth:1440,margin:"0 auto"}}>
{st.ven>0&&<div className="fade" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderLeft:"3px solid #ef4444",borderRadius:10,padding:"12px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}><span style={{color:"#ef4444",fontSize:18}}>!</span><div><div style={{fontWeight:700,color:"#ef4444",fontSize:13}}>{st.ven} causa{st.ven>1?"s":""} con plazo VENCIDO</div><div style={{color:"#6b7280",fontSize:11,marginTop:1}}>Requieren atencion inmediata</div></div></div>}
{causas.length===0&&!loading&&<div className="fade" style={{background:"linear-gradient(135deg,rgba(14,165,233,0.1),rgba(56,189,248,0.06))",border:"1px solid rgba(14,165,233,0.2)",borderRadius:14,padding:"22px 24px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>Base de datos vacia</div><div style={{fontSize:13,color:"#6b7280"}}>Importa tus {CAUSAS_SEED.length} causas con un clic</div></div><button className="btn" onClick={seed} disabled={seeding} style={{background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:13,fontWeight:700}}>{seeding?"Importando...":"Importar causas"}</button></div>}
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
{[{k:"",l:"Total",n:st.tot,c:"#0ea5e9",ic:"+"},{k:"vigente",l:"Vigentes",n:st.vig,c:"#38bdf8",ic:"v"},{k:"vencido",l:"Vencidos",n:st.ven,c:"#ef4444",ic:"!"},{k:"proximo",l:"Por vencer",n:st.prx,c:"#f59e0b",ic:"o"},{k:"apjo",l:"APJO",n:st.apj,c:"#a78bfa",ic:"*"}].map(s=>{const act=fe===s.k&&s.k!=="";return(<div key={s.k} className="kpi" onClick={()=>setFe(fe===s.k?"":s.k)} style={{background:act?"linear-gradient(135deg,"+s.c+"20,"+s.c+"08)":"#1a2332",border:"1px solid "+(act?s.c+"50":"#1f2937"),borderRadius:12,padding:"16px 18px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}><div style={{fontSize:28,fontWeight:800,color:s.c,fontFamily:"JetBrains Mono,monospace",lineHeight:1}}>{s.n}</div></div><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{s.l}</div>{act&&<div style={{height:2,background:s.c,borderRadius:2,marginTop:8}}/>}</div>)})}
</div>
<div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
<div style={{display:"flex",gap:6}}>
{[["tabla","Lista"],["graficos","Graficos"]].map(([v,l])=><button key={v} className="btn" onClick={()=>setVista(v)} style={{background:vista===v?"rgba(14,165,233,0.12)":"transparent",color:vista===v?"#38bdf8":"#6b7280",border:"1px solid "+(vista===v?"rgba(14,165,233,0.25)":"transparent"),borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:vista===v?700:400}}>{l}</button>)}
</div>
<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
<div style={{position:"relative"}}><span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#374151",fontSize:13,pointerEvents:"none"}}>S</span><input style={{...inp,paddingLeft:28,width:260,borderRadius:9}} placeholder="Buscar RUC, RIT, imputado..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
<select style={{...inp,width:"auto",cursor:"pointer"}} value={ft} onChange={e=>setFt(e.target.value)}><option value="">Todos los tribunales</option>{tribs.map(t=><option key={t} value={t}>{t}</option>)}</select>
<select style={{...inp,width:"auto",cursor:"pointer"}} value={fe} onChange={e=>setFe(e.target.value)}><option value="">Todos los estados</option>{Object.entries(E).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select>
<span style={{fontSize:11,color:"#6b7280"}}>{filt.length} resultados</span>
<button className="btn" onClick={()=>setShowN(true)} style={{background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ Nueva</button>
</div>
</div>
{vista==="graficos"&&(
<div className="fade" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
<div style={{background:"#1a2332",borderRadius:14,border:"1px solid #1f2937",padding:"20px"}}>
<div style={{fontWeight:700,color:"#f1f5f9",fontSize:14,marginBottom:16}}>Distribucion por Delito</div>
<ResponsiveContainer width="100%" height={260}>
<PieChart><Pie data={delitosData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value">
{delitosData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
</Pie><Tooltip contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8,color:"#f1f5f9",fontSize:12}}/><Legend formatter={v=>v.slice(0,18)} wrapperStyle={{fontSize:10,color:"#6b7280"}}/></PieChart>
</ResponsiveContainer>
</div>
<div style={{background:"#1a2332",borderRadius:14,border:"1px solid #1f2937",padding:"20px"}}>
<div style={{fontWeight:700,color:"#f1f5f9",fontSize:14,marginBottom:16}}>Causas por Tribunal</div>
<ResponsiveContainer width="100%" height={260}>
<BarChart data={tribunalData} layout="vertical" margin={{left:0,right:16}}>
<XAxis type="number" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/>
<YAxis type="category" dataKey="name" tick={{fill:"#9ca3af",fontSize:9}} width={65} axisLine={false} tickLine={false}/>
<Tooltip contentStyle={{background:"#1f2937",border:"1px solid #374151",borderRadius:8,color:"#f1f5f9",fontSize:12}}/>
<Bar dataKey="value" fill="#0ea5e9" radius={[0,4,4,0]} maxBarSize={16}/>
</BarChart>
</ResponsiveContainer>
</div>
</div>
)}
{vista==="tabla"&&(
loading?<div className="fade" style={{textAlign:"center",padding:80,color:"#374151"}}>Cargando...</div>:(
<div className="fade" style={{background:"#1a2332",borderRadius:14,border:"1px solid #1f2937",overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr style={{borderBottom:"1px solid #1f2937"}}>{["RUC","RIT","Tribunal","Imputado","Delito","Fiscal","Plazo","Estado",""].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
<tbody>{filt.map((c,i)=><tr key={c.id} className="row" onClick={()=>open(c)} style={{background:i%2===0?"#1a2332":"#161f2e",borderBottom:"1px solid #1a2332"}}>
<td style={{padding:"11px 14px",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#38bdf8"}}>{c.ruc}</td>
<td style={{padding:"11px 14px",fontSize:11,color:"#6b7280"}}>{c.rit||"nd"}</td>
<td style={{padding:"11px 14px",fontSize:11,color:"#9ca3af"}}>{c.tribunal}</td>
<td style={{padding:"11px 14px",fontSize:12}}><div style={{maxWidth:190,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#e2e8f0"}}>{c.imputado}</div></td>
<td style={{padding:"11px 14px",fontSize:11}}><div style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#9ca3af"}}>{c.delito||"nd"}</div></td>
<td style={{padding:"11px 14px",fontSize:11,color:c.fiscal?"#9ca3af":"#374151",fontStyle:c.fiscal?"normal":"italic"}}>{c.fiscal||"nd"}</td>
<td style={{padding:"11px 14px",fontSize:10}}><div style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#6b7280"}}>{c.plazo||"nd"}</div></td>
<td style={{padding:"11px 14px"}}><Bdg e={c.estado}/></td>
<td style={{padding:"11px 14px"}}><button className="btn" onClick={e=>{e.stopPropagation();open(c)}} style={{background:"rgba(14,165,233,0.1)",color:"#0ea5e9",border:"1px solid rgba(14,165,233,0.2)",borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:600}}>Ver</button></td>
</tr>)}</tbody>
</table>
{filt.length===0&&<div style={{textAlign:"center",padding:48,color:"#374151",fontSize:13}}>Sin resultados</div>}
</div>))}
</div>
{modal&&C&&<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&close()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20,backdropFilter:"blur(12px)"}}>
<div className="modal-box" style={{background:"#1a2332",borderRadius:18,width:"100%",maxWidth:820,maxHeight:"92vh",overflow:"hidden",border:"1px solid #1f2937",boxShadow:"0 32px 80px rgba(0,0,0,0.8)",display:"flex",flexDirection:"column"}}>
<div style={{background:"linear-gradient(135deg,#0f172a,#1a2332)",padding:"20px 26px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
<div><div style={{fontFamily:"JetBrains Mono,monospace",color:"#38bdf8",fontSize:18,fontWeight:700,marginBottom:4}}>RUC: {C.ruc}</div><div style={{fontSize:12,color:"#6b7280"}}>RIT: {C.rit||"nd"} · {C.tribunal}</div></div>
<div style={{display:"flex",alignItems:"center",gap:10}}><Bdg e={C.estado}/><button className="btn" onClick={close} style={{background:"#1f2937",border:"1px solid #374151",color:"#6b7280",borderRadius:8,width:32,height:32,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button></div>
</div>
<div style={{display:"flex",borderBottom:"1px solid #1f2937",background:"#111827",padding:"0 26px"}}>
{[["datos","Datos"],["notas","Notas"],["audiencias","Audiencias"],["carpeta","Carpeta"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className="btn" style={{padding:"12px 16px",fontSize:12,fontWeight:tab===k?700:400,color:tab===k?"#38bdf8":"#6b7280",borderBottom:"2px solid "+(tab===k?"#0ea5e9":"transparent"),marginBottom:-1,background:"none",border:"none",borderBottomWidth:2,borderBottomStyle:"solid",borderBottomColor:tab===k?"#0ea5e9":"transparent"}}>{l}</button>)}
</div>
<div style={{padding:"22px 26px",overflowY:"auto",flex:1}}>
{tab==="datos"&&<div className="fade"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label="Imputado" fk="imputado" full/><Inp label="Delito" fk="delito" full/><Inp label="Tribunal" fk="tribunal"/><Inp label="RIT" fk="rit"/><Inp label="Fiscal" fk="fiscal" ed/><Inp label="Cautelar" fk="cautelar" ed/><Inp label="Centro Penal" fk="centro_penal" ed/><Inp label="Plazo" fk="plazo" ed full/></div><div style={{marginTop:16}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:600}}>Estado Procesal</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(E).map(([k,v])=><button key={k} className="btn" onClick={()=>upd("estado",k)} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid "+(C.estado===k?v.c:v.c+"40"),background:C.estado===k?v.c+"20":"transparent",color:v.c}}>{v.l}</button>)}</div></div></div>}
{tab==="notas"&&<div className="fade">{notas.length===0&&<p style={{color:"#374151",fontSize:13,marginBottom:12}}>Sin notas.</p>}{notas.map(n=><div key={n.id} style={{background:"#111827",borderRadius:10,padding:"12px 14px",marginBottom:8,border:"1px solid #1f2937"}}><div style={{fontSize:10,color:"#6b7280",marginBottom:4,fontFamily:"JetBrains Mono"}}>{new Date(n.created_at).toLocaleString("es-CL")}</div><div style={{fontSize:13,color:"#d1d5db",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.contenido}</div></div>)}<div style={{marginTop:12}}><textarea style={{...inp,background:"#111827",minHeight:90,resize:"vertical"}} placeholder="Nueva nota..." value={nota} onChange={e=>setNota(e.target.value)}/><button className="btn" onClick={addNota} disabled={saving} style={{marginTop:8,background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700}}>{saving?"Guardando...":"+ Nota"}</button></div></div>}
{tab==="audiencias"&&<div className="fade">{auds.length===0&&!showAF&&<p style={{color:"#374151",fontSize:13,marginBottom:12}}>Sin audiencias.</p>}{auds.map(a=><div key={a.id} style={{background:"#111827",borderRadius:10,padding:"12px 14px",marginBottom:8,border:"1px solid #1f2937"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><strong style={{fontSize:13,color:"#e2e8f0"}}>{a.tipo||"Audiencia"}</strong><span style={{fontSize:10,color:"#6b7280",fontFamily:"JetBrains Mono"}}>{a.fecha}</span></div>{a.resultado&&<div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>{a.resultado}</div>}</div>)}{showAF&&<div style={{background:"#111827",padding:14,borderRadius:10,border:"1px solid #1f2937",marginBottom:10}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>{[["fecha","Fecha","date"],["tipo","Tipo","text"],["resultado","Resultado","text"],["notas","Notas","text"]].map(([k,l,t])=><div key={k}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4,fontWeight:600}}>{l}</div><input type={t} style={{...inp,background:"#0f172a"}} value={newAud[k]} onChange={e=>setNewAud(p=>({...p,[k]:e.target.value}))}/></div>)}</div><div style={{display:"flex",gap:6}}><button className="btn" onClick={addAud} disabled={saving} style={{background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button><button className="btn" onClick={()=>setShowAF(false)} style={{background:"#1f2937",color:"#6b7280",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12}}>Cancelar</button></div></div>}{!showAF&&<button className="btn" onClick={()=>setShowAF(true)} style={{background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:700}}>+ Audiencia</button>}</div>}
{tab==="carpeta"&&<div className="fade"><div style={{marginBottom:14}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:600}}>Referencia Fisica</div>{ef==="carpeta_ref"?<div style={{display:"flex",gap:6}}><input style={{...inp,flex:1,border:"1px solid #0ea5e9"}} value={ev} onChange={e=>setEv(e.target.value)} placeholder="Ej: Caja 3, Carpeta 12" autoFocus/><button className="btn" onClick={()=>upd("carpeta_ref",ev)} style={{background:"#0ea5e9",color:"#fff",border:"none",borderRadius:8,padding:"0 14px",fontWeight:700}}>ok</button><button className="btn" onClick={()=>setEf(null)} style={{background:"#1f2937",color:"#6b7280",border:"none",borderRadius:8,padding:"0 12px"}}>x</button></div>:<div onClick={()=>{setEf("carpeta_ref");setEv(C.carpeta_ref||"")}} style={{...inp,cursor:"pointer",display:"flex",justifyContent:"space-between",color:C.carpeta_ref?"#f1f5f9":"#374151",fontStyle:C.carpeta_ref?"normal":"italic"}}><span>{C.carpeta_ref||"Agregar..."}</span><span style={{color:"#374151"}}>e</span></div>}</div><div style={{background:"#111827",borderRadius:12,border:"1px dashed #1f2937",padding:36,textAlign:"center"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#0ea5e9"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1f2937"}><div style={{fontSize:36,marginBottom:10}}>F</div><div style={{fontSize:14,color:"#6b7280",marginBottom:4,fontWeight:600}}>Documentos digitalizados</div><div style={{fontSize:11,color:"#374151",marginBottom:14}}>Subida proxima</div><button className="btn" style={{background:"rgba(14,165,233,0.1)",color:"#0ea5e9",border:"1px solid rgba(14,165,233,0.2)",borderRadius:8,padding:"8px 18px",fontSize:12}}>Subir</button></div></div>}
</div>
</div>
</div>}
{showN&&<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowN(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20,backdropFilter:"blur(12px)"}}>
<div className="modal-box" style={{background:"#1a2332",borderRadius:18,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",border:"1px solid #1f2937",boxShadow:"0 32px 80px rgba(0,0,0,0.8)"}}>
<div style={{padding:"18px 22px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:15,fontWeight:700,color:"#f1f5f9"}}>Nueva Causa</div><button className="btn" onClick={()=>setShowN(false)} style={{background:"#1f2937",border:"none",color:"#6b7280",borderRadius:8,width:30,height:30,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button></div>
<div style={{padding:"18px 22px"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{k:"ruc",l:"RUC",p:"2600123456-7",full:true},{k:"rit",l:"RIT",p:"1234-2026"},{k:"tribunal",l:"Tribunal",p:"7 JG STGO"},{k:"imputado",l:"Imputado",p:"Nombre",full:true},{k:"delito",l:"Delito",p:"Tipo",full:true},{k:"fiscal",l:"Fiscal",p:"Nombre fiscal"},{k:"cautelar",l:"Cautelar",p:"Prision..."},{k:"plazo",l:"Plazo",p:"VENCE DD-MM",full:true}].map(f=><div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:600}}>{f.l}</div><input style={inp} placeholder={f.p} value={nC[f.k]} onChange={e=>setNC(p=>({...p,[f.k]:e.target.value}))}/></div>)}<div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:600}}>Estado</div><select style={{...inp,cursor:"pointer"}} value={nC.estado} onChange={e=>setNC(p=>({...p,estado:e.target.value}))}>{Object.entries(E).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div></div><div style={{display:"flex",gap:8,marginTop:16}}><button className="btn" onClick={addCausa} disabled={saving||!nC.ruc} style={{background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button><button className="btn" onClick={()=>setShowN(false)} style={{background:"#1f2937",color:"#6b7280",border:"none",borderRadius:9,padding:"10px 16px",fontSize:13}}>Cancelar</button></div></div>
</div>
</div>}
</div>
)
}
