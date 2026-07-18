# Notas de Joaquín — Seguridad y forma de trabajo (pendiente)

> Este archivo es solo de referencia interna. No es código, no afecta el
> funcionamiento de la app. Sirve para que cualquier sesión futura (mía o de
> otra persona) sepa qué está pendiente sin depender de que Joaquín lo repita.

## Cómo trabajar con Claude Code (resumen para Joaquín)

- Ser específico con el lugar del cambio (ej. "en la pestaña Honorarios de
  cada causa, agrega tal campo") en vez de instrucciones vagas.
- Se puede describir o pegar capturas de lo que se ve vs. lo que se espera ver.
- No hace falta repetir el contexto/historia — Claude Code lee el código
  directo y entiende la lógica existente.
- Pedir que se muestre el diff antes de cualquier commit/push, y probar en
  `localhost:3000` antes de subir a GitHub cuando el cambio sea delicado.
- Decisiones grandes de diseño/alcance se conversan primero, se ejecutan
  después.

## Seguridad pendiente — 2FA por correo (no urgente aún)

Cuando se trabaje el tema de seguridad completo (RLS de Supabase, 2FA,
respaldo de base de datos, etc.), el requisito es:

- **El código de verificación debe llegar por CORREO, no por SMS.**
- Correo destino: **jobregonabogado@gmail.com**
- Flujo esperado: acción sensible (ej. eliminar algo de forma permanente)
  pide un código → el código llega a ese correo → Joaquín lo copia y lo pega
  en la app para confirmar.

## Contexto del proyecto

- Sistema de gestión de causas penales para uso de la oficina de Joaquín
  (abogado penalista), desarrollado con mucho detalle propio del área penal.
- Intención a futuro (no inmediata): eventualmente ofrecerlo/venderlo a otras
  oficinas, una vez esté maduro. Esto implica que decisiones de arquitectura
  (multi-usuario, aislamiento de datos entre oficinas, etc.) conviene
  pensarlas con ese horizonte en mente, aunque no se implementen todavía.
- Primera vez de Joaquín programando — prioridad: no romper nada, avanzar
  con cuidado, revisar cambios antes de subirlos.
