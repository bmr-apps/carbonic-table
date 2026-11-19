-- 탄소로운 식탁: 표 만들기 (여러 번 실행해도 안전)

create table if not exists carbonic_table.members (
  user_id uuid primary key,
  email text not null default '',
  name text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_kind_chk check (kind in ('10학년', '11학년', '12학년', '교사')),
  constraint members_name_chk check (char_length(name) between 1 and 20)
);
comment on table carbonic_table.members is '탄소로운 식탁 회원 — BMR APPS 로그인 사용자마다 한 줄 (구분·이름)';

create table if not exists carbonic_table.missions (
  id bigint generated always as identity primary key,
  seed_key text unique,
  name text not null,
  air integer not null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint missions_air_chk check (air between 1 and 1000),
  constraint missions_name_chk check (char_length(name) between 1 and 120)
);
comment on table carbonic_table.missions is '기후 실천 미션 목록 — 처음 57개는 구글 시트 미션 목록에서 옮겨 옴';

create table if not exists carbonic_table.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  mission_id bigint references carbonic_table.missions(id) on delete set null,
  mission_name text not null,
  air integer not null,
  done_on date not null,
  created_at timestamptz not null default now(),
  constraint activities_air_chk check (air between 1 and 1000)
);
comment on table carbonic_table.activities is '실천 통장 — 회원이 등록한 실천 한 건마다 공기 적립';

create index if not exists activities_recent_idx on carbonic_table.activities (created_at desc);
create index if not exists activities_user_idx on carbonic_table.activities (user_id, created_at desc);
create index if not exists activities_day_idx on carbonic_table.activities (done_on desc);

create table if not exists carbonic_table.auctions (
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
);
comment on table carbonic_table.auctions is '공기 경매(플리마켓) — 운영자가 올리고 회원이 공기로 입찰';

create table if not exists carbonic_table.bids (
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
);
comment on table carbonic_table.bids is '경매 입찰 — 진행 중 경매마다 active 한 줄(최고가)만 남고 밀리면 outbid 로 풀린다';

create index if not exists bids_auction_idx on carbonic_table.bids (auction_id, created_at desc);
create index if not exists bids_user_idx on carbonic_table.bids (user_id, status);

-- 브라우저는 표를 직접 읽지 않는다 (모든 데이터는 서버 함수 carbonic-table-fn 을 거친다). RLS 는 켜 두고 정책은 두지 않는다.
alter table carbonic_table.members enable row level security;
alter table carbonic_table.missions enable row level security;
alter table carbonic_table.activities enable row level security;
alter table carbonic_table.auctions enable row level security;
alter table carbonic_table.bids enable row level security;
revoke all on carbonic_table.members, carbonic_table.missions, carbonic_table.activities, carbonic_table.auctions, carbonic_table.bids from anon, authenticated;

insert into carbonic_table.missions (seed_key, name, air, sort) values
  ('m01', '주변에 기후행동 실천 권하기', 1, 1),
  ('m02', '나무 껴안아보는 시간 갖기', 1, 2),
  ('m03', '이메일함 비우기', 1, 3),
  ('m04', '클라우드 정리하기', 1, 4),
  ('m05', '학교 앞 쓰레기 주워보기', 1, 5),
  ('m06', '라벨이 있는 쓰레기는 라벨을 제거하기', 1, 6),
  ('m07', '반찬 남기지 않고 다 먹기', 1, 7),
  ('m08', '충동구매하지 않기', 1, 8),
  ('m09', '가까운 거리 걸어서 이동하기', 1, 9),
  ('m10', '안쓰는 옷 정리하기(5벌 이상)', 1, 10),
  ('m11', '도서관에서 책 빌려 읽기 또는 중고책 구매하기', 1, 11),
  ('m12', '음료 구매시 텀블러 사용하기', 1, 12),
  ('m13', '음료 주문시 빨대 거절하기', 1, 13),
  ('m14', '비닐봉지 대신 장바구니 이용하기', 1, 14),
  ('m15', '나무심기', 1, 15),
  ('m16', '대나무칫솔로 바꾸어 사용하기', 1, 16),
  ('m17', '플라스틱 생수 구매하거나 사용하지 않기', 1, 17),
  ('m18', '인터넷 택배 거래 대신 근처 매장에서 직접 사기', 1, 18),
  ('m19', '중고로 물품 구입하기', 1, 19),
  ('m20', '그린터치로 새고 있는 소비전력과 이산화탄소 발생량 줄이기', 1, 20),
  ('m21', '일회용 마스크 대신 다회용 마스크 사용하기', 2, 21),
  ('m22', '정확한 분리수거 방법 알아보고 분리수거 실천하기', 2, 22),
  ('m23', '우유팩 분리수거 하기', 2, 23),
  ('m24', '폐건전지 수거함에 넣기', 2, 24),
  ('m25', '휴지와 물티슈 대신 손수건 사용하기', 2, 25),
  ('m26', '한 끼 비건으로 살기', 2, 26),
  ('m27', '난방 1도 낮춰 사용하기', 2, 27),
  ('m28', '안쓰는 멀티탭 전원 끄기', 2, 28),
  ('m29', '스트리밍 대신 저장해서 컨텐츠 이용하기(유튜브, 넷플릭스, 음원서비스 등)', 2, 29),
  ('m30', '사용하지 않는 인터넷 계정 탈퇴 정리하기(검색 서비스)', 2, 30),
  ('m31', '택배 주문시 최소로 포장해줄 것 요청하기', 2, 31),
  ('m32', '냉장고 속 음식을 먼저 소비해서 폐기되는 음식물 양 줄이기', 2, 32),
  ('m33', '집에서 직접 채식 요리해서 먹기', 2, 33),
  ('m34', '자가용 대신 대중교통 이용하기', 2, 34),
  ('m35', '관련 도서 찾아 읽어보기(예; 리페어컬쳐, 우리가 날씨다, 두번째 지구는 없다, 탄소로운 식탁)', 3, 35),
  ('m36', '관련 도서 소개글, 독후감 작성', 3, 36),
  ('m37', '관련 영상 감상하기(예; 카우스피러시, 씨스피라지, 나의 문어 선생님, 옥자 등)', 3, 37),
  ('m38', '관련 영상 소개글, 감상후기 작성', 3, 38),
  ('m39', '폐의약품 그냥 버리지 않고 약국과 주민센터로 반납하기', 3, 39),
  ('m40', '음식 구매시 다회용 용기 챙겨 방문하기', 3, 40),
  ('m41', '친환경 브랜드 제품 구입하기', 3, 41),
  ('m42', '환경성적표지, 저탄소제품으로 구입하기', 3, 42),
  ('m43', '환경운동단체에 기부, 후원으로 응원하기', 3, 43),
  ('m44', '넷제로, 제로웨이스트샵 경험하기', 3, 44),
  ('m45', '기후학교참여, 수업 참여하기', 3, 45),
  ('m46', '플로깅 모임 참여하기', 3, 46),
  ('m47', '냉장고 속 음식을 먼저 소비해서 폐기되는 음식물 양 줄이기', 3, 47),
  ('m48', '로컬푸드 매장, 지역농산물 장터 이용하기', 3, 48),
  ('m49', '국내산 농산물, 지역농산물 장터 이용하기', 3, 49),
  ('m50', '유제품 대신 두유나 곡물유로 대체하기', 3, 50),
  ('m51', '우리밀 및 우리밀 제품 구매하기', 3, 51),
  ('m52', '팜유가 사용되지 않은 제품 구매하기', 3, 52),
  ('m53', '수선과 리폼, 업사이클 해서 재활용하기', 3, 53),
  ('m54', '업사이클링 제품 쓰기', 3, 54),
  ('m55', '비건 인증 화장품으로 바꾸기', 3, 55),
  ('m56', '생활용품 바꾸기(고체 샴푸바, 고체치약, 대나무 칫솔 등등)', 3, 56),
  ('m57', '중고로 물품 기증하기', 3, 57)
on conflict (seed_key) do nothing;
