-- Bryce Mountain Getaways — guest list, message log, and a locked-down signup table.
-- Run once in the Supabase SQL editor. Safe to re-run.

------------------------------------------------------------------ guests
create table if not exists guests (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  email           text not null,
  name            text,
  phone           text,
  source          text not null default 'manual',   -- 'discount' | 'booking' | 'manual'
  discount_code   text,
  stays           jsonb not null default '[]',      -- [{home, check_in, check_out}]
  tags            text[] not null default '{}',
  notes           text,
  subscribed      boolean not null default true,
  unsubscribed_at timestamptz,
  unsub_token     uuid not null default gen_random_uuid()
);
create unique index if not exists guests_email_key on guests (lower(email));
alter table guests enable row level security;
drop policy if exists "owners manage guests" on guests;
create policy "owners manage guests" on guests for all to authenticated using (true) with check (true);

------------------------------------------------------------ message log
create table if not exists guest_messages (
  id        bigint generated always as identity primary key,
  sent_at   timestamptz not null default now(),
  guest_id  bigint references guests(id) on delete set null,
  email     text not null,
  subject   text not null,
  body      text not null,
  status    text not null default 'sent',            -- 'sent' | 'failed'
  error     text,
  batch     text                                      -- groups one send-out together
);
alter table guest_messages enable row level security;
drop policy if exists "owners manage messages" on guest_messages;
create policy "owners manage messages" on guest_messages for all to authenticated using (true) with check (true);

------------------------------------- every discount signup becomes a guest
create or replace function copy_signup_to_guests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into guests (email, name, source, discount_code, created_at)
  values (new.email, new.name, 'discount', new.code, coalesce(new.created_at, now()))
  on conflict (lower(email)) do update
    set discount_code = coalesce(guests.discount_code, excluded.discount_code),
        name          = coalesce(guests.name, excluded.name);
  return new;
end $$;
drop trigger if exists discount_signup_to_guest on discount_signups;
create trigger discount_signup_to_guest after insert on discount_signups
  for each row execute function copy_signup_to_guests();

-- Backfill the signups you already have.
insert into guests (email, name, source, discount_code, created_at)
select distinct on (lower(email)) email, name, 'discount', code, coalesce(created_at, now())
from discount_signups
order by lower(email), created_at
on conflict (lower(email)) do nothing;

------------------------- lock down discount_signups (it was world-readable)
-- The old policies let anyone with the public key list every e-mail address and
-- edit any row. Replace them with owner-only reads and two narrow functions.
drop policy if exists "anon can look up" on discount_signups;
drop policy if exists "anon can redeem"  on discount_signups;
drop policy if exists "owners read signups" on discount_signups;
create policy "owners read signups" on discount_signups for select to authenticated using (true);

create or replace function lookup_discount(p_code text)
returns table (email text, name text, code text, status text)
language sql security definer set search_path = public as $$
  select email, name, code, status from discount_signups where code = p_code limit 1;
$$;

create or replace function redeem_discount(p_code text) returns void
language sql security definer set search_path = public as $$
  update discount_signups set status = 'redeemed', redeemed_at = now()
  where code = p_code and status <> 'redeemed';
$$;

create or replace function unsubscribe_guest(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update guests set subscribed = false, unsubscribed_at = now()
  where unsub_token = p_token and subscribed;
  return exists (select 1 from guests where unsub_token = p_token);
end $$;

grant execute on function lookup_discount(text)  to anon;
grant execute on function redeem_discount(text)  to anon;
grant execute on function unsubscribe_guest(uuid) to anon;
