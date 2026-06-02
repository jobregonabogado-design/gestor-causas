import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { CAUSAS_SEED } from '../lib/seedData'
const estadoConfig = {
  vencido:{label:'VENCIDO',color:'#ef4444',bg:'#fef2f2'},
  proximo:{label:'POR VENCER',color:'#f59e0b',bg:'#fffbeb'},
  apjo:{label:'APJO',color:'#8b5cf6',bg:'#f5f3ff'},
  suspendida:{label:'SUSPENDIDA',color:'#6b7280',bg:'#f9fafb'},
  vigente:{label:'VIGENTE',color:'#10b981',bg:'#f0fdf4'},
}
export default function Dashboard({session}){
  const [causas,setCausas]=useState([])
  const [loading,setLoading]=useState(true)
  const [seeding,setSeeding]=useState(false)
  const [search,setSearch]=useState('')
  const [filterTribunal,setFilterTribunal]=useState('')
  const [filterEstado,setFilterEstado]=useState('')
  const [view,setView]=useState('list')
  const [selectedCausa,setSelectedCausa]=useState(null)
  const [activeTab,setActiveTab]=useState('datos')
  const [editField,setEditField]=useState(null)
  const [editValue,setEditValue]=useState('')
  const [nuevaNota,setNuevaNota]=useState('')
  const [notas,setNotas]=useState([])
  const [audiencias,setAudiencias]=useState([])
  const [showAudForm,setShowAudForm]=useState(false)
  const [nuevaAud,setNuevaAud]=useState({fecha:'',tipo:'',resultado:'',notas:''})
  const [saving,setSaving]=useState(false)
  const [showNuevaCausa,setShowNuevaCausa]=useState(false)
  const [nuevaCausa,setNuevaCausa]=useState({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',estado:'vigente'})
  useEffect(()=>{loadCausas()},[])
  const loadCausas=async()=>{
    setLoading(true)
    const{data,error}=await supabase.from('causas').select('*').order('created_at',{ascending:false})
    if(!error)setCausas(data||[])
    setLoading(false)
  }
  const seedDatabase=async()=>{
    setSeeding(true)
    const chunks=[]
    for(let i=0;i<CAUSAS_SEED.length;i+=50)chunks.push(CAUSAS_SEED.slice(i,i+50))
    for(const chunk of chunks){
      await supabase.from('causas').insert(chunk.map(c=>({ruc:c.ruc,rit:c.rit,tribunal:c.tribunal,delito:c.delito,imputado:c.imputado,fiscal:'',cautelar:'',centro_penal:'',plazo:c.plazo,estado:c.estado,carpeta_ref:''})))
    }
    await loadCausas()
    setSeeding(false)
  }
  const openCausa=async(c)=>{
    setSelectedCausa(c);setView('detail');setActiveTab('datos')
    const[{data:n},{data:a}]=await Promise.all([
      supabase.from('notas').select('*').eq('causa_id',c.id).order('created_at',{ascending:false}),
      supabase.from('audiencias').select('*').eq('causa_id',c.id).order('fecha',{ascending:false})
    ])
    setNotas(n||[]);setAudiencias(a||[])
  }
  const updateField=async(field,value)=>{
    setSaving(true)
    const{error}=await supabase.from('causas').update({[field]:value,updated_at:new Date()}).eq('id',selectedCausa.id)
    if(!error){const updated={...selectedCausa,[field]:value};setSelectedCausa(updated);setCausas(prev=>prev.map(c=>c.id===updated.id?updated:c))}
    setEditField(null);setSaving(false)
  }
  const saveNota=async()=>{
    if(!nuevaNota.trim())return;setSaving(true)
    const{data,error}=await supabase.from('notas').insert({causa_id:selectedCausa.id,contenido:nuevaNota}).select().single()
    if(!error)setNotas(prev=>[data,...prev])
    setNuevaNota('');setSaving(false)
  }
  const saveAudiencia=async()=>{
    if(!nuevaAud.fecha)return;setSaving(true)
    const{data,error}=await supabase.from('audiencias').insert({causa_id:selectedCausa.id,...nuevaAud}).select().single()
    if(!error)setAudiencias(prev=>[data,...prev])
    setNuevaAud({fecha:'',tipo:'',resultado:'',notas:''});setShowAudForm(false);setSaving(false)
  }
  const saveCausa=async()=>{
    if(!nuevaCausa.ruc)return;setSaving(true)
    const{data,error}=await supabase.from('causas').insert(nuevaCausa).select().single()
    if(!error){setCausas(prev=>[data,...prev]);setShowNuevaCausa(false);setNuevaCausa({ruc:'',rit:'',tribunal:'',delito:'',imputado:'',fiscal:'',cautelar:'',centro_penal:'',plazo:'',estado:'vigente'})}
    setSaving(false)
  }
  const signOut=()=>supabase.auth.signOut()
  const tribunales=useMemo(()=>[...new Set(causas.map(c=>c.tribunal).filter(Boolean))].sort(),[causas])
  const filtered=useMemo(()=>causas.filter(c=>{
    const s=search.toLowerCase()
    const match=!s||[c.ruc,c.rit,c.imputado,c.delito,c.tribunal,c.fiscal].some(v=>v?.toLowerCase().includes(s))
    return match&&(!filterTribunal||c.tribunal===filterTribunal)&&(!filterEstado||c.estado===filterEstado)
  }),[causas,search,filterTribunal,filterEstado])
  const stats=useMemo(()=>({
    total:causas.length,
    vencido:causas.filter(c=>c.estado==='vencido').length,
    proximo:causas.filter(c=>c.estado==='proximo').length,
    apjo:causas.filter(c=>c.estado==='apjo').length,
    vigente:causas.filter(c=>c.estado==='vigente').length,
  }),[causas])
  const f={fontFamily:'Georgia,serif'}
  const badge=(estado)=>({display:'inline-block',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:'bold',color:estadoConfig[estado]?.color||'#666',background:estadoConfig[estado]?.bg||'#f9fafb',border:`1px solid ${estadoConfig[estado]?.color||'#ccc'}`})
  const btnP={background:'#1a1a2e',color:'#d4af37',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,cursor:'pointer',fontWeight:'bold',...f}
  const btnS={background:'#fff',color:'#1a1a2e',border:'1.5px solid #1a1a2e',borderRadius:8,padding:'8px 16px',fontSize:13,cursor:'pointer',...f}
  const fLabel={fontSize:11,color:'#6b7280',textTransform:'uppercase',letterSpacing:0.5,marginBottom:4,display:'block'}
  const fValue={fontSize:14,color:'#1a1a2e',padding:'8px 12px',background:'#f8f7f4',borderRadius:8,border:'1px solid #e2e8f0',minHeight:36,display:'flex',alignItems:'center'}
  const fInput={fontSize:14,padding:'8px 12px',background:'#fff',borderRadius:8,border:'1.5px solid #d4af37',width:'100%',...f,outline:'none',boxSizing:'border-box'}
  const iSmall={padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,...f,width:'100%',boxSizing:'border-box'}
  if(view==='detail'&&selectedCausa){
    const c=causas.find(x=>x.id===selectedCausa.id)||selectedCausa
    return(
      <div style={{...f,background:'#f8f7f4',minHeight:'100vh'}}>
        <div style={{background:'#1a1a2e',color:'#fff',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
          <span style={{fontSize:17,fontWeight:'bold',color:'#d4af37'}}>⚖ GESTOR DE CAUSAS PENALES</span>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            {saving&&<span style={{color:'#d4af37',fontSize:12}}>Guardando...</span>}
            <button style={{...btnS,color:'#d4af37',borderColor:'#d4af37',fontSize:12}} onClick={signOut}>Salir</button>
          </div>
        </div>
        <div style={{padding:'20px 24px',maxWidth:1100,margin:'0 auto'}}>
          <div style={{cursor:'pointer',marginBottom:16,fontSize:14}} onClick={()=>setView('list')}>← Volver al listado</div>
          <div style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 12px rgba(0,0,0,0.08)',overflow:'hidden'}}>
            <div style={{background:'#1a1a2e',padding:'20px 24px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:20,fontWeight:'bold',color:'#d4af37',marginBottom:4}}>RUC: {c.ruc}</div>
                  <div style={{fontSize:13,color:'#a0aec0'}}>RIT: {c.rit||'—'} | {c.tribunal}</div>
                </div>
                <span style={badge(c.estado)}>{estadoConfig[c.estado]?.label}</span>
              </div>
            </div>
            <div style={{display:'flex',borderBottom:'2px solid #f1f5f9',padding:'0 24px',background:'#fafafa'}}>
              {[['datos','📋 Datos'],['notas','📝 Notas'],['audiencias','📅 Audiencias'],['carpeta','📁 Carpeta']].map(([k,l])=>(
                <button key={k} onClick={()=>setActiveTab(k)} style={{padding:'12px 18px',cursor:'pointer',fontSize:13,fontWeight:activeTab===k?'bold':'normal',color:activeTab===k?'#1a1a2e':'#6b7280',borderBottom:`2px solid ${activeTab===k?'#d4af37':'transparent'}`,marginBottom:-2,background:'none',border:'none',borderBottomWidth:2,borderBottomStyle:'solid',borderBottomColor:activeTab===k?'#d4af37':'transparent',...f}}>{l}</button>
              ))}
            </div>
            <div style={{padding:24}}>
              {activeTab==='datos'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    {[{key:'imputado',label:'Imputado(s)',full:true},{key:'delito',label:'Delito',full:true},{key:'tribunal',label:'Tribunal'},{key:'rit',label:'RIT'},{key:'fiscal',label:'Fiscal',editable:true},{key:'cautelar',label:'Cautelar Procesal',editable:true},{key:'centro_penal',label:'Centro Penal',editable:true},{key:'plazo',label:'Plazo',editable:true,full:true}].map(field=>(
                      <div key={field.key} style={{marginBottom:4,gridColumn:field.full?'1 / -1':'auto'}}>
                        <span style={fLabel}>{field.label}</span>
                        {editField===field.key?(
                          <div style={{display:'flex',gap:8}}>
                            <input style={fInput} value={editValue} onChange={e=>setEditValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')updateField(field.key,editValue);if(e.key==='Escape')setEditField(null)}} autoFocus/>
                            <button style={btnP} onClick={()=>updateField(field.key,editValue)}>✓</button>
                            <button style={btnS} onClick={()=>setEditField(null)}>✗</button>
                          </div>
                        ):(
                          <div style={{...fValue,cursor:field.editable?'pointer':'default'}} onClick={()=>{if(field.editable){setEditField(field.key);setEditValue(c[field.key]||'')}}}>
                            {c[field.key]||(field.editable?<span style={{color:'#aaa',fontStyle:'italic'}}>Clic para agregar...</span>:'—')}
                            {field.editable&&<span style={{marginLeft:'auto',fontSize:11,color:'#aaa',paddingLeft:8}}>✏️</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:20}}>
                    <span style={fLabel}>Estado Procesal</span>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
                      {Object.entries(estadoConfig).map(([k,v])=>(
                        <button key={k} onClick={()=>updateField('estado',k)} style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',fontWeight:'bold',border:`2px solid ${v.color}`,background:c.estado===k?v.color:'#fff',color:c.estado===k?'#fff':v.color,...f}}>{v.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab==='notas'&&(
                <div>
                  <p style={{fontSize:13,color:'#6b7280',marginBottom:14}}>Block de notas de la causa.</p>
                  {notas.map(n=>(
                    <div key={n.id} style={{background:'#f8f7f4',borderRadius:8,padding:'12px 16px',marginBottom:10,border:'1px solid #e2e8f0'}}>
                      <div style={{fontSize:11,color:'#9ca3af',marginBottom:6}}>{new Date(n.created_at).toLocaleString('es-CL')}</div>
                      <div style={{fontSize:14,whiteSpace:'pre-wrap',lineHeight:1.6}}>{n.contenido}</div>
                    </div>
                  ))}
                  {notas.length===0&&<p style={{color:'#9ca3af',fontSize:13,marginBottom:14}}>Sin notas aún.</p>}
                  <textarea style={{width:'100%',padding:12,fontSize:14,border:'1.5px solid #e2e8f0',borderRadius:8,...f,minHeight:100,resize:'vertical',background:'#fff',boxSizing:'border-box'}} placeholder="Escribir nueva nota..." value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}/>
                  <button style={{...btnP,marginTop:8}} onClick={saveNota} disabled={saving}>{saving?'Guardando...':'+ Agregar nota'}</button>
                </div>
              )}
              {activeTab==='audiencias'&&(
                <div>
                  {audiencias.map(a=>(
                    <div key={a.id} style={{background:'#f8f7f4',borderRadius:8,padding:'12px 16px',marginBottom:10,border:'1px solid #e2e8f0'}}>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <strong style={{fontSize:14}}>{a.tipo||'Audiencia'}</strong>
                        <span style={{fontSize:13,color:'#6b7280'}}>{a.fecha}</span>
                      </div>
                      {a.resultado&&<div style={{fontSize:13,marginTop:4}}>Resultado: {a.resultado}</div>}
                      {a.notas&&<div style={{fontSize:12,marginTop:4,color:'#6b7280'}}>{a.notas}</div>}
                    </div>
                  ))}
                  {audiencias.length===0&&!showAudForm&&<p style={{color:'#9ca3af',fontSize:13,marginBottom:14}}>Sin audiencias registradas.</p>}
                  {showAudForm&&(
                    <div style={{background:'#f8f7f4',padding:16,borderRadius:10,border:'1px solid #e2e8f0',marginBottom:14}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                        <div><span style={fLabel}>Fecha</span><input type="date" style={iSmall} value={nuevaAud.fecha} onChange={e=>setNuevaAud(p=>({...p,fecha:e.target.value}))}/></div>
                        <div><span style={fLabel}>Tipo</span><input style={iSmall} placeholder="Formalización, APJO, JO..." value={nuevaAud.tipo} onChange={e=>setNuevaAud(p=>({...p,tipo:e.target.value}))}/></div>
                        <div><span style={fLabel}>Resultado</span><input style={iSmall} value={nuevaAud.resultado} onChange={e=>setNuevaAud(p=>({...p,resultado:e.target.value}))}/></div>
                        <div><span style={fLabel}>Observaciones</span><input style={iSmall} value={nuevaAud.notas} onChange={e=>setNuevaAud(p=>({...p,notas:e.target.value}))}/></div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button style={btnP} onClick={saveAudiencia} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
                        <button style={btnS} onClick={()=>setShowAudForm(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <button style={btnP} onClick={()=>setShowAudForm(true)}>+ Nueva audiencia</button>
                </div>
              )}
              {activeTab==='carpeta'&&(
                <div>
                  <p style={{fontSize:13,color:'#6b7280',marginBottom:16}}>Carpeta física digitalizada — RUC {c.ruc}</p>
                  <div style={{marginBottom:20}}>
                    <span style={fLabel}>Referencia carpeta física</span>
                    {editField==='carpeta_ref'?(
                      <div style={{display:'flex',gap:8}}>
                        <input style={fInput} value={editValue} onChange={e=>setEditValue(e.target.value)} placeholder="Ej: Caja 3, Carpeta 12" autoFocus/>
                        <button style={btnP} onClick={()=>updateField('carpeta_ref',editValue)}>✓</button>
                        <button style={btnS} onClick={()=>setEditField(null)}>✗</button>
                      </div>
                    ):(
                      <div style={{...fValue,cursor:'pointer'}} onClick={()=>{setEditField('carpeta_ref');setEditValue(c.carpeta_ref||'')}}>
                        {c.carpeta_ref||<span style={{color:'#aaa',fontStyle:'italic'}}>Clic para ingresar ubicación...</span>}
                        <span style={{marginLeft:'auto',fontSize:11,color:'#aaa',paddingLeft:8}}>✏️</span>
                      </div>
                    )}
                  </div>
                  <div style={{background:'#f8f7f4',borderRadius:10,border:'2px dashed #d1d5db',padding:32,textAlign:'center',color:'#9ca3af'}}>
                    <div style={{fontSize:40,marginBottom:8}}>📁</div>
                    <div style={{fontSize:14,marginBottom:16}}>Subida de documentos — Próximamente</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
  return(
    <div style={{...f,background:'#f8f7f4',minHeight:'100vh'}}>
      <div style={{background:'#1a1a2e',color:'#fff',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <span style={{fontSize:17,fontWeight:'bold',color:'#d4af37'}}>⚖ GESTOR DE CAUSAS PENALES</span>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#a0aec0'}}>{session.user.email}</span>
          <button style={{...btnS,color:'#d4af37',borderColor:'#d4af37',fontSize:12}} onClick={signOut}>Salir</button>
        </div>
      </div>
      <div style={{padding:'20px 24px',maxWidth:1350,margin:'0 auto'}}>
        {stats.vencido>0&&(
          <div style={{background:'#fef2f2',border:'1.5px solid #ef4444',borderRadius:10,padding:'12px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>🚨</span>
            <span style={{fontSize:14,color:'#991b1b',fontWeight:'bold'}}>{stats.vencido} causa{stats.vencido>1?'s':''} con plazo VENCIDO — Revisión urgente requerida</span>
          </div>
        )}
        {causas.length===0&&!loading&&(
          <div style={{background:'#fffbeb',border:'1.5px solid #f59e0b',borderRadius:10,padding:'20px 24px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:'bold',color:'#92400e',marginBottom:4}}>Base de datos vacía</div>
              <div style={{fontSize:13,color:'#b45309'}}>Carga tus {CAUSAS_SEED.length} causas del Excel con un clic.</div>
            </div>
            <button style={btnP} onClick={seedDatabase} disabled={seeding}>{seeding?'Cargando causas...':'📥 Importar mis causas'}</button>
          </div>
        )}
        <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
          {[{key:'',label:'Total',num:stats.total,color:'#1a1a2e',bg:'#eef2ff'},{key:'vigente',label:'Vigentes',num:stats.vigente,color:'#10b981',bg:'#f0fdf4'},{key:'vencido',label:'Vencidos',num:stats.vencido,color:'#ef4444',bg:'#fef2f2'},{key:'proximo',label:'Por vencer',num:stats.proximo,color:'#f59e0b',bg:'#fffbeb'},{key:'apjo',label:'APJO',num:stats.apjo,color:'#8b5cf6',bg:'#f5f3ff'}].map(st=>{
            const active=filterEstado===st.key&&st.key!==''
            return(
              <div key={st.key} style={{background:active?st.color:st.bg,border:`2px solid ${st.color}`,borderRadius:10,padding:'12px 20px',minWidth:110,textAlign:'center',cursor:'pointer'}} onClick={()=>setFilterEstado(filterEstado===st.key?'':st.key)}>
                <div style={{fontSize:28,fontWeight:'bold',color:active?'#fff':st.color,lineHeight:1}}>{st.num}</div>
                <div style={{fontSize:11,color:active?'rgba(255,255,255,0.8)':'#6b7280',marginTop:2,textTransform:'uppercase',letterSpacing:0.5}}>{st.label}</div>
              </div>
            )
          })}
        </div>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input style={{flex:1,minWidth:240,padding:'9px 14px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:14,background:'#fff',...f}} placeholder="🔍 Buscar por RUC, RIT, imputado, delito, tribunal, fiscal..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',cursor:'pointer',...f}} value={filterTribunal} onChange={e=>setFilterTribunal(e.target.value)}>
            <option value="">Todos los tribunales</option>
            {tribunales.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',cursor:'pointer',...f}} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <span style={{fontSize:13,color:'#6b7280'}}>{filtered.length} resultado{filtered.length!==1?'s':''}</span>
          <button style={btnP} onClick={()=>setShowNuevaCausa(true)}>+ Nueva causa</button>
        </div>
        {loading?(
          <div style={{textAlign:'center',padding:60,color:'#9ca3af',fontSize:15}}>Cargando causas...</div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
              <thead>
                <tr>{['RUC','RIT','Tribunal','Imputado','Delito','Fiscal','Plazo','Estado'].map(h=>(
                  <th key={h} style={{background:'#1a1a2e',color:'#d4af37',padding:'11px 14px',textAlign:'left',fontSize:12,fontWeight:'bold',letterSpacing:0.5,textTransform:'uppercase'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map((c,idx)=>(
                  <tr key={c.id} style={{cursor:'pointer',background:idx%2===0?'#fff':'#fafafa'}} onClick={()=>openCausa(c)} onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'} onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'#fff':'#fafafa'}>
                    <td style={{padding:'10px 14px',fontSize:12,borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontWeight:'bold'}}>{c.ruc}</td>
                    <td style={{padding:'10px 14px',fontSize:12,borderBottom:'1px solid #f1f5f9',color:'#4b5563'}}>{c.rit||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,borderBottom:'1px solid #f1f5f9'}}>{c.tribunal}</td>
                    <td style={{padding:'10px 14px',fontSize:13,borderBottom:'1px solid #f1f5f9'}}><div style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={c.imputado}>{c.imputado}</div></td>
                    <td style={{padding:'10px 14px',fontSize:13,borderBottom:'1px solid #f1f5f9'}}><div style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={c.delito}>{c.delito||'—'}</div></td>
                    <td style={{padding:'10px 14px',fontSize:12,borderBottom:'1px solid #f1f5f9',color:c.fiscal?'#1a1a2e':'#d1d5db',fontStyle:c.fiscal?'normal':'italic'}}>{c.fiscal||'Sin asignar'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,borderBottom:'1px solid #f1f5f9'}}><div style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.plazo||'—'}</div></td>
                    <td style={{padding:'10px 14px',borderBottom:'1px solid #f1f5f9'}}><span style={badge(c.estado)}>{estadoConfig[c.estado]?.label||c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af',fontSize:15}}>Sin resultados.</div>}
          </div>
        )}
      </div>
      {showNuevaCausa&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e=>e.target===e.currentTarget&&setShowNuevaCausa(false)}>
          <div style={{background:'#fff',borderRadius:14,padding:32,width:480,maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{marginTop:0,marginBottom:20,fontSize:18,color:'#1a1a2e'}}>➕ Nueva Causa</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[{key:'ruc',label:'RUC *',placeholder:'Ej: 2600123456-7',full:true},{key:'rit',label:'RIT',placeholder:'Ej: 1234-2026'},{key:'tribunal',label:'Tribunal',placeholder:'Ej: 7 JG STGO'},{key:'imputado',label:'Imputado',placeholder:'Nombre completo',full:true},{key:'delito',label:'Delito',placeholder:'Tipo de delito',full:true},{key:'fiscal',label:'Fiscal',placeholder:'Nombre del fiscal'},{key:'cautelar',label:'Cautelar',placeholder:'Prisión preventiva...'},{key:'plazo',label:'Plazo',placeholder:'VENCE DD-MM-YYYY',full:true}].map(field=>(
                <div key={field.key} style={{gridColumn:field.full?'1 / -1':'auto'}}>
                  <span style={fLabel}>{field.label}</span>
                  <input style={iSmall} placeholder={field.placeholder} value={nuevaCausa[field.key]} onChange={e=>setNuevaCausa(p=>({...p,[field.key]:e.target.value}))}/>
                </div>
              ))}
              <div style={{gridColumn:'1 / -1'}}>
                <span style={fLabel}>Estado</span>
                <select style={{...iSmall}} value={nuevaCausa.estado} onChange={e=>setNuevaCausa(p=>({...p,estado:e.target.value}))}>
                  {Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button style={btnP} onClick={saveCausa} disabled={saving||!nuevaCausa.ruc}>{saving?'Guardando...':'Guardar causa'}</button>
              <button style={btnS} onClick={()=>setShowNuevaCausa(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
