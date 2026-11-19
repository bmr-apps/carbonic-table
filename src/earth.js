// 지구 그림 (v5) — 실제 대륙 · 부드러운 극지방 빙하 · 사람과 북극곰의 행복도
//  · 대륙: Natural Earth 실제 해안선(src/land-data.js)을 자전 띠(240폭)에 맞춰 그립니다.
//    위도에 따라 극지→툰드라→숲→사막→열대 순으로 색이 이어져, 한반도·일본·아프리카가 눈에 익은 모양으로 보입니다.
//  · 빙하: 안정일 때 북극·남극의 얼음이 적당한 크기로 머물고, 바다 쪽 경계는 딱딱한 선 대신
//    흐릿한 그라데이션으로 바다에 녹아듭니다. 온난화가 깊어질수록 얼음이 줄어듭니다.
//  · 사람(한반도 위치 · 대륙과 함께 자전)과 북극곰(빙하 위)의 표정이 4단계마다 달라집니다.
//    안정 = 활짝 웃음 + 하트, 온난화 주의 = 땀 한 방울, 위기 = 땀 뻘뻘, 폭염 = 눈물·기진맥진.
import { LAND_PATHS } from './land-data.js';

const hexOf = (h) => {
  const s = String(h).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
export const mixColor = (a, b, t) => {
  const A = hexOf(a), B = hexOf(b), k = Math.max(0, Math.min(1, Number(t) || 0));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// 세 색을 이어 섞습니다 (파랑 → 청록 → 붉은색처럼 중간색이 탁해지지 않게)
const mix3 = (a, b, c, k) => (k < 0.5 ? mixColor(a, b, k * 2) : mixColor(b, c, (k - 0.5) * 2));

// 바다·하늘 색 — 시원한 파랑에서 뜨거운 붉은 갈색으로
const PALETTE = {
  oceanLight: ['#c2f5fc', '#5fb9c4', '#f3b184'],
  ocean: ['#2f9fda', '#146f7d', '#a63d2c'],
  oceanDeep: ['#0a4a86', '#0a3b45', '#6e2a1d'],
  landLine: ['#1d6b45', '#6d3a2a', '#5a2216'],
  snow: ['#ffffff', '#ffe6da'],
  cloud: ['#ffffff', '#f6dccd'],
  atmo: ['#9fe6ff', '#ef8655'],
  iceLine: ['#bfe9ff', '#ffd9c8'],
};
// 대륙의 더운 날 색 — 위도 색을 이 색 쪽으로 섞습니다
const LAND_HOT = '#c0664a';

// 위도에 따른 대륙 색 (y 좌표 → 색). 극 → 툰드라 → 침엽수림 → 온대 초원 → 사막대 → 열대
const LAND_BANDS = [
  [20, '#eef8fd'],
  [44, '#d7e9dc'],
  [56, '#94c6a2'],
  [66, '#6cb47c'],
  [80, '#4f9f5f'],
  [90, '#7cb95a'],
  [100, '#d8c98a'],
  [106, '#b7c76a'],
  [114, '#4da45f'],
  [120, '#2f9450'],
  [128, '#42a05a'],
  [140, '#cfc079'],
  [150, '#5aa86c'],
  [166, '#8cc09a'],
  [200, '#d9eaec'],
  [222, '#eef8fd'],
];

// 지구 상태 4단계 — 기온 상승·기후 위기 이야기
export const EARTH_STATES = {
  stable: { label: '안정 (시원함)', note: '지구가 시원하게 숨 쉬고 있어요' },
  warming: { label: '온난화 주의', note: '탄소가 쌓이며 기온이 올라요' },
  crisis: { label: '기후 위기 경고', note: '빙하가 녹고 지구가 달아올라요' },
  boiling: { label: '임계점 돌파 (폭염)', note: '지구가 한계에 닿았어요' },
};
export const earthState = (p) => {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  return t < 0.05 ? 'stable' : t < 0.35 ? 'warming' : t < 0.7 ? 'crisis' : 'boiling';
};

// 온난화 지수(0~1) → 이야기용 기온 상승치 (0.0 ~ +3.0°C). 실제 기후 수치가 아니라 눈금입니다.
export const warmingC = (p) => {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  return Math.round(t * 30) / 10;
};
export const tempText = (p) => `+${warmingC(p).toFixed(1)}°C`;

export function earthLook(p) {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  const ko = Math.pow(t, 1.05);
  const c = {};
  for (const [k, [a, b2, b]] of Object.entries(PALETTE)) {
    c[k] = Array.isArray(b2) ? mix3(a, b2, b, ko) : mixColor(a, b2, Math.pow(t, 1.2));
  }
  // 바다: 파랑 → 청록 → 붉은 갈색 (파랑과 빨강을 바로 섞으면 보라색이 되어 지구가 탁해 보입니다)
  c.ocean = mix3('#2f9fda', '#146f7d', '#a63d2c', ko);
  c.oceanLight = mix3('#c2f5fc', '#5fb9c4', '#f3b184', ko);
  c.oceanDeep = mix3('#0a4a86', '#0a3b45', '#6e2a1d', ko);
  // 테두리 빛: 시원한 하늘빛 → 따뜻한 주황 → 빨강 (녹색으로 돌지 않게 단계를 나눕니다)
  c.ring = t < 0.3 ? mixColor('#38bdf8', '#7dd3fc', t / 0.3)
    : t < 0.6 ? mixColor('#7dd3fc', '#f59e0b', (t - 0.3) / 0.3)
      : mixColor('#f59e0b', '#ef4444', (t - 0.6) / 0.4);
  const state = earthState(t);
  return { ...c, t, state, label: EARTH_STATES[state].label, temp: tempText(t) };
}

/**
 * 자전 위상 맞추기 — 화면을 다시 그려도(30초마다 한 번) 대륙·구름이 처음으로 되돌아가지 않고
 * 실제로 돌던 자리에서 이어지게 합니다. (CSP 가 inline style 을 막으므로 CSSOM 으로만 넣습니다)
 */
export const SPIN = { land: 34, clouds: 21 };
export function syncEarthSpin(root) {
  const now = Date.now() / 1000;
  const el = root?.querySelectorAll ? root : document;
  el.querySelectorAll('.earth-spin-land, .earth-spin-clouds').forEach((node) => {
    const dur = node.classList.contains('earth-spin-clouds') ? SPIN.clouds : SPIN.land;
    node.style.setProperty('animation-delay', `-${(now % dur).toFixed(3)}s`);
  });
}

const ART_W = 240;        // 자전 띠 한 주기의 폭
const LAT_SCALE = 0.82;   // 위도 1도 = 0.82
const px = (lon) => ((lon + 165) * ART_W) / 360;   // 띠 왼쪽 끝이 태평양 한가운데(lon −165)
const py = (lat) => 120 - lat * LAT_SCALE;
const KOREA = { x: px(127.8), y: py(36.5) };       // 한반도 — 사람이 서 있는 자리

// 대륙 위에 얹는 작은 숲·산 — 실제 위치를 좌표로 옮겨 적었습니다 (숫자는 px(lon), py(lat))
const FORESTS = [
  [px(-62), py(-4), 7, 4.4], [px(-52), py(-8), 5, 3.4],     // 아마존
  [px(22), py(1), 6, 3.8], [px(15), py(5), 4, 2.6],         // 콩고
  [px(100), py(61), 9, 4.2], [px(125), py(60), 8, 4],       // 시베리아
  [px(-100), py(55), 8, 4], [px(-78), py(50), 6, 3.4],      // 캐나다
  [px(18), py(52), 5, 3], [px(35), py(56), 5, 3],           // 유럽
  [px(112), py(2), 4.6, 3], [px(132), py(-6), 4, 2.6],      // 보르네오·뉴기니
];
const MOUNTAINS = [
  [px(84), py(30), 5, 5.4],    // 히말라야
  [px(70), py(-20), 4, 5],     // 안데스
  [px(-108), py(45), 4.6, 4.6], // 록키
  [px(10), py(46), 3.4, 3.2],  // 알프스
  [px(38), py(10), 3.6, 3.4],  // 에티오피아 고원
];

// ---------- 사람 ----------
const PERSON = {
  stable: { shirt: '#2fae5b', pants: '#2b4f74', skin: '#ffd8b2', cheek: '#ff9d8a' },
  warming: { shirt: '#f2bf35', pants: '#2b4f74', skin: '#ffd8b2', cheek: '#ff9d8a' },
  crisis: { shirt: '#ef8b3c', pants: '#2b4f74', skin: '#ffd0a4', cheek: '#e8604a' },
  boiling: { shirt: '#df4632', pants: '#2b4f74', skin: '#ffc39a', cheek: '#d63a2a' },
};

const drop = (x, y, s = 1, color = '#7fd4ff') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0c-1.5 2-2 2.9-2 3.7a2 2 0 0 0 4 0c0-.8-.5-1.7-2-3.7z" fill="${color}" stroke="#2f7fae" stroke-width=".45"/>
      <circle cx="-.6" cy="2.6" r=".55" fill="#ffffff" opacity=".85"/></g>`;
const heart = (x, y, s = 1, color = '#ff5f7e') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 2.4C-2.4.4-4.4-1-4.4-2.8-4.4-4.2-3.3-5-2.2-5c.9 0 1.7.5 2.2 1.3C.5-4.5 1.3-5 2.2-5c1.1 0 2.2.8 2.2 2.2 0 1.8-2 3.2-4.4 5.2z"
        fill="${color}" stroke="#c9304c" stroke-width=".4"/></g>`;
const spark = (x, y, s = 1, color = '#fff3a8') => `<path transform="translate(${x} ${y}) scale(${s})"
      d="M0-3.2 1-1 3.2 0 1 1 0 3.2-1 1-3.2 0-1-1z" fill="${color}"/>`;

function personFace(state, m) {
  const eyes = (y = -20.1, dx = 1.75) => `<circle cx="${-dx}" cy="${y}" r=".72" fill="#232a33"/><circle cx="${dx}" cy="${y}" r=".72" fill="#232a33"/>`;
  switch (state) {
    case 'stable':
      return `${eyes()}
        <path d="M-2.5-17.3q2.5 2.7 5 0" fill="none" stroke="#8c2f3c" stroke-width=".95" stroke-linecap="round"/>
        <circle cx="-3.2" cy="-18" r="1.05" fill="${m.cheek}" opacity=".55"/><circle cx="3.2" cy="-18" r="1.05" fill="${m.cheek}" opacity=".55"/>`;
    case 'warming':
      return `${eyes()}
        <path d="M-2-17.5q2 .8 4 0" fill="none" stroke="#8c2f3c" stroke-width=".9" stroke-linecap="round"/>
        <path d="M-2.6-21.6q1.2-1 2.4-.2" fill="none" stroke="#4a3226" stroke-width=".7" stroke-linecap="round"/>
        ${drop(4.6, -22.4, .62)}`;
    case 'crisis':
      return `<path d="M-2.6-20.6l1.7 1.2-1.7 1.2" fill="none" stroke="#232a33" stroke-width=".85" stroke-linecap="round"/>
        <path d="M2.6-20.6l-1.7 1.2 1.7 1.2" fill="none" stroke="#232a33" stroke-width=".85" stroke-linecap="round"/>
        <ellipse cx="0" cy="-16.9" rx="1.5" ry="1.9" fill="#a83341"/>
        <circle cx="-3.4" cy="-18.2" r="1.15" fill="${m.cheek}" opacity=".6"/><circle cx="3.4" cy="-18.2" r="1.15" fill="${m.cheek}" opacity=".6"/>
        ${drop(-5.2, -22.6, .8)} ${drop(5.1, -21.4, .68)}`;
    default: // boiling
      return `<path d="M-3-21.4l2.4 2.4M-.6-21.4l-2.4 2.4" fill="none" stroke="#5c1f28" stroke-width=".85" stroke-linecap="round"/>
        <path d="M.6-21.4l2.4 2.4M3-21.4l-2.4 2.4" fill="none" stroke="#5c1f28" stroke-width=".85" stroke-linecap="round"/>
        <path d="M-2.2-17.2q1.1 1.4 2.2 0 1.1 1.4 2.2 0" fill="none" stroke="#8c2f3c" stroke-width=".9" stroke-linecap="round"/>
        <path d="M-1.6-15.2q1.6.9 3.2 0" fill="#ff7d8f" stroke="#c2455a" stroke-width=".4"/>
        <circle cx="0" cy="-19.4" r="4.9" fill="#e2503c" opacity=".18"/>
        ${drop(-2.2, -16.2, .7, '#8fe0ff')} ${drop(2.2, -16.2, .7, '#8fe0ff')}`;
  }
}

function personArms(state) {
  const m = PERSON[state];
  const st = `stroke="${m.shirt}" stroke-width="2.3" stroke-linecap="round"`;
  if (state === 'stable') {
    return `<path d="M-5-14.4-8.4-19.4" ${st}/><path d="M5-14.4 8.4-19.4" ${st}/>
      <circle cx="-8.7" cy="-19.9" r="1.25" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>
      <circle cx="8.7" cy="-19.9" r="1.25" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>`;
  }
  if (state === 'warming') {
    return `<path d="M-5-14.2-7.6-10.2" ${st}/><path d="M5-14.2 7.4-16.8" ${st}/>
      <circle cx="-7.9" cy="-9.7" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>
      <circle cx="7.7" cy="-17.4" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>`;
  }
  if (state === 'crisis') {
    return `<path d="M-5-14.2-7.2-8.6" ${st}/><path d="M5-14.2 7.2-8.6" ${st}/>
      <circle cx="-7.5" cy="-8.1" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>
      <circle cx="7.5" cy="-8.1" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>`;
  }
  return `<path d="M-5-14.2-6.4-7.4" ${st}/><path d="M5-14.2 6.4-7.4" ${st}/>
    <circle cx="-6.6" cy="-6.9" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>
    <circle cx="6.6" cy="-6.9" r="1.5" fill="${m.skin}" stroke="#4a2f1e" stroke-width=".5"/>`;
}

function personArt(state) {
  const m = PERSON[state];
  const sway = state === 'boiling' ? ' rotate(-7)' : state === 'crisis' ? ' rotate(-3)' : '';
  const decor = state === 'stable'
    ? `${heart(9.6, -24.4, .95)} ${heart(-9.8, -21.6, .7, '#ff8fa6')} ${spark(-11.4, -25.2, .9)} ${spark(12.4, -19.6, .7)}`
    : state === 'warming'
      ? `${spark(9.4, -23.4, .6, '#ffe9a8')}`
      : state === 'crisis'
        ? `${drop(9.2, -26, .85)} ${drop(-9.4, -27.4, .7)}`
        : `<path d="M-9-27.4q1.6-3.4 0-6.8M9-27.4q1.6-3.4 0-6.8" fill="none" stroke="#ff6a4d" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>
           <path d="M-12.4-24.6q1.4-2.8 0-5.6M12.4-24.6q1.4-2.8 0-5.6" fill="none" stroke="#ff8f5e" stroke-width="1" stroke-linecap="round" opacity=".75"/>`;
  return `<g class="earth-person" transform="translate(${KOREA.x.toFixed(1)} ${(KOREA.y + 1).toFixed(1)})">
    <ellipse cx="0" cy="1.6" rx="7.4" ry="2.3" fill="#0a2333" opacity=".2"/>
    <g transform="scale(.82)${sway}">
      ${personArms(state)}
      <path d="M-3.4-6.6h2.8v6.4h-2.8z" fill="${m.pants}"/>
      <path d="M.6-6.6h2.8v6.4h-2.8z" fill="${m.pants}"/>
      <path d="M-5.6-15.6q0-2.6 2.6-2.6h6q2.6 0 2.6 2.6v7.2q0 2.6-2.6 2.6h-6q-2.6 0-2.6-2.6z"
        fill="${m.shirt}" stroke="#0b2033" stroke-width="1.1"/>
      <circle cx="0" cy="-19.4" r="4.9" fill="${m.skin}" stroke="#4a2f1e" stroke-width="1.1"/>
      <path d="M-4.9-20.5q1.1-4.5 4.9-4.5q3.8 0 4.9 4.5q-2.3-1.8-4.9-1.8q-2.6 0-4.9 1.8z" fill="#3b2a20" stroke="#2a1b13" stroke-width=".4"/>
      ${personFace(state, m)}
    </g>
  </g>`;
}

// ---------- 북극곰 ----------
const BEAR_EYES = {
  stable: `<path d="M-2.8-13.6q1-1.2 2 0M.8-13.6q1-1.2 2 0" fill="none" stroke="#2d3138" stroke-width=".9" stroke-linecap="round"/>`,
  warming: `<circle cx="-1.8" cy="-13.8" r=".75" fill="#2d3138"/><circle cx="1.8" cy="-13.8" r=".75" fill="#2d3138"/>
    <path d="M-2.6-15.4q.8-.7 1.6-.1M1-15.5q.8-.6 1.6.1" fill="none" stroke="#5a5248" stroke-width=".55" stroke-linecap="round"/>`,
  crisis: `<circle cx="-1.8" cy="-13.4" r=".82" fill="#2d3138"/><circle cx="1.8" cy="-13.4" r=".82" fill="#2d3138"/>
    <path d="M-3.4-15.6l2.3.7M3.4-15.6l-2.3.7" fill="none" stroke="#5a5248" stroke-width=".7" stroke-linecap="round"/>`,
  boiling: `<path d="M-3.1-14.6l2.2 2.2M-.9-14.6l-2.2 2.2M.9-14.6l2.2 2.2M3.1-14.6l-2.2 2.2" fill="none" stroke="#3a2f2a" stroke-width=".8" stroke-linecap="round"/>`,
};

function bearArt(state, x, y) {
  const ear = state === 'crisis' || state === 'boiling' ? ' rotate(24)' : '';
  const earR = state === 'crisis' || state === 'boiling' ? ' rotate(-24)' : '';
  const face = state === 'stable'
    ? `<path d="M-2-11.3q2 1.6 4 0" fill="none" stroke="#4a4038" stroke-width=".75" stroke-linecap="round"/>`
    : state === 'warming'
      ? `<path d="M-1.6-11.2h3.2" stroke="#4a4038" stroke-width=".7" stroke-linecap="round"/>`
      : state === 'crisis'
        ? `<ellipse cx="0" cy="-10.6" rx="1.1" ry="1.4" fill="#c25a63"/><path d="M-1.1-9.4q1.1.9 2.2 0" fill="#ff8f9c" stroke="#b8515b" stroke-width=".3"/>`
        : `<path d="M-1.9-11q1.9 1.6 3.8 0" fill="none" stroke="#4a4038" stroke-width=".8" stroke-linecap="round"/>
           <path d="M-1.4-9.6q1.4 1.2 2.8 0" fill="#ff8f9c" stroke="#b8515b" stroke-width=".3"/>
           ${drop(-2.6, -8.2, .62, '#8fe0ff')} ${drop(2.6, -8.2, .62, '#8fe0ff')}`;
  const decor = state === 'stable'
    ? `${heart(9.2, -20.4, 1.05)} ${spark(-9.6, -21, .95)} ${spark(11.6, -14.6, .6)}`
    : state === 'warming'
      ? `${drop(7.4, -20.4, .7)}`
      : state === 'crisis'
        ? `${drop(-7.6, -21.4, .9)} ${drop(7.6, -19.6, .75)}`
        : `<path d="M-8.4-24q1.6-3.4 0-6.8M8.4-24q1.6-3.4 0-6.8" fill="none" stroke="#ff6a4d" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`;
  const body = state === 'boiling'
    ? `<ellipse cx="0" cy="-6.4" rx="8.4" ry="5" fill="#fcfeff" stroke="#b9cbd8" stroke-width="1.1"/>`
    : `<ellipse cx="0" cy="-6.6" rx="7.8" ry="6.2" fill="#fcfeff" stroke="#b9cbd8" stroke-width="1.1"/>`;
  return `<g class="earth-bear" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <ellipse cx="0" cy="1.2" rx="8.6" ry="2.4" fill="#0a2333" opacity=".18"/>
    <g transform="scale(.84)">
      ${body}
      <ellipse cx="0" cy="-4.6" rx="4.2" ry="3.6" fill="#e8f1f8"/>
      <g transform="translate(-4.6 -17)${earR}"><circle cx="0" cy="0" r="2.2" fill="#fbfdff" stroke="#b9cbd8" stroke-width=".9"/><circle cx="0" cy="0" r="1.1" fill="#f3c9cc"/></g>
      <g transform="translate(4.6 -17)${ear}"><circle cx="0" cy="0" r="2.2" fill="#fbfdff" stroke="#b9cbd8" stroke-width=".9"/><circle cx="0" cy="0" r="1.1" fill="#f3c9cc"/></g>
      <circle cx="0" cy="-13.4" r="4.7" fill="#fcfeff" stroke="#b9cbd8" stroke-width="1.1"/>
      <ellipse cx="0" cy="-11.6" rx="2.7" ry="2" fill="#f2f7fb" stroke="#d5e2ec" stroke-width=".5"/>
      <ellipse cx="0" cy="-12.4" rx="1.15" ry=".8" fill="#33383f"/>
      ${BEAR_EYES[state]}
      <ellipse cx="-5.2" cy="-2" rx="2.9" ry="2" fill="#fcfeff" stroke="#c4d4e0" stroke-width=".8"/>
      <ellipse cx="5.2" cy="-2" rx="2.9" ry="2" fill="#fcfeff" stroke="#c4d4e0" stroke-width=".8"/>
      ${face}
    </g>
    ${decor}
  </g>`;
}

// ---------- 빙하 ----------
const waveAt = (x, amp) => (3.1 * Math.sin(x * 0.062 + 0.4) + 1.5 * Math.sin(x * 0.155 + 2.1) + 0.8 * Math.sin(x * 0.31 + 4.2)) * amp;

// dir = 1(북극, 위쪽이 얼음) / −1(남극)
// 빙하 크기: 안정일 때 적당하고, 뜨거워질수록 줄어듭니다 (북극 54 → 39, 남극 186 → 201)
const iceParams = (t) => {
  const k = Math.pow(Math.max(0, Math.min(1, t)), 0.9);
  return { north: 54 - 15 * k, south: 186 + 15 * k, amp: 1 - 0.35 * k, k };
};

function iceShape(edgeY, dir, amp) {
  const top = dir > 0 ? -16 : 256;
  const pts = [];
  for (let x = 268; x >= -28; x -= 6) pts.push([x, edgeY + waveAt(x, amp)]);
  return `M-28 ${top}H268V${pts[0][1].toFixed(1)}L` + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' ') + 'Z';
}

function iceArt(c, t, state) {
  const { north, south, amp } = iceParams(t);
  const lineC = mixColor('#9ed3ec', '#e0a58c', t);
  const cracks = (dir) => {
    const y0 = dir > 0 ? 32 : 208;
    const out = [];
    for (let i = 0; i < 5; i++) {
      const x = 34 + i * 44 + (dir > 0 ? 0 : 11);
      out.push(`<path d="M${x} ${y0}l${dir > 0 ? 5 : -4} ${dir * (6 + (i % 3) * 3)}l${dir > 0 ? -3 : 3} ${dir * 5}" fill="none" stroke="${lineC}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`);
    }
    return out.join('');
  };
  const gradTop = north - 10, gradBot = north + 4;
  const sTop = south - 4, sBot = south + 10;
  return `<defs>
      <linearGradient id="earth-ice-n" gradientUnits="userSpaceOnUse" x1="0" y1="${gradTop.toFixed(1)}" x2="0" y2="${gradBot.toFixed(1)}">
        <stop offset="0%" stop-color="${c.snow}" stop-opacity="1"/>
        <stop offset="70%" stop-color="${c.snow}" stop-opacity="1"/>
        <stop offset="85%" stop-color="${c.snow}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${c.snow}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="earth-ice-s" gradientUnits="userSpaceOnUse" x1="0" y1="${sBot.toFixed(1)}" x2="0" y2="${sTop.toFixed(1)}">
        <stop offset="0%" stop-color="${c.snow}" stop-opacity="1"/>
        <stop offset="70%" stop-color="${c.snow}" stop-opacity="1"/>
        <stop offset="85%" stop-color="${c.snow}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${c.snow}" stop-opacity="0"/>
      </linearGradient>
      <filter id="earth-ice-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
      <filter id="earth-ice-line" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter>
    </defs>
    <g class="earth-ice">
      <!-- 바다로 번지는 흐릿한 얼음 빛 -->
      <g filter="url(#earth-ice-soft)" opacity=".7">
        <path d="${iceShape(north + 5, 1, amp)}" fill="url(#earth-ice-n)"/>
        <path d="${iceShape(south - 5, -1, amp)}" fill="url(#earth-ice-s)"/>
      </g>
      <!-- 단단한 얼음 -->
      <path d="${iceShape(north, 1, amp)}" fill="url(#earth-ice-n)"/>
      <path d="${iceShape(south, -1, amp)}" fill="url(#earth-ice-s)"/>
      <!-- 얼음 가장자리의 푸른 기운 -->
      <g filter="url(#earth-ice-line)" opacity=".5">
        <path d="${iceShape(north, 1, amp)}" fill="none" stroke="#bfe1f2" stroke-width="1.6"/>
        <path d="${iceShape(south, -1, amp)}" fill="none" stroke="#bfe1f2" stroke-width="1.6"/>
      </g>
      <g opacity=".8">
        ${cracks(1)}${cracks(-1)}
      </g>
      <!-- 북극곰이 앉은 작은 얼음 조각 (위기·폭염) -->
      ${state === 'crisis' || state === 'boiling'
        ? `<g transform="translate(120 ${(north + 8).toFixed(1)})">
             <ellipse cx="0" cy="0" rx="${state === 'boiling' ? 8 : 11}" ry="${state === 'boiling' ? 2.4 : 3.2}" fill="${c.snow}" opacity=".97"/>
             <ellipse cx="0" cy=".6" rx="${state === 'boiling' ? 8 : 11}" ry="${state === 'boiling' ? 2.4 : 3.2}" fill="${mixColor('#bfe9ff', '#ffd9c8', t)}" opacity=".35"/>
           </g>`
        : ''}
    </g>`;
}

// ---------- 대륙 ----------
function landLatGradient(c, t) {
  const hot = Math.pow(t, 1.45) * 0.86;
  return `<linearGradient id="earth-land" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="224">
      ${LAND_BANDS.map(([y, col]) => `<stop offset="${((y - 18) / 206 * 100).toFixed(1)}%" stop-color="${mixColor(col, LAND_HOT, hot * 0.92)}"/>`).join('\n      ')}
    </linearGradient>`;
}

function landArt(c, t, state) {
  const peak = 0.45 * (1 - 0.5 * t);   // 기온이 오르면 높은 산의 만년설이 줄어듭니다
  const forestOp = 0.5 + 0.12 * t;
  return `
        <g fill-rule="evenodd" stroke="${c.landLine}" stroke-width=".9" stroke-linejoin="round" fill="url(#earth-land)">
          ${LAND_PATHS.map((d) => `<path d="${d}"/>`).join('\n          ')}
        </g>

        <g fill="${mixColor('#1f7a45', '#7d3a28', Math.pow(t, 1.3))}" opacity="${forestOp.toFixed(2)}">
          ${FORESTS.map(([x, y, rx, ry]) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="${ry}"/>`).join('')}
        </g>

        <g stroke="${c.landLine}" stroke-width=".7" stroke-linejoin="round" stroke-opacity=".75">
          ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${(x - w).toFixed(1)} ${y.toFixed(1)}l${w} ${(-h).toFixed(1)}l${w} ${h}z" fill="${mixColor('#7a8f6a', '#9c4a33', Math.pow(t, 1.2))}"/>`).join('\n          ')}
          ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${(x - w * peak).toFixed(1)} ${(y - h * (1 - peak)).toFixed(1)}l${(w * peak).toFixed(1)} ${(-h * peak).toFixed(1)}l${(w * peak).toFixed(1)} ${(h * peak).toFixed(1)}z" fill="${c.snow}" stroke="none"/>`).join('\n          ')}
        </g>

        ${personArt(state)}`;
}

// 구름 한 벌 — 대륙과 다른 속도로 흐릅니다
function cloudArt(c, op) {
  return `<g fill="${c.cloud}" opacity="${op}">
          <g><circle cx="60" cy="104" r="7"/><circle cx="70" cy="100" r="9.5"/><circle cx="81" cy="105" r="7"/><rect x="56" y="104" width="29" height="7" rx="3.5"/></g>
          <g><circle cx="146" cy="140" r="8"/><circle cx="157" cy="136" r="10"/><circle cx="168" cy="141" r="7.5"/><rect x="142" y="140" width="30" height="8" rx="4"/></g>
          <g><circle cx="58" cy="172" r="6"/><circle cx="66" cy="169" r="8"/><circle cx="75" cy="173" r="6"/><rect x="55" y="172" width="24" height="6.5" rx="3"/></g>
          <g><circle cx="174" cy="58" r="5.5"/><circle cx="181" cy="55" r="7"/><circle cx="189" cy="59" r="5"/><rect x="171" y="58" width="21" height="5.5" rx="2.6"/></g>
          <g><circle cx="216" cy="118" r="5"/><circle cx="222" cy="115" r="6.5"/><circle cx="229" cy="119" r="4.6"/><rect x="213" y="118" width="19" height="5" rx="2.4"/></g>
          <g><circle cx="22" cy="64" r="4.6"/><circle cx="28" cy="61.5" r="6"/><circle cx="34" cy="65" r="4.2"/><rect x="19" y="64" width="17" height="4.6" rx="2.2"/></g>
        </g>`;
}

const band = (inner) => `<g>${inner}</g>\n        <g transform="translate(${ART_W} 0)">${inner}</g>`;

const MOOD_TEXT = {
  stable: '사람도 북극곰도 활짝 웃어요',
  warming: '더워져서 땀이 나요',
  crisis: '빙하가 녹아 북극곰이 지쳐요',
  boiling: '지구가 한계에 닿았어요',
};
export function earthMood(p) {
  const state = earthState(p);
  return MOOD_TEXT[state];
}

export function earthSvg(p) {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  const c = earthLook(t);
  const state = c.state;
  const pct = Math.round(t * 100);
  const hazeOp = (0.015 + 0.3 * Math.pow(t, 1.8)).toFixed(3);
  const ringW = (1.5 + t * 5.5).toFixed(1);
  const ringOp = (0.14 + t * 0.5).toFixed(2);
  const heatOp = (t * 0.5).toFixed(2);
  const heatW = (4 + t * 12).toFixed(1);
  const cloudOp = (0.8 - t * 0.32).toFixed(2);
  const sparkOp = (0.85 - t * 0.55).toFixed(2);
  const sunOp = (0.26 - t * 0.16).toFixed(2);
  const { north, amp } = iceParams(t);
  const bearOnFloe = state === 'crisis' || state === 'boiling';
  const bearY = bearOnFloe ? north + 7.4 : north + waveAt(120, amp) - 1.4;

  return `<svg class="earth-svg" viewBox="0 0 240 240" role="img" aria-label="지구 온난화 지수 ${pct}% · 지구 온도 ${tempText(t)} · ${MOOD_TEXT[state]}">
    <defs>
      <radialGradient id="earth-ocean" cx="32%" cy="26%" r="88%">
        <stop offset="0%" stop-color="${c.oceanLight}"/>
        <stop offset="46%" stop-color="${c.ocean}"/>
        <stop offset="100%" stop-color="${c.oceanDeep}"/>
      </radialGradient>
      <radialGradient id="earth-atmo" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stop-color="${c.atmo}" stop-opacity="0"/>
        <stop offset="88%" stop-color="${c.atmo}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${c.atmo}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="earth-sun" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <filter id="earth-heat" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
      ${landLatGradient(c, t)}
      <clipPath id="earth-clip"><circle cx="120" cy="120" r="92"/></clipPath>
    </defs>

    <!-- 대기광 (고정) -->
    <circle cx="120" cy="120" r="107" fill="url(#earth-atmo)" opacity="0.95"/>
    <circle cx="120" cy="120" r="92" fill="url(#earth-ocean)" stroke="#000" stroke-width="3"/>

    <g clip-path="url(#earth-clip)">
      <!-- 대륙 (자전) — 한반도의 사람도 함께 돕니다 -->
      <g class="earth-spin earth-spin-land">
        ${band(landArt(c, t, state))}
      </g>

      <!-- 구름 (자전 · 대륙과 다른 속도) -->
      <g class="earth-spin earth-spin-clouds">
        ${band(cloudArt(c, cloudOp))}
      </g>

      ${iceArt(c, t, state)}

      <!-- 북극곰 (빙하 위 · 고정) -->
      ${bearArt(state, 120, bearY)}

      <!-- 고정 조명 — 자전해도 빛은 늘 같은 자리에서 들어옵니다 -->
      <g class="earth-overlay">
        <ellipse cx="80" cy="52" rx="76" ry="52" fill="url(#earth-sun)"/>
        <path d="M36 108a92 92 0 0 1 34-58" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="${sunOp}"/>

        <!-- 열기 안개 (기후 위기가 깊어질수록 짙어짐) -->
        <circle cx="120" cy="120" r="92" fill="${c.atmo}" opacity="${hazeOp}"/>
      </g>
    </g>

    <!-- 반짝임 -->
    <g fill="#ffffff" opacity="${sparkOp}">
      <path d="M34 46l1.4 3.9 3.9 1.4-3.9 1.4L34 56.6l-1.4-3.9L28.7 51.3l3.9-1.4z"/>
      <path d="M208 64l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z"/>
      <path d="M199 186l0.9 2.5 2.5 0.9-2.5 0.9-0.9 2.5-0.9-2.5-2.5-0.9 2.5-0.9z"/>
      <path d="M43 196l0.9 2.5 2.5 0.9-2.5 0.9-0.9 2.5-0.9-2.5-2.5-0.9 2.5-0.9z"/>
    </g>

    <!-- 온난화 열기 링 (고정 · 기온이 오를수록 강해짐) -->
    <circle cx="120" cy="120" r="101" fill="none" stroke="${c.ring}" stroke-width="${heatW}" opacity="${heatOp}" filter="url(#earth-heat)"/>
    <circle cx="120" cy="120" r="99" fill="none" stroke="${c.ring}" stroke-width="${ringW}" opacity="${ringOp}"/>
    <circle cx="120" cy="120" r="92" fill="none" stroke="#000" stroke-width="3"/>
  </svg>`;
}
