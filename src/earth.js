// 지구 그림 (v7) — 실제 대륙 · 부드러운 극지방 빙하 · 기후 위기의 원인과 재해
//  · 열기: 온난화 지수가 오르면 누런 황토빛이 아니라 바다·대륙이 진홍(붉은 열기)으로 달아오르고,
//    가장자리에 붉은 열기 안개와 열기 링이 번집니다.
//  · 구름: 단계가 오를수록 개수가 늘고(3 → 14개), 잿빛·먹구름이 섞입니다.
//    구름은 원인·재해 그림 아래에 깔려, 구름이 많아져도 그림이 묻히지 않습니다.
//  · 대륙: Natural Earth 실제 해안선(src/land-data.js)을 자전 띠(240폭)에 맞춰 그립니다.
//    위도에 따라 극지→툰드라→숲→사막→열대 순으로 색이 이어져, 한반도·일본·아프리카가 눈에 익은 모양으로 보입니다.
//  · 빙하: 안정일 때 북극·남극의 얼음이 적당한 크기로 머물고, 바다 쪽 경계는 딱딱한 선 대신
//    흐릿한 그라데이션으로 바다에 녹아듭니다. 온난화가 깊어질수록 얼음이 줄어듭니다.
//  · 원인: 온난화가 깊어질수록 발전소 → 가축 → 자동차 → 쓰레기 순서로 대륙마다 늘어납니다.
//  · 결과: 같은 순서로 산불·폭염·가뭄·폭설·홍수·태풍이 대륙별로 번지고,
//    뜨거워진 바다에는 배를 드러낸 물고기와 하얗게 백화된 산호(집단 폐사)가 늘어납니다.
//  · 모든 요소는 대륙 띠 안에 있어 지구 자전과 함께 돌아갑니다.
import { LAND_PATHS } from './land-data.js';

const hexOf = (h) => {
  const s = String(h).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
export const mixColor = (a, b, t) => {
  const A = hexOf(a), B = hexOf(b), k = Math.max(0, Math.min(1, Number(t) || 0));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// 여러 지점 색을 이어 섞습니다 — 중간색이 탁해지지 않도록 지점을 촘촘히 잡아 씁니다
const rampMix = (stops, k) => {
  const x = Math.max(0, Math.min(1, Number(k) || 0));
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    if (x <= p1) {
      const [p0, c0] = stops[i - 1];
      return mixColor(c0, c1, (x - p0) / (p1 - p0 || 1));
    }
  }
  return stops[stops.length - 1][1];
};

// 바다·하늘 색 — 시원한 파랑에서 뜨거운 진홍(열기)으로.
//  파랑과 빨강을 오래 섞거나 주황을 거치면 누런 회갈색이 되므로, 청록 → 진홍 구간을 짧게 두고
//  60%를 넘으면 바다가 확실히 붉게 보이도록 지점을 잡았습니다. (마지막은 식어 가는 듯 짙은 진홍)
const RAMP = {
  ocean: [[0, '#2f9fda'], [0.28, '#1a8a96'], [0.42, '#16626e'], [0.52, '#c33a2c'], [0.64, '#dc2626'], [0.86, '#e8332a'], [1, '#a01a1c']],
  oceanLight: [[0, '#c2f5fc'], [0.3, '#7fd0da'], [0.45, '#bb8e80'], [0.62, '#ff7f6a'], [0.85, '#ff6257'], [1, '#c94a42']],
  oceanDeep: [[0, '#0a4a86'], [0.3, '#0d4a55'], [0.44, '#2a3b45'], [0.56, '#6e1a1c'], [0.8, '#8c1a1a'], [1, '#5c0a0c']],
  atmo: [[0, '#9fe6ff'], [0.28, '#7dd3fc'], [0.42, '#fca5a5'], [0.56, '#f97362'], [0.72, '#ef4444'], [1, '#b91c1c']],
  cloud: [[0, '#ffffff'], [0.6, '#f8ded2'], [1, '#eac6ba']],
  snow: [[0, '#ffffff'], [0.6, '#fff1ea'], [1, '#ffd2c6']],
  // 테두리 빛: 시원한 하늘빛 → 연한 산호 → 선명한 빨강 (노랑·주황 구간 없이 바로 붉어집니다)
  ring: [[0, '#38bdf8'], [0.24, '#7dd3fc'], [0.34, '#bae6fd'], [0.44, '#fecaca'], [0.56, '#f87171'], [0.7, '#ef4444'], [0.86, '#dc2626'], [1, '#991b1b']],
};
const landLineOf = (t) => mixColor('#1d6b45', '#5e1015', Math.pow(t, 1.05));
// 대륙의 더운 날 색 — 위도 색을 이 색 쪽으로 섞습니다 (탁한 황토가 아닌 진홍)
const LAND_HOT = '#8f2a1f';

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
  stable: { label: '안정 (시원함)', note: '깨끗한 대륙과 바다가 숨 쉬어요' },
  warming: { label: '온난화 주의', note: '발전소·가축이 늘며 지구 기온이 올라요' },
  crisis: { label: '기후 위기 경고', note: '산불·폭설·폭우와 바다 폐사가 번져요' },
  boiling: { label: '임계점 돌파 (폭염)', note: '전 세계 재해와 해양 위기가 한계에 닿았어요' },
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
  for (const [k, stops] of Object.entries(RAMP)) c[k] = rampMix(stops, ko);
  c.landLine = landLineOf(t);
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

/* ==========================================================================
   원인 요소 — 발전소 · 가축 · 자동차 · 쓰레기 (웹 스타일의 납작한 벡터 + 흰 후광)
   ========================================================================== */

// 발전소(화력) — 쌍곡선 냉각탑 + 굴뚝 + 피어오르는 연기
const PLANT = `
  <g class="earth-smoke">
    <g fill="#f2f7fc" opacity=".85">
      <ellipse cx="-.6" cy="-20.4" rx="3.4" ry="2.5"/>
      <ellipse cx="1.4" cy="-23.6" rx="2.9" ry="2.2"/>
      <ellipse cx="-.2" cy="-26.4" rx="2" ry="1.6"/>
    </g>
    <g fill="#e4ebf4" opacity=".8">
      <circle cx="9.4" cy="-19.8" r="1.9"/>
      <circle cx="11.8" cy="-22.4" r="2.3"/>
      <circle cx="14.6" cy="-24" r="1.7"/>
    </g>
  </g>
  <path d="M6.6 0l.5-18.6h2.4L10 0z" fill="#9aa9bb" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M7.05-17.2h2.4v1.5h-2.4z" fill="#f8fafc" stroke="none"/>
  <path d="M-5.4 0C-4.4-4.2-3.5-7.4-3.4-10.4-3.35-12.4-3.8-13.8-4.2-15.2H4.2C3.8-13.8 3.35-12.4 3.4-10.4 3.5-7.4 4.4-4.2 5.4 0Z"
    fill="#dde5ee" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M.6-15.2C.2-13.8-.25-12.4-.2-10.4-.1-7.4.8-4.2 1.8 0H5.4C4.4-4.2 3.5-7.4 3.4-10.4 3.35-12.4 3.8-13.8 4.2-15.2Z"
    fill="#aab8c8" opacity=".75" stroke="none"/>
  <ellipse cx="0" cy="-15.2" rx="4.2" ry="1.15" fill="#f2f7fc" stroke="#0f172a" stroke-width=".9"/>
  <ellipse cx="0" cy="-15.2" rx="2.9" ry=".6" fill="#475569" stroke="none"/>
  <path d="M-4.4-.1h8.8" stroke="#94a3b8" stroke-width="1.1" opacity=".9"/>
  <path d="M-3.2-.2 0-2.8 3.2-.2" fill="none" stroke="#94a3b8" stroke-width=".8" opacity=".8"/>`;

// 가축(젖소) — 얼룩·뿔·젖이 있는 옆모습
const COW = `
  <path d="M4.6-4.6 2.6-7 5.4-6.2Z" fill="#f8fafc" stroke="#0f172a" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M9.6-4.6 11.6-7 8.8-6.2Z" fill="#f8fafc" stroke="#0f172a" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M6.1-5.5 5.5-7.3M9.1-5.5 9.7-7.3" stroke="#a16207" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M-7.6-1.8C-7.6-4.4-6.2-5.3-3.6-5.3H1.2C3.8-5.3 5.2-4 5.2-1.2V2.2H3V5.8H1.2V2.2H-2.6V5.8H-4.4V2.2H-7.6Z"
    fill="#f8fafc" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-4-5C-2-4.8-1.4-2.8-2.8-1.8-4.2-.8-5.8-1.8-5.6-3-5.5-4.1-4.9-4.9-4-5Z" fill="#1e293b"/>
  <path d="M1.6.4C3 .4 3.7 1.6 3 2.4 2.2 3.2.8 2.8.7 1.8.6 1.1 1 .4 1.6.4Z" fill="#1e293b"/>
  <path d="M-7.4-3C-9.2-3.4-9.8-2-9.4-.6" fill="none" stroke="#0f172a" stroke-width="1" stroke-linecap="round"/>
  <ellipse cx="-1.4" cy="2" rx="2.2" ry="1.3" fill="#fbcfe8" stroke="#0f172a" stroke-width=".7"/>
  <ellipse cx="7.4" cy="-2.6" rx="3.5" ry="3" fill="#f8fafc" stroke="#0f172a" stroke-width="1"/>
  <ellipse cx="8.6" cy="-1.2" rx="2.4" ry="1.6" fill="#fbcfe8" stroke="#0f172a" stroke-width=".7"/>
  <circle cx="8" cy="-1.2" r=".35" fill="#0f172a"/><circle cx="9.3" cy="-1.2" r=".35" fill="#0f172a"/>
  <circle cx="6.6" cy="-3.6" r=".6" fill="#0f172a"/>`;

// 자동차 — 유선형 승용차 + 배기 매연
const CAR = `
  <g fill="#cbd5e1" opacity=".85">
    <circle cx="-9.6" cy="-.8" r="1.5"/>
    <circle cx="-11.7" cy="-2.2" r="1.9"/>
    <circle cx="-13.8" cy="-3.6" r="1.5"/>
  </g>
  <path d="M-7.6 2.4V.2C-7.6-.6-7.2-1-6.4-1.2l3-1.1 1.8-3.2c.5-1 1.2-1.4 2.3-1.4h2.2c1.1 0 1.8.5 2.3 1.4l1.8 3.2 3.6 1.1c.8.2 1.2.6 1.2 1.4v2.2Z"
    fill="#ef4444" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-3.1-1.7-1.7-4.4c.2-.4.5-.6 1-.6h1.1v3.3Z" fill="#bae6fd" stroke="#0f172a" stroke-width=".65" stroke-linejoin="round"/>
  <path d="M1.1-5h1c.5 0 .8.2 1 .6l1.4 2.7H1.1Z" fill="#bae6fd" stroke="#0f172a" stroke-width=".65" stroke-linejoin="round"/>
  <path d="M6.4-1.1h1.2v1H6.4z" fill="#fde047" stroke="none"/>
  <path d="M-.4-1.5v3.6" stroke="#b91c1c" stroke-width=".7" opacity=".85"/>
  <circle cx="-4.4" cy="2.7" r="2.05" fill="#1e293b" stroke="#f8fafc" stroke-width=".55"/>
  <circle cx="-4.4" cy="2.7" r=".78" fill="#cbd5e1"/>
  <circle cx="4.2" cy="2.7" r="2.05" fill="#1e293b" stroke="#f8fafc" stroke-width=".55"/>
  <circle cx="4.2" cy="2.7" r=".78" fill="#cbd5e1"/>`;

// 쓰레기 — 수레 쓰레기통 + 묶은 봉투 + 캔 (폐기물 더미)
const TRASH = `
  <ellipse cx="-1" cy="5.6" rx="8.8" ry="1.9" fill="#57534e" opacity=".22"/>
  <path d="M2.8 5C2.4 2.6 3.2.4 4.8-.4 6.2-1.1 7.6-.4 7.9 1.2 8.2 2.9 7.6 4.5 7.1 5Z"
    fill="#d8dee5" stroke="#0f172a" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M4.9-.7 4.5-2.2 5.8-1.4 6.9-2.2 7-.7Z" fill="#b9c1ca" stroke="#0f172a" stroke-width=".75" stroke-linejoin="round"/>
  <path d="M-6.2-1.4h8v6.1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z" fill="#4aa87a" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-7.2-2.4h9a.9.9 0 0 1 .9.9v.7h-10.8v-.7a.9.9 0 0 1 .9-.9z" fill="#2f7d5a" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-3.2-3.5h3" stroke="#0f172a" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M-4.6-1.2v6M-1.8-1.2v6" stroke="#2f7d5a" stroke-width=".7" opacity=".45"/>
  <circle cx="-4.6" cy="5.9" r="1.15" fill="#1e293b"/>
  <circle cx="0" cy="5.9" r="1.15" fill="#1e293b"/>
  <rect x="-9.2" y="3" width="3.4" height="2.1" rx=".9" transform="rotate(-16 -7.5 4)" fill="#60a5fa" stroke="#0f172a" stroke-width=".8"/>`;

/* ==========================================================================
   자연재해 — 산불 · 폭염 · 가뭄 · 폭설 · 홍수 · 태풍 (대륙별 대표 지역에)
   ========================================================================== */

// 산불 — 불꽃 두 갈래 + 연기 + 그을린 땅
const FIRE = `
  <ellipse cx="0" cy="4.6" rx="7.2" ry="2.2" fill="#3f2412" opacity=".6"/>
  <path d="M-6.6 4.4c1-1.8 2.4-2.6 4-2.8M2.6 4.4c1.2-1 2.6-1.2 4-1" fill="none" stroke="#78350f" stroke-width=".9" stroke-linecap="round"/>
  <g fill="#cbd5e1" opacity=".85">
    <ellipse cx="-1.6" cy="-10.6" rx="2.6" ry="1.7"/>
    <ellipse cx="1.4" cy="-12.8" rx="2.9" ry="1.9"/>
    <ellipse cx="5" cy="-14.6" rx="2.2" ry="1.5"/>
  </g>
  <path d="M0-8.8c3.8 4.2 6.4 7.2 5.2 11.2-.9 3-8.9 3.2-10-.2C-5.6-1.4-2.8-4.8 0-8.8Z"
    fill="#ea580c" stroke="#7c2d12" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-2.6-1.6c1 2 1.8 3.2 1.2 6.6-1.6 0-3.2-1.2-3.2-3 0-1.4.8-2.6 2-3.6Z" fill="#f97316"/>
  <path d="M1.2-4.2c1.8 2.8 2.2 4.8 1.2 7-1 1.9-3.2 1.6-3.6-.2-.4-1.6.8-3.8 2.4-6.8Z" fill="#fde047"/>`;

// 폭염 — 붉은 해 + 아지랑이
const HEAT = `
  <g stroke="#f97316" stroke-width="1.3" stroke-linecap="round" opacity=".9">
    <path d="M0-8.4v-1.6"/><path d="M-5.9-5.9-7-7"/><path d="M5.9-5.9 7-7"/>
    <path d="M-7.6 0h-1.6"/><path d="M7.6 0h1.6"/>
  </g>
  <circle cx="0" cy="0" r="5.2" fill="#ef4444" stroke="#7f1d1d" stroke-width="1"/>
  <circle cx="0" cy="0" r="2.7" fill="#fde047"/>
  <g fill="none" stroke="#dc2626" stroke-width="1.4" stroke-linecap="round" opacity=".85">
    <path d="M-6 6.2q1.5-1.8 3 0t3 0 3 0"/>
    <path d="M-4 8.8q1.5-1.8 3 0t3 0"/>
  </g>`;

// 가뭄 — 갈라진 황토 대지 (마른 진흙 조각)
const DROUGHT = `
  <path d="M-8.8.8C-9-1.8-6.6-3.6-3.4-3.9.6-4.2 5.4-3.7 7.4-1.9 8.6-.7 7.7 1.9 4.9 3 1.1 4.4-4.9 4.2-7.3 2.7-8.1 2.2-8.7 1.7-8.8.8Z"
    fill="#dcab68" stroke="#78350f" stroke-width=".95" stroke-linejoin="round"/>
  <g fill="none" stroke="#8a4a19" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-7.6-2.2-4.4-.9-6.2 2.1"/>
    <path d="M-4.4-.9-.6.9"/>
    <path d="M-.6.9 1.9-1.3 4.1.2"/>
    <path d="M4.1.2 6.4-1.8"/>
    <path d="M1.9-1.3 2.9-3.6"/>
  </g>`;

const flake = (cx, cy, r) => `<g transform="translate(${cx} ${cy})" stroke="#38bdf8" stroke-width=".85" stroke-linecap="round">
      <path d="M0 ${-r}V${r}M${(-r * 0.87).toFixed(2)} ${(-r / 2).toFixed(2)}L${(r * 0.87).toFixed(2)} ${(r / 2).toFixed(2)}M${(-r * 0.87).toFixed(2)} ${(r / 2).toFixed(2)}L${(r * 0.87).toFixed(2)} ${(-r / 2).toFixed(2)}"/></g>`;

// 폭설 — 눈구름 + 눈송이 + 눈더미
const SNOW = `
  <path d="M-7.2 1C-9.8 1-10.4-2.6-7.8-3.4-7.2-6.8-2.6-7.6 0-5.4 2-7.8 7.2-6.8 7.6-3.6 10.2-3 9.8 1 7.2 1Z"
    fill="#e8eff7" stroke="#334155" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-9.4 8.2C-9 6.2-7.4 4.8-5.4 5.4-3.8 5.9-2.6 6.9-1 6.2.8 5.4 1.9 4.5 3.7 5.2 5.6 5.9 6.8 6.9 8.6 6.2 9.2 6 9.4 7.4 9.4 8.2Z"
    fill="#ffffff" stroke="#94a3b8" stroke-width=".8" stroke-linejoin="round"/>
  ${flake(-4.6, 0, 1.9)}${flake(.8, 1.4, 2.1)}${flake(5.2, .2, 1.9)}`;

// 홍수 — 먹구름 + 빗줄기 + 불어난 물
const FLOOD = `
  <path d="M-7.2-1.4C-9.6-1.4-10.2-4.8-7.6-5.6-7-9-2.6-9.6 0-7.4 2-9.8 7-9 7.4-5.8 9.8-5.2 9.4-1.4 7-1.4Z"
    fill="#475569" stroke="#0f172a" stroke-width=".95" stroke-linejoin="round"/>
  <g stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round">
    <path d="M-4.2 0-5.4 3.6"/><path d="M-.2 0-1.4 3.6"/><path d="M3.8 0 2.6 3.6"/>
  </g>
  <path d="M-8.4 4.4C-5.6 3.4-2.8 5.4 0 4.4 2.8 3.4 5.6 5.4 8.4 4.4V9H-8.4Z" fill="#7dd3fc" opacity=".9"/>
  <path d="M-7.4 5.6q1.9-1.6 3.8 0t3.8 0 3.8 0 3.8 0" fill="none" stroke="#0284c7" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M-6.2 8.2q1.7-1.4 3.4 0t3.4 0" fill="none" stroke="#f8fafc" stroke-width="1" stroke-linecap="round" opacity=".9"/>`;

// 태풍 — 두 팔 나선 + 눈
const TYPHOON = `
  <path d="M0 0C-2.6-4.8-9.2-4.2-10 1.4-11 7.6-5 11.6.4 10.8 6.8 9.8 10.4 3 6.6-3.4 3.2-9.2-3.8-11-8.6-7.6"
    fill="none" stroke="#f1f5f9" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M0 0C-2.6-4.8-9.2-4.2-10 1.4-11 7.6-5 11.6.4 10.8 6.8 9.8 10.4 3 6.6-3.4 3.2-9.2-3.8-11-8.6-7.6"
    fill="none" stroke="#0ea5e9" stroke-width="1.25" stroke-linecap="round"/>
  <circle cx="0" cy="0" r="1.9" fill="#0f172a"/>
  <circle cx="0" cy="0" r="3.5" fill="none" stroke="#0f172a" stroke-width=".7" opacity=".4"/>`;

/* ==========================================================================
   바다 — 뜨거워진 바다의 집단 폐사 (배를 드러낸 물고기 · 하얗게 백화된 산호)
   ========================================================================== */

const FISH = `
  <ellipse cx="0" cy="1.2" rx="5.6" ry="1.7" fill="#0a2333" opacity=".16"/>
  <path d="M4.2 0 7.4-2.8V2.8Z" fill="#b6c3d2" stroke="#0f172a" stroke-width=".85" stroke-linejoin="round"/>
  <path d="M-4.8 0C-3.4-3.2 3.4-3.2 4.8 0 3.4 3.2-3.4 3.2-4.8 0Z"
    fill="#e8eef5" stroke="#0f172a" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M-3.6-2.4C-1.4-3.2 2-3 3.8-1.6" fill="none" stroke="#94a3b8" stroke-width=".8" stroke-linecap="round"/>
  <path d="M-3.5-.8-1.7.9M-1.7-.8-3.5.9" stroke="#0f172a" stroke-width=".9" stroke-linecap="round"/>
  <path d="M1.4-.2c.4-1 .2-1.9-.4-2.6" fill="none" stroke="#0f172a" stroke-width=".7" stroke-linecap="round"/>`;

const CORAL = `
  <ellipse cx="0" cy="4.6" rx="6" ry="1.6" fill="#cbd5e1" stroke="#94a3b8" stroke-width=".6"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0 4.6V-3M0 1-3.4-3.4M0-.6 3.4-4M-3.4-3.4-4.4-6.8M3.4-4 4.6-7.4M-3.4-3.4-1.4-7M3.4-4 1.4-7.6" stroke="#8fa3b6" stroke-width="2.9"/>
    <path d="M0 4.6V-3M0 1-3.4-3.4M0-.6 3.4-4M-3.4-3.4-4.4-6.8M3.4-4 4.6-7.4M-3.4-3.4-1.4-7M3.4-4 1.4-7.6" stroke="#fbfdff" stroke-width="1.7"/>
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 4.4V1.4M6 2.4 7.8.2M6 2.4 4.4.4" stroke="#8fa3b6" stroke-width="2.4"/>
    <path d="M6 4.4V1.4M6 2.4 7.8.2M6 2.4 4.4.4" stroke="#f2f7fb" stroke-width="1.4"/>
  </g>`;

/* ==========================================================================
   배치 — 대륙·해역별 좌표(lon, lat)와 등장 시점(at: 온난화 지수)
   원인은 발전소 → 가축 → 자동차 → 쓰레기 순서로, 재해는 지역별 대표 재해가 차례로 늘어납니다.
   ========================================================================== */
const SCENE = [
  // --- 원인: 발전소 (가장 먼저) ---
  { art: PLANT, lon: 108, lat: 34, at: 0.06, s: 0.8 },         // 중국 내륙
  { art: PLANT, lon: 16, lat: 54, at: 0.12, s: 0.78 },         // 독일·폴란드
  { art: PLANT, lon: -97, lat: 44, at: 0.26, s: 0.78 },        // 미국 중서부
  { art: PLANT, lon: 25, lat: -25, at: 0.44, s: 0.76 },        // 남아프리카

  // --- 원인: 가축 ---
  { art: COW, lon: -50, lat: -15, at: 0.16, s: 0.8 },          // 브라질
  { art: COW, lon: -63, lat: -36, at: 0.3, s: 0.78 },          // 아르헨티나
  { art: COW, lon: 39, lat: 12, at: 0.45, s: 0.76 },           // 에티오피아

  // --- 원인: 자동차 ---
  { art: CAR, lon: 42, lat: 49, at: 0.36, s: 0.78 },           // 러시아·동유럽
  { art: CAR, lon: 137, lat: 36, at: 0.48, s: 0.74, flip: -1 }, // 일본
  { art: CAR, lon: -102, lat: 25, at: 0.6, s: 0.76 },          // 멕시코

  // --- 원인: 쓰레기 (가장 나중) ---
  { art: TRASH, lon: 3, lat: 2, at: 0.56, s: 0.8 },            // 서아프리카
  { art: TRASH, lon: 110, lat: -7, at: 0.7, s: 0.78 },         // 자바

  // --- 결과: 자연재해 (대륙별 대표 재해) ---
  { art: HEAT, lon: 0, lat: 40, at: 0.07, s: 0.76 },           // 유럽(이베리아) 폭염
  { art: DROUGHT, lon: 6, lat: 19, at: 0.15, s: 0.78 },        // 아프리카 사헬 가뭄
  { art: HEAT, lon: 60, lat: 29, at: 0.28, s: 0.74 },          // 남아시아(파키스탄) 폭염
  { art: FIRE, lon: 123, lat: -19, at: 0.34, s: 0.8 },         // 호주 산불
  { art: FLOOD, lon: 88, lat: 26, at: 0.4, s: 0.76 },          // 남아시아 홍수
  { art: SNOW, lon: -79, lat: 49, at: 0.46, s: 0.76 },         // 캐나다·미국 동북부 폭설
  { art: FIRE, lon: -117, lat: 47, at: 0.5, s: 0.74 },         // 미국 서부 산불
  { art: FLOOD, lon: 106, lat: 15, at: 0.52, s: 0.74 },        // 동남아 홍수
  { art: FIRE, lon: -70, lat: -4, at: 0.58, s: 0.74 },         // 아마존 산불
  { art: FIRE, lon: 70, lat: 62, at: 0.6, s: 0.72 },           // 시베리아 산불
  { art: SNOW, lon: 30, lat: 68, at: 0.62, s: 0.72 },          // 북유럽 폭설
  { art: FLOOD, lon: 22, lat: -4, at: 0.66, s: 0.72 },         // 콩고 홍수
  { art: TYPHOON, lon: 135, lat: 12, at: 0.68, s: 0.74 },      // 서태평양 태풍
  { art: TYPHOON, lon: -28, lat: 30, at: 0.74, s: 0.72 },      // 대서양 허리케인

  // --- 결과: 바다 집단 폐사 (배를 드러낸 물고기 · 백화 산호) ---
  { art: FISH, lon: -150, lat: 2, at: 0.34, s: 0.92 },         // 태평양
  { art: FISH, lon: 78, lat: -12, at: 0.42, s: 0.92, rot: 12 }, // 인도양
  { art: CORAL, lon: 146, lat: -14, at: 0.48, s: 0.92 },       // 그레이트 배리어 리프
  { art: FISH, lon: -40, lat: 12, at: 0.56, s: 0.92, rot: -8 }, // 대서양
  { art: CORAL, lon: 93, lat: -32, at: 0.62, s: 0.88 },        // 인도양 남부 산호
  { art: CORAL, lon: -75, lat: 20, at: 0.72, s: 0.88 },        // 카리브해 산호
];

// 지구 그림 안에서 작은 화면에도 한눈에 읽히도록 전체 크기를 함께 키웁니다
const ITEM_SCALE = 1.16;
// 바다 요소는 파란 바탕 위라 흰 후광 없이 두고, 대륙 위 요소만 흰 후광으로 대륙과 분리합니다
const SEA_ART = new Set([FISH, CORAL]);
const itemArt = (it) => {
  const x = px(it.lon).toFixed(1), y = py(it.lat).toFixed(1);
  const s = it.s * ITEM_SCALE;
  const rot = it.rot ? ` rotate(${it.rot})` : '';
  const halo = SEA_ART.has(it.art) ? '' : ' filter="url(#earth-pop)"';
  return `<g class="earth-item" transform="translate(${x} ${y}) scale(${(s * (it.flip || 1)).toFixed(3)} ${s.toFixed(3)})${rot}"${halo}>${it.art}</g>`;
};

// 온난화 지수에 따라 지금 보여야 하는 원인·재해만 그립니다 (등장 순서 = at 오름차순)
const impactArt = (t) => `<g class="earth-impact">${SCENE.filter((it) => it.at <= t + 1e-9).map(itemArt).join('')}</g>`;

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

function iceArt(c, t) {
  const { north, south, amp } = iceParams(t);
  const lineC = mixColor('#9ed3ec', '#ffb59c', t);
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
        <path d="${iceShape(north, 1, amp)}" fill="none" stroke="${mixColor('#bfe1f2', '#ffc0ac', t)}" stroke-width="1.6"/>
        <path d="${iceShape(south, -1, amp)}" fill="none" stroke="${mixColor('#bfe1f2', '#ffc0ac', t)}" stroke-width="1.6"/>
      </g>
      <g opacity=".8">
        ${cracks(1)}${cracks(-1)}
      </g>
    </g>`;
}

// ---------- 대륙 ----------
function landLatGradient(c, t) {
  const hot = Math.pow(t, 1.6) * 0.86;
  return `<linearGradient id="earth-land" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="224">
      ${LAND_BANDS.map(([y, col]) => `<stop offset="${((y - 18) / 206 * 100).toFixed(1)}%" stop-color="${mixColor(col, LAND_HOT, hot * 0.92)}"/>`).join('\n      ')}
    </linearGradient>`;
}

function landArt(c, t) {
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
        </g>`;
}

/* ==========================================================================
   구름 — 단계가 오를수록 개수가 늘고 탁해집니다.
   안정: 맑은 흰 구름 3~4개 → 주의: 5~6개 → 경고: 잿빛이 섞인 7~8개
   → 임계점: 짙은 먹구름·스모그 구름까지 11~14개가 화면을 덮습니다.
   앞쪽(맑은 구름)부터 차례로 등장하므로, 단계가 오르면 "구름이 늘어난다"가 한눈에 보입니다.
   ========================================================================== */
const CLOUDS = [
  // --- 맑은 흰 구름 (처음부터) ---
  { x: 60, y: 102, s: 1.0, kind: 'clean' },
  { x: 150, y: 140, s: 1.05, kind: 'clean' },
  { x: 176, y: 58, s: 0.86, kind: 'clean' },
  { x: 56, y: 174, s: 0.9, kind: 'clean' },
  // --- 잿빛 구름 (주의 후반) ---
  { x: 214, y: 118, s: 0.84, kind: 'grey' },
  { x: 22, y: 64, s: 0.78, kind: 'grey' },
  { x: 104, y: 74, s: 0.94, kind: 'grey' },
  { x: 182, y: 196, s: 0.96, kind: 'grey' },
  // --- 짙은 먹구름 · 스모그 (경고 후반~임계점) ---
  { x: 86, y: 150, s: 1.12, kind: 'smog' },
  { x: 160, y: 96, s: 1.2, kind: 'smog' },
  { x: 34, y: 190, s: 1.0, kind: 'smog' },
  { x: 208, y: 152, s: 1.08, kind: 'smog' },
  { x: 120, y: 46, s: 1.04, kind: 'smog' },
  { x: 8, y: 132, s: 1.0, kind: 'smog' },
  { x: 132, y: 168, s: 1.16, kind: 'smog' },
  { x: 66, y: 108, s: 1.06, kind: 'smog' },
  { x: 228, y: 86, s: 0.96, kind: 'smog' },
];

const cloudCount = (t) => Math.round(
  t < 0.05 ? 3
    : t < 0.35 ? 3 + ((t - 0.05) / 0.3) * 3        // 3 → 6
      : t < 0.7 ? 6 + ((t - 0.35) / 0.35) * 3      // 6 → 9
        : 11 + ((t - 0.7) / 0.3) * 3,              // 11 → 14
);

// 구름 빛 — 맑은 구름은 희게, 잿빛·먹구름은 단계가 오를수록 어두워집니다
const cloudTone = (kind, t) => {
  if (kind === 'clean') return mixColor('#ffffff', '#ffe6d8', Math.pow(t, 1.5));
  if (kind === 'grey') return mixColor('#c6cfdb', '#6f7b8a', Math.pow(t, 0.9));
  return mixColor('#9aa6b5', '#2b3442', Math.pow(t, 0.7));
};
const cloudOpacity = (kind, t) => (kind === 'clean' ? 0.72 - 0.3 * t : kind === 'grey' ? 0.66 : 0.7 + 0.02 * t);

// 구름 하나 — 작은 원 세 개와 납작한 밑면. 먹구름은 아래쪽에 어두운 배를 깝니다.
const cloudOne = (cx, cy, s, fill, op, belly) => {
  const shape = (f, dy) => `<circle cx="${(cx - 10 * s).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="${(6.4 * s).toFixed(1)}" fill="${f}"/>`
    + `<circle cx="${cx.toFixed(1)}" cy="${(cy - 3.6 * s + dy).toFixed(1)}" r="${(8.6 * s).toFixed(1)}" fill="${f}"/>`
    + `<circle cx="${(cx + 10 * s).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="${(6.8 * s).toFixed(1)}" fill="${f}"/>`
    + `<rect x="${(cx - 12.8 * s).toFixed(1)}" y="${(cy + dy).toFixed(1)}" width="${(25.6 * s).toFixed(1)}" height="${(6.6 * s).toFixed(1)}" rx="${(3.3 * s).toFixed(1)}" fill="${f}"/>`;
  const shade = belly
    ? `<rect x="${(cx - 12.8 * s).toFixed(1)}" y="${(cy + 3.3 * s).toFixed(1)}" width="${(25.6 * s).toFixed(1)}" height="${(3.3 * s).toFixed(1)}" rx="${(1.6 * s).toFixed(1)}" fill="${belly}"/>`
    : '';
  return `<g opacity="${op}">${shape(fill, 0)}${shade}</g>`;
};

// 구름 한 벌 — 대륙과 다른 속도로 흐릅니다
function cloudArt(c, t) {
  const n = Math.min(CLOUDS.length, cloudCount(t));
  const out = CLOUDS.slice(0, n).map(({ x, y, s, kind }) => {
    const fill = cloudTone(kind, t);
    const belly = kind === 'clean' ? '' : mixColor(fill, '#1f2937', 0.35);
    return cloudOne(x, y, s, fill, cloudOpacity(kind, t), belly);
  }).join('');
  return out;
}

const band = (inner) => `<g>${inner}</g>\n        <g transform="translate(${ART_W} 0)">${inner}</g>`;

const MOOD_TEXT = {
  stable: '깨끗한 대륙과 바다가 숨 쉬어요',
  warming: '발전소·가축이 늘며 지구 기온이 올라요',
  crisis: '산불·폭설·폭우와 바다 폐사가 번져요',
  boiling: '전 세계 재해와 해양 위기가 한계에 닿았어요',
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
  const hazeOp = (0.02 + 0.62 * Math.pow(t, 1.6)).toFixed(3);
  const washOp = Math.min(0.7, Math.pow(Math.max(0, (t - 0.32) / 0.68), 1.15) * 0.95).toFixed(3);
  const ringW = (1.5 + t * 5.5).toFixed(1);
  const ringOp = (0.14 + t * 0.5).toFixed(2);
  const heatOp = (Math.pow(t, 0.85) * 0.75).toFixed(2);
  const heatW = (4 + t * 12).toFixed(1);
  const sparkOp = (0.85 - t * 0.55).toFixed(2);
  const sunOp = (0.26 - t * 0.16).toFixed(2);

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
      <!-- 열기 안개 — 가운데는 맑게 두고 가장자리만 붉게 달구어, 위에 그린 발전소·재해 그림이 묻히지 않게 합니다 -->
      <radialGradient id="earth-haze" cx="50%" cy="50%" r="50%">
        <stop offset="30%" stop-color="${c.atmo}" stop-opacity="0"/>
        <stop offset="72%" stop-color="${c.atmo}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${c.atmo}" stop-opacity="0.92"/>
      </radialGradient>
      <!-- 적열(붉게 달아오름) — 지구 전체를 붉은 빛으로 태웁니다 -->
      <radialGradient id="earth-heat" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.85"/>
        <stop offset="58%" stop-color="#dc2626" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#991b1b" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="earth-sun" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <filter id="earth-pop" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#ffffff" flood-opacity="0.62"/>
      </filter>
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
      <!-- 바다 — 적열 빛이 바다까지 닿도록 클립 안에 한 번 더 깝니다 -->
      <circle cx="120" cy="120" r="92" fill="url(#earth-ocean)"/>

      <!-- 대륙 (자전) -->
      <g class="earth-spin earth-spin-land">
        ${band(landArt(c, t))}
      </g>

      ${iceArt(c, t)}

      <!-- 적열 빛 (대륙·바다를 붉게 달굽니다) -->
      <circle class="earth-heatwash" cx="120" cy="120" r="92" fill="url(#earth-heat)" opacity="${washOp}"/>

      <!-- 구름 (자전 · 대륙과 다른 속도) -->
      <g class="earth-spin earth-spin-clouds">
        ${band(cloudArt(c, t))}
      </g>

      <!-- 원인·재해·바다 폐사 — 구름 위에 그려 구름이 늘어도 그림이 묻히지 않습니다 (대륙과 같은 속도) -->
      <g class="earth-spin earth-spin-land">
        ${band(impactArt(t))}
      </g>

      <!-- 고정 조명 — 자전해도 빛은 늘 같은 자리에서 들어옵니다 -->
      <g class="earth-overlay">
        <ellipse cx="80" cy="52" rx="76" ry="52" fill="url(#earth-sun)"/>
        <path d="M36 108a92 92 0 0 1 34-58" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="${sunOp}"/>

        <!-- 열기 안개 (기후 위기가 깊어질수록 가장자리가 붉게 달아오름) -->
        <circle cx="120" cy="120" r="92" fill="url(#earth-haze)" opacity="${hazeOp}"/>
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
