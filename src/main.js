// 탄소로운 식탁 · 화면 코드 (v3 — 지구 탄소·공기 · 내 실천 모아보기 · 여러 건 등록 · 사진)
// 구조: 서버 함수(/state)에서 한 벌을 받아 그리고, 모든 쓰기는 서버 함수로만 보냅니다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';
import { applyAppInfo } from './app-info.js';
import { loginWithGoogle, logout, onUserChange } from './auth.js';
import { local } from './store.js';
import { FN_URL } from './supabase.js';
import { api, ApiError } from './api.js';
import { earthLook, earthSvg, earthState, tempText, syncEarthSpin } from './earth.js';

// ---------- 작은 도우미 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const KIND_ORDER = ['10학년', '11학년', '12학년', '교사'];
const KIND_CLASS = { '10학년': 'k10', '11학년': 'k11', '12학년': 'k12', '교사': 'kteacher' };
const KIND_CARD = { '10학년': 'k-10', '11학년': 'k-11', '12학년': 'k-12', '교사': 'k-teacher' };
const KIND_ICON = { '10학년': 'leaf', '11학년': 'sprout', '12학년': 'tree', '교사': 'globe' };
const REACTIONS = ['🌱', '👏', '💚', '🔥'];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Number(n || 0).toLocaleString('ko-KR');
const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const fmtDay = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d ?? ''));
  return m ? `${Number(m[2])}/${Number(m[3])}` : '';
};
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
};
const short = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const wcls = (p) => 'w' + Math.min(100, Math.max(0, Math.round((Number(p) || 0) / 5) * 5));
const kindBadge = (kind) => (KIND_CLASS[kind] ? `<span class="badge ${KIND_CLASS[kind]}">${esc(kind)}</span>` : '');
const seedBadge = (n) => (n >= 1 ? `<span class="badge soft">${n}공기</span>` : '<span class="badge soft">0공기</span>');
const photoHtml = (path, alt, cls = '') => {
  const src = imgSrc(path);
  if (!src) return '';
  return `<button type="button" class="photo ${cls}" data-action="zoom" data-src="${esc(src)}" aria-label="사진 크게 보기"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></button>`;
};

// ---------- 인라인 SVG (외부 아이콘·CDN 없이 그린다) ----------
const svg = (body, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const ICONS = {
  leaf: svg('<path d="M4 20C4 11 10 5 20 4c0 10-6 16-14 16z"/><path d="M6 18c3-5 7-8 12-10"/>'),
  sprout: svg('<path d="M12 21v-8"/><path d="M12 14C8 14 5 11.6 5 8c4 0 7 2.4 7 6z"/><path d="M12 14c3.4 0 6-2.4 6-5.4-3.4 0-6 2.4-6 5.4z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.6 3 14.4 0 18"/><path d="M12 3c-3 3.6-3 14.4 0 18"/>'),
  bubble: svg('<circle cx="9" cy="14" r="5"/><circle cx="17.5" cy="7.5" r="3"/><path d="M6.5 12.5c.8-1.2 2-1.8 3.4-1.6"/>'),
  tree: svg('<path d="M12 22v-5"/><path d="M12 3l6.5 9.5H15L19 18H5l4-5.5H5.5z"/>'),
  seed: svg('<path d="M12 21c-3.6-2.4-6-5.4-6-8.6A4.4 4.4 0 0 1 12 9a4.4 4.4 0 0 1 6 3.4c0 3.2-2.4 6.2-6 8.6z"/><path d="M12 13.5v7"/>'),
  medal: svg('<circle cx="12" cy="15" r="5"/><path d="M9 4.5L12 11l3-6.5"/>'),
  chat: svg('<path d="M4 5.5h16V16H9l-5 3.5z"/>'),
  pin: svg('<path d="M12 17v4"/><path d="M8 3h8l-1 6 4 3H5l4-3z"/>'),
  tool: svg('<path d="M14.5 4.5a4 4 0 0 0-5.2 5.2L4 15v5h5l5.3-5.3a4 4 0 0 0 5.2-5.2l-2.8 2.8-2-2z"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  users: svg('<circle cx="9" cy="8" r="3.4"/><path d="M3.5 20c0-3.3 2.5-5.6 5.5-5.6s5.5 2.3 5.5 5.6"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 20c0-2.2-.7-4-2-5.2"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>'),
};
function icon(name, cls = 'ico') {
  const s = ICONS[name];
  return s ? s.replace('class="ico"', `class="${cls}"`) : '';
}

// ---------- 지구(탄소·공기) ----------
// 탄소는 시즌의 기준 시각부터 한 시간마다 쌓이고, 공기가 쌓이면 그만큼 지구가 시원해져요.
// 지구 그림은 src/earth.js 가 그립니다 (건강하고 시원한 지구 → 기후 위기의 뜨거운 지구로 색을 이어서).
let serverOffset = 0;   // 서버 시각 − 브라우저 시각 (밀리초)
function liveEarth() {
  const s = seasonOf();
  const base = s?.earth || state.data?.earth;
  if (!base) return null;
  const started = Date.parse(base.earth_started_at || '');
  const air = Number(s?.air ?? base.air ?? 0);
  const cph = Math.max(0, Number(base.carbon_per_hour ?? 1));
  const cap = Math.max(0.1, Number(base.carbon_capacity ?? 24));
  const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() + serverOffset - started) / 1000)) : 0;
  const hours = Math.floor(elapsed / 3600);
  const emitted = Math.round(hours * cph * 10) / 10;
  const net = Math.round((emitted - air) * 10) / 10;
  const denom = Math.max(cap, emitted > 0 ? emitted : cap);
  const warming = Math.max(0, Math.min(1, net / denom));
  return {
    carbon_per_hour: cph, carbon_capacity: cap, earth_started_at: base.earth_started_at,
    elapsed_seconds: elapsed, next_carbon_in: 3600 - (elapsed % 3600),
    emitted, air, net, warming, state: earthState(warming),
  };
}
const imgSrc = (path) => {
  const v = String(path || '');
  if (!v) return '';
  return v.startsWith('/images/') ? FN_URL + v : v;
};

const emptyData = () => ({
  server_time: null,
  me: null,
  season: null,
  seasons: [],
  summary: { total_air: 0, activity_count: 0, participants: 0, member_count: 0, comment_count: 0, reaction_count: 0 },
  by_kind: KIND_ORDER.map((kind) => ({ kind, air: 0, count: 0, members: 0, people: 0 })),
  members: [], activities: [], missions: [], notices: [], auctions: [],
});

const state = {
  user: null,
  data: null,
  loading: true,
  error: null,
  view: 'home',
  seasonId: null,          // null = 지금 시즌
  missionQuery: '',
  airFilter: 'all',
  cart: {},                // { [missionId]: 수량 } — 여러 미션·같은 미션 여러 번
  images: { activity: null, notice: null, lot: null },  // { dataUrl } | { path } | null
  itemImages: {},          // { [missionId]: { dataUrl } | { path } } — 고른 실천 항목별 사진
  mineFilter: 'all',       // all | photo | mission:<이름>
  day: todayStr(),
  memberQuery: '',
  memberSort: 'earned',
  adminTab: 'notice',
  missionAdminQuery: '',
  openComments: {},        // { [activityId]: true }
  lotForm: null,           // null | 'new' | 카본 옥션 id
  editNotice: null,        // 공지 수정 중인 id
  editSeason: null,
};

const d = () => state.data || emptyData();
const meOf = () => d().me;
const seasonOf = () => d().season;
const isAdmin = () => Boolean(d().me?.is_admin);

// ---------- 알림 · 확인 ----------
let toastTimer = 0;
function toast(message, kind = '') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 4200);
}

function askConfirm(message) {
  return new Promise((resolve) => {
    const dlg = $('#confirm-dialog');
    $('#confirm-text').textContent = message;
    const yes = $('#confirm-yes');
    const no = $('#confirm-no');
    const finish = (value) => {
      yes.onclick = null; no.onclick = null; dlg.oncancel = null;
      if (dlg.open) dlg.close();
      resolve(value);
    };
    yes.onclick = () => finish(true);
    no.onclick = () => finish(false);
    dlg.oncancel = (e) => { e.preventDefault(); finish(false); };
    dlg.showModal();
  });
}

function openProfileDialog() {
  const dlg = $('#profile-dialog');
  const me = meOf();
  const form = $('#profile-form');
  form.reset();
  if (me?.kind) {
    const radio = form.querySelector(`input[name="kind"][value="${CSS.escape(me.kind)}"]`);
    if (radio) radio.checked = true;
  }
  form.querySelector('input[name="name"]').value = me?.name || '';
  if (!dlg.open) dlg.showModal();
}

// ---------- 자료 읽기 ----------
async function load({ quiet = false } = {}) {
  if (!quiet) { state.loading = true; render(); }
  try {
    state.data = await api.state(state.seasonId);
    const st = Date.parse(state.data?.server_time || '');
    if (Number.isFinite(st)) serverOffset = st - Date.now();
    state.error = null;
    // 서버가 고른 시즌(없으면 지금 시즌)에 맞춘다
    if (state.data?.season?.id && state.seasonId && state.data.season.id !== state.seasonId) state.seasonId = state.data.season.id;
  } catch (e) {
    state.error = e;
  } finally {
    state.loading = false;
    render();
  }
}

function explainError(e) {
  if (!(e instanceof ApiError)) return '알 수 없는 문제가 생겼어요.';
  if (e.code === 'network' || e.status === 0) {
    return '서버 함수(carbonic-table-fn)에 아직 연결하지 못했어요. 배포가 끝나면 자동으로 나타납니다.';
  }
  if (e.status === 503) return '서버 설정(DB 연결)이 아직 끝나지 않았어요. 잠시 뒤 다시 시도해 주세요.';
  if (e.status === 404) return '서버 함수가 이 화면을 아직 모르는 예전 버전이에요. 서버 함수 배포가 끝나면 자동으로 나타납니다.';
  return e.message;
}

// ---------- 화면 그리기 ----------
function render() {
  const me = meOf();
  if (state.view === 'admin' && !me?.is_admin) state.view = 'home';
  document.body.dataset.view = state.view;
  renderHeader();
  renderNav();
  renderSeasonStrip();
  renderBanner();
  renderNoticeRail();
  const main = $('#main');
  if (state.loading && !state.data) {
    main.innerHTML = '<div class="booting"><span class="spin" aria-hidden="true"></span> 실천 통장을 펼치는 중…</div>';
    return;
  }
  main.innerHTML = state.view === 'practices' ? practicesView()
    : state.view === 'mine' ? mineView()
      : state.view === 'auctions' ? auctionsView()
        : state.view === 'ranking' ? rankingView()
          : state.view === 'admin' ? adminView()
            : homeView();
  syncEarthSpin(main);   // 다시 그려도 대륙·구름이 돌던 자리에서 이어지게
}

function renderHeader() {
  const me = meOf();
  $('#login').hidden = Boolean(state.user);
  $('#logout').hidden = !state.user;
  const who = $('#who');
  who.hidden = !state.user;
  who.textContent = state.user
    ? (me?.registered ? `${me.name} · ${me.kind}${me.is_admin ? ' · 관리자' : ''}` : (state.user.email || '로그인됨'))
    : '';
  who.title = state.user?.email || '';
}

function renderNav() {
  const admin = Boolean(meOf()?.is_admin);
  $$('#nav .nav-item').forEach((b) => {
    const view = b.dataset.nav;
    if (view === 'admin') b.hidden = !admin;
    const on = view === state.view;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function renderSeasonStrip() {
  const el = $('#season-strip');
  if (!el) return;
  const list = d().seasons || [];
  const cur = seasonOf();
  el.hidden = !list.length;
  const pick = $('#season-pick');
  if (pick) {
    pick.innerHTML = list.slice().reverse().map((s) => {
      const tag = s.status === 'active' ? ' · 진행 중' : s.status === 'ended' ? ' · 지난 시즌' : ' · 예정';
      return `<option value="${s.id}"${cur && cur.id === s.id ? ' selected' : ''}>${esc(s.name)}${tag}</option>`;
    }).join('');
  }
  const meta = $('#season-meta');
  if (meta) meta.textContent = cur ? `${nf(cur.air)}공기 · 실천 ${nf(cur.count)}건 · ${nf(cur.people)}명 참여` : '';
  const live = $('#season-live');
  if (live) live.hidden = !cur || cur.status === 'active' || cur.is_current === true;
  el.dataset.state = cur ? cur.status : '';
}

function renderBanner() {
  const el = $('#banner');
  if (state.error) {
    el.className = 'banner bad';
    el.hidden = false;
    el.innerHTML = `<span><b>지금은 기록을 불러오지 못했어요.</b> ${esc(explainError(state.error))}</span>
      <button type="button" class="btn sm ghost" data-action="retry">다시 시도</button>`;
    return;
  }
  el.hidden = true;
  el.innerHTML = '';
}

function renderNoticeRail() {
  const el = $('#notice-rail');
  if (!el) return;
  const pinned = (d().notices || []).filter((n) => n.pinned);
  const show = pinned.length && state.view !== 'home';
  el.hidden = !show;
  if (!show) { el.innerHTML = ''; return; }
  el.innerHTML = pinned.slice(0, 3).map((n) => `
    <div class="rail-item">
      <span class="rail-pin" aria-hidden="true">📌</span>
      <b>${esc(n.title)}</b>
      ${n.body ? `<span>${esc(short(n.body, 110))}</span>` : ''}
    </div>`).join('');
}

// ---------- 공지 (공통 조각) ----------
function noticesSection() {
  const list = d().notices || [];
  if (!list.length) return '';
  return `<section class="section" aria-labelledby="notice-title">
    <div class="section-head">
      <h2 id="notice-title">${icon('bulb', 'ico lg')} 공지</h2>
      <span class="eyebrow">${nf(list.length)}개</span>
    </div>
    <div class="notice-list">${list.map((n) => noticeCard(n)).join('')}</div>
  </section>`;
}

function noticeCard(n) {
  return `<article class="notice ${n.pinned ? 'pinned' : ''}">
    <header>
      ${n.pinned ? '<span class="badge pin">📌 고정</span>' : ''}
      <h3>${esc(n.title)}</h3>
      <span class="notice-when">${fmtWhen(n.created_at)} · ${esc(n.author_name || '관리자')}</span>
    </header>
    ${n.body ? `<p class="notice-body">${esc(n.body)}</p>` : ''}
    ${photoHtml(n.image_url, `${n.title} 사진`, 'notice-photo')}
  </article>`;
}

// ---------- 현황 ----------
function homeView() {
  const data = d();
  const me = data.me;
  const total = data.summary.total_air || 0;
  const memberCount = data.summary.member_count || 0;
  const participants = data.summary.participants || 0;
  const activityCount = data.summary.activity_count || 0;
  const maxKind = Math.max(1, ...data.by_kind.map((k) => k.air || 0));
  const season = seasonOf();

  return `<div class="wrap">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <span class="eyebrow">🌍 탄소로운 실천 통장</span>
        <h1 class="hero-total" id="hero-title">
          <span class="num">${nf(total)}</span>
          <span class="unit">공기의 실천!</span>
        </h1>
        <p>작은 실천 하나가 공기 한 줌이 됩니다. 별무리 사람들이 함께 모은 공기를 한눈에 보고, 모은 공기로 카본 옥션에서 물건을 나눠요.</p>
        <div class="hero-season">
          <span class="season-chip">${icon('leaf', 'ico sm')} ${esc(season?.name || '시즌 준비 중')}</span>
          ${season && season.status !== 'active' ? '<span class="season-chip off">지난 시즌을 보는 중</span>' : ''}
        </div>
        <div class="hero-actions">
          <button type="button" class="btn primary" data-action="go" data-view="practices">＋ 실천 등록하기</button>
          <button type="button" class="btn" data-action="go" data-view="auctions">카본 옥션 보기</button>
        </div>
        <div class="bubbles" aria-hidden="true">${icon('bubble', 'ico bub a')}${icon('bubble', 'ico bub b')}${icon('bubble', 'ico bub c')}</div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><small>함께한 사람</small><b>${nf(participants)}명</b></div>
        <div class="hero-stat"><small>실천 기록</small><b>${nf(activityCount)}건</b></div>
        <div class="hero-stat"><small>등록한 회원</small><b>${nf(memberCount)}명</b></div>
      </div>
    </section>

    <section class="earth-band" aria-labelledby="earth-title">
      ${earthCardHtml()}
      <aside class="earth-side">
        <h2 id="earth-title">${icon('globe', 'ico lg')} 지구는 지금</h2>
        <p>한 시간마다 탄소 <b>${nf(season?.earth?.carbon_per_hour ?? 1)}개</b>씩 쌓여 지구 기온이 올라가요. 우리가 모은 <b>공기 1개</b>가 탄소 1개를 상쇄해 지구 온도를 낮춰 줘요.</p>
        <ul class="earth-steps">
          <li class="s-stable"><span></span>안정 (시원함) — 지구가 시원하게 숨 쉬어요</li>
          <li class="s-warming"><span></span>온난화 주의 — 탄소가 쌓이며 기온이 올라요</li>
          <li class="s-crisis"><span></span>기후 위기 경고 — 빙하가 녹고 지구가 달아올라요</li>
          <li class="s-boiling"><span></span>임계점 돌파 (폭염) — 지구가 한계에 닿았어요</li>
        </ul>
        <p class="hint">온난화 지수와 지구 온도는 이 앱의 이야기를 위한 눈금이에요.</p>
      </aside>
    </section>

    <section class="kind-grid" aria-label="학년·구분별 합계">
      ${data.by_kind.map((k) => `
        <article class="kind-card ${KIND_CARD[k.kind] || ''}">
          <header><span>${icon(KIND_ICON[k.kind] || 'leaf', 'ico sm')} ${esc(k.kind)}</span><span>${nf(k.members)}명</span></header>
          <div class="kind-body">
            <div class="kind-air"><b>${nf(k.air)}</b><small>공기</small></div>
            <div class="bar" role="img" aria-label="${esc(k.kind)} ${nf(k.air)}공기"><i class="${wcls((k.air / maxKind) * 100)}"></i></div>
            <div class="kind-meta"><span>실천 ${nf(k.count)}건</span><span>${total ? Math.round((k.air / total) * 100) : 0}%</span></div>
          </div>
        </article>`).join('')}
    </section>

    ${noticesSection()}

    <section class="cols">
      <div class="card">${ledgerCard(me)}</div>
      <div class="card">
        <div class="card-head"><h2>최근 실천</h2><span class="badge soft">${nf(data.activities.length)}건</span>
          <div class="right"><button type="button" class="btn sm ghost" data-action="refresh" aria-label="새로고침">↻</button></div></div>
        ${feedHtml(data.activities)}
      </div>
    </section>

    ${rankPreview()}

    <section class="section" aria-labelledby="members-title">
      <div class="section-head">
        <h2 id="members-title">회원별 합산 현황</h2>
        <span class="eyebrow">${esc(season?.name || '')} · 모두 함께 보기</span>
      </div>
      ${membersTools()}
      <div class="table-scroll">
        <table class="board">
          <thead>
            <tr>
              <th scope="col">구분</th><th scope="col">이름</th>
              <th scope="col" class="num">총 적립</th><th scope="col" class="num">낙찰 사용</th>
              <th scope="col" class="num">카본 옥션 예약</th><th scope="col" class="num">남은 공기</th>
              <th scope="col">최근 실천</th>
            </tr>
          </thead>
          <tbody id="member-rows">${memberRowsHtml()}</tbody>
        </table>
      </div>
      <p class="hint mt8">남은 공기 = 총 적립 − 낙찰 확정 − 진행 중인 카본 옥션에서 내가 최고 입찰자로 묶인 공기 (모두 이번 시즌 기준)</p>
    </section>
  </div>`;
}

function earthCardHtml() {
  const e = liveEarth();
  if (!e) return `<article class="earth-card empty-earth" id="earth-card"><p class="hint">시즌이 시작되면 지구가 나타나요.</p></article>`;
  const p = e.warming;
  const look = earthLook(p);
  const temp = look.temp;
  const netTxt = e.net > 0 ? `+${nf(e.net)}` : e.net < 0 ? `−${nf(Math.abs(e.net))}` : '0';
  const nextMin = Math.max(0, Math.ceil(e.next_carbon_in / 60));
  const pct = Math.round(p * 100);
  return `<article class="earth-card ${e.state}" id="earth-card">
    <div class="earth-figure">
      ${earthSvg(p)}
      <span class="earth-badge ${e.state}">${esc(look.label)}</span>
    </div>
    <div class="earth-data">
      <div class="earth-head">
        <span class="eyebrow">🌍 이번 시즌 지구</span>
        <b>${esc(seasonOf()?.name || '')}</b>
        <span class="earth-pct">온난화 지수 ${pct}%</span>
        <span class="earth-temp ${e.state}">지구 온도 ${temp}</span>
      </div>
      <div class="earth-stats">
        <div class="earth-stat"><small>지구에 쌓인 탄소</small><b>${nf(e.emitted)}<span class="u">개</span></b></div>
        <div class="earth-stat"><small>우리가 모은 공기</small><b>${nf(e.air)}<span class="u">개</span></b></div>
        <div class="earth-stat ${e.net > 0 ? 'hot' : 'cool'}"><small>아직 남은 탄소 (순탄소)</small><b>${netTxt}<span class="u">개</span></b></div>
      </div>
      <div class="bar earth-bar" role="img" aria-label="지구 온난화 지수 ${pct}%"><i class="${wcls(pct)}"></i></div>
      <p class="earth-note">${e.net > 0
        ? `탄소 <b>${nf(e.net)}개</b>가 지구 온도를 <b>${temp}</b>까지 올렸어요. 공기를 <b>${nf(e.net)}개</b> 더 모으면 다시 시원해져요.`
        : `모은 공기가 탄소보다 <b>${nf(Math.abs(e.net))}개</b> 많아 지구가 서서히 식고 있어요.`}</p>
      <div class="earth-foot">
        <span>1시간마다 탄소 <b>${nf(e.carbon_per_hour)}개</b></span>
        <span>다음 탄소까지 <b>${nextMin}분</b></span>
        <span class="earth-foot-wide">임계점에 이르는 순탄소 ${nf(e.carbon_capacity)}개</span>
      </div>
    </div>
  </article>`;
}

function ledgerCard(me) {
  if (!state.user) {
    return `<div class="card-head"><h2>내 통장</h2></div>
      <div class="guest-cta">
        <p>구글 로그인하고 내 공기를 모아 보세요. 로그인하지 않아도 아래 현황·공지·카본 옥션은 모두 볼 수 있어요.</p>
        <button type="button" class="btn google" data-action="login"><span class="g" aria-hidden="true">G</span> 구글 로그인</button>
      </div>`;
  }
  if (!me?.registered) {
    return `<div class="card-head"><h2>내 통장</h2></div>
      <div class="guest-cta">
        <p><b>${esc(me?.email || state.user.email || '')}</b> 로 로그인했어요. 이름과 구분을 등록하면 실천을 기록할 수 있어요.</p>
        <button type="button" class="btn primary" data-action="open-profile">회원 정보 등록하기</button>
      </div>`;
  }
  return `<div class="card-head"><h2>${esc(me.name)}님의 통장</h2><span class="badge ${KIND_CLASS[me.kind] || ''}">${esc(me.kind)}</span>
      ${me.is_admin ? '<span class="badge green">관리자</span>' : ''}
      <div class="right"><button type="button" class="btn sm ghost" data-action="open-profile">정보 수정</button></div></div>
    <div class="tiles">
      <div class="tile"><small>총 적립</small><b>${nf(me.earned)}<span class="u">공기</span></b></div>
      <div class="tile"><small>낙찰 사용</small><b>${nf(me.spent)}<span class="u">공기</span></b></div>
      <div class="tile warn"><small>카본 옥션 예약</small><b>${nf(me.reserved)}<span class="u">공기</span></b></div>
      <div class="tile hot"><small>남은 공기</small><b>${nf(me.available)}<span class="u">공기</span></b></div>
    </div>
    <div class="ledger-grow">
      <span class="eco-ico">${icon('globe', 'ico')}</span>
      <span class="grow-txt">지구에 보탠 공기 <b>${nf(me.earned)}개</b> · 실천 ${nf(me.acts)}회</span>
      <span class="badge green">${me.rank ? `${nf(me.rank)}위 (${nf(d().members.length)}명)` : ''}</span>
    </div>
    <p class="ledger-note">지금 <b>${nf(me.available)}공기</b>로 입찰할 수 있어요.</p>
    <div class="form-actions mt10">
      <button type="button" class="btn primary" data-action="go" data-view="practices">＋ 실천 등록</button>
      <button type="button" class="btn ghost" data-action="go" data-view="ranking">랭킹 보기</button>
    </div>`;
}

function rankPreview() {
  const list = d().members.filter((m) => m.earned > 0 || m.acts > 0).slice(0, 3);
  if (!list.length) return '';
  return `<section class="section" aria-labelledby="rank-preview-title">
    <div class="section-head">
      <h2 id="rank-preview-title">이번 시즌 랭킹 TOP 3</h2>
      <span class="eyebrow">공기를 가장 많이 모은 사람</span>
      <button type="button" class="btn sm ghost" data-action="go" data-view="ranking">전체 랭킹 →</button>
    </div>
    <div class="podium small-podium">
      ${list.map((m, i) => podiumCard(m, i + 1)).join('')}
    </div>
  </section>`;
}

function podiumCard(m, rank) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  const mine = meOf()?.user_id === m.user_id;
  return `<article class="podium-card p${rank} ${mine ? 'mine' : ''}">
    <div class="podium-top"><span class="medal" aria-hidden="true">${medal}</span><span class="rank-no">${rank}위</span></div>
    <div class="podium-name">${esc(m.name)} ${mine ? '<span class="badge soft">나</span>' : ''}</div>
    <div class="podium-kind">${kindBadge(m.kind)}</div>
    <div class="podium-air"><b>${nf(m.earned)}</b><small>공기</small></div>
    <div class="podium-sub">실천 ${nf(m.acts)}회 · 남은 ${nf(m.available)}공기</div>
  </article>`;
}

function membersTools() {
  return `<div class="table-tools">
    <input type="search" id="member-search" placeholder="이름으로 찾기" value="${esc(state.memberQuery)}" aria-label="회원 이름 찾기">
    <select id="member-sort" aria-label="정렬">
      <option value="earned"${state.memberSort === 'earned' ? ' selected' : ''}>적립 많은 순</option>
      <option value="available"${state.memberSort === 'available' ? ' selected' : ''}>남은 공기 많은 순</option>
      <option value="acts"${state.memberSort === 'acts' ? ' selected' : ''}>실천 많은 순</option>
      <option value="name"${state.memberSort === 'name' ? ' selected' : ''}>이름 순</option>
      <option value="kind"${state.memberSort === 'kind' ? ' selected' : ''}>구분 순</option>
    </select>
  </div>`;
}

function memberRowsHtml() {
  const me = meOf();
  const q = state.memberQuery.trim();
  let rows = d().members.filter((m) => !q || m.name.includes(q));
  const sort = state.memberSort;
  rows = rows.slice().sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ko');
    if (sort === 'available') return b.available - a.available || b.earned - a.earned;
    if (sort === 'acts') return b.acts - a.acts || b.earned - a.earned;
    if (sort === 'kind') return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.earned - a.earned;
    return b.earned - a.earned || a.name.localeCompare(b.name, 'ko');
  });
  if (!rows.length) {
    return `<tr><td colspan="7" class="muted empty-cell">${q ? '그 이름의 회원이 없어요.' : '아직 등록한 회원이 없어요.'}</td></tr>`;
  }
  return rows.map((m) => {
    const isMe = me?.registered && m.user_id === me.user_id;
    return `<tr class="${isMe ? 'me' : ''}">
      <td>${kindBadge(m.kind)}</td>
      <td class="name">${esc(m.name)}${isMe ? ' <span class="badge soft">나</span>' : ''}${m.is_admin ? ' <span class="badge green">관리자</span>' : ''}</td>
      <td class="num">${nf(m.earned)}</td>
      <td class="num">${nf(m.spent)}</td>
      <td class="num">${nf(m.reserved)}</td>
      <td class="num air-strong">${nf(m.available)}</td>
      <td>${m.last_at ? fmtWhen(m.last_at) : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');
}

// ---------- 실천 피드 (반응·댓글) ----------
function feedHtml(list) {
  if (!list.length) {
    return `<div class="empty"><b>아직 첫 실천이 없어요.</b>첫 공기를 모아 볼까요?</div>`;
  }
  return `<ul class="feed">${list.map((a) => feedItem(a)).join('')}</ul>`;
}

function feedItem(a) {
  const me = meOf();
  const mine = Boolean(me?.registered && me.user_id === a.user_id);
  const open = Boolean(state.openComments[a.id]);
  return `<li class="feed-item">
    <div class="feed-head">
      ${kindBadge(a.kind)}
      <span class="who-name">${esc(a.name || '회원')}</span>
      <span class="air">+${nf(a.air)}</span>
      <span class="what">${esc(a.mission)}</span>
      <span class="when">${fmtDay(a.done_on)} 실천 · ${fmtTime(a.created_at)} 등록</span>
    </div>
    ${a.image_url ? photoHtml(a.image_url, `${a.mission} 사진`, 'feed-photo') : ''}
    <div class="feed-acts">
      ${(a.reactions || []).map((r) => `
        <button type="button" class="react ${r.mine ? 'on' : ''}" data-action="react" data-id="${esc(a.id)}" data-emoji="${r.emoji}"
          aria-pressed="${r.mine ? 'true' : 'false'}" aria-label="${r.emoji} 반응 ${nf(r.n)}개">${r.emoji}<b>${r.n ? nf(r.n) : ''}</b></button>`).join('')}
      <button type="button" class="react cmt ${open ? 'on' : ''}" data-action="toggle-comments" data-id="${esc(a.id)}"
        aria-expanded="${open ? 'true' : 'false'}" aria-label="댓글 ${nf(a.comment_count)}개 보기">${icon('chat', 'ico sm')}<b>${a.comment_count ? nf(a.comment_count) : ''}</b></button>
      ${mine || me?.is_admin ? `<button type="button" class="btn tiny ghost push" data-action="delete-activity" data-id="${esc(a.id)}">기록 지우기</button>` : ''}
    </div>
    ${open ? commentBox(a) : ''}
  </li>`;
}

function commentBox(a) {
  const me = meOf();
  const canWrite = Boolean(me?.registered);
  return `<div class="comments">
    ${a.comments?.length ? `<ul>${a.comments.map((c) => `
      <li>
        <span class="c-who">${esc(c.name || '회원')}</span>
        <span class="c-body">${esc(c.body)}</span>
        <span class="c-when">${fmtWhen(c.created_at)}</span>
        ${(me && (me.user_id === c.user_id || me.is_admin)) ? `<button type="button" class="btn tiny ghost" data-action="delete-comment" data-id="${esc(c.id)}" data-activity="${esc(a.id)}" aria-label="댓글 삭제">삭제</button>` : ''}
      </li>`).join('')}</ul>` : `<p class="hint">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>`}
    ${state.user
      ? (canWrite
        ? `<form class="comment-form" data-action="comment" data-id="${esc(a.id)}">
            <input type="text" name="body" maxlength="500" placeholder="따뜻한 한마디 (500자까지)" required aria-label="댓글 내용">
            <button type="submit" class="btn sm primary">댓글</button>
          </form>`
        : '<p class="hint">회원 정보를 등록하면 댓글을 남길 수 있어요.</p>')
      : '<button type="button" class="btn sm ghost" data-action="login"><span class="g" aria-hidden="true">G</span> 로그인하고 댓글 쓰기</button>'}
  </div>`;
}

// ---------- 실천 등록 ----------
function practicesView() {
  const me = meOf();
  if (!state.user) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">실천 등록</span>
      <h1>로그인하고 공기를 모아요</h1>
      <p>실천을 기록하려면 BMR APPS 계정으로 로그인해 주세요. 구글 계정이면 바로 들어올 수 있어요.</p>
      <div class="form-actions"><button type="button" class="btn google" data-action="login"><span class="g" aria-hidden="true">G</span> 구글 로그인</button></div>
      <p class="hint">로그인하지 않아도 현황·공지·카본 옥션은 볼 수 있어요.</p>
    </section></div>`;
  }
  if (!me?.registered) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">실천 등록</span>
      <h1>먼저 내 정보를 등록해요</h1>
      <p>${esc(me?.email || state.user.email || '')} 로 로그인했어요. 이름과 구분(학년·교사)을 정하면 실천을 기록할 수 있어요.</p>
      <div class="form-actions"><button type="button" class="btn primary" data-action="open-profile">회원 정보 등록하기</button></div>
    </section></div>`;
  }

  const season = seasonOf();
  const mine = d().mine || { count: 0, air: 0, activities: [] };
  const cart = cartItems();
  const air = cart.reduce((n, c) => n + c.mission.air * c.count, 0);
  const count = cart.reduce((n, c) => n + c.count, 0);
  const recent = mine.activities.slice(0, 6);

  return `<div class="wrap">
    <div class="section-head">
      <h2>실천 등록</h2>
      <span class="eyebrow">${esc(me.name)} · ${esc(me.kind)} · 남은 ${nf(me.available)}공기</span>
    </div>
    <div class="season-note">
      <span>${icon('leaf', 'ico sm')} <b>${esc(season?.name || '이번 시즌')}</b>에 기록돼요.</span>
      <span class="hint">이번 시즌 적립 ${nf(me.earned)}공기 · 실천 ${nf(me.acts)}회</span>
    </div>
    <div class="picker">
      <section class="card mission-panel" aria-labelledby="missions-label">
        <div class="card-head"><h2 id="missions-label">미션 고르기</h2><span class="badge soft">${nf(d().missions.length)}개</span>
          <div class="right"><button type="button" class="btn tiny ghost" data-action="cart-clear" ${count ? '' : 'disabled'}>고른 것 비우기</button></div>
        </div>
        <p class="hint mb10">미션을 누르면 하나씩 담겨요. 여러 미션을 한꺼번에, 같은 미션도 여러 번(＋) 골라 한 번에 기록할 수 있어요.</p>
        <input type="search" id="mission-search" placeholder="미션 찾기 (예: 분리수거, 텀블러)" value="${esc(state.missionQuery)}" aria-label="미션 찾기">
        <div class="chips" role="group" aria-label="공기별 보기">
          ${[['all', '전체'], ['1', '1공기'], ['2', '2공기'], ['3', '3공기'], ['other', '그 외']].map(([key, label]) =>
            `<button type="button" class="chip ${state.airFilter === key ? 'on' : ''}" data-action="air-filter" data-filter="${key}" aria-pressed="${state.airFilter === key}">${label}</button>`).join('')}
        </div>
        <div class="mission-list" id="mission-list">${missionListHtml()}</div>
      </section>

      <section class="pick-sticky" aria-label="고른 실천">
        <div class="pick-box">
          <div class="label">고른 실천 <span id="cart-count">${nf(count)}</span>건</div>
          <div class="picked" id="picked-list">${pickedListHtml()}</div>
          <div class="reward"><b id="cart-air">+${nf(air)}</b><small>공기</small></div>
          <form class="pick-form" data-action="activity">
            <label class="field"><span>실천한 날</span>
              <input type="date" name="day" value="${esc(state.day)}" max="${todayStr()}" required>
            </label>
            <div id="image-field-activity">${imageFieldHtml('activity', '대표 사진')}</div>
            <p class="hint pick-hint" id="root-photo-hint">${rootPhotoHint()}</p>
            <button type="submit" class="btn primary wide" ${count ? '' : 'disabled'} id="cart-submit">${count ? `${nf(air)}공기 적립하기` : '미션을 골라 주세요'}</button>
          </form>
          <p class="hint pick-hint">기록하면 바로 통장에 들어가고, 그만큼 지구가 맑아져요.</p>
        </div>
      </section>
    </div>

    <section class="section" aria-labelledby="mine-title">
      <div class="section-head">
        <h2 id="mine-title">내가 등록한 실천</h2>
        <span class="eyebrow">${nf(mine.count)}건 · ${nf(mine.air)}공기</span>
        <button type="button" class="btn sm ghost" data-action="go" data-view="mine">내 실천 모아보기 →</button>
      </div>
      ${recent.length ? `<ul class="my-list">${recent.map((a) => `
        <li>
          ${a.image_url ? `<img class="my-thumb" src="${esc(imgSrc(a.image_url))}" alt="">` : '<span class="my-thumb none" aria-hidden="true">📷</span>'}
          <span class="m-name">${esc(a.mission)}</span>
          <span class="m-air">+${nf(a.air)}</span>
          <span class="m-day">${fmtDay(a.done_on)}</span>
          <button type="button" class="btn tiny ghost" data-action="delete-activity" data-id="${esc(a.id)}" aria-label="${esc(a.mission)} 기록 지우기">지우기</button>
        </li>`).join('')}</ul>` : `<div class="empty"><b>아직 내가 등록한 실천이 없어요.</b>위에서 미션을 골라 첫 공기를 적립해 보세요.</div>`}
    </section>
  </div>`;
}

/** 지금 담은 실천 [{mission, count}] — 화면에는 서버가 준 미션 목록 순서대로 보여 준다 */
function cartItems() {
  return d().missions
    .map((mission) => ({ mission, count: Number(state.cart[mission.id] || 0) }))
    .filter((x) => x.count > 0);
}

/** 고른 실천 목록 — 항목마다 사진(📷)을 붙이고 지울 수 있다 */
function pickedListHtml() {
  const cart = cartItems();
  if (!cart.length) return `<p class="picked-empty">왼쪽에서 미션을 골라 주세요</p>`;
  return `<ul class="picked-list">${cart.map(({ mission, count }) => {
    const img = state.itemImages[mission.id];
    const src = img?.dataUrl || (img?.path ? imgSrc(img.path) : '');
    return `<li class="picked-item">
        <span class="pi-main">
          <span class="pi-name">${esc(mission.name)}</span>
          <span class="pi-meta">× ${nf(count)} · +${nf(mission.air * count)}</span>
        </span>
        ${src
          ? `<span class="pi-photo on">
              <img class="pi-thumb" src="${esc(src)}" alt="${esc(mission.name)}에 붙일 사진">
              <button type="button" class="btn tiny ghost" data-action="item-image-clear" data-id="${esc(mission.id)}" aria-label="${esc(mission.name)} 사진 지우기">✕</button>
            </span>`
          : `<label class="pi-pick" title="이 실천에 사진 붙이기">
              <span aria-hidden="true">📷</span>
              <input type="file" accept="image/*" class="file-input" data-item-image="${esc(mission.id)}" aria-label="${esc(mission.name)} 사진 고르기">
            </label>`}
      </li>`;
  }).join('')}</ul>`;
}

/** 대표 사진 안내 — 첫 번째 기록 한 곳에만 붙는다 */
function rootPhotoHint() {
  const first = cartItems()[0];
  if (first && state.images.activity && state.itemImages[first.mission.id]) {
    return '첫 번째 실천에 사진이 있어 대표 사진은 쓰지 않아요.';
  }
  return '대표 사진은 첫 번째 기록에만 첨부돼요. 항목마다 다른 사진은 위 📷로 붙여요.';
}

function missionListHtml() {
  const q = state.missionQuery.trim().toLowerCase();
  const filter = state.airFilter;
  const list = d().missions.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q)) return false;
    if (filter === 'all') return true;
    if (filter === 'other') return ![1, 2, 3].includes(m.air);
    return m.air === Number(filter);
  });
  if (!list.length) return `<div class="empty"><b>조건에 맞는 미션이 없어요.</b>검색어나 공기 필터를 바꿔 보세요.</div>`;
  return list.map((m) => {
    const n = Number(state.cart[m.id] || 0);
    return `
    <div class="mission-row ${n ? 'on' : ''} ${m.active ? '' : 'off'}">
      <button type="button" class="mission-main" data-action="pick" data-id="${esc(m.id)}" aria-pressed="${n > 0}">
        <span class="m-title">${esc(m.name)}${m.active ? '' : ' <span class="badge soft">쉬는 중</span>'}</span>
        <span class="air-pill">${nf(m.air)}공기</span>
      </button>
      <div class="stepper" role="group" aria-label="${esc(m.name)} 수량">
        <button type="button" class="step" data-action="cart-minus" data-id="${esc(m.id)}" aria-label="하나 줄이기" ${n ? '' : 'disabled'}>−</button>
        <b class="count" aria-live="polite">${nf(n)}</b>
        <button type="button" class="step" data-action="cart-plus" data-id="${esc(m.id)}" aria-label="하나 더" ${m.active ? '' : 'disabled'}>＋</button>
      </div>
    </div>`;
  }).join('');
}

/** 담은 실천이 바뀔 때 그 부분만 다시 그린다 (검색어·날짜 입력은 그대로) */
function paintCart() {
  const list = $('#mission-list');
  if (list) list.innerHTML = missionListHtml();
  const cart = cartItems();
  const air = cart.reduce((n, c) => n + c.mission.air * c.count, 0);
  const count = cart.reduce((n, c) => n + c.count, 0);
  const countEl = $('#cart-count');
  if (countEl) countEl.textContent = nf(count);
  const nameEl = $('#picked-list');
  if (nameEl) nameEl.innerHTML = pickedListHtml();
  const hintEl = $('#root-photo-hint');
  if (hintEl) hintEl.textContent = rootPhotoHint();
  const airEl = $('#cart-air');
  if (airEl) airEl.textContent = `+${nf(air)}`;
  const submit = $('#cart-submit');
  if (submit) {
    submit.disabled = !count;
    submit.textContent = count ? `${nf(air)}공기 적립하기` : '미션을 골라 주세요';
  }
  const clear = $('[data-action="cart-clear"]');
  if (clear) clear.disabled = !count;
}

// ---------- 사진 고르기 (올리기 전에 줄이고, 등록할 때 서버로 보낸다) ----------
const IMAGE_MAX_WIDTH = 1200;

function imageFieldHtml(key, label) {
  const img = state.images[key];
  const src = img?.dataUrl || (img?.path ? imgSrc(img.path) : '');
  return `<div class="image-field">
    <div class="image-field-head">
      <span class="field-label">${esc(label || '사진')} <small>(선택)</small></span>
      ${src ? `<button type="button" class="btn tiny ghost" data-action="image-clear" data-key="${key}">사진 지우기</button>` : ''}
    </div>
    <div class="image-field-body">
      <label class="btn sm ghost file-btn">📷 사진 고르기
        <input type="file" accept="image/*" class="file-input" data-image="${key}">
      </label>
      ${src ? `<img class="image-thumb" src="${esc(src)}" alt="고른 사진 미리보기">` : '<span class="hint">사진 없이도 기록할 수 있어요.</span>'}
    </div>
  </div>`;
}

function repaintImageField(key) {
  const el = $(`#image-field-${key}`);
  if (el) el.innerHTML = imageFieldHtml(key, key === 'notice' ? '공지 사진' : key === 'lot' ? '물품 사진' : key === 'activity' ? '대표 사진' : '사진');
  if (key === 'activity') {
    const hintEl = $('#root-photo-hint');
    if (hintEl) hintEl.textContent = rootPhotoHint();
  }
}

function loadBitmap(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}
function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')); };
    im.src = url;
  });
}
/** 사진을 가로 1200px 이하로 줄여 WebP(안 되면 JPEG)로 바꾼다 — 휴대폰 원본 몇 MB도 200KB 안팎으로 */
async function shrinkImage(file) {
  const bmp = await loadBitmap(file);
  const w0 = bmp.width || bmp.naturalWidth || 0;
  const h0 = bmp.height || bmp.naturalHeight || 0;
  if (!w0 || !h0) throw new Error('사진 크기를 읽지 못했어요.');
  const scale = Math.min(1, IMAGE_MAX_WIDTH / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  let dataUrl = cv.toDataURL('image/webp', 0.72);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = cv.toDataURL('image/jpeg', 0.78);
  return dataUrl;
}

/** 등록 직전에 사진을 서버에 올리고 주소('/images/번호')를 받는다. 사진이 없으면 ''. */
async function imagePathFor(key) {
  const img = state.images[key];
  if (!img) return '';
  if (img.path) return img.path;
  if (!img.dataUrl) return '';
  const r = await api.uploadImage(img.dataUrl);
  state.images[key] = { path: r.path };
  return r.path;
}

/** 고른 실천 항목에 붙인 사진을 올리고 주소를 받는다 (사진이 없으면 '') */
async function itemImagePathFor(missionId) {
  const img = state.itemImages[missionId];
  if (!img) return '';
  if (img.path) return img.path;
  if (!img.dataUrl) return '';
  const r = await api.uploadImage(img.dataUrl);
  state.itemImages[missionId] = { path: r.path };
  return r.path;
}

// ---------- 내 실천 모아보기 ----------
function mineView() {
  const me = meOf();
  if (!state.user) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">내 실천</span>
      <h1>로그인하면 내 실천을 모아 볼 수 있어요</h1>
      <p>내가 한 실천과 적립한 공기, 남긴 사진·댓글·반응을 한곳에서 확인할 수 있어요.</p>
      <div class="form-actions"><button type="button" class="btn google" data-action="login"><span class="g" aria-hidden="true">G</span> 구글 로그인</button></div>
    </section></div>`;
  }
  if (!me?.registered) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">내 실천</span>
      <h1>먼저 내 정보를 등록해요</h1>
      <p>${esc(me?.email || state.user.email || '')} 로 로그인했어요. 이름과 구분을 정하면 내 실천이 모입니다.</p>
      <div class="form-actions"><button type="button" class="btn primary" data-action="open-profile">회원 정보 등록하기</button></div>
    </section></div>`;
  }

  const all = d().mine || { count: 0, air: 0, by_mission: [], activities: [] };
  const byMission = all.by_mission || [];
  const maxCount = Math.max(1, ...byMission.map((m) => m.count || 0));
  const f = state.mineFilter;
  let list = all.activities || [];
  if (f === 'photo') list = list.filter((a) => a.image_url);
  else if (f.startsWith('mission:')) list = list.filter((a) => a.mission === f.slice(8));
  const season = seasonOf();
  const rank = me.rank || 0;

  return `<div class="wrap">
    <div class="section-head">
      <h2>${icon('globe', 'ico lg')} 내 실천 모아보기</h2>
      <span class="eyebrow">${esc(season?.name || '')} · ${esc(me.name)}</span>
    </div>
    <div class="mine-tiles">
      <div class="mine-tile"><small>이번 시즌 실천</small><b>${nf(all.count)}<span class="u">회</span></b></div>
      <div class="mine-tile"><small>모은 공기</small><b>${nf(all.air)}<span class="u">공기</span></b></div>
      <div class="mine-tile"><small>지구를 맑게 한 몫 (탄소)</small><b>${nf(all.air)}<span class="u">개</span></b></div>
      <div class="mine-tile"><small>이번 시즌 순위</small><b>${rank ? nf(rank) : '—'}<span class="u">위</span></b></div>
    </div>

    <section class="section" aria-labelledby="mine-missions">
      <div class="section-head"><h2 id="mine-missions">미션별 요약</h2><span class="eyebrow">${nf(byMission.length)}가지</span></div>
      ${byMission.length ? `<ul class="mission-sum">${byMission.map((m) => `
        <li class="${f === `mission:${m.mission}` ? 'on' : ''}">
          <button type="button" class="mission-sum-btn" data-action="mine-filter" data-filter="mission:${esc(m.mission)}">
            <span class="ms-name">${esc(m.mission)}</span>
            <span class="bar ms-bar"><i class="${wcls((m.count / maxCount) * 100)}"></i></span>
            <span class="ms-num">${nf(m.count)}회 · ${nf(m.air)}공기</span>
          </button>
        </li>`).join('')}</ul>` : '<div class="empty"><b>아직 미션별 요약이 없어요.</b>실천을 등록하면 미션별로 모아 보여 드려요.</div>'}
    </section>

    <section class="section" aria-labelledby="mine-feed">
      <div class="section-head">
        <h2 id="mine-feed">내 기록</h2>
        <span class="eyebrow">${nf(list.length)}건</span>
      </div>
      <div class="chips" role="group" aria-label="내 기록 걸러 보기">
        <button type="button" class="chip ${f === 'all' ? 'on' : ''}" data-action="mine-filter" data-filter="all" aria-pressed="${f === 'all'}">전체</button>
        <button type="button" class="chip ${f === 'photo' ? 'on' : ''}" data-action="mine-filter" data-filter="photo" aria-pressed="${f === 'photo'}">사진 있는 기록</button>
        ${byMission.slice(0, 6).map((m) => `<button type="button" class="chip ${f === `mission:${m.mission}` ? 'on' : ''}" data-action="mine-filter" data-filter="mission:${esc(m.mission)}" aria-pressed="${f === `mission:${m.mission}`}">${esc(short(m.mission, 16))}</button>`).join('')}
      </div>
      ${list.length ? feedHtml(list) : `<div class="empty"><b>${f === 'all' ? '아직 등록한 실천이 없어요.' : '조건에 맞는 기록이 없어요.'}</b>${f === 'all' ? '실천 탭에서 첫 공기를 적립해 보세요.' : '다른 걸러 보기를 눌러 보세요.'}</div>`}
      <p class="hint mt8">사진을 누르면 크게 볼 수 있어요. 내 기록은 여기서 바로 지울 수 있어요. (댓글·반응도 함께 사라져요)</p>
    </section>
  </div>`;
}

function rankingView() {
  const data = d();
  const season = seasonOf();
  const me = data.me;
  const list = data.members.slice().sort((a, b) => b.earned - a.earned || b.acts - a.acts || a.name.localeCompare(b.name, 'ko'));
  const top = list.slice(0, 3);
  const kindMax = Math.max(1, ...data.by_kind.map((k) => k.air || 0));
  const kindRank = data.by_kind.slice().sort((a, b) => b.air - a.air).map((k) => k.kind);
  const myIdx = me?.registered ? list.findIndex((m) => m.user_id === me.user_id) : -1;

  return `<div class="wrap">
    <div class="section-head">
      <h2>${icon('medal', 'ico lg')} 이번 시즌 랭킹</h2>
      <span class="eyebrow">${esc(season?.name || '')}</span>
    </div>
    <p class="hint mb16">실천으로 모은 공기 순위예요. 시즌이 바뀌면 새로 시작합니다. 실천 횟수는 함께 세요.</p>

    ${top.length ? `<div class="podium">${top.map((m, i) => podiumCard(m, i + 1)).join('')}</div>`
      : `<div class="empty"><b>아직 랭킹이 비어 있어요.</b>첫 실천을 기록하면 여기에 이름이 올라요.</div>`}

    ${me?.registered ? `<div class="my-rank card">
      <div class="my-rank-head">
        <span class="eco-ico">${icon('leaf', 'ico')}</span>
        <b>${esc(me.name)}님</b>
        ${kindBadge(me.kind)}
        ${me.is_admin ? '<span class="badge green">관리자</span>' : ''}
      </div>
      <div class="my-rank-body">
        <div><small>순위</small><b>${myIdx >= 0 ? `${nf(myIdx + 1)}<span class="u">/${nf(list.length)}</span>` : '—'}</b></div>
        <div><small>총 적립</small><b>${nf(me.earned)}<span class="u">공기</span></b></div>
        <div><small>실천</small><b>${nf(me.acts)}<span class="u">회</span></b></div>
        <div><small>남은 공기</small><b>${nf(me.available)}<span class="u">공기</span></b></div>
      </div>
    </div>` : ''}

    <section class="section" aria-labelledby="rank-all">
      <div class="section-head"><h2 id="rank-all">개인 랭킹 보드</h2><span class="eyebrow">${nf(list.length)}명</span></div>
      <div class="table-scroll">
        <table class="board rank-board">
          <thead>
            <tr>
              <th scope="col" class="num">순위</th><th scope="col">이름</th><th scope="col">구분</th>
              <th scope="col" class="num">총 적립</th><th scope="col" class="num">실천 횟수</th>
              <th scope="col" class="num">남은 공기</th><th scope="col">지구에 보탠 몫</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map((m, i) => {
              const rank = i + 1;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
              const isMe = me?.registered && me.user_id === m.user_id;
              return `<tr class="${isMe ? 'me' : ''} ${rank <= 3 ? 'top' + rank : ''}">
                <td class="num rank-cell">${medal ? `<span class="medal" aria-hidden="true">${medal}</span>` : ''}<b>${nf(rank)}</b></td>
                <td class="name">${esc(m.name)}${isMe ? ' <span class="badge soft">나</span>' : ''}${m.is_admin ? ' <span class="badge green">관리자</span>' : ''}</td>
                <td>${kindBadge(m.kind)}</td>
                <td class="num air-strong">${nf(m.earned)}</td>
                <td class="num">${nf(m.acts)}회</td>
                <td class="num">${nf(m.available)}</td>
                <td><span class="grow-pill">${icon('globe', 'ico sm')} 정화 ${nf(m.earned)}</span></td>
              </tr>`;
            }).join('') : '<tr><td colspan="7" class="muted empty-cell">아직 회원이 없어요.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section" aria-labelledby="rank-kind">
      <div class="section-head"><h2 id="rank-kind">학년·구분별 비교</h2><span class="eyebrow">이번 시즌</span></div>
      <div class="kind-grid">
        ${data.by_kind.map((k) => {
          const place = kindRank.indexOf(k.kind) + 1;
          const per = k.people ? Math.round((k.air / k.people) * 10) / 10 : 0;
          return `<article class="kind-card ${KIND_CARD[k.kind] || ''}">
            <header>
              <span>${icon(KIND_ICON[k.kind] || 'leaf', 'ico sm')} ${esc(k.kind)}</span>
              <span class="kind-place">${place}위</span>
            </header>
            <div class="kind-body">
              <div class="kind-air"><b>${nf(k.air)}</b><small>공기</small></div>
              <div class="bar" role="img" aria-label="${esc(k.kind)} ${nf(k.air)}공기"><i class="${wcls((k.air / kindMax) * 100)}"></i></div>
              <div class="kind-meta"><span>실천 ${nf(k.count)}건</span><span>1인 ${nf(per)}공기</span></div>
              <div class="kind-meta"><span>참여 ${nf(k.people)}명</span><span>회원 ${nf(k.members)}명</span></div>
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>
  </div>`;
}

// ---------- 카본 옥션 ----------
function auctionsView() {
  const data = d();
  const me = data.me;
  const admin = Boolean(me?.is_admin);
  const season = seasonOf();
  const open = data.auctions.filter((a) => a.status === 'open');
  const waiting = data.auctions.filter((a) => a.status === 'waiting');
  const closed = data.auctions.filter((a) => a.status === 'closed');
  const canceled = data.auctions.filter((a) => a.status === 'canceled');
  const canSell = Boolean(me?.registered);
  const showForm = state.lotForm !== null;

  return `<div class="wrap">
    <div class="section-head">
      <h2>${icon('leaf', 'ico lg')} 카본 옥션</h2>
      <span class="eyebrow">${esc(season?.name || '')} · 모은 공기로 물건 나누기</span>
    </div>
    <div class="op-bar">
      <p class="hint">입찰하는 순간 그 공기는 카본 옥션이 끝날 때까지 묶여요. 다른 사람이 더 높게 부르면 바로 풀립니다. 물품은 먼저 <b>대기</b>로 올라가고, 관리자가 <b>카본 옥션 시작</b>을 누르면 입찰할 수 있어요.</p>
      <div class="form-actions">
        <button type="button" class="btn sm ghost" data-action="refresh">↻ 새로고침</button>
        ${canSell ? `<button type="button" class="btn sm primary" data-action="new-lot">${showForm ? '등록 닫기' : '＋ 물품 등록'}</button>` : ''}
      </div>
    </div>
    ${!canSell ? `<div class="card gate slim">
      <p>물품을 등록하려면 로그인하고 이름·구분을 먼저 등록해 주세요.</p>
      <div class="form-actions">
        ${state.user ? '<button type="button" class="btn primary" data-action="open-profile">회원 정보 등록</button>' : '<button type="button" class="btn google" data-action="login"><span class="g" aria-hidden="true">G</span> 구글 로그인</button>'}
      </div>
    </div>` : ''}
    ${showForm ? lotForm() : ''}

    <section class="section" aria-labelledby="auc-open">
      <div class="section-head"><h2 id="auc-open">진행 중인 카본 옥션</h2><span class="eyebrow">${nf(open.length)}건</span></div>
      ${open.length ? `<div class="auctions">${open.map((a) => auctionCard(a)).join('')}</div>`
        : `<div class="empty"><b>지금 열린 카본 옥션이 없어요.</b>${canSell ? '물품을 등록하면 관리자가 시작할 수 있어요.' : '새 물건이 올라오면 여기에서 입찰할 수 있어요.'}</div>`}
    </section>

    <section class="section" aria-labelledby="auc-wait">
      <div class="section-head">
        <h2 id="auc-wait">대기 중인 물품 <span class="badge soft">미리보기</span></h2>
        <span class="eyebrow">${nf(waiting.length)}건</span>
      </div>
      <p class="hint mb16">회원이 올린 물품이에요. 관리자가 카본 옥션을 시작하면 입찰할 수 있습니다.</p>
      ${waiting.length ? `<div class="auctions">${waiting.map((a) => auctionCard(a)).join('')}</div>`
        : `<div class="empty"><b>대기 중인 물품이 없어요.</b>${canSell ? '내 물건을 먼저 올려 보세요.' : ''}</div>`}
    </section>

    ${closed.length ? `<section class="section" aria-labelledby="auc-closed">
      <div class="section-head"><h2 id="auc-closed">지난 카본 옥션 결과</h2><span class="eyebrow">${nf(closed.length)}건</span></div>
      <div class="auctions">${closed.map((a) => auctionCard(a)).join('')}</div>
    </section>` : ''}

    ${admin && canceled.length ? `<section class="section" aria-labelledby="auc-canceled">
      <div class="section-head"><h2 id="auc-canceled">취소한 카본 옥션</h2><span class="eyebrow">관리자만 보임</span></div>
      <div class="auctions">${canceled.map((a) => auctionCard(a)).join('')}</div>
    </section>` : ''}
  </div>`;
}

function lotForm() {
  const editing = state.lotForm && state.lotForm !== 'new'
    ? d().auctions.find((a) => a.id === state.lotForm) || null
    : null;
  return `<form class="card op-form" data-action="lot" id="lot-form">
    <div class="card-head"><h2>${editing ? '물품 고치기' : '카본 옥션 물품 등록 (대기)'}</h2>
      <span class="badge ${editing ? 'open' : ''}">${editing ? '대기 중' : '등록하면 대기'}</span></div>
    <div class="form-grid">
      <label class="field"><span>물품 이름</span><input type="text" name="title" maxlength="60" placeholder="예: 텀블러 (새 것)" value="${esc(editing?.title || '')}" required></label>
      <label class="field"><span>설명 (선택)</span><textarea name="description" rows="2" maxlength="300" placeholder="물건 소개, 받는 곳, 받는 시간 등">${esc(editing?.description || '')}</textarea></label>
      <div class="form-row">
        <label class="field"><span>시작가 (공기)</span><input type="number" name="start_price" min="1" max="100000" step="1" value="${editing ? editing.start_price : 5}" required></label>
        <label class="field"><span>최소 입찰 단위 (공기)</span><input type="number" name="min_step" min="1" max="10000" step="1" value="${editing ? editing.min_step : 1}" required></label>
      </div>
      <div id="image-field-lot">${imageFieldHtml('lot', '물품 사진')}</div>
      <p class="hint">등록한 물품은 <b>대기</b>로 올라가 모두가 미리 구경할 수 있어요. 관리자가 <b>카본 옥션 시작</b>을 누르면 입찰이 열립니다.</p>
      <div class="form-actions">
        <button type="submit" class="btn primary">${editing ? '저장' : '물품 등록'}</button>
        <button type="button" class="btn ghost" data-action="cancel-lot">닫기</button>
      </div>
    </div>
  </form>`;
}

function auctionCard(a) {
  const me = meOf();
  const admin = Boolean(me?.is_admin);
  const open = a.status === 'open';
  const waiting = a.status === 'waiting';
  const mineTop = Boolean(me?.registered && a.highest && a.highest.user_id === me.user_id);
  const seller = a.seller_id ? a.seller_name : (a.created_by_name || '관리자');
  const isSeller = Boolean(me?.registered && a.seller_id && a.seller_id === me.user_id);
  const minBid = a.highest ? a.highest.amount + a.min_step : a.start_price;
  const statusBadge = open ? '<span class="badge open">진행 중</span>'
    : waiting ? '<span class="badge wait">대기</span>'
      : a.status === 'closed' ? (a.winner_name ? '<span class="badge closed">낙찰 완료</span>' : '<span class="badge closed">유찰</span>')
        : '<span class="badge canceled">취소</span>';

  let bidArea = '';
  if (open) {
    if (isSeller) {
      bidArea = `<p class="hint">내가 올린 물품이라 입찰할 수 없어요.</p>`;
    } else if (!state.user) {
      bidArea = `<button type="button" class="btn wide ghost" data-action="login"><span class="g" aria-hidden="true">G</span> 로그인하고 입찰하기</button>`;
    } else if (!me?.registered) {
      bidArea = `<button type="button" class="btn wide ghost" data-action="open-profile">회원 정보 등록하고 입찰하기</button>`;
    } else {
      const short = me.available < minBid;
      bidArea = `<form class="bid-form" data-action="bid" data-id="${esc(a.id)}">
          <input type="number" name="amount" min="${minBid}" max="100000" step="${a.min_step}" value="${minBid}" inputmode="numeric" aria-label="입찰 공기" ${short ? 'disabled' : ''}>
          <button type="submit" class="btn primary" ${short ? 'disabled' : ''}>입찰</button>
        </form>
        <div class="foot-note"><span>최소 ${nf(minBid)}공기 · 단위 ${nf(a.min_step)}</span><span>내 사용 가능 <b>${nf(me.available)}</b>공기</span></div>
        ${short ? `<p class="hint err">공기가 모자라요. 실천을 더 등록하면 입찰할 수 있어요.</p>` : ''}`;
    }
  }

  const winnerBox = a.status === 'closed'
    ? (a.winner_name
      ? `<div class="winner"><span>낙찰</span><b>${esc(a.winner_name)} · ${nf(a.winning_bid)}공기</b></div>`
      : '<div class="winner none"><span>유찰</span><b>입찰 없이 마감되었어요</b></div>')
    : '';

  const bidLog = a.bids?.length
    ? `<ul class="bid-log">${a.bids.slice(0, 5).map((b) => `<li><span>${esc(b.name)} · ${esc(b.kind)}</span><b>${nf(b.amount)}${b.status === 'active' ? ' ⬆' : ''}</b></li>`).join('')}</ul>`
    : '';

  const adminActions = [];
  if (admin && waiting) adminActions.push(`<button type="button" class="btn tiny primary" data-action="start-auction" data-id="${esc(a.id)}">카본 옥션 시작</button>`);
  if (admin && open) adminActions.push(`<button type="button" class="btn tiny" data-action="close-auction" data-id="${esc(a.id)}">마감하기</button>`);
  if (admin && (open || waiting)) adminActions.push(`<button type="button" class="btn tiny danger" data-action="cancel-auction" data-id="${esc(a.id)}">취소하기</button>`);
  if (admin && (a.status === 'closed' || a.status === 'canceled')) adminActions.push(`<button type="button" class="btn tiny ghost" data-action="delete-auction" data-id="${esc(a.id)}">목록에서 지우기</button>`);
  if (waiting && (isSeller || admin)) adminActions.push(`<button type="button" class="btn tiny ghost" data-action="edit-lot" data-id="${esc(a.id)}">물품 고치기</button>`);
  if (waiting && (isSeller || admin)) adminActions.push(`<button type="button" class="btn tiny ghost" data-action="delete-auction" data-id="${esc(a.id)}">지우기</button>`);

  return `<article class="auction ${a.status === 'closed' ? 'closed' : ''} ${a.status === 'canceled' ? 'canceled' : ''} ${waiting ? 'waiting' : ''}">
    <header><h3>${esc(a.title)}</h3>${statusBadge}</header>
    <div class="body">
      ${a.image_url ? photoHtml(a.image_url, `${a.title} 사진`, 'auction-photo') : ''}
      ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ''}
      <div class="seller">${icon('leaf', 'ico sm')} 올린 사람 <b>${esc(seller || '관리자')}</b>${isSeller ? ' <span class="badge soft">나</span>' : ''}</div>
      <div class="price-row">
        <div><small>시작가</small><b>${nf(a.start_price)}</b></div>
        <div><small>지금 최고</small><b>${a.highest ? nf(a.highest.amount) : '—'}</b></div>
        <div><small>입찰</small><b>${nf(a.bid_count)}회</b></div>
      </div>
      ${open ? `<div class="topline ${mineTop ? 'mine' : ''}">${a.highest
        ? `${mineTop ? '<b>내가</b>' : `<b>${esc(a.highest.name)}</b>님이`} ${nf(a.highest.amount)}공기로 앞서 있어요`
        : '아직 입찰이 없어요. 첫 입찰자가 되어 보세요.'}</div>` : ''}
      ${waiting ? `<div class="topline waiting">${icon('bulb', 'ico sm')} 아직 카본 옥션이 시작되지 않았어요. 관리자가 시작하면 입찰할 수 있어요.</div>` : ''}
      ${winnerBox}
      ${bidArea}
      ${bidLog}
      ${adminActions.length ? `<div class="op-actions">${adminActions.join('')}</div>` : ''}
    </div>
  </article>`;
}

// ---------- 관리자 ----------
function adminView() {
  const me = meOf();
  if (!me?.is_admin) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">관리자</span>
      <h1>관리자만 들어올 수 있어요</h1>
      <p>허브 관리자·교직원이거나, 이 앱의 관리자로 지정된 회원만 쓸 수 있어요.</p>
    </section></div>`;
  }
  const tabs = [
    ['notice', '📢 공지'],
    ['season', '🗓️ 시즌'],
    ['auction', '🔨 카본 옥션'],
    ['member', '👥 회원'],
    ['mission', '🌱 미션'],
  ];
  const dcount = {
    notice: d().notices.length,
    season: d().seasons.length,
    auction: d().auctions.filter((a) => a.status === 'waiting' || a.status === 'open').length,
    member: d().members.length,
    mission: d().missions.length,
  };
  return `<div class="wrap">
    <div class="section-head">
      <h2>${icon('tool', 'ico lg')} 관리자</h2>
      <span class="eyebrow">${esc(me.name)} · ${esc(d().season?.name || '')}</span>
    </div>
    <div class="admin-tabs" role="tablist" aria-label="관리 항목">
      ${tabs.map(([key, label]) => `<button type="button" role="tab" class="admin-tab ${state.adminTab === key ? 'on' : ''}"
        data-action="admin-tab" data-tab="${key}" aria-selected="${state.adminTab === key}">${label} <span class="tab-count">${nf(dcount[key])}</span></button>`).join('')}
    </div>
    ${state.adminTab === 'notice' ? adminNotices()
      : state.adminTab === 'season' ? adminSeasons()
        : state.adminTab === 'auction' ? adminAuctions()
          : state.adminTab === 'member' ? adminMembers()
            : adminMissions()}
  </div>`;
}

function adminNotices() {
  const editing = state.editNotice ? (d().notices.find((n) => n.id === state.editNotice) || null) : null;
  return `<section class="card admin-panel" aria-labelledby="admin-notice">
    <div class="card-head"><h2 id="admin-notice">공지 관리</h2><span class="badge soft">${nf(d().notices.length)}개</span></div>
    <form class="form-grid mb16" data-action="notice" id="notice-form">
      <div class="form-row">
        <label class="field span2"><span>제목</span><input type="text" name="title" maxlength="80" value="${esc(editing?.title || '')}" placeholder="예: 이번 주 카본 옥션 안내" required></label>
      </div>
      <label class="field"><span>본문</span><textarea name="body" rows="3" maxlength="2000" placeholder="모두에게 보여 줄 내용">${esc(editing?.body || '')}</textarea></label>
      <div id="image-field-notice">${imageFieldHtml('notice', '공지 사진')}</div>
      <label class="check"><input type="checkbox" name="pinned" ${editing?.pinned ? 'checked' : ''}> <span>상단에 고정</span></label>
      <div class="form-actions">
        <button type="submit" class="btn primary">${editing ? '공지 저장' : '공지 올리기'}</button>
        ${editing ? '<button type="button" class="btn ghost" data-action="cancel-notice-edit">수정 취소</button>' : ''}
      </div>
    </form>
    ${d().notices.length ? `<ul class="admin-list">${d().notices.map((n) => `
      <li class="${n.pinned ? 'pinned' : ''}">
        <div class="admin-list-main">
          <b>${n.pinned ? '📌 ' : ''}${esc(n.title)}${n.image_url ? ' <span class="badge soft">📷 사진</span>' : ''}</b>
          <small>${fmtWhen(n.created_at)} · ${esc(n.author_name || '관리자')}${n.body ? ` · ${esc(short(n.body, 60))}` : ''}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="btn tiny ${n.pinned ? '' : 'ghost'}" data-action="notice-pin" data-id="${esc(n.id)}" data-pin="${n.pinned ? '0' : '1'}">${n.pinned ? '고정 해제' : '고정'}</button>
          <button type="button" class="btn tiny ghost" data-action="notice-edit" data-id="${esc(n.id)}">수정</button>
          <button type="button" class="btn tiny danger" data-action="notice-delete" data-id="${esc(n.id)}">삭제</button>
        </div>
      </li>`).join('')}</ul>` : '<div class="empty"><b>아직 공지가 없어요.</b>위에서 첫 공지를 올려 보세요.</div>'}
  </section>`;
}

function adminSeasons() {
  const list = d().seasons.slice().reverse();
  const cur = seasonOf();
  const e = cur?.earth || {};
  return `<section class="card admin-panel" aria-labelledby="admin-season">
    <div class="card-head"><h2 id="admin-season">시즌 관리</h2><span class="badge soft">${nf(list.length)}개</span></div>
    ${cur ? `<div class="earth-admin">
      <h3 class="sub-title">🌍 지구 설정 — ${esc(cur.name)}</h3>
      <form class="form-grid" data-action="earth" data-id="${cur.id}">
        <div class="form-row three">
          <label class="field"><span>1시간마다 발생하는 탄소</span><input type="number" name="carbon_per_hour" min="0" max="1000" step="0.1" value="${Number(e.carbon_per_hour ?? 1)}" required></label>
          <label class="field"><span>임계점에 이르는 순탄소 (온난화 100%)</span><input type="number" name="carbon_capacity" min="0.1" max="100000" step="0.1" value="${Number(e.carbon_capacity ?? 24)}" required></label>
          <div class="form-actions end"><button type="submit" class="btn primary">설정 저장</button></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn ghost" data-action="earth-reset" data-id="${cur.id}">탄소 기준 시각을 지금으로 리셋</button>
          <span class="hint">지금 탄소 ${nf(e.emitted ?? 0)}개 · 공기 ${nf(e.air ?? 0)}개 · 순탄소 ${nf(e.net ?? 0)}개 (온난화 지수 ${nf(e.warming_pct ?? e.pollution_pct ?? 0)}% · ${tempText(Number(e.warming_pct ?? e.pollution_pct ?? 0) / 100)})</span>
        </div>
        <p class="hint">탄소는 기준 시각부터 <b>한 시간마다</b> 쌓여 지구 기온을 올려요(크론 없이 계산). 리셋하면 그 시각부터 다시 세고, 지구는 그만큼 시원해져요.</p>
      </form>
    </div>` : ''}
    <form class="form-grid mb16" data-action="season" id="season-form">
      <div class="form-row">
        <label class="field"><span>새 시즌 이름</span><input type="text" name="name" maxlength="40" placeholder="예: 2026 시즌 2" required></label>
        <label class="field"><span>메모 (선택)</span><input type="text" name="note" maxlength="200" placeholder="예: 2학기 실천 통장"></label>
      </div>
      <div class="form-actions"><button type="submit" class="btn primary">새 시즌 만들기</button></div>
      <p class="hint">새 시즌은 <b>예정</b>으로 만들어져요. <b>활성으로 전환</b>하면 그때부터 실천·카본 옥션이 새 시즌에 쌓이고, 지금 시즌은 자동으로 끝나요(기록은 그대로 남습니다).</p>
    </form>
    <ul class="admin-list season-list">
      ${list.map((s) => `
        <li class="${s.id === cur?.id ? 'current' : ''}">
          <div class="admin-list-main">
            <b>${esc(s.name)} ${s.status === 'active' ? '<span class="badge open">진행 중</span>' : s.status === 'planned' ? '<span class="badge wait">예정</span>' : '<span class="badge closed">지난 시즌</span>'}${s.id === cur?.id ? ' <span class="badge soft">보는 중</span>' : ''}</b>
            <small>${nf(s.air)}공기 · 실천 ${nf(s.count)}건 · ${nf(s.people)}명 · 카본 옥션 ${nf(s.auctions)}건${s.ended_at ? ` · ${fmtDay(String(s.ended_at).slice(0, 10))} 종료` : ''}${s.note ? ` · ${esc(s.note)}` : ''}</small>
          </div>
          <div class="row-actions">
            ${s.status !== 'active' ? `<button type="button" class="btn tiny primary" data-action="season-activate" data-id="${s.id}">활성으로 전환</button>` : ''}
            ${s.status !== 'ended' ? `<button type="button" class="btn tiny ghost" data-action="season-end" data-id="${s.id}">시즌 종료</button>` : ''}
            <button type="button" class="btn tiny ghost" data-action="season-view" data-id="${s.id}">보기</button>
            ${s.status !== 'active' && s.count === 0 && s.auctions === 0 ? `<button type="button" class="btn tiny ghost" data-action="season-delete" data-id="${s.id}" data-name="${esc(s.name)}">지우기</button>` : ''}
          </div>
        </li>`).join('')}
    </ul>
  </section>`;
}

function adminAuctions() {
  const waiting = d().auctions.filter((a) => a.status === 'waiting');
  const open = d().auctions.filter((a) => a.status === 'open');
  return `<section class="card admin-panel" aria-labelledby="admin-auction">
    <div class="card-head"><h2 id="admin-auction">카본 옥션 운영</h2>
      <span class="badge soft">대기 ${nf(waiting.length)} · 진행 ${nf(open.length)}</span></div>
    <p class="hint mb16">회원이 올린 물품은 대기 상태예요. <b>카본 옥션 시작</b>을 누르면 입찰이 열리고, <b>마감</b>하면 최고 입찰자가 낙찰받아요.</p>
    <h3 class="sub-title">대기 중 (${nf(waiting.length)})</h3>
    ${waiting.length ? `<ul class="admin-list">${waiting.map((a) => `
      <li>
        <div class="admin-list-main">
          <b>${esc(a.title)}</b>
          <small>올린 사람 ${esc(a.seller_name || '관리자')} · 시작가 ${nf(a.start_price)}공기 · 단위 ${nf(a.min_step)} · ${fmtWhen(a.created_at)}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="btn tiny primary" data-action="start-auction" data-id="${esc(a.id)}">카본 옥션 시작</button>
          <button type="button" class="btn tiny ghost" data-action="edit-lot" data-id="${esc(a.id)}">고치기</button>
          <button type="button" class="btn tiny danger" data-action="cancel-auction" data-id="${esc(a.id)}">취소</button>
        </div>
      </li>`).join('')}</ul>` : '<div class="empty"><b>대기 중인 물품이 없어요.</b></div>'}
    <h3 class="sub-title mt10">진행 중 (${nf(open.length)})</h3>
    ${open.length ? `<ul class="admin-list">${open.map((a) => `
      <li>
        <div class="admin-list-main">
          <b>${esc(a.title)}</b>
          <small>올린 사람 ${esc(a.seller_name || '관리자')} · 입찰 ${nf(a.bid_count)}회 · 지금 최고 ${a.highest ? `${nf(a.highest.amount)}공기 (${esc(a.highest.name)})` : '없음'}</small>
        </div>
        <div class="row-actions">
          <button type="button" class="btn tiny primary" data-action="close-auction" data-id="${esc(a.id)}">마감</button>
          <button type="button" class="btn tiny danger" data-action="cancel-auction" data-id="${esc(a.id)}">취소</button>
        </div>
      </li>`).join('')}</ul>` : '<div class="empty"><b>진행 중인 카본 옥션이 없어요.</b></div>'}
  </section>`;
}

function adminMembers() {
  const list = d().members.slice().sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name, 'ko'));
  return `<section class="card admin-panel" aria-labelledby="admin-member">
    <div class="card-head"><h2 id="admin-member">회원 관리</h2><span class="badge soft">${nf(list.length)}명</span></div>
    <p class="hint mb16">구분은 랭킹·통계에 쓰여요. <b>관리자</b>로 지정하면 공지·시즌·카본 옥션·미션을 운영할 수 있어요. (허브 관리자·교직원은 자동으로 관리자예요.)</p>
    <div class="table-scroll">
      <table class="board">
        <thead><tr><th scope="col">이름</th><th scope="col">구분</th><th scope="col" class="num">적립</th><th scope="col" class="num">실천</th><th scope="col">관리자</th><th scope="col">최근 실천</th><th scope="col"></th></tr></thead>
        <tbody>
          ${list.length ? list.map((m) => `
            <tr>
              <td class="name">${esc(m.name)}</td>
              <td>
                <select data-action="member-kind" data-id="${esc(m.user_id)}" aria-label="${esc(m.name)} 구분">
                  ${KIND_ORDER.map((k) => `<option value="${k}"${m.kind === k ? ' selected' : ''}>${k}</option>`).join('')}
                </select>
              </td>
              <td class="num">${nf(m.earned)}</td>
              <td class="num">${nf(m.acts)}회</td>
              <td>
                <button type="button" class="btn tiny ${m.is_admin ? 'primary' : 'ghost'}" data-action="member-admin" data-id="${esc(m.user_id)}" data-admin="${m.is_admin ? '0' : '1'}">${m.is_admin ? '관리자 해제' : '관리자 지정'}</button>
              </td>
              <td>${m.last_at ? fmtWhen(m.last_at) : '<span class="muted">—</span>'}</td>
              <td><button type="button" class="btn tiny ghost" data-action="member-delete" data-id="${esc(m.user_id)}" data-name="${esc(m.name)}">정리</button></td>
            </tr>`).join('') : '<tr><td colspan="7" class="muted empty-cell">아직 회원이 없어요.</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="hint mt8">‘정리’는 실천·입찰 기록이 없는 회원만 지울 수 있어요(기록 보호).</p>
  </section>`;
}

function adminMissions() {
  return `<section class="card admin-panel" aria-labelledby="admin-mission">
    <div class="card-head"><h2 id="admin-mission">미션 관리</h2><span class="badge soft">${nf(d().missions.length)}개</span></div>
    <form class="form-grid mb16" data-action="add-mission">
      <div class="form-row three">
        <label class="field span2"><span>미션 이름</span><input type="text" name="name" maxlength="120" placeholder="예: 장바구니 들고 장보기" required></label>
        <label class="field"><span>공기</span><input type="number" name="air" min="1" max="100" step="1" value="1" required></label>
        <div class="form-actions end"><button type="submit" class="btn primary">추가</button></div>
      </div>
      <p class="hint">새 미션은 바로 실천 등록 목록에 나타나요. 기본 미션은 지우지 말고 숨겨 주세요.</p>
    </form>
    <div class="table-tools">
      <input type="search" id="mission-admin-search" placeholder="미션 찾기" value="${esc(state.missionAdminQuery)}" aria-label="미션 찾기">
    </div>
    <div class="mission-admin" id="mission-admin-list">${missionAdminHtml()}</div>
  </section>`;
}

function missionAdminHtml() {
  const q = state.missionAdminQuery.trim().toLowerCase();
  const list = d().missions.filter((m) => !q || m.name.toLowerCase().includes(q));
  if (!list.length) return `<div class="empty"><b>찾는 미션이 없어요.</b></div>`;
  return list.map((m) => `
    <div class="row ${m.active ? '' : 'off'}" data-mission="${esc(m.id)}">
      <span class="nm">${esc(m.name)} <span class="uses">사용 ${nf(m.uses)}회</span></span>
      <input type="number" min="1" max="100" step="1" value="${m.air}" aria-label="${esc(m.name)} 공기" id="mission-air-${esc(m.id)}">
      <div class="row-actions">
        <button type="button" class="btn tiny ghost" data-action="save-mission-air" data-id="${esc(m.id)}">공기 저장</button>
        <button type="button" class="btn tiny ${m.active ? '' : 'primary'}" data-action="toggle-mission" data-id="${esc(m.id)}" data-active="${m.active ? '1' : '0'}">${m.active ? '숨기기' : '다시 쓰기'}</button>
        ${m.uses === 0 && !m.seeded ? `<button type="button" class="btn tiny ghost" data-action="delete-mission" data-id="${esc(m.id)}">지우기</button>` : ''}
      </div>
    </div>`).join('');
}

// ---------- 동작 ----------
function switchView(view) {
  state.view = view === 'missions' ? 'admin' : view;
  if (view === 'practices' && !state.day) state.day = todayStr();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function withBusy(btn, fn) {
  const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  try { return await fn(); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = old; delete btn.dataset.busy; } }
}

// 구글 로그인 — 상단 버튼(#login)과 화면 안 버튼이 모두 data-action="login" 으로 들어옵니다.
// (v3 초기에는 상단 버튼에 data-action 이 없어 눌러도 아무 일도 일어나지 않았습니다.)
// 로그인 시작이 실패하면(리다이렉트 주소·네트워크 문제 등) 조용히 멈추지 않고 알려 줍니다.
let signingIn = false;
async function startLogin() {
  if (signingIn) return;
  signingIn = true;
  const btns = $$('[data-action="login"], #login');
  const restore = () => { signingIn = false; for (const b of btns) b.disabled = false; };
  for (const b of btns) b.disabled = true;
  try {
    const { error } = await loginWithGoogle();
    if (error) throw error;
    // 성공하면 곧 구글 화면으로 이동합니다. 이동이 막힌 경우를 대비해 잠시 뒤 다시 누를 수 있게 풉니다.
    window.setTimeout(restore, 8000);
  } catch (err) {
    restore();
    toast(err?.message ? `구글 로그인을 시작하지 못했어요. ${err.message}` : '구글 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'err');
  }
}

document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('#nav [data-nav]');
  if (navBtn) { switchView(navBtn.dataset.nav); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'go') { switchView(el.dataset.view || 'home'); return; }
  if (action === 'login') { await startLogin(); return; }
  if (action === 'logout') {
    try {
      await logout();
      toast('로그아웃했어요. 이 앱에서만 나왔어요.', 'ok');
    } catch (err) {
      toast(err?.message || '로그아웃하지 못했어요.', 'err');
    }
    return;
  }
  if (action === 'retry' || action === 'refresh') { load({ quiet: Boolean(state.data) }); return; }
  if (action === 'open-profile') { openProfileDialog(); return; }
  if (action === 'delete-profile') {
    const ok = await askConfirm('내 회원 정보를 지울까요? 이름·구분이 사라지고, 실천 기록이 있으면 지울 수 없어요. 다시 등록하면 새로 시작해요.');
    if (!ok) return;
    try {
      await api.deleteProfile();
      $('#profile-dialog')?.close();
      toast('회원 정보를 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'close-dialog') { const dlg = el.closest('dialog'); if (dlg?.open) dlg.close(); return; }
  if (action === 'pick' || action === 'cart-plus' || action === 'cart-minus') {
    const id = el.dataset.id;
    const mission = d().missions.find((m) => m.id === id);
    if (!mission) return;
    if (!mission.active) { toast('지금은 쉬고 있는 미션이에요.', 'err'); return; }
    const cur = Number(state.cart[id] || 0);
    let next = action === 'cart-minus' ? cur - 1 : cur + 1;
    if (action === 'pick') next = cur + 1;
    next = Math.max(0, Math.min(30, next));
    if (next === 0) delete state.cart[id]; else state.cart[id] = next;
    paintCart();
    return;
  }
  if (action === 'cart-clear') {
    state.cart = {};
    state.itemImages = {};
    paintCart();
    return;
  }
  if (action === 'mine-filter') {
    state.mineFilter = el.dataset.filter || 'all';
    render();
    return;
  }
  if (action === 'image-clear') {
    const key = el.dataset.key;
    state.images[key] = null;
    repaintImageField(key);
    return;
  }
  if (action === 'item-image-clear') {
    const id = el.dataset.id;
    if (id) delete state.itemImages[id];
    paintCart();
    return;
  }
  if (action === 'zoom') {
    const src = el.dataset.src;
    const dlg = $('#image-dialog');
    if (!dlg || !src) return;
    const img = $('#image-dialog-img');
    if (img) img.src = src;
    if (!dlg.open) dlg.showModal();
    return;
  }
  if (action === 'air-filter') {
    state.airFilter = el.dataset.filter || 'all';
    $$('.chip[data-action="air-filter"]').forEach((c) => {
      const on = c.dataset.filter === state.airFilter;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const list = $('#mission-list');
    if (list) list.innerHTML = missionListHtml();
    return;
  }
  if (action === 'react') {
    const id = el.dataset.id;
    const emoji = el.dataset.emoji;
    if (!state.user) { toast('로그인하면 반응을 남길 수 있어요.', 'err'); return; }
    if (!meOf()?.registered) { openProfileDialog(); return; }
    try {
      const r = await api.react(id, emoji);
      const btn = el;
      btn.classList.toggle('on', r.on === true);
      btn.setAttribute('aria-pressed', r.on ? 'true' : 'false');
      const count = btn.querySelector('b');
      if (count) count.textContent = r.count ? nf(r.count) : '';
    } catch (err) { toast(err.message || '반응을 남기지 못했어요.', 'err'); }
    return;
  }
  if (action === 'toggle-comments') {
    const id = el.dataset.id;
    state.openComments[id] = !state.openComments[id];
    await load({ quiet: true });
    const opened = $(`.feed-item [data-id="${CSS.escape(String(id))}"][data-action="toggle-comments"]`);
    if (opened) opened.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (action === 'delete-comment') {
    const ok = await askConfirm('이 댓글을 지울까요?');
    if (!ok) return;
    try {
      await api.deleteComment(el.dataset.id);
      toast('댓글을 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'delete-activity') {
    const ok = await askConfirm('이 실천 기록을 지울까요? 적립된 공기도 함께 줄어들고, 반응·댓글도 함께 사라져요.');
    if (!ok) return;
    try {
      await api.deleteActivity(el.dataset.id);
      toast('기록을 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'admin-tab') {
    state.adminTab = el.dataset.tab || 'notice';
    state.editNotice = null;
    render();
    return;
  }
  if (action === 'new-lot') {
    state.lotForm = state.lotForm === null ? 'new' : null;
    if (state.lotForm === 'new') state.images.lot = null;
    render();
    return;
  }
  if (action === 'cancel-lot') { state.lotForm = null; render(); return; }
  if (action === 'edit-lot') {
    state.lotForm = el.dataset.id;
    const lot = d().auctions.find((a) => a.id === el.dataset.id) || null;
    state.images.lot = lot?.image_url ? { path: lot.image_url } : null;
    state.view = 'auctions';
    render();
    const form = $('#lot-form');
    if (form) { form.scrollIntoView({ block: 'center', behavior: 'smooth' }); form.querySelector('input[name="title"]')?.focus(); }
    return;
  }
  if (action === 'start-auction' || action === 'close-auction' || action === 'cancel-auction' || action === 'delete-auction') {
    const win = action === 'close-auction';
    const start = action === 'start-auction';
    const del = action === 'delete-auction';
    const ok = await askConfirm(start ? '이 물품의 카본 옥션을 시작할까요? 시작하면 모두 입찰할 수 있어요.'
      : win ? '지금 최고 입찰자를 낙찰자로 확정하고 카본 옥션을 마감할까요?'
        : del ? '이 물품을 목록에서 지울까요? (지난 기록도 함께 사라져요)' : '이 카본 옥션을 취소할까요? 묶여 있던 입찰 공기는 모두 풀립니다.');
    if (!ok) return;
    try {
      await withBusy(el, async () => {
        if (start) {
          await api.startAuction(el.dataset.id);
          toast('카본 옥션을 시작했어요. 이제 입찰할 수 있어요.', 'ok');
        } else if (win) {
          const r = await api.closeAuction(el.dataset.id);
          toast(r.result === 'won' ? `${r.winner}님이 ${nf(r.amount)}공기로 낙찰받았어요.` : '입찰이 없어 유찰로 마감했어요.', 'ok');
        } else if (action === 'cancel-auction') {
          await api.cancelAuction(el.dataset.id);
          toast('카본 옥션을 취소했어요.', 'ok');
        } else {
          await api.deleteAuction(el.dataset.id);
          toast('목록에서 지웠어요.', 'ok');
        }
      });
      await load({ quiet: true });
    } catch (err) { toast(err.message || '처리하지 못했어요.', 'err'); }
    return;
  }
  if (action === 'notice-edit') {
    state.editNotice = el.dataset.id;
    const editing = d().notices.find((n) => n.id === el.dataset.id) || null;
    state.images.notice = editing?.image_url ? { path: editing.image_url } : null;
    state.adminTab = 'notice';
    render();
    $('#notice-form')?.querySelector('input[name="title"]')?.focus();
    return;
  }
  if (action === 'cancel-notice-edit') { state.editNotice = null; render(); return; }
  if (action === 'notice-pin') {
    try {
      await withBusy(el, () => api.patchNotice(el.dataset.id, { pinned: el.dataset.pin === '1' }));
      toast(el.dataset.pin === '1' ? '공지를 위에 고정했어요.' : '고정을 풀었어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); }
    return;
  }
  if (action === 'notice-delete') {
    const ok = await askConfirm('이 공지를 지울까요?');
    if (!ok) return;
    try {
      await withBusy(el, () => api.deleteNotice(el.dataset.id));
      if (state.editNotice === el.dataset.id) state.editNotice = null;
      toast('공지를 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'earth-reset') {
    const ok = await askConfirm('탄소 기준 시각을 지금으로 리셋할까요? 지금까지 쌓인 탄소가 0이 되어 지구가 맑아져요. (지우는 기록은 없어요)');
    if (!ok) return;
    try {
      await withBusy(el, () => api.setEarth(el.dataset.id, { reset: true }));
      toast('탄소 기준 시각을 지금으로 리셋했어요. 지구가 한숨 돌렸어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '리셋하지 못했어요.', 'err'); }
    return;
  }
  if (action === 'season-activate') {
    const ok = await askConfirm('이 시즌을 활성 시즌으로 바꿀까요? 지금 시즌은 자동으로 끝나고, 새 실천·카본 옥션은 이 시즌에 쌓여요.');
    if (!ok) return;
    try {
      await withBusy(el, () => api.activateSeason(el.dataset.id));
      state.seasonId = Number(el.dataset.id);
      toast('활성 시즌을 바꿨어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); }
    return;
  }
  if (action === 'season-end') {
    const ok = await askConfirm('이 시즌을 끝낼까요? 기록은 그대로 남고, 이후 실천은 가장 최근 시즌으로 쌓여요.');
    if (!ok) return;
    try {
      await withBusy(el, () => api.endSeason(el.dataset.id));
      toast('시즌을 끝냈어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '끝내지 못했어요.', 'err'); }
    return;
  }
  if (action === 'season-delete') {
    const ok = await askConfirm(`‘${el.dataset.name}’ 시즌을 지울까요? 실천·카본 옥션 기록이 없는 시즌만 지울 수 있어요.`);
    if (!ok) return;
    try {
      await withBusy(el, () => api.deleteSeason(el.dataset.id));
      toast('시즌을 지웠어요.', 'ok');
      if (state.seasonId === Number(el.dataset.id)) state.seasonId = null;
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'season-view') {
    state.seasonId = Number(el.dataset.id);
    switchView('home');
    await load({ quiet: true });
    return;
  }
  if (action === 'member-admin') {
    const next = el.dataset.admin === '1';
    try {
      await withBusy(el, () => api.patchMember(el.dataset.id, { is_admin: next }));
      toast(next ? '관리자로 지정했어요.' : '관리자 권한을 풀었어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); }
    return;
  }
  if (action === 'member-delete') {
    const ok = await askConfirm(`‘${el.dataset.name}’ 회원을 정리할까요? 실천·입찰 기록이 있으면 지울 수 없어요.`);
    if (!ok) return;
    try {
      await withBusy(el, () => api.deleteMember(el.dataset.id));
      toast('회원을 정리했어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '정리하지 못했어요.', 'err'); }
    return;
  }
  if (action === 'toggle-mission') {
    const next = el.dataset.active !== '1';
    try {
      await withBusy(el, () => api.patchMission(el.dataset.id, { active: next }));
      toast(next ? '미션을 다시 켰어요.' : '미션을 숨겼어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); }
    return;
  }
  if (action === 'delete-mission') {
    const ok = await askConfirm('이 미션을 목록에서 지울까요? 실천 기록이 없는 미션만 지울 수 있어요.');
    if (!ok) return;
    try {
      await withBusy(el, () => api.deleteMission(el.dataset.id));
      toast('미션을 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'save-mission-air') {
    const input = $(`#mission-air-${CSS.escape(el.dataset.id)}`);
    const air = Number(input?.value);
    try {
      await withBusy(el, () => api.patchMission(el.dataset.id, { air }));
      toast(`공기를 ${nf(air)}공기로 바꿨어요.`, 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); }
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-action]');
  if (!form) return;
  e.preventDefault();
  const action = form.dataset.action;
  const btn = form.querySelector('button[type="submit"]');

  if (action === 'activity') {
    const picks = cartItems();
    if (!picks.length) { toast('먼저 미션을 골라 주세요.', 'err'); return; }
    const day = form.querySelector('input[name="day"]')?.value || todayStr();
    state.day = day;
    try {
      await withBusy(btn, async () => {
        // 항목별 사진을 먼저 올린다 (한 항목이 여러 건이어도 그 사진은 첫 기록에만 붙는다)
        const items = [];
        for (const c of picks) {
          const image_url = await itemImagePathFor(c.mission.id);
          items.push(image_url
            ? { mission_id: c.mission.id, count: c.count, image_url }
            : { mission_id: c.mission.id, count: c.count });
        }
        // 대표 사진은 맨 첫 기록 한 곳에만 — 첫 항목에 이미 사진을 붙였으면 쓰지 않는다
        const useRoot = Boolean(state.images.activity) && !items[0].image_url;
        const image_url = useRoot ? await imagePathFor('activity') : '';
        const r = await api.addActivities(image_url ? { items, done_on: day, image_url } : { items, done_on: day });
        toast(`실천 ${nf(r.count)}건 · ${nf(r.air)}공기를 적립했어요!`, 'ok');
      });
      state.cart = {};
      state.images.activity = null;
      state.itemImages = {};
      render();  // 고른 실천을 바로 비운다 (서버 새로고침은 조금 걸릴 수 있어 따로 기다린다)
      await load({ quiet: true });
      switchView('practices');
    } catch (err) {
      if (err.code === 'profile_required') { openProfileDialog(); }
      toast(err.message || '등록하지 못했어요.', 'err');
    }
    return;
  }

  if (action === 'bid') {
    const id = form.dataset.id;
    const amount = Number(form.querySelector('input[name="amount"]')?.value);
    if (!Number.isFinite(amount) || amount < 1) { toast('입찰 공기를 숫자로 적어 주세요.', 'err'); return; }
    try {
      await withBusy(btn, async () => {
        const r = await api.bid(id, amount);
        toast(`입찰 완료! 지금 남은 공기는 ${nf(r.available_after)}공기예요.`, 'ok');
      });
      await load({ quiet: true });
    } catch (err) { toast(err.message || '입찰하지 못했어요.', 'err'); }
    return;
  }

  if (action === 'lot') {
    const fd = new FormData(form);
    const base = {
      title: String(fd.get('title') || ''),
      description: String(fd.get('description') || ''),
      start_price: Number(fd.get('start_price')),
      min_step: Number(fd.get('min_step')),
    };
    const editing = state.lotForm && state.lotForm !== 'new' ? state.lotForm : null;
    try {
      await withBusy(btn, async () => {
        const image_url = await imagePathFor('lot');
        const payload = { ...base, image_url };
        return editing ? api.patchAuction(editing, payload) : api.addAuction(payload);
      });
      toast(editing ? '물품 정보를 고쳤어요.' : '물품을 등록했어요. 대기 중 목록에서 볼 수 있어요.', 'ok');
      state.lotForm = null;
      state.images.lot = null;
      render();
      await load({ quiet: true });
    } catch (err) { toast(err.message || '처리하지 못했어요.', 'err'); }
    return;
  }

  if (action === 'comment') {
    const body = String(new FormData(form).get('body') || '').trim();
    if (!body) { toast('댓글 내용을 적어 주세요.', 'err'); return; }
    try {
      await withBusy(btn, () => api.addComment(form.dataset.id, body));
      state.openComments[form.dataset.id] = true;
      form.querySelector('input[name="body"]').value = '';
      await load({ quiet: true });
    } catch (err) { toast(err.message || '댓글을 남기지 못했어요.', 'err'); }
    return;
  }

  if (action === 'notice') {
    const fd = new FormData(form);
    const base = {
      title: String(fd.get('title') || ''),
      body: String(fd.get('body') || ''),
      pinned: fd.get('pinned') === 'on',
    };
    try {
      await withBusy(btn, async () => {
        const image_url = await imagePathFor('notice');
        const payload = { ...base, image_url };
        return state.editNotice ? api.patchNotice(state.editNotice, payload) : api.addNotice(payload);
      });
      toast(state.editNotice ? '공지를 고쳤어요.' : '공지를 올렸어요.', 'ok');
      state.editNotice = null;
      state.images.notice = null;
      render();
      await load({ quiet: true });
    } catch (err) { toast(err.message || '공지를 올리지 못했어요.', 'err'); }
    return;
  }

  if (action === 'earth') {
    const fd = new FormData(form);
    const payload = {
      carbon_per_hour: Number(fd.get('carbon_per_hour')),
      carbon_capacity: Number(fd.get('carbon_capacity')),
    };
    try {
      await withBusy(btn, () => api.setEarth(form.dataset.id, payload));
      toast('지구 설정을 저장했어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '저장하지 못했어요.', 'err'); }
    return;
  }

  if (action === 'season') {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const note = String(fd.get('note') || '').trim();
    if (!name) { toast('시즌 이름을 적어 주세요.', 'err'); return; }
    try {
      await withBusy(btn, () => api.addSeason(name, note));
      toast(`‘${name}’ 시즌을 만들었어요. 활성으로 전환하면 새로 시작해요.`, 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '시즌을 만들지 못했어요.', 'err'); }
    return;
  }

  if (action === 'add-mission') {
    const fd = new FormData(form);
    try {
      await withBusy(btn, () => api.addMission(String(fd.get('name') || ''), Number(fd.get('air'))));
      toast('미션을 더했어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '추가하지 못했어요.', 'err'); }
  }
});

// 사진 고르기 — 줄여서 미리 보여 주고, 등록할 때 올린다
//  · data-image: 공지·물품·대표 사진 / data-item-image: 고른 실천 항목별 사진
document.addEventListener('change', async (e) => {
  const input = e.target.closest('input[type="file"][data-image], input[type="file"][data-item-image]');
  if (!input) return;
  const key = input.dataset.image;
  const missionId = input.dataset.itemImage;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('사진 파일만 고를 수 있어요.', 'err'); return; }
  try {
    const dataUrl = await shrinkImage(file);
    if (missionId) {
      state.itemImages[missionId] = { dataUrl };
      paintCart();
    } else {
      state.images[key] = { dataUrl };
      repaintImageField(key);
    }
  } catch (err) {
    toast(err.message || '사진을 읽지 못했어요.', 'err');
  }
});

// 회원 정보 저장 (모듈은 DOM 이 다 만들어진 뒤에 실행된다)
$('#profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const kind = String(fd.get('kind') || '');
  if (!name) { toast('이름을 적어 주세요.', 'err'); return; }
  if (!KIND_ORDER.includes(kind)) { toast('구분을 골라 주세요.', 'err'); return; }
  const btn = form.querySelector('button[type="submit"]');
  try {
    await withBusy(btn, () => api.saveProfile(name, kind));
    $('#profile-dialog').close();
    toast('회원 정보를 저장했어요.', 'ok');
    await load({ quiet: true });
  } catch (err) { toast(err.message || '저장하지 못했어요.', 'err'); }
});

// 검색·정렬은 그 부분만 다시 그린다 (입력 포커스 유지)
document.addEventListener('input', (e) => {
  if (e.target.id === 'member-search') {
    state.memberQuery = e.target.value;
    const rows = $('#member-rows');
    if (rows) rows.innerHTML = memberRowsHtml();
    return;
  }
  if (e.target.id === 'mission-search') {
    state.missionQuery = e.target.value;
    const list = $('#mission-list');
    if (list) list.innerHTML = missionListHtml();
    return;
  }
  if (e.target.id === 'mission-admin-search') {
    state.missionAdminQuery = e.target.value;
    const list = $('#mission-admin-list');
    if (list) list.innerHTML = missionAdminHtml();
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'member-sort') {
    state.memberSort = e.target.value;
    const rows = $('#member-rows');
    if (rows) rows.innerHTML = memberRowsHtml();
    return;
  }
  if (e.target.id === 'season-pick') {
    const id = Number(e.target.value);
    state.seasonId = Number.isFinite(id) && id > 0 ? id : null;
    await load();
    return;
  }
  if (e.target.matches('[data-action="member-kind"]')) {
    const id = e.target.dataset.id;
    try {
      await api.patchMember(id, { kind: e.target.value });
      toast('구분을 바꿨어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '바꾸지 못했어요.', 'err'); await load({ quiet: true }); }
  }
});

// ---------- 화면 밝기 ----------
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#theme');
  if (btn) {
    btn.setAttribute('aria-label', theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기');
    btn.title = theme === 'dark' ? '밝게' : '어둡게';
    $('.theme-mark', btn).textContent = theme === 'dark' ? '☀' : '◐';
  }
}
function initTheme() {
  const saved = local.get('theme', '');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  setTheme(saved === 'dark' || saved === 'light' ? saved : (prefersDark ? 'dark' : 'light'));
  $('#theme')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    local.set('theme', next);
  });
}

// ---------- 30초마다 지구 다시 칠하기 ----------
window.setInterval(() => {
  if (state.view !== 'home' || !state.data) return;
  const el = $('#earth-card');
  if (!el) return;
  el.outerHTML = earthCardHtml();
  syncEarthSpin($('#main'));
}, 30000);

// ---------- 시작 ----------
initTheme();
applyAppInfo(' · BMR APPS');

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  load();
}

onUserChange((user) => {
  const prev = state.user?.id ?? null;
  state.user = user;
  if (!booted) { boot(); return; }
  if ((user?.id ?? null) !== prev) {
    state.cart = {};
    state.images = { activity: null, notice: null, lot: null };
    state.lotForm = null;
    state.editNotice = null;
    load({ quiet: true });
  }
  else render();
});

// 로그인 확인이 늦어져도 화면은 먼저 그린다
window.setTimeout(boot, 600);
