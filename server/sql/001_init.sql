-- AI Learning Engine — Supabase schema
-- Chạy toàn bộ file này trong Supabase SQL Editor.

create table if not exists accounts (
  code text primary key,
  created_at timestamptz not null default now(),
  active_provider text not null default 'gemini'
    check (active_provider in ('gemini', 'openrouter'))
);

create table if not exists devices (
  device_code text primary key,
  account_code text not null references accounts(code) on delete cascade,
  last_seen timestamptz not null default now(),
  ip text
);

create table if not exists ai_configs (
  account_code text not null references accounts(code) on delete cascade,
  provider text not null check (provider in ('gemini', 'openrouter')),
  api_key_enc text,
  model text,
  updated_at timestamptz not null default now(),
  primary key (account_code, provider)
);

create table if not exists lessons (
  id uuid primary key,
  account_code text not null references accounts(code) on delete cascade,
  subject text not null,
  topic text not null,
  summary text,
  created_at timestamptz not null default now(),
  size_bytes integer not null default 0,
  version integer not null default 1
);

create table if not exists lesson_artifacts (
  lesson_id uuid not null references lessons(id) on delete cascade,
  kind text not null check (kind in ('lecture', 'mindmap', 'interactive', 'quiz')),
  payload_b64 text not null,
  size_bytes integer not null default 0,
  primary key (lesson_id, kind)
);

create index if not exists devices_account_idx on devices(account_code);
create index if not exists lessons_account_created_idx on lessons(account_code, created_at desc);
create index if not exists lesson_artifacts_lesson_idx on lesson_artifacts(lesson_id);

-- Backend dùng service role key nên bỏ qua RLS.
-- Bật RLS để anon key không thể đọc/ghi trực tiếp.
alter table accounts enable row level security;
alter table devices enable row level security;
alter table ai_configs enable row level security;
alter table lessons enable row level security;
alter table lesson_artifacts enable row level security;
