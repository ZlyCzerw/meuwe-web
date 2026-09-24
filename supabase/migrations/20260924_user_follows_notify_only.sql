-- Obserwowanie twórcy = powiadomienia o jego wydarzeniach, nie deklaracja
-- udziału.
--
-- 20260903_user_follows dopisywał obserwujących twórcy do event_follows jego
-- publicznych wydarzeń (bieżących przy zaobserwowaniu, każdego nowego przy
-- dodaniu). event_follows to jednak "wezmę udział": obserwujący twórcy stawali
-- się uczestnikami wszystkich jego wydarzeń - w pasku awatarów, liście
-- uczestników i w powiadomieniach o czacie i zmianach.
--
-- Teraz powiadomienia o nowym wydarzeniu i o jego starcie czytają user_follows
-- wprost (edge functions push-new-event i push-event-start). Wdroż je PRZED
-- tą migracją: w odwrotnej kolejności nowe wydarzenia dodane w międzyczasie
-- nie dotrą do obserwujących twórcy, a w tej najwyżej trafią do tego samego
-- zbioru odbiorców dwiema drogami.
--
-- Wcześniej dopisane wiersze zostają: nie da się odróżnić automatycznych od
-- kliknięcia "Wezmę udział", a wygasną z końcem wydarzeń.
--
-- Uruchom ręcznie w Supabase Dashboard → SQL Editor (najpierw staging).
-- Idempotentna: można puścić drugi raz bez szkody.

drop trigger if exists user_follows_follow_current on public.user_follows;
drop function if exists public.follow_creator_current_events();

drop trigger if exists events_follow_for_creator_followers on public.events;
drop function if exists public.follow_new_event_for_creator_followers();
