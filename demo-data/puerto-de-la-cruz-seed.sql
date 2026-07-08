-- ============================================================
-- MEUWE DEMO SEED — Puerto de la Cruz, Tenerife
-- ============================================================
-- INSTRUKCJA:
--   1. Zastąp DEMO_USER_ID poniżej swoim user_id z Supabase Auth
--   2. Uruchom w Supabase SQL Editor (dashboard → SQL)
--
-- Godziny przechowywane jako Atlantic/Canary local time → UTC
-- Helper: (CURRENT_DATE::timestamp + INTERVAL 'H hours') AT TIME ZONE 'Atlantic/Canary'
-- ============================================================

DO $$
DECLARE
  -- ► Wstaw tutaj swój user_id z Supabase Auth → Authentication → Users
  demo_uid UUID := 'TWOJ_USER_ID_TUTAJ';

  -- Kolory autorów czatu
  c_orange  TEXT := '#FF7A45';
  c_blue    TEXT := '#4A90E2';
  c_green   TEXT := '#27AE60';
  c_purple  TEXT := '#8E44AD';
  c_red     TEXT := '#E74C3C';
  c_teal    TEXT := '#1ABC9C';
  c_yellow  TEXT := '#F39C12';
  c_pink    TEXT := '#E91E8C';

  -- Zmienne do przechowywania ID wydarzeń
  e1  UUID; e2  UUID; e3  UUID; e4  UUID; e5  UUID;
  e6  UUID; e7  UUID; e8  UUID; e9  UUID; e10 UUID;
  e11 UUID; e12 UUID; e13 UUID; e14 UUID; e15 UUID;
  e16 UUID; e17 UUID; e18 UUID; e19 UUID; e20 UUID;
  e21 UUID; e22 UUID; e23 UUID; e24 UUID; e25 UUID;
  e26 UUID; e27 UUID; e28 UUID; e29 UUID; e30 UUID;
  e31 UUID; e32 UUID; e33 UUID; e34 UUID; e35 UUID;
  e36 UUID; e37 UUID; e38 UUID; e39 UUID; e40 UUID;
  e41 UUID; e42 UUID; e43 UUID; e44 UUID; e45 UUID;
  e46 UUID; e47 UUID; e48 UUID; e49 UUID;

  now_ts TIMESTAMPTZ := NOW();

  -- Helper: bieżący dzień o danej godzinie w czasie lokalnym Wysp Kanaryjskich
  -- Użycie: t('20:00') = dzisiaj 20:00 WEST (UTC+1 lato)
  t12 TIMESTAMPTZ; t13 TIMESTAMPTZ; t1330 TIMESTAMPTZ;
  t1730 TIMESTAMPTZ; t18 TIMESTAMPTZ; t1830 TIMESTAMPTZ;
  t19 TIMESTAMPTZ; t1930 TIMESTAMPTZ;
  t20 TIMESTAMPTZ; t2030 TIMESTAMPTZ; t21 TIMESTAMPTZ;

BEGIN

  -- Przeliczenie godzin lokalnych (Atlantic/Canary) na UTC
  t12   := ('2026-06-17'::timestamp + INTERVAL '12 hours')  AT TIME ZONE 'Atlantic/Canary';
  t13   := ('2026-06-17'::timestamp + INTERVAL '13 hours')  AT TIME ZONE 'Atlantic/Canary';
  t1330 := ('2026-06-17'::timestamp + INTERVAL '13 hours 30 minutes') AT TIME ZONE 'Atlantic/Canary';
  t1730 := ('2026-06-17'::timestamp + INTERVAL '17 hours 30 minutes') AT TIME ZONE 'Atlantic/Canary';
  t18   := ('2026-06-17'::timestamp + INTERVAL '18 hours')  AT TIME ZONE 'Atlantic/Canary';
  t1830 := ('2026-06-17'::timestamp + INTERVAL '18 hours 30 minutes') AT TIME ZONE 'Atlantic/Canary';
  t19   := ('2026-06-17'::timestamp + INTERVAL '19 hours')  AT TIME ZONE 'Atlantic/Canary';
  t1930 := ('2026-06-17'::timestamp + INTERVAL '19 hours 30 minutes') AT TIME ZONE 'Atlantic/Canary';
  t20   := ('2026-06-17'::timestamp + INTERVAL '20 hours')  AT TIME ZONE 'Atlantic/Canary';
  t2030 := ('2026-06-17'::timestamp + INTERVAL '20 hours 30 minutes') AT TIME ZONE 'Atlantic/Canary';
  t21   := ('2026-06-17'::timestamp + INTERVAL '21 hours')  AT TIME ZONE 'Atlantic/Canary';

-- ============================================================
-- 1. BLANCO BAR — DJ Night Latino
-- 21:00 → 01:00 (4h) — nocny klub, peak o północy
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'DJ Night Latino en Blanco Bar',
  'El mejor reggaeton y salsa de la isla. DJ Toni pone los ritmos esta noche. Copas 2x1 hasta medianoche. Pista de baile abierta toda la noche.',
  28.4166313, -16.5504877, 'Blanco Bar', 'party',
  t21,
  t21 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e1;

INSERT INTO event_tags (event_id, tag) VALUES (e1,'party'),(e1,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e1, demo_uid, 'Carlos', c_orange, '¡Que buena música esta noche! 🔥', now_ts - INTERVAL '45 min'),
(e1, demo_uid, 'Sofia', c_blue, 'Llegamos en 20 minutos, guardadnos sitio en la barra', now_ts - INTERVAL '38 min'),
(e1, demo_uid, 'Carlos', c_orange, 'Hay cola en la puerta? O entramos directo', now_ts - INTERVAL '30 min'),
(e1, demo_uid, 'DJ Toni', c_purple, 'Sin cola, entrad directos y decid que venís del evento meuwe 😎', now_ts - INTERVAL '25 min'),
(e1, demo_uid, 'Ana', c_pink, 'Acabo de llegar, está hasta arriba pero la atmósfera es increíble!', now_ts - INTERVAL '15 min'),
(e1, demo_uid, 'Marco', c_green, 'La canción de ahora 🎵🎵🎵 alguien sabe cómo se llama?', now_ts - INTERVAL '8 min'),
(e1, demo_uid, 'Sofia', c_blue, 'Estamos dentro ya! La pista de baile está brutal 💃', now_ts - INTERVAL '3 min');

-- ============================================================
-- 2. MOLLY MALONE'S — Live Music Tuesday
-- 20:00 → 24:00 (4h) — pub z muzyką na żywo wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Live Music Night at The Molly Malone',
  'The Canary Islands'' favourite Irish pub hosts live music every Tuesday. Tonight: The Rolling Cliffs band playing classic rock and Irish folk. Guinness flowing, pool table free all night.',
  28.4180657, -16.5495273, 'The Molly Malone', 'music',
  t20,
  t20 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e2;

INSERT INTO event_tags (event_id, tag) VALUES (e2,'music'),(e2,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e2, demo_uid, 'Paddy', c_green, 'The lads are already setting up, gonna be a great night!', now_ts - INTERVAL '50 min'),
(e2, demo_uid, 'Sarah', c_pink, 'Finally! Been waiting all week for Tuesday 🍺', now_ts - INTERVAL '42 min'),
(e2, demo_uid, 'Mike', c_blue, 'Is there a cover charge tonight?', now_ts - INTERVAL '35 min'),
(e2, demo_uid, 'Paddy', c_green, 'No cover, just buy drinks and enjoy the craic', now_ts - INTERVAL '30 min'),
(e2, demo_uid, 'Emma', c_yellow, 'Just landed in Puerto, heading straight here after dropping bags 😄', now_ts - INTERVAL '20 min'),
(e2, demo_uid, 'Sarah', c_pink, 'Band just started! They''re class tonight 🎸', now_ts - INTERVAL '5 min'),
(e2, demo_uid, 'Tom', c_teal, 'Save me a spot at the bar, 10 min away!', now_ts - INTERVAL '2 min');

-- ============================================================
-- 3. AZÚCAR — Noche de Salsa
-- 21:00 → 01:00 (4h) — salsa zaczyna się późno
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Noche de Salsa Cubana — Azúcar',
  'La noche de salsa más auténtica del norte de Tenerife. Percusión en vivo, bailarines profesionales que enseñan los pasos básicos a las 22h. Mojitos y daiquiris artesanales toda la noche.',
  28.4167872, -16.5447448, 'Azúcar', 'music',
  t21,
  t21 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e3;

INSERT INTO event_tags (event_id, tag) VALUES (e3,'music'),(e3,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e3, demo_uid, 'Isabella', c_red, 'Nunca he bailado salsa, ¿es para principiantes también?', now_ts - INTERVAL '1 hour'),
(e3, demo_uid, 'Roberto', c_orange, 'Sí! Siempre hay clase introductoria. Yo fui la semana pasada sin saber nada y me lo pasé genial', now_ts - INTERVAL '52 min'),
(e3, demo_uid, 'Isabella', c_red, 'Perfecto! Voy con mi amiga, nos vemos allí 💃', now_ts - INTERVAL '45 min'),
(e3, demo_uid, 'Luis', c_teal, 'Los mojitos de aquí son los mejores de toda la isla, no os los perdáis', now_ts - INTERVAL '30 min'),
(e3, demo_uid, 'María', c_purple, 'Llevamos 30 min bailando y ya no puedo parar 😂', now_ts - INTERVAL '10 min');

-- ============================================================
-- 4. VAMPIS DISCO — Techno Underground
-- 21:00 → 03:00 (6h) — klub nocny, najdłużej
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Underground Techno Night — Vampis',
  'La noche más oscura y electrónica de Puerto. Resident DJs + guest from Berlin. Puertas abren a medianoche, el peak hour a las 3am. Dress code: black preferred. LGBTQ+ safe space.',
  28.4174244, -16.5440005, 'Vampis Disco', 'party',
  t21,
  t21 + INTERVAL '6 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e4;

INSERT INTO event_tags (event_id, tag) VALUES (e4,'party'),(e4,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e4, demo_uid, 'Alex', c_purple, 'Who''s coming tonight? Guest DJ is supposed to be 🔥', now_ts - INTERVAL '2 hours'),
(e4, demo_uid, 'Sam', c_blue, 'I''m in, what time are people actually arriving?', now_ts - INTERVAL '1 hour 45 min'),
(e4, demo_uid, 'Alex', c_purple, 'Probably 1am is fine, before that it''ll be empty', now_ts - INTERVAL '1 hour 30 min'),
(e4, demo_uid, 'Jordan', c_teal, 'Is there still queue at the door usually?', now_ts - INTERVAL '1 hour'),
(e4, demo_uid, 'Sam', c_blue, 'Never had to queue, just knock and they let you in', now_ts - INTERVAL '45 min'),
(e4, demo_uid, 'River', c_pink, 'First time at Vampis, excited and nervous haha', now_ts - INTERVAL '20 min'),
(e4, demo_uid, 'Alex', c_purple, 'You''ll love it, most welcoming crowd on the island 🖤', now_ts - INTERVAL '10 min');

-- ============================================================
-- 5. ANDANA BEACH CLUB — Sunset Session
-- 17:30 → 20:30 (3h) — zachód słońca, sesja popołudniowa
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Sunset DJ Session — Andana Beach Club',
  'El atardecer más bonito de Puerto de la Cruz con música electrónica suave. DJ Sunrise pone deep house mientras el sol se hunde en el Atlántico. Cócteles de temporada, tumbonas disponibles desde las 17h.',
  28.4113736, -16.5612088, 'Andana Beach Club', 'outdoor',
  t1730,
  t1730 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e5;

INSERT INTO event_tags (event_id, tag) VALUES (e5,'outdoor'),(e5,'music'),(e5,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e5, demo_uid, 'Pablo', c_orange, 'Las vistas están increíbles hoy, el Teide perfecto al fondo 🌋', now_ts - INTERVAL '40 min'),
(e5, demo_uid, 'Lucia', c_pink, 'Cuánto cuesta la tumbona con sombrilla?', now_ts - INTERVAL '32 min'),
(e5, demo_uid, 'Pablo', c_orange, 'Creo que 15€ con consumición incluida', now_ts - INTERVAL '25 min'),
(e5, demo_uid, 'Klaudia', c_teal, 'Just arrived from Germany, this place is exactly what I imagined Tenerife to be 🌅', now_ts - INTERVAL '15 min'),
(e5, demo_uid, 'Lucia', c_pink, 'Vamos corriendo, queda poco para el atardecer!', now_ts - INTERVAL '5 min');

-- ============================================================
-- 6. CASINO TAORO — Noche Elegante
-- 20:00 → 00:00 (4h) — kasyno, wieczorny dress code
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Noche de Casino y Cócteles — Taoro',
  'Una velada elegante en el casino más antiguo de Canarias (1932). Ruleta, blackjack y póker desde las 21h. Bar con cócteles clásicos y vistas al parque. Dress code smart casual obligatorio.',
  28.4203152, -16.5430273, 'Casino Taoro', 'party',
  t20,
  t20 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e6;

INSERT INTO event_tags (event_id, tag) VALUES (e6,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e6, demo_uid, 'Fernando', c_blue, 'El edificio es espectacular, ¿alguien ha ido antes?', now_ts - INTERVAL '55 min'),
(e6, demo_uid, 'Helena', c_purple, 'Fui el mes pasado, el ambiente es muy sofisticado. Vale la pena la visita aunque no juegues', now_ts - INTERVAL '48 min'),
(e6, demo_uid, 'Fernando', c_blue, 'Perfecto! Mi pareja quiere probar la ruleta por primera vez', now_ts - INTERVAL '35 min'),
(e6, demo_uid, 'Helena', c_purple, 'Los croupiers son muy amables con los nuevos 👍', now_ts - INTERVAL '20 min'),
(e6, demo_uid, 'Rodrigo', c_red, 'Hay mínimo en las mesas o se puede empezar con poco?', now_ts - INTERVAL '10 min'),
(e6, demo_uid, 'Helena', c_purple, 'Ruleta desde 1€, blackjack desde 5€. Muy accesible', now_ts - INTERVAL '3 min');

-- ============================================================
-- 7. ÉBANO CAFÉ — Arte y Vino / Vernissage
-- 19:00 → 22:00 (3h) — wernisaż, wczesny wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Vernissage + Vino — Ébano Café',
  'Inauguración de la exposición fotográfica "Atlántico" del artista local Marcos Rivero. Vinos de La Gomera y quesos canarios durante la apertura. Entrada libre. El artista presente toda la noche.',
  28.4166829, -16.5482732, 'Ébano Café', 'art',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e7;

INSERT INTO event_tags (event_id, tag) VALUES (e7,'art');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e7, demo_uid, 'Marcos R.', c_teal, 'Hola a todos! Estoy preparando los últimos detalles de la exposición 🎨', now_ts - INTERVAL '1 hour'),
(e7, demo_uid, 'Pilar', c_yellow, 'Vi las fotos en Instagram, son preciosas. Allí estaremos!', now_ts - INTERVAL '50 min'),
(e7, demo_uid, 'David', c_blue, '¿Las fotos son de venta también?', now_ts - INTERVAL '40 min'),
(e7, demo_uid, 'Marcos R.', c_teal, 'Sí, habrá copias numeradas disponibles. Precios razonables 😊', now_ts - INTERVAL '30 min'),
(e7, demo_uid, 'Carmen', c_pink, 'Ya estoy dentro, el café está lleno y los vinos son buenísimos 🍷', now_ts - INTERVAL '5 min');

-- ============================================================
-- 8. TASCA EL OLIVO — Cata de Vinos Canarios
-- 19:30 → 22:00 (2.5h) — degustacja wina wczesny wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Cata de Vinos Canarios — Tasca El Olivo',
  'Guiados por el sumiller Juan Carlos Pérez, exploraremos 6 vinos de las 7 islas: Lanzarote, La Palma, Tenerife valle y sur, Gran Canaria y La Gomera. Maridaje con quesos y embutidos artesanales incluido. Plazas limitadas a 12 personas.',
  28.4155364, -16.5501199, 'Tasca El Olivo', 'food',
  t1930,
  t1930 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e8;

INSERT INTO event_tags (event_id, tag) VALUES (e8,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e8, demo_uid, 'Juan Carlos', c_red, 'Quedan 3 plazas disponibles. Los vinos de hoy son excepcionales 🍷', now_ts - INTERVAL '2 hours'),
(e8, demo_uid, 'Natalia', c_purple, 'Reservamos para 2, llevamos muchas ganas!', now_ts - INTERVAL '1 hour 45 min'),
(e8, demo_uid, 'Thomas', c_blue, 'Are the explanations in English too?', now_ts - INTERVAL '1 hour 30 min'),
(e8, demo_uid, 'Juan Carlos', c_red, 'Yes! I do the tasting in both Spanish and English 👍', now_ts - INTERVAL '1 hour 20 min'),
(e8, demo_uid, 'Natalia', c_purple, 'Ya hemos llegado, el local es precioso por dentro', now_ts - INTERVAL '30 min'),
(e8, demo_uid, 'Thomas', c_blue, 'Amazing, the Lanzarote malvasía is incredible!', now_ts - INTERVAL '15 min');

-- ============================================================
-- 9. RESTAURANTE RÉGULO — Cena Gourmet
-- 20:30 → 23:30 (3h) — kolacja fine dining
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Cena Gourmet en Patio del Siglo XVII — Régulo',
  'El restaurante más elegante de Puerto de la Cruz abre su patio histórico para una cena especial con menú degustación de 7 platos. Cocina canaria contemporánea del chef Alejandro Suárez. Reserva obligatoria, plazas muy limitadas.',
  28.4172936, -16.5518819, 'Restaurante Régulo', 'food',
  t2030,
  t2030 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e9;

INSERT INTO event_tags (event_id, tag) VALUES (e9,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e9, demo_uid, 'Patricia', c_pink, 'Llevamos años queriendo venir, por fin tenemos reserva! 🥂', now_ts - INTERVAL '3 hours'),
(e9, demo_uid, 'Sergio', c_orange, 'El patio es espectacular a la luz de las velas, ya lo veréis', now_ts - INTERVAL '2 hours 30 min'),
(e9, demo_uid, 'Patricia', c_pink, 'Alguien sabe si el menú incluye el maridaje de vinos?', now_ts - INTERVAL '2 hours'),
(e9, demo_uid, 'Sergio', c_orange, 'Es opcional, 35€ extra pero merece la pena', now_ts - INTERVAL '1 hour 45 min'),
(e9, demo_uid, 'Ana', c_teal, 'Acabo de terminar, fue una experiencia increíble. El tartar de atún del 4º plato 🤌', now_ts - INTERVAL '20 min');

-- ============================================================
-- 10. IHUEY TASCA — Tapas Creativas en La Ranilla
-- 13:00 → 16:00 (3h) — tapas obiadowe / vermut
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Tapas Creativas + Vermut — Ihuey La Ranilla',
  'El barrio de pescadores de La Ranilla en su mejor momento. Ihuey presenta nuevas tapas de temporada: papas arrugadas con tres mojos, pulpo a la brasa, atún rojo local. Vermuts artesanales 2€ hasta las 14h.',
  28.4165968, -16.5531806, 'Ihuey Tasca', 'food',
  t13,
  t13 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e10;

INSERT INTO event_tags (event_id, tag) VALUES (e10,'food'),(e10,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e10, demo_uid, 'Yolanda', c_yellow, 'Las tapas nuevas están de lujo, el pulpo especialmente 😍', now_ts - INTERVAL '45 min'),
(e10, demo_uid, 'Paco', c_red, 'Llegamos en 10 min, hay mesa libre en la terraza?', now_ts - INTERVAL '35 min'),
(e10, demo_uid, 'Yolanda', c_yellow, 'Quedan 2 mesas fuera, daos prisa!', now_ts - INTERVAL '30 min'),
(e10, demo_uid, 'Monika', c_purple, 'Hola! Is menu in English available?', now_ts - INTERVAL '20 min'),
(e10, demo_uid, 'Ihuey', c_teal, 'Yes! Our staff speaks English, welcome to La Ranilla 😊', now_ts - INTERVAL '15 min'),
(e10, demo_uid, 'Paco', c_red, 'Ya estamos, los vermuts están increíbles por ese precio 🍸', now_ts - INTERVAL '5 min');

-- ============================================================
-- 11. ABACO — Cocktail Experience
-- 20:00 → 00:00 (4h) — słynny koktajlbar, wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'The Legendary Abaco Cocktail Experience',
  'One of the world''s most unique cocktail bars — an 18th century mansion filled with antiques, fruit, and opera music. Tonight is extra special: live soprano performance between 9 and 10pm. Reservation strongly recommended. Dress elegantly.',
  28.4130000, -16.5510000, 'Abaco', 'art',
  t20,
  t20 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e11;

INSERT INTO event_tags (event_id, tag) VALUES (e11,'art'),(e11,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e11, demo_uid, 'James', c_blue, 'This place is on every bucket list — finally going tonight!', now_ts - INTERVAL '1 hour 20 min'),
(e11, demo_uid, 'Elena', c_pink, 'The cocktails are €20+ but worth every penny. The atmosphere is unlike anywhere else', now_ts - INTERVAL '1 hour'),
(e11, demo_uid, 'James', c_blue, 'Is it true they have a fruit tree inside?', now_ts - INTERVAL '45 min'),
(e11, demo_uid, 'Elena', c_pink, 'Yes!! Huge fruit arrangements everywhere, completely surreal 🍊🍍', now_ts - INTERVAL '30 min'),
(e11, demo_uid, 'Wolfgang', c_purple, 'Ich war letztes Jahr hier — der beste Cocktailbar den ich je besucht habe 🎶', now_ts - INTERVAL '15 min'),
(e11, demo_uid, 'James', c_blue, 'Soprano just started singing. I have no words 😭', now_ts - INTERVAL '3 min');

-- ============================================================
-- 12. BAMBÚ BEACH CLUB — Electronic Sunday
-- 13:00 → 19:00 (6h) — beach club, cały dzień
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Electronic Sunday — Bambú Beach Club',
  'El cierre perfecto del fin de semana. DJs locales y vista al Atlántico. House y techno suave durante el día, progressive de noche. Buffet de brunch hasta las 15h. Acceso playa directa.',
  28.4118000, -16.5608000, 'Bambú Beach Club', 'outdoor',
  t13,
  t13 + INTERVAL '6 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e12;

INSERT INTO event_tags (event_id, tag) VALUES (e12,'outdoor'),(e12,'music'),(e12,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e12, demo_uid, 'Diego', c_teal, 'El brunch estaba brutal, ahora a bailar un poco 😎', now_ts - INTERVAL '1 hour'),
(e12, demo_uid, 'Silvia', c_yellow, 'El mar hoy está súper tranquilo, día perfecto para esto ☀️', now_ts - INTERVAL '45 min'),
(e12, demo_uid, 'Kai', c_blue, 'Driving from Santa Cruz now, worth it?', now_ts - INTERVAL '30 min'),
(e12, demo_uid, 'Diego', c_teal, 'Absolutely, one of the best spots on the island', now_ts - INTERVAL '20 min'),
(e12, demo_uid, 'Silvia', c_yellow, 'Está subiendo el BPM, ya llegando a la hora buena 🎧', now_ts - INTERVAL '5 min');

-- ============================================================
-- 13. VINOTECA CON PASIÓN — Vinos Naturales
-- 19:00 → 22:00 (3h) — intymna degustacja wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Vinos Naturales de Autor — Vinoteca Con Pasión',
  'Selección especial de vinos naturales y biodinámicos de pequeños productores canarios y peninsulares. Charla informal con el enólogo Pedro Alonso. Ambiente íntimo y romántico. Máximo 10 personas.',
  28.4162508, -16.5462326, 'Vinoteca Con Pasión', 'food',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e13;

INSERT INTO event_tags (event_id, tag) VALUES (e13,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e13, demo_uid, 'Cristina', c_red, 'Pedro, ¿habrá algún orange wine esta noche?', now_ts - INTERVAL '3 hours'),
(e13, demo_uid, 'Pedro A.', c_orange, 'Sí! Traigo un albariño macerado en piel de La Palma que te va a sorprender 🍊', now_ts - INTERVAL '2 hours 40 min'),
(e13, demo_uid, 'Cristina', c_red, 'Perfecto, ya tenemos ganas!', now_ts - INTERVAL '2 hours'),
(e13, demo_uid, 'Victor', c_blue, 'Somos 4, ¿todavía hay plazas?', now_ts - INTERVAL '1 hour 30 min'),
(e13, demo_uid, 'Pedro A.', c_orange, 'Quedan 2 últimas plazas, apuntaos rápido', now_ts - INTERVAL '1 hour 15 min');

-- ============================================================
-- 14. BRUNELLI'S STEAKHOUSE — Steak & Wine Night
-- 20:00 → 23:00 (3h) — kolacja w stekhouse
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Prime Steak & Sommelier Night — Brunelli''s',
  'Special evening at Punta Brava''s finest steakhouse. Chef presents aged Canarian cattle alongside Argentine cuts. Sommelier pairing of Spanish reds. Private dining room available for groups up to 8.',
  28.4098038, -16.5661513, 'Brunelli''s Steakhouse', 'food',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e14;

INSERT INTO event_tags (event_id, tag) VALUES (e14,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e14, demo_uid, 'Robert', c_blue, 'Is the Canarian Black Angus available tonight?', now_ts - INTERVAL '2 hours'),
(e14, demo_uid, 'Brunellis', c_red, 'Yes! 300g dry-aged, highly recommend. Also have a wonderful Rioja Reserva to pair 🥩', now_ts - INTERVAL '1 hour 45 min'),
(e14, demo_uid, 'Anna', c_pink, 'We''re celebrating our anniversary, can you arrange something special?', now_ts - INTERVAL '1 hour 20 min'),
(e14, demo_uid, 'Brunellis', c_red, 'Of course! DM me and we''ll prepare a surprise dessert 🥂', now_ts - INTERVAL '1 hour'),
(e14, demo_uid, 'Robert', c_blue, 'Just arrived. The steak is outstanding, already ordered a second bottle 😄', now_ts - INTERVAL '15 min');

-- ============================================================
-- 15. THE BEE HIVE PUB — Pub Quiz Night
-- 19:00 → 22:00 (3h) — quiz, wczesny wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Tuesday Pub Quiz — The Bee Hive',
  'The best pub quiz in Puerto de la Cruz! 6 rounds: sport, music, geography, movies, science, and a wildcard round. Teams of max 5 people. Winner takes €50 bar tab. Starts sharp at 8pm, sign up at the bar from 7pm.',
  28.4168538, -16.5466139, 'The Bee Hive Pub', 'party',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e15;

INSERT INTO event_tags (event_id, tag) VALUES (e15,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e15, demo_uid, 'Kevin', c_green, 'Team ''Tenerife Titans'' is ready! Who''s our competition? 😄', now_ts - INTERVAL '1 hour 30 min'),
(e15, demo_uid, 'Sandra', c_yellow, 'Team ''No Idea'' checking in, we''re going to lose but have fun!', now_ts - INTERVAL '1 hour 15 min'),
(e15, demo_uid, 'Kevin', c_green, 'Haha we need a geography expert, anyone free to join?', now_ts - INTERVAL '1 hour'),
(e15, demo_uid, 'Phil', c_teal, 'I''m in! Lived in 12 countries so geography is my thing 🗺️', now_ts - INTERVAL '45 min'),
(e15, demo_uid, 'Sandra', c_yellow, 'Quiz started! First round is sport, send help 😂', now_ts - INTERVAL '5 min');

-- ============================================================
-- 16. CAFÉ PARIS — Brunch Francés
-- 12:00 → 15:00 (3h) — brunch południe
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Brunch Français — Café Paris',
  'Brunch de domingo inspirado en los cafés parisinos: crepes dulces y saladas, quiche lorraine, pain au chocolat, café de especialidad. Terraza con vistas al Atlántico. De 12h a 15h. Sin reserva.',
  28.4186160, -16.5440688, 'Café Paris', 'food',
  t12,
  t12 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e16;

INSERT INTO event_tags (event_id, tag) VALUES (e16,'food'),(e16,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e16, demo_uid, 'Amélie', c_pink, 'Les crêpes ici sont comme à Paris, c''est incroyable! 🥐', now_ts - INTERVAL '50 min'),
(e16, demo_uid, 'Marco', c_blue, 'Hay que llegar pronto o hay mucha espera?', now_ts - INTERVAL '40 min'),
(e16, demo_uid, 'Amélie', c_pink, 'Llegué a las 12 sin espera. Ahora hay algo de cola pero rápida', now_ts - INTERVAL '30 min'),
(e16, demo_uid, 'Lena', c_green, 'Schon 45 Minuten hier und noch keine Reue — der Kaffee ist herrlich ☕', now_ts - INTERVAL '15 min'),
(e16, demo_uid, 'Marco', c_blue, 'Ya estoy dentro, vista al mar desde la terraza = perfecta tarde de domingo 🌊', now_ts - INTERVAL '5 min');

-- ============================================================
-- 17. EL TALLER SEVE DIAZ — Menú Degustación
-- 20:30 → 23:30 (3h) — późna kolacja fine dining
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Menú Degustación Temporada — El Taller Seve Díaz',
  'Una de las mejores mesas del norte de Tenerife. El chef Seve Díaz presenta su nuevo menú de primavera-verano: 9 pasos con producto 100% canario. Maridaje opcional con vinos de autor de las islas. Reserva imprescindible.',
  28.4167602, -16.5523475, 'El Taller Seve Díaz', 'food',
  t2030,
  t2030 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e17;

INSERT INTO event_tags (event_id, tag) VALUES (e17,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e17, demo_uid, 'Laura', c_purple, 'Hemos reservado para el cumpleaños de mi marido, tantas ganas!', now_ts - INTERVAL '5 hours'),
(e17, demo_uid, 'Seve', c_orange, 'Bienvenidos! Esta noche el menú empieza con ceviche de vieja local 🐟', now_ts - INTERVAL '4 hours'),
(e17, demo_uid, 'Laura', c_purple, 'Chef, ¿hay opción vegetariana en algún plato?', now_ts - INTERVAL '3 hours 30 min'),
(e17, demo_uid, 'Seve', c_orange, 'Sí, 4 de los 9 platos tienen versión vegana. Avisadnos al llegar 🌱', now_ts - INTERVAL '3 hours'),
(e17, demo_uid, 'Jorge', c_teal, 'Estuve aquí el mes pasado — el caldo canario del chef es sencillamente perfecto', now_ts - INTERVAL '1 hour');

-- ============================================================
-- 18. COFRADÍA DE PESCADORES — Venta de Pescado Fresco
-- 12:00 → 14:00 (2h) — lonja, południe
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Pescado Fresco del Puerto — Cofradía',
  'La lonja de pescadores abre sus puertas al público esta mañana. Venta directa de pescado fresco recién descargado: vieja, sama, bocinegro, cherne. Los mismos precios que los restaurantes locales. Solo efectivo.',
  28.4182000, -16.5492000, 'Cofradía de Pescadores', 'food',
  t12,
  t12 + INTERVAL '2 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e18;

INSERT INTO event_tags (event_id, tag) VALUES (e18,'food'),(e18,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e18, demo_uid, 'Manolo', c_red, 'Hoy hay cherne grande, rarísimo de encontrar. Id rápido!', now_ts - INTERVAL '40 min'),
(e18, demo_uid, 'Rosa', c_pink, 'Cuánto está el kilo de vieja hoy?', now_ts - INTERVAL '32 min'),
(e18, demo_uid, 'Manolo', c_red, '4.50€/kg, precio de lonja. Imposible en ningún super', now_ts - INTERVAL '25 min'),
(e18, demo_uid, 'Rosa', c_pink, 'Compré 2kg de sama, fresquísima. Gracias por el aviso! 🐟', now_ts - INTERVAL '10 min');

-- ============================================================
-- 19. OLEA PINTXOS — Happy Hour
-- 18:00 → 20:00 (2h) — happy hour wczesny wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Happy Hour Pintxos — Olea Bar',
  'La hora feliz del mejor bar de pintxos vascos de Puerto. Todos los pintxos a 1.50€ y cañas a 1€ de 18 a 20h. La barra se llena de opciones frescas cada media hora. Sin reserva, primero en llegar.',
  28.4166000, -16.5477000, 'Olea Pintxos Bar', 'food',
  t18,
  t18 + INTERVAL '2 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e19;

INSERT INTO event_tags (event_id, tag) VALUES (e19,'food'),(e19,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e19, demo_uid, 'Iker', c_orange, 'El de txangurro y el de morcilla Ibérica de hoy están increíbles 🥖', now_ts - INTERVAL '30 min'),
(e19, demo_uid, 'Nerea', c_teal, 'Llegamos en 15 min! Hay espacio en la barra?', now_ts - INTERVAL '20 min'),
(e19, demo_uid, 'Iker', c_orange, 'Está lleno pero la gente rota bastante rápido', now_ts - INTERVAL '15 min'),
(e19, demo_uid, 'Mikel', c_blue, '1.50€ pintxos es el mejor precio que he visto en toda Tenerife 👌', now_ts - INTERVAL '8 min'),
(e19, demo_uid, 'Nerea', c_teal, 'Ya aquí! Probando el de gamba y jamón, madre mía 😍', now_ts - INTERVAL '2 min');

-- ============================================================
-- 20. AGORA BAR — Tertulia Filosófica
-- 19:00 → 21:00 (2h) — dyskusja filozoficzna, wczesny wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Tertulia Filosófica Semanal — Agora Café',
  'Cada martes desde hace 5 años: una hora de debate filosófico informal en la terraza de la plaza. Esta semana: "¿Tiene sentido la privacidad en la era digital?". Todos los niveles bienvenidos. Consumición libre.',
  28.4166566, -16.5486419, 'Agora Bar & Café', 'art',
  t19,
  t19 + INTERVAL '2 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e20;

INSERT INTO event_tags (event_id, tag) VALUES (e20,'art');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e20, demo_uid, 'Prof. Alvar', c_purple, 'El tema de hoy promete debate intenso. ¿Alguien tiene posición clara de antemano?', now_ts - INTERVAL '1 hour'),
(e20, demo_uid, 'Marta', c_pink, 'Yo defiendo que la privacidad ya no existe y hay que redefinir el concepto', now_ts - INTERVAL '50 min'),
(e20, demo_uid, 'Tomas', c_blue, 'Posición contraria: la privacidad es más importante que nunca precisamente por eso', now_ts - INTERVAL '40 min'),
(e20, demo_uid, 'Prof. Alvar', c_purple, '¡Perfecto! Ya tenemos los dos polos del debate. Nos vemos a las 19h 📚', now_ts - INTERVAL '30 min');

-- ============================================================
-- 21. LA CASONA — Aperitivo en Plaza del Charco
-- 13:00 → 17:00 (4h) — aperitif obiadowy, główny plac
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Aperitivo en Plaza del Charco — La Casona',
  'La terraza más céntrica de Puerto de la Cruz. Vermut artesanal, aceitunas, patatas bravas y la mejor gente-watching de la isla. La plaza del Charco en su mejor versión veraniega.',
  28.4165259, -16.5505548, 'La Casona', 'outdoor',
  t13,
  t13 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e21;

INSERT INTO event_tags (event_id, tag) VALUES (e21,'outdoor'),(e21,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e21, demo_uid, 'Claudia', c_yellow, 'La plaza llena de gente hoy, ambiente increíble ☀️', now_ts - INTERVAL '30 min'),
(e21, demo_uid, 'Bernardo', c_green, 'Los niños jugando alrededor del estanque, los mayores con el vermut. Perfecto 😊', now_ts - INTERVAL '20 min'),
(e21, demo_uid, 'Helga', c_teal, 'Wir sind aus Deutschland und diese Plaza ist genau wie wir uns Spanien vorgestellt haben!', now_ts - INTERVAL '12 min'),
(e21, demo_uid, 'Claudia', c_yellow, 'Welcome! This is the heart of Puerto de la Cruz 💛', now_ts - INTERVAL '5 min');

-- ============================================================
-- 22. MAGA RESTAURANT — Cena Romántica
-- 20:00 → 23:00 (3h) — kolacja z muzyką
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Cena Romántica con Música en Vivo — Maga',
  'Maga Restaurant presenta sus noches especiales de viernes: cena de 4 platos con música de piano en vivo. El pianista Jorge Navarro interpreta jazz clásico y bossa nova. Mesa para dos o más. Reserva con 48h de antelación.',
  28.4164932, -16.5498229, 'Maga Restaurant', 'food',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e22;

INSERT INTO event_tags (event_id, tag) VALUES (e22,'food'),(e22,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e22, demo_uid, 'Valentina', c_pink, 'Mi pareja no sabe a dónde le llevo esta noche, va a flipar 🥰', now_ts - INTERVAL '4 hours'),
(e22, demo_uid, 'Jorge N.', c_orange, 'Esta noche el repertorio incluye Jobim, Coltrane y algo de Piazzolla 🎹', now_ts - INTERVAL '3 hours'),
(e22, demo_uid, 'Valentina', c_pink, 'Perfecto! Mi pareja adora el jazz', now_ts - INTERVAL '2 hours 30 min'),
(e22, demo_uid, 'Gabriele', c_blue, 'Io e mia moglie siamo qui per il nostro anniversario — grazie per questa serata magica 🍷', now_ts - INTERVAL '30 min');

-- ============================================================
-- 23. PEQUEÑA BUDA — Meditación y Cócteles
-- 18:30 → 21:00 (2.5h) — zen przed wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Zen Hour: Meditación + Cócteles Asiáticos — Pequeña Buda',
  'Una hora de meditación guiada (20 min) seguida de cócteles con ingredientes asiáticos: lychee, jengibre, matcha, wasabi. Ambiente zen con música lounge. Grupos pequeños de máximo 15 personas.',
  28.4165000, -16.5499000, 'Pequeña Buda', 'art',
  t1830,
  t1830 + INTERVAL '2 hours 30 minutes',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e23;

INSERT INTO event_tags (event_id, tag) VALUES (e23,'art');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e23, demo_uid, 'Yuki', c_teal, 'I love that this place combines mindfulness with fun drinks!', now_ts - INTERVAL '1 hour'),
(e23, demo_uid, 'Sara', c_purple, '¿La meditación es guiada en español o inglés?', now_ts - INTERVAL '50 min'),
(e23, demo_uid, 'Pequeña Buda', c_orange, 'Both! Our guide is bilingual 🧘', now_ts - INTERVAL '40 min'),
(e23, demo_uid, 'Yuki', c_teal, 'The matcha mojito after meditation = perfect balance 🍵🍸', now_ts - INTERVAL '10 min');

-- ============================================================
-- 24. LAS TEJAS VERDES — Vino y Barrio Antiguo
-- 19:00 → 22:00 (3h) — kieliszek wina w starym barrio
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Viernes de Vino — Las Tejas Verdes',
  'El bar más bonito de Puerto Viejo. Vinos canarios por copas, queso del país, pan de millo. Música tranquila de fondo. El barrio más auténtico de Puerto de la Cruz: calles empedradas, casas coloniales, pescadores de toda la vida.',
  28.4158186, -16.5530065, 'Las Tejas Verdes', 'food',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e24;

INSERT INTO event_tags (event_id, tag) VALUES (e24,'food'),(e24,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e24, demo_uid, 'Ángela', c_pink, 'Este rincón es lo mejor que tiene Puerto, sin duda 🏘️', now_ts - INTERVAL '55 min'),
(e24, demo_uid, 'Ramón', c_green, 'El vino de malvasía seco que tienen es de La Palma, increíble', now_ts - INTERVAL '45 min'),
(e24, demo_uid, 'Hans', c_blue, 'Ich habe diesen Ort in keinem Reiseführer gefunden, zum Glück meuwe! 🍷', now_ts - INTERVAL '30 min'),
(e24, demo_uid, 'Ángela', c_pink, 'That''s the beauty of local apps! Welcome Hans 😊', now_ts - INTERVAL '20 min');

-- ============================================================
-- 25. BROMA LATINA — Noche Caribeña
-- 20:00 → 00:00 (4h) — fiesta latynoska wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Noche Caribeña — Broma Latina Tapas Bar',
  'Ritmos del Caribe, cócteles tropicales y tapas con sabores de las islas del Atlántico. Ron Legendario cubano, piña colada de autor, mojitos con hierba buena fresca. Ambiente festivo toda la noche.',
  28.4167000, -16.5478000, 'Broma Latina Tapas Bar', 'party',
  t20,
  t20 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e25;

INSERT INTO event_tags (event_id, tag) VALUES (e25,'party'),(e25,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e25, demo_uid, 'Alejandra', c_red, 'Las tapas caribeñas de aquí son de otro nivel 🌴', now_ts - INTERVAL '1 hour'),
(e25, demo_uid, 'Tomás', c_teal, 'El mojito con hierba fresca está impresionante', now_ts - INTERVAL '45 min'),
(e25, demo_uid, 'Carla', c_yellow, 'Había mucha espera para entrar o se puede ir directamente?', now_ts - INTERVAL '30 min'),
(e25, demo_uid, 'Alejandra', c_red, 'Sin espera ahora mismo, venid!', now_ts - INTERVAL '20 min'),
(e25, demo_uid, 'Tomás', c_teal, 'Empezando a sonar bachata, esto se anima! 🕺', now_ts - INTERVAL '5 min');

-- ============================================================
-- 26. LA MAISON BELGE — Belgian Beer Evening
-- 18:30 → 22:30 (4h) — belgijskie piwa, długi wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Belgian Beer Evening — La Maison Belge',
  'A taste of Belgium in the Canaries. 12 Belgian beers on tap and bottle: Duvel, Chimay, Orval, Westmalle and more. Belgian frites with homemade sauces, mussels in white wine. Belgian owner Marc explains each beer personally.',
  28.4167500, -16.5476000, 'La Maison Belge', 'food',
  t1830,
  t1830 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e26;

INSERT INTO event_tags (event_id, tag) VALUES (e26,'food'),(e26,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e26, demo_uid, 'Marc', c_orange, 'Bonsoir! Tonight I have a very special Trappist from Westvleteren 12 🍺', now_ts - INTERVAL '1 hour 30 min'),
(e26, demo_uid, 'Kristof', c_blue, 'Als Belg in het buitenland voel ik me hier thuis! 🇧🇪', now_ts - INTERVAL '1 hour 10 min'),
(e26, demo_uid, 'Marc', c_orange, 'Welkom Kristof! Orval voor jou?', now_ts - INTERVAL '55 min'),
(e26, demo_uid, 'Jenny', c_pink, 'The frites with andalouse sauce are incredible, so authentic!', now_ts - INTERVAL '30 min'),
(e26, demo_uid, 'Kristof', c_blue, 'The Westvleteren 12 is worth every euro — drink slowly and enjoy 🙏', now_ts - INTERVAL '10 min');

-- ============================================================
-- 27. HABASKO BAR — Ron del Mundo
-- 19:30 → 22:30 (3h) — degustacja rumu
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Ron del Mundo — Habasko Bar',
  'Cata de rones: 8 variedades de Cuba, Jamaica, Barbados, Panamá y las propias Canarias. El barman Andrés explica la producción y las diferencias. Maridaje con puros cubanos opcional. Aforo muy limitado.',
  28.4162575, -16.5451906, 'Habasko Bar', 'food',
  t1930,
  t1930 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e27;

INSERT INTO event_tags (event_id, tag) VALUES (e27,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e27, demo_uid, 'Andrés', c_red, 'Esta noche el Ron Zacapa 23 y el Barbancourt Reserve compiten por el podio 🥃', now_ts - INTERVAL '2 hours'),
(e27, demo_uid, 'Felipe', c_blue, 'Andrés eres el mejor! Tu cata del año pasado me convirtió en fan del ron', now_ts - INTERVAL '1 hour 45 min'),
(e27, demo_uid, 'Nina', c_purple, 'First time at a rum tasting, will it be overwhelming?', now_ts - INTERVAL '1 hour 20 min'),
(e27, demo_uid, 'Andrés', c_red, 'We start light and go deeper. Perfect for beginners! 🙌', now_ts - INTERVAL '1 hour'),
(e27, demo_uid, 'Felipe', c_blue, 'The Canarian rum from Arehucas was the surprise of the night! 🌴', now_ts - INTERVAL '20 min');

-- ============================================================
-- 28. MARIO'S BODEGA — Vino a Granel
-- 12:00 → 17:00 (5h) — bodega cały dzień od południa
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Vino del Barril — Mario''s Bodega',
  'La bodega más auténtica de Puerto. Vino canario directo del barril: tinto listán negro, blanco listán blanco, y el rosado de temporada. 0.80€ la copa. Tapas de siempre: tortilla, jamón, queso. Sin pretensiones, mucha historia.',
  28.4168000, -16.5458000, 'Mario''s Bodega', 'food',
  t12,
  t12 + INTERVAL '5 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e28;

INSERT INTO event_tags (event_id, tag) VALUES (e28,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e28, demo_uid, 'Pepe', c_green, 'Llevo 20 años viniendo aquí. El mejor sitio de Puerto sin duda', now_ts - INTERVAL '1 hour'),
(e28, demo_uid, 'Miriam', c_yellow, '0.80€ la copa en 2026?! Es real esto?', now_ts - INTERVAL '50 min'),
(e28, demo_uid, 'Pepe', c_green, '¡Real como la vida misma! Y el vino no está nada mal', now_ts - INTERVAL '40 min'),
(e28, demo_uid, 'Luca', c_teal, 'Sono italiano e il vino qui mi ricorda la mia cantina di casa 🍷', now_ts - INTERVAL '20 min'),
(e28, demo_uid, 'Miriam', c_yellow, 'Es mi segundo vaso y entiendo perfectamente por qué llevas 20 años viniendo Pepe 😂', now_ts - INTERVAL '5 min');

-- ============================================================
-- 29. RESTAURANTE MUXACHO — Cena en Jardín Tropical
-- 20:00 → 23:00 (3h) — kolacja w ogrodzie tropikalnym
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Cena en el Jardín Tropical — Restaurante Muxacho',
  'Rodeados de naturaleza junto al Jardín Botánico, Muxacho ofrece una cena romántica bajo las estrellas. Cocina canaria de producto: pesca del día, carne de cabra payoya, papas antiguas. La terraza más bonita del norte de Tenerife.',
  28.4125259, -16.5433765, 'Restaurante Muxacho', 'food',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e29;

INSERT INTO event_tags (event_id, tag) VALUES (e29,'food'),(e29,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e29, demo_uid, 'Irene', c_purple, 'La terraza cubierta de buganvillas es de postal 🌸', now_ts - INTERVAL '2 hours'),
(e29, demo_uid, 'Oliver', c_blue, 'Die Cabra payoya war so zart — hätte nie gedacht, dass Ziegenfleisch so delikat sein kann', now_ts - INTERVAL '1 hour 30 min'),
(e29, demo_uid, 'Irene', c_purple, 'Y el postre de mango local con helado de coco... 😭😍', now_ts - INTERVAL '45 min'),
(e29, demo_uid, 'Carmen', c_teal, 'Tenemos reserva para mañana, ahora tenemos más ganas todavía!', now_ts - INTERVAL '15 min');

-- ============================================================
-- 30. COLOUR CAFÉ — Sunday Drag Brunch
-- 12:00 → 15:00 (3h) — drag brunch w południe
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Sunday Drag Brunch — Colour Café',
  'The most fabulous brunch in Puerto! Drag queens hosting, serving, and performing while you eat. Bottomless mimosas, eggs benedict, avocado toast, sweet crêpes. Show every hour on the hour. LGBTQ+ and all allies super welcome! 🌈',
  28.4166000, -16.5504000, 'Colour Café', 'party',
  t12,
  t12 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e30;

INSERT INTO event_tags (event_id, tag) VALUES (e30,'party'),(e30,'art');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e30, demo_uid, 'Destiny Queen', c_pink, 'Good morning gorgeous people! Ready to slay your Sunday? 💅', now_ts - INTERVAL '1 hour 20 min'),
(e30, demo_uid, 'Mark', c_purple, 'First time at a drag brunch, SO excited!', now_ts - INTERVAL '1 hour'),
(e30, demo_uid, 'Destiny Queen', c_pink, 'Get here early hun, it fills up fast 👑', now_ts - INTERVAL '45 min'),
(e30, demo_uid, 'Sophie', c_yellow, 'The bottomless mimosas are dangerously good 😂🍾', now_ts - INTERVAL '20 min'),
(e30, demo_uid, 'Mark', c_purple, 'Show just started!! Destiny is INCREDIBLE 🎤✨', now_ts - INTERVAL '5 min');

-- ============================================================
-- 31. CAFÉ BERLIN — Queer Trivia Night
-- 20:00 → 23:00 (3h) — wieczorny quiz
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Queer Trivia Night — Café Berlín',
  'Monthly LGBTQ+ themed trivia night at Café Berlín. Questions about queer history, pop culture, famous icons, and Tenerife nightlife history. Mixed teams welcome. No prizes, just glory and a round of drinks for the winners.',
  28.4165000, -16.5497000, 'Café Berlin', 'party',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e31;

INSERT INTO event_tags (event_id, tag) VALUES (e31,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e31, demo_uid, 'Chris', c_teal, 'Team ''Sequins & Sangria'' arriving fashionably late 💃', now_ts - INTERVAL '40 min'),
(e31, demo_uid, 'Pat', c_green, 'Ha! We''re team ''Queer as Facts'', prepare to lose 😂', now_ts - INTERVAL '30 min'),
(e31, demo_uid, 'Chris', c_teal, 'Bold words from someone who didn''t know Marsha P. Johnson last month', now_ts - INTERVAL '20 min'),
(e31, demo_uid, 'Lena', c_pink, 'Starting in 10! Host is warming up the crowd 🎙️', now_ts - INTERVAL '10 min');

-- ============================================================
-- 32. RANCHO GRANDE — Sunset Drinks en Paseo San Telmo
-- 18:00 → 21:00 (3h) — zachód słońca na promenadzie
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Atardecer en el Paseo San Telmo — Rancho Grande',
  'Cócteles y pinchos con vistas al malecón y el Atlántico desde el Paseo San Telmo. El spot perfecto para ver el atardecer antes de empezar la noche. Gin-tonics artesanales, vermut de grifo, vistas increíbles.',
  28.4175276, -16.5454148, 'Rancho Grande', 'outdoor',
  t18,
  t18 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e32;

INSERT INTO event_tags (event_id, tag) VALUES (e32,'outdoor'),(e32,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e32, demo_uid, 'Álvaro', c_orange, 'El cielo está de un naranja increíble ahora mismo 🌅', now_ts - INTERVAL '35 min'),
(e32, demo_uid, 'Ingrid', c_blue, 'Cycling past right now, looks amazing! Joining in 5 min 🚴', now_ts - INTERVAL '25 min'),
(e32, demo_uid, 'Álvaro', c_orange, 'El gin con flores de azahar es la especialidad de aquí, pedidlo', now_ts - INTERVAL '15 min'),
(e32, demo_uid, 'Ingrid', c_blue, 'Ordered! Perfect end to a perfect day in Puerto 🌺', now_ts - INTERVAL '5 min');

-- ============================================================
-- 33. AL-AMIR — Noche Árabe con Música
-- 20:00 → 00:00 (4h) — wieczorna noc arabska
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Noche Árabe con Música en Vivo — Al-Amir',
  'Una noche de Medio Oriente en el corazón de La Ranilla. Mezze libanés, shisha opcional, música árabe en vivo. La bailarina Yasmin actúa a las 21:30h. Cocina abierta hasta la medianoche. Balcón con vistas a las calles coloniales.',
  28.4158205, -16.5527428, 'Al-Amir Lebanese Food', 'food',
  t20,
  t20 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e33;

INSERT INTO event_tags (event_id, tag) VALUES (e33,'food'),(e33,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e33, demo_uid, 'Yasmin', c_purple, 'Esta noche el espectáculo será especial ✨', now_ts - INTERVAL '3 hours'),
(e33, demo_uid, 'Karim', c_orange, 'Venimos de Las Palmas solo por esto. Vale la pena el viaje!', now_ts - INTERVAL '2 hours 30 min'),
(e33, demo_uid, 'Sarah', c_pink, 'Is the shisha outdoors on the balcony?', now_ts - INTERVAL '2 hours'),
(e33, demo_uid, 'Al-Amir', c_teal, 'Yes, balcony seating for shisha with views over old town! 🌙', now_ts - INTERVAL '1 hour 45 min'),
(e33, demo_uid, 'Karim', c_orange, 'El hummus aquí es el mejor que he probado fuera de Beirut, sin exagerar', now_ts - INTERVAL '30 min');

-- ============================================================
-- 34. EL LIMÓN — Mercado de Productores Locales
-- 12:00 → 15:00 (3h) — rynek lokalnych produktów
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Mercado de Productores Locales — El Limón',
  'Productores canarios en el patio de El Limón: miel de palma, quesos artesanales del norte, mojos de toda la isla, vinos de pequeños viñedos. Degustación gratuita de todos los productos. Mercado activo de 12h a 15h.',
  28.4161435, -16.5479881, 'El Limón', 'food',
  t12,
  t12 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e34;

INSERT INTO event_tags (event_id, tag) VALUES (e34,'food'),(e34,'outdoor');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e34, demo_uid, 'Rosa María', c_red, 'La miel de palma que traigo de La Gomera hoy es de la última cosecha 🍯', now_ts - INTERVAL '45 min'),
(e34, demo_uid, 'Kees', c_blue, 'We bought the mojo verde last time, best thing we brought back to Holland!', now_ts - INTERVAL '35 min'),
(e34, demo_uid, 'Rosa María', c_red, 'Welcome back! New batch is even better 😊', now_ts - INTERVAL '25 min'),
(e34, demo_uid, 'Patricia', c_teal, 'El queso payoyo con miel de palma para el desayuno... es lo mejor del mundo', now_ts - INTERVAL '10 min');

-- ============================================================
-- 35. PAPA TEIDE — Almuerzo Canario Tradicional
-- 13:00 → 16:00 (3h) — tradycyjny obiad kanaryjski
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Almuerzo Canario de Domingo — Papa Teide',
  'El almuerzo más tradicional de Puerto Viejo. Caldo de papas, puchero canario, ropa vieja, gofio con leche de postre. La abuela de la casa cocina desde las 7am para tener todo listo a las 13h. Menú del día 12€ con postre y bebida.',
  28.4158205, -16.5527428, 'Papa Teide', 'food',
  t13,
  t13 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e35;

INSERT INTO event_tags (event_id, tag) VALUES (e35,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e35, demo_uid, 'Abuela Conso', c_yellow, 'El puchero lleva 4 horas en el fuego, venid pronto que se acaba! 🥘', now_ts - INTERVAL '1 hour'),
(e35, demo_uid, 'Gustavo', c_green, 'El caldo de papas de aquí es lo más reconfortante que conozco', now_ts - INTERVAL '50 min'),
(e35, demo_uid, 'Frieda', c_purple, 'Was ist Gofio? Ich habe es noch nie gegessen', now_ts - INTERVAL '35 min'),
(e35, demo_uid, 'Gustavo', c_green, 'Es harina tostada de cereales! Típica canaria. Aquí lo hacen con leche y miel, perfecto', now_ts - INTERVAL '25 min'),
(e35, demo_uid, 'Frieda', c_purple, 'Habe es gerade probiert — WUNDERBAR! Das muss ich zu Hause nachmachen 😍', now_ts - INTERVAL '5 min');

-- ============================================================
-- 36. LIMBO PUB TERRAZA — Open Mic Night
-- 20:00 → 23:00 (3h) — open mic wieczorny
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Open Mic Night — Limbo Pub Terraza',
  'Noche de micrófono abierto en la terraza del Limbo. Músicos, poetas, cómicos y lo que se te ocurra. 10 minutos por artista, primero en apuntarse primero en actuar. Buen ambiente asegurado y público muy cálido.',
  28.4165800, -16.5502000, 'Limbo Pub Terraza', 'music',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e36;

INSERT INTO event_tags (event_id, tag) VALUES (e36,'music'),(e36,'art');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e36, demo_uid, 'Javi', c_orange, 'Me apunto! Voy a hacer 2 canciones de Silvio Rodríguez con guitarra', now_ts - INTERVAL '2 hours'),
(e36, demo_uid, 'Bea', c_pink, 'Yo llevo un poema que escribí sobre el mar. Nerviosísima!', now_ts - INTERVAL '1 hour 45 min'),
(e36, demo_uid, 'Javi', c_orange, 'Tranquila Bea, el público es muy buena gente aquí', now_ts - INTERVAL '1 hour 30 min'),
(e36, demo_uid, 'Danny', c_blue, 'I''m doing a short stand-up in Spanish... wish me luck! 🎤', now_ts - INTERVAL '1 hour'),
(e36, demo_uid, 'Bea', c_pink, 'El poema fue increíble, la gente aplaudió mucho 😭❤️', now_ts - INTERVAL '15 min');

-- ============================================================
-- 37. CASA MEDITERRÁNEA — Serata Italiana
-- 20:00 → 23:00 (3h) — włoski wieczór
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Serata Italiana — Casa Mediterránea',
  'Una noche de Italia en el corazón de Puerto de la Cruz. Pastas frescas hechas a mano, risotto de mariscos locales, tiramisú casero. El chef Massimo de Nápoles cuenta la historia de cada plato. Vinos italianos de Toscana y Sicilia.',
  28.4164000, -16.5488000, 'Casa Mediterránea', 'food',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e37;

INSERT INTO event_tags (event_id, tag) VALUES (e37,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e37, demo_uid, 'Massimo', c_red, 'Ce ravioli con pesto di pistacchio e gamberi locali... ve li presento stasera! 🇮🇹', now_ts - INTERVAL '3 hours'),
(e37, demo_uid, 'Giulia', c_pink, 'Siamo in vacanza a Tenerife e trovare cucina italiana vera è impossibile — tranne qui!', now_ts - INTERVAL '2 hours 30 min'),
(e37, demo_uid, 'Massimo', c_red, 'Benvenuta Giulia, ti farò sentire a casa 🤌', now_ts - INTERVAL '2 hours'),
(e37, demo_uid, 'Pedro', c_blue, 'El risotto de almejas con vino de Lanzarote 🤯 Massimo eres un genio', now_ts - INTERVAL '30 min'),
(e37, demo_uid, 'Giulia', c_pink, 'Il tiramisù è quello di mia nonna. Complimenti! 👏', now_ts - INTERVAL '10 min');

-- ============================================================
-- 38. GRAMOPHONE BAR — Vinyl Night
-- 20:30 → 00:30 (4h) — wieczór winylowy
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Vinyl Night — The Gramophone Bar',
  'Music lovers unite! Tonight is all vinyl, all night. Guests bring records (or borrow from the bar''s 500+ collection) and take turns playing. 60s soul, 70s funk, 80s new wave, whatever you fancy. The bar''s vintage jukebox takes over at midnight.',
  28.4174000, -16.5438000, 'The Gramophone Bar', 'music',
  t2030,
  t2030 + INTERVAL '4 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e38;

INSERT INTO event_tags (event_id, tag) VALUES (e38,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e38, demo_uid, 'Rex', c_teal, 'Bringing my Stevie Wonder ''Innervisions'' original pressing tonight 💿', now_ts - INTERVAL '2 hours'),
(e38, demo_uid, 'Caitlin', c_yellow, 'Oh nice! I''ll bring the Fleetwood Mac Rumours I found at the market yesterday', now_ts - INTERVAL '1 hour 45 min'),
(e38, demo_uid, 'Rex', c_teal, 'Excellent taste! See you there', now_ts - INTERVAL '1 hour 30 min'),
(e38, demo_uid, 'Miguel', c_orange, 'El dueño tiene un Coltrane A Love Supreme original, es una joya', now_ts - INTERVAL '45 min'),
(e38, demo_uid, 'Caitlin', c_yellow, 'Rumours playing right now and the bar is dancing 😭🎵', now_ts - INTERVAL '10 min');

-- ============================================================
-- 39. EL TEMPLO DE VINO — Cata por Copa
-- 19:00 → 22:00 (3h) — degustacja wina w La Ranilla
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Cata Privada por Copa — El Templo del Vino',
  'En La Ranilla, el templo del vino ofrece su selección premium por copas. Esta noche: 3 vinos de Tenerife (Valle de Orotava, Tacoronte-Acentejo, Güímar) y 2 sorpresas de la bodega. El bodeguero cuenta la historia de cada vino.',
  28.4170207, -16.5531701, 'El Templo de Vino', 'food',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e39;

INSERT INTO event_tags (event_id, tag) VALUES (e39,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e39, demo_uid, 'Bodeguero', c_red, 'La sorpresa de esta noche: un Vijariego Negro del 2018 que me guardé para la ocasión 🍷', now_ts - INTERVAL '1 hour'),
(e39, demo_uid, 'Silvia', c_purple, 'Vijariego Negro es rarísimo! Cuántas botellas tienes?', now_ts - INTERVAL '50 min'),
(e39, demo_uid, 'Bodeguero', c_red, 'Solo 6 botellas, así que para los que vengáis hoy 😊', now_ts - INTERVAL '40 min'),
(e39, demo_uid, 'Silvia', c_purple, 'Vamos corriendo!! Avisando al grupo de Whatsapp ahora mismo', now_ts - INTERVAL '30 min');

-- ============================================================
-- 40. BAR OREGÓN — Partido de Champions
-- 20:00 → 23:00 (3h) — mecz piłkarski wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Champions League en Pantalla Grande — Bar Oregón',
  'Vemos el partido de Champions en el mejor bar de fútbol del barrio de pescadores. Pantalla gigante, sonido, ambiente de grada. Cañas a 1.5€ durante el partido, raciones de pulpo y papas para picar.',
  28.4171196, -16.5563038, 'Bar Restaurant Oregón', 'party',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e40;

INSERT INTO event_tags (event_id, tag) VALUES (e40,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e40, demo_uid, 'Raúl', c_red, 'Ya estoy aquí guardando sitios, llegad pronto!', now_ts - INTERVAL '45 min'),
(e40, demo_uid, 'Santi', c_orange, 'Voy con 3 más, guardadnos 4 sillas', now_ts - INTERVAL '38 min'),
(e40, demo_uid, 'Raúl', c_red, 'Está llenísimo pero voy pudiendo 😅', now_ts - INTERVAL '25 min'),
(e40, demo_uid, 'Dani', c_blue, 'GOOOOOL!! 😱🔥🔥', now_ts - INTERVAL '10 min'),
(e40, demo_uid, 'Santi', c_orange, 'QUÉ GOLAZO!! Todo el bar se levantó 😭⚽', now_ts - INTERVAL '8 min'),
(e40, demo_uid, 'Raúl', c_red, 'Alguien para el siguiente? Cañas gratis si marcamos otro 🍺', now_ts - INTERVAL '2 min');

-- ============================================================
-- 41. BAR DINÁMICO — Lotería y Café
-- 21:00 → 23:00 (2h) — losowanie loterii wieczorem
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Sorteo de Lotería en Directo — Bar Dinámico',
  'Seguimos el sorteo de la Bonoloto en el bar más castizo de la Plaza del Charco. Café con leche, media tostada con aceite y tomate, y a ver si hoy toca. Los boletos los vende el propio bar.',
  28.4165259, -16.5507000, 'Bar Dinámico', 'party',
  t21,
  t21 + INTERVAL '2 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e41;

INSERT INTO event_tags (event_id, tag) VALUES (e41,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e41, demo_uid, 'Don Paco', c_green, 'Mi quinto año apostando aquí. Hoy presiento que es el día 😄', now_ts - INTERVAL '30 min'),
(e41, demo_uid, 'Conchi', c_yellow, 'Eso dices todos los martes Paco! Pero seguimos viniendo por el café', now_ts - INTERVAL '20 min'),
(e41, demo_uid, 'Don Paco', c_green, '¡Este año sí! Y si toca, invito a todos en el bar', now_ts - INTERVAL '10 min'),
(e41, demo_uid, 'Conchi', c_yellow, 'Con ese café con leche y la tostada ya hemos ganado algo 😂', now_ts - INTERVAL '3 min');

-- ============================================================
-- 42. CAFÉ DE LA NOCHE — After Work
-- 19:00 → 22:00 (3h) — after work gin-tonic
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'After Work: Gin Tónica en la Avenida — Café de la Noche',
  'El after work más relajado de Puerto de la Cruz. Gin-tonics con botánicos de Tenerife (laurisilva, hierbas del Teide), vermut artesanal, conversación. La Avenida de Colón al fresco. De 19 a 22h.',
  28.4185000, -16.5442000, 'Café de la Noche', 'party',
  t19,
  t19 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e42;

INSERT INTO event_tags (event_id, tag) VALUES (e42,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e42, demo_uid, 'Verónica', c_teal, 'Por fin acabó la semana. Me voy directa desde el trabajo 🎉', now_ts - INTERVAL '40 min'),
(e42, demo_uid, 'Borja', c_blue, 'Te espero en la terraza, ya he pedido el primero', now_ts - INTERVAL '32 min'),
(e42, demo_uid, 'Verónica', c_teal, 'Llegas 10 min! Pide el gin de botánicos del Teide, está espectacular', now_ts - INTERVAL '20 min'),
(e42, demo_uid, 'Celia', c_pink, 'Me uno! Vengo de la playa todavía con arena en los pies 😅', now_ts - INTERVAL '10 min'),
(e42, demo_uid, 'Borja', c_blue, 'Perfecto el plan. Brindamos! 🥂', now_ts - INTERVAL '2 min');

-- ============================================================
-- 43. CASA PACHE — Cocina Canaria Casera
-- 13:30 → 16:30 (3h) — domowy obiad
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Almuerzo en Casa: Cocina Canaria Casera — Casa Pache',
  'La cocina más honesta de La Ranilla. Pache lleva 30 años cocinando para el barrio. Potaje de berros, costillas de cerdo con papas arrugadas, bizcocho de almendra de postre. Menú a 10€. Sin carta, lo que haya es lo mejor.',
  28.4164525, -16.5524743, 'Casa Pache', 'food',
  t1330,
  t1330 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e43;

INSERT INTO event_tags (event_id, tag) VALUES (e43,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e43, demo_uid, 'Pache', c_orange, 'El potaje de berros lleva verduras de un huerto de La Orotava. Venid! 🥬', now_ts - INTERVAL '2 hours'),
(e43, demo_uid, 'Tomás', c_green, 'Llevamos 5 años viniendo todos los domingos. Es nuestra tradición familiar 🙏', now_ts - INTERVAL '1 hour 30 min'),
(e43, demo_uid, 'Laura', c_yellow, 'Es la primera vez y estoy flipando con el potaje 😍', now_ts - INTERVAL '30 min'),
(e43, demo_uid, 'Tomás', c_green, 'Bienvenida al club! Ya no podrás dejar de venir', now_ts - INTERVAL '15 min');

-- ============================================================
-- 44. EL PADRINO — Pescado del Día a la Brasa
-- 13:00 → 16:00 (3h) — grillowana ryba w południe
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Pescado del Día a la Brasa — El Padrino',
  'El cocinero más directo de La Ranilla. Sin florituras. Pescado fresco de esta mañana, a la brasa con mojo verde o rojo, papas arrugadas y pimiento frito. Precio del día según lo que trajo la barca. Preguntar al llegar.',
  28.4170754, -16.5527116, 'El Padrino', 'food',
  t13,
  t13 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e44;

INSERT INTO event_tags (event_id, tag) VALUES (e44,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e44, demo_uid, 'Padrino', c_red, 'Hoy hay sama roja grande. 16€/kg a la brasa. Queda para 8 personas', now_ts - INTERVAL '1 hour'),
(e44, demo_uid, 'Enrique', c_blue, 'Vamos para allá! La sama a la brasa aquí es la mejor de todo Puerto', now_ts - INTERVAL '50 min'),
(e44, demo_uid, 'Wendy', c_pink, 'What''s sama? Can I have it without mojo?', now_ts - INTERVAL '35 min'),
(e44, demo_uid, 'Padrino', c_red, 'Sama = red snapper! You can have it plain, very fresh 🐟', now_ts - INTERVAL '25 min'),
(e44, demo_uid, 'Enrique', c_blue, 'La sama estaba perfecta. Padrino eres el mejor maestro de brasa de Tenerife 🔥', now_ts - INTERVAL '10 min');

-- ============================================================
-- 45. LA COCINA — Pop-Up Chef Night
-- 20:30 → 23:30 (3h) — pop-up kolacja późna
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Pop-Up: Chef Invitado de Noche — La Cocina La Ranilla',
  'La Cocina abre sus puertas a la chef invitada Amara Díaz (ex Mugaritz) para una noche única. Menú de 6 platos basado en producto canario con técnicas vanguardistas. Solo 16 comensales. Precio 65€ sin bebidas.',
  28.4163251, -16.5524100, 'Restaurant La Cocina', 'food',
  t2030,
  t2030 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e45;

INSERT INTO event_tags (event_id, tag) VALUES (e45,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e45, demo_uid, 'Amara D.', c_purple, 'Muy emocionada de cocinar en La Ranilla esta noche. Los productos que he elegido esta mañana en el mercado son increíbles 🌿', now_ts - INTERVAL '5 hours'),
(e45, demo_uid, 'Félix', c_teal, 'Tenemos reserva! Chef Amara es una genia, hemos seguido su carrera años', now_ts - INTERVAL '4 hours'),
(e45, demo_uid, 'Amara D.', c_purple, 'Gracias Félix! Preparaos para un viaje culinario por las islas 🌊', now_ts - INTERVAL '3 hours'),
(e45, demo_uid, 'Rebeca', c_yellow, 'Hay alguna cancelación? Intenté reservar y estaba lleno 😢', now_ts - INTERVAL '1 hour'),
(e45, demo_uid, 'Amara D.', c_purple, 'Rebeca, escríbeme por privado, acaba de cancelar una pareja 🤞', now_ts - INTERVAL '45 min');

-- ============================================================
-- 46. PEZ GORDO — Mariscos del Atlántico
-- 20:00 → 23:00 (3h) — kolacja owoce morza
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Mariscos del Atlántico Norte — Pez Gordo',
  'Noche de mariscos: langostinos frescos, gambas de Huelva, almejas de la bahía, pulpo de roca gallego. Todo cocinado al momento. Vinos blancos atlánticos de Rías Baixas y Tenerife costa. Mesa comunitaria disponible para solitarios.',
  28.4155420, -16.5501600, 'Pez Gordo', 'food',
  t20,
  t20 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e46;

INSERT INTO event_tags (event_id, tag) VALUES (e46,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e46, demo_uid, 'Chef Raúl', c_orange, 'Los langostinos de hoy son tan frescos que casi saltan solos 🦐', now_ts - INTERVAL '3 hours'),
(e46, demo_uid, 'Beatriz', c_pink, 'Vengo sola, funciona la mesa comunitaria?', now_ts - INTERVAL '2 hours 30 min'),
(e46, demo_uid, 'Chef Raúl', c_orange, 'Claro! Mesa de 8 y hay 5 plazas. Genial para conocer gente 😊', now_ts - INTERVAL '2 hours'),
(e46, demo_uid, 'Beatriz', c_pink, 'Acabo de conocer a una familia noruega y un matrimonio alemán en la mesa. Mejor decisión del viaje! 😄', now_ts - INTERVAL '1 hour');

-- ============================================================
-- 47. ALBERTO'S BAR — Fútbol CD Tenerife
-- 20:30 → 23:00 (2.5h) — mecz piłkarski
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Partido CD Tenerife en Alberto''s Bar',
  'Vemos el CD Tenerife de local en el bar más local del barrio. Sin postureos, sin turistas, puro fútbol canario. Cerveza Dorada (la cerveza de las islas) a 1.20€. Si gana el Tenerife, ronda de chupitos de ron para todos.',
  28.4160000, -16.5440000, 'Alberto''s Bar', 'party',
  t2030,
  t2030 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e47;

INSERT INTO event_tags (event_id, tag) VALUES (e47,'party');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e47, demo_uid, 'Chema', c_red, 'Hoy ganamos seguro. El equipo está en racha 💪', now_ts - INTERVAL '1 hour 20 min'),
(e47, demo_uid, 'Curro', c_blue, 'Eso dijiste el último partido... y ya sabemos cómo acabó 😂', now_ts - INTERVAL '1 hour'),
(e47, demo_uid, 'Chema', c_red, 'Este es diferente! El Chipi está en forma', now_ts - INTERVAL '45 min'),
(e47, demo_uid, 'Alberto', c_orange, 'GOOOOOL DEL TENERIFE!! 1-0!! Ronda de chupitos ya en preparación 🥃🎉', now_ts - INTERVAL '15 min'),
(e47, demo_uid, 'Curro', c_blue, 'VAMOOOOS!! Te debo unas disculpas Chema 😂⚽', now_ts - INTERVAL '12 min');

-- ============================================================
-- 48. LOS PARAGÜITAS — BBQ en Playa Jardín
-- 13:00 → 18:00 (5h) — BBQ cały popołudniowy dzień
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'BBQ & Chill en Playa Jardín — Los Paragüitas',
  'Barbacoa de pescado y carne en la terraza de Los Paragüitas con las olas de Playa Jardín como banda sonora. Dorada a la brasa, costillas, pinchos de pollo adobado. Música reggae y bossa nova en vivo desde las 14h. Sin reserva.',
  28.4113736, -16.5612088, 'Los Paragüitas', 'outdoor',
  t13,
  t13 + INTERVAL '5 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e48;

INSERT INTO event_tags (event_id, tag) VALUES (e48,'outdoor'),(e48,'food'),(e48,'music');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e48, demo_uid, 'Nacho', c_green, 'La dorada a la brasa está crispy por fuera y jugosa por dentro. Perfección 🐟🔥', now_ts - INTERVAL '1 hour'),
(e48, demo_uid, 'Mara', c_teal, 'El reggae en vivo con las olas de fondo es la cosa más relajante del mundo 🌊🎸', now_ts - INTERVAL '45 min'),
(e48, demo_uid, 'Pete', c_blue, 'Coming from the hotel, is Playa Jardín walkable from the centre?', now_ts - INTERVAL '35 min'),
(e48, demo_uid, 'Nacho', c_green, '10 min walk, very easy and beautiful. Worth it! 🏖️', now_ts - INTERVAL '28 min'),
(e48, demo_uid, 'Mara', c_teal, 'El guitarrista acaba de tocar No Woman No Cry en la brisa del mar. Me voy a quedar aquí toda la vida 🙏', now_ts - INTERVAL '10 min');

-- ============================================================
-- 49. LA VENTITA — Vino y Conversación
-- 18:00 → 21:00 (3h) — kieliszek wina o zmierzchu
-- ============================================================
INSERT INTO events (title, description, lat, lng, place_name, category, start_time, end_time, creator_id, status, photos, is_private)
VALUES (
  'Un Vino y Buena Conversación — La Ventita',
  'El bar más pequeño y más bonito de Puerto de la Cruz. Una ventana literalmente en la pared, dos barras, vino canario por copas. La propietaria Elena lleva 25 años sirviendo a los vecinos. Sin música, sin pantallas. Solo hablar.',
  28.4167000, -16.5475000, 'La Ventita', 'food',
  t18,
  t18 + INTERVAL '3 hours',
  demo_uid, 'live', '{}', false
) RETURNING id INTO e49;

INSERT INTO event_tags (event_id, tag) VALUES (e49,'food');

INSERT INTO event_messages (event_id, author_id, author_name, author_color, text, created_at) VALUES
(e49, demo_uid, 'Elena', c_yellow, 'Hoy tengo un vino nuevo de un amigo de La Orotava. Solo 12 botellas. Venid a probar 🍷', now_ts - INTERVAL '2 hours'),
(e49, demo_uid, 'Vicente', c_green, 'Elena, llevo 15 años viniendo. Siempre sorprendes', now_ts - INTERVAL '1 hour 45 min'),
(e49, demo_uid, 'Silke', c_purple, 'Habe Puerto de la Cruz schon 8 Mal besucht und das hier ist mein Lieblingsort 🥹', now_ts - INTERVAL '1 hour'),
(e49, demo_uid, 'Elena', c_yellow, 'Gracias Silke! Siempre un placer verte por aquí ❤️', now_ts - INTERVAL '45 min'),
(e49, demo_uid, 'Vicente', c_green, 'Este es el vino más honesto que he probado en años. Sin marketing, sin ruido. Perfecto.', now_ts - INTERVAL '15 min');

-- ============================================================
-- RESUMEN GODZIN
-- 12:00 → Café Paris Brunch, Cofradía Pescado, Mario's Bodega, Colour Café, El Limón Mercado
-- 13:00 → Ihuey Tapas, Bambú Beach, La Casona, El Padrino, Papa Teide, Los Paragüitas
-- 13:30 → Casa Pache
-- 17:30 → Andana Sunset
-- 18:00 → Olea Happy Hour, Rancho Grande, La Ventita
-- 18:30 → Pequeña Buda, La Maison Belge
-- 19:00 → Ébano Vernissage, Vinoteca, Bee Hive Quiz, Agora Tertulia, Las Tejas Verdes, El Templo, Café de la Noche
-- 19:30 → Tasca El Olivo, Habasko Ron
-- 20:00 → Molly Malone, Casino Taoro, Abaco, Maga, Broma Latina, Al-Amir, Bar Oregón, Café Berlín, Brunelli's, Muxacho, Casa Mediterránea, Pez Gordo
-- 20:30 → Régulo, El Taller Seve, Gramophone, La Cocina, Alberto's Bar
-- 21:00 → Blanco Bar, Azúcar, Vampis, Bar Dinámico
-- ============================================================
RAISE NOTICE '✅ Seed completado: 49 eventos con godziny realistyczne, tags i wiadomości czat';
RAISE NOTICE '📍 Todos los eventos están en Puerto de la Cruz, Tenerife';
RAISE NOTICE '🎉 Listo para la demo!';

END $$;
