// 탄소로운 식탁 · 서버 함수(carbonic-table-fn) 호출 도우미
// 모든 데이터는 서버 함수를 거칩니다. 브라우저는 표를 직접 읽지 않습니다.
import { supabase, FN_URL, authToken } from './supabase.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 로그인 토큰은 supabase.js 가 로그인 상태 변화 때 받아 둔 값을 그대로 씁니다 (getSession 을 기다리지 않음)
function token() {
  try { return authToken(); } catch { return ''; }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  let res;
  try {
    res = await fetch(`${FN_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.', { status: 0, code: 'network' });
  }

  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    throw new ApiError(data?.error || `요청을 처리하지 못했어요 (${res.status})`, {
      status: res.status,
      code: data?.code || '',
    });
  }
  return data;
}

const seg = (v) => encodeURIComponent(String(v));

export const api = {
  state: (seasonId) => request(`/state${seasonId ? `?season=${seg(seasonId)}` : ''}`),
  saveProfile: (name, kind) => request('/me', { method: 'POST', body: { name, kind } }),
  deleteProfile: () => request('/me', { method: 'DELETE' }),
  addActivity: (mission_id, done_on) => request('/activities', { method: 'POST', body: { mission_id, done_on } }),
  // 여러 미션·같은 미션 여러 번을 한 번에: { items: [{ mission_id, count, image_url? }], done_on, image_url? }
  //  · 항목 사진은 그 항목의 첫 행에만, 대표(image_url) 사진은 전체 첫 행 한 곳에만 저장됩니다.
  addActivities: (payload) => request('/activities', { method: 'POST', body: payload }),
  // 사진 올리기 — data:image/webp;base64,… 를 보내면 { path: '/images/번호' } 를 돌려줍니다
  uploadImage: (data) => request('/images', { method: 'POST', body: { data } }),
  deleteActivity: (id) => request(`/activities/${seg(id)}`, { method: 'DELETE' }),
  react: (id, emoji) => request(`/activities/${seg(id)}/reactions`, { method: 'POST', body: { emoji } }),
  addComment: (id, body) => request(`/activities/${seg(id)}/comments`, { method: 'POST', body: { body } }),
  deleteComment: (id) => request(`/comments/${seg(id)}`, { method: 'DELETE' }),
  addNotice: (payload) => request('/notices', { method: 'POST', body: payload }),
  patchNotice: (id, patch) => request(`/notices/${seg(id)}`, { method: 'PATCH', body: patch }),
  deleteNotice: (id) => request(`/notices/${seg(id)}`, { method: 'DELETE' }),
  addSeason: (name, note) => request('/seasons', { method: 'POST', body: { name, note } }),
  activateSeason: (id) => request(`/seasons/${seg(id)}/activate`, { method: 'POST', body: {} }),
  setEarth: (id, patch) => request(`/seasons/${seg(id)}/earth`, { method: 'POST', body: patch }),
  endSeason: (id) => request(`/seasons/${seg(id)}/end`, { method: 'POST', body: {} }),
  deleteSeason: (id) => request(`/seasons/${seg(id)}`, { method: 'DELETE' }),
  addMission: (name, air) => request('/missions', { method: 'POST', body: { name, air } }),
  patchMission: (id, patch) => request(`/missions/${seg(id)}`, { method: 'PATCH', body: patch }),
  deleteMission: (id) => request(`/missions/${seg(id)}`, { method: 'DELETE' }),
  addAuction: (payload) => request('/auctions', { method: 'POST', body: payload }),
  patchAuction: (id, patch) => request(`/auctions/${seg(id)}`, { method: 'PATCH', body: patch }),
  startAuction: (id) => request(`/auctions/${seg(id)}/start`, { method: 'POST', body: {} }),
  bid: (id, amount) => request(`/auctions/${seg(id)}/bid`, { method: 'POST', body: { amount } }),
  closeAuction: (id) => request(`/auctions/${seg(id)}/close`, { method: 'POST', body: {} }),
  cancelAuction: (id) => request(`/auctions/${seg(id)}/cancel`, { method: 'POST', body: {} }),
  deleteAuction: (id) => request(`/auctions/${seg(id)}`, { method: 'DELETE' }),
  patchMember: (userId, patch) => request(`/members/${seg(userId)}`, { method: 'PATCH', body: patch }),
  deleteMember: (userId) => request(`/members/${seg(userId)}`, { method: 'DELETE' }),
};
