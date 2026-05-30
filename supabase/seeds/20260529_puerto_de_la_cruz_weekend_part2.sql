-- Weekend events in Puerto de la Cruz — additional batch (Events 7–19)
-- Times in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  e7  uuid := gen_random_uuid();
  e8  uuid := gen_random_uuid();
  e10 uuid := gen_random_uuid();
  e11 uuid := gen_random_uuid();
  e12 uuid := gen_random_uuid();
  e13 uuid := gen_random_uuid();
  e14 uuid := gen_random_uuid();
  e15 uuid := gen_random_uuid();
  e16 uuid := gen_random_uuid();
  e18 uuid := gen_random_uuid();
  e19 uuid := gen_random_uuid();
BEGIN

-- Update meuwe team display name
UPDATE profiles SET display_name = 'meuwe team' WHERE id = team_id;

-- 7. Concierto de Fabiola Socas — Sala Andrómeda
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e7,
  'Concierto de Fabiola Socas',
  'Recital vocal de Fabiola Socas, compositora e investigadora canaria formada en el Conservatorio Superior de Música de Santa Cruz de Tenerife. Su repertorio abarca composición canaria tradicional, jazz, boleros y baladas. La Sala Andrómeda es un espacio subterráneo único situado en la isla central del Lago Martiánez, con capacidad para eventos íntimos de música en directo.',
  28.4168, -16.5458,
  'Sala Andrómeda, Complejo Costa Martiánez, Av. de Cristóbal Colón',
  'music',
  '2026-05-29 19:30:00+00',
  '2026-05-29 21:30:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e7, 'music'), (e7, 'culture');

-- 8. Presentación del libro «Sans frontières» — Biblioteca Tomás de Iriarte
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e8,
  'Presentación: «Sans frontières» de D. Casidy',
  'Presentación literaria del libro «Sans frontières (Sin fronteras)» del autor D. Casidy en la biblioteca pública municipal del Puerto de la Cruz. Un evento cultural abierto al público que combina literatura y tertulia en un espacio patrimonial del casco histórico de la ciudad. Entrada libre.',
  28.4160, -16.5520,
  'Biblioteca Pública Municipal Tomás de Iriarte, C/ Puerto Viejo 11',
  'culture',
  '2026-05-29 17:00:00+00',
  '2026-05-29 18:30:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e8, 'culture'), (e8, 'art');

-- 10. Actuación Folclórica Mayo Canario — Plaza del Charco (tarde)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e10,
  'Actuación Folclórica Mayo Canario — Plaza del Charco',
  'Sesión vespertina de música y folklore canario en la plaza central de Puerto de la Cruz con los grupos Echeyde Valle Verde, Los Dóniz, Tarajaste y Abruncos. El espacio se llena de trajes típicos, timples y música de raíz canaria. Espacios fotográficos habilitados en la Plaza del Charco y en la Plaza de la Iglesia. Entrada libre.',
  28.4148, -16.5496,
  'Plaza del Charco, Puerto de la Cruz',
  'music',
  '2026-05-30 16:00:00+00',
  '2026-05-30 22:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e10, 'music'), (e10, 'culture'), (e10, 'dance');

-- 11. Mercado de Artesanía Dominical — Mercado Municipal
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e11,
  'Mercado de Artesanía Dominical',
  'Mercado de artesanía que se celebra cada domingo en el Mercado Municipal del Puerto de la Cruz. Artesanos locales y de la isla exponen y venden cerámica, joyería, macramé, bordados, encaje, artículos de cuero, puros artesanales y otras creaciones en 17 modalidades artesanales distintas. Ideal para llevarse un recuerdo auténtico canario.',
  28.4153, -16.5488,
  'Mercado Municipal, Avda. Blas Pérez González 4',
  'culture',
  '2026-05-31 08:00:00+00',
  '2026-05-31 13:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e11, 'culture'), (e11, 'art'), (e11, 'outdoor');

-- 12. Paseo Romero Marinero de Puerto de la Cruz
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e12,
  'Paseo Romero Marinero de Puerto de la Cruz',
  '12 carretas decoradas tiradas por yuntas de bueyes parten desde el CC Martiánez y recorren el casco histórico hasta el muelle pesquero, acompañadas de 13 parrandas folclóricas que ofrecen vino y productos gastronómicos típicos. Los asistentes acuden vestidos con trajes canarios. Tras la llegada al muelle, verbena con DJ hasta la medianoche. Uno de los actos más esperados del Mayo Canario.',
  28.4168, -16.5458,
  'Salida: CC Martiánez → Muelle Pesquero, Puerto de la Cruz',
  'culture',
  '2026-06-01 15:00:00+00',
  '2026-06-01 23:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e12, 'culture'), (e12, 'dance'), (e12, 'outdoor');

-- 13. Baile Final del Mayo Canario — Plaza Concejil
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e13,
  'Baile Final del Mayo Canario — Plaza Concejil',
  'Verbena de clausura del Mayo Canario 2026 en la Plaza Concejil. Tras el Paseo Romero Marinero, la fiesta continúa con baile popular y música en directo en la plaza. Evento gratuito y familiar que cierra las celebraciones del Día de Canarias con una gran fiesta de participación ciudadana.',
  28.4141, -16.5490,
  'Plaza Concejil, Puerto de la Cruz',
  'party',
  '2026-06-01 19:00:00+00',
  '2026-06-01 23:59:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e13, 'party'), (e13, 'dance'), (e13, 'music');

-- 14. Feria de Artesanía — Calle Mequinez
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e14,
  'Feria de Artesanía Mayo Canario — Calle Mequinez',
  'Feria artesanal organizada por el Ayuntamiento como parte del Mayo Canario, con 18 puestos de artesanos canarios a lo largo de la Calle Mequinez. Exposición y venta de cerámica, joyería artesana, bordados, macramé, y productos típicos de las islas. Pone en valor el patrimonio artesanal del Archipiélago durante las fiestas del Día de Canarias.',
  28.4143, -16.5505,
  'Calle Mequinez, Puerto de la Cruz',
  'art',
  '2026-05-30 10:00:00+00',
  '2026-05-30 19:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e14, 'art'), (e14, 'culture'), (e14, 'outdoor');

-- 15. Ruta de la Croqueta — Mayo Canario 2026
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e15,
  'Ruta de la Croqueta — Mayo Canario 2026',
  'Recorrido gastronómico por los bares y restaurantes del casco histórico donde cada establecimiento ofrece una tapa de croqueta propia acompañada de bebida por no más de 3,50 €. Entre los participantes: Compostelana, Club Café, El Rincón de Diego, Cervecería HC Maga, Baraka Café & Grill y Donde Maca Gourmets. Al finalizar el concurso se otorgan premios a las mejores croquetas votadas por el público.',
  28.4145, -16.5496,
  'Casco histórico, Puerto de la Cruz (varios bares)',
  'food',
  '2026-05-30 12:00:00+00',
  '2026-05-30 23:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e15, 'food'), (e15, 'culture'), (e15, 'outdoor');

-- 16. Trail La Guancha 2026
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e16,
  'Trail La Guancha 2026 — K6 / K12 / K21',
  'Carrera de trail running por los paisajes volcánicos y forestales del norte de Tenerife, con tres distancias: 6 km, 12 km y 21 km. Incluye categoría de Diversidad Funcional. Organizada por el Ayuntamiento de La Guancha con cronometraje profesional a través de Ascenso Timing. A tan solo 12 km de Puerto de la Cruz.',
  28.3551, -16.6441,
  'La Guancha, Tenerife Norte',
  'sport',
  '2026-05-30 08:00:00+00',
  '2026-05-30 14:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e16, 'sport'), (e16, 'outdoor'), (e16, 'nature');

-- 18. Tour Astronómico al Teide
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e18,
  'Tour Astronómico al Teide desde Puerto de la Cruz',
  'Excursión nocturna guiada al Parque Nacional del Teide con visita al Observatorio Astronómico. Incluye uso de telescopios de largo alcance para observar constelaciones, explicaciones de mitología griega vinculada a los astros, y observación de la Vía Láctea sobre el volcán más alto de España. Duración aproximada: 8 horas. Operadores: Civitatis, Volcano Teide, Atlántico Excursiones.',
  28.4145, -16.5496,
  'Salida desde Puerto de la Cruz → Observatorio del Teide',
  'nature',
  '2026-05-30 15:00:00+00',
  '2026-05-30 23:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e18, 'nature'), (e18, 'travel'), (e18, 'outdoor');

-- 19. Excursión de Snorkel — Martianez Adventures
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e19,
  'Excursión de Snorkel en Lancha Rápida',
  'Excursión en lancha rápida para hacer snorkel en bahías protegidas del norte de Tenerife, con posibilidad de avistamiento de tortugas marinas, rayas y peces de colores. Equipo de snorkel incluido. Adecuado para familias y niños a partir de 8 años. Operador: Martianez Adventures, salida desde el muelle de Puerto de la Cruz.',
  28.4125, -16.5467,
  'Muelle de Puerto de la Cruz',
  'outdoor',
  '2026-05-31 09:00:00+00',
  '2026-05-31 12:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e19, 'outdoor'), (e19, 'nature'), (e19, 'family');

END $$;
