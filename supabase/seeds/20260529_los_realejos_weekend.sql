-- Weekend events in Los Realejos, Tenerife — May 29–31, 2026
-- Los Realejos is ~5 km from Puerto de la Cruz
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  e20 uuid := gen_random_uuid();
  e21 uuid := gen_random_uuid();
  e22 uuid := gen_random_uuid();
BEGIN

-- 20. XVIII Festival Solidario "Risas y Parrandas"
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e20,
  'Festival Solidario "Risas y Parrandas"',
  'Festival de música folclórica solidaria organizado por el Grupo El Chirato con la artista invitada Yanely Hernández. Concierto al aire libre que mezcla parranda tradicional canaria con comedia — evento de apertura de las Fiestas de Mayo de Los Realejos. Entrada libre.',
  28.3913, -16.5891,
  'Plaza Viera y Clavijo, Los Realejos',
  'music',
  '2026-05-29 19:30:00+00',
  '2026-05-29 22:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e20, 'music'), (e20, 'culture');

-- 21. LI Festival de las Islas — Los Realejos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e21,
  'LI Festival de las Islas — Los Realejos',
  'La 51ª edición del festival folclórico más antiguo de Canarias reúne grupos de música y danza tradicional de las siete islas, cada una representada con trajes, canciones y bailes propios. El evento concluye con una "isa final" interpretada en conjunto por los solistas de todos los grupos. Evento gratuito al aire libre.',
  28.3913, -16.5891,
  'Plaza Viera y Clavijo, Los Realejos',
  'culture',
  '2026-05-30 20:00:00+00',
  '2026-05-30 23:30:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e21, 'culture'), (e21, 'dance'), (e21, 'music');

-- 22. Romería de San Isidro Labrador — Los Realejos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e22,
  'Romería de San Isidro Labrador — Los Realejos',
  'Una de las romerías más espectaculares de Tenerife, declarada de Interés Turístico Nacional. Carretas tiradas por bueyes, trajes canarios tradicionales y música en directo del grupo Tigaray acompañan la procesión en honor a San Isidro Labrador y Santa María de la Cabeza. A las 18:00 las imágenes regresan a la iglesia, seguidas de una gran fiesta popular con las orquestas Sabrosa, Tropín y Grupo D.',
  28.3906, -16.5877,
  'Parroquia Matriz del Apóstol Santiago, Los Realejos',
  'culture',
  '2026-05-31 11:00:00+00',
  '2026-05-31 23:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e22, 'culture'), (e22, 'dance'), (e22, 'family');

END $$;
