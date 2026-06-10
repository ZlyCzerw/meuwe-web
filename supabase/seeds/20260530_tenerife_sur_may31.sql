-- Events in southern Tenerife — Saturday May 31, 2026
-- Area: Adeje, Costa Adeje, Playa de las Américas, Los Cristianos, El Médano, Granadilla, Los Abrigos
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  t01 uuid := gen_random_uuid();
  t02 uuid := gen_random_uuid();
  t03 uuid := gen_random_uuid();
  t04 uuid := gen_random_uuid();
  t05 uuid := gen_random_uuid();
  t06 uuid := gen_random_uuid();
  t07 uuid := gen_random_uuid();
  t08 uuid := gen_random_uuid();
  t09 uuid := gen_random_uuid();
  t10 uuid := gen_random_uuid();
  t11 uuid := gen_random_uuid();
  t12 uuid := gen_random_uuid();
  t13 uuid := gen_random_uuid();
  t14 uuid := gen_random_uuid();
  t15 uuid := gen_random_uuid();
BEGIN

-- 31. Adeje Agro-Market — Sunday
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t01,
  'Adeje Agro-Market — Sunday',
  'Sunday edition of the popular Adeje farmers'' market with tropical fruit, seasonal vegetables, artisan goat''s cheese, honey, mojo sauces and other products sold directly by local producers. Café on site. An essential stop for bringing the best of Tenerife home.',
  28.1218, -16.7188,
  'Agromercado de Adeje, C/ Archajara s/n, Polígono Las Torres, Adeje',
  'food',
  '2026-05-31 07:00:00+00',
  '2026-05-31 12:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t01, 'food'), (t01, 'culture'), (t01, 'family');

-- 32. Los Cristianos Sunday Street Market
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t02,
  'Los Cristianos Sunday Street Market',
  'The largest Sunday market in southern Tenerife, situated on the seafront Avenida Marítima near the Arona Gran Hotel. Hundreds of stalls with clothing, leather goods, jewellery, souvenirs, vinyl records, books and handmade crafts. Lively atmosphere on the Los Cristianos seafront promenade every Sunday.',
  28.0532, -16.7150,
  'Av. Marítima, Los Cristianos (near Arona Gran Hotel), Arona',
  'culture',
  '2026-05-31 08:00:00+00',
  '2026-05-31 13:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t02, 'culture'), (t02, 'outdoor'), (t02, 'family');

-- 33. Rastro de Guaza — Sunday
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t03,
  'Rastro de Guaza — Sunday Second-Hand Market',
  'Sunday edition of the largest second-hand market in Tenerife in Guaza (Arona), with over 140 stalls on two floors selling new and used items, antiques, clothing and collectables. Free entry; cash recommended.',
  28.0630, -16.6732,
  'C/ Josefina Reveron, Guaza, Arona',
  'culture',
  '2026-05-31 07:30:00+00',
  '2026-05-31 13:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t03, 'culture'), (t03, 'outdoor'), (t03, 'family');

-- 34. Tenerife HOLI Festival — Costa Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t04,
  'Tenerife HOLI Festival — Costa Adeje',
  'Holi colour festival organised by the Asociación Hindú Tenerife Sur (AHTS) in collaboration with Adeje Town Hall. Eight hours of Bollywood, reggaeton and house music, colour powder throws, water activities, live performances, food tastings and children''s area. White clothing recommended. Free entry.',
  28.0870, -16.7324,
  'Av. Jardines del Duque 25, Costa Adeje',
  'culture',
  '2026-05-31 10:00:00+00',
  '2026-05-31 18:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t04, 'culture'), (t04, 'music'), (t04, 'family');

-- 35. Paso Doble Concert — Adeje Municipal Band
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t05,
  'Paso Doble Concert — Adeje Municipal Band',
  'Free open-air concert by the Patronato Musical de la Histórica Villa de Adeje performing classic Spanish paso dobles in the main street of the historic old town. A Sunday morning of traditional music for the whole family.',
  28.1230, -16.7265,
  'Calle Grande, Adeje Casco Histórico',
  'music',
  '2026-05-31 11:00:00+00',
  '2026-05-31 12:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t05, 'music'), (t05, 'culture'), (t05, 'family');

-- 36. XXXVI Canarian Craft & Gastronomy Fair — Granadilla de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t06,
  'XXXVI Canarian Craft & Gastronomy Fair — Granadilla',
  'Regional craft and gastronomy fair as part of the 2026 Fiestas Mayores de Granadilla de Abona, expanded to include artisans from all seven Canary Islands. Local food products, traditional crafts, workshops and tastings of the best of the archipelago.',
  28.1219, -16.5798,
  'Granadilla de Abona Casco Histórico',
  'food',
  '2026-05-31 09:00:00+00',
  '2026-05-31 19:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t06, 'food'), (t06, 'culture'), (t06, 'art');

-- 37. Queen of the Festivals Gala 2026 — Granadilla de Abona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t07,
  'Queen of the Festivals Gala 2026 — Granadilla de Abona',
  'Gala crowning the Queen of the 2026 Fiestas Mayores de Granadilla de Abona, with live performances by David Baute and Besay Pérez. A spectacular event that officially opens the municipality''s most important celebrations. Tickets available locally.',
  28.1219, -16.5798,
  'Recinto Ferial, Granadilla de Abona',
  'culture',
  '2026-05-31 20:00:00+00',
  '2026-06-01 00:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t07, 'culture'), (t07, 'music'), (t07, 'art');

-- 38. Fiestas de Las Nieves — Mass & Procession (Adeje)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t08,
  'Fiestas de Las Nieves — Mass & Candlelit Procession, Adeje',
  'Solemn mass followed by a candlelit procession in honour of the Virgen de las Nieves through the streets of the neighbourhood, accompanied by the municipal band, candle bearers and a fireworks display at the end of the route. One of the most emotional moments of Adeje''s local festivities.',
  28.1222, -16.7270,
  'Iglesia del barrio Las Nieves, Adeje',
  'culture',
  '2026-05-31 19:00:00+00',
  '2026-05-31 21:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t08, 'culture'), (t08, 'family'), (t08, 'outdoor');

-- 39. Fiestas de Las Nieves — Grand Open-Air Dance (Adeje)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t09,
  'Fiestas de Las Nieves — Grand Open-Air Dance, Adeje',
  'Evening open-air dance party as part of the Fiestas de Las Nieves in Adeje, with live orchestras and bands performing popular and Canarian music. Thousands of people enjoy this free celebration in the Las Nieves neighbourhood of Adeje.',
  28.1222, -16.7270,
  'Plaza del Barrio Las Nieves, Adeje',
  'music',
  '2026-05-31 21:00:00+00',
  '2026-06-01 01:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t09, 'music'), (t09, 'dance'), (t09, 'outdoor');

-- 40. Estrella Marina — Live at Hard Rock Cafe (Sunday)
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t10,
  'Estrella Marina — Live at Hard Rock Cafe',
  'Live performance by Estrella Marina on the upper terrace of Hard Rock Cafe Tenerife in Playa de las Américas. Free event for all ages, no ticket required. Live music with the Las Américas seafront as a backdrop.',
  28.0530, -16.7273,
  'Hard Rock Cafe Tenerife, Playa de las Américas',
  'music',
  '2026-05-31 20:30:00+00',
  '2026-05-31 21:45:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t10, 'music'), (t10, 'outdoor');

-- 41. Windsurf & Kitesurf High Season — El Médano
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t11,
  'Windsurf & Kitesurf High Season — El Médano',
  'June marks the start of the windsurf and kitesurf high season in El Médano. Constant trade winds make this one of Europe''s best spots. Several certified schools offer beginner courses, advanced clinics and equipment hire every day. Professional and international riders freestyle in full view of the public from the promenade.',
  28.0454, -16.5341,
  'Playa Leocadio Machado, El Médano (Granadilla de Abona)',
  'sport',
  '2026-05-31 08:00:00+00',
  '2026-05-31 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t11, 'sport'), (t11, 'outdoor'), (t11, 'nature');

-- 42. Stand-Up Paddle & Beach Yoga — Los Cristianos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t12,
  'Stand-Up Paddle & Beach Yoga — Los Cristianos',
  'Morning SUP and beach yoga sessions in Los Cristianos. The sheltered bay is perfect for all skill levels. Various operators offer sunrise yoga on the sand and guided SUP tours along the southern coast of Tenerife. The ideal way to disconnect with the sea and Mount Teide as your backdrop.',
  28.0532, -16.7150,
  'Playa de Los Cristianos, Los Cristianos, Arona',
  'sport',
  '2026-05-31 07:00:00+00',
  '2026-05-31 09:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t12, 'sport'), (t12, 'outdoor'), (t12, 'nature');

-- 43. Whale & Dolphin Watching Catamaran — Los Cristianos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t13,
  'Whale & Dolphin Watching Catamaran — Los Cristianos',
  'Shared catamaran trips of 2 to 3 hours from Los Cristianos harbour to spot dolphins and whales. The strait between Tenerife and La Gomera is home to permanent populations of pilot whales and bottlenose dolphins. Multiple daily departures with different operators.',
  28.0520, -16.7170,
  'Puerto de Los Cristianos, Los Cristianos, Arona',
  'nature',
  '2026-05-31 09:00:00+00',
  '2026-05-31 11:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t13, 'nature'), (t13, 'outdoor'), (t13, 'family');

-- 44. Fresh Fish Tapas Night — Los Abrigos
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t14,
  'Fresh Fish Tapas Night — Los Abrigos Harbour',
  'The fishing harbour of Los Abrigos transforms every weekend evening into an open-air tapas experience. Its famous fresh fish restaurants open onto the seafront. House specialities are vieja, cherne and freshly caught seafood. The most authentic gastronomic corner on the southern coast of Tenerife.',
  28.0112, -16.5604,
  'Puerto de Los Abrigos, Los Abrigos (Granadilla de Abona)',
  'food',
  '2026-05-31 18:00:00+00',
  '2026-05-31 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t14, 'food'), (t14, 'outdoor'), (t14, 'culture');

-- 45. Piknik feat. Stacey Pullen — Papagayo Tenerife
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  t15,
  'Piknik feat. Stacey Pullen — Papagayo Tenerife',
  'Headline Piknik series event with Detroit techno legend Stacey Pullen, joined by Beto Uña and Claudia Rutten. Intense, elegant and emotionally charged sets at the iconic seafront venue in Playa de las Américas. A world-class techno night in Tenerife.',
  28.0534, -16.7289,
  'Papagayo Tenerife, Av. Rafael Puig Lluvina 2, Playa de las Américas',
  'party',
  '2026-05-31 21:00:00+00',
  '2026-06-01 05:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (t15, 'party'), (t15, 'music');

END $$;
