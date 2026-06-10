-- Events in southern Tenerife — Friday May 30, 2026 (Canary Islands Day)
-- Area: El Médano, Granadilla de Abona, San Miguel, Arona, Los Abrigos, Las Galletas
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  s01 uuid := gen_random_uuid();
  s02 uuid := gen_random_uuid();
  s03 uuid := gen_random_uuid();
  s04 uuid := gen_random_uuid();
  s05 uuid := gen_random_uuid();
  s06 uuid := gen_random_uuid();
  s07 uuid := gen_random_uuid();
  s08 uuid := gen_random_uuid();
  s09 uuid := gen_random_uuid();
  s10 uuid := gen_random_uuid();
  s11 uuid := gen_random_uuid();
  s12 uuid := gen_random_uuid();
  s13 uuid := gen_random_uuid();
  s14 uuid := gen_random_uuid();
  s15 uuid := gen_random_uuid();
BEGIN

UPDATE profiles SET display_name = 'meuwe team' WHERE id = team_id;

-- 1. XXI Baile de Taifas — Granadilla de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s01,
  'XXI Baile de Taifas — Granadilla de Abona',
  'The 21st edition of this iconic Canarian folk music gathering, held around 110 communal tables in the historic square. Six parranda groups and folklore ensembles perform live: Aires de Abona, Viñático, Alisios del Sur, Guaydil del Sur, Sentir Sureño and La Parranda. Traditional Canarian dress is recommended. Free entry.',
  28.1219, -16.5798,
  'Plaza de San Antonio de Padua, Granadilla de Abona',
  'culture',
  '2026-05-30 19:00:00+00',
  '2026-05-31 00:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s01, 'music'), (s01, 'culture'), (s01, 'dance');

-- 2. Canary Islands Day Concert — San Miguel de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s02,
  'Canary Islands Day Concert — San Miguel de Abona',
  'Free open-air concert celebrating Canary Islands Day with the San Miguel de Abona Municipal Band and the Parranda Chasnera de la Comarca de Abona. A unique evening of Canarian music and rhythm for the whole family.',
  28.0335, -16.6315,
  'Plaza de la Parroquia de San Miguel de Abona',
  'music',
  '2026-05-30 19:30:00+00',
  '2026-05-30 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s02, 'music'), (s02, 'culture'), (s02, 'family');

-- 3. Canary Islands Day Activities — San Miguel de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s03,
  'Canary Islands Day — Activities in San Miguel de Abona',
  'A full day of Canary Islands Day celebrations in the village centre. Traditional craft fair, Canarian games (calabazo, bola canaria), exhibitions, Canarian wrestling demonstration by Club Chimbesque, street theatre and gofio with local wine tasting. Free entry.',
  28.0335, -16.6315,
  'Plaza de la Iglesia, San Miguel de Abona',
  'culture',
  '2026-05-30 09:00:00+00',
  '2026-05-30 18:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s03, 'culture'), (s03, 'family'), (s03, 'outdoor');

-- 4. Canary Islands Day — Vilaflor de Chasna
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s04,
  'Canary Islands Day in Vilaflor de Chasna',
  'Canary Islands Day celebrations in the highest village in the Canary Islands. Traditional music, folk costumes and popular customs take centre stage in this picturesque mountain village at 1,400 m altitude, with views of Mount Teide.',
  28.1567, -16.6367,
  'Vilaflor de Chasna, Arona',
  'culture',
  '2026-05-30 10:00:00+00',
  '2026-05-30 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s04, 'culture'), (s04, 'family'), (s04, 'outdoor');

-- 5. El Médano Olympic Triathlon 2026
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s05,
  'El Médano Olympic Triathlon 2026',
  'Olympic distance triathlon at El Médano beach: 1,500 m open-water swim, 40 km cycle and 10 km run. Organised by Tejito Eventos with support from Fecantri and Granadilla de Abona Town Hall. Separate starts for men and women from 08:30. Spectators can watch the race from the beach for free.',
  28.0454, -16.5341,
  'Playa Leocadio Machado, El Médano',
  'sport',
  '2026-05-30 07:30:00+00',
  '2026-05-30 13:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s05, 'sport'), (s05, 'outdoor'), (s05, 'nature');

-- 6. King/Queen of El Médano — Kite Big Air Contest 2026
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s06,
  'King/Queen of El Médano — Kite Big Air Contest',
  'Open kitesurf Big Air competition for amateurs, women and juniors, held during the best wind window (April–June). Competitors are scored on maximum jump height recorded by the Surfr app. Spectators can watch the aerial show for free from the beach. El Médano is one of the best kitesurf destinations in Europe.',
  28.0454, -16.5341,
  'Playa de El Médano / Paseo Ntra. Sra. Mercedes de Roja',
  'sport',
  '2026-05-30 09:00:00+00',
  '2026-05-31 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s06, 'sport'), (s06, 'outdoor'), (s06, 'nature');

-- 7. Kitesurf & Windsurf Spectacle — El Médano
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s07,
  'Kitesurf & Windsurf Spectacle — El Médano (Free)',
  'June marks the start of the high season for kitesurfing and windsurfing in El Médano, one of Europe''s most famous destinations with over 300 days of wind per year. Professional and international riders practise in front of the beach; spectators can enjoy the aerial and water show completely free from the seafront promenade.',
  28.0454, -16.5341,
  'Playa El Cabezo & Playa de El Médano',
  'sport',
  '2026-05-30 09:00:00+00',
  '2026-05-30 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s07, 'sport'), (s07, 'outdoor'), (s07, 'nature');

-- 8. El Médano Saturday Craft Market
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s08,
  'El Médano Craft Market — Saturday',
  'Weekly Saturday craft market on the main square of El Médano with handmade jewellery, fashion, natural cosmetics, clothing and unique artisan items from local creators. The festive atmosphere of this coastal village, with views of the ocean and Montaña Roja, provides the perfect backdrop.',
  28.0454, -16.5341,
  'Plaza de El Médano, El Médano (Granadilla de Abona)',
  'culture',
  '2026-05-30 08:00:00+00',
  '2026-05-30 13:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s08, 'culture'), (s08, 'art'), (s08, 'outdoor');

-- 9. Canary Islands Day — El Médano Farmers' Market Activities
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s09,
  'Canary Islands Day — Activities at El Médano Market',
  'Special Canary Islands Day edition of the El Médano farmers'' market (Granadilla de Abona Town Hall ''Vive tu mercado'' 2026 programme). Children''s workshops, local produce tastings, live music and demonstrations of traditional Canarian crafts alongside the regular market.',
  28.0454, -16.5341,
  'Mercado del Agricultor El Médano, Plaza de El Médano',
  'family',
  '2026-05-30 09:00:00+00',
  '2026-05-30 12:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s09, 'family'), (s09, 'culture'), (s09, 'food');

-- 10. Canary Islands Day Celebration — Los Abrigos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s10,
  'Canary Islands Day — Celebration in Los Abrigos',
  'Canary Islands Day celebrations in the fishing village of Los Abrigos (municipality of Granadilla de Abona). Local folk music, traditional food stalls with fresh fish and a festive atmosphere in the village square beside the sea. One of the most authentic spots on the southern coast.',
  28.0112, -16.5604,
  'Plaza de Los Abrigos, Los Abrigos (Granadilla de Abona)',
  'culture',
  '2026-05-30 11:00:00+00',
  '2026-05-30 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s10, 'culture'), (s10, 'family'), (s10, 'outdoor');

-- 11. Canarian Gastronomy Tasting — Los Abrigos Harbour
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s11,
  'Canarian Gastronomy Tasting — Los Abrigos Harbour',
  'Canarian gastronomy tasting event at the fishing harbour of Los Abrigos, famous for having the best fresh fish restaurants in southern Tenerife. Local chefs demonstrate how to prepare grilled fish, papas arrugadas with red and green mojo sauce, and artisan fish broth.',
  28.0112, -16.5604,
  'Puerto de Los Abrigos, Los Abrigos (Granadilla de Abona)',
  'food',
  '2026-05-30 12:00:00+00',
  '2026-05-30 16:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s11, 'food'), (s11, 'culture'), (s11, 'outdoor');

-- 12. Canary Islands Day — Las Galletas
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s12,
  'Canary Islands Day — Celebration in Las Galletas',
  'Open-air Canary Islands Day celebrations in Las Galletas (municipality of Arona). Community activities with traditional Canarian games, folk music and local produce stalls in the village square on the southern coast.',
  28.0089, -16.6489,
  'Plaza de Las Galletas, Las Galletas, Arona',
  'culture',
  '2026-05-30 10:00:00+00',
  '2026-05-30 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s12, 'culture'), (s12, 'family'), (s12, 'outdoor');

-- 13. Canary Islands Day — Valle San Lorenzo
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s13,
  'Canary Islands Day — Valle San Lorenzo, Arona',
  'Special Canary Islands Day celebrations in Valle San Lorenzo (Arona), combining traditional folklore, live music, gastronomy and community activities in the village centre. Arona Town Hall organises an extensive programme of cultural activities for all ages.',
  28.0743, -16.6372,
  'Plaza San Lorenzo, Valle San Lorenzo, Arona',
  'culture',
  '2026-05-30 10:00:00+00',
  '2026-05-30 19:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s13, 'culture'), (s13, 'family'), (s13, 'outdoor');

-- 14. Canary Islands Day Special — Arona Farmers' Market
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s14,
  'Canary Islands Day Special — Arona Farmers'' Market',
  'Special edition of the Arona farmers'' market for Canary Islands Day, with additional cultural activities, Canarian crafts and seasonal produce tastings from local farmers in the municipality.',
  28.0994, -16.6828,
  'Mercado del Agricultor, Arona Casco',
  'food',
  '2026-05-30 08:00:00+00',
  '2026-05-30 13:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s14, 'food'), (s14, 'culture'), (s14, 'family');

-- 15. Pouring Art Workshop — Canary Islands Day
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s15,
  'Pouring Art Workshop "Paint the Canaries" — Canary Islands Day',
  'Creative acrylic pouring (fluid painting) workshop organised by Arona Town Hall at the Farmers'' Market. Participants create their own canvas paintings inspired by the landscapes and colours of the Canary Islands. Suitable for all ages; materials included.',
  28.0994, -16.6828,
  'Mercado del Agricultor, Arona Casco',
  'art',
  '2026-05-30 10:00:00+00',
  '2026-05-30 12:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s15, 'art'), (s15, 'family'), (s15, 'culture');

END $$;
