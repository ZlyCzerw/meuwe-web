-- Pin exclusivity zone: every PUBLIC event owns a 3x3 m square for its duration.
-- Two public events collide when their squares overlap (centres < 3 m on each
-- axis) AND their time windows overlap. Enforced atomically by a BEFORE trigger
-- (SQLSTATE MW001 on collision); a public RPC exposes the same check so the
-- client can pre-check before doing expensive work (photo upload).

-- Shared rule: returns the id of a conflicting public, non-self event (or NULL).
create or replace function _event_zone_conflict(
  p_lat double precision,
  p_lng double precision,
  p_start timestamptz,
  p_end   timestamptz,
  p_exclude_id uuid
) returns uuid
language sql stable as $$
  select e.id
  from events e
  where e.is_private = false
    and (p_exclude_id is null or e.id <> p_exclude_id)
    -- temporal overlap (strict: touching endpoints allowed)
    and p_start < e.end_time
    and e.start_time < p_end
    -- spatial overlap of the two 3x3 m squares (centres < 3 m on each axis)
    and abs((p_lat - e.lat) * 111320) < 3
    and abs((p_lng - e.lng) * 111320 * cos(radians(p_lat))) < 3
  limit 1
$$;

-- Trigger: the atomic guard. Skips private rows and skips writes that do not
-- touch any zone-relevant column (so status/title/photo edits never trip it).
create or replace function events_zone_guard() returns trigger
language plpgsql as $$
begin
  if NEW.is_private then
    return NEW;
  end if;
  if TG_OP = 'UPDATE'
     and NEW.lat = OLD.lat and NEW.lng = OLD.lng
     and NEW.start_time = OLD.start_time and NEW.end_time = OLD.end_time
     and NEW.is_private = OLD.is_private then
    return NEW;
  end if;
  if _event_zone_conflict(NEW.lat, NEW.lng, NEW.start_time, NEW.end_time, NEW.id) is not null then
    raise exception 'zone occupied' using errcode = 'MW001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_events_zone_guard on events;
create trigger trg_events_zone_guard
  before insert or update on events
  for each row execute function events_zone_guard();

-- Public wrapper for the client pre-check.
create or replace function event_zone_conflict(
  p_lat double precision,
  p_lng double precision,
  p_start timestamptz,
  p_end   timestamptz,
  p_exclude_id uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select _event_zone_conflict(p_lat, p_lng, p_start, p_end, p_exclude_id) is not null
$$;

grant execute on function event_zone_conflict(
  double precision, double precision, timestamptz, timestamptz, uuid
) to anon, authenticated;
