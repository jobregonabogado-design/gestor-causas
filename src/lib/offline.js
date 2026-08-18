// Modo sin conexión — primera etapa: ver una causa ya abierta antes y
// registrar el resultado/edición de una audiencia sin señal, mandándolo
// solo apenas vuelva la conexión. Todo vive en localStorage (mismo
// espíritu que ya usa CodigosLeyes.jsx para guardar su caché).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const PREFIJO_CAUSA = 'lexoffice_causa_'
const CLAVE_ORDEN_CAUSAS = 'lexoffice_causas_orden'
const MAX_CAUSAS_CACHE = 30
const CLAVE_COLA = 'lexoffice_cola_pendiente'

export function estaOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

// ─── Caché de causas ya abiertas ──────────────────────────────────────────
function leerOrdenCausas() {
  try {
    const raw = localStorage.getItem(CLAVE_ORDEN_CAUSAS)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function guardarCausaEnCache(causaId, datos) {
  try {
    localStorage.setItem(PREFIJO_CAUSA + causaId, JSON.stringify({ ...datos, guardadoEn: Date.now() }))
    const orden = leerOrdenCausas().filter(id => id !== causaId)
    orden.push(causaId)
    // Se guardan como máximo las últimas MAX_CAUSAS_CACHE — se bota la más
    // antigua sin usar para no llenar el localStorage del navegador.
    while (orden.length > MAX_CAUSAS_CACHE) {
      const vieja = orden.shift()
      localStorage.removeItem(PREFIJO_CAUSA + vieja)
    }
    localStorage.setItem(CLAVE_ORDEN_CAUSAS, JSON.stringify(orden))
  } catch { /* localStorage lleno o no disponible — no es crítico, se sigue sin caché */ }
}

export function leerCausaDeCache(causaId) {
  try {
    const raw = localStorage.getItem(PREFIJO_CAUSA + causaId)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── Cola de escrituras pendientes ────────────────────────────────────────
function leerCola() {
  try {
    const raw = localStorage.getItem(CLAVE_COLA)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function guardarCola(cola) {
  try { localStorage.setItem(CLAVE_COLA, JSON.stringify(cola)) } catch { /* ignorar */ }
}

const listeners = new Set()
function notificarCambioCola() { listeners.forEach(fn => fn()) }

export function encolarEscritura({ tabla, id, campos }) {
  const cola = leerCola()
  cola.push({ tabla, id, campos, creadoEn: Date.now() })
  guardarCola(cola)
  notificarCambioCola()
}

export function contarPendientes() {
  return leerCola().length + contarCausasPendientes()
}

// ─── Causas nuevas creadas sin conexión ───────────────────────────────────
// A diferencia de un simple UPDATE (audiencias), crear una causa implica
// varias filas relacionadas (causa → imputados → cautelares) y Joaquín
// necesita VER la causa en la lista al tiro, aunque siga sin señal — por
// eso se maneja aparte de la cola genérica de arriba.
const CLAVE_CAUSAS_PENDIENTES = 'lexoffice_causas_pendientes'

function leerCausasPendientes() {
  try {
    const raw = localStorage.getItem(CLAVE_CAUSAS_PENDIENTES)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function guardarCausasPendientes(lista) {
  try { localStorage.setItem(CLAVE_CAUSAS_PENDIENTES, JSON.stringify(lista)) } catch { /* ignorar */ }
}

export function contarCausasPendientes() {
  return leerCausasPendientes().length
}

// Encola una causa nueva completa para crearla de verdad apenas vuelva la
// señal, y devuelve un objeto "optimista" (con un id temporal, prefijo
// "temp_") listo para mostrar en la lista de causas mientras tanto — así
// Joaquín la ve y puede seguir trabajando con ella sin esperar a
// sincronizar. `imputados` es un arreglo de {datos, cautelar} — cautelar
// puede ser null si ese imputado no tiene una medida con fecha que registrar.
export function encolarCausaNueva({ causaData, imputados }) {
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  const pendientes = leerCausasPendientes()
  pendientes.push({ tempId, causaData, imputados, creadoEn: Date.now() })
  guardarCausasPendientes(pendientes)
  notificarCambioCola()
  return { id: tempId, ...causaData, _pendienteSync: true }
}

// Causas ya encoladas de una sesión anterior (ej. se cerró la app antes de
// que volviera la señal) — para que Dashboard.jsx las siga mostrando en la
// lista al abrir de nuevo, no solo mientras estaba la pestaña abierta.
export function leerCausasPendientesOptimistas() {
  return leerCausasPendientes().map(p => ({ id: p.tempId, ...p.causaData, _pendienteSync: true }))
}

let sincronizandoCausas = false
// Crea de verdad, en orden, cada causa encolada (causa → imputados →
// cautelares) — si una falla, se detiene ahí (no se pierde el orden) y
// reintenta la próxima vez. `onCausaSincronizada(tempId, causaReal)` se
// llama por cada una que se logra crear, para que Dashboard.jsx reemplace
// la versión "pendiente" por la real (con su id verdadero) en pantalla.
export async function sincronizarCausasPendientes(onCausaSincronizada) {
  if (sincronizandoCausas || !estaOnline()) return
  sincronizandoCausas = true
  try {
    let pendientes = leerCausasPendientes()
    while (pendientes.length > 0) {
      const item = pendientes[0]
      let causaReal
      try {
        const { data, error } = await supabase.from('causas').insert(item.causaData).select().single()
        if (error) break
        causaReal = data
        for (const imp of item.imputados) {
          const { data: impData } = await supabase.from('imputados').insert({ ...imp.datos, causa_id: causaReal.id }).select().single()
          if (impData && imp.cautelar) {
            await supabase.from('cautelares_causa').insert({ ...imp.cautelar, causa_id: causaReal.id, imputado_id: impData.id })
          }
        }
      } catch {
        break
      }
      pendientes = pendientes.slice(1)
      guardarCausasPendientes(pendientes)
      notificarCambioCola()
      if (onCausaSincronizada) onCausaSincronizada(item.tempId, causaReal)
    }
  } finally {
    sincronizandoCausas = false
  }
}

let sincronizando = false
// Manda los cambios encolados a Supabase EN ORDEN — si uno falla (sigue sin
// señal de verdad), se detiene ahí mismo sin perder el orden, y reintenta
// la próxima vez que se llame (al volver la conexión, o al abrir la app).
export async function sincronizarCola() {
  if (sincronizando || !estaOnline()) return
  sincronizando = true
  try {
    let cola = leerCola()
    while (cola.length > 0) {
      const item = cola[0]
      try {
        const { error } = await supabase.from(item.tabla).update(item.campos).eq('id', item.id)
        if (error) break
      } catch {
        break
      }
      cola = cola.slice(1)
      guardarCola(cola)
      notificarCambioCola()
    }
  } finally {
    sincronizando = false
  }
}

// ✅ Escritura "a prueba de sin señal": intenta mandar a Supabase de
// inmediato; si no hay conexión (o el intento falla por red, aunque
// navigator.onLine todavía no se haya dado cuenta), en vez de mostrar un
// error lo encola para mandarlo solo apenas vuelva la señal. Nunca lanza —
// devuelve {ok, offline}. Un error real de Supabase (ej. dato inválido, sin
// permiso) SÍ se devuelve como error, no se esconde encolándolo.
export async function actualizarConCola(tabla, id, campos) {
  if (!estaOnline()) {
    encolarEscritura({ tabla, id, campos })
    return { ok: true, offline: true }
  }
  try {
    const { error } = await supabase.from(tabla).update(campos).eq('id', id)
    if (error) return { ok: false, offline: false, error }
    return { ok: true, offline: false }
  } catch {
    encolarEscritura({ tabla, id, campos })
    return { ok: true, offline: true }
  }
}

// ─── Aviso a la UI (barra de arriba) del estado de conexión/cola ─────────
export function useEstadoConexion() {
  const [online, setOnline] = useState(estaOnline())
  const [pendientes, setPendientes] = useState(contarPendientes())

  const actualizarPendientes = useCallback(() => setPendientes(contarPendientes()), [])

  useEffect(() => {
    listeners.add(actualizarPendientes)
    // Sin callback acá — Dashboard.jsx sincroniza las causas pendientes por
    // su cuenta (con su propio callback, para reemplazar el id temporal por
    // el real en su lista) al montar; esto es solo un respaldo para que las
    // causas encoladas se manden a Supabase igual aunque Dashboard no esté
    // abierto en ese momento.
    const onOnline = () => { setOnline(true); sincronizarCola(); sincronizarCausasPendientes() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    sincronizarCola() // por si quedó algo pendiente de una sesión anterior
    sincronizarCausasPendientes()
    return () => {
      listeners.delete(actualizarPendientes)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [actualizarPendientes])

  return { online, pendientes }
}
