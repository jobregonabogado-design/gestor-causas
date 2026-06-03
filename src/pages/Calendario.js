import { useState, useMemo } from 'react'

const AUDIENCIAS = [
  {fecha:'2025-03-18',hora:'09:00',rit:'466-2025',ruc:'2500065512-3',tribunal:'4 JG STGO',sala:'903',tipo:'SCP',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2025-03-18',hora:'11:00',rit:'572-2024',ruc:'2400054769-3',tribunal:'7 JG STGO',sala:'302',tipo:'REVOCACION LEY 18216',imputado:'FRANCISCO ESTEBAN PERERIRA OLMEDO'},
  {fecha:'2025-03-18',hora:'11:00',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'VISITA CARCEL/ DECLARACION',imputado:'DAGO REYES REYES / ALVARO REYES PAINEO'},
  {fecha:'2025-03-19',hora:'09:00',rit:'640-2025',ruc:'',tribunal:'ICA VALPARAISO',sala:'',tipo:'CONFIRMADO/ DECLARACION INCOMPETENCIA',imputado:'MARISOL LAGOS GOMEZ'},
  {fecha:'2025-03-19',hora:'09:00',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'DECLARACION',imputado:'DAGO REYES Y ALVARO RAYES PAINEO'},
  {fecha:'2025-03-20',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'SALA 5',tipo:'AUMENTO PLAZO',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-03-20',hora:'11:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'AUMENTO PLAZO',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2025-03-24',hora:'10:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'AUMENTO PLAZO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-03-24',hora:'13:45',rit:'3208-2024',ruc:'2400480488-7',tribunal:'9° JG STGO',sala:'903',tipo:'AUMENTO PLAZO',imputado:'VICENTE TOMAS SANTOS CRUZ'},
  {fecha:'2025-03-25',hora:'09:45',rit:'6265-2023',ruc:'2300526943-1',tribunal:'JG RANCAGUA',sala:'',tipo:'APROBACIÓN PLAN INTERVENCIÓN',imputado:'JORGE SAYEN ACEITUNO'},
  {fecha:'2025-03-26',hora:'16:00',rit:'',ruc:'2400891947-6',tribunal:'JG COQUIMBO',sala:'',tipo:'DECLARACION',imputado:'JOHN ALEJANDRO SAEZ GODOY / FRANCISCO SAEZ GODOY'},
  {fecha:'2025-03-27',hora:'09:00',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3JG',sala:'904',tipo:'AUMENTO PLAZO',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-03-27',hora:'11:00',rit:'1770-2022',ruc:'2210064942-3',tribunal:'JG QUINTERO',sala:'',tipo:'REV. SCP',imputado:'MARISOL LAGOS GOMEZ'},
  {fecha:'2025-03-27',hora:'11:00',rit:'2282-2022',ruc:'2200555190-4',tribunal:'6° JG STGO',sala:'701',tipo:'APJO/ABREV',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2025-03-27',hora:'12:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'1003',tipo:'TRASLADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-03-28',hora:'09:30',rit:'391-2024',ruc:'2410005594-1',tribunal:'1 JG STGO',sala:'',tipo:'AUMENTO PLAZO',imputado:'MAURICIO MORALES YEVENEZ'},
  {fecha:'2025-03-31',hora:'10:00',rit:'3661-2024',ruc:'2400905967-5',tribunal:'3 JG STGO',sala:'901',tipo:'ABREVIADO-CIERRE',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2025-03-31',hora:'10:00',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'REPARATORIO',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2025-04-01',hora:'09:00',rit:'4131-2024',ruc:'2400645481-6',tribunal:'8° JG STGO',sala:'',tipo:'JOS',imputado:'RODRIGO IGNACIO FRANCO FIGUEROA'},
  {fecha:'2025-04-02',hora:'11:00',rit:'8971-2024',ruc:'2401404217-9',tribunal:'8° JG STGO',sala:'403',tipo:'ABREVIADO-CIERRE',imputado:'VÍCTOR CARO'},
  {fecha:'2025-04-02',hora:'15:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13° JG DE STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'YERKO GONZÁLEZ FUENTES'},
  {fecha:'2025-04-02',hora:'15:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'',tipo:'DECLARACION',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-04-03',hora:'12:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'1003',tipo:'TRASLADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-04-09',hora:'09:00',rit:'5844-2023',ruc:'2301395887-4',tribunal:'6° JG STGO',sala:'',tipo:'ABREVIADO/REVPP',imputado:'EUGENIO SILVA FERNANDEZ'},
  {fecha:'2025-04-09',hora:'15:00',rit:'903-2021',ruc:'2110044850-2',tribunal:'JG NACIMIENTO',sala:'',tipo:'ENTREVISTA',imputado:'AGREDUCMAN'},
  {fecha:'2025-04-10',hora:'11:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'',tipo:'ABREVIADO',imputado:'MICHEL BRITO HERRERA'},
  {fecha:'2025-04-14',hora:'10:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12° JG STGO',sala:'',tipo:'REFORMALIZACION',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2025-04-15',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'ZOOM',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-04-15',hora:'09:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'404',tipo:'CIERRE',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2025-04-15',hora:'11:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'DECLARACION Y REV PP',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2025-04-16',hora:'10:00',rit:'7287-2024',ruc:'2401196354-0',tribunal:'2 JG STGO',sala:'403',tipo:'REFORMALIZACION/REVISION CAUTELARES',imputado:'RUPERTO VERA GALLEGOS'},
  {fecha:'2025-04-16',hora:'12:00',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3° JG STGO',sala:'902',tipo:'REVPP',imputado:'MICHAEL CASTILLO PINO'},
  {fecha:'2025-04-18',hora:'09:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'',tipo:'COMPETENCIA',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2025-04-21',hora:'16:30',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'ENTREVISTA',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2025-04-23',hora:'09:00',rit:'199-2022',ruc:'2200045443-9',tribunal:'3 JG STGO',sala:'',tipo:'APJO',imputado:'JUAN QUINTERO ILLANES'},
  {fecha:'2025-04-23',hora:'15:30',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'DECLARACION',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2025-04-23',hora:'16:00',rit:'',ruc:'2400891947-6',tribunal:'FISCALÍA OVALLE',sala:'',tipo:'DECLARACION',imputado:'JOHN SAEZ GODOY'},
  {fecha:'2025-04-24',hora:'09:00',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'REV PP',imputado:'DAGO REYES REYES Y ALVARO REYES PINEO'},
  {fecha:'2025-04-30',hora:'09:00',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'703',tipo:'ABREVIADO',imputado:'MARCELO SILVA FERNÁNDEZ'},
  {fecha:'2025-04-30',hora:'16:00',rit:'',ruc:'2400891947-6',tribunal:'FISCALÍA OVALLE',sala:'',tipo:'DECLARACION',imputado:'FRANCISCO SAEZ GODOY'},
  {fecha:'2025-05-05',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6° JG STGO',sala:'702',tipo:'ABREVIADO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-05-07',hora:'12:00',rit:'8971-2024',ruc:'2401404217-9',tribunal:'8 JG',sala:'403',tipo:'ABREV/CIERRE',imputado:'VICTOR CARO RIQUELME'},
  {fecha:'2025-05-12',hora:'10:00',rit:'572-2024',ruc:'2400054769-3',tribunal:'7° JG STGO',sala:'302',tipo:'REVOCACIÓN 18.216',imputado:'FRANCISCO PEREIRA OLMEDO'},
  {fecha:'2025-05-12',hora:'10:00',rit:'775-2023',ruc:'2300081967-0',tribunal:'JG SAN BERNARDO',sala:'SALA 5',tipo:'APJO / ABREVIADO Y DECLARACIÓN JUDICIAL',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2025-05-14',hora:'10:00',rit:'373-2025',ruc:'2500058342-4',tribunal:'4JG',sala:'804',tipo:'TERCERIA',imputado:'JUAN DAVID MORALES RAMIREZ'},
  {fecha:'2025-05-15',hora:'10:00',rit:'4369-2022',ruc:'2200390510-5',tribunal:'7º JG STGO',sala:'203',tipo:'APJO',imputado:'CLAUDIO NAVARRETE TRONCOSO'},
  {fecha:'2025-05-22',hora:'09:30',rit:'6265-2023',ruc:'2300526943-1',tribunal:'JG RANCAGUA',sala:'',tipo:'APROBACIÓN PLAN INTERVENCIÓN',imputado:'JORGE SAYEN ACEITUNO'},
  {fecha:'2025-05-22',hora:'11:00',rit:'5844-2023',ruc:'2301395887-4',tribunal:'6 JG STGO',sala:'',tipo:'ABREVIADO',imputado:'EUGENIO SILVA FERNANDEZ'},
  {fecha:'2025-05-23',hora:'12:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'AUMENTO',imputado:'JUAN ELIECER FLORES FARIAS'},
  {fecha:'2025-05-26',hora:'09:00',rit:'1642-2022',ruc:'2200693227-8',tribunal:'10° JG STGO',sala:'',tipo:'QUEBRANTAMIENTO',imputado:'AXEL NAVARRETE DEVIA'},
  {fecha:'2025-05-26',hora:'09:30',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'REV PP Y DECLARACIÓN',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2025-05-26',hora:'15:30',rit:'3757-2024',ruc:'2200556467-4',tribunal:'JG VIÑA DEL MAR',sala:'',tipo:'ENTREVISTA POR ZOOM',imputado:'CLAUDIO ZUÑIGA MINGEZ'},
  {fecha:'2025-05-27',hora:'10:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'402',tipo:'FORMALIZACION',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2025-05-27',hora:'12:00',rit:'7287-2024',ruc:'2401196354-0',tribunal:'2° JG STGO',sala:'403',tipo:'ABREVIADO',imputado:'RUPERTO GERMÁIN VERÁ GALLEGOS'},
  {fecha:'2025-05-28',hora:'11:00',rit:'5844-2023',ruc:'2301395887-4',tribunal:'6° JG STGO',sala:'701',tipo:'APJO',imputado:'EUGENIO SILVA FERNANDEZ'},
  {fecha:'2025-05-28',hora:'15:00',rit:'2488-2023',ruc:'2300214424-7',tribunal:'7°JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-05-29',hora:'16:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13° JG DE STGO',sala:'',tipo:'DECLARACION ZOOM',imputado:'YERKO EMERSON GONZALEZ FUENTES'},
  {fecha:'2025-05-30',hora:'09:00',rit:'4814-2015',ruc:'2500722733-K',tribunal:'2° JG STGO',sala:'',tipo:'ALEGATO ICA STGO',imputado:'JULIÁN IGNACIO CONTRERAS ALEGRIA'},
  {fecha:'2025-05-30',hora:'10:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'DECLARACION',imputado:'JUAN ELIECER FLORES FARIAS'},
  {fecha:'2025-06-02',hora:'11:15',rit:'315-2024',ruc:'2300647945-6',tribunal:'12° JG STGO',sala:'',tipo:'REFOMNALIZACION',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2025-06-02',hora:'15:40',rit:'1110-2021',ruc:'2000520290-7',tribunal:'1 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'VIOLETA CABALLERO MUÑOZ'},
  {fecha:'2025-06-03',hora:'15:15',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'',tipo:'ENTREVISTA FISCAL PRESENCIAL',imputado:'JUAN FRANCISCO PACHECO'},
  {fecha:'2025-06-04',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-06-04',hora:'09:00',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3°JG',sala:'901',tipo:'ABREVIADO Y CIERRE',imputado:'MICHAEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-06-04',hora:'09:00',rit:'658-2023',ruc:'2100121350-1',tribunal:'TOP VIÑA DEL MAR',sala:'',tipo:'JUICIO ORAL',imputado:'ROLANDO ARAYA ROJAS'},
  {fecha:'2025-06-04',hora:'09:00',rit:'8971-2024',ruc:'2401404217-9',tribunal:'8° JG STGO',sala:'',tipo:'ABREV/CIERRE',imputado:'VICTOR MANUEL CARO RIQUELME'},
  {fecha:'2025-06-04',hora:'12:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13° JG DE STGO',sala:'',tipo:'CAUTELA DE GARANTIA',imputado:'YERKO EMERSON GONZALEZ FUENTES'},
  {fecha:'2025-06-05',hora:'10:00',rit:'1110-2021',ruc:'2000520290-7',tribunal:'1 JG STGO',sala:'',tipo:'ABREVIADO/ CAUTELARES/CIRRRE',imputado:'VIOLETA CABALLERO MUÑOZ'},
  {fecha:'2025-06-05',hora:'12:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'JG PUENTE ALTO',tipo:'AUMENTO',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-06-06',hora:'09:05',rit:'10340-2024',ruc:'2401470201-2',tribunal:'JG VIÑA DEL MAR',sala:'',tipo:'APJO',imputado:'JORGE ROLANDO VEGA LAGOS'},
  {fecha:'2025-06-09',hora:'11:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'3',tipo:'REV PP- ABREVIADO-AUMENTO',imputado:'JUAN ELIECER FLORES FARIAS'},
  {fecha:'2025-06-09',hora:'11:30',rit:'133-2025',ruc:'2300081967-0',tribunal:'JG SAN BERNARDO',sala:'ZOOM',tipo:'FACTIBILIDAD JO',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2025-06-09',hora:'16:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'DECLARACION ZOOM FISCALIA',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2025-06-10',hora:'16:30',rit:'15575-2023',ruc:'2301434671-6',tribunal:'7° JG STGO',sala:'',tipo:'ENTREVISTA TELEFONICA',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2025-06-11',hora:'08:30',rit:'2939-2025',ruc:'',tribunal:'ICA STGO',sala:'6',tipo:'APELACIÓN CAUTELAR',imputado:'SEBASTIÁN PARRA GONZALEZ'},
  {fecha:'2025-06-11',hora:'14:00',rit:'3208-2024',ruc:'2400480488-7',tribunal:'9° JG STGO',sala:'903',tipo:'ABREVIADO/CIERRE',imputado:'VICENTE TOMAS SANTOS CRUZ'},
  {fecha:'2025-06-12',hora:'09:15',rit:'3757-2024',ruc:'2200556467-4',tribunal:'JG VIÑA DEL MAR',sala:'',tipo:'ABREVIADO',imputado:'CLAUDIO BASTIAN ZUÑIGA MINGUEZ'},
  {fecha:'2025-06-12',hora:'11:00',rit:'4368-2022',ruc:'2200390509-1',tribunal:'7º JG STGO',sala:'302',tipo:'APJO',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2025-06-12',hora:'15:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13° JG DE STGO',sala:'',tipo:'DECLARACION ZOOM',imputado:'YERKO EMERSON GONZALEZ FUENTES'},
  {fecha:'2025-06-16',hora:'09:00',rit:'391-2024',ruc:'2410005594-1',tribunal:'1° JG',sala:'',tipo:'AUMENTO',imputado:'MAURICIO MORALES YEVENES'},
  {fecha:'2025-06-16',hora:'11:15',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'ABREVIADO',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2025-06-16',hora:'15:20',rit:'7287-2024',ruc:'2401196354-0',tribunal:'2° JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'RUPERTO GERMÁIN VERÁ GALLEGOS'},
  {fecha:'2025-06-17',hora:'08:30',rit:'261-2023',ruc:'2201213256-9',tribunal:'TOP SERENA',sala:'',tipo:'JO',imputado:'MIGUEL ANGEL ARANCIBIA FUENTES'},
  {fecha:'2025-06-17',hora:'09:00',rit:'3544-2024',ruc:'2400383696-3',tribunal:'JG QUILPUE',sala:'',tipo:'APJO ABREVIADO',imputado:'RICARDO ENRIQUE HERNÁNDEZ LOLA'},
  {fecha:'2025-06-17',hora:'10:30',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'ZOOM',tipo:'REV. PP AUMENTO Y DECLARACION',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2025-06-17',hora:'15:30',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4° JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-06-17',hora:'15:30',rit:'7287-2024',ruc:'2401196354-0',tribunal:'2° JG STGO',sala:'',tipo:'DECLARACION ZOOM',imputado:'RUPERTO GERMÁIN VERÁ GALLEGOS'},
  {fecha:'2025-06-18',hora:'11:00',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6° JG STGO',sala:'702',tipo:'',imputado:'MARCELO SILVA FERNANDEZ'},
  {fecha:'2025-06-18',hora:'11:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'703',tipo:'ABREVIADO',imputado:'MICHEL BRITO HERRERA Y JONNIER GARCES QUIÑONES'},
  {fecha:'2025-06-18',hora:'16:00',rit:'4814-2025',ruc:'2500722733-K',tribunal:'2° JG STGO',sala:'',tipo:'DECLARACIÓN MEET',imputado:'JULIÁN IGNACIO CONTRERAS ALEGRIA'},
  {fecha:'2025-06-19',hora:'09:00',rit:'1770-2022',ruc:'2210064942-3',tribunal:'JG QUINTERO',sala:'',tipo:'REV. SCP',imputado:'MARISOL LAGOS GOMEZ'},
  {fecha:'2025-06-19',hora:'09:00',rit:'199-2022',ruc:'2200045443-9',tribunal:'3° JG STGO',sala:'902',tipo:'APJO/ABREVIADO',imputado:'JUAN FRANCISCO QUINTERO ILLANES'},
  {fecha:'2025-06-23',hora:'09:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4° JG STGO',sala:'903',tipo:'AUMENTO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-06-23',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'5',tipo:'REVPP',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-06-23',hora:'15:30',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3JG',sala:'',tipo:'ENTREVISTA',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-06-24',hora:'17:00',rit:'8971-2024',ruc:'2401404217-9',tribunal:'8° JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'VICTOR CARO RIQUELME'},
  {fecha:'2025-06-27',hora:'10:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'',tipo:'AUMENTO DE PLAZO/ ZOOM',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-06-27',hora:'12:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13°JG',sala:'601',tipo:'REVPP',imputado:'YERKO GONZALEZ FUENTES'},
  {fecha:'2025-06-30',hora:'12:00',rit:'7287-2024',ruc:'2401196354-0',tribunal:'2° JG STGO',sala:'403',tipo:'ABREVIADO- PLAZO',imputado:'RUPERTO GERMÁIN VERÁ GALLEGOS'},
  {fecha:'2025-07-01',hora:'09:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'FISCALÍA PUERTO MONTT',tipo:'RETIRO EIVG LLEVAR PENDRIVE',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-07-01',hora:'09:00',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'AUMENTO DE PLAZO',imputado:'DAGO ANDRES REYES REYES- ALVARO ENRIQUE REYES PAINEO- NELSON ALONSO LLEMPI'},
  {fecha:'2025-07-03',hora:'09:00',rit:'4369-2022',ruc:'2200390510-5',tribunal:'7º JG STGO',sala:'',tipo:'APJO',imputado:'CLAUDIO NAVARRETE TRONCOSO'},
  {fecha:'2025-07-04',hora:'09:00',rit:'133-2025',ruc:'2300081967-0',tribunal:'JG SAN BERNARDO',sala:'',tipo:'JO/SIN EFECTO',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2025-07-04',hora:'09:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10° JG STGO',sala:'ZOOM',tipo:'AUMENTO DE PLAZO/ ZOOM',imputado:'ELSA ROMERO'},
  {fecha:'2025-07-04',hora:'09:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'DNP/ ZOOM',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2025-07-07',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3° JG STGO',sala:'901',tipo:'APJO ABREVIADO',imputado:'JONNIER FABIAN GARCES QUIÑONES'},
  {fecha:'2025-07-07',hora:'11:00',rit:'8971-2024',ruc:'2401404217-9',tribunal:'8° JG STGO',sala:'402',tipo:'ABREVIADO',imputado:'VICTOR CARO RIQUELME'},
  {fecha:'2025-07-08',hora:'09:00',rit:'15575-2023',ruc:'2301434671-6',tribunal:'7° JG STGO',sala:'203',tipo:'CIERRE/REPROGRAMA',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2025-07-08',hora:'09:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'ZOOM',tipo:'REV. CAUTELARES',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2025-07-08',hora:'09:00',rit:'2488-2023',ruc:'2300214424-7',tribunal:'7°JG STGO',sala:'203',tipo:'CIERRE',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-07-08',hora:'11:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'AUMENTO (REVPP OTRO)',imputado:'JUAN ELIECER FLORES FARÍAS'},
  {fecha:'2025-07-09',hora:'14:00',rit:'432-2024',ruc:'2300952893-8',tribunal:'TOP VIÑA DEL MAR',sala:'',tipo:'JO',imputado:'MIGUEL ANGEL ARANCIBIA FUENTES'},
  {fecha:'2025-07-14',hora:'09:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2° JG  STGO',sala:'404',tipo:'SALIDA ALTERNATIVA-CIERRE',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2025-07-15',hora:'11:00',rit:'15575-2023',ruc:'2301434671-6',tribunal:'7° JG STGO',sala:'204',tipo:'CIERRE',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2025-07-18',hora:'09:00',rit:'1110-2021',ruc:'2000520290-7',tribunal:'1 JG STGO',sala:'',tipo:'ABREVIADO/ CAUTELARES/CIRRRE',imputado:'VIOLETA CABALLERO MUÑOZ'},
  {fecha:'2025-07-18',hora:'10:00',rit:'4814-2025',ruc:'2500722733-k',tribunal:'2°jg',sala:'503',tipo:'REV IP',imputado:'JULIAN CONTRERAS ALEGRIA'},
  {fecha:'2025-07-21',hora:'12:00',rit:'2334-2025',ruc:'2500338807-K',tribunal:'2° JG STGO',sala:'403',tipo:'ABREVIADO',imputado:'AXEL INOSTROZA FUENTES'},
  {fecha:'2025-07-21',hora:'12:00',rit:'4131-2024',ruc:'2400645481-6',tribunal:'8° JG STGO',sala:'',tipo:'ABONO',imputado:'RODRIGO IGNACIO FRANCO FIGUEROA'},
  {fecha:'2025-07-25',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-07-28',hora:'09:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4° JG STGO',sala:'903',tipo:'AUMENTO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-07-28',hora:'11:30',rit:'3208-2024',ruc:'2400480488-7',tribunal:'9°JG',sala:'904',tipo:'ABREVIADO',imputado:'VICENTE CRUZ SANTOS'},
  {fecha:'2025-07-31',hora:'10:00',rit:'2488-2023',ruc:'2300214424-7',tribunal:'7°JG STGO',sala:'302',tipo:'ABREV',imputado:'MICHAEL CASTILLO PINO'},
  {fecha:'2025-08-01',hora:'09:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'AUMENTO DE PLAZO',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2025-08-05',hora:'10:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'402',tipo:'FORMALIZACION',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2025-08-06',hora:'08:30',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'ABREVIADO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-08-06',hora:'09:00',rit:'',ruc:'',tribunal:'ICA STGO',sala:'1',tipo:'ALEGATO REV CAUTELAR',imputado:'JUAN ELIAS FLORES FARIAS'},
  {fecha:'2025-08-06',hora:'10:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'1',tipo:'CAUTELA DE GARANTIA',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2025-08-06',hora:'16:15',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-08-07',hora:'09:00',rit:'4368-2022',ruc:'2200390509-1',tribunal:'7º JG STGO',sala:'303',tipo:'APJO',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2025-08-07',hora:'09:30',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9° JG STGO',sala:'902',tipo:'REV. CAUTELARES',imputado:'LUIS ANDRES FERNANDEZ SOTO'},
  {fecha:'2025-08-07',hora:'10:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13° JG DE STGO',sala:'601',tipo:'ABREVIADO',imputado:'YERKO GONZÁLEZ FUENTES'},
  {fecha:'2025-08-08',hora:'12:00',rit:'1235-2025',ruc:'2500127484-0',tribunal:'8° JG STGO',sala:'402',tipo:'AUMENTO-CIERRE',imputado:'DANIEL ANDRES BARRENECHEA RODRIGUEZ'},
  {fecha:'2025-08-11',hora:'12:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'SALA 5',tipo:'AUMENTO PLAZO',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-08-12',hora:'10:00',rit:'3577-2025',ruc:'2500666927-4',tribunal:'JG PUENTE ALTO',sala:'ZOOM',tipo:'REVPP',imputado:'CAUSA ADOLFO'},
  {fecha:'2025-08-12',hora:'10:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'701',tipo:'CIERRE-REV.PP',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-08-12',hora:'11:15',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'1',tipo:'CAUTELA DE GARANTIA',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2025-08-13',hora:'10:00',rit:'1330-2024',ruc:'2400250037-6',tribunal:'2° JG STGO',sala:'404',tipo:'ABREVIADO',imputado:'CAUSA ADOLFO'},
  {fecha:'2025-08-13',hora:'11:15',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'ABREVIADO',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2025-08-13',hora:'17:00',rit:'903-2021',ruc:'2110044850-2',tribunal:'JG NACIMIENTO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'QUERELLANTE AGREDUCMAN'},
  {fecha:'2025-08-14',hora:'10:00',rit:'2282-2022',ruc:'2200555190-4',tribunal:'6° JG STGO',sala:'702',tipo:'APII',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2025-08-14',hora:'15:10',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2 JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-08-18',hora:'15:30',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-08-19',hora:'17:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-08-20',hora:'09:30',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'',tipo:'REV PP X 145',imputado:'MARCELO SILVA FERNÁNDEZ'},
  {fecha:'2025-08-20',hora:'10:00',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3°JG',sala:'902',tipo:'ABREVIADO/CIERRE',imputado:'MICHAEL CASTILLO PINO'},
  {fecha:'2025-08-20',hora:'11:00',rit:'15575-2023',ruc:'2301434671-6',tribunal:'7° JG STGO',sala:'202',tipo:'ABREVIADO/CIERRE',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2025-08-20',hora:'15:30',rit:'7233-2025',ruc:'2500522831-2',tribunal:'7° JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'BRAYAN ESTIVEN ESPEJO RENGIFO'},
  {fecha:'2025-08-21',hora:'12:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'ZOOM',tipo:'CAUTELA DE GARANTIA',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2025-08-21',hora:'15:30',rit:'7233-2025',ruc:'2500522831-2',tribunal:'7° JG STGO',sala:'',tipo:'DECLARACION',imputado:'BRAYAN ESTIVEN ESPEJO RENGIFO'},
  {fecha:'2025-08-22',hora:'09:15',rit:'6695-2019',ruc:'1900231133-2',tribunal:'9° JG STGO',sala:'902',tipo:'SOBRESEIMIENTO',imputado:'JUAN AMADOR GUAJARDO FERNANDEZ'},
  {fecha:'2025-08-22',hora:'10:50',rit:'7084-2023',ruc:'2301431318-4',tribunal:'14° JG STGO',sala:'902',tipo:'SEGUIMIENTO',imputado:'FELIPE ARCOS PAVEZ'},
  {fecha:'2025-08-22',hora:'11:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'AUMENTO PLAZO',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2025-08-25',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'ZOOM',tipo:'REVPP',imputado:'ALVARO ENRIQUE REYES PAINEO'},
  {fecha:'2025-08-26',hora:'10:00',rit:'2587-2024',ruc:'2400518377-0',tribunal:'11° JG STGO',sala:'502',tipo:'SOBRESEIMIENTO',imputado:'MARCELO BERNAL (ADOLFO)'},
  {fecha:'2025-08-26',hora:'10:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6 JG STGO',sala:'701',tipo:'REVPP',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-08-26',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6° JG STGO',sala:'702',tipo:'ABREVIADO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-08-26',hora:'15:15',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'',tipo:'DECLARACION ZOOM',imputado:'MARCELO SILVA FERNÁNDEZ'},
  {fecha:'2025-08-27',hora:'09:00',rit:'177-2025',ruc:'2400440977-5',tribunal:'6° TOP',sala:'',tipo:'JO',imputado:'RICHARD MITCHELL RODRIGUEZ (ADOLFO)'},
  {fecha:'2025-08-27',hora:'11:00',rit:'2488-2023',ruc:'2300214424-7',tribunal:'7°JG STGO',sala:'302',tipo:'ABREVIADO',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-08-28',hora:'09:00',rit:'177-2025',ruc:'2400440977-5',tribunal:'6° TOP',sala:'',tipo:'JO',imputado:'RICHARD MITCHELL RODRIGUEZ (ADOLFO)'},
  {fecha:'2025-08-28',hora:'09:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6°JG STGO',sala:'702',tipo:'CIERRE',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-08-28',hora:'11:00',rit:'1235-2025',ruc:'2500127484-0',tribunal:'8 JG STGO',sala:'402',tipo:'REV. CAUT.',imputado:'DANIEL ANDRES BARRENECHEA RODRIGUEZ'},
  {fecha:'2025-08-28',hora:'11:00',rit:'5085-2021',ruc:'2000530196-4',tribunal:'13° JG DE STGO',sala:'603',tipo:'DISCUSION 458 CPP',imputado:'MARIA ANGELICA VIDAL'},
  {fecha:'2025-08-29',hora:'10:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'903',tipo:'ABREVIADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-09-01',hora:'10:30',rit:'4292-2025',ruc:'2500631127-2',tribunal:'JG RANCAGUA',sala:'',tipo:'APJO',imputado:'MANUEL ANTONIO DONOSO MUÑOZ'},
  {fecha:'2025-09-01',hora:'13:00',rit:'4131-2024',ruc:'2400645481-6',tribunal:'8 JG STGO',sala:'403',tipo:'REV SENT',imputado:'RODRIGO IGNACIO FRANCO FIGUEROA'},
  {fecha:'2025-09-08',hora:'09:00',rit:'658-2023',ruc:'2100121350-1',tribunal:'TOP VIÑA DEL MAR',sala:'',tipo:'JUICIO ORAL',imputado:'ROLANDO ARAYA ROJAS'},
  {fecha:'2025-09-10',hora:'12:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'402',tipo:'SALIDA ALTERNATIVA',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2025-09-11',hora:'10:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'701',tipo:'REVPP',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-09-11',hora:'12:00',rit:'2910-2025',ruc:'2500855397-4',tribunal:'1°JG STGO',sala:'',tipo:'SANCION',imputado:'ADOLFO MIRANDA'},
  {fecha:'2025-09-12',hora:'09:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6°JG STGO',sala:'702',tipo:'CIERRE',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-09-12',hora:'09:15',rit:'6695-2019',ruc:'1900231133-2',tribunal:'9 JG STGO',sala:'902',tipo:'SOBRESEIMIENTO',imputado:'JUAN AMADOR GUAJARDO FERNANDEZ'},
  {fecha:'2025-09-12',hora:'09:45',rit:'362-2025',ruc:'2500028986-0',tribunal:'10°JG STGO',sala:'ZOOM',tipo:'AUMENTO',imputado:'ELSA DEL CARMEN'},
  {fecha:'2025-09-12',hora:'09:55',rit:'',ruc:'',tribunal:'AEROPUERTO',sala:'',tipo:'VUELO ARG (IDA)',imputado:'ADOLFO MIRANDA'},
  {fecha:'2025-09-15',hora:'10:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'SALA 2',tipo:'REVPP',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-09-16',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGATE',sala:'',tipo:'APJO (1°)',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-09-16',hora:'09:00',rit:'3544-2024',ruc:'2400383696-3',tribunal:'JG QUILPUE',sala:'',tipo:'APROBACION PLAN',imputado:'RICARDO ENRIQUE HERNÁNDEZ LOLA'},
  {fecha:'2025-09-17',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3° JG STGO',sala:'902',tipo:'APJO ABREVIADO',imputado:'JONNIER FABIAN GARCES QUIÑONES'},
  {fecha:'2025-09-17',hora:'10:00',rit:'7233-2025',ruc:'2500522831-2',tribunal:'7 STGO',sala:'101',tipo:'ABREVIADO',imputado:'BRAYAN STIVEN ESPEJO RENGIFO'},
  {fecha:'2025-09-20',hora:'13:50',rit:'',ruc:'',tribunal:'AEROPUERTO',sala:'',tipo:'VUELO ARG (VUELTA)',imputado:'ADOLFO MIRANDA'},
  {fecha:'2025-09-22',hora:'10:00',rit:'9120-2024',ruc:'2401233589-6',tribunal:'JG PUENTE ALTO',sala:'',tipo:'APJO',imputado:'SEBASTIÁN GUZMAN SANCHEZ'},
  {fecha:'2025-09-23',hora:'09:30',rit:'7233-2025',ruc:'2500522831-2',tribunal:'7 STGO',sala:'101',tipo:'ABREVIADO',imputado:'BRAYAN STIVEN ESPEJO RENGIFO'},
  {fecha:'2025-09-24',hora:'13:30',rit:'384-2025',ruc:'2200390509-1',tribunal:'4°TOP',sala:'',tipo:'COORDINACION JO',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2025-09-24',hora:'16:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'ENTREVISTA',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2025-09-26',hora:'09:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2°JG',sala:'403',tipo:'ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-09-30',hora:'10:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'REV.PP 145',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-10-01',hora:'09:00',rit:'3477-2025',ruc:'2500666927-4',tribunal:'JG PUENTE ALTO',sala:'ZOOM',tipo:'REF/AUMENTO/REV.PP',imputado:'CAUSA ADOLFO'},
  {fecha:'2025-10-01',hora:'09:30',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'ZOOM',tipo:'REV.CAUT.',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2025-10-02',hora:'09:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13 JG DE STGO',sala:'602',tipo:'APII',imputado:'YERKO EMERSON GONZALEZ FUENTES'},
  {fecha:'2025-10-02',hora:'10:30',rit:'146-2020',ruc:'1901404279-5',tribunal:'15 JG STGO',sala:'ZOOM',tipo:'CAUTELA GARANTIAS',imputado:'MARJORIE TORRES GUTIERREZ'},
  {fecha:'2025-10-02',hora:'11:00',rit:'1330-2024',ruc:'2400250037-6',tribunal:'2 JG STGO',sala:'',tipo:'ABREVIADO',imputado:'CAUSA ADOLFO'},
  {fecha:'2025-10-02',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'ABREVIADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-10-03',hora:'10:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'AUMENTO PLAZO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-10-03',hora:'10:00',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'CIERRE -ABREVIADO',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2025-10-06',hora:'15:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'',tipo:'DECLARACION',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-10-07',hora:'09:00',rit:'903-2021',ruc:'2110044850-2',tribunal:'JG NACIMIENTO',sala:'',tipo:'186 DEL CPP',imputado:'QUERELLANTE AGREDUCMAN'},
  {fecha:'2025-10-08',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-10-08',hora:'09:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'403',tipo:'SCP/CIERRE/SOBRESEIMIENTO',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2025-10-08',hora:'10:30',rit:'',ruc:'',tribunal:'',sala:'',tipo:'',imputado:''},
  {fecha:'2025-10-09',hora:'11:10',rit:'5888-2025',ruc:'2301250099-8',tribunal:'SAN BERNARDO',sala:'SALA 7',tipo:'FORMALIZACION',imputado:'CLAUDIO ALEXIS FAUNDEZ SAAVEDRA'},
  {fecha:'2025-10-10',hora:'12:00',rit:'4814-2015',ruc:'2500722733-K',tribunal:'2° JG STGO',sala:'503',tipo:'APROBACION DE PLAN',imputado:'JULIÁN IGNACIO CONTRERAS ALEGRIA'},
  {fecha:'2025-10-14',hora:'10:00',rit:'2488-2023',ruc:'2300214424-7',tribunal:'7 JG STGO',sala:'202',tipo:'ABREVIADO',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-10-14',hora:'10:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'APJO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2025-10-14',hora:'14:15',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'',tipo:'FORMALIZACION',imputado:'LUIS ANDRES FERNANDEZ SOTO'},
  {fecha:'2025-10-15',hora:'11:00',rit:'1110-2021',ruc:'2000520290-7',tribunal:'1 JG STGO',sala:'',tipo:'APROBACION DE PLAN',imputado:'VIOLETA CABALLERO MUÑOZ'},
  {fecha:'2025-10-15',hora:'11:00',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'701',tipo:'ABREVIADO Y CIERRE',imputado:'MARCELO SILVA FERNANDEZ'},
  {fecha:'2025-10-17',hora:'11:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'',tipo:'CIERRE',imputado:'JUAN FRANCISCO PACHECO'},
  {fecha:'2025-10-21',hora:'11:00',rit:'3912-2023',ruc:'230066793-4',tribunal:'6 JG STGO',sala:'702',tipo:'APJO (1°)',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2025-10-22',hora:'09:00',rit:'10342-2017',ruc:'1701083038-9',tribunal:'9 JG STGO',sala:'903',tipo:'REV. SENT',imputado:'CARMEN VALENCIA RIASCOS'},
  {fecha:'2025-10-22',hora:'09:00',rit:'177-2025',ruc:'2400440977-5',tribunal:'6° TOP',sala:'',tipo:'JO',imputado:'RICHARD MITCHELL RODRIGUEZ (ADOLFO)'},
  {fecha:'2025-10-22',hora:'09:00',rit:'177-2025',ruc:'2400440977-5',tribunal:'6° TOP',sala:'',tipo:'JO',imputado:'RICHARD MITCHELL RODRIGUEZ (ADOLFO)'},
  {fecha:'2025-10-22',hora:'09:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG LA CALERA',sala:'',tipo:'CIERRE',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2025-10-23',hora:'10:00',rit:'5085-2021',ruc:'2000530196-4',tribunal:'13 JG DE STGO',sala:'',tipo:'COMPARECENCIA',imputado:'MARIA ANGELICA VIDAL'},
  {fecha:'2025-10-23',hora:'12:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2 JG STGO',sala:'404',tipo:'ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-10-24',hora:'09:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'AUMENTO PLAZO',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2025-10-28',hora:'09:00',rit:'5401-2023',ruc:'2301291319-2',tribunal:'3 JG STGO',sala:'901',tipo:'ABREVIADO',imputado:'MICHEL ORLANDO CASTILLO PINO'},
  {fecha:'2025-10-28',hora:'11:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGATE',sala:'4',tipo:'APJO (2°)',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-10-29',hora:'11:00',rit:'2016-2025',ruc:'2500786872-6',tribunal:'5 JG STGO',sala:'F 301',tipo:'CIERRE-SOBRESEIMIENTO',imputado:'AXEL NAVARRETE DEVIA - MELISA REYES DUBOY'},
  {fecha:'2025-11-03',hora:'15:30',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'',tipo:'DECLARACION',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-11-04',hora:'09:00',rit:'5761-2025',ruc:'',tribunal:'ICA STGO',sala:'',tipo:'APELACIÓN CAUTELAR',imputado:'SEBASTIÁN PARRA GONZALEZ'},
  {fecha:'2025-11-06',hora:'12:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'402',tipo:'SCP',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2025-11-07',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'B 902',tipo:'ABREVIADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-11-07',hora:'15:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12° JG STGO',sala:'',tipo:'DECLARACIÓN ZOOM',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2025-11-10',hora:'18:00',rit:'5888-2025',ruc:'2301250099-8',tribunal:'SAN BERNARDO',sala:'ZOOM',tipo:'REUNION REPRESENTADO',imputado:'CLAUDIO ALEXIS FAUNDEZ SAAVEDRA'},
  {fecha:'2025-11-11',hora:'15:30',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGATE',sala:'',tipo:'ENTREVISTA TELEFONICA',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-11-12',hora:'10:00',rit:'',ruc:'2401186231-0',tribunal:'',sala:'',tipo:'DECLARACIÓN EN PDI',imputado:'ARMANDO WENCESLAO AEDO MEZA'},
  {fecha:'2025-11-13',hora:'12:00',rit:'293-2024',ruc:'2301419042-2',tribunal:'13 JG DE STGO',sala:'602',tipo:'APROBACIÓN DE PLAN',imputado:'YERKO EMERSON GONZALEZ FUENTES'},
  {fecha:'2025-11-17',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'SALA 5',tipo:'ABREVIADO',imputado:'SEBASTIÁN GUZMÁN SANCHEZ'},
  {fecha:'2025-11-18',hora:'16:30',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'ENTREVISTA TELEFONICA',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-11-20',hora:'09:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3° JG STGO',sala:'901',tipo:'APJO ABREVIADO',imputado:'JONNIER FABIAN GARCES QUIÑONES'},
  {fecha:'2025-11-20',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'B 902',tipo:'DECLARACION',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-11-21',hora:'11:00',rit:'6952-2020',ruc:'2000777202-6',tribunal:'4 JG STGO',sala:'902',tipo:'ABREVIDO- REV CAUTELARES',imputado:'YEREMY ANDRES PEREZ SANHUEZA'},
  {fecha:'2025-11-24',hora:'12:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2 JG STGO',sala:'B 403',tipo:'ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-11-25',hora:'15:30',rit:'315-2024',ruc:'2300647945-6',tribunal:'12° JG STGO',sala:'',tipo:'DECLARACIÓN ZOOM',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2025-11-26',hora:'11:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'APJO',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2025-11-27',hora:'09:00',rit:'9120-2024',ruc:'2401233589-6',tribunal:'JG PUENTE ALTO',sala:'',tipo:'APJO-ABREVIADO',imputado:'SEBASTIÁN GUZMAN SANCHEZ'},
  {fecha:'2025-11-28',hora:'11:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'',tipo:'CIERRE',imputado:'JUAN FRANCISCO PACHECO CACERES'},
  {fecha:'2025-12-01',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGATE',sala:'',tipo:'APJO (3) ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-12-02',hora:'09:00',rit:'1235-2025',ruc:'2500127484-0',tribunal:'8 JG STGO',sala:'403',tipo:'PLAZO',imputado:'DANIEL ANDRES BARRENECHEA RODRIGUEZ'},
  {fecha:'2025-12-02',hora:'10:00',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'703',tipo:'ABONO EN CAUSA DIVERSA',imputado:'MARCELO SILVA FERNÁNDEZ'},
  {fecha:'2025-12-03',hora:'10:00',rit:'2016-2025',ruc:'2500786872-6',tribunal:'5 JG STGO',sala:'F 302',tipo:'DNP',imputado:'AXEL NAVARRETE DEVIA - MELISA REYES DUBOY'},
  {fecha:'2025-12-03',hora:'10:00',rit:'5888-2025',ruc:'2301250099-8',tribunal:'SAN BERNARDO',sala:'SALA 7',tipo:'FORMALIZACION',imputado:'CLAUDIO ALEXIS FAUNDEZ SAAVEDRA'},
  {fecha:'2025-12-05',hora:'08:30',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'ABREVIADO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2025-12-09',hora:'10:45',rit:'6695-2019',ruc:'1900231133-2',tribunal:'9°JG',sala:'SALA 902',tipo:'458',imputado:'JUAN AMADOR GUAJARDO FERNANDEZ'},
  {fecha:'2025-12-12',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'403',tipo:'ABREV(OTRO)/REFORMALIZACION',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2025-12-19',hora:'12:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2°JG',sala:'404',tipo:'ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2025-12-23',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'ZOOM',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2025-12-24',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'REV PP',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2025-12-25',hora:'11:00',rit:'6952-2020',ruc:'2000777202-6',tribunal:'4°JG',sala:'1003',tipo:'ABREVIADO/PRESCRIPCION',imputado:'YEREMI PEREZ SANHUEZA'},
  {fecha:'2025-12-29',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'REV PP',imputado:'NELSON ALONSO LLEMPI'},
  {fecha:'2025-12-29',hora:'14:30',rit:'1045-2025',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'APJO',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2025-12-30',hora:'09:00',rit:'69-2025',ruc:'2301433655-9',tribunal:'5 TOP STGO',sala:'',tipo:'JO',imputado:'MAXIMILIANO DOMÍNGUEZ INOSTROZA'},
  {fecha:'2025-12-30',hora:'09:00',rit:'8837-2017',ruc:'1700575458-5',tribunal:'11 JG STGO',sala:'501',tipo:'CAUTELA DE GARANTIAS',imputado:'FRANCISCO JAVIER SANDOVAL ARENAS'},
  {fecha:'2026-01-05',hora:'11:00',rit:'5085-2021',ruc:'2000530196-4',tribunal:'13 JG STGO',sala:'F-601',tipo:'APJOS',imputado:'MARÍA ANGÉLICA VIDAL CONCHA'},
  {fecha:'2026-01-05',hora:'11:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'APJO-ABREVIADO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2026-01-06',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGATE',sala:'',tipo:'APJO (4) ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2026-01-06',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'204',tipo:'ABREVIADO',imputado:'ALEXIS ARNALDO GODOY GODOY'},
  {fecha:'2026-01-07',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'',tipo:'AUMENTO Y CIERRE',imputado:'SEBASTIÁN SÁNCHEZ GUZMAN'},
  {fecha:'2026-01-07',hora:'10:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'503',tipo:'REF/REPARATORIO/CIERRE',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2026-01-08',hora:'10:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'REV PP-ABREVIADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-09',hora:'09:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10° JG STGO',sala:'ZOOM',tipo:'AUMENTO DE PLAZO/ ZOOM',imputado:'ELSA ROMERO RIQUELME'},
  {fecha:'2026-01-12',hora:'10:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'',tipo:'APJO ABREVIADO REV CAUTELARES',imputado:'RICARDO ESTEBAN GODOY VILLAGARAN'},
  {fecha:'2026-01-14',hora:'09:00',rit:'209-2026',ruc:'',tribunal:'ICA STGO',sala:'TERCERA',tipo:'APELACIÓN CAUTELAR',imputado:'SEBASTIÁN PARTAGUEZ Y EDUARDO MORALES'},
  {fecha:'2026-01-14',hora:'09:00',rit:'8837-2017',ruc:'1700575458-5',tribunal:'11 JG STGO',sala:'E-501',tipo:'CAUTELA DE GARANTIAS',imputado:'FRANCISCO JAVIER SANDOVAL ARENAS'},
  {fecha:'2026-01-15',hora:'10:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'B-503',tipo:'REV PP',imputado:'RODRIGO JAVIER PONCE CASTILLO - IGNACIO ALEJANDRO CONTRERAS SUFAN'},
  {fecha:'2026-01-15',hora:'11:00',rit:'1065-2024',ruc:'2400548142-9',tribunal:'JG CAÑETE',sala:'',tipo:'JOS',imputado:'CRISTIAN RODRIGUEZ VALDES'},
  {fecha:'2026-01-15',hora:'12:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'902',tipo:'TRASPASO UNIDAD PENAL',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-15',hora:'16:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-01-16',hora:'09:00',rit:'1045-2025',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'APJO-ABREVIADO',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2026-01-16',hora:'15:30',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-01-19',hora:'09:00',rit:'',ruc:'',tribunal:'ICA STGO',sala:'',tipo:'',imputado:''},
  {fecha:'2026-01-19',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'AUMENTO',imputado:'DAGO ANDRES REYES REYES-  NELSON ALONSO LLEMPI'},
  {fecha:'2026-01-19',hora:'12:00',rit:'',ruc:'',tribunal:'2 JG STGO',sala:'',tipo:'',imputado:''},
  {fecha:'2026-01-21',hora:'09:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3°JG',sala:'902',tipo:'APJO',imputado:'JONNIER FABIAN GARCES QUIÑONES'},
  {fecha:'2026-01-21',hora:'10:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'SALA 3',tipo:'ABREVIADO/AUMENTO',imputado:'JUAN ELIECER FLORES FARÍAS'},
  {fecha:'2026-01-21',hora:'11:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'APJO (2)',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2026-01-21',hora:'13:30',rit:'384-2025',ruc:'2200390509-1',tribunal:'4°TOP',sala:'ZOOM',tipo:'COORDINACION',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2026-01-22',hora:'11:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'804',tipo:'REVPP/ABREV/TRASLADO',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-01-26',hora:'11:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'',tipo:'REFORMALIZACION- REVPP- AUMENTO',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-01-26',hora:'12:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12 JG STGO',sala:'',tipo:'ABREVIADO',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2026-01-27',hora:'09:00',rit:'384-2025',ruc:'2200390509-1',tribunal:'4 TOP',sala:'',tipo:'JO',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2026-01-28',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2° JG',sala:'403',tipo:'ABREVIADO (COIMP)',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-02-02',hora:'10:00',rit:'7264-2022',ruc:'2210055744-8',tribunal:'2 JG STGO',sala:'503',tipo:'DNP',imputado:'ALEXANDER OMAR TOLEDO MEDINA'},
  {fecha:'2026-02-03',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'CIERRE',imputado:'DAGO ANDRES REYES REYES-  NELSON ALONSO LLEMPI'},
  {fecha:'2026-02-04',hora:'09:30',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'701',tipo:'ABONO CAUSA DIVERSA',imputado:'MARCELO SILVA FERNANDEZ'},
  {fecha:'2026-02-04',hora:'15:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'ZOOM',tipo:'ENTREVISTA',imputado:'JUAN FRANCISCO PACHECO CÁCERES'},
  {fecha:'2026-02-04',hora:'15:15',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'MEET',tipo:'ENTREVISTA',imputado:'RODRIGO JAVIER PONCE CASTILLO - IGNACIO ALEJANDRO CONTRERAS SUFAN'},
  {fecha:'2026-02-04',hora:'15:30',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'MEET',tipo:'DECLARACION',imputado:'RODRIGO JAVIER PONCE CASTILLO - IGNACIO ALEJANDRO CONTRERAS SUFAN'},
  {fecha:'2026-02-05',hora:'11:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'',tipo:'CIERRE',imputado:'JORGE ROLANDO VEGA RAMOS'},
  {fecha:'2026-02-09',hora:'08:30',rit:'06–2026',ruc:'2210043625-K',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2026-02-09',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'AUMENTO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-02-09',hora:'10:00',rit:'5085-2021',ruc:'2000530196-4',tribunal:'13 JG STGO',sala:'F-601',tipo:'APJOS',imputado:'MARÍA ANGÉLICA VIDAL CONCHA'},
  {fecha:'2026-02-09',hora:'15:50',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'ELSA DEL CARMEN OMERO RIQUELME'},
  {fecha:'2026-02-10',hora:'09:15',rit:'7512-2022',ruc:'2201048885-4',tribunal:'JG VALPARAISO',sala:'',tipo:'CAUTELA DE GARANTÍAS',imputado:'MIGUEL ANTONIO CAÑUTA VALDERRAMA'},
  {fecha:'2026-02-10',hora:'11:00',rit:'1623-2025',ruc:'2500065512-3',tribunal:'JG COLINA',sala:'SALA 3',tipo:'REPARATORIO',imputado:'JUAN FRANCISCO PACHECO CÁCERES'},
  {fecha:'2026-02-11',hora:'09:00',rit:'70-2025',ruc:'2500012882-4',tribunal:'JG PUENTE ALTO',sala:'',tipo:'REFORMALIZACION ABREVIADO',imputado:'SEBASTIÁN SÁNCHEZ GUZMAN'},
  {fecha:'2026-02-12',hora:'16:20',rit:'6878-2025',ruc:'2501736194-8',tribunal:'15 JG STGO',sala:'',tipo:'ENTREVISTA PRESENCIAL',imputado:'DARLYN ELIANA MEDINA PRIETO'},
  {fecha:'2026-02-13',hora:'13:15',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'403',tipo:'SCP',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2026-02-16',hora:'11:30',rit:'1357-2019',ruc:'1900352294-9',tribunal:'10 JG STGO',sala:'',tipo:'REVISIÓN PENA Y SENTENCIA ABONO',imputado:'FRANCISCO JAVIER SANDOVAL ARENAS'},
  {fecha:'2026-02-17',hora:'08:30',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'ABREVIADO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2026-02-18',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'CIERRE',imputado:'DAGO ANDRES REYES REYES-  NELSON ALONSO LLEMPI'},
  {fecha:'2026-02-18',hora:'17:30',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'ENTREVISTA',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-02-19',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'REVPP',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-02-20',hora:'08:30',rit:'06–2026',ruc:'2210043625-K',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'FACTIBILIDAD',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2026-02-20',hora:'09:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JO',imputado:'CARLOS ARRIAGADA DIAZ'},
  {fecha:'2026-02-20',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3 JG STGO',sala:'902',tipo:'APJO',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2026-02-23',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGANTE',sala:'',tipo:'APJO ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2026-02-23',hora:'09:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12 JG STGO',sala:'',tipo:'CIERRE',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2026-02-23',hora:'09:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JO',imputado:'CARLOS ARRIAGADA DIAZ'},
  {fecha:'2026-02-23',hora:'15:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'ALEXIS ARNALDO GODOY GODOY'},
  {fecha:'2026-02-24',hora:'10:05',rit:'10340-2024',ruc:'2401470201-2',tribunal:'JG VIÑA DEL MAR',sala:'',tipo:'REVOCACIÓN LEY 18.216',imputado:''},
  {fecha:'2026-02-25',hora:'09:00',rit:'06–2026',ruc:'2210043625-K',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'JUICIO ORAL/SIN EFECTO',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2026-02-26',hora:'09:30',rit:'2282-2022',ruc:'2200555190-4',tribunal:'6 JG STGO',sala:'',tipo:'LEY 18.216',imputado:'ELADIO LLEMPI'},
  {fecha:'2026-02-26',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'REAPERTURA',imputado:'DAGO REYES REYES Y NELSON ALONSO LLEMPI'},
  {fecha:'2026-02-27',hora:'10:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'',tipo:'AUMENTO/CIERRE',imputado:'ELSA DEL CARMEN OMERO RIQUELME'},
  {fecha:'2026-02-27',hora:'10:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'',tipo:'CAUTELA DE GARANTIAS',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2026-03-02',hora:'11:30',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'APJO (2)',imputado:'GUILLERMO ALARCÓN QUEROL'},
  {fecha:'2026-03-03',hora:'09:00',rit:'06–2026',ruc:'2210043625-K',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ÁLVARO REYES PAINEO'},
  {fecha:'2026-03-03',hora:'11:00',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'LUIS ANDRES FERNANDEZ SOTO'},
  {fecha:'2026-03-04',hora:'09:00',rit:'7512-2022',ruc:'2201048885-4',tribunal:'JG VALPARAISO',sala:'',tipo:'CAUTELA DE GARANTIAS',imputado:'MIGUEL CAÑUTA VALDERRAMA'},
  {fecha:'2026-03-04',hora:'10:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'701',tipo:'REVPP',imputado:'ELADIO LLEMPI MUÑOZ'},
  {fecha:'2026-03-05',hora:'11:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'',tipo:'APJO ABREVIADO',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2026-03-06',hora:'09:00',rit:'9120-2024',ruc:'2401233589-6',tribunal:'JG PUENTE ALTO',sala:'',tipo:'APJO ABREVIADO',imputado:'SEBASTIÁN SÁNCHEZ GUZMAN'},
  {fecha:'2026-03-06',hora:'14:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'LECTURA SENTENCIA',imputado:'CARLOS PATRICIO ARRIAGADA DÍAZ'},
  {fecha:'2026-03-09',hora:'11:00',rit:'536-2021',ruc:'2101118506-9',tribunal:'4 JG STGO',sala:'1003',tipo:'AUMENTO',imputado:'YEREMY ANDRÉS PÉREZ SANHUEZA'},
  {fecha:'2026-03-09',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6° JG STGO',sala:'702',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-03-11',hora:'12:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'',tipo:'CAUTELA DE GARANTIAS',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2026-03-12',hora:'09:00',rit:'133-2025',ruc:'2300081967-0',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JUICIO ORAL',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2026-03-12',hora:'10:00',rit:'3017-2024',ruc:'2400746285-5',tribunal:'6 JG STGO',sala:'701',tipo:'ABONO CAUSA DIVERSA',imputado:'MARCELO SILVA FERNANDEZ'},
  {fecha:'2026-03-12',hora:'11:00',rit:'1065-2024',ruc:'2400548142-9',tribunal:'JG CAÑETE',sala:'ZOOM',tipo:'JOS',imputado:'CRISTIAN RODRIGUEZ VALDES'},
  {fecha:'2026-03-12',hora:'11:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'ZOOM',tipo:'APJO-ABREVIADO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2026-03-12',hora:'12:00',rit:'11579-2025',ruc:'2501562942-0',tribunal:'JG SAN BERNARDO',sala:'SALA 6',tipo:'REV. CAUTELARES',imputado:'MATIAS VERA ALEGRÍA'},
  {fecha:'2026-03-13',hora:'09:00',rit:'69-2025',ruc:'2301433655-9',tribunal:'5 TOP STGO',sala:'',tipo:'JO / RENUNCIADO',imputado:'MAXIMILIANO DOMÍNGUEZ INOSTROZA'},
  {fecha:'2026-03-16',hora:'10:00',rit:'7645 - 2024',ruc:'2400819196-0',tribunal:'2°JG',sala:'403',tipo:'AUMENTO',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-03-16',hora:'11:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2° JG',sala:'403',tipo:'AUMENTO/REV.PP',imputado:'RODRIGO JAVIER PONCE CASTILLO/IGNACIO CONTRERAS SUFAN'},
  {fecha:'2026-03-18',hora:'09:00',rit:'1235-2025',ruc:'2500127484-0',tribunal:'8°JG',sala:'401',tipo:'ABREVIADO',imputado:'DANIEL ANDRÉS BARRENECHEA RODRÍGUEZ'},
  {fecha:'2026-03-18',hora:'10:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'',tipo:'ABREV/CIERRE/REV.CAUTELARES',imputado:'JORGE ROLANDO VEGA RAMOS'},
  {fecha:'2026-03-18',hora:'16:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4 JG STGO',sala:'',tipo:'ENTREVISTA FISCAL',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-03-19',hora:'11:30',rit:'131-2026',ruc:'2610002810-6',tribunal:'JG QUINTERO',sala:'',tipo:'AUDIENCIA DE QUERELLA',imputado:'MARISOL LAGOS GOMEZ'},
  {fecha:'2026-03-20',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CAÑETE',sala:'',tipo:'APJO',imputado:'DAGO REYES REYES Y NELSON ALONSO LLEMPI'},
  {fecha:'2026-03-20',hora:'10:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2°JG STGO',sala:'404',tipo:'CONTROL EJECUCION',imputado:'SEBASTIAN PARRA GONZALEZ'},
  {fecha:'2026-03-23',hora:'08:30',rit:'',ruc:'',tribunal:'ICA STGO',sala:'TERCERA',tipo:'APELACIÓN CAUTELAR',imputado:'IGNACIO CONTRERAS Y RODRIGO PONCE'},
  {fecha:'2026-03-23',hora:'10:15',rit:'3810-2025',ruc:'',tribunal:'9 JG STGO',sala:'904',tipo:'SCP',imputado:'LUIS ANDRÉS FERNÁNDEZ SOTO'},
  {fecha:'2026-03-24',hora:'10:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2°JG',sala:'B404',tipo:'SEGUIMIENTO 18.216',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2026-03-26',hora:'10:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'701',tipo:'REV.PP',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2026-03-26',hora:'11:00',rit:'929-2026',ruc:'2610007818-9',tribunal:'JG COLINA',sala:'',tipo:'IMPUGNACION SANCION',imputado:'OSVALDO PEREZ PEREZ'},
  {fecha:'2026-03-27',hora:'11:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11 JG STGO',sala:'501',tipo:'DECLARACION',imputado:'MANUEL SARMIENTO'},
  {fecha:'2026-03-30',hora:'09:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'903',tipo:'REV PP',imputado:'EDUARDO MORALES CEA'},
  {fecha:'2026-03-30',hora:'09:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'ZOOM',tipo:'CAUTELA DE GARANTÍAS',imputado:'JAROL FERNÁNDEZ FAUNDES'},
  {fecha:'2026-03-30',hora:'09:00',rit:'7485-2025',ruc:'2500993931-0',tribunal:'4 JG STGO',sala:'1003',tipo:'FORMALIZACION',imputado:'MATÍAS GUILLERMO SOTO ALIAGA'},
  {fecha:'2026-03-30',hora:'11:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'ZOOM',tipo:'APJO',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-03-31',hora:'09:00',rit:'761-2026',ruc:'',tribunal:'ICA VALPARAÍSO',sala:'4 SALA',tipo:'APELACIÓN QUERELLA',imputado:'MARISOL LAGOS GÓMEZ QUERELLANTE'},
  {fecha:'2026-03-31',hora:'12:00',rit:'435-2025',ruc:'2500042913-1',tribunal:'2 JG STGO',sala:'',tipo:'ABREVIADO REVISIÓN DE CAUTELARES Y CIERRE',imputado:'IGNACIO ALEJANDRO CONTRERAS SUFAN Y CHRISTOPHER FABIÁN OLGUÍN ESPINOZA'},
  {fecha:'2026-04-01',hora:'09:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'ZOOM',tipo:'APJO',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-04-02',hora:'10:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'902',tipo:'AUMENTO',imputado:'SEBASTIÁN JESÚS PARRAGUEZ SOTO Y EDUARDO MORALES CEA'},
  {fecha:'2026-04-07',hora:'09:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'202',tipo:'CIERRE',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-04-07',hora:'09:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'REV.CAUTELARES',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2026-04-09',hora:'09:30',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9° JG STGO',sala:'902',tipo:'REV. CAUTELARES',imputado:'LUIS FERNANDEZ SOTO'},
  {fecha:'2026-04-10',hora:'10:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10° JG STGO',sala:'ZOOM',tipo:'AUMENTO',imputado:'ELSA ROMERO RIQUELME'},
  {fecha:'2026-04-13',hora:'08:30',rit:'01--2026',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'',tipo:'FACTIBILIDAD',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-15',hora:'11:00',rit:'11055-2025',ruc:'2501850315-0',tribunal:'2 JG STGO',sala:'403',tipo:'REFORMALIZACION/AUMENTO',imputado:'DYLAN REBOLLEDO RUBILAR'},
  {fecha:'2026-04-15',hora:'12:30',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'202',tipo:'REF/AUM/CIERRE',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-04-16',hora:'15:30',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'ZOOM',tipo:'DECLARACION',imputado:'ELADIO LLEMPI MUÑOZ'},
  {fecha:'2026-04-20',hora:'08:30',rit:'410-2026',ruc:'',tribunal:'ICA PUERTO MONTT',sala:'',tipo:'NULIDAD',imputado:'RAÚL'},
  {fecha:'2026-04-20',hora:'09:30',rit:'181-2026',ruc:'2600364055-7',tribunal:'JG CALBUCO',sala:'1',tipo:'DECLARACION Y REV.PP',imputado:'BAIRON SANHUEZA MANSILLA.'},
  {fecha:'2026-04-21',hora:'09:00',rit:'6081-2026',ruc:'',tribunal:'CORTE SUPREMA',sala:'SEGUNDA',tipo:'NULIDAD',imputado:'CARLOS ARRIAGADA DÍAZ'},
  {fecha:'2026-04-21',hora:'09:10',rit:'77-2026',ruc:'2600081402-3',tribunal:'JG AYSEN',sala:'',tipo:'SCP',imputado:'EDUARDO ABARCA WALLIS'},
  {fecha:'2026-04-21',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3 JG STGO',sala:'902',tipo:'APJO',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2026-04-22',hora:'09:00',rit:'01--2026',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'',tipo:'JO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-22',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGANTE',sala:'',tipo:'APJO/ABREVIADO',imputado:'SEBASTIÁN CRISTÓBAL EDUARDO PARRA GONZÁLEZ'},
  {fecha:'2026-04-22',hora:'09:00',rit:'11579-2025',ruc:'2501562942-0',tribunal:'JG SAN BERNARDO',sala:'SALA 7',tipo:'AUMENTO',imputado:'MATÍAS VERÁ Y CHRISTOPHER OLGUIN'},
  {fecha:'2026-04-23',hora:'09:00',rit:'01--2026',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'',tipo:'JO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-23',hora:'11:00',rit:'12774-2024',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'204',tipo:'REV PP',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-04-24',hora:'09:00',rit:'536-2022',ruc:'2101118506-9',tribunal:'4 JG STGO',sala:'903',tipo:'AUMENTO',imputado:'YEREMY ANDRÉS PÉREZ SANHUEZA'},
  {fecha:'2026-04-27',hora:'11:30',rit:'200-2023',ruc:'2310002516-7',tribunal:'8 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'ANGELA GELMI DONOSO'},
  {fecha:'2026-04-29',hora:'09:00',rit:'16081-2026',ruc:'',tribunal:'CORTE SUPREMA',sala:'SEGUNDA',tipo:'NULIDAD',imputado:'CARLOS ARRIAGADA DÍAZ'},
  {fecha:'2026-04-29',hora:'14:00',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'904',tipo:'CIERRE',imputado:'LUIS FERNANDEZ SOTO'},
  {fecha:'2026-05-04',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'503',tipo:'CIERRE',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-05-04',hora:'12:00',rit:'435-2025',ruc:'2500042913-1',tribunal:'2 JG STGO',sala:'403',tipo:'ABREV/REV.CAUT/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN Y CHRISTOFER OLGUIN ESPINOZA'},
  {fecha:'2026-05-05',hora:'09:00',rit:'01--2026',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'REVPP',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-05-05',hora:'09:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'701',tipo:'AUMENTO',imputado:'ELADIO LLEMPI MUÑOZ'},
  {fecha:'2026-05-05',hora:'09:30',rit:'3010-2024',ruc:'2410019528-K',tribunal:'JG PUENTE ALTO',sala:'',tipo:'SIMPLIFICADO',imputado:'LUIS ARMANDO ROJAS CAMPOS'},
  {fecha:'2026-05-05',hora:'15:00',rit:'2785-2026',ruc:'2600454946-4',tribunal:'JG SAN BERNARDO',sala:'PRESENCIAL',tipo:'DECLARACION',imputado:'PAULO GENESIS URRUTIA PEREZ Y GABRIEL BENJAMIN VALDÉS PÉREZ'},
  {fecha:'2026-05-05',hora:'15:30',rit:'181-2026',ruc:'2600364055-7',tribunal:'JG CALBUCO',sala:'',tipo:'ENTREVISTA',imputado:'BAIRON DANIEL SANHUEZA MANSILLA'},
  {fecha:'2026-05-07',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'202',tipo:'APJO',imputado:'ALEXIS GODOY GODOY'},
  {fecha:'2026-05-07',hora:'12:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11JG SANTIAGO',sala:'',tipo:'DEC JUDICIAL',imputado:'MANUEL SARMIENTO MONSERRAT'},
  {fecha:'2026-05-07',hora:'17:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'ENTREVISTA',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-05-08',hora:'11:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'903',tipo:'ABREV/REFRM/AUMENTO',imputado:'SEBASTIÁN JESÚS PARRAGUEZ SOTO Y EDUARDO ANTONIO MORALES CEA'},
  {fecha:'2026-05-11',hora:'10:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'AUMENTO',imputado:'GONZALO SEBASTIÁN GÓMEZ MARTINEZ'},
  {fecha:'2026-05-13',hora:'11:00',rit:'929-2026',ruc:'2610007818-9',tribunal:'JG COLINA',sala:'',tipo:'IMPUGNACION SANCION',imputado:'OSVALDO PEREZ PEREZ'},
  {fecha:'2026-05-13',hora:'15:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'',tipo:'DECLARACION MP',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-05-14',hora:'09:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'ZOOM',tipo:'APJO ABREVIADO',imputado:'JORGE VEGA RAMOS'},
  {fecha:'2026-05-18',hora:'11:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'ABREV/APJO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2026-05-25',hora:'10:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'204',tipo:'REVPP',imputado:'FELIPE AVENDAÑO TORTOZA'},
  {fecha:'2026-05-25',hora:'11:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'403',tipo:'CIERRE/ SE REPROGRAMO',imputado:'RODRIGO JAVIER PONCE CASTILLO - IGNACIO ALEJANDRO CONTRERAS SUFAN'},
  {fecha:'2026-05-26',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6° JG STGO',sala:'702',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-05-26',hora:'11:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11°JG',sala:'501/ZOOM',tipo:'REVPP/AUMENTO',imputado:'DARLYN MEDINA PRIETO/MANUEL SARMIENTO'},
  {fecha:'2026-05-26',hora:'12:00',rit:'5235-2024',ruc:'2400587164-2',tribunal:'4°JG',sala:'1003',tipo:'CAUTELA GARANTIAS',imputado:'ELIOT JARA ESCOBAR'},
  {fecha:'2026-05-27',hora:'09:10',rit:'77-2026',ruc:'2600081402-3',tribunal:'JG AYSEN',sala:'ZOOM',tipo:'SCP',imputado:'EDUARDO ENRIQUE ABARCA WALLIS'},
  {fecha:'2026-05-28',hora:'10:00',rit:'11055-2025',ruc:'2501850315-0',tribunal:'2 JG STGO',sala:'404',tipo:'REFORMALIZACION',imputado:'DYLAN AMENOFIS REBOLLEDO RUBILAR'},
  {fecha:'2026-05-28',hora:'12:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6° JG STGO',sala:'',tipo:'APJO ABREVIADO',imputado:'JONNIER GARCES QUIÑONES'},
  {fecha:'2026-06-01',hora:'08:15',rit:'2026-01-01 00:00:00',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'AUTORIZADION DILIGENCIA',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-06-02',hora:'08:30',rit:'1712-2025',ruc:'2501404704-5',tribunal:'JG SAN JAVIER',sala:'ZOOM',tipo:'APJO',imputado:'HUGO ALEJANDRO MUÑOZ BRAVO'},
  {fecha:'2026-06-02',hora:'09:00',rit:'384-2025',ruc:'2200390509-1',tribunal:'4 TOP',sala:'',tipo:'JO',imputado:'LUIS ALBERTO FERNÁNDEZ VEGA'},
  {fecha:'2026-06-02',hora:'10:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'702',tipo:'REVPP',imputado:'ELADIO LLEMPI MUÑOZ'},
  {fecha:'2026-06-02',hora:'10:00',rit:'5545-2020',ruc:'1901383927-4',tribunal:'2 JG STGO',sala:'404',tipo:'REVISION DE SENTENCIA',imputado:'CLAUDIO NVARRETE TRONCOSO'},
  {fecha:'2026-06-04',hora:'10:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'SALA 1',tipo:'APJO',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2026-06-08',hora:'08:30',rit:'2026-01-01 00:00:00',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'FACTIBILIDAD',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-06-08',hora:'09:30',rit:'5551-2023',ruc:'2301089527-8',tribunal:'14 JG STGO',sala:'904',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'ALFONSO SANTOS VALENZUELA'},
  {fecha:'2026-06-09',hora:'11:15',rit:'1214-2019',ruc:'1900168887-4',tribunal:'8 JG STGO',sala:'401',tipo:'ABONOS',imputado:'VICTOR VARGAS MORALE'},
  {fecha:'2026-06-10',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGANTE',sala:'4',tipo:'APJO',imputado:'SEBASTIAN PARRA GONZALEZ'},
  {fecha:'2026-06-10',hora:'10:00',rit:'2785-2026',ruc:'2600454946-4',tribunal:'JG SAN BERNARDO',sala:'SALA2',tipo:'REVPP/AUMENTO',imputado:'PAULO GENESIS URRUTIA PEREZ Y GABRIEL BENJAMIN VALDÉS PÉREZ'},
  {fecha:'2026-06-11',hora:'12:00',rit:'435-2025',ruc:'2500042913-1',tribunal:'2 JG STGO',sala:'404',tipo:'ABREVIADO/CAUTELARES/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN Y CRISTOPHER OLGUIN ESPINOZA'},
  {fecha:'2026-06-12',hora:'09:45',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'ZOOM',tipo:'AUMENTO',imputado:'ELSA ROMERO RIQUELME'},
  {fecha:'2026-06-15',hora:'09:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8° JG STGO',sala:'402',tipo:'SCP',imputado:'NEIL SIDNEY ERNESTO ESCOBAR ALLENDES'},
  {fecha:'2026-06-15',hora:'10:00',rit:'771-2026',ruc:'2600181607-0',tribunal:'2 JG STGO',sala:'503',tipo:'AUMENTO',imputado:'DYLAN AMENOFIS REBOLLEDO RUBILAR'},
  {fecha:'2026-06-16',hora:'12:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-06-17',hora:'12:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11 JG STGO',sala:'501',tipo:'DECLARACION',imputado:'MANUEL SARMIENTO'},
  {fecha:'2026-06-18',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'202',tipo:'APJO',imputado:'ALEXIS GODOY GODOY'},
  {fecha:'2026-06-23',hora:'09:00',rit:'2026-01-01 00:00:00',ruc:'2501221651-6',tribunal:'TOP CAÑETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-06-26',hora:'11:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'403',tipo:'ABREVIADO/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN'},
  {fecha:'2026-07-01',hora:'09:00',rit:'4369-2022',ruc:'2200390510-5',tribunal:'7 JG STGO',sala:'204',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'CLAUDIO NAVARRETE TRONCOSO'},
  {fecha:'2026-07-07',hora:'09:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'SALA1',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'JORGE VEGA LAGOS'},
  {fecha:'2026-07-21',hora:'10:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'4',tipo:'ABREVIADO/CIERRE',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2026-07-29',hora:'09:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6 JG STGO',sala:'',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'}
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
