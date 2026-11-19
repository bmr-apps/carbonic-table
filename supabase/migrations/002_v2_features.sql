-- 탄소로운 식탁 v2 — 공지 · 시즌 · 반응/댓글 · 관리자 · 회원 물품 등록(waiting)
-- 이미 있는 carbonic_table 스키마에 안전하게 덧붙입니다 (여러 번 실행해도 OK).
-- 서버 함수의 ensureSchema()(schema.ts 의 DDL_V2)와 같은 내용입니다 — 한쪽을 고치면 다른 쪽도 함께 고치세요.

-- 1) 관리자 권한 칸 -----------------------------------------------------------
alter table carbonic_table.members add column if not exists is_admin boolean not null default false;

-- 2) 시즌 칸 (기존 기록은 아래에서 기본 시즌으로 채웁니다) --------------------
alter table carbonic_table.activities add column if not exists season_id bigint;
alter table carbonic_table.auctions add column if not exists season_id bigint;
alter table carbonic_table.auctions add column if not exists seller_id uuid;
alter table carbonic_table.auctions add column if not exists seller_name text not null default '';
alter table carbonic_table.auctions add column if not exists started_at timestamptz;

-- 3) 시즌 ---------------------------------------------------------------------
create table if not exists carbonic_table.seasons (
  id bigint generated always as identity primary key,
  name text not null unique,
  status text not null default 'planned',
  note text not null default '',
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint seasons_status_chk check (status in ('planned', 'active', 'ended')),
  constraint seasons_name_chk check (char_length(name) between 1 and 40)
);
comment on table carbonic_table.seasons is '시즌 — 실천 기록·랭킹·경매를 시즌별로 나눠 운영한다 (활성 시즌은 하나)';

-- 4) 공지 ---------------------------------------------------------------------
create table if not exists carbonic_table.notices (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  author_id uuid,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notices_title_chk check (char_length(title) between 1 and 80),
  constraint notices_body_chk check (char_length(body) <= 2000)
);
comment on table carbonic_table.notices is '공지 — 관리자가 쓰고 모든 사용자가 현황·상단에서 본다';

-- 5) 실천 기록 반응 -----------------------------------------------------------
create table if not exists carbonic_table.activity_reactions (
  activity_id bigint not null references carbonic_table.activities(id) on delete cascade,
  user_id uuid not null,
  name text not null default '',
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id, emoji),
  constraint reactions_emoji_chk check (emoji in ('🌱', '👏', '💚', '🔥'))
);
comment on table carbonic_table.activity_reactions is '실천 기록 이모지 반응 — 회원당 반응별 하나(누르면 켜고 끔)';

-- 6) 실천 기록 댓글 -----------------------------------------------------------
create table if not exists carbonic_table.activity_comments (
  id bigint generated always as identity primary key,
  activity_id bigint not null references carbonic_table.activities(id) on delete cascade,
  user_id uuid not null,
  name text not null default '',
  kind text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_chk check (char_length(body) between 1 and 500)
);
comment on table carbonic_table.activity_comments is '실천 기록 댓글 — 본인 또는 관리자가 지운다';

create index if not exists activities_season_idx on carbonic_table.activities (season_id, created_at desc);
create index if not exists auctions_season_idx on carbonic_table.auctions (season_id, status);
create index if not exists reactions_activity_idx on carbonic_table.activity_reactions (activity_id);
create index if not exists comments_activity_idx on carbonic_table.activity_comments (activity_id, created_at);
create index if not exists notices_pinned_idx on carbonic_table.notices (pinned desc, created_at desc);

-- 7) 경매 상태에 'waiting'(회원이 올려 관리자 시작을 기다리는 대기)을 더한다 ---
alter table carbonic_table.auctions drop constraint if exists auctions_status_chk;
alter table carbonic_table.auctions add constraint auctions_status_chk
  check (status in ('waiting', 'open', 'closed', 'canceled'));

-- 8) 브라우저 직접 접근 차단 (표 권한을 주지 않음 — 모든 접근은 서버 함수) -----
alter table carbonic_table.seasons enable row level security;
alter table carbonic_table.notices enable row level security;
alter table carbonic_table.activity_reactions enable row level security;
alter table carbonic_table.activity_comments enable row level security;
revoke all on carbonic_table.seasons, carbonic_table.notices, carbonic_table.activity_reactions, carbonic_table.activity_comments from anon, authenticated;

-- 9) 기본 시즌 '2026 시즌 1' — 처음 한 번만. 기존 기록·경매는 이 시즌에 그대로 남는다.
insert into carbonic_table.seasons (name, status, note)
select '2026 시즌 1', 'active', '탄소로운 식탁을 처음 시작한 시즌'
where not exists (select 1 from carbonic_table.seasons)
on conflict (name) do nothing;

update carbonic_table.activities
   set season_id = (select min(id) from carbonic_table.seasons)
 where season_id is null;

update carbonic_table.auctions
   set season_id = (select min(id) from carbonic_table.seasons)
 where season_id is null;

-- 10) 기존에 등록된 은길님(조은길)을 관리자로 — 관리자가 하나도 없을 때만
update carbonic_table.members
   set is_admin = true, updated_at = now()
 where name = '조은길' and not exists (select 1 from carbonic_table.members where is_admin);

-- 11) 첫 안내 공지 (공지가 비어 있을 때 한 번)
insert into carbonic_table.notices (title, body, pinned, author_name)
select '탄소로운 식탁에 오신 것을 환영해요',
       E'별무리 사람들이 기후 실천으로 모은 공기를 기록하는 통장입니다.\n\n· 미션을 골라 실천을 남기면 공기가 쌓여요.\n· 쌓인 공기로 카본 옥션에서 물건을 나눠요.\n· 시즌이 바뀌면 기록·랭킹·카본 옥션이 새로 시작됩니다.',
       true, '탄소로운 식탁'
where not exists (select 1 from carbonic_table.notices);
