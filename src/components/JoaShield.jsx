// Escudo JOA — logo del estudio (Obregón y Asociados), construido en CSS
// puro (sin imágenes): escala sin pérdida y se puede recolorear. Viene del
// handoff de diseño del login (design_handoff_login_joa/JoaShield.jsx).
// Uso: <JoaShield height={118} />   |   <JoaShield height={46} compact />
export default function JoaShield({
  height = 118,
  compact = false, // oculta "Est. 2017" y "Abogados" (para tamaños chicos)
  bg = '#2F5D48',
  gold = '#A8925F',
  ink = '#FAF7F0',
}) {
  const k = height / 118 // escala proporcional al diseño original (104 x 118)
  const px = n => (n * k).toFixed(2) + 'px'
  return (
    <div
      aria-label="Obregón y Asociados"
      style={{
        width: px(104),
        height: px(118),
        background: bg,
        padding: px(5),
        display: 'flex',
        boxShadow: '0 0 0 1px rgba(168,146,95,.35)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          border: '1px solid ' + gold,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: px(8),
        }}
      >
        {!compact && (
          <div style={{ fontSize: px(6.5), letterSpacing: '.3em', textTransform: 'uppercase', color: gold }}>
            Est. 2017
          </div>
        )}
        <div
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: px(27),
            lineHeight: 1,
            color: ink,
            letterSpacing: '.18em',
            textIndent: '.18em',
          }}
        >
          JOA
        </div>
        <div style={{ width: px(34), height: '1px', background: gold }} />
        {!compact && (
          <div style={{ fontSize: px(6.5), letterSpacing: '.26em', textTransform: 'uppercase', color: gold }}>
            Abogados
          </div>
        )}
      </div>
    </div>
  )
}
