// 지구 그림 (v3+) — 맑고 건강한 자연 지구에서 붉게 달아오른 지구까지,
// 같은 그림을 색만 이어 그려(연속 보간) 시간이 흐르거나 공기가 쌓이면 부드럽게 바뀝니다.

const hexOf = (h) => {
  const s = String(h).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
export const mixColor = (a, b, t) => {
  const A = hexOf(a), B = hexOf(b), k = Math.max(0, Math.min(1, Number(t) || 0));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// [맑음, 오염, 곡선] — 오염도(t)에 따라 섞습니다. 곡선이 클수록 맑은 색을 오래 지킵니다.
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

export function earthLook(p) {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  const c = {};
  for (const [k, [a, b, g]] of Object.entries(PALETTE)) c[k] = mixColor(a, b, Math.pow(t, g ?? 1));
  return {
    ...c,
    label: t < 0.05 ? '맑음' : t < 0.35 ? '조금 흐림' : t < 0.7 ? '뿌옇게 덮임' : '붉게 달아오름',
  };
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

export function earthSvg(p) {
  const t = Math.max(0, Math.min(1, Number(p) || 0));
  const c = earthLook(t);
  const hazeOp = (0.02 + 0.44 * Math.pow(t, 1.3)).toFixed(2);
  const ringW = (1.5 + t * 7).toFixed(1);
  const ringOp = (0.12 + t * 0.52).toFixed(2);
  const cloudOp = (0.82 - t * 0.34).toFixed(2);
  const sparkOp = (0.85 - t * 0.55).toFixed(2);
  return `<svg class="earth-svg" viewBox="0 0 240 240" role="img" aria-label="지구 오염도 ${Math.round(t * 100)}%">
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
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <filter id="earth-soft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8"/>
      </filter>
      <filter id="earth-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1.2" dy="2.2" stdDeviation="1.6" flood-color="#06355e" flood-opacity="0.35"/>
      </filter>
      <clipPath id="earth-clip"><circle cx="120" cy="120" r="92"/></clipPath>
    </defs>

    <circle cx="120" cy="120" r="107" fill="url(#earth-atmo)" opacity="0.95"/>
    <circle cx="120" cy="120" r="92" fill="url(#earth-ocean)" stroke="#000" stroke-width="3"/>

    <g clip-path="url(#earth-clip)">
      <!-- 남극 얼음 -->
      <path d="M56 210c20-7 36-2 54-5 18-3 36 4 54 2 10-1 20 1 30 4v14H56z" fill="${c.snow}" opacity="0.55"/>

      <!-- 대륙 -->
      <g stroke="${c.landLine}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" filter="url(#earth-shadow)">
        ${LAND.map((d) => `<path d="${d}" fill="${c.land}"/>`).join('\n        ')}
        <path d="M110 92c4-1 7 2 7 5s-3 5-6 3-3-7-1-8z" fill="${c.land}"/>
        <circle cx="160" cy="176" r="2.4" fill="${c.land}"/>
        <circle cx="196" cy="120" r="2.2" fill="${c.land}"/>
        <circle cx="52" cy="148" r="2" fill="${c.land}"/>
      </g>

      <!-- 짙은 숲 지대 -->
      <g fill="${c.landDeep}" opacity="0.45">
        <path d="M110 96l10-3 9 5 1 8-7 5-9-3-4-8z"/>
        <path d="M150 63l12-3 13 4 5 6-9 4-13-2-8-5z"/>
        <path d="M84 118l8-2 6 7-4 9-7-1-3-7z"/>
        <path d="M168 152l8-2 8 4 1 6-9 3-8-5z"/>
      </g>

      <!-- 초원 -->
      ${MEADOW.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c.meadow}" opacity="0.9"/>`).join('\n      ')}
      <!-- 모래·사막 -->
      <ellipse cx="120" cy="92" rx="8" ry="4.2" fill="${c.sand}" opacity="0.95"/>
      <ellipse cx="178" cy="158" rx="5" ry="2.8" fill="${c.sand}" opacity="0.9"/>
      <ellipse cx="168" cy="90" rx="6" ry="3" fill="${c.sand}" opacity="0.9"/>

      <!-- 숲 -->
      <g fill="${c.forest}">
        ${TREES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join('')}
      </g>
      <g fill="${c.forest}" opacity="0.6">
        ${TREES.map(([x, y]) => `<circle cx="${x + 2.6}" cy="${y + 3}" r="1.4"/>`).join('')}
      </g>

      <!-- 산 -->
      <g stroke="${c.landLine}" stroke-width="1" stroke-linejoin="round" stroke-opacity="0.8">
        ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${x - w} ${y}l${w} -${h}l${w} ${h}z" fill="${c.mountain}"/>`).join('\n        ')}
        ${MOUNTAINS.map(([x, y, w, h]) => `<path d="M${x - w * 0.45} ${y - h * 0.55}l${w * 0.45} -${h * 0.45}l${w * 0.45} ${h * 0.45}z" fill="${c.snow}" stroke="none"/>`).join('\n        ')}
      </g>

      <!-- 강 -->
      <g fill="none" stroke="${c.river}" stroke-width="1.7" stroke-linecap="round" opacity="0.95">
        ${RIVERS.map((d) => `<path d="${d}"/>`).join('\n        ')}
      </g>

      <!-- 구름 -->
      <g fill="${c.cloud}" opacity="${cloudOp}" filter="url(#earth-soft)">
        <g><circle cx="60" cy="104" r="7"/><circle cx="70" cy="100" r="9.5"/><circle cx="81" cy="105" r="7"/><rect x="56" y="104" width="29" height="7" rx="3.5"/></g>
        <g><circle cx="146" cy="140" r="8"/><circle cx="157" cy="136" r="10"/><circle cx="168" cy="141" r="7.5"/><rect x="142" y="140" width="30" height="8" rx="4"/></g>
        <g><circle cx="58" cy="172" r="6"/><circle cx="66" cy="169" r="8"/><circle cx="75" cy="173" r="6"/><rect x="55" y="172" width="24" height="6.5" rx="3"/></g>
        <g><circle cx="174" cy="58" r="5.5"/><circle cx="181" cy="55" r="7"/><circle cx="189" cy="59" r="5"/><rect x="171" y="58" width="21" height="5.5" rx="2.6"/></g>
      </g>

      <!-- 햇살 -->
      <ellipse cx="80" cy="52" rx="76" ry="52" fill="url(#earth-sun)"/>
      <path d="M36 108a92 92 0 0 1 34-58" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="${(0.26 - t * 0.16).toFixed(2)}"/>

      <!-- 오염 안개 -->
      <circle cx="120" cy="120" r="92" fill="${c.atmo}" opacity="${hazeOp}"/>
    </g>

    <!-- 반짝임 -->
    <g fill="#ffffff" opacity="${sparkOp}">
      <path d="M34 46l1.4 3.9 3.9 1.4-3.9 1.4L34 56.6l-1.4-3.9L28.7 51.3l3.9-1.4z"/>
      <path d="M208 64l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z"/>
      <path d="M199 186l0.9 2.5 2.5 0.9-2.5 0.9-0.9 2.5-0.9-2.5-2.5-0.9 2.5-0.9z"/>
      <path d="M43 196l0.9 2.5 2.5 0.9-2.5 0.9-0.9 2.5-0.9-2.5-2.5-0.9 2.5-0.9z"/>
    </g>

    <circle cx="120" cy="120" r="99" fill="none" stroke="${c.ring}" stroke-width="${ringW}" opacity="${ringOp}"/>
    <circle cx="120" cy="120" r="92" fill="none" stroke="#000" stroke-width="3"/>
  </svg>`;
}
