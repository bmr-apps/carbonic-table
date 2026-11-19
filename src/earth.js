// 지구 그림 (v4) — 시원하고 건강한 지구에서 기후 위기의 뜨거운 지구까지.
//  · 탄소가 쌓이면(순탄소 ↑) 바다·대륙이 붉게 달아오르고, 극지방 빙하가 녹아 줄어들며, 열기 링이 강해집니다.
//  · 공기가 모여 순탄소가 줄면 다시 푸르고 시원한 지구로 돌아옵니다.
//  · 대륙과 구름은 서로 다른 속도로 자전합니다 (같은 그림 2벌을 240만큼 옆에 이어 붙여 translateX 무한 루프).
//  · 바깥 구형 음영(하이라이트·그림자)과 대기광 링은 고정해 두어 입체감이 살아 있습니다.

const hexOf = (h) => {
  const s = String(h).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
export const mixColor = (a, b, t) => {
  const A = hexOf(a), B = hexOf(b), k = Math.max(0, Math.min(1, Number(t) || 0));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// [안정, 위기, 곡선] — 온난화 정도(t)에 따라 섞습니다. 곡선이 클수록 시원한 색을 오래 지킵니다.
const PALETTE = {
  oceanLight: ['#c2f5fc', '#f3b184', 1.1],
  ocean: ['#2f9fda', '#a63d2c', 1.15],
  oceanDeep: ['#0a4a86', '#5a1a13', 1.2],
  land: ['#52c46d', '#bb4c38', 1.55],
  landDeep: ['#2f9455', '#9c3a2a', 1.55],
  landLine: ['#1b6a40', '#55190f', 1.5],
  forest: ['#1f7a45', '#7d2a1e', 1.55],
  meadow: ['#a6e07c', '#d98a55', 1.6],
  sand: ['#ecdba0', '#dca471', 1.4],
  mountain: ['#3f7f4f', '#8f3524', 1.55],
  snow: ['#ffffff', '#ffe6da', 1.6],
  river: ['#cdefff', '#f0c1a5', 1.4],
  cloud: ['#ffffff', '#f6dccd', 1.4],
  atmo: ['#9fe6ff', '#ef8655', 1.25],
  ring: ['#38bdf8', '#ef4444', 1],
};

// 세 색을 이어 섞습니다 (파랑 → 청록 → 붉은색처럼 중간색이 탁해지지 않게)
const mix3 = (a, b, c, k) => (k < 0.5 ? mixColor(a, b, k * 2) : mixColor(b, c, (k - 0.5) * 2));

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
  const c = {};
  for (const [k, [a, b, g]] of Object.entries(PALETTE)) c[k] = mixColor(a, b, Math.pow(t, g ?? 1));
  // 바다: 파랑 → 청록 → 붉은 갈색 (파랑과 빨강을 바로 섞으면 보라색이 되어 지구가 탁해 보입니다)
  const ko = Math.pow(t, 1.05);
  c.ocean = mix3('#2f9fda', '#146f7d', '#a63d2c', ko);
  c.oceanLight = mix3('#c2f5fc', '#5fb9c4', '#f3b184', ko);
  c.oceanDeep = mix3('#0a4a86', '#0a3b45', '#5a1a13', ko);
  // 테두리 빛: 시원한 하늘빛 → 따뜻한 주황 → 빨강 (녹색으로 돌지 않게 단계를 나눕니다)
  c.ring = t < 0.3 ? mixColor('#38bdf8', '#7dd3fc', t / 0.3)
    : t < 0.6 ? mixColor('#7dd3fc', '#f59e0b', (t - 0.3) / 0.3)
      : mixColor('#f59e0b', '#ef4444', (t - 0.6) / 0.4);
  const state = earthState(t);
  return { ...c, state, label: EARTH_STATES[state].label, temp: tempText(t) };
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

// 대륙 — 해안선이 살아 있는 지구본 모양
const LAND = [
  // 북아메리카
  'M50 64l12-9 15-2 11 6-2 8 7 2 2 8-6 2 2 8-7 4 3 9-7 6-4-6-6 2-2-8-8-2-2-8-7-4 2-8 6-9-9-2z',
  // 남아메리카
  'M79 109l9-4 9 6 5 11-4 10 2 9-6 11-4 12-8 11-4-8 2-11-6-10 2-10-4-12 4-9z',
  // 그린란드
  'M94 40l10-3 8 5-2 7-8 3-7-5z',
  // 유럽
  'M107 58l11-6 13 1 7 6-3 7-8-1-4 6-9 1-6-5-4-5z',
  // 아프리카
  'M104 83l12-6 13 3 8 7 1 10 9 9-5 9-7-2-3 9-4 9-4 11-4 13-6 5-4-7 3-11-7-10-4-13-4-12 2-11 4-12z',
  // 아시아
  'M138 53l14-7 18-2 17 5 12 9 6 12-6 10-9 4-6-6-8 4-6 8-9-3-2 8-6-5-5-9-9-3-4-11-4-10z',
  // 인도반도
  'M157 92l9 2 4 10-4 12-7-4-2-11z',
  // 동남아시아
  'M175 87l9 4 4 8-7 5-7-7z',
  // 오스트레일리아
  'M167 147l12-4 13 4 5 10-7 10-12 1-9-8z',
  // 마다가스카르
  'M139 125l5 3 1 8-5 5-3-7z',
  // 일본
  'M191 79l4 6-2 9-4-3 1-7z',
  // 뉴질랜드
  'M199 168l4 4-3 7-4-4z',
];
// 좁은 바다를 건너는 섬들 — 자전 띠의 이음매(가장자리)가 허전하지 않게 채워 줍니다
const ISLANDS = [
  'M16 118l7-3 6 4-2 6-7 2-5-4z',   // 하와이 부근
  'M28 96l4-2 4 3-1 4-5 1z',
  'M210 132l6-2 5 4-3 5-6 1z',      // 폴리네시아
  'M222 104l4-2 3 3-2 4-4-1z',
];

// 숲 (작은 나무 점)
const TREES = [
  [63, 80], [68, 86], [60, 88], [73, 76],            // 북아메리카 동부
  [85, 124], [90, 130], [83, 133], [94, 120], [98, 128], // 아마존
  [116, 94], [121, 101], [127, 107], [111, 104],     // 콩고
  [150, 62], [158, 57], [166, 62], [176, 72],        // 시베리아
  [161, 108], [172, 112],                            // 동남아시아
  [177, 157], [185, 161],                            // 오스트레일리아
];
// 초원 (밝은 풀밭)
const MEADOW = [
  [55, 71, 6, 3.4], [72, 74, 7, 4], [96, 116, 4.4, 2.6],
  [110, 88, 5, 3], [146, 60, 6, 3.2], [170, 78, 8, 4],
  [173, 151, 5, 3],
];
const RIVERS = [
  'M84 124c5 4 11 4 16 6',            // 아마존
  'M124 92c4 5 1 11 4 16 2 4 0 8 1 11', // 나일
  'M152 72c-4 5-9 7-14 7',            // 양쯔
];
const MOUNTAINS = [
  [156, 80, 5, 6],  // 히말라야
  [84, 133, 4, 5],  // 안데스
  [62, 74, 4, 5],   // 록키
];

// 대륙 한 벌 (자전 띠의 한 주기 = 240)
function landArt(c, t) {
  const peak = 0.45 * (1 - 0.55 * t);   // 기온이 오르면 높은 산의 만년설이 줄어듭니다
  return `
        <g stroke="${c.landLine}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
          ${LAND.map((d) => `<path d="${d}" fill="${c.land}"/>`).join('\n          ')}
          ${ISLANDS.map((d) => `<path d="${d}" fill="${c.land}"/>`).join('\n          ')}
          <path d="M110 92c4-1 7 2 7 5s-3 5-6 3-3-7-1-8z" fill="${c.land}"/>
          <circle cx="160" cy="176" r="2.4" fill="${c.land}"/>
          <circle cx="196" cy="120" r="2.2" fill="${c.land}"/>
          <circle cx="52" cy="148" r="2" fill="${c.land}"/>
        </g>

        <g fill="${c.landDeep}" opacity="0.45">
          <path d="M110 96l10-3 9 5 1 8-7 5-9-3-4-8z"/>
          <path d="M150 63l12-3 13 4 5 6-9 4-13-2-8-5z"/>
          <path d="M84 118l8-2 6 7-4 9-7-1-3-7z"/>
          <path d="M168 152l8-2 8 4 1 6-9 3-8-5z"/>
        </g>

        ${MEADOW.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c.meadow}" opacity="0.9"/>`).join('\n        ')}
        <ellipse cx="120" cy="92" rx="8" ry="4.2" fill="${c.sand}" opacity="0.95"/>
        <ellipse cx="178" cy="158" rx="5" ry="2.8" fill="${c.sand}" opacity="0.9"/>
        <ellipse cx="168" cy="90" rx="6" ry="3" fill="${c.sand}" opacity="0.9"/>

        <g fill="${c.forest}">
          ${TREES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join('')}
        </g>
        <g fill="${c.forest}" opacity="0.6">
          ${TREES.map(([x, y]) => `<circle cx="${x + 2.6}" cy="${y + 3}" r="1.4"/>`).join('')}
        </g>

        <g stroke="${c.landLine}" stroke-width="1" stroke-linejoin="round" stroke-opacity="0.8">
          ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${x - w} ${y}l${w} -${h}l${w} ${h}z" fill="${c.mountain}"/>`).join('\n          ')}
          ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${x - w * peak} ${y - h * (1 - peak)}l${w * peak} -${h * peak}l${w * peak} ${h * peak}z" fill="${c.snow}" stroke="none"/>`).join('\n          ')}
        </g>

        <g fill="none" stroke="${c.river}" stroke-width="1.7" stroke-linecap="round" opacity="0.95">
          ${RIVERS.map((d) => `<path d="${d}"/>`).join('\n          ')}
        </g>`;
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

const ART_W = 240; // 자전 띠 한 주기의 폭
const band = (inner) => `<g>${inner}</g>\n        <g transform="translate(${ART_W} 0)">${inner}</g>`;

export function earthSvg(p) {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  const c = earthLook(t);
  const pct = Math.round(t * 100);
  const hazeOp = (0.015 + 0.3 * Math.pow(t, 1.8)).toFixed(3);
  const ringW = (1.5 + t * 5.5).toFixed(1);
  const ringOp = (0.14 + t * 0.5).toFixed(2);
  const heatOp = (t * 0.5).toFixed(2);
  const heatW = (4 + t * 12).toFixed(1);
  const cloudOp = (0.8 - t * 0.32).toFixed(2);
  const sparkOp = (0.85 - t * 0.55).toFixed(2);
  const iceK = Math.max(0.06, 1 - 0.94 * Math.pow(t, 0.85));   // 빙하가 녹는 정도
  const sunOp = (0.26 - t * 0.16).toFixed(2);

  // 극지방 빙하 — 위는 y=0, 아래는 y=240 을 축으로 줄어듭니다
  const iceNorth = 'M-6 -6H246V62C220 70 200 54 176 62C152 70 136 54 112 62C88 70 72 54 48 62C24 70 8 58 -6 64Z';
  const iceSouth = 'M-6 246H246V178C220 170 200 186 176 178C152 170 136 186 112 178C88 170 72 186 48 178C24 170 8 182 -6 176Z';

  return `<svg class="earth-svg" viewBox="0 0 240 240" role="img" aria-label="지구 온난화 지수 ${pct}% · 지구 온도 ${tempText(t)}">
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
      <clipPath id="earth-clip"><circle cx="120" cy="120" r="92"/></clipPath>
    </defs>

    <!-- 대기광 (고정) -->
    <circle cx="120" cy="120" r="107" fill="url(#earth-atmo)" opacity="0.95"/>
    <circle cx="120" cy="120" r="92" fill="url(#earth-ocean)" stroke="#000" stroke-width="3"/>

    <g clip-path="url(#earth-clip)">
      <!-- 대륙 (자전) -->
      <g class="earth-spin earth-spin-land">
        ${band(landArt(c, t))}
      </g>

      <!-- 구름 (자전 · 대륙과 다른 속도) -->
      <g class="earth-spin earth-spin-clouds">
        ${band(cloudArt(c, cloudOp))}
      </g>

      <!-- 극지방 빙하 (고정 · 기온이 오르면 녹아 줄어듭니다) -->
      <g class="earth-ice" fill="${c.snow}" stroke="${mixColor('#bfe9ff', '#ffd9c8', t)}" stroke-width="1.1" opacity="0.94">
        <path d="${iceNorth}" transform="translate(0 ${(28 * (1 - iceK)).toFixed(2)}) scale(1 ${iceK.toFixed(3)})"/>
        <path d="${iceSouth}" transform="translate(0 ${((240 - 28) * (1 - iceK)).toFixed(2)}) scale(1 ${iceK.toFixed(3)})"/>
      </g>

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
