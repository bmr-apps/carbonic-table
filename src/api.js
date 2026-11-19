// 탄소로운 식탁 · 서버 함수(carbonic-table-fn) 호출 도우미
// 모든 데이터는 서버 함수를 거칩니다. 브라우저는 표를 직접 읽지 않습니다.
import { supabase, FN_URL } from './supabase.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function token() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? '';
  } catch {
    return '';
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = await token();
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

export const api = {
  state: () => request('/state'),
  saveProfile: (name, kind) => request('/me', { method: 'POST', body: { name, kind } }),
  addActivity: (mission_id, done_on) => request('/activities', { method: 'POST', body: { mission_id, done_on } }),
  deleteActivity: (id) => request(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addMission: (name, air) => request('/missions', { method: 'POST', body: { name, air } }),
  patchMission: (id, patch) => request(`/missions/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  addAuction: (payload) => request('/auctions', { method: 'POST', body: payload }),
  bid: (id, amount) => request(`/auctions/${encodeURIComponent(id)}/bid`, { method: 'POST', body: { amount } }),
  closeAuction: (id) => request(`/auctions/${encodeURIComponent(id)}/close`, { method: 'POST', body: {} }),
  cancelAuction: (id) => request(`/auctions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} }),
  deleteAuction: (id) => request(`/auctions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteMember: (userId) => request(`/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
};
