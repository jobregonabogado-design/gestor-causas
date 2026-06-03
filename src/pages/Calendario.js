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
  {fecha:'2026-02-12',hora:'16:20',rit:'6878-2025',ruc:'2501736194-8',tribunal:'15 JG STGO',sala:'',tipo:'ENTREVISTA PRESENCIAL',imputado:'DARLYN ELIANA MEDINA PRIETO'},
  {fecha:'2026-02-13',hora:'13:15',rit:'200-2023',ruc:'2310002516-7',tribunal:'8 JG STGO',sala:'403',tipo:'SCP',imputado:'NEIL ESCOBAR ALLENDES'},
  {fecha:'2026-02-16',hora:'11:30',rit:'1357-2019',ruc:'1900352294-9',tribunal:'10 JG STGO',sala:'',tipo:'REVISION PENA Y SENTENCIA ABONO',imputado:'FRANCISCO JAVIER SANDOVAL ARENAS'},
  {fecha:'2026-02-17',hora:'08:30',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'ABREVIADO',imputado:'GONZALO SEBASTIAN GOMEZ MARTINEZ'},
  {fecha:'2026-02-18',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'CIERRE',imputado:'DAGO REYES REYES - NELSON LLEMPI'},
  {fecha:'2026-02-19',hora:'09:00',rit:'3945-2024',ruc:'2401606038-7',tribunal:'JG MELIPILLA',sala:'',tipo:'REVPP',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-02-20',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3 JG STGO',sala:'902',tipo:'APJO',imputado:'JONNIER GARCES QUINONES'},
  {fecha:'2026-02-20',hora:'08:30',rit:'06-2026',ruc:'2210043625-K',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'FACTIBILIDAD',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-02-20',hora:'09:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JO',imputado:'CARLOS ARRIAGADA DIAZ'},
  {fecha:'2026-02-23',hora:'09:00',rit:'315-2024',ruc:'2300647945-6',tribunal:'12 JG STGO',sala:'',tipo:'CIERRE',imputado:'CRISTIAN BRAVO ARDILES'},
  {fecha:'2026-02-25',hora:'09:00',rit:'06-2026',ruc:'2210043625-K',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-02-26',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'REAPERTURA',imputado:'DAGO REYES REYES Y NELSON LLEMPI'},
  {fecha:'2026-02-26',hora:'09:30',rit:'2282-2022',ruc:'2200555190-4',tribunal:'6 JG STGO',sala:'',tipo:'LEY 18.216',imputado:'ELADIO LLEMPI'},
  {fecha:'2026-02-27',hora:'10:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'',tipo:'AUMENTO/CIERRE',imputado:'ELSA DEL CARMEN ROMERO RIQUELME'},
  {fecha:'2026-03-02',hora:'11:30',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'',tipo:'APJO (2)',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-03-03',hora:'09:00',rit:'06-2026',ruc:'2210043625-K',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-03-03',hora:'11:00',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'LUIS ANDRES FERNANDEZ SOTO'},
  {fecha:'2026-03-04',hora:'10:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'701',tipo:'REVPP',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2026-03-05',hora:'11:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6 JG STGO',sala:'',tipo:'APJO ABREVIADO',imputado:'JONNIER GARCES QUINONES'},
  {fecha:'2026-03-06',hora:'14:00',rit:'71-2021',ruc:'1901092770-9',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'LECTURA SENTENCIA',imputado:'CARLOS PATRICIO ARRIAGADA DIAZ'},
  {fecha:'2026-03-06',hora:'09:00',rit:'9120-2024',ruc:'2401233589-6',tribunal:'JG PUENTE ALTO',sala:'',tipo:'APJO ABREVIADO',imputado:'SEBASTIAN SANCHEZ GUZMAN'},
  {fecha:'2026-03-09',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6 JG STGO',sala:'702',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-03-09',hora:'11:00',rit:'536-2021',ruc:'2101118506-9',tribunal:'4 JG STGO',sala:'1003',tipo:'AUMENTO',imputado:'YEREMY ANDRES PEREZ SANHUEZA'},
  {fecha:'2026-03-11',hora:'12:00',rit:'544-2020',ruc:'2000210433-5',tribunal:'JG MELIPILLA',sala:'',tipo:'CAUTELA DE GARANTIAS',imputado:'JAROL FERNANDEZ FAUNDEZ'},
  {fecha:'2026-03-12',hora:'09:00',rit:'133-2025',ruc:'2300081967-0',tribunal:'TOP SAN BERNARDO',sala:'',tipo:'JUICIO ORAL',imputado:'DIEGO MORALES CARRASCO'},
  {fecha:'2026-03-12',hora:'11:00',rit:'11579-2025',ruc:'2501562942-0',tribunal:'JG SAN BERNARDO',sala:'SALA 6',tipo:'REV CAUTELARES',imputado:'MATIAS VERA ALEGRIA'},
  {fecha:'2026-03-13',hora:'09:00',rit:'69-2025',ruc:'2301433655-9',tribunal:'5 TOP STGO',sala:'',tipo:'JO RENUNCIADO',imputado:'MAXIMILIANO DOMINGUEZ INOSTROZA'},
  {fecha:'2026-03-16',hora:'10:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'403',tipo:'AUMENTO',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-03-16',hora:'11:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'403',tipo:'AUMENTO/REV PP',imputado:'RODRIGO PONCE CASTILLO/IGNACIO CONTRERAS'},
  {fecha:'2026-03-18',hora:'09:00',rit:'1235-2025',ruc:'2500127484-0',tribunal:'8 JG STGO',sala:'401',tipo:'ABREVIADO',imputado:'DANIEL ANDRES BARRENECHEA RODRIGUEZ'},
  {fecha:'2026-03-18',hora:'10:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'',tipo:'ABREV/CIERRE/REV CAUTELARES',imputado:'JORGE ROLANDO VEGA RAMOS'},
  {fecha:'2026-03-19',hora:'11:30',rit:'131-2026',ruc:'2610002810-6',tribunal:'JG QUINTERO',sala:'',tipo:'AUDIENCIA DE QUERELLA',imputado:'MARISOL LAGOS GOMEZ'},
  {fecha:'2026-03-20',hora:'09:30',rit:'893-2022',ruc:'2210043625-K',tribunal:'JG CANETE',sala:'',tipo:'APJO',imputado:'DAGO REYES REYES Y NELSON LLEMPI'},
  {fecha:'2026-03-24',hora:'10:00',rit:'5077-2025',ruc:'2500759103-1',tribunal:'2 JG STGO',sala:'B404',tipo:'SEGUIMIENTO 18.216',imputado:'SEBASTIAN CRISTOBAL PARRA GONZALEZ'},
  {fecha:'2026-03-26',hora:'10:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6 JG STGO',sala:'701',tipo:'REV PP',imputado:'JONNIER GARCES QUINONES'},
  {fecha:'2026-03-27',hora:'11:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11 JG STGO',sala:'501',tipo:'DECLARACION',imputado:'MANUEL SARMIENTO'},
  {fecha:'2026-03-30',hora:'09:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'903',tipo:'REV PP',imputado:'EDUARDO MORALES CEA'},
  {fecha:'2026-03-30',hora:'11:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'ZOOM',tipo:'APJO',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-03-31',hora:'09:00',rit:'761-2026',ruc:'',tribunal:'ICA VALPARAISO',sala:'4 SALA',tipo:'APELACION QUERELLA',imputado:'MARISOL LAGOS GOMEZ QUERELLANTE'},
  {fecha:'2026-03-31',hora:'12:00',rit:'435-2025',ruc:'2500042913-1',tribunal:'2 JG STGO',sala:'',tipo:'ABREV/REV CAUT/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN Y CHRISTOPHER OLGUIN'},
  {fecha:'2026-04-01',hora:'09:45',rit:'667-2024',ruc:'2401153623-5',tribunal:'JG LITUECHE',sala:'ZOOM',tipo:'APJO',imputado:'GUILLERMO ALARCON QUEROL'},
  {fecha:'2026-04-02',hora:'10:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'902',tipo:'AUMENTO',imputado:'SEBASTIAN PARRAGUEZ Y EDUARDO MORALES'},
  {fecha:'2026-04-07',hora:'09:00',rit:'6225-2024',ruc:'2400549188-2',tribunal:'JG COLINA',sala:'',tipo:'REV CAUTELARES',imputado:'JUAN FLORES FARIAS'},
  {fecha:'2026-04-07',hora:'09:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'202',tipo:'CIERRE',imputado:'FELIPE AVENDANO TORTOZA'},
  {fecha:'2026-04-09',hora:'09:30',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'902',tipo:'REV CAUTELARES',imputado:'LUIS FERNANDEZ SOTO'},
  {fecha:'2026-04-10',hora:'10:00',rit:'362-2025',ruc:'2500028986-0',tribunal:'10 JG STGO',sala:'ZOOM',tipo:'AUMENTO',imputado:'ELSA ROMERO RIQUELME'},
  {fecha:'2026-04-13',hora:'08:30',rit:'01-2026',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'',tipo:'FACTIBILIDAD',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-15',hora:'12:30',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'202',tipo:'REF/AUM/CIERRE',imputado:'FELIPE AVENDANO TORTOZA'},
  {fecha:'2026-04-15',hora:'11:00',rit:'11055-2025',ruc:'2501850315-0',tribunal:'2 JG STGO',sala:'403',tipo:'REFORMALIZACION/AUMENTO',imputado:'DYLAN REBOLLEDO RUBILAR'},
  {fecha:'2026-04-16',hora:'15:30',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'ZOOM',tipo:'DECLARACION',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2026-04-20',hora:'09:30',rit:'181-2026',ruc:'2600364055-7',tribunal:'JG CALBUCO',sala:'1',tipo:'DECLARACION Y REV PP',imputado:'BAIRON SANHUEZA MANSILLA'},
  {fecha:'2026-04-21',hora:'09:10',rit:'77-2026',ruc:'2600081402-3',tribunal:'JG AYSEN',sala:'',tipo:'SCP',imputado:'EDUARDO ABARCA WALLIS'},
  {fecha:'2026-04-21',hora:'10:00',rit:'3177-2022',ruc:'2200708923-K',tribunal:'3 JG STGO',sala:'902',tipo:'APJO',imputado:'JONNIER GARCES QUINONES'},
  {fecha:'2026-04-22',hora:'09:00',rit:'01-2026',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'',tipo:'JO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-22',hora:'09:00',rit:'11579-2025',ruc:'2501562942-0',tribunal:'JG SAN BERNARDO',sala:'SALA 7',tipo:'AUMENTO',imputado:'MATIAS VERA Y CHRISTOPHER OLGUIN'},
  {fecha:'2026-04-23',hora:'09:00',rit:'01-2026',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'',tipo:'JO',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-04-24',hora:'09:00',rit:'536-2022',ruc:'2101118506-9',tribunal:'4 JG STGO',sala:'903',tipo:'AUMENTO',imputado:'YEREMY ANDRES PEREZ SANHUEZA'},
  {fecha:'2026-04-27',hora:'11:30',rit:'200-2023',ruc:'2310002516-7',tribunal:'8 JG STGO',sala:'',tipo:'ENTREVISTA',imputado:'ANGELA GELMI DONOSO'},
  {fecha:'2026-04-29',hora:'14:00',rit:'3810-2025',ruc:'2525270313-9',tribunal:'9 JG STGO',sala:'904',tipo:'CIERRE',imputado:'LUIS FERNANDEZ SOTO'},
  {fecha:'2026-05-04',hora:'11:00',rit:'7645-2024',ruc:'2400819196-0',tribunal:'2 JG STGO',sala:'503',tipo:'CIERRE',imputado:'RODRIGO JAVIER PONCE CASTILLO'},
  {fecha:'2026-05-05',hora:'09:00',rit:'01-2026',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'REVPP',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-05-05',hora:'09:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'701',tipo:'AUMENTO',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2026-05-07',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'202',tipo:'APJO',imputado:'ALEXIS GODOY GODOY'},
  {fecha:'2026-05-08',hora:'11:00',rit:'162-2026',ruc:'2600027076-7',tribunal:'4 JG STGO',sala:'903',tipo:'ABREV/REFRM/AUMENTO',imputado:'SEBASTIAN PARRAGUEZ Y EDUARDO MORALES'},
  {fecha:'2026-05-11',hora:'10:00',rit:'4520-2023',ruc:'2310029407-9',tribunal:'JG PUERTO MONTT',sala:'ZOOM',tipo:'AUMENTO',imputado:'GONZALO SEBASTIAN GOMEZ MARTINEZ'},
  {fecha:'2026-05-13',hora:'15:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'',tipo:'DECLARACION MP',imputado:'FELIPE AVENDANO TORTOZA'},
  {fecha:'2026-05-14',hora:'09:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'ZOOM',tipo:'APJO ABREVIADO',imputado:'JORGE VEGA RAMOS'},
  {fecha:'2026-05-18',hora:'11:00',rit:'5709-2020',ruc:'2000998147-1',tribunal:'JG TALCAHUANO',sala:'',tipo:'ABREV/APJO',imputado:'DAMIAN ENRIQUEZ CUEVAS'},
  {fecha:'2026-05-25',hora:'10:00',rit:'12774-2025',ruc:'2501298946-9',tribunal:'7 JG STGO',sala:'204',tipo:'REVPP',imputado:'FELIPE AVENDANO TORTOZA'},
  {fecha:'2026-05-26',hora:'11:00',rit:'5582-2024',ruc:'2401353691-7',tribunal:'6 JG STGO',sala:'702',tipo:'APJO',imputado:'BASTIAN MALDONADO CORNEJO'},
  {fecha:'2026-05-28',hora:'12:00',rit:'3912-2023',ruc:'2300866793-4',tribunal:'6 JG STGO',sala:'',tipo:'APJO ABREVIADO',imputado:'JONNIER GARCES QUINONES'},
  {fecha:'2026-06-02',hora:'09:00',rit:'384-2025',ruc:'2200390509-1',tribunal:'4 TOP',sala:'',tipo:'JO',imputado:'LUIS ALBERTO FERNANDEZ VEGA'},
  {fecha:'2026-06-02',hora:'10:00',rit:'160-2026',ruc:'2600043429-8',tribunal:'6 JG STGO',sala:'702',tipo:'REVPP',imputado:'ELADIO LLEMPI MUNOZ'},
  {fecha:'2026-06-02',hora:'08:30',rit:'1712-2025',ruc:'2501404704-5',tribunal:'JG SAN JAVIER',sala:'ZOOM',tipo:'APJO',imputado:'HUGO ALEJANDRO MUNOZ BRAVO'},
  {fecha:'2026-06-02',hora:'10:00',rit:'5545-2020',ruc:'1901383927-4',tribunal:'2 JG STGO',sala:'404',tipo:'REVISION DE SENTENCIA',imputado:'CLAUDIO NAVARRETE TRONCOSO'},
  {fecha:'2026-06-04',hora:'10:00',rit:'327-2025',ruc:'2500236060-0',tribunal:'JG CALERA',sala:'SALA 1',tipo:'APJO',imputado:'RICARDO GODOY VILLAGRAN'},
  {fecha:'2026-06-08',hora:'09:30',rit:'5551-2023',ruc:'2301089527-8',tribunal:'14 JG STGO',sala:'904',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'ALFONSO SANTOS VALENZUELA'},
  {fecha:'2026-06-09',hora:'11:15',rit:'1214-2019',ruc:'1900168887-4',tribunal:'8 JG STGO',sala:'401',tipo:'ABONOS',imputado:'VICTOR VARGAS MORALE'},
  {fecha:'2026-06-10',hora:'09:00',rit:'1066-2024',ruc:'2400321347-8',tribunal:'JG TALAGANTE',sala:'4',tipo:'APJO',imputado:'SEBASTIAN PARRA GONZALEZ'},
  {fecha:'2026-06-11',hora:'12:00',rit:'435-2025',ruc:'2500042913-1',tribunal:'2 JG STGO',sala:'404',tipo:'ABREVIADO/CAUTELARES/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN Y CRISTOPHER OLGUIN'},
  {fecha:'2026-06-15',hora:'09:00',rit:'200-2023',ruc:'2310002516-7',tribunal:'8 JG STGO',sala:'402',tipo:'SCP',imputado:'NEIL ESCOBAR ALLENDES'},
  {fecha:'2026-06-15',hora:'10:00',rit:'771-2026',ruc:'2600181607-0',tribunal:'2 JG STGO',sala:'503',tipo:'AUMENTO',imputado:'DYLAN AMENOFIS REBOLLEDO RUBILAR'},
  {fecha:'2026-06-17',hora:'12:00',rit:'6878-2025',ruc:'2501736194-8',tribunal:'11 JG STGO',sala:'501',tipo:'DECLARACION',imputado:'MANUEL SARMIENTO'},
  {fecha:'2026-06-18',hora:'09:00',rit:'21223-2018',ruc:'1801167745-9',tribunal:'7 JG STGO',sala:'202',tipo:'APJO',imputado:'ALEXIS GODOY GODOY'},
  {fecha:'2026-06-23',hora:'09:00',rit:'46023',ruc:'2501221651-6',tribunal:'TOP CANETE',sala:'ZOOM',tipo:'JUICIO ORAL',imputado:'ALVARO REYES PAINEO'},
  {fecha:'2026-06-26',hora:'11:00',rit:'9747-2025',ruc:'2501570906-8',tribunal:'2 JG STGO',sala:'403',tipo:'ABREVIADO/CIERRE',imputado:'IGNACIO CONTRERAS SUFAN'},
  {fecha:'2026-07-01',hora:'09:00',rit:'4369-2022',ruc:'2200390510-5',tribunal:'7 JG STGO',sala:'204',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'CLAUDIO NAVARRETE TRONCOSO'},
  {fecha:'2026-07-07',hora:'09:00',rit:'1645-2025',ruc:'2501137062-7',tribunal:'JG QUINTERO',sala:'SALA1',tipo:'APJO ABREVIADO/CAUTELARES',imputado:'JORGE VEGA LAGOS'},
]

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DS = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"]

export default function Calendario() {
  const hoy = new Date()
  const [anno, setAnno] = useState(2026)
  const [mes, setMes] = useState(hoy.getMonth())
  const [diaS, setDiaS] = useState(null)
  const [busq, setBusq] = useState("")

  const porFecha = useMemo(() => {
    const m = {}
    AUDIENCIAS.forEach(a => { if (!m[a.fecha]) m[a.fecha] = []; m[a.fecha].push(a) })
    return m
  }, [])

  const proximas = useMemo(() => {
    const hoyStr = new Date().toISOString().split("T")[0]
    return AUDIENCIAS.filter(a => a.fecha >= hoyStr).sort((a,b) => a.fecha.localeCompare(b.fecha)).slice(0, 15)
  }, [])

  const filtradas = useMemo(() => {
    if (!busq) return []
    const s = busq.toLowerCase()
    return AUDIENCIAS.filter(a => a.imputado.toLowerCase().includes(s) || a.rit.toLowerCase().includes(s) || a.tipo.toLowerCase().includes(s) || a.tribunal.toLowerCase().includes(s) || a.ruc.toLowerCase().includes(s))
  }, [busq])

  const diasMes = useMemo(() => {
    const p = new Date(anno, mes, 1).getDay()
    const t = new Date(anno, mes + 1, 0).getDate()
    const d = []
    for (let i = 0; i < p; i++) d.push(null)
    for (let i = 1; i <= t; i++) d.push(i)
    return d
  }, [anno, mes])

  const diaHoy = hoy.getFullYear() === anno && hoy.getMonth() === mes ? hoy.getDate() : null
  const fechaSel = diaS ? anno + "-" + String(mes+1).padStart(2,"0") + "-" + String(diaS).padStart(2,"0") : null
  const audsDia = fechaSel ? (porFecha[fechaSel] || []) : []
  const totalMes = AUDIENCIAS.filter(a => a.fecha.startsWith(anno + "-" + String(mes+1).padStart(2,"0"))).length

  const css = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap");*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Inter",sans-serif;background:#080810;color:#e2e8f0}.dh:hover{background:rgba(99,102,241,0.15)!important;cursor:pointer}.ac:hover{background:rgba(99,102,241,0.07)!important}.nb:hover{background:rgba(99,102,241,0.12)!important}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}input:focus{border-color:#6366f1!important;outline:none}`

  return (
    <div style={{padding:"24px",background:"#080810",minHeight:"100vh"}}>
      <style>{css}</style>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>Calendario de Audiencias</div>
        <div style={{fontSize:12,color:"#475569"}}>{totalMes} audiencias en {MESES[mes]} {anno}</div>
      </div>
      <div style={{marginBottom:16}}>
        <input style={{width:"100%",maxWidth:480,padding:"10px 14px",background:"#0d0d18",border:"1px solid #1e293b",borderRadius:10,fontSize:13,color:"#e2e8f0",transition:"border-color 0.15s"}} placeholder="Buscar imputado, RIT, tipo, tribunal..." value={busq} onChange={e=>setBusq(e.target.value)}/>
      </div>
      {busq && (
        <div style={{marginBottom:16,background:"#0d0d18",borderRadius:12,border:"1px solid #1e293b",overflow:"hidden",maxHeight:280,overflowY:"auto"}}>
          {filtradas.length === 0 ? <div style={{padding:"16px",color:"#334155",fontSize:13}}>Sin resultados</div> :
          filtradas.map((a,i) => (
            <div key={i} className="ac" style={{padding:"12px 16px",borderBottom:"1px solid #0d0d14",transition:"background 0.1s"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontFamily:"JetBrains Mono",fontSize:11,color:"#818cf8"}}>{a.fecha}</span>
                <span style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>{a.hora}</span>
              </div>
              <div style={{fontSize:13,color:"#e2e8f0",fontWeight:500,marginBottom:2}}>{a.imputado}</div>
              <div style={{fontSize:10,color:"#6366f1"}}>{a.tipo} · {a.tribunal}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16}}>
        <div>
          <div style={{background:"#0d0d18",borderRadius:14,border:"1px solid #1e293b",overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #111827",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <button className="nb" onClick={()=>{if(mes===0){setMes(11);setAnno(a=>a-1)}else setMes(m=>m-1)}} style={{background:"transparent",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"5px 12px",fontSize:13,cursor:"pointer",transition:"background 0.15s"}}>←</button>
              <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9"}}>{MESES[mes]} {anno}</div>
              <button className="nb" onClick={()=>{if(mes===11){setMes(0);setAnno(a=>a+1)}else setMes(m=>m+1)}} style={{background:"transparent",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"5px 12px",fontSize:13,cursor:"pointer",transition:"background 0.15s"}}>→</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #111827"}}>
              {DS.map(d => <div key={d} style={{padding:"8px 0",textAlign:"center",fontSize:10,color:"#475569",fontWeight:600,letterSpacing:0.5}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
              {diasMes.map((dia,i) => {
                if (!dia) return <div key={i} style={{minHeight:72,borderBottom:"1px solid #0a0a10",borderRight:"1px solid #0a0a10"}}/>
                const f = anno+"-"+String(mes+1).padStart(2,"0")+"-"+String(dia).padStart(2,"0")
                const a = porFecha[f] || []
                const esH = dia === diaHoy
                const esS = dia === diaS
                return (
                  <div key={i} className="dh" onClick={()=>setDiaS(dia===diaS?null:dia)} style={{minHeight:72,padding:"5px",borderBottom:"1px solid #0a0a10",borderRight:"1px solid #0a0a10",background:esS?"rgba(99,102,241,0.1)":"transparent",transition:"background 0.1s"}}>
                    <div style={{fontSize:11,fontWeight:esH||esS?700:400,color:esH?"#6366f1":esS?"#818cf8":"#475569",width:20,height:20,borderRadius:"50%",background:esH?"rgba(99,102,241,0.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:3}}>{dia}</div>
                    {a.slice(0,2).map((x,j) => <div key={j} style={{fontSize:8,background:"rgba(99,102,241,0.18)",color:"#818cf8",borderRadius:3,padding:"1px 3px",marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.hora} {x.imputado.split(" ")[0]}</div>)}
                    {a.length > 2 && <div style={{fontSize:8,color:"#475569"}}>+{a.length-2}</div>}
                  </div>
                )
              })}
            </div>
          </div>
          {diaS && (
            <div style={{marginTop:14,background:"#0d0d18",borderRadius:14,border:"1px solid #1e293b",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #111827",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontWeight:700,color:"#f1f5f9",fontSize:13}}>{DS[new Date(anno,mes,diaS).getDay()]} {diaS} de {MESES[mes]}</div>
                <span style={{fontSize:11,color:"#475569"}}>{audsDia.length} audiencia{audsDia.length!==1?"s":""}</span>
              </div>
              {audsDia.length === 0 ? <div style={{padding:"20px 16px",color:"#334155",fontSize:13,textAlign:"center"}}>Sin audiencias</div> :
              audsDia.map((a,i) => (
                <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #0d0d14"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{a.hora}</span>
                    <span style={{fontSize:10,background:"rgba(99,102,241,0.15)",color:"#818cf8",padding:"2px 10px",borderRadius:20,fontWeight:600}}>{a.tipo}</span>
                  </div>
                  <div style={{fontSize:13,color:"#cbd5e1",fontWeight:500,marginBottom:3}}>{a.imputado}</div>
                  <div style={{fontSize:11,color:"#475569"}}>{a.tribunal}{a.sala?" · "+a.sala:""} · RIT: {a.rit}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{background:"#0d0d18",borderRadius:14,border:"1px solid #1e293b",overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #111827"}}><div style={{fontWeight:700,color:"#f1f5f9",fontSize:13}}>Proximas audiencias</div></div>
          <div style={{maxHeight:580,overflowY:"auto"}}>
            {proximas.map((a,i) => {
              const f = new Date(a.fecha+"T12:00:00")
              const d = Math.ceil((f - new Date()) / (1000*60*60*24))
              const urg = d <= 1
              const prn = d <= 7
              return (
                <div key={i} className="ac" style={{padding:"10px 14px",borderBottom:"1px solid #0d0d14",transition:"background 0.1s",borderLeft:"3px solid "+(urg?"#ef4444":prn?"#f59e0b":"#1e293b")}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:10,fontFamily:"JetBrains Mono",color:urg?"#ef4444":prn?"#f59e0b":"#475569",fontWeight:600}}>{f.toLocaleDateString("es-CL",{weekday:"short",day:"numeric",month:"short"})}</span>
                    <span style={{fontSize:9,color:urg?"#ef4444":prn?"#f59e0b":"#1e293b",fontWeight:700}}>{d<=0?"HOY":d===1?"MANANA":d+"d"}</span>
                  </div>
                  <div style={{fontSize:11,color:"#e2e8f0",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.imputado}</div>
                  <div style={{fontSize:10,color:"#6366f1",marginTop:1}}>{a.tipo}</div>
                  <div style={{fontSize:9,color:"#334155"}}>{a.hora} · {a.tribunal}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
