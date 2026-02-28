import { NextRequest, NextResponse } from 'next/server';

const BKEND_BASE = 'https://api-client.bkend.ai/v1';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetUrl = `${BKEND_BASE}/${path.join('/')}`;

  // 쿼리스트링 그대로 전달
  const { search } = new URL(req.url);
  const url = search ? `${targetUrl}${search}` : targetUrl;

  const headers = new Headers();
  // bkend 인증 헤더 전달
  const apiKey = req.headers.get('x-api-key');
  const authorization = req.headers.get('authorization');
  const contentType = req.headers.get('content-type');

  if (apiKey) headers.set('X-API-Key', apiKey);
  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
