// Notas / pendientes personales — antes vivía dentro del Centro de
// Alertas ("Pendientes"), pero Joaquín pidió sacarlo de ahí a su propia
// pestaña, siempre a un clic de distancia, separado de las alertas
// reactivas (audiencias, Fiscalía sin responder, etc.).
import { useState } from 'react'

const f = { fontFamily: "'Manrope','Inter',sans-serif" }

export default function Notas({ tareas, esTitular, onAgregarTarea, onCompletarTarea }) {
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [guardando, setGuardando] = useState(false)

  const pendientes = tareas.filter(t => !t.completada)
  const completadas = tareas.filter(t => t.completada)

  const handleAgregar = async () => {
    if (!nuevaTarea.trim()) return
    setGuardando(true)
    await onAgregarTarea(nuevaTarea.trim())
    setNuevaTarea('')
    setGuardando(false)
  }

  return (
    <div style={{ background: '#F8F9FC', minHeight: '100vh', ...f }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>Notas</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Anota lo que quieras ir haciendo — queda guardado acá, no es una alerta.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, ...f }}>Pendientes ({pendientes.length})</div>

          {esTitular && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={nuevaTarea}
                onChange={e => setNuevaTarea(e.target.value)}
                placeholder="Anotar algo pendiente..."
                onKeyDown={e => { if (e.key === 'Enter') handleAgregar() }}
                style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: "'Manrope','Inter',sans-serif", color: '#1E293B' }} />
              <button onClick={handleAgregar} disabled={guardando || !nuevaTarea.trim()} style={{ background: '#1E293B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Manrope','Inter',sans-serif", flexShrink: 0, opacity: guardando || !nuevaTarea.trim() ? 0.6 : 1 }}>{guardando ? '...' : '+ Agregar'}</button>
            </div>
          )}

          {pendientes.length === 0 ? (
            <div style={{ fontSize: 13, color: '#cbd5e1', textAlign: 'center', padding: '20px 0', ...f }}>Sin notas pendientes.</div>
          ) : pendientes.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <button onClick={() => onCompletarTarea(t.id)} title="Marcar como realizada"
                style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid #d97706', background: '#fff', cursor: 'pointer', flexShrink: 0, marginTop: 1, padding: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', ...f }}>{t.texto}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, ...f }}>Anotado por {t.creado_por} · {new Date(t.created_at).toLocaleString('es-CL')}</div>
              </div>
            </div>
          ))}

          {completadas.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, ...f }}>Completadas ({completadas.length})</div>
              {completadas.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F8F9FC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: '#059669', marginTop: 1, flexShrink: 0 }}>✓</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through', ...f }}>{t.texto}</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2, ...f }}>Realizada por {t.completada_por || '—'} · {t.completada_en ? new Date(t.completada_en).toLocaleString('es-CL') : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
