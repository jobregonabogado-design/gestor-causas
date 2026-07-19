import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'

const f = { fontFamily:"'Century Gothic','Inter',sans-serif" }
const fmt = (n) => '$' + (n || 0).toLocaleString('es-CL')

// ─── Carga SheetJS (xlsx) desde un CDN en tiempo de ejecución — mismo enfoque
// que pdf.js/Tesseract, no requiere tocar package.json. ──────────────────────
let _xlsxCargando = null
function cargarXLSX() {
  if (typeof window !== 'undefined' && window.XLSX) return Promise.resolve(window.XLSX)
  if (_xlsxCargando) return _xlsxCargando
  _xlsxCargando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = () => reject(new Error('No se pudo cargar el generador de Excel (revisa tu conexión a internet)'))
    document.body.appendChild(script)
  })
  return _xlsxCargando
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Contabilidad() {
  const [tab, setTab] = useState('cobrar')
  const [loading, setLoading] = useState(true)
  const [causas, setCausas] = useState([])
  const [honorarios, setHonorarios] = useState([])
  const [abonos, setAbonos] = useState([])
  const hoy = new Date()
  const [mesFiltro, setMesFiltro] = useState(hoy.getMonth())
  const [anioFiltro, setAnioFiltro] = useState(hoy.getFullYear())
  const [exportando, setExportando] = useState(false)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: c }, { data: h }, { data: a }] = await Promise.all([
      supabase.from('causas').select('id, ruc, imputado'),
      supabase.from('honorarios').select('*'),
      supabase.from('abonos_honorarios').select('*').order('fecha', { ascending: false }),
    ])
    setCausas(c || [])
    setHonorarios(h || [])
    setAbonos(a || [])
    setLoading(false)
  }

  const causaPorId = useMemo(() => Object.fromEntries(causas.map(c => [c.id, c])), [causas])

  // Nombre a mostrar: si hay un solo imputado, su nombre; si hay 2+, solo el RUC (como pidió Joaquín)
  const nombreOSoloRuc = (causa) => {
    if (!causa) return { nombre: '—', soloRuc: true }
    const nombres = (causa.imputado || '').split('|').map(n => n.trim()).filter(Boolean)
    if (nombres.length === 1) return { nombre: nombres[0], soloRuc: false }
    return { nombre: null, soloRuc: true }
  }

  // ── Cuentas por Cobrar: causas con honorario pactado y saldo pendiente > 0 ──
  const cuentasPorCobrar = useMemo(() => {
    return honorarios.map(h => {
      const causa = causaPorId[h.causa_id]
      const abonosCausa = abonos.filter(a => a.causa_id === h.causa_id)
      const totalAbonado = abonosCausa.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0)
      const saldo = (parseFloat(h.monto_total) || 0) - totalAbonado
      return { causa, montoTotal: parseFloat(h.monto_total) || 0, totalAbonado, saldo }
    }).filter(r => r.causa && r.saldo > 0).sort((a, b) => b.saldo - a.saldo)
  }, [honorarios, abonos, causaPorId])

  const totalPorCobrar = cuentasPorCobrar.reduce((s, r) => s + r.saldo, 0)

  // ── Abonos del mes filtrado ──
  const abonosDelMes = useMemo(() => {
    return abonos.filter(a => {
      const fecha = new Date(a.fecha + 'T12:00:00')
      return fecha.getMonth() === mesFiltro && fecha.getFullYear() === anioFiltro
    }).map(a => ({ ...a, causa: causaPorId[a.causa_id] }))
  }, [abonos, mesFiltro, anioFiltro, causaPorId])

  const totalAbonosDelMes = abonosDelMes.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0)

  // ── Ingresos percibidos: total por mes en el año seleccionado (lo efectivamente cobrado, base tributaria) ──
  const ingresosPorMes = useMemo(() => {
    const acc = Array(12).fill(0)
    abonos.forEach(a => {
      const fecha = new Date(a.fecha + 'T12:00:00')
      if (fecha.getFullYear() === anioFiltro) acc[fecha.getMonth()] += (parseFloat(a.monto) || 0)
    })
    return acc
  }, [abonos, anioFiltro])

  const totalAnual = ingresosPorMes.reduce((s, v) => s + v, 0)

  // Mismos datos de ingresosPorMes, formateados para el gráfico (nombre corto de mes)
  const chartIngresos = useMemo(() => MESES.map((m, i) => ({ mes: m.slice(0, 3), monto: ingresosPorMes[i] })), [ingresosPorMes])

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const XLSX = await cargarXLSX()
      const filas = abonosDelMes.map(a => {
        const { nombre, soloRuc } = nombreOSoloRuc(a.causa)
        return {
          'RUC Causa': a.causa?.ruc || '—',
          'Imputado': soloRuc ? '(ver RUC — más de un imputado)' : nombre,
          'Monto Abono': parseFloat(a.monto) || 0,
          'Fecha': a.fecha,
          'Forma de Pago': a.forma_pago || '',
          'Cuenta (si transferencia)': a.cuenta_transferencia || '',
        }
      })
      filas.push({ 'RUC Causa':'', 'Imputado':'TOTAL', 'Monto Abono': totalAbonosDelMes, 'Fecha':'', 'Forma de Pago':'', 'Cuenta (si transferencia)':'' })
      const ws = XLSX.utils.json_to_sheet(filas)
      ws['!cols'] = [{wch:16},{wch:32},{wch:14},{wch:12},{wch:22},{wch:28}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${MESES[mesFiltro]} ${anioFiltro}`)
      XLSX.writeFile(wb, `Abonos_${MESES[mesFiltro]}_${anioFiltro}.xlsx`)
    } catch (err) {
      alert('No se pudo generar el Excel: ' + (err?.message || 'error desconocido'))
    } finally {
      setExportando(false)
    }
  }

  if (loading) return <div style={{ textAlign:'center', padding:80, color:'#94a3b8', fontSize:14, ...f }}>Cargando...</div>

  return (
    <div style={{ background:'#F8F9FC', minHeight:'calc(100vh - 60px)', ...f }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px' }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#1E293B', letterSpacing:'-0.4px', marginBottom:4 }}>Contabilidad</div>
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>Visible solo para el titular · información agregada de todas las causas</div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:16, marginBottom:20 }}>
          {[
            { label:'Por Cobrar', icon:'📄', num:fmt(totalPorCobrar), accent:'#dc2626' },
            { label:`Abonos ${MESES[mesFiltro]}`, icon:'💵', num:fmt(totalAbonosDelMes), accent:'#059669' },
            { label:`Ingresos ${anioFiltro}`, icon:'📈', num:fmt(totalAnual), accent:'#2563eb' },
          ].map(st => (
            <div key={st.label} style={{ textAlign:'left', background:'#fff', border:'none', borderRadius:20, padding:'20px 22px', boxShadow:'0 1px 3px rgba(15,23,42,0.06)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:0.5, color:'#94a3b8', ...f }}>{st.label}</div>
                <div style={{ fontSize:16 }}>{st.icon}</div>
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:st.accent, lineHeight:1, letterSpacing:'-1px', ...f }}>{st.num}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:4, background:'#fff', padding:4, borderRadius:12, border:'1px solid #E2E8F0', marginBottom:20, width:'fit-content' }}>
          {[['cobrar','Cuentas por Cobrar'],['abonos','Abonos'],['ingresos','Ingresos Percibidos']].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)}
              style={{ fontFamily:"'Century Gothic','Inter',sans-serif", fontSize:13, fontWeight: tab===k?600:500, padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
                background: tab===k?'#1E293B':'transparent', color: tab===k?'#fff':'#64748b' }}>{l}</button>
          ))}
        </div>

        {tab === 'cobrar' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>Dinero por cobrar (saldos pendientes)</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#dc2626' }}>{fmt(totalPorCobrar)}</div>
            </div>
            {cuentasPorCobrar.length === 0 ? (
              <p style={{ color:'#94a3b8', fontSize:13 }}>No hay saldos pendientes — todo está al día.</p>
            ) : cuentasPorCobrar.map(r => (
              <div key={r.causa.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>RUC {r.causa.ruc}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Pactado {fmt(r.montoTotal)} · Abonado {fmt(r.totalAbonado)}</div>
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:'#dc2626' }}>{fmt(r.saldo)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'abonos' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', gap:8 }}>
                <select value={mesFiltro} onChange={e=>setMesFiltro(Number(e.target.value))} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontFamily:"'Century Gothic','Inter',sans-serif" }}>
                  {MESES.map((m,i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={anioFiltro} onChange={e=>setAnioFiltro(Number(e.target.value))} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontFamily:"'Century Gothic','Inter',sans-serif" }}>
                  {[hoy.getFullYear(), hoy.getFullYear()-1, hoy.getFullYear()-2].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button onClick={exportarExcel} disabled={exportando || abonosDelMes.length===0} className="btn-primary" style={{ fontSize:13 }}>
                {exportando ? 'Generando...' : '⬇ Exportar a Excel'}
              </button>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'#1E293B', marginBottom:12 }}>Total {MESES[mesFiltro]} {anioFiltro}: <span style={{color:'#059669'}}>{fmt(totalAbonosDelMes)}</span></div>
            {abonosDelMes.length === 0 ? (
              <p style={{ color:'#94a3b8', fontSize:13 }}>Sin abonos registrados en este mes.</p>
            ) : abonosDelMes.map(a => {
              const { nombre, soloRuc } = nombreOSoloRuc(a.causa)
              return (
                <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'#F8F9FC', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1E293B' }}>RUC {a.causa?.ruc || '—'}{!soloRuc && <span style={{fontWeight:400,color:'#64748b'}}> · {nombre}</span>}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{a.fecha} · {a.forma_pago}{a.cuenta_transferencia ? ' · '+a.cuenta_transferencia : ''}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#059669' }}>{fmt(a.monto)}</div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'ingresos' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <select value={anioFiltro} onChange={e=>setAnioFiltro(Number(e.target.value))} style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontFamily:"'Century Gothic','Inter',sans-serif" }}>
                {[hoy.getFullYear(), hoy.getFullYear()-1, hoy.getFullYear()-2].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div style={{ fontSize:20, fontWeight:800, color:'#1E293B' }}>Total {anioFiltro}: {fmt(totalAnual)}</div>
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>Ingresos efectivamente percibidos por mes (base para Boletas de Honorarios y F22 — confirma tasas y tratamiento con tu contador).</div>

            {totalAnual > 0 && (
              <div style={{ marginBottom:20 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartIngresos} margin={{ left:0, right:8, top:8, bottom:0 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={0} />
                    <Tooltip cursor={{ fill:'#F8F9FC' }} contentStyle={{ background:'#fff', border:'none', boxShadow:'0 4px 16px rgba(15,23,42,0.10)', borderRadius:10, fontSize:12 }} formatter={(v) => [fmt(v), 'Ingresos']} />
                    <Bar dataKey="monto" radius={[6,6,0,0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {MESES.map((m,i) => (
              <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:13, color:'#475569' }}>{m}</div>
                <div style={{ fontSize:13, fontWeight:700, color: ingresosPorMes[i]>0?'#1E293B':'#cbd5e1' }}>{fmt(ingresosPorMes[i])}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
