-- Events in southern Tenerife — Friday May 30, 2026 (afternoon/evening)
-- Area: Adeje, Costa Adeje, Playa de las Américas, Los Cristianos, Fañabé
-- Times stored in UTC (Canary Islands = UTC+1 in summer)
-- creator_id points to the "meuwe team" system profile

DO $$
DECLARE
  team_id uuid := 'b864b6bf-4282-4644-ab8f-b17b661b7841';
  s16 uuid := gen_random_uuid();
  s17 uuid := gen_random_uuid();
  s18 uuid := gen_random_uuid();
  s19 uuid := gen_random_uuid();
  s20 uuid := gen_random_uuid();
  s21 uuid := gen_random_uuid();
  s22 uuid := gen_random_uuid();
  s23 uuid := gen_random_uuid();
  s24 uuid := gen_random_uuid();
  s25 uuid := gen_random_uuid();
  s26 uuid := gen_random_uuid();
  s27 uuid := gen_random_uuid();
  s28 uuid := gen_random_uuid();
  s29 uuid := gen_random_uuid();
  s30 uuid := gen_random_uuid();
BEGIN

-- 16. Adeje Agro-Market — Saturday
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s16,
  'Adeje Agro-Market — Saturday',
  'Weekly Saturday farmers'' market at Polígono Las Torres in Adeje. Local farmers, cheesemakers, beekeepers, bakers and fishermen sell directly to the public. Known for award-winning artisan goat''s cheese, Adeje honey, Canarian black pork and tropical fruit from southern Tenerife. Café on site.',
  28.1218, -16.7188,
  'Agromercado de Adeje, C/ Archajara s/n, Polígono Las Torres, Adeje',
  'food',
  '2026-05-30 07:00:00+00',
  '2026-05-30 12:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s16, 'food'), (s16, 'culture'), (s16, 'family');

-- 17. Fañabé Market — Costa Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s17,
  'Fañabé Market — Costa Adeje',
  'One of the most popular street markets in the south, set up on Avenida de Bruselas next to Playa del Duque. Around 100 stalls offer fresh Canarian produce, handmade jewellery, leather goods, clothing, wines, olive oil and souvenirs. Lively atmosphere beside the sea in Costa Adeje.',
  28.0801, -16.7378,
  'Av. de Bruselas, Playa de Fañabé, Costa Adeje',
  'culture',
  '2026-05-30 08:00:00+00',
  '2026-05-30 13:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s17, 'culture'), (s17, 'food'), (s17, 'outdoor');

-- 18. Rastro de Guaza — Saturday
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s18,
  'Rastro de Guaza — Second-Hand Market',
  'The largest second-hand market in Tenerife, with around 140 stalls on two floors in the village of Guaza (municipality of Arona). New and second-hand items, antiques, clothing, crockery and collectables. Free entry; cash recommended.',
  28.0630, -16.6732,
  'C/ Josefina Reveron, Guaza, Arona',
  'culture',
  '2026-05-30 07:30:00+00',
  '2026-05-30 13:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s18, 'culture'), (s18, 'outdoor'), (s18, 'family');

-- 19. Fiestas de Las Nieves 2026 — Opening, Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s19,
  'Fiestas de Las Nieves 2026 — Opening Ceremony, Adeje',
  'Opening of the 2026 Las Nieves Patron Saint Festival in Adeje. The ceremony includes a street parade with batucada drummers and costumed characters, folklore performances, children''s activities and the queens'' gala at the Centro Cultural Las Nieves. Free admission to all events.',
  28.1222, -16.7270,
  'Centro Cultural Las Nieves & Plaza del Barrio, Adeje',
  'culture',
  '2026-05-30 18:00:00+00',
  '2026-05-30 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s19, 'culture'), (s19, 'family'), (s19, 'music');

-- 20. BRESH Tenerife — Open-Air Party
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s20,
  'BRESH Tenerife — Open-Air Party',
  'Open-air party in festival format with non-stop music: pop, reggaeton, cumbia, 2000s hits and trap. Seven hours of continuous music at Parque Marítimo César Manrique in Santa Cruz de Tenerife, with thousands of attendees in colourful costumes and glitter. An inclusive and festive event for everyone.',
  28.4672, -16.2548,
  'Parque Marítimo César Manrique, Santa Cruz de Tenerife',
  'party',
  '2026-05-30 14:30:00+00',
  '2026-05-30 21:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s20, 'party'), (s20, 'music'), (s20, 'outdoor');

-- 21. History — The Evolution of Music @ Pirámide de Arona
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s21,
  'History — The Evolution of Music',
  'Spectacular weekly Saturday show at southern Tenerife''s largest auditorium. Thirty musicians, singers, dancers and acrobats pay tribute to the history of music: from Gregorian chant and Beethoven through Queen, The Beatles and Coldplay. A unique audio-visual experience with top production values. Doors open at 21:00.',
  28.0535, -16.7260,
  'Pirámide de Arona, Mare Nostrum Resort, Playa de las Américas',
  'music',
  '2026-05-30 20:00:00+00',
  '2026-05-30 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s21, 'music'), (s21, 'culture'), (s21, 'art');

-- 22. Project X — Live Music at Hard Rock Cafe
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s22,
  'Project X — Live Music at Hard Rock Cafe',
  'Live music performance on the upper terrace of Hard Rock Cafe Tenerife in Playa de las Américas. Free event for all ages, no ticket required. A night of rock and great music with the seafront promenade as a backdrop.',
  28.0530, -16.7273,
  'Hard Rock Cafe Tenerife, Playa de las Américas',
  'music',
  '2026-05-30 20:30:00+00',
  '2026-05-30 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s22, 'music'), (s22, 'outdoor');

-- 23. Whale & Dolphin Watching — Puerto Colón, Costa Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s23,
  'Whale & Dolphin Watching — Puerto Colón',
  'Daily whale and dolphin watching trips from Puerto Colón in Costa Adeje. The strait between Tenerife and La Gomera is home to permanent populations of short-finned pilot whales and bottlenose dolphins. Marine biologist guides and a 99.9% sighting rate. Duration: 2.5 hours. Suitable for families.',
  28.0720, -16.7390,
  'Puerto Colón Marina, Costa Adeje',
  'nature',
  '2026-05-30 09:00:00+00',
  '2026-05-30 11:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s23, 'nature'), (s23, 'outdoor'), (s23, 'family');

-- 24. Kayak & Snorkel — Masca Gorge, Los Gigantes
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s24,
  'Kayak & Snorkel — Masca Gorge, Los Gigantes',
  'Guided kayak and snorkel adventure from Los Gigantes harbour, paddling beneath 600-metre volcanic cliffs to the crystal-clear waters at the mouth of Masca Gorge. Equipment, guide and support boat included. Suitable for beginners. One of the most spectacular excursions in Tenerife.',
  28.2436, -16.8417,
  'Puerto de Los Gigantes Marina, Santiago del Teide',
  'outdoor',
  '2026-05-30 09:30:00+00',
  '2026-05-30 12:30:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s24, 'outdoor'), (s24, 'nature'), (s24, 'sport');

-- 25. Papagayo x Tribu Beach Party
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s25,
  'Papagayo x Tribu Beach Party',
  'All-day and evening beach party with reggaeton and Latin music at Papagayo Tenerife, the best venue on the Playa de las Américas seafront. General admission from 17:30 with VIP table options. The Twin Ticket also grants access to the Essence after-party from 23:30.',
  28.0534, -16.7289,
  'Papagayo Tenerife, Av. Rafael Puig Lluvina 2, Playa de las Américas',
  'party',
  '2026-05-30 16:30:00+00',
  '2026-05-30 22:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s25, 'party'), (s25, 'music'), (s25, 'outdoor');

-- 26. Jaleo Urbano @ Monkey Beach Club
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s26,
  'Jaleo Urbano — Monkey Beach Club, Playa de Troya',
  'Urban music night at Monkey Beach Club on the Playa de Troya promenade, with DJ Wes and El Musicario. The beachside venue with ocean views transforms into a nightclub after sunset. Festive atmosphere with views of the Atlantic in Costa Adeje.',
  28.0545, -16.7298,
  'Monkey Beach Club, Av. Rafael Puig Lluvina 3, Playa de Troya, Costa Adeje',
  'party',
  '2026-05-30 21:00:00+00',
  '2026-05-31 03:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s26, 'party'), (s26, 'music'), (s26, 'outdoor');

-- 27. Hija De Fruta · Sala El Nido @ Papagayo
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s27,
  'Hija De Fruta — Sala El Nido, Papagayo Tenerife',
  'Weekly Saturday night party with reggaeton, open-format and urban music in Sala El Nido at Papagayo Tenerife. A fixture of southern Tenerife nightlife every Saturday during the season. Tickets and guest list available on Xceed.',
  28.0534, -16.7289,
  'Papagayo Tenerife (Sala El Nido), Av. Rafael Puig Lluvina 2, Playa de las Américas',
  'party',
  '2026-05-30 22:00:00+00',
  '2026-05-31 05:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s27, 'party'), (s27, 'music');

-- 28. Crusy · Essence After-Party @ Papagayo
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s28,
  'Crusy · Essence After-Party — Papagayo Tenerife',
  'Electronic music after-party in Sala Essence at Papagayo Tenerife with DJ Crusy behind the decks. Continues the daytime Tribu Beach event via the Twin Ticket, or with separate entry from midnight. Quality techno and electronics at the best venue in the south.',
  28.0534, -16.7289,
  'Papagayo Tenerife (Sala Essence), Av. Rafael Puig Lluvina 2, Playa de las Américas',
  'party',
  '2026-05-30 22:30:00+00',
  '2026-05-31 04:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s28, 'party'), (s28, 'music');

-- 29. Verónicas Strip Nightlife — Playa de las Américas
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s29,
  'Verónicas Strip — Nightlife in Playa de las Américas',
  'The famous 300-metre Verónicas Street in Playa de las Américas hosts dozens of bars and nightclubs every night, including Tramps (multi-room club open until 06:00), Linekers and scores of cocktail bars. Summer high season begins — the liveliest nightlife in southern Tenerife.',
  28.0534, -16.7300,
  'C/ Verónicas Strip, Playa de las Américas, Arona',
  'party',
  '2026-05-30 21:00:00+00',
  '2026-05-31 05:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s29, 'party'), (s29, 'music');

-- 30. Siam Park — Water Park, Costa Adeje
INSERT INTO events (id, title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status)
VALUES (
  s30,
  'Siam Park — Water Park, Costa Adeje',
  'The world''s number 1 water park (TripAdvisor, multiple years), open in Costa Adeje. 21 attractions including the Tower of Power, the Mai Thai River (longest lazy river in Europe), wave pool, children''s area and restaurants. Open every day of the weekend. Entry: €42 adults, €30 children (3–11 years).',
  28.0729, -16.7312,
  'Siam Park, Av. Siam, Costa Adeje',
  'family',
  '2026-05-30 09:00:00+00',
  '2026-05-30 17:00:00+00',
  team_id, 'upcoming'
);
INSERT INTO event_tags (event_id, tag) VALUES (s30, 'family'), (s30, 'outdoor'), (s30, 'sport');

END $$;
