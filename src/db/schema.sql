-- Идемпотентная схема: можно запускать сколько угодно раз (npm run migrate).
-- Работает и на чистой БД, и на существующей.

-- ── users ────────────────────────────────────────────────────────────────
create table if not exists users (
  id serial primary key,
  name varchar not null,
  password text,
  email text,
  google_id text,
  avatar text,
  refresh_token text,
  created_at timestamp default now(),
  google_access text,
  google_refresh text
);

alter table users
  add column if not exists google_access text,
  add column if not exists google_refresh text;

-- Дубли email (регистр не учитываем): старейший аккаунт остаётся как есть,
-- остальные получают адрес вида name+dup<id>@domain — данные не удаляются.
do $$
declare
  renamed integer;
begin
  with ranked as (
    select id,
           lower(btrim(email)) as normalized,
           row_number() over (partition by lower(btrim(email)) order by id) as rn
    from users
    where email is not null
  ),
  fixed as (
    update users u
    set email = split_part(r.normalized, '@', 1) || '+dup' || u.id || '@' || split_part(r.normalized, '@', 2)
    from ranked r
    where u.id = r.id and r.rn > 1
    returning u.id
  )
  select count(*) into renamed from fixed;

  if renamed > 0 then
    raise notice 'users: % duplicate e-mail(s) renamed to +dup<id>', renamed;
  end if;

  update users set email = lower(btrim(email))
  where email is not null and email <> lower(btrim(email));
end $$;

create unique index if not exists users_email_lower_key
  on users (lower(email)) where email is not null;

create unique index if not exists users_google_id_key
  on users (google_id) where google_id is not null;

-- ── сессии: по одной строке на устройство/вкладку ────────────────────────
create table if not exists auth_sessions (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  rotated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth_sessions (expires_at);

-- ── данные приложения ────────────────────────────────────────────────────
create table if not exists notes (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  content text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deals (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  contact_id integer references contacts(id) on delete set null,
  title text not null,
  amount numeric,
  stage text not null default 'new' check (stage in ('new', 'in_progress', 'won', 'lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists password_resets (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists chat_conversations (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id serial primary key,
  conversation_id integer not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  is_error boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── timestamp → timestamptz ──────────────────────────────────────────────
-- Раньше колонки были "без часового пояса": время зависело от TZ Node и БД
-- (в этом окружении они расходились на час). Старые значения записаны
-- через now() в часовом поясе сессии БД — по нему их и переводим.
do $$
declare
  col record;
begin
  for col in
    select table_name, column_name, column_default
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'timestamp without time zone'
      and table_name in (
        'users', 'notes', 'tasks', 'contacts', 'deals',
        'password_resets', 'chat_conversations', 'chat_messages'
      )
  loop
    execute format('alter table %I alter column %I drop default', col.table_name, col.column_name);
    execute format(
      'alter table %I alter column %I type timestamptz using %I at time zone current_setting(''TimeZone'')',
      col.table_name, col.column_name, col.column_name
    );
    -- default возвращаем только там, где он был (used_at, expires_at его не имели)
    if col.column_default is not null then
      execute format('alter table %I alter column %I set default %s', col.table_name, col.column_name, col.column_default);
    end if;
  end loop;
end $$;

-- ── индексы под реальные запросы ─────────────────────────────────────────
create index if not exists notes_user_created_idx on notes (user_id, created_at desc);
create index if not exists tasks_user_created_idx on tasks (user_id, created_at desc);
create index if not exists contacts_user_created_idx on contacts (user_id, created_at desc);
create index if not exists deals_user_created_idx on deals (user_id, created_at desc);
create index if not exists deals_contact_idx on deals (contact_id);
create index if not exists password_resets_user_idx on password_resets (user_id);
create index if not exists chat_conversations_user_idx on chat_conversations (user_id, updated_at desc);
create index if not exists chat_messages_conversation_idx on chat_messages (conversation_id, id);
