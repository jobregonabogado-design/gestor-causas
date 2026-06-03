import { useState, useMemo } from 'react'

const AUDIENCIAS = [
  {fecha:'2026-01-05',hora:'11:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'APJO-ABREVIADO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2026-01-05',hora:'11:00',rit:'5085-2021',ruc:'2000530196-4',tribunal:'13 JG STGO',sala:'F-601',tipo:'APJOS',imputado:'MARIA ANGELICA VIDAL CONCHA'},
  {fecha:'2026-01-06',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGANTE',sala:'',tipo:'APJO ABREVIADO',imputado:'SEBASTIAN PARRA GONZALEZ'},
  {fecha:'2026-01-06',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'204',tipo:'ABREVIADO',imputado:'ALEXIS ARNALDO GODOY GODOY'},
  {fecha:'2026-01-07',hora:'10:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'503',tipo:'REF/REPARATORIO/CIERRE',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2026-01-07',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'',tipo:'AUMENTO Y CIERRE',imputado:'SEBASTIAN SANCHEZ GUZMAN'},
  {fecha:'2026-01-08',hora:'10:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'REV PP-ABREVIADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-09',hora:'09:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'ZOOM',tipo:'AUMENTO DE PLAZO',imputado:'ELSA ROMERO RIQUELME'},
  {fecha:'2026-01-12',hora:'10:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'APJO ABREVIADO REV CAUTELARES',imputado:'RICARDO GODOY VILLAGARAN'},
  {fecha:'2026-01-14',hora:'09:00',rit:'209-2026',ruc:'',tribunal:'ICA STGO',sala:'TERCERA',tipo:'APELACION CAUTELAR',imputado:'SEBASTIAN PARTAGUEZ Y EDUARDO MORALES'},
  {fecha:'2026-01-14',hora:'09:00',rit:'8837-2017',ruc:'1700575458-5',tribunal:'11 JG STGO',sala:'E-501',tipo:'CAUTELA DE GARANTIAS',imputado:'FRANCISCO JAVIER SANDOVAL ARENAS'},
  {fecha:'2026-01-15',hora:'10:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'B-503',tipo:'REV PP',imputado:'RODRIGO PONCE CASTILLO - IGNACIO CONTRERAS SUFAN'},
  {fecha:'2026-01-15',hora:'11:00',rit:'1065-2024',ruc:'2400548142-9',tribunal:'JG CANETE',sala:'',tipo:'JOS',imputado:'CRISTIAN RODRIGUEZ VALDES'},
  {fecha:'2026-01-15',hora:'12:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'TRASPASO UNIDAD PENAL',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-16',hora:'09:00',rit:'1045-2025',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'APJO-ABREVIADO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-01-19',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'AUMENTO',imputado:'DAGO REYES REYES - NELSON LLEMPI'},
  {fecha:'2026-01-21',hora:'09:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3 JG STGO',sala:'902',tipo:'APJO',imputado:'JONNIER FABIAN GARCES'},
  {fecha:'2026-01-21',hora:'10:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'SALA 3',tipo:'ABREVIADO/AUMENTO',imputado:'JUAN ELIECER FLORES FARIAS'},
  {fecha:'2026-01-21',hora:'11:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'APJO (2)',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-01-21',hora:'13:30',rit:'384-2025',ruc:'2200390509-1',tribunal:'4 TOP',sala:'ZOOM',tipo:'COORDINACION',imputado:'LUIS ALBERTO FERNANDEZ VEGA'},
  {fecha:'2026-01-22',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'804',tipo:'REVPP/ABREV/TRASLADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-26',hora:'11:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'',tipo:'REFORMALIZACION-REVPP-AUMENTO',imputado:'FELIPE AVENDANO TORTOZA'},
  {fecha:'2026-01-26',hora:'12:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12 JG STGO',sala:'',tipo:'ABREVIADO',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2026-01-27',hora:'09:00',rit:'384-2025',ruc:'2200390509-1',tribunal:'4 TOP',sala:'',tipo:'JO',imputado:'LUIS ALBERTO FERNANDEZ VEGA'},
  {fecha:'2026-01-28',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'403',tipo:'ABREVIADO COIMP',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-02-02',hora:'10:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'503',tipo:'DNP',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2026-02-03',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'CIERRE',imputado:'DAGO REYES REYES - NELSON LLEMPI'},
  {fecha:'2026-02-04',hora:'15:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'ZOOM',tipo:'ENTREVISTA',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2026-02-04',hora:'09:30',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'701',tipo:'ABONO CAUSA DIVERSA',imputado:'MARCELO SILVA FERNANDEZ'},
  {fecha:'2026-02-05',hora:'11:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'',tipo:'CIERRE',imputado:'JORGE ROLANDO VEGA RAMOS'},
  {fecha:'2026-02-09',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-02-09',hora:'08:30',rit:'06-2026',ruc:'2210043625-K',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-02-10',hora:'09:15',rit:'7512-2022',ruc:'2201048885-4',tribunal:'JG VALPARAISO',sala:'',tipo:'CAUTELA DE GARANTIAS',imputado:'MIGUEL CANUTA VALDERRAMA'},
  {fecha:'2026-02-10',hora:'11:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'SALA 3',tipo:'REPARATORIO',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2026-02-11',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'',tipo:'REFORMALIZACION ABREVIADO',imputado:'SEBASTIAN SANCHEZ GUZMAN'},
  {fecha:'2026-02-17',hora:'08:30',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'ABREVIADO',imputado:'GONZALO SEBASTIAN GOMEZ MARTINEZ'},
  {fecha:'2026-02-20',hora:'09:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JO',imputado:'CARLOS ARRIAGADA DIAZ'},
  {fecha:'2026-02-25',hora:'09:00',rit:'06-2026',ruc:'2210043625-K',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-03-06',hora:'14:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'LECTURA SENTENCIA',imputado:'CARLOS PATRICIO ARRIAGADA DIAZ'},
  {fecha:'2026-03-12',hora:'09:00',rit:'133-2025',ruc:'2300081967-0',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JUICIO ORAL',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2026-04-22',hora:'09:00',rit:'01-2026',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'',tipo:'JO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-05-04',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'503',tipo:'CIERRE',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-06-02',hora:'08:30',rit:'1712-2025',ruc:'2501404704-5',tribunal:'JG SAN JAVIER',sala:'ZOOM',tipo:'APJO',imputado:'HUGO ALEJANDRO MUNOZ BRAVO'},
  {fecha:'2026-06-02',hora:'10:00',rit:'5545-2020',ruc:'1901383927-4',tribunal:'2 JG STGO',sala:'404',tipo:'REVISION DE SENTENCIA',imputado:'CLAUDIO NVARRETE TRONCOSO'},
  {fecha:'2026-06-08',hora:'09:30',rit:'5551-2023',ruc:'2301089527-8',tribunal:'14 JG STGO',sala:'904',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'ALFONSO SANTOS VALENZUELA'},
  {fecha:'2026-06-10',hora:'10:00',rit:'2785-2026',ruc:'2600454946-4',tribunal:'JG SAN BERNARDO',sala:'SALA2',tipo:'REVPP/AUMENTO',imputado:'PAULO URRUTIA PEREZ'},
  {fecha:'2026-06-15',hora:'10:00',rit:'771-2026',ruc:'2600181607-0',tribunal:'2 JG STGO',sala:'503',tipo:'AUMENTO',imputado:'DYLAN REBOLLEDO RUBILAR'},
]

// Color por tipo de audiencia
function tipoColor(tipo) {
  const t = tipo.toUpperCase()
  if (t.includes('JUICIO ORAL') || t.includes('JO')) return { bg: '#fef2f2', border: '#ef4444', dot: '#ef4444' }
  if (t.includes('ABREVIADO')) return { bg: '#eff6ff', border: '#3b82f6', dot: '#3b82f6' }
  if (t.includes('APJO')) return { bg: '#f5f3ff', border: '#8b5cf6', dot: '#8b5cf6' }
  if (t.includes('REV PP') || t.includes('REVPP')) return { bg: '#fff7ed', border: '#f97316', dot: '#f97316' }
  if (t.includes('AUMENTO') || t.includes('CIERRE')) return { bg: '#f0fdf4', border: '#22c55e', dot: '#22c55e' }
  if (t.includes('ENTREVISTA') || t.includes('DECLARACION')) return { bg: '#fefce8', border: '#eab308', dot: '#eab308' }
  if (t.includes('CAUTELA') || t.includes('APELACION')) return { bg: '#fdf2f8', border: '#ec4899', dot: '#ec4899' }
  return { bg: '#f9fafb', border: '#6b7280', dot: '#6b7280' }
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const COLORES_DIA = ['#fef2f2','#fff7ed','#fefce8','#f0fdf4','#eff6ff','#f5f3ff','#fdf4ff']

export default function Calendario() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [selDia, setSelDia] = useState(null)
  const [vistaLista, setVistaLista] = useState(false)

  const audienciasPorFecha = useMemo(() => {
    const map = {}
    AUDIENCIAS.forEach(a => {
      if (!map[a.fecha]) map[a.fecha] = []
      map[a.fecha].push(a)
    })
    return map
  }, [])

  const diasDelMes = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const ultimo = new Date(anio, mes + 1, 0)
    const dias = []
    for (let i = 0; i < primero.getDay(); i++) dias.push(null)
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(d)
    return dias
  }, [mes, anio])

  const audDelDia = selDia ? (audienciasPorFecha[`${anio}-${String(mes+1).padStart(2,'0')}-${String(selDia).padStart(2,'0')}`] || []) : []

  const audDelMes = useMemo(() => {
    const prefix = `${anio}-${String(mes+1).padStart(2,'0')}`
    return AUDIENCIAS.filter(a => a.fecha.startsWith(prefix)).sort((a,b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
  }, [mes, anio])

  const leyenda = [
    { label: 'Juicio Oral', color: '#ef4444' },
    { label: 'Abreviado', color: '#3b82f6' },
    { label: 'APJO', color: '#8b5cf6' },
    { label: 'Rev PP', color: '#f97316' },
    { label: 'Aumento/Cierre', color: '#22c55e' },
    { label: 'Entrevista', color: '#eab308' },
    { label: 'Cautela/Apel.', color: '#ec4899' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111111' }}>📅 Calendario de Audiencias</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{audDelMes.length} audiencias en {MESES[mes]} {anio}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setVistaLista(!vistaLista)}
            style={{ background: vistaLista ? '#111111' : '#f3f4f6', color: vistaLista ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {vistaLista ? '📅 Calendario' : '📋 Lista'}
          </button>
          <button onClick={() => { if (mes === 0) { setMes(11); setAnio(a => a-1) } else setMes(m => m-1) }}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center', color: '#111' }}>{MESES[mes]} {anio}</span>
          <button onClick={() => { if (mes === 11) { setMes(0); setAnio(a => a+1) } else setMes(m => m+1) }}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {leyenda.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {!vistaLista ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Grilla calendario */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            {/* Cabecera días semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#111111' }}>
              {DIAS_SEMANA.map((d,i) => (
                <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: i===0||i===6 ? '#f87171' : '#ffffff', letterSpacing: 0.5 }}>{d}</div>
              ))}
            </div>
            {/* Días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {diasDelMes.map((dia, i) => {
                if (!dia) return <div key={i} style={{ minHeight: 72, background: '#fafafa', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }} />
                const key = `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
                const auds = audienciasPorFecha[key] || []
                const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()
                const seleccionado = dia === selDia
                const diaSemana = new Date(anio, mes, dia).getDay()
                const esFinDeSemana = diaSemana === 0 || diaSemana === 6
                const bgDia = esFinDeSemana ? '#fafafa' : (auds.length > 0 ? '#fefffe' : '#ffffff')
                return (
                  <div key={dia} onClick={() => setSelDia(dia === selDia ? null : dia)}
                    style={{ minHeight: 72, padding: '6px', background: seleccionado ? '#f0f9ff' : bgDia, borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s', outline: seleccionado ? '2px solid #3b82f6' : 'none', outlineOffset: -2 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: esHoy ? '#111111' : 'transparent', color: esHoy ? '#fff' : esFinDeSemana ? '#9ca3af' : '#111', fontSize: 12, fontWeight: esHoy ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 3 }}>{dia}</div>
                    {auds.slice(0,3).map((a,idx) => {
                      const c = tipoColor(a.tipo)
                      return (
                        <div key={idx} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: c.bg, borderLeft: `2px solid ${c.dot}`, color: '#374151', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.hora} {a.tipo.split('/')[0].substring(0,12)}
                        </div>
                      )
                    })}
                    {auds.length > 3 && <div style={{ fontSize: 9, color: '#6b7280', paddingLeft: 2 }}>+{auds.length-3} más</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel lateral */}
          <div>
            {selDia && audDelDia.length > 0 ? (
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111' }}>
                  {selDia} de {MESES[mes]} — {audDelDia.length} audiencia{audDelDia.length>1?'s':''}
                </h3>
                {audDelDia.map((a,i) => {
                  const c = tipoColor(a.tipo)
                  return (
                    <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.dot }}>{a.tipo}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: '#fff', padding: '2px 8px', borderRadius: 20, border: '1px solid #e5e7eb' }}>🕐 {a.hora}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>👤 {a.imputado}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>🏛 {a.tribunal}{a.sala ? ` — Sala ${a.sala}` : ''}</div>
                      {a.rit && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>RIT: {a.rit}</div>}
                    </div>
                  )
                })}
              </div>
            ) : selDia ? (
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Sin audiencias el {selDia} de {MESES[mes]}
              </div>
            ) : (
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111' }}>Próximas audiencias — {MESES[mes]}</h3>
                {audDelMes.slice(0,8).map((a,i) => {
                  const c = tipoColor(a.tipo)
                  const dia = a.fecha.split('-')[2]
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ minWidth: 36, height: 36, background: c.dot, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{dia}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.dot }}>{a.tipo}</div>
                        <div style={{ fontSize: 11, color: '#374151' }}>{a.imputado}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.tribunal} — {a.hora}</div>
                      </div>
                    </div>
                  )
                })}
                {audDelMes.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin audiencias este mes.</p>}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Vista lista */
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111111' }}>
                {['Fecha','Hora','Tipo','Imputado','Tribunal','Sala','RIT'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audDelMes.map((a,i) => {
                const c = tipoColor(a.tipo)
                return (
                  <tr key={i} style={{ background: i%2===0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, color: '#111' }}>{a.fecha}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#374151' }}>{a.hora}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.dot, border: `1px solid ${c.border}`, fontWeight: 600 }}>{a.tipo}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#374151' }}>{a.imputado}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b7280' }}>{a.tribunal}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b7280' }}>{a.sala || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: '#9ca3af' }}>{a.rit}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {audDelMes.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Sin audiencias en {MESES[mes]} {anio}</div>}
        </div>
      )}
    </div>
  )
}
