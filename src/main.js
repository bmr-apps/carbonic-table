// 탄소로운 식탁 · 화면 코드
// 구조: 서버 함수(/state)에서 한 벌을 받아 그리고, 모든 쓰기는 서버 함수로만 보냅니다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';
import { applyAppInfo } from './app-info.js';
import { loginWithGoogle, logout, onUserChange } from './auth.js';
import { local } from './store.js';
import { api, ApiError } from './api.js';

// ---------- 작은 도우미 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const KIND_ORDER = ['10학년', '11학년', '12학년', '교사'];
const KIND_CLASS = { '10학년': 'k10', '11학년': 'k11', '12학년': 'k12', '교사': 'kteacher' };
const KIND_CARD = { '10학년': 'k-10', '11학년': 'k-11', '12학년': 'k-12', '교사': 'k-teacher' };
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
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const kindBadge = (kind) => (KIND_CLASS[kind] ? `<span class="badge ${KIND_CLASS[kind]}">${esc(kind)}</span>` : '');
const emptyData = () => ({
  server_time: null,
  me: null,
  summary: { total_air: 0, activity_count: 0, participants: 0, member_count: 0 },
  by_kind: KIND_ORDER.map((kind) => ({ kind, air: 0, count: 0, members: 0 })),
  members: [], activities: [], missions: [], auctions: [],
});

const state = {
  user: null,
  data: null,
  loading: true,
  error: null,
  view: 'home',
  missionQuery: '',
  airFilter: 'all',
  picked: null,
  day: todayStr(),
  memberQuery: '',
  memberSort: 'earned',
};

const d = () => state.data || emptyData();
const meOf = () => d().me;

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
    state.data = await api.state();
    state.error = null;
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
  if (state.view === 'missions' && !me?.is_operator) state.view = 'home';
  document.body.dataset.view = state.view;
  renderHeader();
  renderNav();
  renderBanner();
  const main = $('#main');
  if (state.loading && !state.data) {
    main.innerHTML = '<div class="booting"><span class="spin" aria-hidden="true"></span> 실천 통장을 펼치는 중…</div>';
    return;
  }
  main.innerHTML = state.view === 'practices' ? practicesView()
    : state.view === 'auctions' ? auctionsView()
      : state.view === 'missions' ? missionsView()
        : homeView();
}

function renderHeader() {
  const me = meOf();
  $('#login').hidden = Boolean(state.user);
  $('#logout').hidden = !state.user;
  const who = $('#who');
  who.hidden = !state.user;
  who.textContent = state.user ? (me?.registered ? `${me.name} · ${me.kind}` : (state.user.email || '로그인됨')) : '';
  who.title = state.user?.email || '';
}

function renderNav() {
  const me = meOf();
  const op = Boolean(me?.is_operator);
  $$('#nav .nav-item').forEach((b) => {
    const view = b.dataset.nav;
    if (view === 'missions') b.hidden = !op;
    const on = view === state.view;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
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

// ---------- 현황 ----------
function homeView() {
  const data = d();
  const me = data.me;
  const total = data.summary.total_air || 0;
  const memberCount = data.summary.member_count || 0;
  const participants = data.summary.participants || 0;
  const activityCount = data.summary.activity_count || 0;
  const maxKind = Math.max(1, ...data.by_kind.map((k) => k.air || 0));

  return `<div class="wrap">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <span class="eyebrow">🌍 탄소로운 실천 통장</span>
        <h1 class="hero-total" id="hero-title">
          <span class="num">${nf(total)}</span>
          <span class="unit">공기의 실천!</span>
        </h1>
        <p>작은 실천 하나가 공기 한 줌이 됩니다. 별무리 사람들이 함께 모은 공기를 한눈에 보고, 모은 공기로 플리마켓 물건을 나눠요.</p>
        <div class="hero-actions">
          <button type="button" class="btn primary" data-action="go" data-view="practices">＋ 실천 등록하기</button>
          <button type="button" class="btn" data-action="go" data-view="auctions">공기 경매 보기</button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><small>함께한 사람</small><b>${nf(participants)}명</b></div>
        <div class="hero-stat"><small>실천 기록</small><b>${nf(activityCount)}건</b></div>
        <div class="hero-stat"><small>등록한 회원</small><b>${nf(memberCount)}명</b></div>
      </div>
    </section>

    <section class="kind-grid" aria-label="학년·구분별 합계">
      ${data.by_kind.map((k) => `
        <article class="kind-card ${KIND_CARD[k.kind] || ''}">
          <header><span>${esc(k.kind)}</span><span>${nf(k.members)}명</span></header>
          <div class="kind-body">
            <div class="kind-air"><b>${nf(k.air)}</b><small>공기</small></div>
            <div class="bar" role="img" aria-label="${esc(k.kind)} ${nf(k.air)}공기"><i class="w${Math.min(100, Math.max(0, Math.round(((k.air / maxKind) * 100) / 5) * 5))}"></i></div>
            <div class="kind-meta"><span>실천 ${nf(k.count)}건</span><span>${total ? Math.round((k.air / total) * 100) : 0}%</span></div>
          </div>
        </article>`).join('')}
    </section>

    <section class="cols">
      <div class="card">${ledgerCard(me)}</div>
      <div class="card">
        <div class="card-head"><h2>최근 실천</h2><span class="badge soft">${nf(data.activities.length)}건</span>
          <div class="right"><button type="button" class="btn sm ghost" data-action="refresh" aria-label="새로고침">↻</button></div></div>
        ${feedHtml(data.activities)}
      </div>
    </section>

    <section class="section" aria-labelledby="members-title">
      <div class="section-head">
        <h2 id="members-title">회원별 합산 현황</h2>
        <span class="eyebrow">모두 함께 보기</span>
      </div>
      ${membersTools()}
      <div class="table-scroll">
        <table class="board">
          <thead>
            <tr>
              <th scope="col">구분</th><th scope="col">이름</th>
              <th scope="col" class="num">총 적립</th><th scope="col" class="num">낙찰 사용</th>
              <th scope="col" class="num">경매 예약</th><th scope="col" class="num">남은 공기</th>
              <th scope="col">최근 실천</th>
            </tr>
          </thead>
          <tbody id="member-rows">${memberRowsHtml()}</tbody>
        </table>
      </div>
      <p class="hint mt8">남은 공기 = 총 적립 − 낙찰 확정 − 진행 중 경매에서 내가 최고 입찰자로 묶인 공기</p>
    </section>
  </div>`;
}

function ledgerCard(me) {
  if (!state.user) {
    return `<div class="card-head"><h2>내 통장</h2></div>
      <div class="guest-cta">
        <p>구글 로그인하고 내 공기를 모아 보세요. 로그인하지 않아도 아래 현황과 경매는 모두 볼 수 있어요.</p>
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
      <div class="right"><button type="button" class="btn sm ghost" data-action="open-profile">정보 수정</button></div></div>
    <div class="tiles">
      <div class="tile"><small>총 적립</small><b>${nf(me.earned)}<span class="u">공기</span></b></div>
      <div class="tile"><small>낙찰 사용</small><b>${nf(me.spent)}<span class="u">공기</span></b></div>
      <div class="tile warn"><small>경매 예약</small><b>${nf(me.reserved)}<span class="u">공기</span></b></div>
      <div class="tile hot"><small>남은 공기</small><b>${nf(me.available)}<span class="u">공기</span></b></div>
    </div>
    <p class="ledger-note">지금 <b>${nf(me.available)}공기</b>로 입찰할 수 있어요.</p>
    <div class="form-actions mt10">
      <button type="button" class="btn primary" data-action="go" data-view="practices">＋ 실천 등록</button>
      <button type="button" class="btn ghost" data-action="go" data-view="auctions">경매 보기</button>
    </div>`;
}

function feedHtml(list) {
  if (!list.length) {
    return `<div class="empty"><b>아직 첫 실천이 없어요.</b>첫 공기를 모아 볼까요?</div>`;
  }
  return `<ul class="feed">${list.map((a) => `
    <li>
      ${kindBadge(a.kind)}
      <span class="who-name">${esc(a.name || '회원')}</span>
      <span class="air">+${nf(a.air)}</span>
      <span class="what">${esc(a.mission)}</span>
      <span class="when">${fmtDay(a.done_on)} 실천 · ${fmtWhen(a.created_at)} 등록</span>
    </li>`).join('')}</ul>`;
}

function membersTools() {
  return `<div class="table-tools">
    <input type="search" id="member-search" placeholder="이름으로 찾기" value="${esc(state.memberQuery)}" aria-label="회원 이름 찾기">
    <select id="member-sort" aria-label="정렬">
      <option value="earned"${state.memberSort === 'earned' ? ' selected' : ''}>적립 많은 순</option>
      <option value="available"${state.memberSort === 'available' ? ' selected' : ''}>남은 공기 많은 순</option>
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
      <td class="name">${esc(m.name)}${isMe ? ' <span class="badge soft">나</span>' : ''}</td>
      <td class="num">${nf(m.earned)}</td>
      <td class="num">${nf(m.spent)}</td>
      <td class="num">${nf(m.reserved)}</td>
      <td class="num air-strong">${nf(m.available)}</td>
      <td>${m.last_at ? fmtWhen(m.last_at) : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');
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
      <p class="hint">로그인하지 않아도 현황과 경매는 볼 수 있어요.</p>
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

  const picked = d().missions.find((m) => m.id === state.picked) || null;
  const mine = d().activities.filter((a) => a.user_id === me.user_id);

  return `<div class="wrap">
    <div class="section-head">
      <h2>실천 등록</h2>
      <span class="eyebrow">${esc(me.name)} · ${esc(me.kind)} · 남은 ${nf(me.available)}공기</span>
    </div>
    <div class="picker">
      <section class="card mission-panel" aria-labelledby="missions-label">
        <div class="card-head"><h2 id="missions-label">미션 고르기</h2><span class="badge soft">${nf(d().missions.length)}개</span></div>
        <input type="search" id="mission-search" placeholder="미션 찾기 (예: 분리수거, 텀블러)" value="${esc(state.missionQuery)}" aria-label="미션 찾기">
        <div class="chips" role="group" aria-label="공기별 보기">
          ${[['all', '전체'], ['1', '1공기'], ['2', '2공기'], ['3', '3공기'], ['other', '그 외']].map(([key, label]) =>
            `<button type="button" class="chip ${state.airFilter === key ? 'on' : ''}" data-action="air-filter" data-filter="${key}" aria-pressed="${state.airFilter === key}">${label}</button>`).join('')}
        </div>
        <div class="mission-list" id="mission-list">${missionListHtml()}</div>
      </section>

      <section class="pick-sticky" aria-label="선택한 실천">
        <div class="pick-box">
          <div class="label">고른 미션</div>
          <div class="picked" id="picked-name">${picked ? esc(picked.name) : '아래에서 미션을 골라 주세요'}</div>
          <div class="reward"><b>+${picked ? nf(picked.air) : 0}</b><small>공기</small></div>
          <form class="pick-form" data-action="activity">
            <label class="field"><span>실천한 날</span>
              <input type="date" name="day" value="${esc(state.day)}" max="${todayStr()}" required>
            </label>
            <button type="submit" class="btn primary wide" ${picked ? '' : 'disabled'}>${picked ? `${nf(picked.air)}공기 적립하기` : '미션을 골라 주세요'}</button>
          </form>
          <p class="hint pick-hint">오늘 한 실천을 골라 기록하면 바로 통장에 들어가요.</p>
        </div>
      </section>
    </div>

    <section class="section" aria-labelledby="mine-title">
      <div class="section-head"><h2 id="mine-title">내가 등록한 실천</h2><span class="eyebrow">${nf(mine.length)}건</span></div>
      ${mine.length ? `<ul class="my-list">${mine.map((a) => `
        <li>
          <span class="m-name">${esc(a.mission)}</span>
          <span class="m-air">+${nf(a.air)}</span>
          <span class="m-day">${fmtDay(a.done_on)}</span>
          <button type="button" class="btn tiny ghost" data-action="delete-activity" data-id="${esc(a.id)}" aria-label="${esc(a.mission)} 기록 지우기">지우기</button>
        </li>`).join('')}</ul>` : `<div class="empty"><b>아직 내가 등록한 실천이 없어요.</b>위에서 미션을 골라 첫 공기를 적립해 보세요.</div>`}
    </section>
  </div>`;
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
  return list.map((m) => `
    <button type="button" class="mission-btn ${state.picked === m.id ? 'on' : ''}" data-action="pick" data-id="${esc(m.id)}" aria-pressed="${state.picked === m.id}">
      <span>${esc(m.name)}${m.active ? '' : ' <span class="badge soft">쉬는 중</span>'}</span>
      <span class="air-pill">${nf(m.air)}공기</span>
    </button>`).join('');
}

// ---------- 공기 경매 ----------
function auctionsView() {
  const data = d();
  const me = data.me;
  const op = Boolean(me?.is_operator);
  const open = data.auctions.filter((a) => a.status === 'open');
  const closed = data.auctions.filter((a) => a.status === 'closed');
  const canceled = data.auctions.filter((a) => a.status === 'canceled');

  return `<div class="wrap">
    <div class="section-head">
      <h2>공기 경매 · 플리마켓</h2>
      <span class="eyebrow">모은 공기로 물건 나누기</span>
    </div>
    <div class="op-bar">
      <p class="hint">입찰하는 순간 그 공기는 경매가 끝날 때까지 묶여요. 다른 사람이 더 높게 부르면 바로 풀립니다.</p>
      <div class="form-actions">
        <button type="button" class="btn sm ghost" data-action="refresh">↻ 새로고침</button>
        ${op ? `<button type="button" class="btn sm primary" data-action="toggle-auction-form">＋ 경매 올리기</button>` : ''}
      </div>
    </div>
    ${op ? auctionForm() : ''}
    ${open.length ? `<div class="auctions">${open.map((a) => auctionCard(a)).join('')}</div>`
      : `<div class="empty"><b>지금 열린 경매가 없어요.</b>${op ? '운영자라면 위에서 새 경매를 올릴 수 있어요.' : '새 물건이 올라오면 여기에서 입찰할 수 있어요.'}</div>`}
    ${closed.length ? `<section class="section"><div class="section-head"><h2>지난 경매 결과</h2><span class="eyebrow">${nf(closed.length)}건</span></div>
      <div class="auctions">${closed.map((a) => auctionCard(a)).join('')}</div></section>` : ''}
    ${op && canceled.length ? `<section class="section"><div class="section-head"><h2>취소한 경매</h2><span class="eyebrow">운영자만 보임</span></div>
      <div class="auctions">${canceled.map((a) => auctionCard(a)).join('')}</div></section>` : ''}
  </div>`;
}

function auctionForm() {
  return `<form class="card op-form" data-action="create-auction" id="auction-form" hidden>
    <div class="card-head"><h2>새 경매 올리기</h2></div>
    <div class="form-grid">
      <label class="field"><span>물품 이름</span><input type="text" name="title" maxlength="60" placeholder="예: 텀블러 (새 것)" required></label>
      <label class="field"><span>설명 (선택)</span><textarea name="description" rows="2" maxlength="300" placeholder="물건 소개, 받는 곳, 받는 시간 등"></textarea></label>
      <div class="form-row">
        <label class="field"><span>시작가 (공기)</span><input type="number" name="start_price" min="1" max="100000" step="1" value="5" required></label>
        <label class="field"><span>최소 입찰 단위 (공기)</span><input type="number" name="min_step" min="1" max="10000" step="1" value="1" required></label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn primary">경매 올리기</button>
        <button type="button" class="btn ghost" data-action="toggle-auction-form">닫기</button>
      </div>
    </div>
  </form>`;
}

function auctionCard(a) {
  const me = meOf();
  const op = Boolean(me?.is_operator);
  const open = a.status === 'open';
  const mineTop = Boolean(me?.registered && a.highest && a.highest.user_id === me.user_id);
  const minBid = a.highest ? a.highest.amount + a.min_step : a.start_price;
  const statusBadge = a.status === 'open' ? '<span class="badge open">진행 중</span>'
    : a.status === 'closed' ? (a.winner_name ? '<span class="badge closed">낙찰 완료</span>' : '<span class="badge closed">유찰</span>')
      : '<span class="badge canceled">취소</span>';

  let bidArea = '';
  if (open) {
    if (!state.user) {
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

  return `<article class="auction ${a.status === 'closed' ? 'closed' : ''} ${a.status === 'canceled' ? 'canceled' : ''}">
    <header><h3>${esc(a.title)}</h3>${statusBadge}</header>
    <div class="body">
      ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ''}
      <div class="price-row">
        <div><small>시작가</small><b>${nf(a.start_price)}</b></div>
        <div><small>지금 최고</small><b>${a.highest ? nf(a.highest.amount) : '—'}</b></div>
        <div><small>입찰</small><b>${nf(a.bid_count)}회</b></div>
      </div>
      ${open ? `<div class="topline ${mineTop ? 'mine' : ''}">${a.highest
        ? `${mineTop ? '<b>내가</b>' : `<b>${esc(a.highest.name)}</b>님이`} ${nf(a.highest.amount)}공기로 앞서 있어요`
        : '아직 입찰이 없어요. 첫 입찰자가 되어 보세요.'}</div>` : ''}
      ${winnerBox}
      ${bidArea}
      ${bidLog}
      ${op && open ? `<div class="op-actions">
        <button type="button" class="btn tiny" data-action="close-auction" data-id="${esc(a.id)}">마감하기</button>
        <button type="button" class="btn tiny danger" data-action="cancel-auction" data-id="${esc(a.id)}">취소하기</button>
      </div>` : ''}
      ${op && a.status === 'canceled' ? `<div class="op-actions">
        <button type="button" class="btn tiny ghost" data-action="delete-auction" data-id="${esc(a.id)}">목록에서 지우기</button>
      </div>` : ''}
    </div>
  </article>`;
}

// ---------- 미션 관리 (운영자) ----------
function missionsView() {
  const me = meOf();
  if (!me?.is_operator) {
    return `<div class="wrap"><section class="card gate">
      <span class="eyebrow">미션 관리</span>
      <h1>운영자만 들어올 수 있어요</h1>
      <p>구분이 <b>교사</b>인 회원이거나 허브 관리자·교직원이면 미션을 더하고 숨길 수 있어요.</p>
    </section></div>`;
  }
  const list = d().missions;
  return `<div class="wrap">
    <div class="section-head"><h2>미션 관리</h2><span class="eyebrow">${nf(list.length)}개</span></div>
    <form class="card form-grid mb16" data-action="add-mission">
      <div class="card-head"><h2>미션 더하기</h2></div>
      <div class="form-row three">
        <label class="field span2"><span>미션 이름</span><input type="text" name="name" maxlength="120" placeholder="예: 장바구니 들고 장보기" required></label>
        <label class="field"><span>공기</span><input type="number" name="air" min="1" max="100" step="1" value="1" required></label>
        <div class="form-actions end"><button type="submit" class="btn primary">추가</button></div>
      </div>
      <p class="hint">새 미션은 바로 실천 등록 목록에 나타나요. 지운 미션은 기록이 남도록 숨기기만 할 수 있어요.</p>
    </form>
    <div class="table-tools">
      <input type="search" id="mission-admin-search" placeholder="미션 찾기" aria-label="미션 찾기">
    </div>
    <div class="mission-admin" id="mission-admin-list">${missionAdminHtml()}</div>
  </div>`;
}

function missionAdminHtml() {
  const q = ($('#mission-admin-search')?.value || '').trim().toLowerCase();
  const list = d().missions.filter((m) => !q || m.name.toLowerCase().includes(q));
  if (!list.length) return `<div class="empty"><b>찾는 미션이 없어요.</b></div>`;
  return list.map((m) => `
    <div class="row ${m.active ? '' : 'off'}" data-mission="${esc(m.id)}">
      <span class="nm">${esc(m.name)}</span>
      <input type="number" min="1" max="100" step="1" value="${m.air}" aria-label="${esc(m.name)} 공기" id="mission-air-${esc(m.id)}">
      <button type="button" class="btn tiny ghost" data-action="save-mission-air" data-id="${esc(m.id)}">공기 저장</button>
      <button type="button" class="btn tiny ${m.active ? '' : 'primary'}" data-action="toggle-mission" data-id="${esc(m.id)}" data-active="${m.active ? '1' : '0'}">${m.active ? '숨기기' : '다시 쓰기'}</button>
      <span class="uses">사용 ${nf(m.uses)}회</span>
    </div>`).join('');
}

// ---------- 동작 ----------
function switchView(view) {
  state.view = view;
  if (view === 'practices') state.day = state.day || todayStr();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function withBusy(btn, fn) {
  const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  try { return await fn(); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = old; delete btn.dataset.busy; } }
}

document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('#nav [data-nav]');
  if (navBtn) { switchView(navBtn.dataset.nav); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'go') { switchView(el.dataset.view || 'home'); return; }
  if (action === 'login') { loginWithGoogle(); return; }
  if (action === 'logout') {
    await logout();
    toast('로그아웃했어요. 이 앱에서만 나왔어요.', 'ok');
    return;
  }
  if (action === 'retry' || action === 'refresh') { load({ quiet: Boolean(state.data) }); return; }
  if (action === 'open-profile') { openProfileDialog(); return; }
  if (action === 'close-dialog') { const dlg = el.closest('dialog'); if (dlg?.open) dlg.close(); return; }
  if (action === 'pick') {
    state.picked = state.picked === el.dataset.id ? null : el.dataset.id;
    // 목록·고른 미션만 다시 그린다 (날짜 입력은 그대로)
    const list = $('#mission-list');
    if (list) list.innerHTML = missionListHtml();
    const picked = d().missions.find((m) => m.id === state.picked) || null;
    const nameEl = $('#picked-name');
    if (nameEl) nameEl.textContent = picked ? picked.name : '아래에서 미션을 골라 주세요';
    const box = $('.pick-box');
    if (box && picked) {
      $('.reward', box).innerHTML = `<b>+${nf(picked.air)}</b><small>공기</small>`;
      const submit = $('form[data-action="activity"] button[type="submit"]', box);
      if (submit) { submit.disabled = false; submit.textContent = `${nf(picked.air)}공기 적립하기`; }
    }
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
  if (action === 'delete-activity') {
    const ok = await askConfirm('이 실천 기록을 지울까요? 적립된 공기도 함께 줄어들어요.');
    if (!ok) return;
    try {
      await api.deleteActivity(el.dataset.id);
      toast('기록을 지웠어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '지우지 못했어요.', 'err'); }
    return;
  }
  if (action === 'toggle-auction-form') {
    const form = $('#auction-form');
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('input[name="title"]')?.focus();
    return;
  }
  if (action === 'close-auction' || action === 'cancel-auction' || action === 'delete-auction') {
    const win = action === 'close-auction';
    const ok = await askConfirm(win
      ? '지금 최고 입찰자를 낙찰자로 확정하고 경매를 마감할까요?'
      : action === 'cancel-auction' ? '이 경매를 취소할까요? 묶여 있던 입찰 공기는 모두 풀립니다.' : '취소한 경매를 목록에서 지울까요?');
    if (!ok) return;
    try {
      await withBusy(el, async () => {
        if (win) {
          const r = await api.closeAuction(el.dataset.id);
          toast(r.result === 'won' ? `${r.winner}님이 ${nf(r.amount)}공기로 낙찰받았어요.` : '입찰이 없어 유찰로 마감했어요.', 'ok');
        } else if (action === 'cancel-auction') {
          await api.cancelAuction(el.dataset.id);
          toast('경매를 취소했어요.', 'ok');
        } else {
          await api.deleteAuction(el.dataset.id);
          toast('목록에서 지웠어요.', 'ok');
        }
      });
      await load({ quiet: true });
    } catch (err) { toast(err.message || '처리하지 못했어요.', 'err'); }
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
    const picked = d().missions.find((m) => m.id === state.picked);
    if (!picked) { toast('먼저 미션을 골라 주세요.', 'err'); return; }
    const day = form.querySelector('input[name="day"]')?.value || todayStr();
    state.day = day;
    try {
      await withBusy(btn, async () => {
        const r = await api.addActivity(picked.id, day);
        toast(`「${r.activity.mission}」 ${nf(r.activity.air)}공기를 적립했어요!`, 'ok');
      });
      state.picked = null;
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

  if (action === 'create-auction') {
    const fd = new FormData(form);
    try {
      await withBusy(btn, () => api.addAuction({
        title: String(fd.get('title') || ''),
        description: String(fd.get('description') || ''),
        start_price: Number(fd.get('start_price')),
        min_step: Number(fd.get('min_step')),
      }));
      toast('경매를 올렸어요.', 'ok');
      await load({ quiet: true });
    } catch (err) { toast(err.message || '올리지 못했어요.', 'err'); }
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
    const list = $('#mission-admin-list');
    if (list) list.innerHTML = missionAdminHtml();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'member-sort') {
    state.memberSort = e.target.value;
    const rows = $('#member-rows');
    if (rows) rows.innerHTML = memberRowsHtml();
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
  if ((user?.id ?? null) !== prev) { state.picked = null; load({ quiet: true }); }
  else render();
});

// 로그인 확인이 늦어져도 화면은 먼저 그린다
window.setTimeout(boot, 600);
