// carbonic-table-fn — 탄소로운 식탁 서버 함수
//
// 주소: https://psupfmarnyxontorftio.supabase.co/functions/v1/carbonic-table-fn/<경로>
//
//   GET   /health                       DB 연결 확인 (허브 표준 healthJson)
//   GET   /hello                        부른 사람과 운영자 여부
//   GET   /state                        화면 한 벌 — 총합·학년별·회원별·피드·경매 (로그인 없이도 열람)
//   POST  /me          {name, kind}     내 회원 정보 등록·수정 (로그인 필요)
//   POST  /activities  {mission_id, done_on}   실천 등록 → 공기 적립
//   DEL   /activities/:id               내 실천 기록 지우기 (운영자는 남의 것도)
//   POST  /missions    {name, air}      미션 추가 (운영자)
//   PATCH /missions/:id {name?, air?, active?}  미션 고치기·숨기기 (운영자)
//   POST  /auctions    {title, description?, start_price, min_step}  경매 올리기 (운영자)
//   POST  /auctions/:id/bid {amount}    입찰 — 트랜잭션 + FOR UPDATE 로 경합·초과 입찰 방지
//   POST  /auctions/:id/close           마감(낙찰 확정) (운영자)
//   POST  /auctions/:id/cancel          취소 (운영자)
//   DEL   /auctions/:id                 취소했거나 입찰이 없는 경매 지우기 (운영자)
//   DEL   /members/:user_id             기록이 없는 회원 정리 (운영자)
//
// 함수는 이 앱 전용 DB 계정(carbonic_table_fn, 개발자 계정 carbonic_table_dev 의 권한을 물려받음)으로 접속해
// RLS 를 거치지 않습니다. 그래서 누가 무엇을 할 수 있는지는 이 파일에서 직접 확인합니다.
// 브라우저는 표를 직접 읽지 않고(표 권한을 주지 않음) 모두 이 함수를 거칩니다.
import postgres from 'npm:postgres@3.4.5';
import { checkHubAuth, healthJson, type HubUser } from './lib/hub.ts';
import { CHECK_TABLES, DDL, SEED_MISSIONS } from './schema.ts';

const FN = 'carbonic-table-fn';
const SCHEMA = 'carbonic_table';
const PREFIX = 'CARBONIC_TABLE_';
const ORIGINS = ['https://apps.bmrschool.net', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const KINDS = ['10학년', '11학년', '12학년', '교사'] as const;
type Kind = (typeof KINDS)[number];

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
      const missing = ['members', 'missions', 'activities', 'auctions', 'bids'].some((k) => flags[k] !== true);
      if (missing) {
        for (const statement of DDL) {
          try { await sql.unsafe(statement); } catch (e) { console.error(FN, 'DDL', (e as Error).message); }
        }
      }
      // 처음 미션 57개 — 시트에서 온 기본 미션은 seed_key 로 한 번만 들어가고, 빠져 있으면 다시 채운다.
      // (운영자가 기본 미션을 지워도 다음 콜드 스타트에 되살아난다 → 기본 미션은 '숨기기'만 쓰도록 안내)
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
  if (t.length > 16384) throw new HttpError(413, '요청이 너무 큽니다.');
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

type Member = { user_id: string; email: string; name: string; kind: Kind; created_at: string; updated_at: string };
async function memberFor(sql: Sql, userId: string): Promise<Member | null> {
  const [m] = await sql`
    select user_id, email, name, kind, created_at, updated_at
    from carbonic_table.members where user_id = ${userId}` as unknown as Row[];
  return m ? (m as unknown as Member) : null;
}

type Balance = { earned: number; spent: number; reserved: number; available: number };
/** 총 적립 - 낙찰 확정(spent) - 진행 중 경매에 묶인 내 최고 입찰(reserved) */
async function balanceFor(sql: Sql, userId: string): Promise<Balance> {
  const [row] = await sql`
    select
      coalesce((select sum(air)::int from carbonic_table.activities where user_id = ${userId}), 0) as earned,
      coalesce((select sum(amount)::int from carbonic_table.bids where user_id = ${userId} and status = 'won'), 0) as spent,
      coalesce((select sum(b.amount)::int from carbonic_table.bids b
                join carbonic_table.auctions a on a.id = b.auction_id
                where b.user_id = ${userId} and b.status = 'active' and a.status = 'open'), 0) as reserved` as unknown as Row[];
  const earned = Number(row?.earned ?? 0), spent = Number(row?.spent ?? 0), reserved = Number(row?.reserved ?? 0);
  return { earned, spent, reserved, available: earned - spent - reserved };
}

// ---------- 화면 한 벌 ----------
async function buildState(sql: Sql, req: Request) {
  const user = await getUser(req);
  const role = await hubRole(req, user);
  const member = user ? await memberFor(sql, user.id) : null;
  const isOperator = Boolean(member && member.kind === '교사') || role === 'admin' || role === 'staff';
  const balance = member ? await balanceFor(sql, member.user_id) : null;

  const [totals] = await sql`
    select count(*)::int as activity_count, coalesce(sum(air), 0)::int as total_air,
            count(distinct user_id)::int as participants
    from carbonic_table.activities` as unknown as Row[];

  const kindRows = await sql`
    select k.kind,
           coalesce(sum(a.air), 0)::int as air,
           count(a.id)::int as count,
           count(distinct m.user_id)::int as members
    from (values ('10학년'), ('11학년'), ('12학년'), ('교사')) as k(kind)
    left join carbonic_table.members m on m.kind = k.kind
    left join carbonic_table.activities a on a.user_id = m.user_id
    group by k.kind` as unknown as Row[];
  const byKind = KINDS.map((kind) => {
    const r = kindRows.find((x) => String(x.kind) === kind);
    return { kind, air: Number(r?.air ?? 0), count: Number(r?.count ?? 0), members: Number(r?.members ?? 0) };
  });

  const memberRows = await sql`
    select m.user_id, m.name, m.kind,
           coalesce(e.earned, 0)::int as earned,
           coalesce(w.spent, 0)::int as spent,
           coalesce(r.reserved, 0)::int as reserved,
           coalesce(e.earned, 0) - coalesce(w.spent, 0) - coalesce(r.reserved, 0) as available,
           e.last_at
    from carbonic_table.members m
    left join (select user_id, sum(air)::int as earned, max(created_at) as last_at
               from carbonic_table.activities group by user_id) e on e.user_id = m.user_id
    left join (select user_id, sum(amount)::int as spent
               from carbonic_table.bids where status = 'won' group by user_id) w on w.user_id = m.user_id
    left join (select b.user_id, sum(b.amount)::int as reserved
               from carbonic_table.bids b join carbonic_table.auctions a on a.id = b.auction_id
               where b.status = 'active' and a.status = 'open' group by b.user_id) r on r.user_id = m.user_id
    order by coalesce(e.earned, 0) desc, m.name asc` as unknown as Row[];

  const activityRows = await sql`
    select a.id, a.user_id, a.mission_id, a.mission_name, a.air, to_char(a.done_on, 'YYYY-MM-DD') as done_on, a.created_at,
           coalesce(m.name, '') as name, coalesce(m.kind, '') as kind
    from carbonic_table.activities a
    left join carbonic_table.members m on m.user_id = a.user_id
    order by a.created_at desc, a.id desc limit 40` as unknown as Row[];

  const missionRows = await sql`
    select id, name, air, active, sort, created_at, seed_key,
           (select count(*)::int from carbonic_table.activities a where a.mission_id = carbonic_table.missions.id) as uses
    from carbonic_table.missions
    where (${isOperator} or active = true)
    order by sort asc, id asc` as unknown as Row[];

  const auctionRows = await sql`
    select a.id, a.title, a.description, a.start_price, a.min_step, a.status,
           a.highest_bid_id, a.winner_user_id, a.winner_name, a.winning_bid,
           a.created_by_name, a.created_at, a.closed_at,
           coalesce(bc.bid_count, 0)::int as bid_count,
           hb.amount as top_amount, hb.bidder_name as top_name, hb.bidder_kind as top_kind, hb.user_id as top_user
    from carbonic_table.auctions a
    left join (select auction_id, count(*)::int as bid_count from carbonic_table.bids group by auction_id) bc on bc.auction_id = a.id
    left join lateral (
      select b.amount, b.bidder_name, b.bidder_kind, b.user_id
      from carbonic_table.bids b where b.auction_id = a.id and b.status = 'active'
      order by b.amount desc, b.id desc limit 1
    ) hb on true
    order by (a.status = 'open') desc, a.created_at desc
    limit 80` as unknown as Row[];

  const bidRows = await sql`
    select id, auction_id, user_id, bidder_name, bidder_kind, amount, status, created_at
    from carbonic_table.bids
    order by created_at desc, id desc limit 600` as unknown as Row[];

  return {
    server_time: new Date().toISOString(),
    me: user ? {
      user_id: user.id,
      email: user.email ?? '',
      hub_role: role,
      registered: Boolean(member),
      name: member?.name ?? '',
      kind: member?.kind ?? '',
      is_operator: isOperator,
      ...(balance ?? { earned: 0, spent: 0, reserved: 0, available: 0 }),
    } : null,
    summary: {
      total_air: Number(totals?.total_air ?? 0),
      activity_count: Number(totals?.activity_count ?? 0),
      participants: Number(totals?.participants ?? 0),
      member_count: memberRows.length,
    },
    by_kind: byKind,
    members: memberRows.map((r) => ({
      user_id: String(r.user_id), name: String(r.name ?? ''), kind: String(r.kind ?? ''),
      earned: Number(r.earned ?? 0), spent: Number(r.spent ?? 0), reserved: Number(r.reserved ?? 0),
      available: Number(r.available ?? 0), last_at: r.last_at ?? null,
    })),
    activities: activityRows.map((r) => ({
      id: String(r.id), user_id: String(r.user_id), name: String(r.name ?? ''), kind: String(r.kind ?? ''),
      mission_id: r.mission_id == null ? null : String(r.mission_id),
      mission: String(r.mission_name ?? ''), air: Number(r.air ?? 0),
      done_on: String(r.done_on ?? ''), created_at: r.created_at,
    })),
    missions: missionRows.map((r) => ({
      id: String(r.id), name: String(r.name ?? ''), air: Number(r.air ?? 0),
      active: r.active === true, sort: Number(r.sort ?? 0), uses: Number(r.uses ?? 0),
      seeded: r.seed_key != null && String(r.seed_key) !== '',
    })),
    auctions: auctionRows.map((r) => ({
      id: String(r.id), title: String(r.title ?? ''), description: String(r.description ?? ''),
      start_price: Number(r.start_price ?? 0), min_step: Number(r.min_step ?? 1), status: String(r.status ?? 'open'),
      created_by_name: String(r.created_by_name ?? ''), created_at: r.created_at, closed_at: r.closed_at,
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
    const isOperator = Boolean(member && member.kind === '교사') || role === 'admin' || role === 'staff';
    const requireOperator = () => { if (!isOperator) throw new HttpError(403, '운영자만 할 수 있어요. (구분이 교사인 회원 또는 허브 관리자·교직원)'); };

    // 내 정보 등록·수정
    if (path === '/me' && req.method === 'POST') {
      const body = await readJson(req);
      const name = clean(body.name, 20);
      const kind = clean(body.kind, 10) as Kind;
      if (name.length < 1) return json(req, 400, { error: '이름을 적어 주세요.' });
      if (!KINDS.includes(kind)) return json(req, 400, { error: '구분을 골라 주세요. (10학년·11학년·12학년·교사)' });
      const [row] = await db`
        insert into carbonic_table.members (user_id, email, name, kind)
        values (${user!.id}, ${user!.email ?? ''}, ${name}, ${kind})
        on conflict (user_id) do update set name = excluded.name, kind = excluded.kind,
          email = excluded.email, updated_at = now()
        returning user_id, name, kind` as unknown as Row[];
      return json(req, 200, { ok: true, member: row });
    }

    // 실천 등록
    if (path === '/activities' && req.method === 'POST') {
      const body = await readJson(req);
      const missionId = String(body.mission_id ?? '').trim();
      if (!/^\d{1,12}$/.test(missionId)) return json(req, 400, { error: '미션을 골라 주세요.' });
      const doneOn = dayOf(body.done_on);
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요. (내 통장 → 회원 정보)', code: 'profile_required' });

      const result = await db.begin(async (tx) => {
        // 같은 사람의 잔액을 건드리는 일은 회원 줄을 잠가 순서대로 처리한다
        const [m] = await tx`select user_id from carbonic_table.members where user_id = ${user!.id} for update` as unknown as Row[];
        if (!m) throw new HttpError(400, '먼저 이름과 구분을 등록해 주세요.');
        const [mission] = await tx`
          select id, name, air, active from carbonic_table.missions where id = ${missionId}` as unknown as Row[];
        if (!mission) throw new HttpError(404, '그 미션을 찾지 못했어요.');
        if (mission.active !== true) throw new HttpError(409, '지금은 쉬고 있는 미션이에요. 다른 미션을 골라 주세요.');
        const [act] = await tx`
          insert into carbonic_table.activities (user_id, mission_id, mission_name, air, done_on)
          values (${user!.id}, ${Number(mission.id)}, ${String(mission.name)}, ${Number(mission.air)}, ${doneOn})
          returning id, mission_name, air, to_char(done_on, 'YYYY-MM-DD') as done_on, created_at` as unknown as Row[];
        return act;
      });
      return json(req, 201, {
        ok: true,
        activity: { id: String(result.id), mission: String(result.mission_name), air: Number(result.air), done_on: String(result.done_on) },
      });
    }

    // 실천 기록 지우기 (내 것, 운영자는 남의 것도)
    if (parts[0] === 'activities' && parts[1] && req.method === 'DELETE') {
      const id = parts[1];
      if (!/^\d{1,12}$/.test(id)) return json(req, 400, { error: '기록 번호가 올바르지 않습니다.' });
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, user_id from carbonic_table.activities where id = ${id} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 기록을 찾지 못했어요.');
        if (String(a.user_id) !== user!.id && !isOperator) throw new HttpError(403, '내 기록만 지울 수 있어요.');
        await tx`select user_id from carbonic_table.members where user_id = ${String(a.user_id)} for update`;
        await tx`delete from carbonic_table.activities where id = ${id}`;
        return { id: String(a.id) };
      });
      return json(req, 200, { ok: true, ...out });
    }

    // ---------- 운영자 ----------
    if (parts[0] === 'missions' && req.method === 'POST') {
      requireOperator();
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
      requireOperator();
      const id = parts[1];
      if (!/^\d{1,12}$/.test(id)) return json(req, 400, { error: '미션 번호가 올바르지 않습니다.' });
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
      requireOperator();
      const id = parts[1];
      if (!/^\d{1,12}$/.test(id)) return json(req, 400, { error: '미션 번호가 올바르지 않습니다.' });
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

    if (parts[0] === 'auctions' && parts.length === 1 && req.method === 'POST') {
      requireOperator();
      const body = await readJson(req);
      const title = clean(body.title, 60);
      const description = cleanText(body.description, 300);
      const startPrice = intOf(body.start_price, 1, 100000);
      const minStep = intOf(body.min_step, 1, 10000);
      if (title.length < 1) return json(req, 400, { error: '물품 이름을 적어 주세요.' });
      if (startPrice == null) return json(req, 400, { error: '시작가를 1공기 이상으로 적어 주세요.' });
      if (minStep == null) return json(req, 400, { error: '최소 입찰 단위를 1공기 이상으로 적어 주세요.' });
      const byName = clean(member?.name ?? '', 20) || clean(user!.email ?? '', 40) || '운영자';
      const [row] = await db`
        insert into carbonic_table.auctions (title, description, start_price, min_step, created_by, created_by_name)
        values (${title}, ${description}, ${startPrice}, ${minStep}, ${user!.id}, ${byName})
        returning id, title, description, start_price, min_step, status, created_at` as unknown as Row[];
      return json(req, 201, { ok: true, auction: row });
    }

    // 입찰 — 트랜잭션 + 행 잠금으로 동시 입찰·잔액 초과를 막는다
    if (parts[0] === 'auctions' && parts[1] && parts[2] === 'bid' && req.method === 'POST') {
      const auctionId = parts[1];
      if (!/^\d{1,12}$/.test(auctionId)) return json(req, 400, { error: '경매 번호가 올바르지 않습니다.' });
      if (!member) return json(req, 400, { error: '먼저 이름과 구분을 등록해 주세요.', code: 'profile_required' });
      const body = await readJson(req);
      const amount = intOf(body.amount, 1, 100000);
      if (amount == null) return json(req, 400, { error: '입찰 공기를 1 이상 숫자로 적어 주세요.' });

      const out = await db.begin(async (tx) => {
        // ① 이 경매를 잠근다 → 같은 경매 입찰은 한 줄로 줄을 선다
        const [a] = await tx`
          select id, status, start_price, min_step, title from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (String(a.status) !== 'open') throw new HttpError(409, '이미 마감되었거나 취소된 경매예요.');

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

        const [b] = await tx`
          select
            coalesce((select sum(air)::int from carbonic_table.activities where user_id = ${user!.id}), 0) as earned,
            coalesce((select sum(amount)::int from carbonic_table.bids where user_id = ${user!.id} and status = 'won'), 0) as spent,
            coalesce((select sum(b.amount)::int from carbonic_table.bids b
                      join carbonic_table.auctions a on a.id = b.auction_id
                      where b.user_id = ${user!.id} and b.status = 'active' and a.status = 'open'), 0) as reserved` as unknown as Row[];
        const earned = Number(b?.earned ?? 0), spent = Number(b?.spent ?? 0), reserved = Number(b?.reserved ?? 0);
        // 내가 이 경매에서 이미 최고 입찰자라면 그 예약은 새 입찰로 바뀌므로 함께 쓸 수 있다
        const available = earned - spent - reserved + (mineTop ? Number(mineTop.amount) : 0);
        if (amount > available) {
          throw new HttpError(400, `사용 가능한 공기는 ${available}공기예요. (총 적립 ${earned} · 낙찰 ${spent} · 경매에 묶인 공기 ${reserved - (mineTop ? Number(mineTop.amount) : 0)})`);
        }

        if (top) await tx`update carbonic_table.bids set status = 'outbid' where id = ${Number(top.id)}`;
        const [bid] = await tx`
          insert into carbonic_table.bids (auction_id, user_id, bidder_name, bidder_kind, amount)
          values (${auctionId}, ${user!.id}, ${member.name}, ${member.kind}, ${amount})
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
      requireOperator();
      const auctionId = parts[1];
      if (!/^\d{1,12}$/.test(auctionId)) return json(req, 400, { error: '경매 번호가 올바르지 않습니다.' });
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
      requireOperator();
      const auctionId = parts[1];
      if (!/^\d{1,12}$/.test(auctionId)) return json(req, 400, { error: '경매 번호가 올바르지 않습니다.' });
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
        if (String(a.status) !== 'open') throw new HttpError(409, '이미 마감되었거나 취소된 경매예요.');
        // 진행 중 입찰의 예약을 풀어 준다
        await tx`update carbonic_table.bids set status = 'canceled' where auction_id = ${auctionId} and status = 'active'`;
        await tx`update carbonic_table.auctions set status = 'canceled', closed_at = now() where id = ${auctionId}`;
        return { canceled: auctionId };
      });
      return json(req, 200, { ok: true, ...out });
    }

    if (parts[0] === 'auctions' && parts[1] && req.method === 'DELETE') {
      requireOperator();
      const auctionId = parts[1];
      if (!/^\d{1,12}$/.test(auctionId)) return json(req, 400, { error: '경매 번호가 올바르지 않습니다.' });
      const out = await db.begin(async (tx) => {
        const [a] = await tx`select id, status from carbonic_table.auctions where id = ${auctionId} for update` as unknown as Row[];
        if (!a) throw new HttpError(404, '그 경매를 찾지 못했어요.');
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

    if (parts[0] === 'members' && parts[1] && req.method === 'DELETE') {
      requireOperator();
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
