-- Early Access invites & orders: single source of truth shared by 75golf.com and the Inside 75 tablet app.
-- Run in Supabase SQL Editor for project fmyjsfixxmobdrhefuzl (Inside 75).

create table if not exists public.early_access_invites (
  code text primary key,
  kind text not null default 'member' check (kind in ('founder', 'member')),
  owner_email text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  order_ref text,
  max_uses integer not null default 1 check (max_uses >= 1),
  uses_count integer not null default 0 check (uses_count >= 0),
  claimed_by_email text,
  claimed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ea_invites_owner_email
  on public.early_access_invites (lower(owner_email));
create index if not exists idx_ea_invites_owner_user_id
  on public.early_access_invites (owner_user_id)
  where owner_user_id is not null;
create index if not exists idx_ea_invites_order_ref
  on public.early_access_invites (order_ref)
  where order_ref is not null;

create table if not exists public.early_access_orders (
  order_ref text primary key,
  buyer_email text not null,
  used_code text not null references public.early_access_invites(code),
  kit_summary text not null default '',
  shipping_state text not null default '',
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'shipped', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ea_orders_buyer_email
  on public.early_access_orders (lower(buyer_email));
create index if not exists idx_ea_orders_used_code
  on public.early_access_orders (used_code);

alter table public.early_access_invites enable row level security;
alter table public.early_access_orders enable row level security;

revoke all on public.early_access_invites from anon, authenticated;
revoke all on public.early_access_orders from anon, authenticated;
grant select on public.early_access_invites to authenticated;
grant select on public.early_access_orders to authenticated;

drop policy if exists "ea_invites_owner_select" on public.early_access_invites;
create policy "ea_invites_owner_select"
  on public.early_access_invites
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "ea_orders_buyer_select" on public.early_access_orders;
create policy "ea_orders_buyer_select"
  on public.early_access_orders
  for select
  to authenticated
  using (lower(buyer_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

-- Seed founder codes (multi-use)
insert into public.early_access_invites (code, kind, owner_email, max_uses)
values
  ('TYLER', 'founder', 'hello@75golf.com', 9999),
  ('OHIO75', 'founder', 'hello@75golf.com', 9999),
  ('SCRATCH', 'founder', 'hello@75golf.com', 9999),
  ('EARLY75', 'founder', 'hello@75golf.com', 9999)
on conflict (code) do nothing;

-- 1) Public code verifier (returns zero PII)
create or replace function public.verify_early_access_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g'));
  v_row record;
begin
  if v_clean = '' then
    return jsonb_build_object('valid', false);
  end if;

  select code, kind, max_uses, uses_count
    into v_row
    from public.early_access_invites
   where code = v_clean
     and active = true
     and uses_count < max_uses;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', v_row.code,
    'kind', v_row.kind,
    'remaining', v_row.max_uses - v_row.uses_count
  );
end;
$$;

revoke all on function public.verify_early_access_code(text) from public;
grant execute on function public.verify_early_access_code(text) to anon, authenticated;

-- 2) Atomic order completion: claims single-use member code and mints 5 new 75-XXXXXX codes tied to buyer_email
create or replace function public.complete_early_access_order(
  p_used_code text,
  p_buyer_email text,
  p_order_ref text,
  p_kit_summary text default '',
  p_shipping_state text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_used_code, ''), '[^A-Za-z0-9-]', '', 'g'));
  v_email text := lower(trim(coalesce(p_buyer_email, '')));
  v_ref text := upper(trim(coalesce(p_order_ref, '')));
  v_existing text[];
  v_invite record;
  v_codes text[] := array[]::text[];
  v_cand text;
  v_tries int;
begin
  if v_email = '' or position('@' in v_email) = 0 or v_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  if exists (select 1 from public.early_access_orders where order_ref = v_ref) then
    select coalesce(array_agg(code order by created_at, code), array[]::text[])
      into v_existing
      from public.early_access_invites
     where order_ref = v_ref;
    return jsonb_build_object('ok', true, 'order_ref', v_ref, 'codes', to_jsonb(v_existing));
  end if;

  select code, kind, max_uses, uses_count
    into v_invite
    from public.early_access_invites
   where code = v_code
     and active = true
     and uses_count < max_uses
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_used_code');
  end if;

  update public.early_access_invites
     set uses_count = uses_count + 1,
         claimed_by_email = case when kind = 'member' then v_email else claimed_by_email end,
         claimed_at = case when kind = 'member' then now() else claimed_at end
   where code = v_invite.code;

  insert into public.early_access_orders (order_ref, buyer_email, used_code, kit_summary, shipping_state)
  values (v_ref, v_email, v_invite.code, left(coalesce(p_kit_summary, ''), 120), left(upper(trim(coalesce(p_shipping_state, ''))), 24));

  for i in 1..5 loop
    v_tries := 0;
    loop
      v_tries := v_tries + 1;
      v_cand := '75-' || lpad((floor(random() * 900000)::int + 100000)::text, 6, '0');
      begin
        insert into public.early_access_invites (code, kind, owner_email, order_ref, max_uses)
        values (v_cand, 'member', v_email, v_ref, 1);
        v_codes := array_append(v_codes, v_cand);
        exit;
      exception when unique_violation then
        if v_tries > 20 then
          raise;
        end if;
      end;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'order_ref', v_ref, 'codes', to_jsonb(v_codes));
end;
$$;

revoke all on function public.complete_early_access_order(text, text, text, text, text) from public;
grant execute on function public.complete_early_access_order(text, text, text, text, text) to anon, authenticated;

-- 3) Authenticated tablet app RPC: links buyer's order email to auth.uid() and returns their 5 shareable Early Access links
create or replace function public.my_early_access_invites()
returns table (
  code text,
  share_url text,
  claimed boolean,
  claimed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if v_uid is null then
    return;
  end if;

  if v_email <> '' then
    update public.early_access_invites
       set owner_user_id = v_uid
     where lower(owner_email) = v_email
       and owner_user_id is null
       and kind = 'member';
  end if;

  return query
  select
    e.code,
    'https://75golf.com/?invite=' || e.code as share_url,
    (e.uses_count >= e.max_uses) as claimed,
    e.claimed_at,
    e.created_at
  from public.early_access_invites e
  where e.owner_user_id = v_uid
    and e.kind = 'member'
    and e.active = true
  order by e.created_at asc, e.code asc;
end;
$$;

revoke all on function public.my_early_access_invites() from public;
grant execute on function public.my_early_access_invites() to authenticated;
