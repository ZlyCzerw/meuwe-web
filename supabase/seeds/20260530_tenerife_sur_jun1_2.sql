-- Events in southern Tenerife — Sunday June 1 & Monday June 2, 2026
-- Area: Adeje, Costa Adeje, Los Cristianos, El Médano, Granadilla, Los Abrigos, Los Gigantes
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  u01 uuid := gen_random_uuid();
  u02 uuid := gen_random_uuid();
  u03 uuid := gen_random_uuid();
  u04 uuid := gen_random_uuid();
  u05 uuid := gen_random_uuid();
  u06 uuid := gen_random_uuid();
  u07 uuid := gen_random_uuid();
  u08 uuid := gen_random_uuid();
  u09 uuid := gen_random_uuid();
  u10 uuid := gen_random_uuid();
  u11 uuid := gen_random_uuid();
  u12 uuid := gen_random_uuid();
  u13 uuid := gen_random_uuid();
  u14 uuid := gen_random_uuid();
  u15 uuid := gen_random_uuid();
  u16 uuid := gen_random_uuid();
BEGIN

-- 46. Siam Park — Sunday
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u01,
  'Siam Park — Water Park (Sunday)',
  'Sunday at the world''s number 1 water park (TripAdvisor, multiple years). In Costa Adeje, 21 attractions open: Tower of Power, wave pool, longest lazy river in Europe, children''s area, bars and restaurants. Enjoy the Canarian sun with Mount Teide as your backdrop.',
  28.0729, -16.7312,
  'Siam Park, Av. Siam, Costa Adeje',
  'family',
  '2026-05-31 09:00:00+00',
  '2026-05-31 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u01, 'family'), (u01, 'outdoor'), (u01, 'sport');

-- 47. Descaro by Los Canarios @ Monkey Beach Club
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u02,
  'Descaro by Los Canarios — Monkey Beach Club',
  'Sunday afternoon party at Monkey Beach Club on Playa de Troya, with Los Canarios as guest DJs alongside residents Alby and Oceannn. Sunset sessions with spectacular ocean views and a vibrant atmosphere. One of the best sundown parties in southern Tenerife.',
  28.0545, -16.7298,
  'Monkey Beach Club, Av. Rafael Puig Lluvina 3, Playa de Troya, Costa Adeje',
  'party',
  '2026-05-31 17:00:00+00',
  '2026-06-01 00:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u02, 'party'), (u02, 'music'), (u02, 'outdoor');

-- 48. Sunset Sailing Cruise — Puerto Colón
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u03,
  'Sunset Sailing Cruise — Puerto Colón, Costa Adeje',
  'Two-hour sunset sailing cruise from Puerto Colón in Costa Adeje along the southwestern coast of Tenerife, often with dolphin sightings. Drinks on board included. The combination of the setting sun with the silhouette of Mount Teide makes this one of the most photogenic cruises in the Canary Islands.',
  28.0720, -16.7390,
  'Puerto Colón Marina, Costa Adeje',
  'outdoor',
  '2026-05-31 17:30:00+00',
  '2026-05-31 19:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u03, 'outdoor'), (u03, 'nature'), (u03, 'family');

-- 49. Live Music on the Terraces — Costa Adeje Promenade
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u04,
  'Live Music on the Terraces — Costa Adeje Promenade',
  'Various bars and restaurants along the Costa Adeje seafront promenade offer live music every weekend evening: Latin pop, acoustic, jazz and flamenco. Musicians perform regularly on terraces from sundown along the full length of the promenade throughout the summer season.',
  28.0870, -16.7324,
  'Av. Rafael Puig Lluvina & Paseo Costa Adeje',
  'music',
  '2026-05-31 19:00:00+00',
  '2026-05-31 22:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u04, 'music'), (u04, 'outdoor'), (u04, 'culture');

-- 50. Procession of Our Lady of the Rosary — Granadilla de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u05,
  'Procession of Our Lady of the Rosary — Granadilla de Abona',
  'Solemn religious procession in honour of Nuestra Señora del Rosario through the streets of the Granadilla de Abona historic quarter, as part of the 2026 Fiestas Mayores. Accompanied by the municipal band, candle bearers and traditional dress. A moment of devotion and folklore in the heart of the historic village.',
  28.1219, -16.5798,
  'Iglesia de Santa Ana, Granadilla de Abona Casco Histórico',
  'culture',
  '2026-06-01 18:30:00+00',
  '2026-06-01 20:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u05, 'culture'), (u05, 'family'), (u05, 'outdoor');

-- 51. Tales & Poetry Evening — Franciscan Convent, Granadilla
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u06,
  'Tales & Poetry Evening — Franciscan Convent, Granadilla',
  'An intimate evening of literature and poetry in the unique setting of the historic Convento Franciscano San Luis Obispo de Granadilla de Abona, as part of the 2026 Fiestas Mayores cultural programme. A special gathering for lovers of words and history in an unrepeatable heritage space. Free entry.',
  28.1219, -16.5798,
  'Convento Franciscano San Luis Obispo, Granadilla de Abona',
  'art',
  '2026-06-01 18:00:00+00',
  '2026-06-01 20:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u06, 'art'), (u06, 'culture');

-- 52. Beach Games & Sport Day — Los Cristianos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u07,
  'Beach Games & Sport Day — Los Cristianos',
  'The wide, sheltered beach of Los Cristianos is the perfect setting for a day of sport and family leisure every Sunday: beach volleyball, beach paddle, football on the sand and water activities. The seafront promenade is a meeting point for locals and visitors every weekend.',
  28.0532, -16.7150,
  'Playa de Los Cristianos, Los Cristianos, Arona',
  'family',
  '2026-06-01 09:00:00+00',
  '2026-06-01 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u07, 'family'), (u07, 'sport'), (u07, 'outdoor');

-- 53. Las Américas Promenade — Street Artists & Live Music
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u08,
  'Las Américas Promenade — Street Artists & Live Music',
  'The 4 km seafront promenade connecting Playa de las Américas with Los Cristianos fills every Sunday afternoon with street performers, musicians, painters and market stalls. A free experience beside the ocean with southern Tenerife''s summer atmosphere at its peak.',
  28.0534, -16.7289,
  'Paseo Marítimo, Playa de las Américas – Los Cristianos',
  'outdoor',
  '2026-06-01 16:00:00+00',
  '2026-06-01 21:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u08, 'outdoor'), (u08, 'music'), (u08, 'art');

-- 54. Hiking Montaña Roja — El Médano
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u09,
  'Hiking Montaña Roja — El Médano',
  'Self-guided hike to the iconic red volcanic cone of Montaña Roja, a protected natural reserve next to El Médano beach. The 171 m summit offers spectacular panoramic views of the southern coast, Mount Teide and the island of La Gomera. Well-marked trail suitable for families with children.',
  28.0326, -16.5279,
  'Montaña Roja, El Médano (Granadilla de Abona)',
  'nature',
  '2026-06-01 07:00:00+00',
  '2026-06-01 11:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u09, 'nature'), (u09, 'outdoor'), (u09, 'family');

-- 55. Kitesurf & Windsurf Spectacle — El Médano (Sunday/Monday)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u10,
  'Kitesurf & Windsurf Spectacle — El Médano (Free)',
  'El Médano in high season is a permanent world-class kitesurf and windsurf spectacle. Each windy June day, dozens of riders from around the world practise off the long dark-sand beach and at El Cabezo. Spectators can enjoy the aerial show entirely free from the promenade or the beach.',
  28.0454, -16.5341,
  'Playa de El Médano & Playa El Cabezo, El Médano',
  'sport',
  '2026-06-01 09:00:00+00',
  '2026-06-01 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u10, 'sport'), (u10, 'outdoor'), (u10, 'nature');

-- 56. Day Trip to La Gomera — Ferry from Los Cristianos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u11,
  'Day Trip to La Gomera — Ferry from Los Cristianos',
  'Daily fast ferry services and full-day guided excursions from Los Cristianos harbour to La Gomera (35-minute crossing). The perfect destination to explore the Garajonay rainforest (UNESCO World Heritage Site) and the Valle Gran Rey. A breathtaking island escape just a few kilometres away.',
  28.0520, -16.7170,
  'Puerto de Los Cristianos, Los Cristianos, Arona',
  'outdoor',
  '2026-06-01 07:30:00+00',
  '2026-06-01 19:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u11, 'outdoor'), (u11, 'nature'), (u11, 'family');

-- 57. Scuba Diving & Snorkelling — Los Abrigos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u12,
  'Scuba Diving & Snorkelling — Los Abrigos',
  'Daily guided scuba and snorkel dives from Los Abrigos harbour, exploring volcanic rock formations, sea turtles, angelfish and colourful reef fish off southern Tenerife. Suitable for all levels: PADI courses, discovery dives and dives for certified divers.',
  28.0112, -16.5604,
  'Puerto de Los Abrigos, Los Abrigos (Granadilla de Abona)',
  'sport',
  '2026-06-01 08:00:00+00',
  '2026-06-01 12:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u12, 'sport'), (u12, 'outdoor'), (u12, 'nature');

-- 58. Amateur Padel Tournament — Costa Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u13,
  'Amateur Padel Tournament — Costa Adeje',
  'Open-air amateur padel tournament at one of the south''s padel clubs, with a doubles draw for all levels. Padel is the fastest-growing sport in the Canary Islands, and weekend tournaments at clubs in Adeje and Arona are a regular fixture.',
  28.0870, -16.7300,
  'Club de Pádel / Complejo Deportivo, Costa Adeje',
  'sport',
  '2026-05-31 08:00:00+00',
  '2026-05-31 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u13, 'sport'), (u13, 'outdoor');

-- 59. DNS Academy — End-of-Year Show 2025/2026 (Monday)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u14,
  'DNS Academy — End-of-Year Show 2025/2026',
  'Grand end-of-year gala by DNS Academy at the Auditorio Infanta Leonor in Los Cristianos, organised by Arona Municipal Culture Patronage. Dance and performing arts students showcase a full year of work in a professional-level show. Free entry (collect invitation from the Cultural Centre).',
  28.0523, -16.7126,
  'Auditorio Infanta Leonor, Los Cristianos, Arona',
  'culture',
  '2026-06-02 18:00:00+00',
  '2026-06-02 20:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u14, 'culture'), (u14, 'art'), (u14, 'dance');

-- 60. Snorkel Speedboat Trip — Los Cristianos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u15,
  'Snorkel Speedboat Trip — Los Cristianos',
  'Speedboat excursion for snorkelling in sheltered bays along the southwestern coast of Tenerife, with the chance to spot sea turtles, rays and colourful fish. Snorkel equipment included. Suitable for families and children aged 8 and over. Departures from Los Cristianos harbour with various local operators.',
  28.0520, -16.7170,
  'Puerto de Los Cristianos, Los Cristianos, Arona',
  'outdoor',
  '2026-06-01 09:00:00+00',
  '2026-06-01 12:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u15, 'outdoor'), (u15, 'nature'), (u15, 'family');

-- 61. Night Astronomy Tour to Teide — Departure from the South
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  u16,
  'Night Astronomy Tour to Teide — from the South',
  'Guided night excursion to Teide National Park with a visit to the Astronomical Observatory. Long-range telescopes for observing constellations, Greek mythology stories linked to the stars, and views of the Milky Way above Spain''s highest volcano (3,718 m). Duration approx. 8 hours. Departures from various pick-up points in southern Tenerife.',
  28.2723, -16.6397,
  'Teide National Park / Observatorio del Teide (departs from the south)',
  'nature',
  '2026-06-01 14:00:00+00',
  '2026-06-01 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (u16, 'nature'), (u16, 'outdoor'), (u16, 'travel');

END $$;
