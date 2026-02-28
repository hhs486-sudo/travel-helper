const BKEND_DIRECT = process.env.NEXT_PUBLIC_BKEND_API_URL || 'https://api.bkend.ai/v1';
const PROJECT_ID = process.env.NEXT_PUBLIC_BKEND_PROJECT_ID!;
const ENVIRONMENT = process.env.NEXT_PUBLIC_BKEND_ENV || 'dev';

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
      'x-project-id': PROJECT_ID,
      'x-environment': ENVIRONMENT,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
const OAUTH_CALLBACK_BASE =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

export const bkend = {
  auth: {
    signup: (body: { email: string; password: string }) =>
      bkendFetch('/auth/email/signup', { method: 'POST', body: JSON.stringify(body) }),
    signin: (body: { email: string; password: string }) =>
      bkendFetch('/auth/email/signin', { method: 'POST', body: JSON.stringify(body) }),
    me: () => bkendFetch('/auth/me'),
    refresh: (refreshToken: string) =>
      bkendFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
    signout: () => bkendFetch('/auth/signout', { method: 'POST' }),

    github: {
      // GitHub OAuth URL 생성 후 리다이렉트
      redirect: () => {
        const state = crypto.randomUUID();
        sessionStorage.setItem('oauth_state', state);
        const redirectUri = `${OAUTH_CALLBACK_BASE}/auth/callback/github`;
        const url = new URL('https://github.com/login/oauth/authorize');
        url.searchParams.set('client_id', GITHUB_CLIENT_ID);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', 'user:email user');
        url.searchParams.set('state', state);
        window.location.href = url.toString();
      },
      // callback: code + state → bkend → JWT
      callback: (body: { code: string; state: string; redirectUri: string }) =>
        bkendFetch('/auth/github/callback', { method: 'POST', body: JSON.stringify(body) }),
    },
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
