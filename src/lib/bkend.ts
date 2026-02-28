const BKEND_DIRECT = 'https://api-client.bkend.ai/v1';
const API_KEY = process.env.NEXT_PUBLIC_BKEND_API_KEY!;

// 브라우저: CORS 우회를 위해 Next.js API 프록시 경유
// 서버: 직접 호출
const API_BASE =
  typeof window !== 'undefined' ? '/api/bkend' : BKEND_DIRECT;

async function bkendFetch(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('bkend_access_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const bkend = {
  auth: {
    signup: (body: { email: string; password: string; name: string }) =>
      bkendFetch('/auth/email/signup', {
        method: 'POST',
        body: JSON.stringify({ method: 'password', ...body }),
      }),
    signin: (body: { email: string; password: string }) =>
      bkendFetch('/auth/email/signin', {
        method: 'POST',
        body: JSON.stringify({ method: 'password', ...body }),
      }),
    me: () => bkendFetch('/auth/me'),
    refresh: (refreshToken: string) =>
      bkendFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
    signout: () => bkendFetch('/auth/signout', { method: 'POST' }),
  },
  data: {
    list: (table: string, params?: Record<string, string>) =>
      bkendFetch(`/data/${table}?${new URLSearchParams(params)}`),
    get: (table: string, id: string) => bkendFetch(`/data/${table}/${id}`),
    create: (table: string, body: unknown) =>
      bkendFetch(`/data/${table}`, { method: 'POST', body: JSON.stringify(body) }),
    update: (table: string, id: string, body: unknown) =>
      bkendFetch(`/data/${table}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (table: string, id: string) =>
      bkendFetch(`/data/${table}/${id}`, { method: 'DELETE' }),
  },
};
