-- Harvest Renovation Portal Pro: Supabase schema + approval workflow
-- Run this in the Supabase SQL editor before deploying the portal.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'staff' check (role in ('admin','staff')),
  status text not null default 'pending' check (status in ('pending','active','denied')),
  google_calendar_embed_url text,
  calendar_label text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
add column if not exists phone text;

create table if not exists public.portal_settings (
  id integer primary key,
  company_calendar_name text not null default 'Harvest Renovation Company Calendar',
  company_calendar_embed_url text,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.portal_settings (id, company_calendar_name, company_calendar_embed_url)
values (1, 'Harvest Renovation Company Calendar', null)
on conflict (id) do nothing;

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace trigger profiles_set_timestamp
before update on public.profiles
for each row
execute function public.set_timestamp();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(new.email);
  assigned_role text := 'staff';
  assigned_status text := 'pending';
  assigned_name text := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
begin
  if normalized_email = 'contactmpuentes@gmail.com' then
    assigned_role := 'admin';
    assigned_status := 'active';
    assigned_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Madelyn Puentes');
  elsif normalized_email = 'jpuentes1992@gmail.com' then
    assigned_role := 'staff';
    assigned_status := 'active';
    assigned_name := coalesce(new.raw_user_meta_data ->> 'full_name', 'Juan Puentes');
  end if;

  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, assigned_name, assigned_role, assigned_status)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = excluded.role,
        status = excluded.status;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.portal_settings enable row level security;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

create policy "profiles_select_self_or_active_team"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or (
    public.is_active_user()
    and status = 'active'
  )
);

create policy "portal_settings_read_active_users"
on public.portal_settings
for select
to authenticated
using (public.is_active_user());

create or replace function public.update_my_profile(
  p_full_name text,
  p_google_calendar_embed_url text,
  p_calendar_label text,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  update public.profiles
  set full_name = nullif(trim(p_full_name), ''),
      phone = nullif(trim(p_phone), ''),
      google_calendar_embed_url = nullif(trim(p_google_calendar_embed_url), ''),
      calendar_label = nullif(trim(p_calendar_label), '')
  where id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found for current user';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.list_pending_profiles()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.role, p.status, p.created_at
  from public.profiles p
  where p.status = 'pending'
    and public.is_admin_user()
  order by p.created_at asc;
$$;

create or replace function public.review_user_request(
  p_user_id uuid,
  p_decision text,
  p_role text default 'staff'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed public.profiles;
  new_status text;
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can review user requests';
  end if;

  if p_decision not in ('approve', 'deny') then
    raise exception 'Decision must be approve or deny';
  end if;

  new_status := case when p_decision = 'approve' then 'active' else 'denied' end;

  update public.profiles
  set status = new_status,
      role = case when p_decision = 'approve' then coalesce(nullif(trim(p_role), ''), 'staff') else role end,
      approved_by = auth.uid(),
      approved_at = timezone('utc', now())
  where id = p_user_id
  returning * into reviewed;

  if reviewed.id is null then
    raise exception 'User profile not found';
  end if;

  return reviewed;
end;
$$;

create or replace function public.set_user_phone(
  p_user_id uuid,
  p_phone text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can set user phone values';
  end if;

  update public.profiles
  set phone = nullif(trim(p_phone), '')
  where id = p_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'User profile not found';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.update_company_calendar_settings(
  p_company_calendar_name text,
  p_company_calendar_embed_url text
)
returns public.portal_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.portal_settings;
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can update company calendar settings';
  end if;

  insert into public.portal_settings (id, company_calendar_name, company_calendar_embed_url)
  values (
    1,
    coalesce(nullif(trim(p_company_calendar_name), ''), 'Harvest Renovation Company Calendar'),
    nullif(trim(p_company_calendar_embed_url), '')
  )
  on conflict (id) do update
    set company_calendar_name = excluded.company_calendar_name,
        company_calendar_embed_url = excluded.company_calendar_embed_url,
        updated_at = timezone('utc', now())
  returning * into updated_row;

  return updated_row;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.portal_settings to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;
grant execute on function public.list_pending_profiles() to authenticated;
grant execute on function public.review_user_request(uuid, text, text) to authenticated;
grant execute on function public.set_user_phone(uuid, text) to authenticated;
grant execute on function public.update_company_calendar_settings(text, text) to authenticated;
