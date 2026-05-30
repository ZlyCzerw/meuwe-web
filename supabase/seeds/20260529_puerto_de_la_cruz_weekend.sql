-- Weekend events in Puerto de la Cruz, Tenerife — May 30–31, 2026
-- Día de Canarias (Canary Islands Day) celebrations and more
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  e3 uuid := gen_random_uuid();
  e4 uuid := gen_random_uuid();
  e5 uuid := gen_random_uuid();
  e6 uuid := gen_random_uuid();
BEGIN

-- Update meuwe team display name
UPDATE profiles SET display_name = 'meuwe team' WHERE id = team_id;

-- 1. Festival Folclórico Mayo Canario — Plaza del Charco
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e1,
  'Festival Folclórico Mayo Canario 2026',
  'Celebración del Día de Canarias en la plaza principal de la ciudad. Tres grupos suben al escenario: Los Doniz con cuerpo de baile, Grupo Bentahod y Grupo Achamán Jóvenes Sabandeños. Tres horas de música y danza tradicional canaria. También hay instalaciones fotográficas en la Plaza del Charco y la Plaza de la Iglesia. Entrada libre.',
  28.4165, -16.5506,
  'Plaza del Charco, Puerto de la Cruz',
  'culture',
  '2026-05-30 18:00:00+00',
  '2026-05-30 21:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e1, 'music'), (e1, 'dance'), (e1, 'culture');

-- 2. Día de Canarias en el Mercado Municipal (40 Aniversario)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e2,
  'Día de Canarias en el Mercado Municipal',
  'El Mercado Municipal de Puerto de la Cruz celebra su 40 aniversario con una tarde de cultura canaria. Exposición de carros de madera y trajes típicos canarios, demostración de lucha canaria por el Club Deportivo Adelfas, y actuaciones de los grupos Acoidan, Los Jóvenes del Norte, Menceyes de Daute y Grupo Swing Latino. Puestos con menús especiales: papas arrugadas, gofio y mojo. Entrada libre.',
  28.4096, -16.5532,
  'Mercado Municipal, Avenida Blas Pérez González 4',
  'culture',
  '2026-05-29 17:00:00+00',
  '2026-05-29 22:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e2, 'culture'), (e2, 'food'), (e2, 'family');

-- 3. Celebración Día de Canarias — Plaza Concejil
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e3,
  'Celebración Día de Canarias — Plaza Concejil',
  'Celebración cívica oficial del Día de Canarias frente a la histórica Casa de los Agustinos. Un punto de encuentro para locales y visitantes en uno de los rincones más bonitos del casco antiguo de Puerto de la Cruz. Celebración del orgullo regional e identidad canaria. Entrada libre.',
  28.4154, -16.5496,
  'Plaza Concejil, Puerto de la Cruz',
  'culture',
  '2026-05-31 11:00:00+00',
  '2026-05-31 14:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e3, 'culture'), (e3, 'family'), (e3, 'outdoor');

-- 4. Regenerar Comiendo — Taller + Cocina + Almuerzo en Comunidad
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e4,
  'Regenerar Comiendo — Taller + Cocina + Almuerzo',
  'Taller de 4 horas organizado por Rizoma Co-Lab y Finca Encuentro — una finca comunitaria en las colinas sobre Puerto de la Cruz. Se debaten sistemas alimentarios y bienestar; se recogen ingredientes de temporada del huerto; se cocina en grupo con recetas Slow Food con productos locales; y se cierra con un almuerzo comunitario compartido. Plazas limitadas. Precio: 40€ por persona, todo incluido.',
  28.3952, -16.5579,
  'Finca Encuentro, Camino Carril 39, Puerto de la Cruz',
  'food',
  '2026-05-30 09:30:00+00',
  '2026-05-30 13:30:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e4, 'food'), (e4, 'workshop'), (e4, 'nature');

-- 5. Partido de Fútbol Juvenil — Día de Canarias
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e5,
  'Fútbol Juvenil: CD Puerto Cruz vs CD Laguna',
  'Partido de fútbol juvenil entre Juvenil Grupo Compostelana CD Puerto Cruz y CD Laguna, celebrado el Día de Canarias. El Estadio El Peñón es el campo histórico del CD Puerto Cruz, recientemente renovado con un nuevo césped natural. Una ocasión deportiva local que se suma a la celebración de la fiesta regional. Entrada libre.',
  28.4157, -16.5569,
  'Estadio Municipal El Peñón, Paseo de Luis Lavaggi 2',
  'sport',
  '2026-05-30 18:30:00+00',
  '2026-05-30 20:30:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e5, 'sport'), (e5, 'outdoor');

-- 6. Lago Martiánez — Complejo de Ocio
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  e6,
  'Lago Martiánez — Día en el Complejo de Ocio',
  'El icónico complejo de ocio frente al mar diseñado por César Manrique: una serie de piscinas de agua salada alimentadas directamente por el Atlántico, rodeadas de jardines tropicales, terrazas, bares y restaurantes. Incluye 4 piscinas para adultos y 3 para niños, terrazas de descanso con hamacas y sombrillas, 7 esculturas de Manrique y múltiples bares y restaurantes. Entrada: 5,50€ adultos / 2,50€ niños menores de 10 años.',
  28.4194, -16.5439,
  'Lago Martiánez, Avenida de Colón, Puerto de la Cruz',
  'outdoor',
  '2026-05-30 09:00:00+00',
  '2026-05-30 19:00:00+00',
  team_id,
  'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (e6, 'outdoor'), (e6, 'nature'), (e6, 'family');

END $$;
