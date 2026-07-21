// Monograma "JOA" (Joaquín Obregón · Abarca) — logo definitivo de la oficina.
// Versión final aprobada por Joaquín: J, O y A del mismo tamaño, espaciadas,
// en Cormorant Garamond (trazo fino y elegante), con una línea dorada abajo.
// Se usa tanto en el ícono de la app (favicon) como en el login y en
// cualquier otro lugar donde se necesite la marca. Reutilizable tal cual
// también en la futura página web de la oficina.
import { useLayoutEffect } from 'react'

// Se inyecta la fuente una sola vez por página, sin importar cuántas veces
// se use <LogoJOA/>, para que este componente sea autosuficiente.
let fontInyectada = false
function useFuenteLogo() {
  useLayoutEffect(() => {
    if (fontInyectada || typeof document === 'undefined') return
    fontInyectada = true
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap'
    document.head.appendChild(link)
  }, [])
}

const FUENTE = "'Cormorant Garamond', Georgia, serif"

// variant:
//  - 'icon' (cuadrado con fondo navy, JOA + línea, sin texto — para favicon/ícono app)
//  - 'bare' (igual que 'icon' pero sin fondo, para poner sobre otro color)
//  - 'full' (JOA + línea + "OBREGÓN Y ASOCIADOS" abajo — para login, encabezados, la futura web)
export function LogoJOA({ size = 64, variant = 'icon', gold = '#d4af37', navy = '#1a1a2e', width }) {
  useFuenteLogo()

  if (variant === 'full') {
    const w = width || size * 1.6
    return (
      <svg width={w} height={size} viewBox="0 0 240 150">
        <text x="30" y="70" fontFamily={FUENTE} fontWeight="500" fontSize="44" fill={navy} textAnchor="middle">J</text>
        <text x="120" y="70" fontFamily={FUENTE} fontWeight="500" fontSize="44" fill={navy} textAnchor="middle">O</text>
        <text x="210" y="70" fontFamily={FUENTE} fontWeight="500" fontSize="44" fill={navy} textAnchor="middle">A</text>
        <rect x="20" y="86" width="200" height="1.6" fill={gold} />
        <text x="120" y="110" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="12" fill={navy} textAnchor="middle" letterSpacing="2.5">OBREGÓN Y ASOCIADOS</text>
      </svg>
    )
  }

  const letras = (colorLetras) => (
    <>
      <text x="20" y="78" fontFamily={FUENTE} fontWeight="500" fontSize="46" fill={colorLetras} textAnchor="middle">J</text>
      <text x="75" y="78" fontFamily={FUENTE} fontWeight="500" fontSize="46" fill={colorLetras} textAnchor="middle">O</text>
      <text x="130" y="78" fontFamily={FUENTE} fontWeight="500" fontSize="46" fill={colorLetras} textAnchor="middle">A</text>
      <rect x="14" y="94" width="122" height="1.8" fill={gold} />
    </>
  )

  if (variant === 'bare') {
    return (
      <svg width={size} height={size} viewBox="0 0 150 150">
        {letras(navy)}
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 150 150">
      <rect x="0" y="0" width="150" height="150" rx="24" fill={navy} />
      {letras(gold)}
    </svg>
  )
}
