import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { CAUSAS_SEED } from '../lib/seedData'

const estadoConfig = {
  vencido:   { label: 'VENCIDO',    color: '#ef4444', bg: '#fef2f2' },
  proximo:   { label: 'POR VENCER', color: '#f59e0b', bg: '#fffbeb' },
  apjo:      { label: 'APJO',       color: '#8b5cf6', bg: '#f5f3ff' },
  suspendida:{ label: 'SUSPENDIDA', color: '#6b7280', bg: '#f9fafb' },
  vigente:   { label: 'VIGENTE',    color: '#10b981', bg: '#f0fdf4' },
}

export default function Dashboard({ session }) {
  const [causas, setCausas] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTribunal, setFilterTribunal] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [view, setView] = useState('list')
  const [selectedCausa, setSelectedCausa] = useState(null)
  const [activeTab, setActiveTab] = useState('datos')
  const [editField, setEditField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [nuevaNota, setNuevaNota] = useState('')
  const [notas, setNotas] = useState([])
  const [audiencias, setAudiencias] = useState([])
  const [showAudForm, setShowAudForm] = useState(false)
  const [nuevaAud, setNuevaAud] = useState({ fecha: '', tipo: '', resultado: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [showNuevaCausa, setShowNuevaCausa] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [nuevaCausa, setNuevaCausa] = useState({ ruc: '', rit: '', tribunal: '', delito: '', imputado: '', fiscal: '', cautelar: '', centro_penal: '', plazo: '', estado: 'vigente' })

  useEffect(() => { loadCausas() }, [])

  const loadCausas = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('causas').select('*').order('created_at', { ascending: false })
    if (!error) setCausas(data || [])
    setLoading(false)
  }

  const seedDatabase = async () => {
    setSeeding(true)
    const chunks = []
    for (let i = 0; i < CAUSAS_SEED.length; i += 50) chunks.push(CAUSAS_SEED.slice(i, i + 50))
    for (const chunk of chunks) {
      await supabase.from('causas').insert(chunk.map(c => ({
        ruc: c.ruc, rit: c.rit, tribunal: c.tribunal, delito: c.delito,
        imputado: c.imputado, fiscal: '', cautelar: '', centro_penal: '',
        plazo: c.plazo, estado: c.estado, carpeta_ref: ''
      })))
    }
    await loadCausas()
    setSeeding(false)
  }

  const openCausa = async (c) => {
    setSelectedCausa(c)
    setView('detail')
    setActiveTab('datos')
    const [{ data: n }, { data: a }] = await Promise.all([
      supabase.from('notas').select('*').eq('causa_id', c.id).order('created_at', { ascending: false }),
      supabase.from('audiencias').select('*').eq('causa_id', c.id).order('fecha', { ascending: false })
    ])
    setNotas(n || [])
    setAudiencias(a || [])
  }

  const updateField = async (field, value) => {
    setSaving(true)
    const { error } = await supabase.from('causas').update({ [field]: value, updated_at: new Date() }).eq('id', selectedCausa.id)
    if (!error) {
      const updated = { ...selectedCausa, [field]: value }
      setSelectedCausa(updated)
      setCausas(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
    setEditField(null)
    setSaving(false)
  }

  const saveNota = async () => {
    if (!nuevaNota.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('notas').insert({ causa_id: selectedCausa.id, contenido: nuevaNota }).select().single()
    if (!error) setNotas(prev => [data, ...prev])
    setNuevaNota('')
    setSaving(false)
  }

  const saveAudiencia = async () => {
    if (!nuevaAud.fecha) return
    setSaving(true)
    const { data, error } = await supabase.from('audiencias').insert({ causa_id: selectedCausa.id, ...nuevaAud }).select().single()
    if (!error) setAudiencias(prev => [data, ...prev])
    setNuevaAud({ fecha: '', tipo: '', resultado: '', notas: '' })
    setShowAudForm(false)
    setSaving(false)
  }

  const saveCausa = async () => {
    if (!nuevaCausa.ruc) return
    setSaving(true)
    const { data, error } = await supabase.from('causas').insert(nuevaCausa).select().single()
    if (!error) { setCausas(prev => [data, ...prev]); setShowNuevaCausa(false); setNuevaCausa({ ruc: '', rit: '', tribunal: '', delito: '', imputado: '', fiscal: '', cautelar: '', centro_penal: '', plazo: '', estado: 'vigente' }) }
    setSaving(false)
  }

  const signOut = () => supabase.auth.signOut()

  const tribunales = useMemo(() => [...new Set(causas.map(c => c.tribunal).filter(Boolean))].sort(), [causas])

  const filtered = useMemo(() => causas.filter(c => {
    const s = search.toLowerCase()
    const match = !s || [c.ruc, c.rit, c.imputado, c.delito, c.tribunal, c.fiscal].some(v => v?.toLowerCase().includes(s))
    return match && (!filterTribunal || c.tribunal === filterTribunal) && (!filterEstado || c.estado === filterEstado)
  }), [causas, search, filterTribunal, filterEstado])

  const stats = useMemo(() => ({
    total: causas.length,
    vencido: causas.filter(c => c.estado === 'vencido').length,
    proximo: causas.filter(c => c.estado === 'proximo').length,
    apjo: causas.filter(c => c.estado === 'apjo').length,
    vigente: causas.filter(c => c.estado === 'vigente').length,
  }), [causas])


  const chartDelitos = useMemo(() => {
    const map = {}
    causas.forEach(c => { if (c.delito) { const k = c.delito.substring(0,30); map[k] = (map[k]||0)+1 } })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}))
  }, [causas])

  const chartTribunales = useMemo(() => {
    const map = {}
    causas.forEach(c => { if (c.tribunal) { map[c.tribunal] = (map[c.tribunal]||0)+1 } })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({name,value}))
  }, [causas])

  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#0ea5e9','#8b5cf6','#ec4899','#14b8a6']

  const f = { fontFamily: 'Inter, system-ui, sans-serif' }

  const s = {
    app: { ...f, background: '#f9fafb', minHeight: '100vh', color: '#1a1a2e' },
    header: { background: '#111111', color: '#fff', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 100 },
    logo: { fontSize: 17, fontWeight: 'bold', letterSpacing: 1, color: '#ffffff' },
    main: { padding: '20px 24px', maxWidth: 1350, margin: '0 auto' },
    statsRow: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
    statCard: (color, bg, active) => ({ background: active ? color : bg, border: `2px solid ${color}`, borderRadius: 10, padding: '12px 20px', minWidth: 110, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }),
    statNum: (color, active) => ({ fontSize: 28, fontWeight: 'bold', color: active ? '#fff' : color, lineHeight: 1 }),
    statLabel: (active) => ({ fontSize: 11, color: active ? 'rgba(255,255,255,0.8)' : '#6b7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }),
    toolbar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    searchBox: { flex: 1, minWidth: 240, padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fff', ...f },
    select: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', ...f },
    btnPrimary: { background: '#111111', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 'bold', ...f },
    btnSecondary: { background: '#fff', color: '#111111', border: '1.5px solid #111111', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', ...f },
    btnDanger: { background: '#fff', color: '#ef4444', border: '1.5px solid #ef4444', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', ...f },
    table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' },
    th: { background: '#111111', color: '#ffffff', padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },
    td: { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
    badge: (estado) => ({ display: 'inline-block', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 'bold', color: estadoConfig[estado]?.color || '#666', background: estadoConfig[estado]?.bg || '#f9fafb', border: `1px solid ${estadoConfig[estado]?.color || '#ccc'}` }),
    detailCard: { background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' },
    detailHeader: { background: '#111111', color: '#fff', padding: '20px 24px' },
    tabs: { display: 'flex', borderBottom: '2px solid #f1f5f9', padding: '0 24px', background: '#fafafa' },
    tab: (active) => ({ padding: '12px 18px', cursor: 'pointer', fontSize: 13, fontWeight: active ? 'bold' : 'normal', color: active ? '#111111' : '#6b7280', borderBottom: `2px solid ${active ? '#d4af37' : 'transparent'}`, marginBottom: -2, background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: active ? '#111111' : 'transparent', ...f }),
    tabContent: { padding: 24 },
    fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    fieldLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' },
    fieldValue: { fontSize: 14, color: '#1a1a2e', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 36, display: 'flex', alignItems: 'center' },
    fieldInput: { fontSize: 14, color: '#1a1a2e', padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1.5px solid #111111', width: '100%', ...f, outline: 'none', boxSizing: 'border-box' },
    inputSmall: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, ...f, width: '100%', boxSizing: 'border-box' },
    notasArea: { width: '100%', padding: 12, fontSize: 14, border: '1.5px solid #e2e8f0', borderRadius: 8, ...f, minHeight: 100, resize: 'vertical', background: '#fff', boxSizing: 'border-box' },
    notaCard: { background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 10, border: '1px solid #e2e8f0' },
    audCard: { background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 10, border: '1px solid #e2e8f0' },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
    modalCard: { background: '#fff', borderRadius: 14, padding: 32, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' },
    alertBanner: { background: '#fef2f2', border: '1.5px solid #ef4444', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 },
  }

  // DETAIL VIEW
  if (view === 'detail' && selectedCausa) {
    const c = causas.find(x => x.id === selectedCausa.id) || selectedCausa
    return (
      <div style={s.app}>
        <div style={s.header}>
          <span style={s.logo}>⚖ GESTOR DE CAUSAS PENALES</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {saving && <span style={{ color: '#9ca3af', fontSize: 12 }}>Guardando...</span>}
            <button style={{ ...s.btnSecondary, color: '#ffffff', borderColor: '#ffffff', fontSize: 12 }} onClick={signOut}>Salir</button>
          </div>
        </div>
        <div style={s.main}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#111111', marginBottom: 16, fontSize: 14 }} onClick={() => setView('list')}>
            ← Volver al listado
          </div>
          <div style={s.detailCard}>
            <div style={s.detailHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 }}>RUC: {c.ruc}</div>
                  <div style={{ fontSize: 13, color: '#a0aec0' }}>RIT: {c.rit || '—'} &nbsp;|&nbsp; {c.tribunal}</div>
                </div>
                <span style={s.badge(c.estado)}>{estadoConfig[c.estado]?.label}</span>
              </div>
            </div>
            <div style={s.tabs}>
              {[['datos','📋 Datos'],['notas','📝 Notas'],['audiencias','📅 Audiencias'],['carpeta','📁 Carpeta'],['stats','📊 Estadísticas']].map(([k,l]) => (
                <button key={k} style={s.tab(activeTab === k)} onClick={() => setActiveTab(k)}>{l}</button>
              ))}
            </div>
            <div style={s.tabContent}>

              {activeTab === 'datos' && (
                <div>
                  <div style={s.fieldGrid}>
                    {[
                      { key: 'imputado', label: 'Imputado(s)', full: true },
                      { key: 'delito', label: 'Delito', full: true },
                      { key: 'tribunal', label: 'Tribunal' },
                      { key: 'rit', label: 'RIT' },
                      { key: 'fiscal', label: 'Fiscal', editable: true },
                      { key: 'cautelar', label: 'Cautelar Procesal', editable: true },
                      { key: 'centro_penal', label: 'Centro Penal', editable: true },
                      { key: 'plazo', label: 'Plazo / Estado Plazo', editable: true, full: true },
                    ].map(field => (
                      <div key={field.key} style={{ marginBottom: 4, gridColumn: field.full ? '1 / -1' : 'auto' }}>
                        <span style={s.fieldLabel}>{field.label}</span>
                        {editField === field.key ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input style={s.fieldInput} value={editValue} onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updateField(field.key, editValue); if (e.key === 'Escape') setEditField(null) }} autoFocus />
                            <button style={s.btnPrimary} onClick={() => updateField(field.key, editValue)}>✓</button>
                            <button style={s.btnSecondary} onClick={() => setEditField(null)}>✗</button>
                          </div>
                        ) : (
                          <div style={{ ...s.fieldValue, cursor: field.editable ? 'pointer' : 'default' }}
                            onClick={() => { if (field.editable) { setEditField(field.key); setEditValue(c[field.key] || '') } }}
                            title={field.editable ? 'Clic para editar' : ''}>
                            {c[field.key] || (field.editable ? <span style={{ color: '#aaa', fontStyle: 'italic' }}>Clic para agregar...</span> : '—')}
                            {field.editable && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa', paddingLeft: 8 }}>✏️</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <span style={s.fieldLabel}>Estado Procesal</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {Object.entries(estadoConfig).map(([k, v]) => (
                        <button key={k} onClick={() => updateField('estado', k)}
                          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 'bold', border: `2px solid ${v.color}`, background: c.estado === k ? v.color : '#fff', color: c.estado === k ? '#fff' : v.color, ...f }}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notas' && (
                <div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>Block de notas de la causa. Cada entrada queda registrada con fecha.</p>
                  {notas.map(n => (
                    <div key={n.id} style={s.notaCard}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{new Date(n.created_at).toLocaleString('es-CL')}</div>
                      <div style={{ fontSize: 14, color: '#111111', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{n.contenido}</div>
                    </div>
                  ))}
                  {notas.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 14 }}>Sin notas aún.</p>}
                  <textarea style={s.notasArea} placeholder="Escribir nueva nota..." value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} />
                  <button style={{ ...s.btnPrimary, marginTop: 8 }} onClick={saveNota} disabled={saving}>
                    {saving ? 'Guardando...' : '+ Agregar nota'}
                  </button>
                </div>
              )}

              {activeTab === 'audiencias' && (
                <div>
                  {audiencias.map(a => (
                    <div key={a.id} style={s.audCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: 14 }}>{a.tipo || 'Audiencia'}</strong>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{a.fecha}</span>
                      </div>
                      {a.resultado && <div style={{ fontSize: 13, marginTop: 4 }}>Resultado: {a.resultado}</div>}
                      {a.notas && <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>{a.notas}</div>}
                    </div>
                  ))}
                  {audiencias.length === 0 && !showAudForm && <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 14 }}>Sin audiencias registradas.</p>}
                  {showAudForm && (
                    <div style={{ background: '#f9fafb', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div><span style={s.fieldLabel}>Fecha</span><input type="date" style={s.inputSmall} value={nuevaAud.fecha} onChange={e => setNuevaAud(p => ({ ...p, fecha: e.target.value }))} /></div>
                        <div><span style={s.fieldLabel}>Tipo</span><input style={s.inputSmall} placeholder="Formalización, APJO, JO..." value={nuevaAud.tipo} onChange={e => setNuevaAud(p => ({ ...p, tipo: e.target.value }))} /></div>
                        <div><span style={s.fieldLabel}>Resultado</span><input style={s.inputSmall} placeholder="Resultado" value={nuevaAud.resultado} onChange={e => setNuevaAud(p => ({ ...p, resultado: e.target.value }))} /></div>
                        <div><span style={s.fieldLabel}>Observaciones</span><input style={s.inputSmall} placeholder="Notas adicionales" value={nuevaAud.notas} onChange={e => setNuevaAud(p => ({ ...p, notas: e.target.value }))} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={s.btnPrimary} onClick={saveAudiencia} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                        <button style={s.btnSecondary} onClick={() => setShowAudForm(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <button style={s.btnPrimary} onClick={() => setShowAudForm(true)}>+ Nueva audiencia</button>
                </div>
              )}

              {activeTab === 'carpeta' && (
                <div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Carpeta física digitalizada — RUC {c.ruc}</p>
                  <div style={{ marginBottom: 20 }}>
                    <span style={s.fieldLabel}>Referencia carpeta física (caja, estante, número)</span>
                    {editField === 'carpeta_ref' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input style={s.fieldInput} value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Ej: Caja 3, Carpeta 12" autoFocus />
                        <button style={s.btnPrimary} onClick={() => updateField('carpeta_ref', editValue)}>✓</button>
                        <button style={s.btnSecondary} onClick={() => setEditField(null)}>✗</button>
                      </div>
                    ) : (
                      <div style={{ ...s.fieldValue, cursor: 'pointer' }} onClick={() => { setEditField('carpeta_ref'); setEditValue(c.carpeta_ref || '') }}>
                        {c.carpeta_ref || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Clic para ingresar ubicación...</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa', paddingLeft: 8 }}>✏️</span>
                      </div>
                    )}
                  </div>
                  <div style={{ background: '#f9fafb', borderRadius: 10, border: '2px dashed #d1d5db', padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>Sube documentos escaneados de esta causa</div>
                    <div style={{ fontSize: 12, marginBottom: 16, color: '#d1d5db' }}>PDF, Word, Imágenes — Esta función estará disponible pronto</div>
                    <button style={{ ...s.btnPrimary, opacity: 0.5, cursor: 'not-allowed' }}>📎 Próximamente</button>
                  </div>
                </div>
              )}

              {activeTab === 'stats' && (
                <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
                  Las estadísticas globales están disponibles en la vista de lista → botón 📊
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    )
  }

  // LIST VIEW
  return (
    <div style={s.app}>
      <div style={s.header}>
        <span style={s.logo}>⚖ GESTOR DE CAUSAS PENALES</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#a0aec0' }}>{session.user.email}</span>
          <button style={{ ...s.btnSecondary, color: '#ffffff', borderColor: '#ffffff', fontSize: 12 }} onClick={signOut}>Salir</button>
        </div>
      </div>

      <div style={s.main}>
        {stats.vencido > 0 && (
          <div style={s.alertBanner}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <span style={{ fontSize: 14, color: '#991b1b', fontWeight: 'bold' }}>
              {stats.vencido} causa{stats.vencido > 1 ? 's' : ''} con plazo VENCIDO — Revisión urgente requerida
            </span>
          </div>
        )}

        {causas.length === 0 && !loading && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>Base de datos vacía</div>
              <div style={{ fontSize: 13, color: '#b45309' }}>Carga tus {CAUSAS_SEED.length} causas del Excel con un clic.</div>
            </div>
            <button style={s.btnPrimary} onClick={seedDatabase} disabled={seeding}>
              {seeding ? 'Cargando causas...' : '📥 Importar mis causas'}
            </button>
          </div>
        )}

        <div style={s.statsRow}>
          {[
            { key: '', label: 'Total', num: stats.total, color: '#111111', bg: '#f3f4f6' },
            { key: 'vigente', label: 'Vigentes', num: stats.vigente, color: '#10b981', bg: '#f0fdf4' },
            { key: 'vencido', label: 'Vencidos', num: stats.vencido, color: '#ef4444', bg: '#fef2f2' },
            { key: 'proximo', label: 'Por vencer', num: stats.proximo, color: '#f59e0b', bg: '#fffbeb' },
            { key: 'apjo', label: 'APJO', num: stats.apjo, color: '#8b5cf6', bg: '#f5f3ff' },
    suspendida: causas.filter(c => c.estado === 'suspendida').length,
          ].map(st => {
            const active = filterEstado === st.key && st.key !== ''
            return (
              <div key={st.key} style={s.statCard(st.color, st.bg, active)} onClick={() => setFilterEstado(filterEstado === st.key ? '' : st.key)}>
                <div style={s.statNum(st.color, active)}>{st.num}</div>
                <div style={s.statLabel(active)}>{st.label}</div>
              </div>
            )
          })}
        </div>


        {showStats && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#111' }}>📊 Estadísticas del Portfolio</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Delitos</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={chartDelitos} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {chartDelitos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' causas', n]} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => v.substring(0,20)} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Causas por Tribunal</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartTribunales} layout="vertical" margin={{ left: 8, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0,4,4,0]}>
                      {chartTribunales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div style={s.toolbar}>
          <input style={s.searchBox} placeholder="🔍 Buscar por RUC, RIT, imputado, delito, tribunal, fiscal..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={s.select} value={filterTribunal} onChange={e => setFilterTribunal(e.target.value)}>
            <option value="">Todos los tribunales</option>
            {tribunales.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={s.select} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(estadoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          <button style={s.btnPrimary} onClick={() => setShowNuevaCausa(true)}>+ Nueva causa</button>
            <button style={{ ...s.btnSecondary, borderColor: '#6366f1', color: '#6366f1' }} onClick={() => setShowStats(!showStats)}>📊 Estadísticas</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 15 }}>Cargando causas...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['RUC', 'RIT', 'Tribunal', 'Imputado', 'Delito', 'Fiscal', 'Plazo', 'Estado'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr key={c.id}
                    style={{ cursor: 'pointer', background: idx % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.1s' }}
                    onClick={() => openCausa(c)}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: '#1a1a2e' }}>{c.ruc}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#4b5563' }}>{c.rit || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12 }}>{c.tribunal}</td>
                    <td style={s.td}><div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.imputado}>{c.imputado}</div></td>
                    <td style={s.td}><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.delito}>{c.delito || '—'}</div></td>
                    <td style={{ ...s.td, fontSize: 12, color: c.fiscal ? '#1a1a2e' : '#d1d5db', fontStyle: c.fiscal ? 'normal' : 'italic' }}>{c.fiscal || 'Sin asignar'}</td>
                    <td style={{ ...s.td, fontSize: 12 }}><div style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.plazo}>{c.plazo || '—'}</div></td>
                    <td style={s.td}><span style={s.badge(c.estado)}>{estadoConfig[c.estado]?.label || c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 15 }}>Sin resultados para esta búsqueda.</div>
            )}
          </div>
        )}
      </div>

      {showNuevaCausa && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowNuevaCausa(false)}>
          <div style={s.modalCard}>
            <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18, color: '#1a1a2e' }}>➕ Nueva Causa</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'ruc', label: 'RUC *', placeholder: 'Ej: 2600123456-7', full: true },
                { key: 'rit', label: 'RIT', placeholder: 'Ej: 1234-2026' },
                { key: 'tribunal', label: 'Tribunal', placeholder: 'Ej: 7 JG STGO' },
                { key: 'imputado', label: 'Imputado', placeholder: 'Nombre completo', full: true },
                { key: 'delito', label: 'Delito', placeholder: 'Tipo de delito', full: true },
                { key: 'fiscal', label: 'Fiscal', placeholder: 'Nombre del fiscal' },
                { key: 'cautelar', label: 'Cautelar', placeholder: 'Prisión preventiva...' },
                { key: 'plazo', label: 'Plazo', placeholder: 'VENCE DD-MM-YYYY', full: true },
              ].map(field => (
                <div key={field.key} style={{ gridColumn: field.full ? '1 / -1' : 'auto' }}>
                  <span style={s.fieldLabel}>{field.label}</span>
                  <input style={s.inputSmall} placeholder={field.placeholder} value={nuevaCausa[field.key]}
                    onChange={e => setNuevaCausa(p => ({ ...p, [field.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={s.fieldLabel}>Estado</span>
                <select style={{ ...s.select, width: '100%' }} value={nuevaCausa.estado} onChange={e => setNuevaCausa(p => ({ ...p, estado: e.target.value }))}>
                  {Object.entries(estadoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={s.btnPrimary} onClick={saveCausa} disabled={saving || !nuevaCausa.ruc}>{saving ? 'Guardando...' : 'Guardar causa'}</button>
              <button style={s.btnSecondary} onClick={() => setShowNuevaCausa(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
