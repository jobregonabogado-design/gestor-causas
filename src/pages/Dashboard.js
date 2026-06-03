import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { CAUSAS_SEED } from '../lib/seedData'

const E={vencido:{l:'VENCIDO',c:'#ef4444',bg:'rgba(239,68,68,0.1)',d:'#ef4444'},proximo:{l:'POR VENCER',c:'#f59e0b',bg:'rgba(245,158,11,0.1)',d:'#f59e0b'},apjo:{l:'APJO',c:'#a78bfa',bg:'rgba(167,139,250,0.1)',d:'#a78bfa'},suspendida:{l:'SUSPENDIDA',c:'#6b7280',bg:'rgba(107,114,128,0.1)',d:'#6b7280'},vigente:{l:'VIGENTE',c:'#34d399',bg:'rgba(52,211,153,0.1)',d:'#34d399'}}
const css=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#080810;color:#e2e8f0;-webkit-font-smoothing:antialiased}
input,select,textarea,button{font-family:'Inter',sans-serif}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase}
.row{transition:background 0.1s;cursor:pointer}
.row:hover{background:rgba(99,102,241,0.07)!important}
.stat{transition:all 0.15s;cursor:pointer}
.stat:hover{transform:translateY(-2px)}
.btn{transition:all 0.12s;cursor:pointer}
.btn:hover{opacity:0.88;transform:translateY(-1px)}
.btn:active{transform:scale(0.97)}
.modal-bg{animation:fi 0.18s ease}
.modal-box{animation:su 0.22s cubic-bezier(0.16,1,0.3,1)}
.fade{animation:fi 0.2s ease}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes su{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
`

export default function Dashboard({session}){
const [causas,setCausas]=useState([])
const [loading,setLoading]=useState(true)
const [seeding,setSeeding]=useState(false)
const [search,setSearch]=useState('')
const [ft,setFt]=useState('')
const [fe,setFe]=useState('')
const [modal,setModal]=useState(null)
const [tab,setTab]=useState('datos')
const [ef,setEf]=useState(null)
const [ev,setEv]=useState('')
const [nota,setNota]=useState('')
const [notas,setNotas]=useState([])
const [auds,setAuds]=useState([])
const [showAF,setShowAF]=useState(false)
const [newAud,setNewAud]=useState({fecha:'',tipo:'',resultado:'',notas:''})
const [saving,setSaving]=useState(false)
const [showN,setShowN]=useState(false)
const [nC,setNC]=useState({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',estado:'vigente'})
useEffect(()=>{load()},[])
const load=async()=>{setLoading(true);const{data}=await supabase.from('causas').select('*').order('created_at',{ascending:false});setCausas(data||[]);setLoading(false)}
const seed=async()=>{setSeeding(true);const ch=[];for(let i=0;i<CAUSAS_SEED.length;i+=50)ch.push(CAUSAS_SEED.slice(i,i+50));for(const c of ch)await supabase.from('causas').insert(c.map(x=>({ruc:x.ruc,rit:x.rit,tribunal:x.tribunal,delito:x.delito,imputado:x.imputado,fiscal:'',cautelar:'',centro_penal:'',plazo:x.plazo,estado:x.estado,carpeta_ref:''})));await load();setSeeding(false)}
const open=async(c)=>{setModal(c);setTab('datos');const[{data:n},{data:a}]=await Promise.all([supabase.from('notas').select('*').eq('causa_id',c.id).order('created_at',{ascending:false}),supabase.from('audiencias').select('*').eq('causa_id',c.id).order('fecha',{ascending:false})]);setNotas(n||[]);setAuds(a||[])}
const close=()=>{setModal(null);setEf(null)}
const upd=async(f,v)=>{setSaving(true);await supabase.from('causas').update({[f]:v,updated_at:new Date()}).eq('id',modal.id);const u={...modal,[f]:v};setModal(u);setCausas(p=>p.map(c=>c.id===u.id?u:c));setEf(null);setSaving(false)}
const addNota=async()=>{if(!nota.trim())return;setSaving(true);const{data}=await supabase.from('notas').insert({causa_id:modal.id,contenido:nota}).select().single();if(data)setNotas(p=>[data,...p]);setNota('');setSaving(false)}
const addAud=async()=>{if(!newAud.fecha)return;setSaving(true);const{data}=await supabase.from('audiencias').insert({causa_id:modal.id,...newAud}).select().single();if(data)setAuds(p=>[data,...p]);setNewAud({fecha:'',tipo:'',resultado:'',notas:''});setShowAF(false);setSaving(false)}
const addCausa=async()=>{if(!nC.ruc)return;setSaving(true);const{data}=await supabase.from('causas').insert(nC).select().single();if(data){setCausas(p=>[data,...p]);setShowN(false);setNC({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',estado:'vigente'})};setSaving(false)}
const out=()=>supabase.auth.signOut()
const tribs=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
const filt=useMemo(()=>causas.filter(c=>{const s=search.toLowerCase();const m=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v?.toLowerCase().includes(s));return m&&(!ft||c.tribunal===ft)&&(!fe||c.estado===fe)}),[causas,search,ft,fe])
const st=useMemo(()=>({tot:causas.length,vig:causas.filter(c=>c.estado==='vigente').length,ven:causas.filter(c=>c.estado==='vencido').length,prx:causas.filter(c=>c.estado==='proximo').length,apj:causas.filter(c=>c.estado==='apjo').length}),[causas])
const C=modal?causas.find(x=>x.id===modal.id)||modal:null
const Bdg=({e})=>{const cfg=E[e]||E.vigente;return(<span className="badge" style={{background:cfg.bg,color:cfg.c,border:'1px solid '+cfg.c+'30'}}><span style={{width:5,height:5,borderRadius:'50%',background:cfg.d,display:'inline-block'}}/>{cfg.l}</span>)}
const Inp=({label,fk,ed,full})=>{const val=C?C[fk]:null;return(<div style={{gridColumn:full?'1/-1':'auto'}}><div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:5,fontWeight:500}}>{label}</div>{ef===fk?(<div style={{display:'flex',gap:6}}><input style={{flex:1,padding:'8px 12px',background:'#0f172a',border:'1px solid #6366f1',borderRadius:8,fontSize:13,color:'#e2e8f0',outline:'none'}} value={ev} onChange={e=>setEv(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')upd(fk,ev);if(e.key==='Escape')setEf(null)}} autoFocus/><button className="btn" onClick={()=>upd(fk,ev)} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:8,padding:'0 14px',fontWeight:600}}>v</button><button className="btn" onClick={()=>setEf(null)} style={{background:'#1e293b',color:'#64748b',border:'1px solid #334155',borderRadius:8,padding:'0 12px'}}>x</button></div>):(<div onClick={()=>{if(ed){setEf(fk);setEv(val||'')}}} style={{padding:'9px 12px',background:'#0d0d18',borderRadius:8,border:'1px solid #1e293b',fontSize:13,color:val?'#e2e8f0':'#334155',fontStyle:val?'normal':'italic',cursor:ed?'pointer':'default',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'border-color 0.15s'}} onMouseEnter={e=>{if(ed)e.currentTarget.style.borderColor='#334155'}} onMouseLeave={e=>{if(ed)e.currentTarget.style.borderColor='#1e293b'}}><span>{val||(ed?'Agregar...':'sin datos')}</span>{ed&&<span style={{color:'#334155',fontSize:11}}>e</span>}</div>)}</div>)}
const inp={padding:'9px 12px',background:'#0d0d18',border:'1px solid #1e293b',borderRadius:9,fontSize:13,color:'#e2e8f0',outline:'none',width:'100%',transition:'border-color 0.15s',boxSizing:'border-box'}
return(
<div style={{fontFamily:'Inter,sans-serif',background:'#080810',minHeight:'100vh',color:'#e2e8f0'}}>
<style>{css}</style>
<div style={{background:'rgba(13,13,24,0.95)',borderBottom:'1px solid #111827',padding:'0 28px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50,backdropFilter:'blur(16px)'}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<div style={{width:32,height:32,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:'0 0 20px rgba(99,102,241,0.4)'}}>+</div>
<div><div style={{fontSize:14,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.3px'}}>LexOffice</div><div style={{fontSize:9,color:'#334155',letterSpacing:1.5,textTransform:'uppercase'}}>Gestión Penal</div></div>
</div>
<div style={{display:'flex',alignItems:'center',gap:16}}>
{saving&&<span style={{color:'#6366f1',fontSize:11}}>Guardando...</span>}
<span style={{fontSize:11,color:'#334155'}}>{session.user.email}</span>
<button className="btn" onClick={out} style={{background:'transparent',border:'1px solid #1e293b',color:'#475569',borderRadius:6,padding:'4px 12px',fontSize:11}}>Salir</button>
</div>
</div>
<div style={{padding:'24px 28px',maxWidth:1440,margin:'0 auto'}}>
{st.ven>0&&<div className="fade" style={{background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.15)',borderLeft:'3px solid #ef4444',borderRadius:10,padding:'12px 18px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}><span style={{color:'#ef4444',fontSize:16}}>!</span><div><div style={{fontWeight:600,color:'#ef4444',fontSize:13}}>{st.ven} causa{st.ven>1?'s':''} con plazo VENCIDO</div><div style={{color:'#475569',fontSize:11,marginTop:1}}>Atención inmediata requerida</div></div></div>}
{causas.length===0&&!loading&&<div className="fade" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))',border:'1px solid rgba(99,102,241,0.2)',borderRadius:14,padding:'24px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{fontSize:16,fontWeight:700,color:'#f1f5f9',marginBottom:4}}>Base de datos vacía</div><div style={{fontSize:13,color:'#475569'}}>Importa tus {CAUSAS_SEED.length} causas con un clic</div></div><button className="btn" onClick={seed} disabled={seeding} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:600}}>{seeding?'Importando...':'Importar causas'}</button></div>}
<div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
{[{k:'',l:'Total',n:st.tot,c:'#6366f1'},{k:'vigente',l:'Vigentes',n:st.vig,c:'#34d399'},{k:'vencido',l:'Vencidos',n:st.ven,c:'#ef4444'},{k:'proximo',l:'Por vencer',n:st.prx,c:'#f59e0b'},{k:'apjo',l:'APJO',n:st.apj,c:'#a78bfa'}].map(s=>{const act=fe===s.k&&s.k!=='';return(<div key={s.k} className="stat" onClick={()=>setFe(fe===s.k?'':s.k)} style={{background:act?s.c+'15':'#0d0d18',border:'1px solid '+(act?s.c:'#1e293b'),borderRadius:12,padding:'14px 20px',minWidth:108,boxShadow:act?'0 0 20px '+s.c+'20':'none'}}><div style={{fontSize:28,fontWeight:700,color:s.c,fontFamily:'JetBrains Mono,monospace',lineHeight:1}}>{s.n}</div><div style={{fontSize:10,color:'#334155',marginTop:5,textTransform:'uppercase',letterSpacing:0.8,fontWeight:500}}>{s.l}</div></div>)})}
</div>
<div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
<div style={{flex:1,minWidth:240,position:'relative'}}><span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#334155',fontSize:13,pointerEvents:'none'}}>S</span><input style={{...inp,paddingLeft:32}} placeholder="Buscar RUC, RIT, imputado, delito, tribunal..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#1e293b'}/></div>
<select style={{...inp,width:'auto',cursor:'pointer'}} value={ft} onChange={e=>setFt(e.target.value)}><option value=''>Todos los tribunales</option>{tribs.map(t=><option key={t} value={t}>{t}</option>)}</select>
<select style={{...inp,width:'auto',cursor:'pointer'}} value={fe} onChange={e=>setFe(e.target.value)}><option value=''>Todos los estados</option>{Object.entries(E).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select>
<span style={{fontSize:11,color:'#334155'}}>{filt.length} resultados</span>
<button className="btn" onClick={()=>setShowN(true)} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:9,padding:'9px 18px',fontSize:12,fontWeight:600,boxShadow:'0 4px 14px rgba(99,102,241,0.3)'}}>+ Nueva</button>
</div>
{loading?<div className="fade" style={{textAlign:'center',padding:80,color:'#334155'}}><div style={{fontSize:22,marginBottom:8}}>Cargando...</div></div>:(
<div style={{background:'#0d0d18',borderRadius:12,border:'1px solid #111827',overflow:'hidden'}}>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr style={{borderBottom:'1px solid #111827'}}>{['RUC','RIT','Tribunal','Imputado','Delito','Fiscal','Plazo','Estado',''].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,fontWeight:600,color:'#334155',letterSpacing:1,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
<tbody>{filt.map((c,i)=><tr key={c.id} className="row" onClick={()=>open(c)} style={{borderBottom:'1px solid #0d0d18',background:i%2===0?'#0d0d18':'#0a0a14'}}>
<td style={{padding:'10px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:11,fontWeight:600,color:'#818cf8'}}>{c.ruc}</td>
<td style={{padding:'10px 14px',fontSize:11,color:'#475569'}}>{c.rit||'nd'}</td>
<td style={{padding:'10px 14px',fontSize:11,color:'#64748b'}}>{c.tribunal}</td>
<td style={{padding:'10px 14px',fontSize:12}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#cbd5e1'}}>{c.imputado}</div></td>
<td style={{padding:'10px 14px',fontSize:11}}><div style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#64748b'}}>{c.delito||'nd'}</div></td>
<td style={{padding:'10px 14px',fontSize:11,color:c.fiscal?'#64748b':'#1e293b',fontStyle:c.fiscal?'normal':'italic'}}>{c.fiscal||'nd'}</td>
<td style={{padding:'10px 14px',fontSize:10}}><div style={{maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#475569'}}>{c.plazo||'nd'}</div></td>
<td style={{padding:'10px 14px'}}><Bdg e={c.estado}/></td>
<td style={{padding:'10px 14px'}}><button className="btn" onClick={e=>{e.stopPropagation();open(c)}} style={{background:'rgba(99,102,241,0.08)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.15)',borderRadius:6,padding:'4px 12px',fontSize:11,fontWeight:500}}>Ver</button></td>
</tr>)}</tbody>
</table>
{filt.length===0&&<div style={{textAlign:'center',padding:40,color:'#334155',fontSize:13}}>Sin resultados</div>}
</div>)}
</div>
{modal&&C&&<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&close()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20,backdropFilter:'blur(16px)'}}>
<div className="modal-box" style={{background:'#0d0d18',borderRadius:18,width:'100%',maxWidth:820,maxHeight:'92vh',overflow:'hidden',border:'1px solid #1e293b',boxShadow:'0 32px 80px rgba(0,0,0,0.9)',display:'flex',flexDirection:'column'}}>
<div style={{background:'linear-gradient(135deg,#0a0a14,#0f0f24)',padding:'20px 26px',borderBottom:'1px solid #111827',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div><div style={{fontFamily:'JetBrains Mono,monospace',color:'#818cf8',fontSize:17,fontWeight:600,marginBottom:4}}>RUC: {C.ruc}</div><div style={{fontSize:12,color:'#334155'}}>RIT: {C.rit||'nd'} · {C.tribunal}</div></div>
<div style={{display:'flex',alignItems:'center',gap:10}}><Bdg e={C.estado}/><button className="btn" onClick={close} style={{background:'#111827',border:'1px solid #1e293b',color:'#475569',borderRadius:8,width:32,height:32,fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>x</button></div>
</div>
<div style={{display:'flex',borderBottom:'1px solid #111827',padding:'0 26px',background:'#0a0a12'}}>
{[['datos','Datos'],['notas','Notas'],['audiencias','Audiencias'],['carpeta','Carpeta']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className="btn" style={{padding:'12px 16px',fontSize:12,fontWeight:tab===k?600:400,color:tab===k?'#818cf8':'#334155',borderBottom:'2px solid '+(tab===k?'#6366f1':'transparent'),marginBottom:-1,background:'none',border:'none',borderBottomWidth:2,borderBottomStyle:'solid',borderBottomColor:tab===k?'#6366f1':'transparent'}}>{l}</button>)}
</div>
<div style={{padding:'20px 26px',overflowY:'auto',flex:1}}>
{tab==='datos'&&<div className="fade"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Inp label="Imputado" fk="imputado" full/><Inp label="Delito" fk="delito" full/><Inp label="Tribunal" fk="tribunal"/><Inp label="RIT" fk="rit"/><Inp label="Fiscal" fk="fiscal" ed/><Inp label="Cautelar" fk="cautelar" ed/><Inp label="Centro Penal" fk="centro_penal" ed/><Inp label="Plazo" fk="plazo" ed full/></div><div style={{marginTop:16}}><div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:500}}>Estado Procesal</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{Object.entries(E).map(([k,v])=><button key={k} className="btn" onClick={()=>upd('estado',k)} style={{padding:'5px 14px',borderRadius:20,fontSize:11,fontWeight:600,border:'1px solid '+(C.estado===k?v.c:v.c+'30'),background:C.estado===k?v.c+'18':'transparent',color:v.c}}>{v.l}</button>)}</div></div></div>}
{tab==='notas'&&<div className="fade">{notas.length===0&&<p style={{color:'#334155',fontSize:13,marginBottom:12}}>Sin notas.</p>}{notas.map(n=><div key={n.id} style={{background:'#0a0a14',borderRadius:10,padding:'12px 14px',marginBottom:8,border:'1px solid #111827'}}><div style={{fontSize:10,color:'#334155',marginBottom:4,fontFamily:'JetBrains Mono'}}>{new Date(n.created_at).toLocaleString('es-CL')}</div><div style={{fontSize:13,color:'#94a3b8',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{n.contenido}</div></div>)}<div style={{marginTop:12}}><textarea style={{width:'100%',padding:12,fontSize:13,background:'#0a0a14',border:'1px solid #111827',borderRadius:10,color:'#e2e8f0',minHeight:90,resize:'vertical',outline:'none',boxSizing:'border-box'}} placeholder="Nueva nota..." value={nota} onChange={e=>setNota(e.target.value)} onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#111827'}/><button className="btn" onClick={addNota} disabled={saving} style={{marginTop:8,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:12,fontWeight:600}}>{saving?'Guardando...':'+ Nota'}</button></div></div>}
{tab==='audiencias'&&<div className="fade">{auds.length===0&&!showAF&&<p style={{color:'#334155',fontSize:13,marginBottom:12}}>Sin audiencias.</p>}{auds.map(a=><div key={a.id} style={{background:'#0a0a14',borderRadius:10,padding:'12px 14px',marginBottom:8,border:'1px solid #111827'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><strong style={{fontSize:13,color:'#cbd5e1'}}>{a.tipo||'Audiencia'}</strong><span style={{fontSize:10,color:'#334155',fontFamily:'JetBrains Mono'}}>{a.fecha}</span></div>{a.resultado&&<div style={{fontSize:12,color:'#64748b',marginTop:3}}>{a.resultado}</div>}</div>)}{showAF&&<div style={{background:'#0a0a14',padding:14,borderRadius:10,border:'1px solid #111827',marginBottom:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>{[['fecha','Fecha','date'],['tipo','Tipo','text'],['resultado','Resultado','text'],['notas','Notas','text']].map(([k,l,t])=><div key={k}><div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:0.8,marginBottom:4}}>{l}</div><input type={t} style={{width:'100%',padding:'8px 10px',background:'#080810',border:'1px solid #1e293b',borderRadius:7,fontSize:12,color:'#e2e8f0',outline:'none',boxSizing:'border-box'}} value={newAud[k]} onChange={e=>setNewAud(p=>({...p,[k]:e.target.value}))}/></div>)}</div><div style={{display:'flex',gap:6}}><button className="btn" onClick={addAud} disabled={saving} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:7,padding:'7px 16px',fontSize:12,fontWeight:600}}>Guardar</button><button className="btn" onClick={()=>setShowAF(false)} style={{background:'#111827',color:'#475569',border:'none',borderRadius:7,padding:'7px 14px',fontSize:12}}>Cancelar</button></div></div>}{!showAF&&<button className="btn" onClick={()=>setShowAF(true)} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:12,fontWeight:600}}>+ Audiencia</button>}</div>}
{tab==='carpeta'&&<div className="fade"><div style={{marginBottom:14}}><div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Ref. fisica</div>{ef==='carpeta_ref'?<div style={{display:'flex',gap:6}}><input style={{flex:1,padding:'8px 12px',background:'#0a0a14',border:'1px solid #6366f1',borderRadius:8,fontSize:12,color:'#e2e8f0',outline:'none'}} value={ev} onChange={e=>setEv(e.target.value)} placeholder="Ej: Caja 3, Carpeta 12" autoFocus/><button className="btn" onClick={()=>upd('carpeta_ref',ev)} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:8,padding:'0 14px'}}>ok</button><button className="btn" onClick={()=>setEf(null)} style={{background:'#111827',color:'#475569',border:'none',borderRadius:8,padding:'0 12px'}}>x</button></div>:<div onClick={()=>{setEf('carpeta_ref');setEv(C.carpeta_ref||'')}} style={{padding:'8px 12px',background:'#0a0a14',borderRadius:8,border:'1px solid #111827',fontSize:12,color:C.carpeta_ref?'#94a3b8':'#1e293b',fontStyle:C.carpeta_ref?'normal':'italic',cursor:'pointer',display:'flex',justifyContent:'space-between'}}><span>{C.carpeta_ref||'Agregar...'}</span><span style={{color:'#1e293b'}}>e</span></div>}</div><div style={{background:'#0a0a14',borderRadius:12,border:'1px dashed #1e293b',padding:36,textAlign:'center'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#6366f1'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1e293b'}><div style={{fontSize:36,marginBottom:10}}>F</div><div style={{fontSize:14,color:'#334155',marginBottom:4,fontWeight:500}}>Documentos</div><div style={{fontSize:11,color:'#1e293b',marginBottom:14}}>Subida proxima</div><button className="btn" style={{background:'rgba(99,102,241,0.08)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.15)',borderRadius:8,padding:'7px 16px',fontSize:11}}>Subir</button></div></div>}
</div>
</div>
</div>}
{showN&&<div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowN(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20,backdropFilter:'blur(16px)'}}>
<div className="modal-box" style={{background:'#0d0d18',borderRadius:18,width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto',border:'1px solid #1e293b',boxShadow:'0 32px 80px rgba(0,0,0,0.9)'}}>
<div style={{padding:'18px 22px',borderBottom:'1px solid #111827',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:15,fontWeight:700,color:'#f1f5f9'}}>Nueva Causa</div><button className="btn" onClick={()=>setShowN(false)} style={{background:'#111827',border:'none',color:'#475569',borderRadius:8,width:30,height:30,fontSize:17,display:'flex',alignItems:'center',justifyContent:'center'}}>x</button></div>
<div style={{padding:'18px 22px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{[{k:'ruc',l:'RUC',p:'2600123456-7',full:true},{k:'rit',l:'RIT',p:'1234-2026'},{k:'tribunal',l:'Tribunal',p:'7 JG STGO'},{k:'imputado',l:'Imputado',p:'Nombre',full:true},{k:'delito',l:'Delito',p:'Tipo',full:true},{k:'fiscal',l:'Fiscal',p:'Nombre fiscal'},{k:'cautelar',l:'Cautelar',p:'Prision...'},{k:'plazo',l:'Plazo',p:'VENCE DD-MM',full:true}].map(f=><div key={f.k} style={{gridColumn:f.full?'1/-1':'auto'}}><div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{f.l}</div><input style={{...inp,padding:'8px 11px'}} placeholder={f.p} value={nC[f.k]} onChange={e=>setNC(p=>({...p,[f.k]:e.target.value}))}/></div>)}<div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Estado</div><select style={{...inp,cursor:'pointer'}} value={nC.estado} onChange={e=>setNC(p=>({...p,estado:e.target.value}))}>{Object.entries(E).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div></div><div style={{display:'flex',gap:8,marginTop:16}}><button className="btn" onClick={addCausa} disabled={saving||!nC.ruc} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',borderRadius:9,padding:'10px 20px',fontSize:13,fontWeight:600}}>Guardar</button><button className="btn" onClick={()=>setShowN(false)} style={{background:'#111827',color:'#475569',border:'none',borderRadius:9,padding:'10px 16px',fontSize:13}}>Cancelar</button></div></div>
</div>
</div>}
</div>
)
}
