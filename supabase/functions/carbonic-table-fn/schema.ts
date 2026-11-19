// 탄소로운 식탁 — 표 만들기와 처음 미션 57개.
// 서버 함수가 처음 불릴 때(cold start) 한 번만 실행합니다. 여러 번 실행해도 안전합니다.
// supabase/migrations/001_init.sql (= DDL), 002_v2_features.sql (= DDL_V2), 003_v3.sql (= DDL_V3) 과 같은 내용입니다
// (한쪽을 고치면 다른 쪽도 함께 고치세요).

export const CHECK_TABLES = `
  select
    to_regclass('carbonic_table.members') is not null as members,
    to_regclass('carbonic_table.missions') is not null as missions,
    to_regclass('carbonic_table.activities') is not null as activities,
    to_regclass('carbonic_table.auctions') is not null as auctions,
    to_regclass('carbonic_table.bids') is not null as bids,
    to_regclass('carbonic_table.seasons') is not null as seasons,
    to_regclass('carbonic_table.notices') is not null as notices,
    to_regclass('carbonic_table.activity_reactions') is not null as reactions,
    to_regclass('carbonic_table.activity_comments') is not null as comments,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'members' and column_name = 'is_admin') as members_is_admin,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'activities' and column_name = 'season_id') as activities_season,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'auctions' and column_name = 'season_id') as auctions_season,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'auctions' and column_name = 'seller_id') as auctions_seller,
    to_regclass('carbonic_table.images') is not null as images,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'seasons' and column_name = 'carbon_per_hour') as seasons_carbon,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'seasons' and column_name = 'carbon_capacity') as seasons_capacity,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'seasons' and column_name = 'earth_started_at') as seasons_earth_start,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'activities' and column_name = 'image_url') as activities_image,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'notices' and column_name = 'image_url') as notices_image,
    exists (select 1 from information_schema.columns
            where table_schema = 'carbonic_table' and table_name = 'auctions' and column_name = 'image_url') as auctions_image
`;

/** v1 표 — 앱을 처음 만들 때 필요한 것 */
export const BASE_FLAGS = ['members', 'missions', 'activities', 'auctions', 'bids'] as const;
/** v2 표·칸 — 시즌·공지·댓글·반응·관리자 */
export const V2_FLAGS = [
  'seasons', 'notices', 'reactions', 'comments',
  'members_is_admin', 'activities_season', 'auctions_season', 'auctions_seller',
] as const;
/** v3 표·칸 — 지구(탄소·공기)·사진 */
export const V3_FLAGS = [
  'images', 'seasons_carbon', 'seasons_capacity', 'seasons_earth_start',
  'activities_image', 'notices_image', 'auctions_image',
] as const;

export const SEED_MISSIONS: readonly (readonly [string, number])[] = [
  ['주변에 기후행동 실천 권하기', 1],
  ['나무 껴안아보는 시간 갖기', 1],
  ['이메일함 비우기', 1],
  ['클라우드 정리하기', 1],
  ['학교 앞 쓰레기 주워보기', 1],
  ['라벨이 있는 쓰레기는 라벨을 제거하기', 1],
  ['반찬 남기지 않고 다 먹기', 1],
  ['충동구매하지 않기', 1],
  ['가까운 거리 걸어서 이동하기', 1],
  ['안쓰는 옷 정리하기(5벌 이상)', 1],
  ['도서관에서 책 빌려 읽기 또는 중고책 구매하기', 1],
  ['음료 구매시 텀블러 사용하기', 1],
  ['음료 주문시 빨대 거절하기', 1],
  ['비닐봉지 대신 장바구니 이용하기', 1],
  ['나무심기', 1],
  ['대나무칫솔로 바꾸어 사용하기', 1],
  ['플라스틱 생수 구매하거나 사용하지 않기', 1],
  ['인터넷 택배 거래 대신 근처 매장에서 직접 사기', 1],
  ['중고로 물품 구입하기', 1],
  ['그린터치로 새고 있는 소비전력과 이산화탄소 발생량 줄이기', 1],
  ['일회용 마스크 대신 다회용 마스크 사용하기', 2],
  ['정확한 분리수거 방법 알아보고 분리수거 실천하기', 2],
  ['우유팩 분리수거 하기', 2],
  ['폐건전지 수거함에 넣기', 2],
  ['휴지와 물티슈 대신 손수건 사용하기', 2],
  ['한 끼 비건으로 살기', 2],
  ['난방 1도 낮춰 사용하기', 2],
  ['안쓰는 멀티탭 전원 끄기', 2],
  ['스트리밍 대신 저장해서 컨텐츠 이용하기(유튜브, 넷플릭스, 음원서비스 등)', 2],
  ['사용하지 않는 인터넷 계정 탈퇴 정리하기(검색 서비스)', 2],
  ['택배 주문시 최소로 포장해줄 것 요청하기', 2],
  ['냉장고 속 음식을 먼저 소비해서 폐기되는 음식물 양 줄이기', 2],
  ['집에서 직접 채식 요리해서 먹기', 2],
  ['자가용 대신 대중교통 이용하기', 2],
  ['관련 도서 찾아 읽어보기(예; 리페어컬쳐, 우리가 날씨다, 두번째 지구는 없다, 탄소로운 식탁)', 3],
  ['관련 도서 소개글, 독후감 작성', 3],
  ['관련 영상 감상하기(예; 카우스피러시, 씨스피라지, 나의 문어 선생님, 옥자 등)', 3],
  ['관련 영상 소개글, 감상후기 작성', 3],
  ['폐의약품 그냥 버리지 않고 약국과 주민센터로 반납하기', 3],
  ['음식 구매시 다회용 용기 챙겨 방문하기', 3],
  ['친환경 브랜드 제품 구입하기', 3],
  ['환경성적표지, 저탄소제품으로 구입하기', 3],
  ['환경운동단체에 기부, 후원으로 응원하기', 3],
  ['넷제로, 제로웨이스트샵 경험하기', 3],
  ['기후학교참여, 수업 참여하기', 3],
  ['플로깅 모임 참여하기', 3],
  ['냉장고 속 음식을 먼저 소비해서 폐기되는 음식물 양 줄이기', 3],
  ['로컬푸드 매장, 지역농산물 장터 이용하기', 3],
  ['국내산 농산물, 지역농산물 장터 이용하기', 3],
  ['유제품 대신 두유나 곡물유로 대체하기', 3],
  ['우리밀 및 우리밀 제품 구매하기', 3],
  ['팜유가 사용되지 않은 제품 구매하기', 3],
  ['수선과 리폼, 업사이클 해서 재활용하기', 3],
  ['업사이클링 제품 쓰기', 3],
  ['비건 인증 화장품으로 바꾸기', 3],
  ['생활용품 바꾸기(고체 샴푸바, 고체치약, 대나무 칫솔 등등)', 3],
  ['중고로 물품 기증하기', 3]
];

export const DDL: readonly string[] = [
  `-- 탄소로운 식탁: 표 만들기 (여러 번 실행해도 안전)

create table if not exists carbonic_table.members (
  user_id uuid primary key,
  email text not null default '',
  name text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_kind_chk check (kind in ('10학년', '11학년', '12학년', '교사')),
  constraint members_name_chk check (char_length(name) between 1 and 20)
)`,

  `comment on table carbonic_table.members is '탄소로운 식탁 회원 — BMR APPS 로그인 사용자마다 한 줄 (구분·이름)'`,

  `create table if not exists carbonic_table.missions (
  id bigint generated always as identity primary key,
  seed_key text unique,
  name text not null,
  air integer not null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint missions_air_chk check (air between 1 and 1000),
  constraint missions_name_chk check (char_length(name) between 1 and 120)
)`,

  `comment on table carbonic_table.missions is '기후 실천 미션 목록 — 처음 57개는 구글 시트 미션 목록에서 옮겨 옴'`,

  `create table if not exists carbonic_table.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  mission_id bigint references carbonic_table.missions(id) on delete set null,
  mission_name text not null,
  air integer not null,
  done_on date not null,
  created_at timestamptz not null default now(),
  constraint activities_air_chk check (air between 1 and 1000)
)`,

  `comment on table carbonic_table.activities is '실천 통장 — 회원이 등록한 실천 한 건마다 공기 적립'`,

  `create index if not exists activities_recent_idx on carbonic_table.activities (created_at desc)`,

  `create index if not exists activities_user_idx on carbonic_table.activities (user_id, created_at desc)`,

  `create index if not exists activities_day_idx on carbonic_table.activities (done_on desc)`,

  `create table if not exists carbonic_table.auctions (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  start_price integer not null,
  min_step integer not null default 1,
  status text not null default 'open',
  highest_bid_id bigint,
  winner_user_id uuid,
  winner_name text,
  winning_bid integer,
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint auctions_status_chk check (status in ('open', 'closed', 'canceled')),
  constraint auctions_price_chk check (start_price between 1 and 100000),
  constraint auctions_step_chk check (min_step between 1 and 10000),
  constraint auctions_title_chk check (char_length(title) between 1 and 60)
)`,

  `comment on table carbonic_table.auctions is '공기 경매(플리마켓) — 회원이 물품을 올리고(대기) 관리자가 시작하면 공기로 입찰'`,

  `create table if not exists carbonic_table.bids (
  id bigint generated always as identity primary key,
  auction_id bigint not null references carbonic_table.auctions(id) on delete cascade,
  user_id uuid not null,
  bidder_name text not null,
  bidder_kind text not null,
  amount integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint bids_status_chk check (status in ('active', 'outbid', 'won', 'lost', 'canceled')),
  constraint bids_amount_chk check (amount between 1 and 100000)
)`,

  `comment on table carbonic_table.bids is '경매 입찰 — 진행 중 경매마다 active 한 줄(최고가)만 남고 밀리면 outbid 로 풀린다'`,

  `create index if not exists bids_auction_idx on carbonic_table.bids (auction_id, created_at desc)`,

  `create index if not exists bids_user_idx on carbonic_table.bids (user_id, status)`,

  `-- 브라우저는 표를 직접 읽지 않는다 (모든 데이터는 서버 함수 carbonic-table-fn 을 거친다). RLS 는 켜 두고 정책은 두지 않는다.
alter table carbonic_table.members enable row level security`,

  `alter table carbonic_table.missions enable row level security`,

  `alter table carbonic_table.activities enable row level security`,

  `alter table carbonic_table.auctions enable row level security`,

  `alter table carbonic_table.bids enable row level security`,

  `revoke all on carbonic_table.members, carbonic_table.missions, carbonic_table.activities, carbonic_table.auctions, carbonic_table.bids from anon, authenticated`
];

/** v2 — 시즌 · 공지 · 반응 · 댓글 · 관리자 · 회원 물품 등록(waiting). 이미 있는 표에 안전하게 덧붙입니다. */
export const DDL_V2: readonly string[] = [
  `-- 1) 관리자 권한 칸
alter table carbonic_table.members add column if not exists is_admin boolean not null default false`,

  `-- 2) 시즌 칸 (기존 기록은 아래에서 기본 시즌으로 채웁니다)
alter table carbonic_table.activities add column if not exists season_id bigint`,
  `alter table carbonic_table.auctions add column if not exists season_id bigint`,
  `alter table carbonic_table.auctions add column if not exists seller_id uuid`,
  `alter table carbonic_table.auctions add column if not exists seller_name text not null default ''`,
  `alter table carbonic_table.auctions add column if not exists started_at timestamptz`,

  `-- 3) 시즌
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
)`,

  `comment on table carbonic_table.seasons is '시즌 — 실천 기록·랭킹·경매를 시즌별로 나눠 운영한다 (활성 시즌은 하나)'`,

  `-- 4) 공지
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
)`,

  `comment on table carbonic_table.notices is '공지 — 관리자가 쓰고 모든 사용자가 현황·상단에서 본다'`,

  `-- 5) 실천 기록 반응
create table if not exists carbonic_table.activity_reactions (
  activity_id bigint not null references carbonic_table.activities(id) on delete cascade,
  user_id uuid not null,
  name text not null default '',
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id, emoji),
  constraint reactions_emoji_chk check (emoji in ('🌱', '👏', '💚', '🔥'))
)`,

  `comment on table carbonic_table.activity_reactions is '실천 기록 이모지 반응 — 회원당 반응별 하나(누르면 켜고 끔)'`,

  `-- 6) 실천 기록 댓글
create table if not exists carbonic_table.activity_comments (
  id bigint generated always as identity primary key,
  activity_id bigint not null references carbonic_table.activities(id) on delete cascade,
  user_id uuid not null,
  name text not null default '',
  kind text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_chk check (char_length(body) between 1 and 500)
)`,

  `comment on table carbonic_table.activity_comments is '실천 기록 댓글 — 본인 또는 관리자가 지운다'`,

  `create index if not exists activities_season_idx on carbonic_table.activities (season_id, created_at desc)`,
  `create index if not exists auctions_season_idx on carbonic_table.auctions (season_id, status)`,
  `create index if not exists reactions_activity_idx on carbonic_table.activity_reactions (activity_id)`,
  `create index if not exists comments_activity_idx on carbonic_table.activity_comments (activity_id, created_at)`,
  `create index if not exists notices_pinned_idx on carbonic_table.notices (pinned desc, created_at desc)`,

  `-- 7) 경매 상태에 'waiting'(회원이 올려 관리자 시작을 기다리는 대기)을 더한다
alter table carbonic_table.auctions drop constraint if exists auctions_status_chk`,
  `alter table carbonic_table.auctions add constraint auctions_status_chk check (status in ('waiting', 'open', 'closed', 'canceled'))`,

  `-- 8) 브라우저 직접 접근 차단
alter table carbonic_table.seasons enable row level security`,
  `alter table carbonic_table.notices enable row level security`,
  `alter table carbonic_table.activity_reactions enable row level security`,
  `alter table carbonic_table.activity_comments enable row level security`,
  `revoke all on carbonic_table.seasons, carbonic_table.notices, carbonic_table.activity_reactions, carbonic_table.activity_comments from anon, authenticated`
];

/** v3 — 지구(탄소·공기) 설정과 사진 표. 이미 있는 표에 안전하게 덧붙입니다. */
export const DDL_V3: readonly string[] = [
  `-- 1) 시즌마다 지구 설정
alter table carbonic_table.seasons add column if not exists carbon_per_hour numeric(6,2) not null default 1`,
  `alter table carbonic_table.seasons add column if not exists carbon_capacity numeric(8,2) not null default 24`,
  `alter table carbonic_table.seasons add column if not exists earth_started_at timestamptz`,

  // 이미 있던 시즌은 시즌을 시작한 때부터 탄소가 쌓인 것으로 본다 (기존 데이터는 그대로)
  `update carbonic_table.seasons set earth_started_at = coalesce(created_at, now()) where earth_started_at is null`,
  `alter table carbonic_table.seasons alter column earth_started_at set default now()`,
  `alter table carbonic_table.seasons alter column earth_started_at set not null`,

  `alter table carbonic_table.seasons drop constraint if exists seasons_carbon_chk`,
  `alter table carbonic_table.seasons add constraint seasons_carbon_chk check (carbon_per_hour >= 0 and carbon_per_hour <= 1000)`,
  `alter table carbonic_table.seasons drop constraint if exists seasons_capacity_chk`,
  `alter table carbonic_table.seasons add constraint seasons_capacity_chk check (carbon_capacity > 0 and carbon_capacity <= 100000)`,

  `comment on column carbonic_table.seasons.carbon_per_hour is '지구에 한 시간마다 쌓이는 탄소 (관리자가 시즌마다 조정)'`,
  `comment on column carbonic_table.seasons.carbon_capacity is '임계점에 이르는 순탄소 양 — 이 값으로 온난화 지수를 0~100%로 환산'`,
  `comment on column carbonic_table.seasons.earth_started_at is '탄소를 세기 시작한 시각 (리셋하면 지금으로 바뀐다)'`,

  `-- 2) 사진 칸
alter table carbonic_table.notices add column if not exists image_url text not null default ''`,
  `alter table carbonic_table.activities add column if not exists image_url text not null default ''`,
  `alter table carbonic_table.auctions add column if not exists image_url text not null default ''`,

  `-- 3) 사진 저장 표
create table if not exists carbonic_table.images (
  id bigint generated always as identity primary key,
  user_id uuid,
  mime text not null default 'image/webp',
  bytes integer not null default 0,
  data text not null,
  created_at timestamptz not null default now(),
  constraint images_mime_chk check (mime in ('image/jpeg', 'image/png', 'image/webp'))
)`,

  `comment on table carbonic_table.images is '공지·실천·경매 사진 — 가로 1200px 이하로 줄인 그림을 base64 로 담고 /images/<번호> 로 내려 준다'`,
  `create index if not exists images_created_idx on carbonic_table.images (created_at desc)`,
  `alter table carbonic_table.images enable row level security`,
  `revoke all on carbonic_table.images from anon, authenticated`,
];

/** 기본 시즌 이름 — 처음 한 번 시드합니다 */
export const DEFAULT_SEASON = '2026 시즌 1';
