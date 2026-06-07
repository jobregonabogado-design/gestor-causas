import { useState, useEffect } from 'react'
import { loginGmail, isGmailConnected, logoutGmail, fetchNotificacionesPJUD, exchangeCodeForToken } from '../lib/gmail'
import { supabase } from '../lib/supabase'

const f = { fontFamily:"'Inter',sans-serif" }

export default function GmailIntegracion() {
  const [conectado, setConectado] = useState(isGmailConnected())
  const [cargando, setCargando] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === '1') {
      const code = localStorage.getItem('gmail_auth_code')
      if (code) {
        setCargando(true)
        exchangeCodeForToken(code).then(ok => {
          if (ok) { setConectado(true); localStorage.removeItem('gmail_auth_code') }
          setCargando(false)
          window.history.replaceState({}, '', window.location.pathname)
        })
      }
    }
  }, [])

  const cargarNotificaciones = async () => {
    setCargando(true)
    const data = await fetchNotificacionesPJUD()
    
    // Obtener causas vigentes (no terminadas)
    const { data: causasVigentes } = await supabase
      .from('causas')
      .select('ruc, estado')
      .neq('estado', 'terminada')
    
    const rucsVigentes = new Set((causasVigentes || []).map(c => c.ruc))
    
    // Filtrar por causas vigentes y deduplicar por RUC
    const vistos = new Set()
    const filtradas = data.filter(n => {
      const rucLimpio = n.ruc?.replace(/\s/g, '')
      if (!rucsVigentes.has(rucLimpio)) return false
      if (vistos.has(rucLimpio)) return false
      vistos.add(rucLimpio)
      return true
    })
    
    setNotificaciones(filtradas)
    setCargando(false)
  }

  const importarAudiencia = async (n) => {
    if (!n.audiencia?.fecha) { alert('No se pudo detectar la fecha de esta audiencia'); return }
    setProcesando(true)
    const { error } = await supabase.from('audiencias').insert({
      fecha: n.audiencia.fecha,
      hora: n.audiencia.hora || '',
      tipo: n.audiencia.tipo || 'AUDIENCIA',
      tribunal: n.audiencia.tribunal || '',
      ruc: n.ruc,
      rit: n.rit || '',
      imputado: '',
      notas: `Importado automáticamente desde correo PJUD\nAsunto: ${n.asunto}`,
    })
    if (!error) {
      setResultado({ ok: true, msg: `Audiencia agregada al calendario — RUC ${n.ruc}` })
      setNotificaciones(prev => prev.filter(x => x !== n))
    } else {
      setResultado({ ok: false, msg: 'Error al agregar: ' + error.message })
    }
    setProcesando(false)
    setTimeout(() => setResultado(null), 4000)
  }

  const ignorar = (n) => setNotificaciones(prev => prev.filter(x => x !== n))

  if (!conectado) return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:32, textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📧</div>
      <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:8, ...f }}>Conectar Gmail</div>
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:24, maxWidth:400, margin:'0 auto 24px', lineHeight:1.7, ...f }}>
        Conecta <strong>notificacion.defensapenal@gmail.com</strong> para importar automáticamente las audiencias notificadas por el PJUD y la Fiscalía.
      </div>
      {cargando ? (
        <div style={{ fontSize:13, color:'#94a3b8', ...f }}>Conectando...</div>
      ) : (
        <button onClick={loginGmail} style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 14px rgba(37,99,235,0.3)', ...f }}>
          🔗 Conectar con Google
        </button>
      )}
    </div>
  )

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:28 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', ...f }}>📧 Gmail conectado</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, ...f }}>notificacion.defensapenal@gmail.com</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={cargarNotificaciones} disabled={cargando}
            style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer', ...f }}>
            {cargando ? 'Cargando...' : '🔄 Revisar correos'}
          </button>
          <button onClick={() => { logoutGmail(); setConectado(false) }}
            style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#94a3b8', cursor:'pointer', ...f }}>
            Desconectar
          </button>
        </div>
      </div>

      {resultado && (
        <div style={{ background: resultado.ok ? '#f0fdf4' : '#fef2f2', border:`1px solid ${resultado.ok?'#a7f3d0':'#fecaca'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color: resultado.ok ? '#059669' : '#dc2626', fontWeight:500, ...f }}>
          {resultado.ok ? '✅' : '❌'} {resultado.msg}
        </div>
      )}

      {notificaciones.length === 0 && !cargando && (
        <div style={{ textAlign:'center', padding:'32px 20px', background:'#f8fafc', borderRadius:12, border:'1.5px dashed #e2e8f0' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13, color:'#94a3b8', ...f }}>Haz clic en "Revisar correos" para buscar notificaciones del PJUD y Fiscalía</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {notificaciones.map((n, i) => (
          <div key={i} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color: n.tipo==='PJUD'?'#2563eb':'#7c3aed', background: n.tipo==='PJUD'?'#eff6ff':'#faf5ff', padding:'3px 8px', borderRadius:20, border:`1px solid ${n.tipo==='PJUD'?'#bfdbfe':'#ddd6fe'}`, ...f }}>
                  {n.tipo}
                </span>
                <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', marginTop:6, ...f }}>{n.asunto}</div>
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', ...f }}>{new Date(n.fecha_correo).toLocaleDateString('es-CL')}</div>
            </div>

            <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
              {n.ruc && <div style={{ fontSize:11, color:'#64748b', ...f }}>RUC: <span style={{ fontFamily:'monospace', fontWeight:600, color:'#0f172a' }}>{n.ruc}</span></div>}
              {n.rit && <div style={{ fontSize:11, color:'#64748b', ...f }}>RIT: <span style={{ fontFamily:'monospace', fontWeight:600, color:'#0f172a' }}>{n.rit}</span></div>}
            </div>

            {n.audiencia?.fecha && (
              <div style={{ background:'#f0f7ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                <div style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1.2, marginBottom:4, fontWeight:600, ...f }}>Audiencia detectada</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  {n.audiencia.fecha && <span style={{ fontSize:12, fontWeight:600, color:'#2563eb', ...f }}>📅 {n.audiencia.fecha}</span>}
                  {n.audiencia.hora && <span style={{ fontSize:12, color:'#475569', ...f }}>🕐 {n.audiencia.hora}</span>}
                  {n.audiencia.tipo && <span style={{ fontSize:12, color:'#475569', ...f }}>⚖ {n.audiencia.tipo}</span>}
                  {n.audiencia.tribunal && <span style={{ fontSize:12, color:'#475569', ...f }}>🏛 {n.audiencia.tribunal.substring(0,30)}</span>}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => importarAudiencia(n)} disabled={procesando || !n.audiencia?.fecha}
                style={{ background: n.audiencia?.fecha ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#e2e8f0', color: n.audiencia?.fecha ? '#fff' : '#94a3b8', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:600, cursor: n.audiencia?.fecha ? 'pointer' : 'not-allowed', ...f }}>
                {procesando ? 'Importando...' : '+ Agregar al calendario'}
              </button>
              <button onClick={() => ignorar(n)}
                style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:7, padding:'7px 14px', fontSize:12, color:'#94a3b8', cursor:'pointer', ...f }}>
                Ignorar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
