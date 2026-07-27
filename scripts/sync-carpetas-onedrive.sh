#!/bin/bash
# Crea automáticamente, dentro de la carpeta de OneDrive "CAUSAS JOA", una
# carpeta con el RUC de cada causa VIGENTE que exista en la base de datos y
# que aún no tenga su carpeta creada. Pensado para correr periódicamente en
# segundo plano (ver com.gestorcausas.synconedrive.plist) — no borra ni toca
# nada existente, solo agrega carpetas nuevas si faltan. A propósito NO
# incluye causas terminadas: Joaquín pidió esto solo para las vigentes.
#
# Requiere: supabase CLI ya vinculado a este proyecto (`supabase link`, ya
# hecho antes en este Mac) y la carpeta de OneDrive sincronizada localmente.

set -euo pipefail

CARPETA_ONEDRIVE="/Users/joaquinobregon/Library/CloudStorage/OneDrive-Personal/JOAQUIN OBREGON/CAUSAS JOA"
PROYECTO="/Users/joaquinobregon/Developer/gestor-causas"
LOG="/Users/joaquinobregon/Developer/gestor-causas/scripts/sync-carpetas-onedrive.log"

cd "$PROYECTO"

if [ ! -d "$CARPETA_ONEDRIVE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') — ERROR: no se encontró la carpeta de OneDrive ($CARPETA_ONEDRIVE). ¿OneDrive está sincronizado?" >> "$LOG"
  exit 1
fi

RUCS_JSON=$(supabase db query --linked "SELECT ruc FROM causas WHERE ruc IS NOT NULL AND ruc != '' AND estado = 'vigente'" 2>/dev/null)

CREADAS=$(python3 - "$CARPETA_ONEDRIVE" <<PYEOF
import json, os, sys

carpeta = sys.argv[1]
raw = """$RUCS_JSON"""
start = raw.index('{')
data = json.loads(raw[start:])
rucs = [r['ruc'] for r in data.get('rows', []) if r.get('ruc')]

existentes = {e.upper() for e in os.listdir(carpeta) if not e.startswith('.')}

creadas = []
for ruc in rucs:
    if ruc.upper() not in existentes:
        os.makedirs(os.path.join(carpeta, ruc), exist_ok=True)
        creadas.append(ruc)

print('\n'.join(creadas))
PYEOF
)

if [ -n "$CREADAS" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') — Carpetas creadas:" >> "$LOG"
  echo "$CREADAS" | sed 's/^/  /' >> "$LOG"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') — Sin novedades, todas las causas ya tienen carpeta." >> "$LOG"
fi
