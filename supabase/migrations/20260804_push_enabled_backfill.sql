-- Backfill profiles.push_enabled for everyone who already holds a delivery address.
--
-- Run manually in Supabase Dashboard → SQL Editor: the migration history table
-- is empty on PROD and filenames collide, so `supabase db push` is not safe here.
-- STAGING FIRST, then PROD, and only after the four push functions are deployed.
--
-- Why this is needed at all
-- ------------------------
-- push_enabled has DEFAULT false (20260528_push_enabled.sql) and the signup
-- trigger never sets it. Until now push-new-event and push-event-start ignored
-- the flag, so anyone with a token got notified about new events regardless.
-- Once those two go through the same gate as the rest, that whole group falls
-- silent — this restores them to the state they were effectively already in.
--
-- What it is honest to say about consent
-- --------------------------------------
-- Web subscriptions and iOS tokens exist only because someone answered a system
-- prompt. Android 12 and below had no POST_NOTIFICATIONS permission, so there
-- ensurePushRegistered could register a token without anyone being asked, and
-- push_devices records no OS version to tell those apart from Android 13+. The
-- broad backfill was chosen deliberately: it matches what those users receive
-- today, and the profile panel turns it back off in one tap.

-- Look before you write.
select count(*) filter (where push_enabled is true)              as already_on,
       count(*) filter (where push_enabled is not true)          as currently_off,
       count(*) filter (
         where push_enabled is not true
           and (exists (select 1 from push_devices d where d.user_id = p.id)
             or exists (select 1 from push_subscriptions s where s.user_id = p.id))
       )                                                          as will_be_turned_on
  from profiles p;

update profiles p set push_enabled = true
where p.push_enabled is not true
  and (exists (select 1 from push_devices d where d.user_id = p.id)
    or exists (select 1 from push_subscriptions s where s.user_id = p.id));

-- After: nobody holding a delivery address should be left off.
select count(*) as still_off_with_a_device
  from profiles p
 where p.push_enabled is not true
   and (exists (select 1 from push_devices d where d.user_id = p.id)
     or exists (select 1 from push_subscriptions s where s.user_id = p.id));
