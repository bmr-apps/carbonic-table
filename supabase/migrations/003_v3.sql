-- 탄소로운 식탁 v3 — 지구(탄소·공기) · 사진(이미지) · 실천 여러 건 등록
-- 이미 있는 표에 안전하게 덧붙입니다 (여러 번 실행해도 OK). 기존 회원·실천·시즌·공지 데이터는 그대로 둡니다.
-- 서버 함수의 ensureSchema()(schema.ts 의 DDL_V3)와 같은 내용입니다 — 한쪽을 고치면 다른 쪽도 함께 고치세요.

-- 1) 시즌마다 지구 설정 ---------------------------------------------------------
alter table carbonic_table.seasons add column if not exists carbon_per_hour numeric(6,2) not null default 1;
alter table carbonic_table.seasons add column if not exists carbon_capacity numeric(8,2) not null default 24;
alter table carbonic_table.seasons add column if not exists earth_started_at timestamptz;

-- 이미 있던 시즌('2026 시즌 1' 등)은 시즌을 시작한 때부터 탄소가 쌓인 것으로 봅니다.
update carbonic_table.seasons
   set earth_started_at = coalesce(created_at, now())
 where earth_started_at is null;

alter table carbonic_table.seasons alter column earth_started_at set default now();
alter table carbonic_table.seasons alter column earth_started_at set not null;

alter table carbonic_table.seasons drop constraint if exists seasons_carbon_chk;
alter table carbonic_table.seasons add constraint seasons_carbon_chk
  check (carbon_per_hour >= 0 and carbon_per_hour <= 1000);

alter table carbonic_table.seasons drop constraint if exists seasons_capacity_chk;
alter table carbonic_table.seasons add constraint seasons_capacity_chk
  check (carbon_capacity > 0 and carbon_capacity <= 100000);

comment on column carbonic_table.seasons.carbon_per_hour is '지구에 한 시간마다 쌓이는 탄소 (관리자가 시즌마다 조정)';
comment on column carbonic_table.seasons.carbon_capacity is '지구가 완전히 붉게 달아오르는 순탄소 양 — 이 값으로 오염도를 0~100%로 환산';
comment on column carbonic_table.seasons.earth_started_at is '탄소를 세기 시작한 시각 (리셋하면 지금으로 바뀜)';

-- 2) 사진 칸 ---------------------------------------------------------------
alter table carbonic_table.notices add column if not exists image_url text not null default '';
alter table carbonic_table.activities add column if not exists image_url text not null default '';
alter table carbonic_table.auctions add column if not exists image_url text not null default '';

-- 3) 사진 저장 표 — 서버 함수가 올리고 내려 줍니다 (공개 읽기, 쓰기는 로그인한 회원만)
create table if not exists carbonic_table.images (
  id bigint generated always as identity primary key,
  user_id uuid,
  mime text not null default 'image/webp',
  bytes integer not null default 0,
  data text not null,
  created_at timestamptz not null default now(),
  constraint images_mime_chk check (mime in ('image/jpeg', 'image/png', 'image/webp'))
);
comment on table carbonic_table.images is '공지·실천·경매 사진 — 가로 1200px 이하로 줄인 그림을 base64 로 담고 /images/<번호> 로 내려 준다';

create index if not exists images_created_idx on carbonic_table.images (created_at desc);

alter table carbonic_table.images enable row level security;
revoke all on carbonic_table.images from anon, authenticated;

-- 4) 사진을 붙인 기록은 지울 때 사진도 함께 정리 (서버 함수가 처리, 여기서는 찾기만 빠르게)
create index if not exists activities_image_idx on carbonic_table.activities (image_url) where image_url <> '';
