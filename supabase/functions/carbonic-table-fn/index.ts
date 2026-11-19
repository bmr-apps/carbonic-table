// carbonic-table-fn — 탄소로운 식탁 서버 함수 (v2: 공지 · 시즌 · 랭킹 · 반응/댓글 · 경매 대기 · 관리자)
//
// 주소: https://psupfmarnyxontorftio.supabase.co/functions/v1/carbonic-table-fn/<경로>
//
//   GET   /health                       DB 연결 확인 (허브 표준 healthJson)
//   GET   /hello                        부른 사람과 역할
//   GET   /state[?season=<id>]          화면 한 벌 — 시즌·총합·학년별·회원별·랭킹·피드(반응·댓글)·공지·경매 (로그인 없이도 열람)
//   POST  /me            {name, kind}   내 회원 정보 등록·수정 (로그인 필요, 첫 회원은 관리자)
//   POST  /activities    {mission_id, done_on}   실천 등록 → 지금 시즌에 공기 적립
//   DEL   /activities/:id               내 실천 기록 지우기 (관리자는 남의 것도)
//   POST  /activities/:id/reactions {emoji}      이모지 반응 켜기/끄기
//   POST  /activities/:id/comments {body}        댓글 쓰기
//   DEL   /comments/:id                 내 댓글 지우기 (관리자는 남의 것도)
//   POST  /notices      {title, body, pinned}    공지 쓰기 (관리자)
//   PATCH /notices/:id  {title?, body?, pinned?} 공지 고치기 (관리자)
//   DEL   /notices/:id                  공지 지우기 (관리자)
//   POST  /seasons      {name, note?}   새 시즌 만들기 (관리자, 계획 상태)
//   POST  /seasons/:id/activate         활성 시즌으로 전환 (관리자)
//   POST  /seasons/:id/end              시즌 종료 (관리자)
//   POST  /missions     {name, air}     미션 추가 (관리자)
//   PATCH /missions/:id {name?, air?, active?}   미션 고치기·숨기기 (관리자)
//   DEL   /missions/:id                 실천 기록이 없는 미션 지우기 (관리자)
//   POST  /auctions     {title, description?, start_price, min_step}  회원 물품 등록 → waiting(대기)
//   PATCH /auctions/:id {title?, description?, start_price?, min_step?}  대기 중 물품 고치기 (등록자·관리자)
//   POST  /auctions/:id/start           대기 → 진행 (관리자)
//   POST  /auctions/:id/bid {amount}    입찰 — 트랜잭션 + FOR UPDATE 로 경합·초과 입찰 방지
//   POST  /auctions/:id/close           마감(낙찰 확정) (관리자)
//   POST  /auctions/:id/cancel          취소 (관리자)
//   DEL   /auctions/:id                 경매 지우기 (관리자, 대기 중이면 등록자도)
//   PATCH /members/:user_id {kind?, is_admin?}   회원 구분·관리자 권한 바꾸기 (관리자)
//   DEL   /members/:user_id             기록이 없는 회원 정리 (관리자)
//
// 함수는 이 앱 전용 DB 계정(carbonic_table_fn)으로 접속해 RLS 를 거치지 않습니다.
// 그래서 누가 무엇을 할 수 있는지는 이 파일에서 직접 확인합니다.
import postgres from 'npm:postgres@3.4.5';
import { checkHubAuth, healthJson, type HubUser } from './lib/hub.ts';
import { BASE_FLAGS, CHECK_TABLES, DDL, DDL_V2, DEFAULT_SEASON, SEED_MISSIONS, V2_FLAGS } from './schema.ts';

const FN = 'carbonic-table-fn';
const SCHEMA = 'carbonic_table';
const PREFIX = 'CARBONIC_TABLE_';
const ORIGINS = ['https://apps.bmrschool.net', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const KINDS = ['10학년', '11학년', '12학년', '교사'] as const;
type Kind = (typeof KINDS)[number];
const REACTIONS = ['🌱', '👏', '💚', '🔥'] as const;
type Reaction = (typeof REACTIONS)[number];

const secret = (name: string) => Deno.env.get(PREFIX + name) ?? '';
const DB_URL = secret('DB_URL');
const SB_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// 서버리스라 연결을 적게: 최대 2개, 20초 쉬면 닫음. 트랜잭션 풀러(6543)라 prepare 끔
const db = DB_URL ? postgres(DB_URL, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} }) : null;
type Sql = ReturnType<typeof postgres>;
type Row = Record<string, unknown>;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': METHODS,
    'Access-Control-Max-Age': '600', Vary: 'Origin',
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const route = (req: Request) => {
  const p = new URL(req.url).pathname; const i = p.indexOf('/' + FN);
  return (i < 0 ? '/' : p.slice(i + FN.length + 1)).replace(/\/+$/, '') || '/';
};

// ---------- 표가 없으면 만들기 (콜드 스타트 1회, 동시 요청은 같은 약속을 기다림) ----------
let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    try {
      const rows = await sql.unsafe(CHECK_TABLES) as unknown as Row[];
      const flags = rows[0] ?? {};
      const missingBase = BASE_FLAGS.some((k) => flags[k] !== true);
      if (missingBase) {
        for (const statement of DDL) {
          try { await sql.unsafe(statement); } catch (e) { console.error(FN, 'DDL', (e as Error).message); }
        }
      }
      // v2: 이미 있는 표에 새 칸·새 표를 안전하게 덧붙인다 (멱등).
      const missingV2 = V2_FLAGS.some((k) => flags[k] !== true);
      if (missingBase || missingV2) {
        for (const statement of DDL_V2) {
          try { await sql.unsafe(statement); } catch (e) { console.error(FN, 'DDL_V2', (e as Error).message); }
        }
        // 기본 시즌 — 표에는 한 번만 만들고, 기존 기록·경매는 이 시즌에 그대로 귀속시킨다 (유실 없음)
        await sql`
          insert into carbonic_table.seasons (name, status, note)
          select ${DEFAULT_SEASON}, 'active', '탄소로운 식탁을 처음 시작한 시즌'
          where not exists (select 1 from carbonic_table.seasons)
          on conflict (name) do nothing`;
        await sql`update carbonic_table.activities set season_id = (select min(id) from carbonic_table.seasons) where season_id is null`;
        await sql`update carbonic_table.auctions set season_id = (select min(id) from carbonic_table.seasons) where season_id is null`;
        // 관리자가 하나도 없을 때만 은길님(조은길)을 관리자로 — 나중에 일부러 해제한 것을 되살리지 않는다
        await sql`
          update carbonic_table.members set is_admin = true, updated_at = now()
          where name = '조은길' and not exists (select 1 from carbonic_table.members where is_admin)`;
        // 첫 안내 공지 (공지 칸이 비어 있을 때 한 번)
        await sql`
          insert into carbonic_table.notices (title, body, pinned, author_name)
          select '탄소로운 식탁에 오신 것을 환영해요',
                 E'별무리 사람들이 기후 실천으로 모은 공기를 기록하는 통장입니다.\n\n· 미션을 골라 실천을 남기면 공기가 쌓여요.\n· 쌓인 공기로 플리마켓 물건을 나눠요(공기 경매).\n· 시즌이 바뀌면 기록·랭킹·경매가 새로 시작됩니다.',
                 true, '탄소로운 식탁'
          where not exists (select 1 from carbonic_table.notices)`;
      }
      // 처음 미션 57개 — 시트에서 온 기본 미션은 seed_key 로 한 번만 들어가고, 빠져 있으면 다시 채운다.
      // (관리자가 기본 미션을 지워도 다음 콜드 스타트에 되살아난다 → 기본 미션은 '숨기기'만 쓰도록 안내)
      const values = SEED_MISSIONS.map((_m, i) => `('m${String(i + 1).padStart(2, '0')}', $${i * 2 + 1}, $${i * 2 + 2}, ${i + 1})`).join(',');
      const params = SEED_MISSIONS.flatMap(([name, air]) => [name, air]);
      await sql.unsafe(
        `insert into carbonic_table.missions (seed_key, name, air, sort) values ${values} on conflict (seed_key) do nothing`,
        params as never[],
      );
    } catch (e) {
      console.error(FN, 'ensureSchema', (e as Error).message);
      schemaReady = null; // 다음 요청에서 다시 시도
      throw e;
    }
  })();
  return schemaReady;
}

// ---------- 입력 다듬기 ----------
const clean = (v: unknown, max: number) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanText = (v: unknown, max: number) =>
  String(v ?? '').replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim().slice(0, max);
const intOf = (v: unknown, min: number, max: number): number | null => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const idOf = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!/^\d{1,12}$/.test(s)) throw new HttpError(400, '번호가 올바르지 않습니다.');
  return s;
};
const KST = 9 * 60 * 60 * 1000;
const todayKst = () => new Date(Date.now() + KST).toISOString().slice(0, 10);
function dayOf(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) {
    throw new HttpError(400, '날짜를 YYYY-MM-DD 형식으로 골라 주세요.');
  }
  if (s > todayKst()) throw new HttpError(400, '오늘까지만 실천을 기록할 수 있어요.');
  if (s < '2000-01-01') throw new HttpError(400, '날짜를 다시 확인해 주세요.');
  return s;
}
async function readJson(req: Request): Promise<Record<string, unknown>> {
  const t = await req.text();
  if (t.length > 32768) throw new HttpError(413, '요청이 너무 큽니다.');
  if (!t.trim()) return {};
  try {
    const v = JSON.parse(t);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not object');
    return v as Record<string, unknown>;
  } catch { throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.'); }
}

// ---------- 사람 확인 ----------
const bearer = (req: Request) => /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim() ?? '';
const getUser = (req: Request): Promise<HubUser | null> => checkHubAuth(req);

/** 허브 계정 역할(admin·staff·member). 브라우저와 같은 로그인 토큰으로 profiles 를 읽어 RLS 로 본인 줄만 확인한다. */
async function hubRole(req: Request, user: HubUser | null): Promise<'admin' | 'staff' | 'member' | null> {
  if (!user || !SB_URL || !ANON) return null;
  const token = bearer(req);
  if (!token) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { await r.body?.cancel(); return null; }
    const rows = await r.json() as { role?: string }[];
    const role = rows?.[0]?.role;
    if (role === 'admin' || role === 'staff') return role;
    return role ? 'member' : null;
  } catch { return null; }
}

type Member = {
  user_id: string; email: string; name: string; kind: Kind; is_admin: boolean;
  created_at: string; updated_at: string;
};
async function memberFor(sql: Sql, userId: string): Promise<Member | null> {
  const [m] = await sql`
    select user_id, email, name, kind, is_admin, created_at, updated_at
    from carbonic_table.members where user_id = ${userId}` as unknown as Row[];
  return m ? (m as unknown as Member) : null;
}

type Balance = { earned: number; spent: number; reserved: number; available: number; acts: number };
/** 그 시즌의 총 적립 - 낙찰 확정(spent) - 진행 중 경매에 묶인 내 최고 입찰(reserved) */
async function balanceFor(sql: Sql, userId: string, seasonId: number): Promise<Balance> {
  const [row] = await sql`
    select
      coalesce((select sum(air)::int from carbonic_table.activities where user_id = ${userId} and season_id = ${seasonId}), 0) as earned,
      coalesce((select count(*)::int from carbonic_table.activities where user_id = ${userId} and season_id = ${seasonId}), 0) as acts,
      coalesce((select sum(amount)::int from carbonic_table.bids where user_id = ${userId} and status = 'won'), 0) as spent,
      coalesce((select sum(b.amount)::int from carbonic_table.bids b
                join carbonic_table.auctions a on a.id = b.auction_id
                where b.user_id = ${userId} and b.status = 'active' and a.status = 'open' and a.season_id = ${seasonId}), 0) as reserved` as unknown as Row[];
  const earned = Number(row?.earned ?? 0), acts = Number(row?.acts ?? 0);
  const spent = Number(row?.spent ?? 0), reserved = Number(row?.reserved ?? 0);
  return { earned, acts, spent, reserved, available: earned - spent - reserved };
}

/** 시즌 목록 + 시즌별 합계 */
type SeasonRow = {
  id: number; name: string; status: string; note: string; created_at: unknown; ended_at: unknown;
  created_by_name: string; air: number; count: number; people: number; auctions: number;
};
async function listSeasons(sql: Sql): Promise<SeasonRow[]> {
  const rows = await sql`
    select s.id, s.name, s.status, s.note, s.created_at, s.ended_at, s.created_by_name,
           coalesce(t.air, 0)::int as air, coalesce(t.cnt, 0)::int as count, coalesce(t.people, 0)::int as people,
           coalesce(u.n, 0)::int as auctions
    from carbonic_table.seasons s
    left join (select season_id, sum(air)::int as air, count(*)::int as cnt, count(distinct user_id)::int as people
               from carbonic_table.activities group by season_id) t on t.season_id = s.id
    left join (select season_id, count(*)::int as n from carbonic_table.auctions group by season_id) u on u.season_id = s.id
    order by s.id asc` as unknown as Row[];
  return rows.map((r) => ({
    id: Number(r.id), name: String(r.name ?? ''), status: String(r.status ?? ''),
    note: String(r.note ?? ''), created_at: r.created_at ?? null, ended_at: r.ended_at ?? null,
    created_by_name: String(r.created_by_name ?? ''),
    air: Number(r.air ?? 0), count: Number(r.count ?? 0), people: Number(r.people ?? 0), auctions: Number(r.auctions ?? 0),
  }));
}
/** 지금 시즌 — 활성 시즌이 없으면 가장 최근 시즌 (앱이 멈추지 않게) */
function currentOf(seasons: SeasonRow[]): SeasonRow | null {
  return seasons.find((s) => s.status === 'active') ?? seasons[seasons.length - 1] ?? null;
}

// ---------- 화면 한 벌 ----------
async function buildState(sql: Sql, req: Request) {
  const url = new URL(req.url);
  const user = await getUser(req);
  const role = await hubRole(req, user);
  let member = user ? await memberFor(sql, user.id) : null;
  // 허브 관리자·교직원은 이 앱에서도 관리자 (자동)
  const hubAdmin = role === 'admin' || role === 'staff';
  if (member && hubAdmin && !member.is_admin) {
    await sql`update carbonic_table.members set is_admin = true, updated_at = now() where user_id = ${member.user_id}`;
    member = { ...member, is_admin: true };
  }
  const isAdmin = Boolean(member?.is_admin) || hubAdmin;

  const seasons = await listSeasons(sql);
  const wanted = Number(url.searchParams.get('season') ?? '');
  const current = currentOf(seasons);
  const season = (Number.isFinite(wanted) && wanted > 0 ? seasons.find((s) => s.id === wanted) : null) ?? current;
  const sid = season ? season.id : 0;

  const balance = member && season ? await balanceFor(sql, member.user_id, sid) : null;

  const [totals] = await sql`
    select count(*)::int as activity_count, coalesce(sum(air), 0)::int as total_air,
            count(distinct user_id)::int as participants
    from carbonic_table.activities where season_id = ${sid}` as unknown as Row[];

  const kindRows = await sql`
    select k.kind,
           coalesce(sum(a.air), 0)::int as air,
           count(a.id)::int as count,
           (select count(*)::int from carbonic_table.members m2 where m2.kind = k.kind) as members,
           count(distinct a.user_id)::int as people
    from (values ('10학년'), ('11학년'), ('12학년'), ('교사')) as k(kind)
    left join carbonic_table.members m on m.kind = k.kind
    left join carbonic_table.activities a on a.user_id = m.user_id and a.season_id = ${sid}
    group by k.kind` as unknown as Row[];
  const byKind = KINDS.map((kind) => {
    const r = kindRows.find((x) => String(x.kind) === kind);
    return {
      kind, air: Number(r?.air ?? 0), count: Number(r?.count ?? 0),
      members: Number(r?.members ?? 0), people: Number(r?.people ?? 0),
    };
  });

  const memberRows = await sql`
    select m.user_id, m.name, m.kind, m.is_admin,
           coalesce(e.earned, 0)::int as earned,
           coalesce(e.acts, 0)::int as acts,
           coalesce(w.spent, 0)::int as spent,
           coalesce(r.reserved, 0)::int as reserved,
           coalesce(e.earned, 0) - coalesce(w.spent, 0) - coalesce(r.reserved, 0) as available,
           e.last_at
    from carbonic_table.members m
    left join (select user_id, sum(air)::int as earned, count(*)::int as acts, max(created_at) as last_at
               from carbonic_table.activities where season_id = ${sid} group by user_id) e on e.user_id = m.user_id
    left join (select b.user_id, sum(b.amount)::int as spent
               from carbonic_table.bids b join carbonic_table.auctions a on a.id = b.auction_id
               where b.status = 'won' and a.season_id = ${sid} group by b.user_id) w on w.user_id = m.user_id
    left join (select b.user_id, sum(b.amount)::int as reserved
               from carbonic_table.bids b join carbonic_table.auctions a on a.id = b.auction_id
               where b.status = 'active' and a.status = 'open' and a.season_id = ${sid} group by b.user_id) r on r.user_id = m.user_id
    order by coalesce(e.earned, 0) desc, coalesce(e.acts, 0) desc, m.name asc` as unknown as Row[];

  const activityRows = await sql`
    select a.id, a.user_id, a.mission_id, a.mission_name, a.air, to_char(a.done_on, 'YYYY-MM-DD') as done_on, a.created_at,
           coalesce(m.name, '') as name, coalesce(m.kind, '') as kind, a.season_id
    from carbonic_table.activities a
    left join carbonic_table.members m on m.user_id = a.user_id
    where a.season_id = ${sid}
    order by a.created_at desc, a.id desc limit 40` as unknown as Row[];

  const reactionRows = await sql`
    select r.activity_id, r.emoji, count(*)::int as n,
           coalesce(bool_or(r.user_id = ${user?.id ?? null}::uuid), false) as mine
    from carbonic_table.activity_reactions r
    join carbonic_table.activities a on a.id = r.activity_id
    where a.season_id = ${sid}
    group by r.activity_id, r.emoji` as unknown as Row[];

  const commentRows = await sql`
    select c.id, c.activity_id, c.user_id, c.name, c.kind, c.body, c.created_at
    from carbonic_table.activity_comments c
    join carbonic_table.activities a on a.id = c.activity_id
    where a.season_id = ${sid}
    order by c.created_at asc, c.id asc limit 400` as unknown as Row[];
  const [commentAgg] = await sql`
    select count(*)::int as n from carbonic_table.activity_comments c
    join carbonic_table.activities a on a.id = c.activity_id
    where a.season_id = ${sid}` as unknown as Row[];

  const missionRows = await sql`
    select id, name, air, active, sort, created_at, seed_key,
           (select count(*)::int from carbonic_table.activities a where a.mission_id = carbonic_table.missions.id) as uses
    from carbonic_table.missions
    where (${isAdmin} or active = true)
    order by sort asc, id asc` as unknown as Row[];

  const noticeRows = await sql`
    select id, title, body, pinned, author_id, author_name, created_at, updated_at
    from carbonic_table.notices
    order by pinned desc, created_at desc, id desc limit 50` as unknown as Row[];

  const auctionRows = await sql`
    select a.id, a.title, a.description, a.start_price, a.min_step, a.status, a.season_id,
           a.highest_bid_id, a.winner_user_id, a.winner_name, a.winning_bid,
           a.created_by, a.created_by_name, a.seller_id, a.seller_name, a.started_at, a.created_at, a.closed_at,
           coalesce(bc.bid_count, 0)::int as bid_count,
           hb.amount as top_amount, hb.bidder_name as top_name, hb.bidder_kind as top_kind, hb.user_id as top_user
    from carbonic_table.auctions a
    left join (select auction_id, count(*)::int as bid_count from carbonic_table.bids group by auction_id) bc on bc.auction_id = a.id
    left join lateral (
      select b.amount, b.bidder_name, b.bidder_kind, b.user_id
      from carbonic_table.bids b where b.auction_id = a.id and b.status = 'active'
      order by b.amount desc, b.id desc limit 1
    ) hb on true
    where a.season_id = ${sid}
    order by (a.status = 'open') desc, (a.status = 'waiting') desc, a.created_at desc
    limit 90` as unknown as Row[];

  const bidRows = await sql`
    select b.id, b.auction_id, b.user_id, b.bidder_name, b.bidder_kind, b.amount, b.status, b.created_at
    from carbonic_table.bids b join carbonic_table.auctions a on a.id = b.auction_id
    where a.season_id = ${sid}
    order by b.created_at desc, b.id desc limit 600` as unknown as Row[];

  const members = memberRows.map((r) => ({
    user_id: String(r.user_id), name: String(r.name ?? ''), kind: String(r.kind ?? ''),
    is_admin: r.is_admin === true,
    earned: Number(r.earned ?? 0), acts: Number(r.acts ?? 0),
    spent: Number(r.spent ?? 0), reserved: Number(r.reserved ?? 0),
    available: Number(r.available ?? 0), last_at: r.last_at ?? null,
  }));
  const myRank = member ? members.findIndex((m) => m.user_id === member!.user_id) + 1 : 0;

  const reactionsOf = (id: string) => {
    const out: Record<string, { n: number; mine: boolean }> = {};
    for (const r of reactionRows) {
      if (String(r.activity_id) !== id) continue;
      out[String(r.emoji)] = { n: Number(r.n ?? 0), mine: r.mine === true };
    }
    return REACTIONS.map((emoji) => ({ emoji, n: out[emoji]?.n ?? 0, mine: out[emoji]?.mine ?? false }));
  };

  return {
    server_time: new Date().toISOString(),
    me: user ? {
      user_id: user.id,
      email: user.email ?? '',
      hub_role: role,
      registered: Boolean(member),
      name: member?.name ?? '',
      kind: member?.kind ?? '',
      is_admin: isAdmin,
      is_operator: isAdmin,
      rank: myRank,
      ...(balance ?? { earned: 0, acts: 0, spent: 0, reserved: 0, available: 0 }),
    } : null,
    season: season ? {
      id: season.id, name: season.name, status: season.status, note: season.note,
      created_at: season.created_at, ended_at: season.ended_at,
      is_current: current?.id === season.id,
      air: season.air, count: season.count, people: season.people, auctions: season.auctions,
    } : null,
    seasons: seasons.map((s) => ({
      id: s.id, name: s.name, status: s.status, note: s.note,
      created_at: s.created_at, ended_at: s.ended_at, created_by_name: s.created_by_name,
      is_current: current?.id === s.id,
      air: s.air, count: s.count, people: s.people, auctions: s.auctions,
    })),
    summary: {
      total_air: Number(totals?.total_air ?? 0),
      activity_count: Number(totals?.activity_count ?? 0),
      participants: Number(totals?.participants ?? 0),
      member_count: members.length,
      comment_count: Number(commentAgg?.n ?? 0),
      reaction_count: reactionRows.reduce((n, r) => n + Number(r.n ?? 0), 0),
    },
    by_kind: byKind,
    members,
    activities: activityRows.map((r) => {
      const id = String(r.id);
      const mine = commentRows.filter((c) => String(c.activity_id) === id);
      return {
        id, user_id: String(r.user_id), name: String(r.name ?? ''), kind: String(r.kind ?? ''),
        mission_id: r.mission_id == null ? null : String(r.mission_id),
        mission: String(r.mission_name ?? ''), air: Number(r.air ?? 0),
        done_on: String(r.done_on ?? ''), created_at: r.created_at,
        reactions: reactionsOf(id),
        comment_count: mine.length,
        comments: mine.slice(-20).map((c) => ({
          id: String(c.id), user_id: String(c.user_id), name: String(c.name ?? ''),
          kind: String(c.kind ?? ''), body: String(c.body ?? ''), created_at: c.created_at,
        })),
      };
    }),
    missions: missionRows.map((r) => ({
      id: String(r.id), name: String(r.name ?? ''), air: Number(r.air ?? 0),
      active: r.active === true, sort: Number(r.sort ?? 0), uses: Number(r.uses ?? 0),
      seeded: r.seed_key != null && String(r.seed_key) !== '',
    })),
    notices: noticeRows.map((r) => ({
      id: String(r.id), title: String(r.title ?? ''), body: String(r.body ?? ''),
      pinned: r.pinned === true, author_name: String(r.author_name ?? ''),
      created_at: r.created_at, updated_at: r.updated_at,
    })),
    auctions: auctionRows.map((r) => ({
      id: String(r.id), title: String(r.title ?? ''), description: String(r.description ?? ''),
      start_price: Number(r.start_price ?? 0), min_step: Number(r.min_step ?? 1), status: String(r.status ?? 'open'),
      season_id: r.season_id == null ? null : Number(r.season_id),
      seller_id: r.seller_id == null ? null : String(r.seller_id),
      seller_name: r.seller_name == null ? '' : String(r.seller_name),
      created_by_name: String(r.created_by_name ?? ''), created_at: r.created_at, closed_at: r.closed_at, started_at: r.started_at,
      winner_name: r.winner_name == null ? null : String(r.winner_name),
      winning_bid: r.winning_bid == null ? null : Number(r.winning_bid),
      bid_count: Number(r.bid_count ?? 0),
      highest: r.top_amount == null ? null : {
        amount: Number(r.top_amount), name: String(r.top_name ?? ''), kind: String(r.top_kind ?? ''),
        user_id: String(r.top_user ?? ''),
      },
      bids: bidRows.filter((b) => String(b.auction_id) === String(r.id)).slice(0, 12).map((b) => ({
        id: String(b.id), user_id: String(b.user_id), name: String(b.bidder_name ?? ''), kind: String(b.bidder_kind ?? ''),
        amount: Number(b.amount ?? 0), status: String(b.status ?? ''), created_at: b.created_at,
      })),
    })),
  };
}

// ---------- 요청 처리 ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const o = req.headers.get('Origin');
  if (o && !ORIGINS.includes(o)) return json(req, 403, { error: '허용되지 않은 출처입니다.' });
  const path = route(req);
  const parts = path.split('/').filter(Boolean);

  try {
    if (path === '/health') {
      // 표준 모양(lib/hub.ts 의 healthJson): 허브 운영 현황이 읽어 앱 상태를 보여 줍니다
      if (!db) return json(req, 503, healthJson(false));
      try { await db`select 1`; } catch { return json(req, 503, healthJson(false)); }
      return json(req, 200, healthJson(true));
    }

    const user = await getUser(req);

    if (path === '/hello') {
      const role = await hubRole(req, user);
      return json(req, 200, { app: SCHEMA, user, hub_role: role, time: new Date().toISOString() });
    }
    if (!db) return json(req, 503, { error: '서버 설정이 아직 끝나지 않았습니다 (DB 연결 정보 없음).', code: 'db_missing' });

    await ensureSchema(db);

    // ---------- 읽기: 누구나 ----------
    if (path === '/state' && req.method === 'GET') {
      return json(req, 200, await buildState(db, req));
    }

    // ---------- 로그인한 사람 ----------
    const isWrite = ['POST', 'PATCH', 'DELETE'].includes(req.method);
    if (isWrite && !user) return json(req, 401, { error: '로그인이 필요합니다. 구글 로그인으로 들어와 주세요.', code: 'login_required' });

    const role = user ? await hubRole(req, user) : null;
    const member = user ? await memberFor(db, user.id) : null;
    const isAdmin = Boolean(member?.is_admin) || role === 'admin' || role === 'staff';
    const requireAdmin = () => {
      if (!isAdmin) throw new HttpError(403, '관리자만 할 수 있어요. (허브 관리자·교직원, 또는 이 앱의 관리자)');
    };
    const seasons = () => listSeasons(db);
    const currentSeasonId = async () => {
      const list = await seasons();
      const cur = currentOf(list);
      if (!cur) throw new HttpError(409, '시즌이 아직 없어요. 관리자가 시즌을 만들면 바로 쓸 수 있어요.');
      return cur.id;
    };

    // 내 정보 등록·수정
    if (path === '/me' && req.method === 'POST') {
      const body = await readJson(req);
      const name = clean(body.name, 20);
      const kind = clean(body.kind, 10) as Kind;
      if (name.length < 1) return json(req, 400, { error: '이름을 적어 주세요.' });
      if (!KINDS.includes(kind)) return json(req, 400, { error: '구분을 골라 주세요. (10학년·11학년·12학년·교사)' });
      const hubAdmin = role === 'admin' || role === 'staff';
      // 첫 회원(관리자가 아무도 없을 때)과 허브 관리자·교직원은 관리자로 — 이미 관리자면 그대로 둔다
      let keepAdmin = Boolean(member?.is_admin) || hubAdmin;
      if (!keepAdmin && !member) {
        const [cnt] = await db`select count(*)::int as n from carbonic_table.members where is_admin` as unknown as Row[];
        keepAdmin = Number(cnt?.n ?? 0) === 0;
      }
      const [row] = await db`
        insert into carbonic_table.members (user_id, email, name, kind, is_admin)
        values (${user!.id}, ${user!.email ?? ''}, ${name}, ${kind}, ${keepAdmin})
        on conflict (user_id) do update set name = excluded.name, kind = excluded.kind,
          email = excluded.email, is_admin = ${keepAdmin}, updated_at = now()
        returning user_id, name, kind, is_admin` as unknown as Row[];
      return json(req, 200, { ok: true, member: row });
    }

    // 실천 등록 — 지금 시즌에 적립
    if (path === '/activities' && req.method === 'POST') {
      const body = await readJson(req);
      const missionId = idOf(body.mission_id);
      const doneOn = dayOf(body.done_on);
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요. (내 통장 → 회원 정보)', code: 'profile_required' });
      const seasonId = await currentSeasonId();

      const result = await db.begin(async (tx) => {
        // 같은 사람의 잔액을 건드리는 일은 회원 줄을 잠가 순서대로 처리한다
        const [m] = await tx`select user_id from carbonic_table.members where user_id = ${user!.id} for update` as unknown as Row[];
        if (!m) throw new HttpError(400, '먼저 이름과 구분을 등록해 주세요.');
        const [mission] = await tx`
          select id, name, air, active from carbonic_table.missions where id = ${missionId}` as unknown as Row[];
        if (!mission) throw new HttpError(404, '그 미션을 찾지 못했어요.');
        if (mission.active !== true) throw new HttpError(409, '지금은 쉬고 있는 미션이에요. 다른 미션을 골라 주세요.');
        const [act] = await tx`
          insert into carbonic_table.activities (user_id, mission_id, mission_name, air, done_on, season_id)
          values (${user!.id}, ${Number(mission.id)}, ${String(mission.name)}, ${Number(mission.air)}, ${doneOn}, ${seasonId})
          returning id, mission_name, air, to_char(done_on, 'YYYY-MM-DD') as done_on, created_at, season_id` as unknown as Row[];
        return act;
      });
      return json(req, 201, {
        ok: true,
        activity: {
          id: String(result.id), mission: String(result.mission_name), air: Number(result.air),
          done_on: String(result.done_on), season_id: Number(result.season_id ?? 0),
        },
      });
    }

    // 실천 기록 지우기 (내 것, 관리자는 남의 것도)
    if (parts[0] === 'activities' && parts[1] && !parts[2] && req.method === 'DELETE') {
      const id = idOf(parts[1]);
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, user_id from carbonic_table.activities where id = ${id} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 기록을 찾지 못했어요.');
        if (String(a.user_id) !== user!.id && !isAdmin) throw new HttpError(403, '내 기록만 지울 수 있어요.');
        await tx`select user_id from carbonic_table.members where user_id = ${String(a.user_id)} for update`;
        await tx`delete from carbonic_table.activities where id = ${id}`;
        return { id: String(a.id) };
      });
      return json(req, 200, { ok: true, ...out });
    }

    // 이모지 반응 켜기/끄기 (회원당 반응별 하나)
    if (parts[0] === 'activities' && parts[1] && parts[2] === 'reactions' && req.method === 'POST') {
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요.', code: 'profile_required' });
      const activityId = idOf(parts[1]);
      const body = await readJson(req);
      const emoji = clean(body.emoji, 8) as Reaction;
      if (!REACTIONS.includes(emoji)) return json(req, 400, { error: '쓸 수 있는 반응이 아니에요. (🌱 👏 💚 🔥)' });
      const [a] = await db`select id from carbonic_table.activities where id = ${activityId}` as unknown as Row[];
      if (!a) return json(req, 404, { error: '그 실천 기록을 찾지 못했어요.' });
      const inserted = await db`
        insert into carbonic_table.activity_reactions (activity_id, user_id, name, emoji)
        values (${activityId}, ${member.user_id}, ${member.name}, ${emoji})
        on conflict (activity_id, user_id, emoji) do nothing
        returning activity_id` as unknown as Row[];
      let on = true;
      if (!inserted.length) {
        await db`delete from carbonic_table.activity_reactions
                 where activity_id = ${activityId} and user_id = ${member.user_id} and emoji = ${emoji}`;
        on = false;
      }
      const [c] = await db`
        select count(*)::int as n from carbonic_table.activity_reactions
        where activity_id = ${activityId} and emoji = ${emoji}` as unknown as Row[];
      return json(req, 200, { ok: true, activity_id: activityId, emoji, on, count: Number(c?.n ?? 0) });
    }

    // 댓글 쓰기
    if (parts[0] === 'activities' && parts[1] && parts[2] === 'comments' && req.method === 'POST') {
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요.', code: 'profile_required' });
      const activityId = idOf(parts[1]);
      const body = await readJson(req);
      const text = cleanText(body.body, 500).replace(/\n{3,}/g, '\n\n');
      if (!text.trim()) return json(req, 400, { error: '댓글 내용을 적어 주세요.' });
      const [a] = await db`select id from carbonic_table.activities where id = ${activityId}` as unknown as Row[];
      if (!a) return json(req, 404, { error: '그 실천 기록을 찾지 못했어요.' });
      const [row] = await db`
        insert into carbonic_table.activity_comments (activity_id, user_id, name, kind, body)
        values (${activityId}, ${member.user_id}, ${member.name}, ${member.kind}, ${text})
        returning id, activity_id, user_id, name, kind, body, created_at` as unknown as Row[];
      const [c] = await db`
        select count(*)::int as n from carbonic_table.activity_comments where activity_id = ${activityId}` as unknown as Row[];
      return json(req, 201, {
        ok: true,
        comment: {
          id: String(row.id), user_id: String(row.user_id), name: String(row.name ?? ''),
          kind: String(row.kind ?? ''), body: String(row.body ?? ''), created_at: row.created_at,
        },
        count: Number(c?.n ?? 0),
      });
    }

    // 내 댓글 지우기 (관리자는 남의 것도)
    if (parts[0] === 'comments' && parts[1] && req.method === 'DELETE') {
      const id = idOf(parts[1]);
      const [c] = await db`select id, user_id, activity_id from carbonic_table.activity_comments where id = ${id}` as unknown as Row[];
      if (!c) return json(req, 404, { error: '그 댓글을 찾지 못했어요.' });
      if (String(c.user_id) !== user!.id && !isAdmin) return json(req, 403, { error: '내 댓글만 지울 수 있어요.' });
      await db`delete from carbonic_table.activity_comments where id = ${id}`;
      return json(req, 200, { ok: true, deleted: id, activity_id: String(c.activity_id) });
    }

    // ---------- 관리자 ----------
    // 공지
    if (path === '/notices' && req.method === 'POST') {
      requireAdmin();
      const body = await readJson(req);
      const title = clean(body.title, 80);
      const text = cleanText(body.body, 2000);
      const pinned = body.pinned === true;
      if (!title) return json(req, 400, { error: '공지 제목을 적어 주세요.' });
      const byName = member?.name || clean(user!.email ?? '', 40) || '관리자';
      const [row] = await db`
        insert into carbonic_table.notices (title, body, pinned, author_id, author_name)
        values (${title}, ${text}, ${pinned}, ${user!.id}, ${byName})
        returning id, title, body, pinned, author_name, created_at, updated_at` as unknown as Row[];
      return json(req, 201, { ok: true, notice: row });
    }

    if (parts[0] === 'notices' && parts[1] && req.method === 'PATCH') {
      requireAdmin();
      const id = idOf(parts[1]);
      const body = await readJson(req);
      const patch: string[] = [];
      const values: unknown[] = [];
      if (body.title !== undefined) {
        const title = clean(body.title, 80);
        if (!title) return json(req, 400, { error: '공지 제목을 적어 주세요.' });
        values.push(title); patch.push(`title = $${values.length}`);
      }
      if (body.body !== undefined) {
        const text = cleanText(body.body, 2000);
        values.push(text); patch.push(`body = $${values.length}`);
      }
      if (body.pinned !== undefined) {
        if (typeof body.pinned !== 'boolean') return json(req, 400, { error: 'pinned 는 true/false 여야 합니다.' });
        values.push(body.pinned); patch.push(`pinned = $${values.length}`);
      }
      if (!patch.length) return json(req, 400, { error: '바꿀 내용이 없습니다.' });
      values.push(Number(id));
      const [row] = await db.unsafe(
        `update carbonic_table.notices set ${patch.join(', ')}, updated_at = now() where id = $${values.length}
         returning id, title, body, pinned, author_name, created_at, updated_at`,
        values as never[],
      ) as unknown as Row[];
      if (!row) return json(req, 404, { error: '그 공지를 찾지 못했어요.' });
      return json(req, 200, { ok: true, notice: row });
    }

    if (parts[0] === 'notices' && parts[1] && req.method === 'DELETE') {
      requireAdmin();
      const id = idOf(parts[1]);
      const [row] = await db`delete from carbonic_table.notices where id = ${id} returning id` as unknown as Row[];
      if (!row) return json(req, 404, { error: '그 공지를 찾지 못했어요.' });
      return json(req, 200, { ok: true, deleted: id });
    }

    // 시즌
    if (path === '/seasons' && req.method === 'POST') {
      requireAdmin();
      const body = await readJson(req);
      const name = clean(body.name, 40);
      const note = cleanText(body.note, 200);
      if (!name) return json(req, 400, { error: '시즌 이름을 적어 주세요. (예: 2026 시즌 2)' });
      const byName = member?.name || '관리자';
      const [dup] = await db`select id from carbonic_table.seasons where name = ${name}` as unknown as Row[];
      if (dup) return json(req, 409, { error: '같은 이름의 시즌이 이미 있어요.' });
      const [row] = await db`
        insert into carbonic_table.seasons (name, status, note, created_by, created_by_name)
        values (${name}, 'planned', ${note}, ${user!.id}, ${byName})
        returning id, name, status, note, created_at` as unknown as Row[];
      return json(req, 201, { ok: true, season: row });
    }

    if (parts[0] === 'seasons' && parts[1] && parts[2] === 'activate' && req.method === 'POST') {
      requireAdmin();
      const id = idOf(parts[1]);
      const out = await db.begin(async (tx) => {
        const [s] = await tx`select id, name, status from carbonic_table.seasons where id = ${id} for update` as unknown as Row[];
        if (!s) throw new HttpError(404, '그 시즌을 찾지 못했어요.');
        await tx`update carbonic_table.seasons set status = 'ended', ended_at = now()
                 where status = 'active' and id <> ${id}`;
        const [row] = await tx`update carbonic_table.seasons set status = 'active', ended_at = null
                 where id = ${id} returning id, name, status` as unknown as Row[];
        return { season: row };
      });
      return json(req, 200, { ok: true, ...out });
    }

    if (parts[0] === 'seasons' && parts[1] && !parts[2] && req.method === 'DELETE') {
      requireAdmin();
      const id = idOf(parts[1]);
      const [s] = await db`select id, name, status from carbonic_table.seasons where id = ${id}` as unknown as Row[];
      if (!s) return json(req, 404, { error: '그 시즌을 찾지 못했어요.' });
      if (String(s.status) === 'active') return json(req, 409, { error: '진행 중인 시즌은 지울 수 없어요. 다른 시즌으로 전환하거나 먼저 종료해 주세요.' });
      const [c] = await db`
        select (select count(*)::int from carbonic_table.activities where season_id = ${id}) as acts,
               (select count(*)::int from carbonic_table.auctions where season_id = ${id}) as aucs,
               (select count(*)::int from carbonic_table.seasons) as total` as unknown as Row[];
      if (Number(c?.total ?? 0) <= 1) return json(req, 409, { error: '마지막 시즌은 지울 수 없어요.' });
      if (Number(c?.acts ?? 0) > 0 || Number(c?.aucs ?? 0) > 0) {
        return json(req, 409, { error: '실천 기록이나 경매가 있는 시즌은 지울 수 없어요. 기록은 그대로 보관해 주세요.' });
      }
      await db`delete from carbonic_table.seasons where id = ${id}`;
      return json(req, 200, { ok: true, deleted: id });
    }

    if (parts[0] === 'seasons' && parts[1] && parts[2] === 'end' && req.method === 'POST') {
      requireAdmin();
      const id = idOf(parts[1]);
      const [s] = await db`select id, status from carbonic_table.seasons where id = ${id}` as unknown as Row[];
      if (!s) return json(req, 404, { error: '그 시즌을 찾지 못했어요.' });
      if (String(s.status) === 'ended') return json(req, 409, { error: '이미 끝난 시즌이에요.' });
      const [row] = await db`update carbonic_table.seasons set status = 'ended', ended_at = now()
               where id = ${id} returning id, name, status` as unknown as Row[];
      return json(req, 200, { ok: true, season: row });
    }

    // 미션
    if (parts[0] === 'missions' && req.method === 'POST') {
      requireAdmin();
      const body = await readJson(req);
      const name = clean(body.name, 120);
      const air = intOf(body.air, 1, 100);
      if (name.length < 1) return json(req, 400, { error: '미션 이름을 적어 주세요.' });
      if (air == null) return json(req, 400, { error: '공기는 1~100 사이 숫자로 적어 주세요.' });
      const [max] = await db`select coalesce(max(sort), 0)::int as s from carbonic_table.missions` as unknown as Row[];
      const [row] = await db`
        insert into carbonic_table.missions (name, air, sort) values (${name}, ${air}, ${Number(max?.s ?? 0) + 1})
        returning id, name, air, active` as unknown as Row[];
      return json(req, 201, { ok: true, mission: row });
    }

    if (parts[0] === 'missions' && parts[1] && req.method === 'PATCH') {
      requireAdmin();
      const id = idOf(parts[1]);
      const body = await readJson(req);
      const patch: string[] = [];
      const values: unknown[] = [];
      if (body.name !== undefined) {
        const name = clean(body.name, 120);
        if (name.length < 1) return json(req, 400, { error: '미션 이름을 적어 주세요.' });
        values.push(name); patch.push(`name = $${values.length}`);
      }
      if (body.air !== undefined) {
        const air = intOf(body.air, 1, 100);
        if (air == null) return json(req, 400, { error: '공기는 1~100 사이 숫자로 적어 주세요.' });
        values.push(air); patch.push(`air = $${values.length}`);
      }
      if (body.active !== undefined) {
        if (typeof body.active !== 'boolean') return json(req, 400, { error: 'active 는 true/false 여야 합니다.' });
        values.push(body.active); patch.push(`active = $${values.length}`);
      }
      if (!patch.length) return json(req, 400, { error: '바꿀 내용이 없습니다.' });
      values.push(Number(id));
      const [row] = await db.unsafe(
        `update carbonic_table.missions set ${patch.join(', ')} where id = $${values.length} returning id, name, air, active`,
        values as never[],
      ) as unknown as Row[];
      if (!row) return json(req, 404, { error: '그 미션을 찾지 못했어요.' });
      return json(req, 200, { ok: true, mission: row });
    }

    // 실천 기록이 없는 미션만 지울 수 있다 (기록이 있으면 숨기기만)
    if (parts[0] === 'missions' && parts[1] && req.method === 'DELETE') {
      requireAdmin();
      const id = idOf(parts[1]);
      const [m] = await db`select id, seed_key from carbonic_table.missions where id = ${id}` as unknown as Row[];
      if (!m) return json(req, 404, { error: '그 미션을 찾지 못했어요.' });
      if (m.seed_key != null && String(m.seed_key) !== '') {
        return json(req, 409, { error: '시트에서 온 기본 미션은 지우지 말고 숨겨 주세요.' });
      }
      const [u] = await db`select count(*)::int as n from carbonic_table.activities where mission_id = ${id}` as unknown as Row[];
      if (Number(u?.n ?? 0) > 0) return json(req, 409, { error: '이 미션으로 등록한 실천이 있어요. 지우지 말고 숨겨 주세요.' });
      const [row] = await db`delete from carbonic_table.missions where id = ${id} returning id, name` as unknown as Row[];
      if (!row) return json(req, 404, { error: '그 미션을 찾지 못했어요.' });
      return json(req, 200, { ok: true, deleted: String(row.id) });
    }

    // ---------- 경매 ----------
    // 물품 등록 — 로그인한 회원이면 누구나. 바로 입찰되지 않고 waiting(대기·미리보기)으로 올라간다.
    if (parts[0] === 'auctions' && parts.length === 1 && req.method === 'POST') {
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요.', code: 'profile_required' });
      const body = await readJson(req);
      const title = clean(body.title, 60);
      const description = cleanText(body.description, 300);
      const startPrice = intOf(body.start_price, 1, 100000);
      const minStep = intOf(body.min_step, 1, 10000);
      if (title.length < 1) return json(req, 400, { error: '물품 이름을 적어 주세요.' });
      if (startPrice == null) return json(req, 400, { error: '시작가를 1공기 이상으로 적어 주세요.' });
      if (minStep == null) return json(req, 400, { error: '최소 입찰 단위를 1공기 이상으로 적어 주세요.' });
      const seasonId = await currentSeasonId();
      const [row] = await db`
        insert into carbonic_table.auctions
          (title, description, start_price, min_step, status, season_id, seller_id, seller_name, created_by, created_by_name)
        values (${title}, ${description}, ${startPrice}, ${minStep}, 'waiting', ${seasonId},
                ${member.user_id}, ${member.name}, ${member.user_id}, ${member.name})
        returning id, title, description, start_price, min_step, status, season_id, seller_name, created_at` as unknown as Row[];
      return json(req, 201, { ok: true, auction: row });
    }

    // 대기 중 물품 고치기 (등록자 본인 또는 관리자)
    if (parts[0] === 'auctions' && parts[1] && !parts[2] && req.method === 'PATCH') {
      const auctionId = idOf(parts[1]);
      const body = await readJson(req);
      const patch: string[] = [];
      const values: unknown[] = [];
      if (body.title !== undefined) {
        const title = clean(body.title, 60);
        if (!title) return json(req, 400, { error: '물품 이름을 적어 주세요.' });
        values.push(title); patch.push(`title = $${values.length}`);
      }
      if (body.description !== undefined) { values.push(cleanText(body.description, 300)); patch.push(`description = $${values.length}`); }
      if (body.start_price !== undefined) {
        const p = intOf(body.start_price, 1, 100000);
        if (p == null) return json(req, 400, { error: '시작가를 1공기 이상으로 적어 주세요.' });
        values.push(p); patch.push(`start_price = $${values.length}`);
      }
      if (body.min_step !== undefined) {
        const s = intOf(body.min_step, 1, 10000);
        if (s == null) return json(req, 400, { error: '최소 입찰 단위를 1공기 이상으로 적어 주세요.' });
        values.push(s); patch.push(`min_step = $${values.length}`);
      }
      if (!patch.length) return json(req, 400, { error: '바꿀 내용이 없습니다.' });
      const [a] = await db`select id, status, seller_id from carbonic_table.auctions where id = ${auctionId}` as unknown as Row[];
      if (!a) return json(req, 404, { error: '그 경매를 찾지 못했어요.' });
      const mine = a.seller_id != null && String(a.seller_id) === user!.id;
      if (!isAdmin && !mine) return json(req, 403, { error: '등록한 본인이나 관리자만 고칠 수 있어요.' });
      if (String(a.status) !== 'waiting') {
        return json(req, 409, { error: '경매가 시작된 뒤에는 고칠 수 없어요. 관리자에게 문의해 주세요.' });
      }
      values.push(Number(auctionId));
      const [row] = await db.unsafe(
        `update carbonic_table.auctions set ${patch.join(', ')} where id = $${values.length}
         returning id, title, description, start_price, min_step, status, season_id, seller_name`,
        values as never[],
      ) as unknown as Row[];
      return json(req, 200, { ok: true, auction: row });
    }

    // 대기 → 경매 시작 (관리자)
    if (parts[0] === 'auctions' && parts[1] && parts[2] === 'start' && req.method === 'POST') {
      requireAdmin();
      const auctionId = idOf(parts[1]);
      const seasonId = await currentSeasonId();
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status, title from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (String(a.status) !== 'waiting') throw new HttpError(409, '대기 중인 물품만 경매를 시작할 수 있어요.');
        const [row] = await tx`
          update carbonic_table.auctions set status = 'open', started_at = now(), season_id = ${seasonId}
          where id = ${auctionId}
          returning id, title, status, season_id, started_at` as unknown as Row[];
        return { auction: row };
      });
      return json(req, 200, { ok: true, ...out });
    }

    // 입찰 — 트랜잭션 + 행 잠금으로 동시 입찰·잔액 초과를 막는다
    if (parts[0] === 'auctions' && parts[1] && parts[2] === 'bid' && req.method === 'POST') {
      const auctionId = idOf(parts[1]);
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요.', code: 'profile_required' });
      const body = await readJson(req);
      const amount = intOf(body.amount, 1, 100000);
      if (amount == null) return json(req, 400, { error: '입찰 공기를 1 이상 숫자로 적어 주세요.' });

      const out = await db.begin(async (tx) => {
        // ① 이 경매를 잠근다 → 같은 경매 입찰은 한 줄로 줄을 선다
        const [a] = await tx`
          select id, status, start_price, min_step, title, season_id, seller_id
          from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (String(a.status) !== 'open') {
          throw new HttpError(409, String(a.status) === 'waiting'
            ? '아직 관리자가 경매를 시작하지 않은 물품이에요. 대기 중 목록에서 구경할 수 있어요.'
            : '이미 마감되었거나 취소된 경매예요.');
        }
        if (a.seller_id != null && String(a.seller_id) === user!.id) {
          throw new HttpError(409, '내가 올린 물품에는 입찰할 수 없어요.');
        }

        // ② 이 회원 줄을 잠근다 → 여러 경매에 동시에 입찰해도 사용 가능 공기를 넘지 않는다
        const [m] = await tx`select user_id from carbonic_table.members where user_id = ${user!.id} for update` as unknown as Row[];
        if (!m) throw new HttpError(400, '먼저 이름과 구분을 등록해 주세요.');

        // ③ 지금 최고 입찰(active) 한 줄을 잠근다 (밀려난 사람의 예약은 그 줄이 outbid 되는 순간 풀린다)
        const active = await tx`
          select id, user_id, bidder_name, amount from carbonic_table.bids
          where auction_id = ${auctionId} and status = 'active' order by amount desc, id desc for update` as unknown as Row[];
        const top = active[0];
        const mineTop = top && String(top.user_id) === user!.id ? top : null;
        const minAllowed = top ? Number(top.amount) + Number(a.min_step) : Number(a.start_price);
        if (amount < minAllowed) {
          throw new HttpError(400, top
            ? `지금 최고 입찰가 ${Number(top.amount)}공기보다 ${Number(a.min_step)}공기 높은 ${minAllowed}공기부터 입찰할 수 있어요.`
            : `시작가 ${Number(a.start_price)}공기부터 입찰할 수 있어요.`);
        }

        const seasonId = Number(a.season_id ?? 0);
        const [b] = await tx`
          select
            coalesce((select sum(air)::int from carbonic_table.activities where user_id = ${user!.id} and season_id = ${seasonId}), 0) as earned,
            coalesce((select sum(amount)::int from carbonic_table.bids where user_id = ${user!.id} and status = 'won'), 0) as spent,
            coalesce((select sum(b.amount)::int from carbonic_table.bids b
                      join carbonic_table.auctions a on a.id = b.auction_id
                      where b.user_id = ${user!.id} and b.status = 'active' and a.status = 'open'
                        and a.season_id = ${seasonId}), 0) as reserved` as unknown as Row[];
        const earned = Number(b?.earned ?? 0), spent = Number(b?.spent ?? 0), reserved = Number(b?.reserved ?? 0);
        // 내가 이 경매에서 이미 최고 입찰자라면 그 예약은 새 입찰로 바뀌므로 함께 쓸 수 있다
        const available = earned - spent - reserved + (mineTop ? Number(mineTop.amount) : 0);
        if (amount > available) {
          throw new HttpError(400, `이 시즌에 쓸 수 있는 공기는 ${available}공기예요. (총 적립 ${earned} · 낙찰 ${spent} · 경매에 묶인 공기 ${reserved - (mineTop ? Number(mineTop.amount) : 0)})`);
        }

        if (top) await tx`update carbonic_table.bids set status = 'outbid' where id = ${Number(top.id)}`;
        const [bid] = await tx`
          insert into carbonic_table.bids (auction_id, user_id, bidder_name, bidder_kind, amount)
          values (${auctionId}, ${user!.id}, ${member!.name}, ${member!.kind}, ${amount})
          returning id, amount, created_at` as unknown as Row[];
        await tx`update carbonic_table.auctions set highest_bid_id = ${Number(bid.id)} where id = ${auctionId}`;
        return {
          bid: { id: String(bid.id), amount: Number(bid.amount) },
          outbid: top && String(top.user_id) !== user!.id ? { name: String(top.bidder_name ?? ''), amount: Number(top.amount) } : null,
          available_after: available - amount,
        };
      });
      return json(req, 201, { ok: true, ...out });
    }

    if (parts[0] === 'auctions' && parts[1] && parts[2] === 'close' && req.method === 'POST') {
      requireAdmin();
      const auctionId = idOf(parts[1]);
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status, title from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (String(a.status) !== 'open') throw new HttpError(409, '이미 마감되었거나 취소된 경매예요.');
        const [top] = await tx`
          select id, user_id, bidder_name, bidder_kind, amount from carbonic_table.bids
          where auction_id = ${auctionId} and status = 'active' order by amount desc, id desc limit 1 for update` as unknown as Row[];
        if (top) {
          await tx`update carbonic_table.bids set status = 'won' where id = ${Number(top.id)}`;
          await tx`update carbonic_table.bids set status = 'lost' where auction_id = ${auctionId} and status = 'active' and id <> ${Number(top.id)}`;
          await tx`
            update carbonic_table.auctions set status = 'closed', closed_at = now(),
              winner_user_id = ${String(top.user_id)}, winner_name = ${String(top.bidder_name)}, winning_bid = ${Number(top.amount)}
            where id = ${auctionId}`;
          return { result: 'won', winner: String(top.bidder_name), amount: Number(top.amount) };
        }
        await tx`update carbonic_table.auctions set status = 'closed', closed_at = now() where id = ${auctionId}`;
        return { result: 'unsold' };
      });
      return json(req, 200, { ok: true, ...out });
    }

    if (parts[0] === 'auctions' && parts[1] && parts[2] === 'cancel' && req.method === 'POST') {
      requireAdmin();
      const auctionId = idOf(parts[1]);
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (!['waiting', 'open'].includes(String(a.status))) throw new HttpError(409, '이미 마감되었거나 취소된 경매예요.');
        // 진행 중 입찰의 예약을 풀어 준다
        await tx`update carbonic_table.bids set status = 'canceled' where auction_id = ${auctionId} and status = 'active'`;
        await tx`update carbonic_table.auctions set status = 'canceled', closed_at = now() where id = ${auctionId}`;
        return { canceled: auctionId };
      });
      return json(req, 200, { ok: true, ...out });
    }

    if (parts[0] === 'auctions' && parts[1] && !parts[2] && req.method === 'DELETE') {
      const auctionId = idOf(parts[1]);
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status, seller_id from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        const mineWaiting = String(a.status) === 'waiting' && a.seller_id != null && String(a.seller_id) === user!.id;
        if (!isAdmin && !mineWaiting) throw new HttpError(403, '관리자만 지울 수 있어요. (대기 중인 내 물품은 직접 지울 수 있어요)');
        const [c] = await tx`select count(*)::int as n from carbonic_table.bids where auction_id = ${auctionId}` as unknown as Row[];
        // 낙찰 기록이 남은 경매를 지우면 회원의 사용 공기가 달라진다 → 취소했거나 입찰이 없을 때만 지운다
        // 진행 중인 경매에 입찰이 있으면 먼저 취소해야 한다 (마감·취소된 경매는 정리할 수 있음)
        if (Number(c?.n ?? 0) > 0 && String(a.status) === 'open') {
          throw new HttpError(409, '진행 중인 경매는 먼저 취소한 뒤에 지울 수 있어요.');
        }
        await tx`delete from carbonic_table.bids where auction_id = ${auctionId}`;
        await tx`delete from carbonic_table.auctions where id = ${auctionId}`;
        return { deleted: auctionId };
      });
      return json(req, 200, { ok: true, ...out });
    }

    // ---------- 회원 관리 ----------
    if (parts[0] === 'members' && parts[1] && req.method === 'PATCH') {
      requireAdmin();
      const target = parts[1];
      if (!/^[0-9a-fA-F-]{36}$/.test(target)) return json(req, 400, { error: '회원 아이디가 올바르지 않습니다.' });
      const body = await readJson(req);
      const [t] = await db`select user_id, name, kind, is_admin from carbonic_table.members where user_id = ${target}` as unknown as Row[];
      if (!t) return json(req, 404, { error: '그 회원을 찾지 못했어요.' });
      const patch: string[] = [];
      const values: unknown[] = [];
      if (body.kind !== undefined) {
        const kind = clean(body.kind, 10) as Kind;
        if (!KINDS.includes(kind)) return json(req, 400, { error: '구분을 골라 주세요. (10학년·11학년·12학년·교사)' });
        values.push(kind); patch.push(`kind = $${values.length}`);
      }
      if (body.is_admin !== undefined) {
        if (typeof body.is_admin !== 'boolean') return json(req, 400, { error: 'is_admin 은 true/false 여야 합니다.' });
        if (body.is_admin === false) {
          const [admins] = await db`select count(*)::int as n from carbonic_table.members where is_admin` as unknown as Row[];
          if (Number(admins?.n ?? 0) <= 1 && t.is_admin === true) {
            return json(req, 409, { error: '마지막 관리자의 권한은 풀 수 없어요. 다른 회원을 먼저 관리자로 지정해 주세요.' });
          }
        }
        values.push(body.is_admin); patch.push(`is_admin = $${values.length}`);
      }
      if (!patch.length) return json(req, 400, { error: '바꿀 내용이 없습니다.' });
      values.push(target);
      const [row] = await db.unsafe(
        `update carbonic_table.members set ${patch.join(', ')}, updated_at = now() where user_id = $${values.length}
         returning user_id, name, kind, is_admin`,
        values as never[],
      ) as unknown as Row[];
      return json(req, 200, { ok: true, member: row });
    }

    if (parts[0] === 'members' && parts[1] && req.method === 'DELETE') {
      requireAdmin();
      const target = parts[1];
      if (!/^[0-9a-fA-F-]{36}$/.test(target)) return json(req, 400, { error: '회원 아이디가 올바르지 않습니다.' });
      const [c] = await db`
        select (select count(*)::int from carbonic_table.activities where user_id = ${target}) as acts,
               (select count(*)::int from carbonic_table.bids where user_id = ${target}) as bids` as unknown as Row[];
      if (Number(c?.acts ?? 0) > 0 || Number(c?.bids ?? 0) > 0) {
        return json(req, 409, { error: '실천 기록이나 입찰 기록이 있는 회원은 지울 수 없어요.' });
      }
      await db`delete from carbonic_table.members where user_id = ${target}`;
      return json(req, 200, { ok: true, deleted: target });
    }

    return json(req, 404, { error: '없는 경로입니다.' });
  } catch (e) {
    if (e instanceof HttpError) return json(req, e.status, { error: e.message });
    const err = e as { code?: string; message?: string };
    console.error(FN, err?.code ?? '', err?.message ?? String(e));
    return json(req, 500, { error: '서버 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.', code: err?.code });
  }
});
