// Solicitud de visita a CDP Santiago I por correo — Joaquín debe avisar por
// correo a Gendarmería el día ANTES de ir (antes de las 22:00), a una sola
// casilla fija, indicando el día, si va en el bloque AM o PM, y el nombre +
// RUT de cada interno que va a entrevistar. Antes lo escribía a mano cada
// vez; esto arma y manda el mismo correo con un clic.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isGmailConnected, loginGmail, enviarCorreo } from '../lib/gmail'
import { fechaDDMM } from '../pages/dashboard/utils'

const f = { fontFamily: "'Manrope','Inter',sans-serif" }
const CORREO_GENDARMERIA = 'agendaabogados.stgo1@gendarmeria.cl'

// Solo interesa "CDP Santiago I" (no "Santiago II" ni otro que empiece
// parecido) — se acepta seguido de espacio, guion, o que termine ahí mismo.
function esSantiagoI(lugar) {
  return /^CDP\s+SANTIAGO\s+I(\s|-|$)/i.test((lugar || '').trim())
}

function hoyMasUnDia() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechaLarga(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })
}

function construirCorreo({ fecha, bloque, internos, abogado }) {
  const listaInternos = internos.map(i => `${i.nombre}\n${i.rut || '(sin RUT registrado)'}`).join('\n\n')
  const body = `Estimados

Junto con saludar, el día de mañana ${fechaLarga(fecha)} en el bloque ${bloque} quisiera entrevistarme con ${internos.length > 1 ? 'los siguientes internos' : 'el siguiente interno'}

${listaInternos}


\t${abogado.nombre}
\tAbogado
${abogado.run}`
  return { to: CORREO_GENDARMERIA, subject: 'Visita abogado', body }
}

export default function SolicitudVisitaSantiagoI({ session, registrarActividad }) {
  const [internos, setInternos] = useState([])
  // ✅ NUEVO: personas que Joaquín va a ver pero que todavía no tiene
  // registradas en Gestor de Causas (ej. lo llaman para una causa nueva y
  // no sabe todavía si la va a tomar) — se agregan a mano solo para este
  // correo, no crean ni tocan ninguna causa.
  const [manuales, setManuales] = useState([])
  const [nombreManual, setNombreManual] = useState('')
  const [rutManual, setRutManual] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [fecha, setFecha] = useState(hoyMasUnDia())
  const [bloque, setBloque] = useState('AM')
  const [abogado, setAbogado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => { cargarInternos(); cargarAbogado() }, [])

  const cargarInternos = async () => {
    const { data } = await supabase
      .from('imputados')
      .select('id, nombre, rut, lugar_detencion, causas!inner(estado), cautelares_causa!inner(tipo, fecha_termino)')
      .eq('causas.estado', 'vigente')
      .in('cautelares_causa.tipo', ['Prisión Preventiva', 'Internación Provisoria'])
      .is('cautelares_causa.fecha_termino', null)
    setInternos((data || []).filter(i => esSantiagoI(i.lugar_detencion)))
  }

  const cargarAbogado = async () => {
    const email = session?.user?.email
    if (!email) return
    const { data } = await supabase.from('perfil_abogado').select('*').eq('email', email).maybeSingle()
    setAbogado({ nombre: data?.nombre || 'JOAQUÍN IGNACIO OBREGÓN ABARCA', run: data?.run || '17.348.087-3' })
  }

  const toggle = (id) => setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const agregarManual = () => {
    if (!nombreManual.trim()) return
    const id = 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    setManuales(prev => [...prev, { id, nombre: nombreManual.trim(), rut: rutManual.trim(), manual: true }])
    setSeleccionados(prev => [...prev, id])
    setNombreManual('')
    setRutManual('')
  }
  const quitarManual = (id) => {
    setManuales(prev => prev.filter(m => m.id !== id))
    setSeleccionados(prev => prev.filter(x => x !== id))
  }

  const listaCompleta = [...internos, ...manuales]

  const enviar = async () => {
    setEnviando(true)
    setResultado(null)
    try {
      const elegidos = listaCompleta.filter(i => seleccionados.includes(i.id))
      const { to, subject, body } = construirCorreo({ fecha, bloque, internos: elegidos, abogado })
      await enviarCorreo({ to, subject, body })
      if (registrarActividad) registrarActividad('accion', `Envió solicitud de visita a Santiago I para el ${fechaLarga(fecha)} (${bloque}): ${elegidos.map(i => i.nombre).join(', ')}`)
      // ✅ NUEVO: a cada persona que YA estaba registrada (imputado real, no
      // agregada a mano) se le anota esta visita en su ficha — mismo
      // historial que usa "Registrar visita" dentro de la causa — para que
      // "días sin visita" del Centro de Alertas quede al día solo, sin que
      // Joaquín tenga que ir a registrarla de nuevo a mano.
      for (const p of elegidos) {
        if (p.manual) continue
        const linea = `[${fechaDDMM(fecha)}] Visita registrada (solicitud a Santiago I)`
        const nuevoHistorial = p.visitas_historial ? p.visitas_historial + '\n' + linea : linea
        const nuevaUltima = (!p.ultima_visita || fecha > p.ultima_visita) ? fecha : p.ultima_visita
        await supabase.from('imputados').update({ visitas_historial: nuevoHistorial, ultima_visita: nuevaUltima }).eq('id', p.id)
      }
      setResultado({ ok: true, mensaje: `Correo enviado a ${to}.` })
      setSeleccionados([])
      setManuales([])
      if (elegidos.some(p => !p.manual)) cargarInternos()
    } catch (err) {
      // Si la sesión de Gmail guardada es de antes de agregar el permiso de
      // enviar, el token existe pero no alcanza — se pide reconectar en vez
      // de mostrar un error críptico.
      if (/403|reconecta gmail/i.test(err?.message || '')) {
        setResultado({ ok: false, mensaje: 'Tu conexión con Gmail no tiene permiso para enviar — apreta "Conectar Gmail" de nuevo para autorizarlo.', reconectar: true })
      } else {
        setResultado({ ok: false, mensaje: 'No se pudo enviar: ' + (err?.message || 'Error desconocido.') })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, ...f }}>Solicitar visita a Santiago I</div>

      {!isGmailConnected() ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: '#92400e', marginBottom: 8, ...f }}>Para mandar el correo solo, conecta tu Gmail (una vez) con permiso para enviar.</div>
          <button onClick={loginGmail} style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#92400e', cursor: 'pointer', fontWeight: 600, ...f }}>🔗 Conectar Gmail</button>
        </div>
      ) : (
        <div style={{ background: '#FAF7F0', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, ...f }} />
            {['AM', 'PM'].map(b => (
              <button key={b} onClick={() => setBloque(b)}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: `1.5px solid ${bloque === b ? '#1E3A2F' : '#e2e8f0'}`, background: bloque === b ? '#1E3A2F' : '#fff', color: bloque === b ? '#fff' : '#64748b', cursor: 'pointer', ...f }}>{b}</button>
            ))}
          </div>

          {listaCompleta.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                <input type="checkbox" checked={seleccionados.includes(i.id)} onChange={() => toggle(i.id)} />
                <span style={{ fontSize: 13, color: '#1E3A2F', ...f }}>{i.nombre || 'Sin nombre'}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', ...f }}>{i.rut || 'sin RUT'}</span>
                {i.manual && <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 5, padding: '1px 6px', ...f }}>no registrado</span>}
              </label>
              {i.manual && (
                <button onClick={() => quitarManual(i.id)} title="Quitar" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>
              )}
            </div>
          ))}

          {/* ✅ NUEVO: agregar a mano a alguien que aún no está en Gestor de
              Causas (ej. lo llamaron por una causa nueva que todavía no
              agrega porque no sabe si la va a tomar) — solo para este
              correo, no crea nada en el sistema. */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <input placeholder="Nombre" value={nombreManual} onChange={e => setNombreManual(e.target.value)}
              style={{ flex: '1 1 140px', padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, ...f }} />
            <input placeholder="RUT (opcional)" value={rutManual} onChange={e => setRutManual(e.target.value)}
              style={{ flex: '1 1 100px', padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, ...f }} />
            <button type="button" onClick={agregarManual} disabled={!nombreManual.trim()}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#1E3A2F', cursor: nombreManual.trim() ? 'pointer' : 'default', opacity: nombreManual.trim() ? 1 : 0.5, fontWeight: 600, ...f }}>+ Agregar</button>
          </div>

          <button onClick={enviar} disabled={enviando || seleccionados.length === 0}
            style={{ marginTop: 10, background: '#1E3A2F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: seleccionados.length === 0 ? 'default' : 'pointer', opacity: seleccionados.length === 0 ? 0.5 : 1, ...f }}>
            {enviando ? 'Enviando...' : `📧 Enviar solicitud (${seleccionados.length})`}
          </button>

          {resultado && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: resultado.ok ? '#065f46' : '#dc2626', ...f }}>
                {resultado.ok ? '✅ ' : '⚠ '}{resultado.mensaje}
              </div>
              {resultado.reconectar && (
                <button onClick={loginGmail} style={{ marginTop: 6, background: '#fff', border: '1px solid #fecaca', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600, ...f }}>🔗 Conectar Gmail</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
